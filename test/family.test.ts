import { describe, expect, it } from 'vitest';
import { checkInvite, checkMeta, checkProfile, normEmail, validEmail } from '../src/family';
import { ApiError } from '../src/types';

const code = (fn: () => unknown) => { try { fn(); } catch (e) { return (e as ApiError).code; } return 'ok'; };

describe('réglages de l’espace', () => {
  it('accepte un objet avec un nom et renvoie ce nom', () => {
    expect(checkMeta(JSON.stringify({ id: 'f1', name: ' Famille Martin ', theme: {} })).name).toBe('Famille Martin');
  });
  it('refuse les données mal formées ou qui contiennent les fiches, membres ou invitations', () => {
    expect(code(() => checkMeta('pas du json'))).toBe('donnees-invalides');
    expect(code(() => checkMeta('[]'))).toBe('donnees-invalides');
    expect(code(() => checkMeta(JSON.stringify({ name: '' })))).toBe('donnees-invalides');
    expect(code(() => checkMeta(JSON.stringify({ name: 'A', profiles: [] })))).toBe('donnees-invalides');
    expect(code(() => checkMeta(JSON.stringify({ name: 'A', users: [] })))).toBe('donnees-invalides');
    expect(code(() => checkMeta(42))).toBe('donnees-invalides');
  });
});

describe('fiches', () => {
  const p = { id: 'p-camille', name: 'Camille', cares: [] };
  it('accepte une fiche dont l’identifiant correspond au contenu', () => {
    expect(checkProfile({ id: 'p-camille', json: JSON.stringify(p), ord: 0 })).toEqual({ id: 'p-camille', json: JSON.stringify(p), ord: 0 });
  });
  it('refuse les identifiants, ordres ou contenus incohérents', () => {
    expect(code(() => checkProfile({ id: 'autre', json: JSON.stringify(p), ord: 0 }))).toBe('donnees-invalides');
    expect(code(() => checkProfile({ id: '../x', json: JSON.stringify({ ...p, id: '../x' }), ord: 0 }))).toBe('donnees-invalides');
    expect(code(() => checkProfile({ id: 'p-camille', json: JSON.stringify(p), ord: -1 }))).toBe('donnees-invalides');
    expect(code(() => checkProfile({ id: 'p-camille', json: '{', ord: 0 }))).toBe('donnees-invalides');
  });
  it('refuse une fiche de plus d’1 Mo', () => {
    const big = JSON.stringify({ ...p, photo: 'x'.repeat(1_000_001) });
    expect(code(() => checkProfile({ id: 'p-camille', json: big, ord: 0 }))).toBe('fiche-trop-lourde');
  });
});

describe('invitations', () => {
  it('normalise l’adresse et garde une date valide', () => {
    expect(checkInvite({ code: 'ABCD-EFGH-JK23', email: ' Marie@Exemple.FR ', role: 'editor', date: '2026-11-21' }))
      .toEqual({ code: 'ABCD-EFGH-JK23', email: 'marie@exemple.fr', role: 'editor', date: '2026-11-21' });
    expect(checkInvite({ code: 'K7Q2-M9XA', email: 'a@b.fr', role: 'viewer', date: 'n’importe' }).date).toBe('');
  });
  it('refuse un rôle, un code ou une adresse invalides', () => {
    expect(code(() => checkInvite({ code: 'ABCD-EFGH', email: 'a@b.fr', role: 'owner' }))).toBe('donnees-invalides');
    expect(code(() => checkInvite({ code: 'abc', email: 'a@b.fr', role: 'viewer' }))).toBe('donnees-invalides');
    expect(code(() => checkInvite({ code: 'ABCD-EFGH', email: 'pas-une-adresse', role: 'viewer' }))).toBe('donnees-invalides');
  });
  it('compare les adresses sans tenir compte de la casse ni des espaces', () => {
    expect(normEmail('  X@Y.Z ')).toBe('x@y.z');
    expect(validEmail('x@y.z')).toBe(true);
    expect(validEmail('x@y')).toBe(false);
  });
});
