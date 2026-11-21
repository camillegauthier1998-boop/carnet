import { describe, expect, it } from 'vitest';
import { DUMMY_HASH, MAX_AGE, hashPassword, iterations, needsRenewal, passwordProblem, readSession, signSession, verifyPassword } from '../src/auth';

describe('mots de passe', () => {
  it('vérifie le bon mot de passe et refuse les autres', async () => {
    const h = await hashPassword('correct horse', 20_000);
    expect(h).toMatch(/^pbkdf2\$20000\$[\w-]+\$[\w-]+$/);
    expect(await verifyPassword('correct horse', h, 20_000)).toEqual({ ok: true, rehash: false });
    expect((await verifyPassword('Correct horse', h, 20_000)).ok).toBe(false);
    expect((await verifyPassword('', h, 20_000)).ok).toBe(false);
  });

  it('demande un nouveau hachage quand le nombre d’itérations a changé', async () => {
    const h = await hashPassword('motdepasse', 20_000);
    expect(await verifyPassword('motdepasse', h, 30_000)).toEqual({ ok: true, rehash: true });
    expect(await verifyPassword('mauvais', h, 30_000)).toEqual({ ok: false, rehash: false });
  });

  it('refuse les empreintes mal formées, l’empreinte factice et les mots de passe démesurés', async () => {
    expect((await verifyPassword('x', 'n/importe/quoi', 20_000)).ok).toBe(false);
    expect((await verifyPassword('x', DUMMY_HASH, 100_000)).ok).toBe(false);
    const h = await hashPassword('a'.repeat(10), 20_000);
    expect((await verifyPassword('a'.repeat(300), h, 20_000)).ok).toBe(false);
  });

  it('borne le nombre d’itérations configuré', () => {
    expect(iterations({})).toBe(100_000);
    expect(iterations({ PBKDF2_ITERATIONS: '50000' })).toBe(50_000);
    expect(iterations({ PBKDF2_ITERATIONS: '900000' })).toBe(100_000);
    expect(iterations({ PBKDF2_ITERATIONS: '12' })).toBe(100_000);
    expect(iterations({ PBKDF2_ITERATIONS: 'abc' })).toBe(100_000);
  });

  it('impose 6 caractères minimum', () => {
    expect(passwordProblem('12345')).toBe('auth/weak-password');
    expect(passwordProblem(123456)).toBe('auth/weak-password');
    expect(passwordProblem('123456')).toBeNull();
  });
});

describe('cookie de session', () => {
  const now = 1_800_000_000;

  it('se relit avec le même secret', async () => {
    const v = await signSession('s3cret', 'user-1', 2, now);
    expect(await readSession('s3cret', v, now + 10)).toEqual({ uid: 'user-1', exp: now + MAX_AGE, ver: 2 });
  });

  it('est refusé si modifié, signé avec un autre secret ou expiré', async () => {
    const v = await signSession('s3cret', 'user-1', 0, now);
    const [uid, exp, ver, sig] = v.split('.');
    expect(await readSession('autre', v, now)).toBeNull();
    expect(await readSession('s3cret', [uid, exp, '1', sig].join('.'), now)).toBeNull();
    expect(await readSession('s3cret', ['user-2', exp, ver, sig].join('.'), now)).toBeNull();
    expect(await readSession('s3cret', [uid, String(Number(exp) + 1), ver, sig].join('.'), now)).toBeNull();
    expect(await readSession('s3cret', v, now + MAX_AGE + 1)).toBeNull();
    expect(await readSession('s3cret', 'abc', now)).toBeNull();
  });

  it('se prolonge après 7 jours d’utilisation', async () => {
    const c = (await readSession('s', await signSession('s', 'u', 0, now), now))!;
    expect(needsRenewal(c, now + 3600)).toBe(false);
    expect(needsRenewal(c, now + 8 * 24 * 3600)).toBe(true);
  });
});
