import { randomToken } from './auth';
import { ApiError, ROLES, type Env, type FamilyRow, type InviteRow, type MemberRow, type ProfileRow, type Role, type UserRow } from './types';

// Limites (l'ancienne version Firebase plafonnait chaque document à 1 Mio)
const MAX_PROFILE_JSON = 1_000_000;
const MAX_META_JSON = 200_000;
const MAX_PROFILES = 300;
const MAX_NAME = 120;

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const CODE_RE = /^[A-Z0-9]{4}(-[A-Z0-9]{4}){1,4}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const normEmail = (e: unknown): string => (typeof e === 'string' ? e.trim().toLowerCase() : '');
export const validEmail = (e: string): boolean => e.length <= 254 && EMAIL_RE.test(e);
export const validName = (n: unknown): n is string => typeof n === 'string' && n.trim().length > 0 && n.trim().length <= MAX_NAME;
const isRole = (r: unknown): r is Role => typeof r === 'string' && (ROLES as readonly string[]).includes(r);

// ---------- Lecture ----------

export interface Snapshot {
  rev: number;
  meta: string;
  profiles: ProfileRow[];
  members: { uid: string; email: string; name: string; role: Role; owner: boolean; at: number }[];
  /** Seulement pour les administrateurs */
  invites: { code: string; email: string; role: Role; date: string; at: number }[];
}

export async function membership(env: Env, fid: string, uid: string): Promise<MemberRow | null> {
  return env.DB.prepare('SELECT * FROM members WHERE family_id = ? AND user_id = ?').bind(fid, uid).first<MemberRow>();
}

/** Espace de l'utilisateur et son rôle, ou erreur 403 s'il n'en est pas membre. */
export async function requireMember(env: Env, user: UserRow): Promise<{ fid: string; member: MemberRow }> {
  if (!user.family_id) throw new ApiError(404, 'pas-de-famille');
  const member = await membership(env, user.family_id, user.id);
  if (!member) throw new ApiError(403, 'permission-denied');
  return { fid: user.family_id, member };
}

export async function familyRev(env: Env, fid: string): Promise<number | null> {
  const row = await env.DB.prepare('SELECT rev FROM families WHERE id = ?').bind(fid).first<{ rev: number }>();
  return row?.rev ?? null;
}

export async function snapshot(env: Env, fid: string, role: Role): Promise<Snapshot> {
  const [fam, profiles, members, invites] = await env.DB.batch([
    env.DB.prepare('SELECT * FROM families WHERE id = ?').bind(fid),
    env.DB.prepare('SELECT id, json, ord FROM profiles WHERE family_id = ? ORDER BY ord, id').bind(fid),
    env.DB.prepare('SELECT * FROM members WHERE family_id = ? ORDER BY at, user_id').bind(fid),
    env.DB.prepare('SELECT * FROM invites WHERE family_id = ? ORDER BY at, code').bind(fid),
  ]);
  const f = (fam.results as FamilyRow[])[0];
  if (!f) throw new ApiError(404, 'permission-denied');
  return {
    rev: f.rev,
    meta: f.json,
    profiles: profiles.results as ProfileRow[],
    members: (members.results as MemberRow[]).map((m) => ({ uid: m.user_id, email: m.email, name: m.name, role: m.role, owner: !!m.owner, at: m.at })),
    invites: role === 'admin' ? (invites.results as InviteRow[]).map((i) => ({ code: i.code, email: i.email, role: i.role, date: i.date, at: i.at })) : [],
  };
}

// ---------- Validation des données envoyées ----------

/** Réglages de l'espace : objet JSON, sans les parties stockées à part. Renvoie le nom de l'espace. */
export function checkMeta(json: unknown): { json: string; name: string } {
  if (typeof json !== 'string' || json.length > MAX_META_JSON) throw new ApiError(400, 'donnees-invalides');
  let meta: unknown;
  try { meta = JSON.parse(json); } catch { throw new ApiError(400, 'donnees-invalides'); }
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) throw new ApiError(400, 'donnees-invalides');
  const m = meta as Record<string, unknown>;
  if ('profiles' in m || 'users' in m || 'invites' in m) throw new ApiError(400, 'donnees-invalides');
  if (!validName(m.name)) throw new ApiError(400, 'donnees-invalides');
  return { json, name: (m.name as string).trim() };
}

