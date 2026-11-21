import { afterEach, describe, expect, it, vi } from 'vitest';
import { verifyPassword } from '../src/auth';
import { migrateFromFirebase } from '../src/firebase';
import { fakeEnv } from './helpers';

const FB = { FIREBASE_API_KEY: 'cle', FIREBASE_PROJECT_ID: 'projet', PBKDF2_ITERATIONS: '10000' };
const DOCS = 'https://firestore.googleapis.com/v1/projects/projet/databases/(default)/documents/';
const s = (v: string) => ({ stringValue: v });
const n = (v: number) => ({ integerValue: String(v) });
const doc = (path: string, fields: object) => ({ name: `projects/projet/databases/(default)/documents/${path}`, fields });

/** Simule Firebase Auth + Firestore : identifiants camille@exemple.fr / bon-mot-de-passe. */
function fakeGoogle(firestore: Record<string, unknown>) {
  const seen: { url: string; auth: string | null }[] = [];
  vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
    const auth = new Headers(init.headers).get('Authorization');
    seen.push({ url, auth });
    if (url.startsWith('https://identitytoolkit.googleapis.com/')) {
      const b = JSON.parse(String(init.body));
      if (b.email === 'camille@exemple.fr' && b.password === 'bon-mot-de-passe') {
        return Response.json({ localId: 'uid-camille', email: 'Camille@Exemple.fr', displayName: 'Camille', idToken: 'jeton' });
      }
      return Response.json({ error: { message: 'INVALID_LOGIN_CREDENTIALS' } }, { status: 400 });
    }
    if (auth !== 'Bearer jeton') return new Response('', { status: 403 });
    const [path, query = ''] = url.slice(DOCS.length).split('?');
    const key = query.includes('pageToken=') ? `${path}#${new URLSearchParams(query).get('pageToken')}` : path;
    if (key in firestore) return Response.json(firestore[key]);
    return path in firestore && !query.includes('pageToken=') ? Response.json(firestore[path]) : new Response('', { status: 404 });
  });
  return seen;
}

afterEach(() => vi.unstubAllGlobals());

describe('reprise depuis Firebase', () => {
  it('refuse des identifiants que Firebase refuse, sans rien écrire', async () => {
    fakeGoogle({});
    const env = fakeEnv(FB);
    expect(await migrateFromFirebase(env, 'camille@exemple.fr', 'mauvais')).toBeNull();
    expect(env.batches).toHaveLength(0);
  });

  it('ne fait rien si la reprise est désactivée', async () => {
    const seen = fakeGoogle({});
    expect(await migrateFromFirebase(fakeEnv({}), 'camille@exemple.fr', 'bon-mot-de-passe')).toBeNull();
    expect(seen).toHaveLength(0);
  });

  it('crée le compte avec le même identifiant et importe son espace avec le jeton de l’utilisateur', async () => {
    const seen = fakeGoogle({
      'users/uid-camille': doc('users/uid-camille', { name: s('Camille M.'), familyId: s('fam1') }),
      'families/fam1': doc('families/fam1', { name: s('Famille de Camille'), ownerUid: s('uid-camille'), json: s(JSON.stringify({ id: 'fam1', name: 'Famille de Camille' })) }),
      'families/fam1/profiles': { documents: [doc('families/fam1/profiles/p1', { json: s(JSON.stringify({ id: 'p1', name: 'Poki' })), ord: n(0) })], nextPageToken: 'page2' },
      'families/fam1/profiles#page2': { documents: [doc('families/fam1/profiles/p2', { json: s(JSON.stringify({ id: 'p2', name: 'Hercule' })), ord: n(1) })] },
      'families/fam1/members': { documents: [doc('families/fam1/members/uid-camille', { email: s('camille@exemple.fr'), name: s('Camille'), role: s('admin'), owner: { booleanValue: true }, at: n(1) })] },
      'families/fam1/invites': { documents: [] },
    });
    const env = fakeEnv(FB);
    const user = await migrateFromFirebase(env, 'camille@exemple.fr', 'bon-mot-de-passe');
    expect(user).toMatchObject({ id: 'uid-camille', email: 'camille@exemple.fr', name: 'Camille M.', family_id: 'fam1' });
    expect((await verifyPassword('bon-mot-de-passe', user!.pw_hash, 10_000)).ok).toBe(true);
    // Toutes les lectures Firestore se font avec le jeton de l'utilisateur (les règles Firestore s'appliquent)
    expect(seen.filter((x) => x.url.startsWith(DOCS)).every((x) => x.auth === 'Bearer jeton')).toBe(true);
    // Pagination suivie : la deuxième page des fiches a été demandée
    expect(seen.some((x) => x.url.includes('profiles?pageSize=300&pageToken=page2'))).toBe(true);
    const sql = env.batches[0].map((c) => c.sql.split(' ').slice(0, 3).join(' '));
    expect(sql).toEqual(['INSERT INTO families', 'INSERT INTO profiles', 'INSERT INTO profiles', 'INSERT INTO members', 'INSERT INTO users']);
  });

  it('rattache un membre à un espace déjà importé par quelqu’un d’autre', async () => {
    fakeGoogle({
      'users/uid-camille': doc('users/uid-camille', { familyId: s('fam1') }),
      'families/fam1/members/uid-camille': doc('families/fam1/members/uid-camille', { role: s('editor'), name: s('Camille'), at: n(3) }),
    });
    const env = fakeEnv(FB, (sql) => (sql.startsWith('SELECT 1 ok FROM families') ? { ok: 1 } : null));
    const user = await migrateFromFirebase(env, 'camille@exemple.fr', 'bon-mot-de-passe');
    expect(user!.family_id).toBe('fam1');
    const member = env.batches[0].find((c) => c.sql.startsWith('INSERT INTO members'))!;
    expect(member.args).toEqual(['fam1', 'uid-camille', 'camille@exemple.fr', 'Camille', 'editor', 0, 3]);
  });

  it('crée un compte sans espace si l’utilisateur n’est plus membre', async () => {
    fakeGoogle({ 'users/uid-camille': doc('users/uid-camille', { familyId: s('fam-perdue') }) });
    const env = fakeEnv(FB);
    const user = await migrateFromFirebase(env, 'camille@exemple.fr', 'bon-mot-de-passe');
    expect(user!.family_id).toBeNull();
    expect(env.batches[0]).toHaveLength(1);
  });
});
