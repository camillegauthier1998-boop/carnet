# Carnet de santé familial

Application web installable (PWA) qui réunit les soins de toute la famille, enfants et animaux compris : vaccins, rendez-vous, rappels, traitements, poids. Un espace familial se partage entre plusieurs comptes, avec des droits (administrateur, modification, lecture).

Hébergée sur Cloudflare (Workers + base D1), offre gratuite.

## Structure

```
src/index.ts          routeur /api/* (comptes, espace familial), en-têtes de sécurité
src/auth.ts           mots de passe (PBKDF2), cookie de session signé, limitation des tentatives
src/family.ts         lecture de l'espace, validation et droits des modifications, création, invitations
src/firebase.ts       reprise des comptes et des données de l'ancienne version Firebase
src/mail.ts           e-mail de réinitialisation du mot de passe (Resend, facultatif)
public/               interface (React + htm sans build), manifest, service worker, icônes
public/app.js         application ; l'objet Cloud fait le lien avec l'API
migrations/           schéma SQL
test/                 tests unitaires (vitest)
```

## Fonctionnement

- **Comptes** : e-mail + mot de passe (6 caractères minimum), haché en PBKDF2-SHA256 avec sel. Session dans un cookie `__Host-carnet_session` (HttpOnly, Secure, SameSite=Lax) signé en HMAC, valable 180 jours et prolongé tant que l'appli est utilisée. Changer de mot de passe déconnecte les autres appareils.
- **Espace familial** : réglages de l'espace dans `families`, une ligne par fiche dans `profiles` (deux personnes peuvent modifier deux fiches en même temps), membres et rôles dans `members`.
- **Droits**, vérifiés par le serveur : « Lecture » ne peut rien modifier ; « Modifier » change les fiches et les réglages ; « Administrateur » gère aussi les membres et les invitations. Le créateur de l'espace reste administrateur.
- **Invitations** : un code à usage unique, réservé à l'adresse e-mail invitée, partagé par lien (`/?join=CODE`).
- **Synchronisation** : l'appli envoie seulement ce qui a changé, 300 ms après une modification. Elle vérifie les changements des autres membres toutes les 20 secondes (une minute en arrière-plan), au retour sur l'appli et au retour du réseau. Une vérification sans changement ne renvoie qu'un numéro de version.
- **Hors connexion** : l'appli s'ouvre avec la dernière copie reçue (gardée sur l'appareil). Les modifications attendent et partent au retour du réseau.
- **Mode démonstration** : `/?demo`, avec des données d'exemple enregistrées sur l'appareil uniquement.

## Mise en ligne sur Cloudflare (une seule fois)

1. Crée un compte gratuit sur <https://dash.cloudflare.com/sign-up>.
2. Dans ce dossier :
   ```bash
   npm install
   npx wrangler login
   npx wrangler d1 create carnet            # affiche un database_id
   ```
3. Copie le `database_id` affiché dans [wrangler.jsonc](wrangler.jsonc), à la place des zéros.
4. Crée les tables et le secret des sessions, puis déploie :
   ```bash
   npm run db:remote
   npx wrangler secret put SESSION_SECRET   # 32 caractères aléatoires ou plus
   npm run deploy
   ```
   L'adresse s'affiche : `https://carnet.<ton-compte>.workers.dev`.
5. Sur le téléphone : ouvre l'adresse, puis « Sur l'écran d'accueil » (Safari) ou « Installer l'application » (Chrome).

> Réseau d'entreprise : préfixer les commandes `npx`/`npm` par `NODE_OPTIONS=--use-system-ca`, sinon Node refuse le certificat du proxy.

## Déploiement continu

Chaque push sur `main` lance la CI (`.github/workflows/deploy.yml`) : vérification TypeScript, tests, construction du Worker, puis, si tout passe, point de restauration D1, migrations et déploiement. Les pull requests sont vérifiées sans être déployées.

À configurer une fois dans GitHub → **Settings → Secrets and variables → Actions** :

- `CLOUDFLARE_API_TOKEN` : jeton créé dans Cloudflare → **My Profile → API Tokens** avec le modèle « Edit Cloudflare Workers », plus la permission **D1 : Edit**.
- `CLOUDFLARE_ACCOUNT_ID` : identifiant du compte, affiché dans le tableau de bord Cloudflare.

Si une migration abîme la base, le signet affiché à l'étape « Point de restauration D1 » permet de revenir en arrière :

```bash
npx wrangler d1 time-travel restore carnet --bookmark=<signet>
```

## Migration depuis Firebase

L'ancienne version stockait les comptes dans Firebase Auth et les données dans Firestore. La nouvelle version les reprend toute seule :

- Chacun se connecte sur la nouvelle adresse **avec son e-mail et son mot de passe habituels** (ou « Créer un compte » avec les mêmes identifiants).
- Si le compte n'existe pas encore ici, le serveur vérifie ces identifiants auprès de Firebase. S'ils sont bons, il crée le compte avec le même mot de passe, puis lit l'espace familial avec les droits de cette personne (les règles Firestore s'appliquent) : réglages, fiches, membres, invitations.
- Le premier membre qui se connecte importe l'espace ; les suivants le retrouvent directement, avec leur rôle.
- Rien n'est écrit ni supprimé dans Firebase. L'ancienne version reste utilisable pendant la transition, mais **les modifications faites dans l'ancienne version après l'import ne sont pas reprises**. Mieux vaut donc que tout le monde passe à la nouvelle adresse en même temps.
- Si la clé d'API Firebase est restreinte à certains sites (console Google Cloud → Identifiants), la reprise échoue : retirer la restriction de site pendant la migration.

