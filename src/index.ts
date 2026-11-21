import {
  authenticate, blocked, clearCookieHeader, cookieHeader, DUMMY_HASH, hashPassword, iterations, passwordProblem,
  randomToken, recordAttempt, sha256, signSession, verifyPassword,
} from './auth';
import { applyPush, createFamily, familyRev, joinFamily, normEmail, renameUser, requireMember, snapshot, validEmail, validName, type PushBody } from './family';
import { migrateFromFirebase, migrationEnabled } from './firebase';
import { mailEnabled, resetEmail, sendMail } from './mail';
import { ApiError, type Env, type UserRow } from './types';

/** En-têtes de sécurité des réponses de l'API (les fichiers statiques ont les leurs dans public/_headers). */
const API_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};
const json = (data: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(data), { ...init, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...API_HEADERS, ...init.headers } });
const fail = (status: number, code: string, extra: Record<string, unknown> = {}) => json({ error: code, ...extra }, { status });

/** Taille maximale d'une requête (une fiche peut contenir des photos, jusqu'à 1 Mo chacune) */
const MAX_BODY = 8 * 1024 * 1024;
const RESET_TTL_MS = 3600 * 1000;

const me = (u: UserRow) => ({ uid: u.id, email: u.email, name: u.name, familyId: u.family_id });

async function readJson<T>(req: Request): Promise<T> {
  if (!(req.headers.get('Content-Type') ?? '').includes('application/json')) throw new ApiError(415, 'donnees-invalides');
  const len = Number(req.headers.get('Content-Length') ?? 0);
  if (len > MAX_BODY) throw new ApiError(413, 'fiche-trop-lourde');
  const text = await req.text();
  if (text.length > MAX_BODY) throw new ApiError(413, 'fiche-trop-lourde');
  try { return JSON.parse(text) as T; } catch { throw new ApiError(400, 'donnees-invalides'); }
}

/** Refuse les requêtes qui modifient des données si elles viennent d'un autre site (protection anti-CSRF). */
function sameOrigin(req: Request, url: URL): boolean {
  const site = req.headers.get('Sec-Fetch-Site');
  if (site && site !== 'same-origin' && site !== 'none') return false;
  const origin = req.headers.get('Origin');
  return !origin || origin === url.origin;
}

async function loginResponse(env: Env, user: UserRow, status = 200): Promise<Response> {
  const value = await signSession(env.SESSION_SECRET, user.id, user.session_ver);
  return json(me(user), { status, headers: { 'Set-Cookie': cookieHeader(value) } });
}

// ---------- Routes publiques ----------

async function register(req: Request, env: Env, ip: string): Promise<Response> {
  const b = await readJson<{ email?: unknown; password?: unknown; name?: unknown }>(req);
  const email = normEmail(b.email);
  const pw = typeof b.password === 'string' ? b.password : '';
  if (!validEmail(email)) return fail(400, 'auth/invalid-email');
  const bad = passwordProblem(pw);
  if (bad) return fail(400, bad);
  if (!validName(b.name)) return fail(400, 'donnees-invalides');
  if (await env.DB.prepare('SELECT 1 ok FROM users WHERE email = ?').bind(email).first()) return fail(409, 'auth/email-already-in-use');
  // Compte de l'ancienne version : on le reprend (avec son espace) au lieu d'en créer un vide
  const wait = await blocked(env, ip, 'login');
  if (wait) return fail(429, 'auth/too-many-requests', { retryAfter: wait });
  const migrated = await migrateFromFirebase(env, email, pw);
  if (migrated) return loginResponse(env, migrated);
  const user: UserRow = {
    id: randomToken(16), email, name: (b.name as string).trim(), pw_hash: await hashPassword(pw, iterations(env)),
    family_id: null, session_ver: 0, created_at: Date.now(),
  };
  await env.DB.prepare('INSERT INTO users (id, email, name, pw_hash, family_id, session_ver, created_at) VALUES (?, ?, ?, ?, NULL, 0, ?)')
    .bind(user.id, user.email, user.name, user.pw_hash, user.created_at).run();
  return loginResponse(env, user, 201);
}

