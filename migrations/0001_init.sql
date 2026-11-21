-- Comptes : un compte appartient à un seul espace familial à la fois.
-- L'identifiant reprend celui de Firebase pour les comptes migrés (voir src/firebase.ts).
CREATE TABLE users (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  pw_hash     TEXT NOT NULL,
  family_id   TEXT,
  -- Incrémenté pour révoquer toutes les sessions du compte (changement de mot de passe, réinitialisation)
  session_ver INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);

-- Espace familial. json : réglages de l'espace (thème, catégories…) sans les fiches, membres ni invitations.
-- rev : incrémenté à chaque modification, pour que les appareils sachent s'il faut recharger.
CREATE TABLE families (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  owner_uid  TEXT NOT NULL,
  json       TEXT NOT NULL,
  rev        INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);

CREATE TABLE members (
  family_id TEXT NOT NULL,
  user_id   TEXT NOT NULL,
  email     TEXT NOT NULL,
  name      TEXT NOT NULL,
  role      TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
  owner     INTEGER NOT NULL DEFAULT 0,
  at        INTEGER NOT NULL,
  PRIMARY KEY (family_id, user_id)
);
CREATE INDEX members_user ON members (user_id);

-- Fiches (personnes et animaux), une ligne par fiche : deux personnes peuvent modifier deux fiches en même temps.
CREATE TABLE profiles (
  family_id  TEXT NOT NULL,
  id         TEXT NOT NULL,
  json       TEXT NOT NULL,
  ord        INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (family_id, id)
);

-- Invitations en attente : le code n'est utilisable qu'avec l'adresse e-mail invitée.
CREATE TABLE invites (
  code      TEXT PRIMARY KEY,
  family_id TEXT NOT NULL,
  email     TEXT NOT NULL,
  role      TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
  date      TEXT NOT NULL DEFAULT '',
  at        INTEGER NOT NULL,
  by_uid    TEXT NOT NULL
);
CREATE INDEX invites_family ON invites (family_id);

-- Liens de réinitialisation du mot de passe (empreinte SHA-256 du jeton, usage unique)
CREATE TABLE password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX password_resets_user ON password_resets (user_id);

-- Tentatives échouées (connexion, demandes de réinitialisation) : limitation anti-force brute
CREATE TABLE login_attempts (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  ip   TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'login',
  at   INTEGER NOT NULL
);
CREATE INDEX login_attempts_ip_at ON login_attempts (ip, kind, at);
CREATE INDEX login_attempts_at ON login_attempts (at);