export function checkProfile(p: unknown): ProfileRow {
  if (!p || typeof p !== 'object') throw new ApiError(400, 'donnees-invalides');
  const { id, json, ord } = p as Record<string, unknown>;
  if (typeof id !== 'string' || !ID_RE.test(id)) throw new ApiError(400, 'donnees-invalides');
  if (typeof json !== 'string' || json.length > MAX_PROFILE_JSON) throw new ApiError(413, 'fiche-trop-lourde');
  if (!Number.isInteger(ord) || (ord as number) < 0 || (ord as number) > 10_000) throw new ApiError(400, 'donnees-invalides');
  let parsed: unknown;
  try { parsed = JSON.parse(json); } catch { throw new ApiError(400, 'donnees-invalides'); }
  if (!parsed || typeof parsed !== 'object' || (parsed as { id?: unknown }).id !== id) throw new ApiError(400, 'donnees-invalides');
  return { id, json, ord: ord as number };
}

export function checkInvite(i: unknown): { code: string; email: string; role: Role; date: string } {
  if (!i || typeof i !== 'object') throw new ApiError(400, 'donnees-invalides');
  const { code, email, role, date } = i as Record<string, unknown>;
  const em = normEmail(email);
  if (typeof code !== 'string' || !CODE_RE.test(code) || !validEmail(em) || !isRole(role)) throw new ApiError(400, 'donnees-invalides');
  const d = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '';
  return { code, email: em, role, date: d };
}

export interface PushBody {
  meta?: string;
  profiles?: { set?: unknown[]; del?: unknown[] };
  roles?: unknown[];
  invites?: { add?: unknown[]; del?: unknown[] };
}

/**
 * Applique un lot de modifications envoyé par un appareil, en une seule transaction D1.
 * Mêmes droits que les anciennes règles Firestore : lecture seule pour « viewer » ;
 * membres et invitations réservés aux administrateurs ; le propriétaire ne peut pas être rétrogradé.
 */
export async function applyPush(env: Env, user: UserRow, body: PushBody): Promise<number> {
  const { fid, member } = await requireMember(env, user);
  if (member.role === 'viewer') throw new ApiError(403, 'permission-denied');
  const isAdmin = member.role === 'admin';
  const t = Date.now();
  const stmts: D1PreparedStatement[] = [];

  if (body.meta !== undefined) {
    const m = checkMeta(body.meta);
    stmts.push(env.DB.prepare('UPDATE families SET name = ?, json = ? WHERE id = ?').bind(m.name, m.json, fid));
  }

  const set = Array.isArray(body.profiles?.set) ? body.profiles!.set : [];
  const del = Array.isArray(body.profiles?.del) ? body.profiles!.del : [];
  if (set.length > MAX_PROFILES || del.length > MAX_PROFILES) throw new ApiError(400, 'donnees-invalides');
  for (const raw of set) {
    const p = checkProfile(raw);
    stmts.push(env.DB.prepare(
      `INSERT INTO profiles (family_id, id, json, ord, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(family_id, id) DO UPDATE SET json = excluded.json, ord = excluded.ord, updated_at = excluded.updated_at`,
    ).bind(fid, p.id, p.json, p.ord, t));
  }
  for (const id of del) {
    if (typeof id !== 'string' || !ID_RE.test(id)) throw new ApiError(400, 'donnees-invalides');
    stmts.push(env.DB.prepare('DELETE FROM profiles WHERE family_id = ? AND id = ?').bind(fid, id));
  }

  const roles = Array.isArray(body.roles) ? body.roles : [];
  const add = Array.isArray(body.invites?.add) ? body.invites!.add : [];
  const delInv = Array.isArray(body.invites?.del) ? body.invites!.del : [];
  if ((roles.length || add.length || delInv.length) && !isAdmin) throw new ApiError(403, 'permission-denied');
  if (roles.length > 50 || add.length > 50 || delInv.length > 50) throw new ApiError(400, 'donnees-invalides');
  for (const r of roles) {
    const { uid, role } = (r ?? {}) as Record<string, unknown>;
    if (typeof uid !== 'string' || !isRole(role) || uid === user.id) throw new ApiError(400, 'donnees-invalides');
    // Le propriétaire de l'espace reste administrateur
    stmts.push(env.DB.prepare('UPDATE members SET role = ? WHERE family_id = ? AND user_id = ? AND owner = 0').bind(role, fid, uid));
  }
  for (const raw of add) {
    const i = checkInvite(raw);
    stmts.push(env.DB.prepare('INSERT INTO invites (code, family_id, email, role, date, at, by_uid) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(code) DO NOTHING')
      .bind(i.code, fid, i.email, i.role, i.date, t, user.id));
  }
  for (const code of delInv) {
    if (typeof code !== 'string') throw new ApiError(400, 'donnees-invalides');
    stmts.push(env.DB.prepare('DELETE FROM invites WHERE code = ? AND family_id = ?').bind(code, fid));
  }

  if (!stmts.length) return (await familyRev(env, fid)) ?? 0;
  stmts.push(env.DB.prepare('UPDATE families SET rev = rev + 1, updated_at = ? WHERE id = ?').bind(t, fid));
  await env.DB.batch(stmts);
  return (await familyRev(env, fid)) ?? 0;
}

