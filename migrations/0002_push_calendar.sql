-- Notifications : abonnements Web Push des appareils (un par téléphone ou navigateur)
CREATE TABLE push_subscriptions (
  endpoint   TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  auth       TEXT NOT NULL,
  p256dh     TEXT NOT NULL,
  -- Adresse de l'appli, utilisée comme contact dans l'en-tête VAPID
  origin     TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_ok    INTEGER
);
CREATE INDEX push_subscriptions_user ON push_subscriptions (user_id);

-- Messages en attente : le service worker les récupère quand la notification (sans contenu) arrive
CREATE TABLE push_queue (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint   TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  url        TEXT NOT NULL DEFAULT '/',
  tag        TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX push_queue_endpoint ON push_queue (endpoint);

-- Rappels déjà envoyés (un rappel n'est envoyé qu'une fois, même si l'envoi du matin est rejoué)
CREATE TABLE notif_sent (
  key TEXT PRIMARY KEY,
  at  INTEGER NOT NULL
);
CREATE INDEX notif_sent_at ON notif_sent (at);

-- Lien d'abonnement à l'agenda du téléphone (un par compte, renouvelable)
CREATE TABLE calendar_tokens (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);