Une fois tout le monde passé sur la nouvelle version, vide `FIREBASE_API_KEY` et `FIREBASE_PROJECT_ID` dans [wrangler.jsonc](wrangler.jsonc) : la reprise est alors désactivée.

## Mot de passe oublié

L'envoi de l'e-mail de réinitialisation passe par [Resend](https://resend.com) (offre gratuite) :

1. Crée un compte Resend et vérifie ton domaine d'envoi.
2. Renseigne l'expéditeur dans [wrangler.jsonc](wrangler.jsonc), par exemple `"MAIL_FROM": "Carnet <carnet@ton-domaine.fr>"`.
3. `npx wrangler secret put RESEND_API_KEY`

Le lien reçu est valable 1 heure et ne sert qu'une fois ; il déconnecte les autres appareils. Sans ces réglages, « Mot de passe oublié ? » explique que la réinitialisation n'est pas activée.

## Sécurité

- Mots de passe hachés en PBKDF2-SHA256 (100 000 itérations, le maximum sur Workers). Si les connexions échouent avec « Worker exceeded CPU time limit » sur l'offre gratuite, baisse `PBKDF2_ITERATIONS` (50 000 par exemple) : chaque mot de passe est recalculé à la connexion suivante.
- Après 10 échecs de connexion en 15 minutes depuis une même adresse IP, la connexion est bloquée 15 minutes pour cette adresse.
- Toutes les routes de l'espace vérifient l'appartenance et le rôle ; une famille ne voit jamais les données d'une autre.
- Requêtes qui modifient des données : refusées si elles viennent d'un autre site (`Origin`, `Sec-Fetch-Site`) ou si elles ne sont pas en JSON.
- En-têtes : CSP stricte (aucun script externe ni en ligne), `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy: no-referrer`, HSTS. Voir `public/_headers` et `src/index.ts`.
- Erreurs : code générique côté client, détail seulement dans les journaux Cloudflare.
- Aucun secret dans le dépôt. `.dev.vars` (local) est ignoré par git.

## Développement local

```bash
printf 'SESSION_SECRET=test-local\nFIREBASE_API_KEY=\n' > .dev.vars   # FIREBASE_API_KEY vide : pas de reprise Firebase en local
npm run db:local
npm run dev            # http://localhost:8787 (ou /?demo pour le mode démonstration)
npm run check          # vérification TypeScript
npm test               # tests unitaires
```
