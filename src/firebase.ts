/**
 * Reprise des comptes et des données de l'ancienne version (Firebase Auth + Firestore).
 *
 * À la première connexion sur la nouvelle version, si l'adresse e-mail n'a pas encore de compte ici,
 * le serveur essaie ces identifiants auprès de Firebase. S'ils sont bons, il lit avec le jeton de
 * l'utilisateur (les règles Firestore s'appliquent donc toujours) son profil et son espace familial,
 * puis crée le compte ici avec le même mot de passe et le même identifiant. Le premier membre qui se
 * connecte importe l'espace (réglages, fiches, membres, invitations visibles par lui) ; les suivants
 * le retrouvent directement.
 *
 * Rien n'est écrit dans Firebase. Désactivé si FIREBASE_API_KEY ou FIREBASE_PROJECT_ID est vide.
 */
import { hashPassword, iterations } from './auth';
import { checkProfile, normEmail } from './family';
import { ROLES, type Env, type Role, type UserRow } from './types';

type FsValue =
  | { stringValue: string } | { integerValue: string } | { doubleValue: number } | { booleanValue: boolean }
  | { nullValue: null } | { timestampValue: string } | { mapValue: { fields?: Record<string, FsValue> } }
  | { arrayValue: { values?: FsValue[] } };

export interface FsDoc { name: string; fields?: Record<string, FsValue> }

/** Convertit une valeur de l'API REST Firestore en valeur JavaScript. */
export function fsValue(v: FsValue): unknown {
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return Date.parse(v.timestampValue);
  if ('mapValue' in v) return fsFields(v.mapValue.fields);
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(fsValue);
  return undefined;
}

export function fsFields(fields: Record<string, FsValue> | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields ?? {})) out[k] = fsValue(v);
  return out;
}

/** Dernier segment du chemin d'un document (« projects/…/documents/families/abc » → « abc »). */
export const docId = (d: FsDoc): string => d.name.slice(d.name.lastIndexOf('/') + 1);

export const migrationEnabled = (env: Env): boolean => !!(env.FIREBASE_API_KEY && env.FIREBASE_PROJECT_ID);

interface FirebaseLogin { uid: string; email: string; displayName: string; idToken: string }

/** Vérifie e-mail + mot de passe auprès de Firebase Auth. null si refusés. */
export async function firebaseSignIn(env: Env, email: string, password: string): Promise<FirebaseLogin | null> {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(env.FIREBASE_API_KEY!)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  if (!res.ok) {
    // 400 : identifiants refusés (ou compte inconnu). Le reste est une vraie panne : on la journalise.
    if (res.status !== 400) console.error('Firebase signIn', res.status, await res.text().catch(() => ''));
    return null;
  }
  const j = await res.json() as { localId?: string; email?: string; displayName?: string; idToken?: string };
  if (!j.localId || !j.idToken) return null;
  return { uid: j.localId, email: normEmail(j.email ?? email), displayName: j.displayName ?? '', idToken: j.idToken };
}

class Firestore {
  constructor(private env: Env, private token: string) {}
  private base = () => `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(this.env.FIREBASE_PROJECT_ID!)}/databases/(default)/documents/`;

  async get(path: string): Promise<FsDoc | null> {
    const res = await fetch(this.base() + path, { headers: { Authorization: `Bearer ${this.token}` } });
    if (res.status === 404 || res.status === 403) return null;
    if (!res.ok) throw new Error(`Firestore ${path} : ${res.status}`);
    return res.json() as Promise<FsDoc>;
  }

  /** Tous les documents d'une sous-collection ; [] si l'utilisateur n'a pas le droit de la lire. */
  async list(path: string): Promise<FsDoc[]> {
    const out: FsDoc[] = [];
    let page = '';
    for (let i = 0; i < 20; i++) {
      const res = await fetch(`${this.base()}${path}?pageSize=300${page ? `&pageToken=${encodeURIComponent(page)}` : ''}`, { headers: { Authorization: `Bearer ${this.token}` } });
      if (res.status === 403 || res.status === 404) return out;
      if (!res.ok) throw new Error(`Firestore ${path} : ${res.status}`);
      const j = await res.json() as { documents?: FsDoc[]; nextPageToken?: string };
      out.push(...(j.documents ?? []));
      if (!j.nextPageToken) break;
      page = j.nextPageToken;
    }
    return out;
  }
}

