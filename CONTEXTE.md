# Contexte — Sibyl

Fiche vérifiée le 4 octobre 2026 sur `main`, révision `d52acccf2382f8e3a5e08bbd37721beec1f6819a` du dépôt [FLP-0/Sibyl](https://github.com/FLP-0/Sibyl). À actualiser lorsque le projet évolue ; le code courant reste la référence.

## Produit et fonctionnement observés

Sibyl se présente comme une communauté privée autour des arts, de la culture et de l’expression (`src/app/layout.tsx`). L’application française organise les membres en espaces : publications et réponses, chat, messages privés, profils, modération, administration et récompenses XP/badges.

La connexion utilise Supabase Auth, puis un choix d’espace. L’inscription prévoit un code d’accès ou une invitation. Le fondateur dispose d’un panneau `/superadmin` ; les rôles des membres sont gérés par espace. Ces constats décrivent le code, pas une validation du fonctionnement en production.

## Technologies et repères

Next.js **16.2.1** (App Router), React **19.2.4**, TypeScript en mode strict, Tailwind CSS **4**, Supabase JS **^2.100.1** (`package.json`, `tsconfig.json`). Alias `@/*` vers `src/*`. Configuration de déploiement Upsun avec Node.js 20 dans `.upsun/config.yaml` ; hébergement réellement actif non vérifié.

| Sujet | Fichiers à consulter selon la tâche |
|---|---|
| Connexion et inscription | `src/app/page.tsx`, `src/app/register/page.tsx`, `src/app/api/verify-code/route.ts`, `src/app/api/invitations/` |
| Navigation, session et espace actif | `src/app/feed/page.tsx` |
| Publications, chat, messages privés | `src/app/feed/FeedTab.tsx`, `src/app/feed/ChatTab.tsx`, `src/app/feed/DMTab.tsx` ; détail d’un post : `src/app/post/[id]/page.tsx` |
| Modération et administration | `src/app/feed/AdminTab.tsx`, `src/app/feed/ModTab.tsx`, `src/app/feed/StaffTab.tsx` ; `src/app/superadmin/` et `src/app/api/superadmin/` |
| Espaces et demandes | `src/app/api/spaces/route.ts`, `src/app/api/space-requests/route.ts`, `supabase-spaces.sql`, `supabase-space-requests.sql` |
| XP et badges | `src/lib/rewards.ts`, `src/app/api/rewards/`, `src/app/feed/RewardsTab.tsx`, `supabase-rewards.sql` |
| Données et apparence | `src/lib/supabase.ts`, `src/lib/supabase-admin.ts`, `supabase-*.sql` ; `src/app/globals.css`, `src/components/SibylLogo.tsx` |

## Travailler sur le projet

- Lire d’abord `AGENTS.md` ; `CLAUDE.md` y renvoie. Les consignes existantes demandent de consulter la documentation Next.js installée dans `node_modules/next/dist/docs/` avant toute modification de code.
- Conserver les conventions observées : interface française, imports `@/`, composants interactifs avec `"use client"`, accès Supabase côté client et routes API côté serveur.
- Vérifier ensemble le composant, sa route API éventuelle et les scripts SQL concernés. L’interface appelle aussi directement Supabase : toute la logique ne passe pas par les routes API.
- Réserver `SUPABASE_SERVICE_ROLE_KEY` au serveur. Voir `.env.example` pour les noms des variables Supabase, du propriétaire et des espaces ; ne copier aucune valeur privée dans cette fiche.
- Les scripts SQL de la racine décrivent le schéma et ses évolutions. L’ordre complet et l’état déjà appliqué à la base restent à confirmer : ne pas les rejouer automatiquement.

## Installation et vérification

`package-lock.json` est présent : `npm ci` est la commande d’installation proposée. Configurer un environnement local à partir de `.env.example` avec les valeurs du projet.

Scripts déclarés dans `package.json` :

- `npm run dev` : développement.
- `npm run build` : compilation de production.
- `npm start` : serveur de production après compilation, port `PORT` ou 3000.
- `npm run lint` : ESLint.

**Aucune de ces commandes n’a été exécutée pour cette fiche.** Aucun script de test ni fichier de test évident n’a été repéré dans l’arborescence examinée. Le README est générique ; utiliser la configuration et le code pour vérifier ses indications.

## Contexte à charger et reprise

Lire cette fiche, puis chercher les symboles et ouvrir seulement les fichiers pertinents ; élargir aux dépendances et aux tests si nécessaire. Écarter des lectures habituelles `node_modules`, `.next`, les caches et fichiers générés. Un résumé oriente la recherche mais ne remplace pas le code source.

- Réalisé : cartographie documentaire du dépôt ; aucun code applicatif modifié.
- À confirmer avec le propriétaire : objectif de la prochaine tâche, règles métier attendues, environnement déployé et état des migrations Supabase.
- Fin de tâche : actualiser ici les décisions durables, les vérifications réellement effectuées et la prochaine étape, sans accumuler l’historique des conversations.
