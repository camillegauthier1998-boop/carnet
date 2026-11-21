/**
 * Notifications Web Push.
 *
 * Le serveur envoie une notification sans contenu (pas de chiffrement de charge utile à gérer) ;
 * le service worker se réveille, récupère les messages en attente pour son abonnement
 * (POST /api/push/pending, avec l'adresse et la clé « auth » de l'abonnement) et les affiche.
 * L'envoi est signé avec une clé VAPID (secret VAPID_JWK, généré par la CI à la première mise en ligne).
 */
import { b64url } from './auth';
import { parisToday, remindersFor, type Profile } from './reminders';
import type { Env } from './types';

const enc = new TextEncoder();

function fromB64url(s: string): Uint8Array {
  return Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
}

interface VapidJwk { kty: 'EC'; crv: 'P-256'; x: string; y: string; d: string }

function vapidKey(env: Env): VapidJwk | null {
  if (!env.VAPID_JWK) return null;
  try {
    const k = JSON.parse(env.VAPID_JWK) as VapidJwk;
    return k.kty === 'EC' && k.crv === 'P-256' && k.x && k.y && k.d ? k : null;
  } catch { return null; }
}

/** Clé publique au format attendu par pushManager.subscribe (point non compressé, base64url). */
export function vapidPublicKey(env: Env): string | null {
  const k = vapidKey(env);
  if (!k) return null;
  const raw = new Uint8Array(65);
  raw[0] = 4;
  raw.set(fromB64url(k.x), 1);
  raw.set(fromB64url(k.y), 33);
  return b64url(raw);
}