async function login(req: Request, env: Env, ip: string): Promise<Response> {
  const wait = await blocked(env, ip, 'login');
  if (wait) return fail(429, 'auth/too-many-requests', { retryAfter: wait });
  const b = await readJson<{ email?: unknown; password?: unknown }>(req);
  const email = normEmail(b.email);
  const pw = typeof b.password === 'string' ? b.password : '';
  const iter = iterations(env);
  const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<UserRow>();
  if (!user) {
    const migrated = validEmail(email) && pw ? await migrateFromFirebase(env, email, pw) : null;
    if (migrated) { await recordAttempt(env, ip, 'login', true); return loginResponse(env, migrated); }
    if (!migrationEnabled(env)) await verifyPassword(pw, DUMMY_HASH, iter); // même durée que pour un compte existant
    await recordAttempt(env, ip, 'login', false);
    return fail(401, 'auth/invalid-credential');
  }
  const v = await verifyPassword(pw, user.pw_hash, iter);
  if (!v.ok) { await recordAttempt(env, ip, 'login', false); return fail(401, 'auth/invalid-credential'); }
  if (v.rehash) {
    user.pw_hash = await hashPassword(pw, iter);
    await env.DB.prepare('UPDATE users SET pw_hash = ? WHERE id = ?').bind(user.pw_hash, user.id).run();
  }
  await recordAttempt(env, ip, 'login', true);
  return loginResponse(env, user);
}

async function resetRequest(req: Request, env: Env, ip: string, url: URL, ctx: ExecutionContext): Promise<Response> {
  if (!mailEnabled(env)) return fail(503, 'reset-indisponible');
  const wait = await blocked(env, ip, 'reset');
  if (wait) return fail(429, 'auth/too-many-requests', { retryAfter: wait });
  await recordAttempt(env, ip, 'reset', false);
  const b = await readJson<{ email?: unknown }>(req);
  const email = normEmail(b.email);
  if (!validEmail(email)) return fail(400, 'auth/invalid-email');
  const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<UserRow>();
  // Même réponse que le compte existe ou non (pas d'énumération des comptes)
  if (user) {
    const token = randomToken(32);
    const t = Date.now();
    await env.DB.batch([
      env.DB.prepare('DELETE FROM password_resets WHERE user_id = ? OR expires_at < ?').bind(user.id, t),
      env.DB.prepare('INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, ?)').bind(await sha256(token), user.id, t + RESET_TTL_MS),
    ]);
    const link = `${url.origin}/?reset=${encodeURIComponent(token)}`;
    ctx.waitUntil(sendMail(env, user.email, resetEmail(user.name, link)).catch((e) => console.error(e)));
  }
  return json({ ok: true });
}

async function resetConfirm(req: Request, env: Env, ip: string): Promise<Response> {
  const wait = await blocked(env, ip, 'reset');
  if (wait) return fail(429, 'auth/too-many-requests', { retryAfter: wait });
  const b = await readJson<{ token?: unknown; password?: unknown }>(req);
  const bad = passwordProblem(b.password);
  if (bad) return fail(400, bad);
  if (typeof b.token !== 'string' || b.token.length > 100) return fail(400, 'lien-expire');
  const hash = await sha256(b.token);
  const row = await env.DB.prepare('SELECT user_id, expires_at FROM password_resets WHERE token_hash = ?').bind(hash).first<{ user_id: string; expires_at: number }>();
  if (!row || row.expires_at < Date.now()) { await recordAttempt(env, ip, 'reset', false); return fail(400, 'lien-expire'); }
  const pwHash = await hashPassword(b.password as string, iterations(env));
  await env.DB.batch([
    env.DB.prepare('UPDATE users SET pw_hash = ?, session_ver = session_ver + 1 WHERE id = ?').bind(pwHash, row.user_id),
    env.DB.prepare('DELETE FROM password_resets WHERE user_id = ?').bind(row.user_id),
  ]);
  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(row.user_id).first<UserRow>();
  return loginResponse(env, user!);
}