const isRole = (r: unknown): r is Role => typeof r === 'string' && (ROLES as readonly string[]).includes(r);
const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : d);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** Requêtes D1 qui recopient un espace Firestore (documents déjà lus) dans la base. */
export function familyImport(env: Env, fid: string, root: FsDoc, profiles: FsDoc[], members: FsDoc[], invites: FsDoc[]): D1PreparedStatement[] {
  const f = fsFields(root.fields);
  const t = Date.now();
  let metaJson = str(f.json);
  let name = str(f.name);
  try {
    const meta = JSON.parse(metaJson) as Record<string, unknown>;
    delete meta.profiles; delete meta.users; delete meta.invites;
    name = name || str(meta.name);
    meta.name = name || 'Famille';
    metaJson = JSON.stringify(meta);
  } catch { metaJson = JSON.stringify({ name: name || 'Famille' }); }
  const owner = str(f.ownerUid);
  const stmts = [
    env.DB.prepare('INSERT INTO families (id, name, owner_uid, json, rev, updated_at) VALUES (?, ?, ?, ?, 1, ?) ON CONFLICT(id) DO NOTHING')
      .bind(fid, name || 'Famille', owner, metaJson, t),
  ];
  for (const d of profiles) {
    const p = fsFields(d.fields);
    try {
      const row = checkProfile({ id: docId(d), json: str(p.json), ord: num(p.ord) });
      stmts.push(env.DB.prepare('INSERT INTO profiles (family_id, id, json, ord, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING')
        .bind(fid, row.id, row.json, row.ord, t));
    } catch (e) { console.error('Import Firebase : fiche ignorée', docId(d), e); }
  }
  for (const d of members) {
    const m = fsFields(d.fields);
    const uid = docId(d);
    const isOwner = m.owner === true || uid === owner;
    stmts.push(env.DB.prepare('INSERT INTO members (family_id, user_id, email, name, role, owner, at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING')
      .bind(fid, uid, normEmail(m.email), str(m.name) || normEmail(m.email).split('@')[0], isOwner ? 'admin' : isRole(m.role) ? m.role : 'viewer', isOwner ? 1 : 0, num(m.at, t)));
  }
  for (const d of invites) {
    const i = fsFields(d.fields);
    if (!isRole(i.role) || !normEmail(i.email)) continue;
    stmts.push(env.DB.prepare('INSERT INTO invites (code, family_id, email, role, date, at, by_uid) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING')
      .bind(docId(d), fid, normEmail(i.email), i.role, str(i.date), num(i.at, t), str(i.by)));
  }
  return stmts;
}

/**
 * Crée le compte à partir de Firebase si les identifiants y sont valides.
 * Renvoie le compte créé, ou null (identifiants refusés, migration désactivée).
 */
export async function migrateFromFirebase(env: Env, email: string, password: string): Promise<UserRow | null> {
  if (!migrationEnabled(env)) return null;
  const login = await firebaseSignIn(env, email, password);
  if (!login) return null;
  const fs = new Firestore(env, login.idToken);
  const userDoc = await fs.get(`users/${encodeURIComponent(login.uid)}`);
  const u = fsFields(userDoc?.fields);
  const name = (str(u.name) || login.displayName || login.email.split('@')[0]).slice(0, 120);
  let familyId: string | null = str(u.familyId) || null;
  const stmts: D1PreparedStatement[] = [];

  if (familyId) {
    const exists = await env.DB.prepare('SELECT 1 ok FROM families WHERE id = ?').bind(familyId).first();
    if (!exists) {
      const root = await fs.get(`families/${encodeURIComponent(familyId)}`);
      if (root) {
        const [profiles, members, invites] = await Promise.all([
          fs.list(`families/${encodeURIComponent(familyId)}/profiles`),
          fs.list(`families/${encodeURIComponent(familyId)}/members`),
          fs.list(`families/${encodeURIComponent(familyId)}/invites`),
        ]);
        stmts.push(...familyImport(env, familyId, root, profiles, members, invites));
      } else familyId = null; // plus membre de cet espace
    } else {
      // Espace déjà importé par un autre membre : ajoute ce membre s'il l'était dans Firebase
      const mine = await fs.get(`families/${encodeURIComponent(familyId)}/members/${encodeURIComponent(login.uid)}`);
      if (mine) {
        const m = fsFields(mine.fields);
        stmts.push(env.DB.prepare('INSERT INTO members (family_id, user_id, email, name, role, owner, at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING')
          .bind(familyId, login.uid, login.email, str(m.name) || name, isRole(m.role) ? m.role : 'viewer', m.owner === true ? 1 : 0, num(m.at, Date.now())));
        stmts.push(env.DB.prepare('UPDATE families SET rev = rev + 1 WHERE id = ?').bind(familyId));
      } else {
        const known = await env.DB.prepare('SELECT 1 ok FROM members WHERE family_id = ? AND user_id = ?').bind(familyId, login.uid).first();
        if (!known) familyId = null;
      }
    }
  }

  const user: UserRow = {
    id: login.uid, email: login.email, name, pw_hash: await hashPassword(password, iterations(env)),
    family_id: familyId, session_ver: 0, created_at: Date.now(),
  };
  stmts.push(env.DB.prepare('INSERT INTO users (id, email, name, pw_hash, family_id, session_ver, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)')
    .bind(user.id, user.email, user.name, user.pw_hash, user.family_id, user.created_at));
  await env.DB.batch(stmts);
  console.log('Compte repris de Firebase', user.id, familyId ? `(espace ${familyId})` : '(sans espace)');
  return user;
}