/** Jeton VAPID (JWT ES256) pour le service de notifications de l'abonnement. */
export async function vapidJwt(jwk: VapidJwk, endpoint: string, subject: string, nowSec = Math.floor(Date.now() / 1000)): Promise<string> {
  const header = b64url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64url(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: nowSec + 12 * 3600, sub: subject })));
  const key = await crypto.subtle.importKey('jwk', { ...jwk, ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${header}.${claims}`)));
  return `${header}.${claims}.${b64url(sig)}`;
}

/** Services de notification des navigateurs : le serveur n'envoie de requêtes qu'à eux. */
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^android\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/,
  /^push\.services\.mozilla\.com$/, /^[a-z0-9.-]+\.push\.apple\.com$/, /^[a-z0-9.-]+\.notify\.windows\.com$/];

export function validEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== 'string' || endpoint.length > 1000) return false;
  try {
    const u = new URL(endpoint);
    return u.protocol === 'https:' && !u.port && !u.username && PUSH_HOSTS.some((r) => r.test(u.hostname));
  } catch { return false; }
}

interface SubRow { endpoint: string; user_id: string; auth: string; p256dh: string; origin: string }

/** Envoie une notification sans contenu. Supprime l'abonnement s'il n'existe plus (404/410). */
async function ping(env: Env, jwk: VapidJwk, s: SubRow): Promise<boolean> {
  const res = await fetch(s.endpoint, {
    method: 'POST',
    headers: {
      TTL: String(24 * 3600),
      Urgency: 'normal',
      Authorization: `vapid t=${await vapidJwt(jwk, s.endpoint, s.origin)}, k=${vapidPublicKey(env)}`,
      'Content-Length': '0',
    },
  });
  if (res.status === 404 || res.status === 410) {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(s.endpoint),
      env.DB.prepare('DELETE FROM push_queue WHERE endpoint = ?').bind(s.endpoint),
    ]);
    return false;
  }
  if (!res.ok) { console.error('Web Push refusé', res.status, new URL(s.endpoint).host, await res.text().catch(() => '')); return false; }
  await env.DB.prepare('UPDATE push_subscriptions SET last_ok = ? WHERE endpoint = ?').bind(Date.now(), s.endpoint).run();
  return true;
}

export interface Message { title: string; body: string; url?: string; tag?: string }

/** Met les messages en attente pour ces abonnements et les réveille. Renvoie le nombre d'appareils prévenus. */
export async function deliver(env: Env, subs: SubRow[], messages: Message[]): Promise<number> {
  const jwk = vapidKey(env);
  if (!jwk || !subs.length || !messages.length) return 0;
  const t = Date.now();
  await env.DB.batch(subs.flatMap((s) => messages.map((m) =>
    env.DB.prepare('INSERT INTO push_queue (endpoint, title, body, url, tag, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(s.endpoint, m.title.slice(0, 120), m.body.slice(0, 400), m.url ?? '/', m.tag ?? '', t))));
  let n = 0;
  for (const s of subs) { try { if (await ping(env, jwk, s)) n++; } catch (e) { console.error('Web Push', e); } }
  return n;
}

export async function subscriptionsOf(env: Env, userIds: string[]): Promise<SubRow[]> {
  if (!userIds.length) return [];
  const rows = await env.DB.prepare(`SELECT * FROM push_subscriptions WHERE user_id IN (${userIds.map(() => '?').join(',')})`).bind(...userIds).all<SubRow>();
  return rows.results;
}

/** Messages en attente d'un abonnement (lus une seule fois). La clé « auth » de l'abonnement sert de preuve. */
export async function takePending(env: Env, endpoint: string, auth: string): Promise<Message[]> {
  const sub = await env.DB.prepare('SELECT auth FROM push_subscriptions WHERE endpoint = ?').bind(endpoint).first<{ auth: string }>();
  if (!sub || sub.auth !== auth) return [];
  const rows = await env.DB.prepare('SELECT id, title, body, url, tag FROM push_queue WHERE endpoint = ? ORDER BY id LIMIT 20').bind(endpoint).all<Message & { id: number }>();
  if (rows.results.length) {
    await env.DB.prepare(`DELETE FROM push_queue WHERE endpoint = ? AND id <= ?`).bind(endpoint, rows.results[rows.results.length - 1].id).run();
  }
  return rows.results.map(({ title, body, url, tag }) => ({ title, body, url, tag }));
}

/**
 * Tâche du matin : pour chaque espace dont au moins un membre a activé les notifications,
 * calcule les rappels du jour et prévient les appareils des membres.
 */
export async function runReminders(env: Env, now = new Date()): Promise<{ families: number; reminders: number; devices: number }> {
  if (!vapidKey(env)) { console.error('Notifications : secret VAPID_JWK manquant'); return { families: 0, reminders: 0, devices: 0 }; }
  const today = parisToday(now);
  const fams = await env.DB.prepare(
    'SELECT DISTINCT m.family_id fid FROM members m JOIN push_subscriptions s ON s.user_id = m.user_id',
  ).all<{ fid: string }>();
  let reminders = 0, devices = 0;
  for (const { fid } of fams.results) {
    try {
      const rows = await env.DB.prepare('SELECT json FROM profiles WHERE family_id = ? ORDER BY ord').bind(fid).all<{ json: string }>();
      const profiles: Profile[] = rows.results.map((r) => { try { return JSON.parse(r.json) as Profile; } catch { return null; } }).filter((p): p is Profile => !!p);
      const all = remindersFor(profiles, today).map((r) => ({ ...r, key: `${fid}:${r.key}` }));
      if (!all.length) continue;
      const keys = all.map((r) => r.key);
      const sent = await env.DB.prepare(`SELECT key FROM notif_sent WHERE key IN (${keys.map(() => '?').join(',')})`).bind(...keys).all<{ key: string }>();
      const done = new Set(sent.results.map((r) => r.key));
      const fresh = all.filter((r) => !done.has(r.key));
      if (!fresh.length) continue;
      await env.DB.batch(fresh.map((r) => env.DB.prepare('INSERT OR IGNORE INTO notif_sent (key, at) VALUES (?, ?)').bind(r.key, Date.now())));
      const members = await env.DB.prepare('SELECT user_id FROM members WHERE family_id = ?').bind(fid).all<{ user_id: string }>();
      const subs = await subscriptionsOf(env, members.results.map((m) => m.user_id));
      // Au-delà de 3 rappels, un seul message récapitulatif (pas de rafale de notifications)
      const messages: Message[] = fresh.length <= 3
        ? fresh.map((r) => ({ title: r.title, body: r.body, url: r.url, tag: r.key }))
        : [{ title: `${fresh.length} rappels aujourd’hui`, body: fresh.slice(0, 4).map((r) => r.body).join('\n') + (fresh.length > 4 ? '\n…' : ''), url: '/', tag: `${fid}:${today}` }];
      devices += await deliver(env, subs, messages);
      reminders += fresh.length;
    } catch (e) { console.error('Rappels de la famille', fid, e); }
  }
  await env.DB.batch([
    env.DB.prepare('DELETE FROM notif_sent WHERE at < ?').bind(Date.now() - 400 * 24 * 3600 * 1000),
    // Messages jamais récupérés (appareil éteint ou désinstallé) : inutiles après une semaine
    env.DB.prepare('DELETE FROM push_queue WHERE created_at < ?').bind(Date.now() - 7 * 24 * 3600 * 1000),
  ]);
  console.log(`Rappels du ${today} : ${reminders} rappel(s), ${devices} appareil(s) prévenu(s), ${fams.results.length} espace(s)`);
  return { families: fams.results.length, reminders, devices };
}