// ---------- Création et invitation ----------

/** Crée un espace dont l'utilisateur est propriétaire et administrateur. Renvoie son identifiant. */
export async function createFamily(env: Env, user: UserRow, body: { meta?: unknown; profiles?: unknown[]; name?: unknown }): Promise<string> {
  const meta = checkMeta(body.meta);
  const profiles = (Array.isArray(body.profiles) ? body.profiles : []).map(checkProfile);
  if (profiles.length > MAX_PROFILES) throw new ApiError(400, 'donnees-invalides');
  const name = validName(body.name) ? body.name.trim() : user.name;
  const fid = randomToken(12);
  const t = Date.now();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO families (id, name, owner_uid, json, rev, updated_at) VALUES (?, ?, ?, ?, 1, ?)').bind(fid, meta.name, user.id, meta.json, t),
    env.DB.prepare("INSERT INTO members (family_id, user_id, email, name, role, owner, at) VALUES (?, ?, ?, ?, 'admin', 1, ?)").bind(fid, user.id, user.email, name, t),
    ...profiles.map((p) => env.DB.prepare('INSERT INTO profiles (family_id, id, json, ord, updated_at) VALUES (?, ?, ?, ?, ?)').bind(fid, p.id, p.json, p.ord, t)),
    env.DB.prepare('UPDATE users SET family_id = ?, name = ? WHERE id = ?').bind(fid, name, user.id),
  ]);
  return fid;
}

/** Rejoint un espace avec un code d'invitation réservé à l'adresse e-mail du compte. */
export async function joinFamily(env: Env, user: UserRow, codeRaw: unknown): Promise<string> {
  const code = typeof codeRaw === 'string' ? codeRaw.trim().toUpperCase() : '';
  if (!CODE_RE.test(code)) throw new ApiError(404, 'code-invalide');
  const inv = await env.DB.prepare('SELECT * FROM invites WHERE code = ?').bind(code).first<InviteRow>();
  if (!inv) throw new ApiError(404, 'code-invalide');
  if (inv.email !== user.email) throw new ApiError(403, 'code-autre-email');
  const t = Date.now();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO members (family_id, user_id, email, name, role, owner, at) VALUES (?, ?, ?, ?, ?, 0, ?)
       ON CONFLICT(family_id, user_id) DO UPDATE SET role = excluded.role`,
    ).bind(inv.family_id, user.id, user.email, user.name, inv.role, t),
    env.DB.prepare('UPDATE users SET family_id = ? WHERE id = ?').bind(inv.family_id, user.id),
    env.DB.prepare('DELETE FROM invites WHERE code = ?').bind(code),
    env.DB.prepare('UPDATE families SET rev = rev + 1, updated_at = ? WHERE id = ?').bind(t, inv.family_id),
  ]);
  return inv.family_id;
}

/** Nouveau prénom : sur le compte et sur la fiche de membre de son espace. */
export async function renameUser(env: Env, user: UserRow, name: string): Promise<void> {
  const stmts = [env.DB.prepare('UPDATE users SET name = ? WHERE id = ?').bind(name, user.id)];
  if (user.family_id) {
    stmts.push(
      env.DB.prepare('UPDATE members SET name = ? WHERE family_id = ? AND user_id = ?').bind(name, user.family_id, user.id),
      env.DB.prepare('UPDATE families SET rev = rev + 1, updated_at = ? WHERE id = ?').bind(Date.now(), user.family_id),
    );
  }
  await env.DB.batch(stmts);
}
