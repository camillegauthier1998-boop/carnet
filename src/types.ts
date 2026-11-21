export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  /** Secret de signature des cookies de session (wrangler secret put SESSION_SECRET) */
  SESSION_SECRET: string;
  PBKDF2_ITERATIONS?: string;
  /** Reprise depuis Firebase (facultatif, à vider une fois la migration terminée) */
  FIREBASE_API_KEY?: string;
  FIREBASE_PROJECT_ID?: string;
  /** Envoi des e-mails de réinitialisation via Resend (facultatif) */
  RESEND_API_KEY?: string;
  MAIL_FROM?: string;
}

export type Role = 'admin' | 'editor' | 'viewer';
export const ROLES: readonly Role[] = ['admin', 'editor', 'viewer'];

export interface UserRow {
  id: string;
  email: string;
  name: string;
  pw_hash: string;
  family_id: string | null;
  session_ver: number;
  created_at: number;
}

export interface FamilyRow {
  id: string;
  name: string;
  owner_uid: string;
  json: string;
  rev: number;
  updated_at: number;
}

export interface MemberRow {
  family_id: string;
  user_id: string;
  email: string;
  name: string;
  role: Role;
  owner: number;
  at: number;
}

export interface ProfileRow { id: string; json: string; ord: number }

export interface InviteRow {
  code: string;
  family_id: string;
  email: string;
  role: Role;
  date: string;
  at: number;
  by_uid: string;
}

/** Erreur renvoyée telle quelle au client : code stable (traduit par l'interface) et statut HTTP. */
export class ApiError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
}
