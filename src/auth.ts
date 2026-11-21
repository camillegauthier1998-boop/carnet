import type { Env, UserRow } from './types';

// Préfixe __Host- : cookie limité à ce domaine exact, en HTTPS, sur tout le site
const COOKIE = '__Host-carnet_session';
export const MAX_AGE = 180 * 24 * 3600;   // 180 jours…
const RENEW_AFTER = 7 * 24 * 3600;        // …prolongés automatiquement après 7 jours d'utilisation
const enc = new TextEncoder();

/** Longueur minimale d'un mot de passe (comme l'ancienne version Firebase) */
export const MIN_PASSWORD_LENGTH = 6;
const MAX_PASSWORD_LENGTH = 256;
/** Plafond de Workers pour PBKDF2 */
const MAX_ITERATIONS = 100_000;

// Limitation des tentatives
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS_PER_IP = 10;
const MAX_RESETS_PER_IP = 5;

// ---------- Encodage ----------

export const b64url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function fromB64url(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export const randomToken = (bytes = 32): string => b64url(crypto.getRandomValues(new Uint8Array(bytes)));

export async function sha256(s: string): Promise<string> {
  return b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s))));
}

/** Compare deux chaînes en temps constant (via leurs empreintes, de même longueur). */
export async function sameString(a: string, b: string): Promise<boolean> {
  const [ha, hb] = await Promise.all([a, b].map((s) => crypto.subtle.digest('SHA-256', enc.encode(s))));
  const x = new Uint8Array(ha), y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

// ---------- Mots de passe (PBKDF2-SHA256) ----------
// Format stocké : pbkdf2$<itérations>$<sel>$<empreinte>

export function iterations(env: Pick<Env, 'PBKDF2_ITERATIONS'>): number {
  const n = Number(env.PBKDF2_ITERATIONS);
  return Number.isInteger(n) && n >= 10_000 ? Math.min(n, MAX_ITERATIONS) : MAX_ITERATIONS;
}

async function derive(password: string, salt: Uint8Array, iter: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, key, 256));
}

export async function hashPassword(password: string, iter: number): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${iter}$${b64url(salt)}$${b64url(await derive(password, salt, iter))}`;
}

/** ok : mot de passe correct ; rehash : à recalculer avec le nombre d'itérations actuel. */
export async function verifyPassword(password: string, stored: string, iter: number): Promise<{ ok: boolean; rehash: boolean }> {
  const [kind, n, salt, hash] = stored.split('$');
  const storedIter = Number(n);
  if (kind !== 'pbkdf2' || !storedIter || !salt || !hash || password.length > MAX_PASSWORD_LENGTH) return { ok: false, rehash: false };
  const got = b64url(await derive(password, fromB64url(salt), Math.min(storedIter, MAX_ITERATIONS)));
  const ok = await sameString(got, hash);
  return { ok, rehash: ok && storedIter !== iter };
}

/** Message d'erreur si le mot de passe ne convient pas, sinon null. */
export function passwordProblem(password: unknown): string | null {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) return 'auth/weak-password';
  if (password.length > MAX_PASSWORD_LENGTH) return 'auth/weak-password';
  return null;
}

/** Empreinte de comparaison quand le compte n'existe pas : même durée de réponse, pas d'énumération des comptes. */
export const DUMMY_HASH = 'pbkdf2$100000$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

// ---------- Cookie de session ----------
// Valeur : <uid>.<expiration>.<version de session>.<HMAC(SESSION_SECRET, "session:<uid>:<exp>:<ver>")>
// Incrémenter users.session_ver (nouveau mot de passe) déconnecte tous les appareils du compte.

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data))));
}

export async function signSession(secret: string, uid: string, ver: number, nowSec = Math.floor(Date.now() / 1000)): Promise<string> {
  const exp = nowSec + MAX_AGE;
  return `${uid}.${exp}.${ver}.${await hmac(secret, `session:${uid}:${exp}:${ver}`)}`;
}

export interface SessionClaims { uid: string; exp: number; ver: number }

/** Vérifie la signature et l'expiration (la version est comparée à celle du compte par l'appelant). */
export async function readSession(secret: string, value: string, nowSec = Date.now() / 1000): Promise<SessionClaims | null> {
  const parts = value.split('.');
  if (parts.length !== 4) return null;
  const [uid, expStr, verStr, sig] = parts;
  const exp = Number(expStr), ver = Number(verStr);
  if (!uid || !Number.isFinite(exp) || exp < nowSec || !Number.isInteger(ver) || !sig) return null;
  if (!(await sameString(sig, await hmac(secret, `session:${uid}:${exp}:${ver}`)))) return null;
  return { uid, exp, ver };
}

export const needsRenewal = (c: SessionClaims, nowSec = Date.now() / 1000) => c.exp - nowSec < MAX_AGE - RENEW_AFTER;

export function cookieHeader(value: string): string {
  return `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE}`;
}
export function clearCookieHeader(): string {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}
export function cookieValue(req: Request): string | null {
  const raw = req.headers.get('Cookie') ?? '';
  const m = raw.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  return m ? m[1] : null;
}

export interface Authed { user: UserRow; renew: boolean }

export async function authenticate(req: Request, env: Env): Promise<Authed | null> {
  if (!env.SESSION_SECRET) return null;
  const v = cookieValue(req);
  if (!v) return null;
  const claims = await readSession(env.SESSION_SECRET, v);
  if (!claims) return null;
  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(claims.uid).first<UserRow>();
  if (!user || user.session_ver !== claims.ver) return null;
  return { user, renew: needsRenewal(claims) };
}

// ---------- Limitation des tentatives ----------

/** Secondes à attendre si trop d'échecs récents depuis cette adresse, sinon 0. */
export async function blocked(env: Env, ip: string, kind: 'login' | 'reset'): Promise<number> {
  const since = Date.now() - WINDOW_MS;
  const row = await env.DB.prepare('SELECT count(*) n, min(at) first FROM login_attempts WHERE ip = ? AND kind = ? AND at > ?')
    .bind(ip, kind, since).first<{ n: number; first: number }>();
  const max = kind === 'login' ? MAX_FAILS_PER_IP : MAX_RESETS_PER_IP;
  if ((row?.n ?? 0) < max) return 0;
  return Math.max(1, Math.ceil((row!.first + WINDOW_MS - Date.now()) / 1000));
}

export async function recordAttempt(env: Env, ip: string, kind: 'login' | 'reset', ok: boolean): Promise<void> {
  const t = Date.now();
  if (ok && kind === 'login') {
    await env.DB.prepare("DELETE FROM login_attempts WHERE ip = ? AND kind = 'login'").bind(ip).run();
    return;
  }
  if (ok) return;
  await env.DB.batch([
    env.DB.prepare('INSERT INTO login_attempts (ip, kind, at) VALUES (?, ?, ?)').bind(ip, kind, t),
    env.DB.prepare('DELETE FROM login_attempts WHERE at < ?').bind(t - 24 * 3600 * 1000),
  ]);
}
