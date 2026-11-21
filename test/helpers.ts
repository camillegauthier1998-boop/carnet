import type { Env } from '../src/types';

interface Call { sql: string; args: unknown[] }

/**
 * Fausse base D1 : enregistre les requêtes au lieu de les exécuter.
 * first() renvoie la valeur fournie par `rows` pour la requête (null par défaut) ; batch() garde les lots exécutés.
 */
export function fakeEnv(p: Partial<Env> = {}, rows: (sql: string, args: unknown[]) => unknown = () => null) {
  const calls: Call[] = [];
  const batches: Call[][] = [];
  const DB = {
    prepare(sql: string) {
      return {
        bind: (...args: unknown[]) => {
          const c = { sql, args, first: async () => rows(sql, args), run: async () => ({}) };
          calls.push(c);
          return c;
        },
      };
    },
    batch: async (stmts: Call[]) => { batches.push(stmts); return []; },
  } as unknown as D1Database;
  const env: Env = { DB, ASSETS: {} as Fetcher, SESSION_SECRET: 'secret-de-test', ...p };
  return Object.assign(env, { calls, batches });
}
