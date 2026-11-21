import { describe, expect, it } from 'vitest';
import { docId, familyImport, fsFields, type FsDoc } from '../src/firebase';
import { fakeEnv } from './helpers';

const doc = (path: string, fields: Record<string, unknown>): FsDoc => ({
  name: `projects/p/databases/(default)/documents/${path}`,
  fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k,
    typeof v === 'string' ? { stringValue: v } : typeof v === 'boolean' ? { booleanValue: v } : { integerValue: String(v) }])) as FsDoc['fields'],
});

describe('lecture des documents Firestore', () => {
  it('convertit les types de l’API REST', () => {
    expect(fsFields({
      s: { stringValue: 'a' }, i: { integerValue: '42' }, d: { doubleValue: 1.5 }, b: { booleanValue: true }, n: { nullValue: null },
      m: { mapValue: { fields: { x: { integerValue: '1' } } } }, a: { arrayValue: { values: [{ stringValue: 'y' }] } },
    })).toEqual({ s: 'a', i: 42, d: 1.5, b: true, n: null, m: { x: 1 }, a: ['y'] });
    expect(fsFields(undefined)).toEqual({});
    expect(docId(doc('families/abc/members/uid-1', {}))).toBe('uid-1');
  });
});

describe('import d’un espace familial', () => {
  const root = doc('families/f1', { name: 'Famille de Camille', ownerUid: 'u-owner', json: JSON.stringify({ id: 'f1', name: 'Famille de Camille', theme: { id: 'sauge' }, users: ['à ignorer'] }) });
  const profile = (id: string, ord: number) => doc(`families/f1/profiles/${id}`, { json: JSON.stringify({ id, name: id }), ord });

  it('recopie réglages, fiches, membres et invitations', () => {
    const env = fakeEnv();
    const stmts = familyImport(env, 'f1', root, [profile('p1', 0), profile('p2', 1)],
      [doc('families/f1/members/u-owner', { email: 'Camille@Exemple.fr', name: 'Camille', role: 'admin', owner: true, at: 5 }),
        doc('families/f1/members/u-2', { email: 'b@exemple.fr', name: 'Bob', role: 'editor', at: 6 })],
      [doc('families/f1/invites/ABCD-EFGH-JKLM', { email: 'c@exemple.fr', role: 'viewer', date: '2026-11-01', at: 7, by: 'u-owner' })]) as unknown as { sql: string; args: unknown[] }[];
    expect(stmts).toHaveLength(6);
    const fam = stmts[0].args;
    expect(fam[0]).toBe('f1');
    expect(fam[1]).toBe('Famille de Camille');
    expect(fam[2]).toBe('u-owner');
    expect(JSON.parse(fam[3] as string)).toEqual({ id: 'f1', name: 'Famille de Camille', theme: { id: 'sauge' } });
    expect(stmts[1].args.slice(0, 4)).toEqual(['f1', 'p1', JSON.stringify({ id: 'p1', name: 'p1' }), 0]);
    expect(stmts[3].args).toEqual(['f1', 'u-owner', 'camille@exemple.fr', 'Camille', 'admin', 1, 5]);
    expect(stmts[4].args).toEqual(['f1', 'u-2', 'b@exemple.fr', 'Bob', 'editor', 0, 6]);
    expect(stmts[5].args).toEqual(['ABCD-EFGH-JKLM', 'f1', 'c@exemple.fr', 'viewer', '2026-11-01', 7, 'u-owner']);
  });

  it('ignore une fiche corrompue et rend le propriétaire administrateur', () => {
    const env = fakeEnv();
    const bad = doc('families/f1/profiles/p9', { json: '{cassé', ord: 0 });
    const stmts = familyImport(env, 'f1', root, [bad], [doc('families/f1/members/u-owner', { email: 'x@y.fr', role: 'viewer' })], []) as unknown as { args: unknown[] }[];
    expect(stmts).toHaveLength(2);
    expect(stmts[1].args[4]).toBe('admin');
    expect(stmts[1].args[5]).toBe(1);
  });
});
