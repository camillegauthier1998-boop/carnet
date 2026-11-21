import { describe, expect, it } from 'vitest';
import { validEndpoint, vapidJwt, vapidPublicKey } from '../src/push';
import { fakeEnv } from './helpers';

const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

describe('notifications Web Push', () => {
  it('n’accepte que les services de notification des navigateurs', () => {
    expect(validEndpoint('https://fcm.googleapis.com/fcm/send/abc')).toBe(true);
    expect(validEndpoint('https://web.push.apple.com/QGx')).toBe(true);
    expect(validEndpoint('https://updates.push.services.mozilla.com/wpush/v2/x')).toBe(true);
    expect(validEndpoint('http://fcm.googleapis.com/x')).toBe(false);
    expect(validEndpoint('https://evil.example/fcm.googleapis.com')).toBe(false);
    expect(validEndpoint('https://fcm.googleapis.com.evil.example/x')).toBe(false);
    expect(validEndpoint('https://localhost/x')).toBe(false);
    expect(validEndpoint(42)).toBe(false);
  });

  it('signe un jeton VAPID vérifiable avec la clé publique annoncée', async () => {
    const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']) as CryptoKeyPair;
    const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
    const env = fakeEnv({ VAPID_JWK: JSON.stringify(jwk) });
    const pub = vapidPublicKey(env)!;
    expect(fromB64url(pub)).toHaveLength(65);
    const token = await vapidJwt(jwk as never, 'https://fcm.googleapis.com/fcm/send/abc', 'https://carnet.exemple', 1_800_000_000);
    const [h, c, sig] = token.split('.');
    expect(JSON.parse(new TextDecoder().decode(fromB64url(c)))).toEqual({ aud: 'https://fcm.googleapis.com', exp: 1_800_000_000 + 43200, sub: 'https://carnet.exemple' });
    const key = await crypto.subtle.importKey('raw', fromB64url(pub), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    expect(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, fromB64url(sig), new TextEncoder().encode(`${h}.${c}`))).toBe(true);
  });

  it('sans clé configurée, les notifications sont désactivées', () => {
    expect(vapidPublicKey(fakeEnv())).toBeNull();
    expect(vapidPublicKey(fakeEnv({ VAPID_JWK: 'pas du json' }))).toBeNull();
  });
});