// ---------- Routes réservées aux utilisateurs connectés ----------

async function account(req: Request, env: Env, user: UserRow): Promise<Response> {
  const b = await readJson<{ name?: unknown; password?: unknown }>(req);
  if (b.name !== undefined) {
    if (!validName(b.name)) return fail(400, 'donnees-invalides');
    await renameUser(env, user, b.name.trim());
    user.name = b.name.trim();
  }
  if (b.password !== undefined && b.password !== '') {
    const bad = passwordProblem(b.password);
    if (bad) return fail(400, bad);
    // Nouveau mot de passe : les autres appareils sont déconnectés, celui-ci reçoit une nouvelle session
    user.pw_hash = await hashPassword(b.password as string, iterations(env));
    user.session_ver += 1;
    await env.DB.prepare('UPDATE users SET pw_hash = ?, session_ver = ? WHERE id = ?').bind(user.pw_hash, user.session_ver, user.id).run();
    return loginResponse(env, user);
  }
  return json(me(user));
}

async function getFamily(env: Env, user: UserRow, url: URL): Promise<Response> {
  const { fid, member } = await requireMember(env, user);
  const known = Number(url.searchParams.get('rev'));
  if (known) {
    const rev = await familyRev(env, fid);
    if (rev === known) return json({ rev, unchanged: true });
  }
  return json({ id: fid, role: member.role, ...(await snapshot(env, fid, member.role)) });
}

async function route(req: Request, env: Env, ctx: ExecutionContext, url: URL): Promise<Response> {
  const path = url.pathname;
  const method = req.method;
  const ip = req.headers.get('CF-Connecting-IP') ?? 'local';
  if (!env.SESSION_SECRET) { console.error('Secret SESSION_SECRET manquant'); return fail(500, 'configuration'); }
  if (method !== 'GET' && !sameOrigin(req, url)) return fail(403, 'permission-denied');

  if (method === 'POST' && path === '/api/auth/register') return register(req, env, ip);
  if (method === 'POST' && path === '/api/auth/login') return login(req, env, ip);
  if (method === 'POST' && path === '/api/auth/logout') return json({ ok: true }, { headers: { 'Set-Cookie': clearCookieHeader() } });
  if (method === 'POST' && path === '/api/auth/reset-request') return resetRequest(req, env, ip, url, ctx);
  if (method === 'POST' && path === '/api/auth/reset') return resetConfirm(req, env, ip);

  const auth = await authenticate(req, env);
  if (!auth) return fail(401, 'non-connecte');
  const { user } = auth;
  let res: Response;
  if (method === 'GET' && path === '/api/me') res = json(me(user));
  else if (method === 'POST' && path === '/api/account') res = await account(req, env, user);
  else if (method === 'GET' && path === '/api/family') res = await getFamily(env, user, url);
  else if (method === 'POST' && path === '/api/family') {
    const fid = await createFamily(env, user, await readJson(req));
    res = json({ familyId: fid }, { status: 201 });
  } else if (method === 'POST' && path === '/api/family/push') res = json({ rev: await applyPush(env, user, await readJson<PushBody>(req)) });
  else if (method === 'POST' && path === '/api/family/join') {
    const b = await readJson<{ code?: unknown }>(req);
    res = json({ familyId: await joinFamily(env, user, b.code) });
  } else return fail(404, 'introuvable');

  // Session prolongée tant que l'appli est utilisée
  if (auth.renew && !res.headers.has('Set-Cookie')) {
    res = new Response(res.body, res);
    res.headers.set('Set-Cookie', cookieHeader(await signSession(env.SESSION_SECRET, user.id, user.session_ver)));
  }
  return res;
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    try {
      return await route(req, env, ctx, url);
    } catch (e) {
      if (e instanceof ApiError) return fail(e.status, e.code);
      // Détail seulement dans les journaux Cloudflare
      console.error(req.method, url.pathname, e);
      return fail(500, 'erreur-serveur');
    }
  },
} satisfies ExportedHandler<Env>;
