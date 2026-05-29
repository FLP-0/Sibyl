# claude_cli.py — Claude pour a-Shell & Obsidian

Outil en ligne de commande Python pour discuter avec l'API Claude (Anthropic) depuis **a-Shell** (iOS) et sauvegarder les conversations en notes Markdown dans un vault **Obsidian**.

---

## Prérequis

| Élément | Détail |
|---|---|
| Application | [a-Shell](https://apps.apple.com/app/a-shell/id1473805438) (iOS/iPadOS) |
| Python | 3.x (inclus dans a-Shell) |
| Module | `requests` (installé automatiquement au 1er lancement) |
| Clé API | [console.anthropic.com](https://console.anthropic.com/) → API Keys |

---

## Installation

```sh
# Dans a-Shell, copiez claude_cli.py dans votre dossier de travail
# Par exemple via Files.app ou en le téléchargeant :

# Rendre le script accessible depuis n'importe où (optionnel)
cp claude_cli.py ~/Documents/claude_cli.py
```

### Premier lancement

Au premier lancement, un assistant de configuration se déclenche automatiquement. Il vous demande :

1. **Clé API Anthropic** (commence par `sk-ant-`)
2. **Modèle par défaut** (ex : `claude-opus-4-7`)
3. **Chemin du vault Obsidian** (voir section *pickFolder* ci-dessous)
4. **Sous-dossier cible** dans le vault (défaut : `Claude Chats`)

La configuration est sauvegardée dans `~/Documents/.claude_config.json` avec des permissions restreintes (600).

---

## Usage

### Conversation interactive

```sh
python claude_cli.py chat
```

Lance une session de chat persistante. L'historique est conservé pendant toute la session.

**Commandes disponibles dans le chat :**

| Commande | Effet |
|---|---|
| `/save` | Sauvegarde la conversation en note Markdown |
| `/clear` | Remet l'historique à zéro |
| `/model claude-sonnet-4-6` | Change de modèle pour cette session |
| `/models` | Liste les modèles suggérés |
| `/aide` | Affiche l'aide |
| `/quitter` | Quitte (propose de sauvegarder) |
| `Ctrl+C` | Quitte aussi (propose de sauvegarder) |

---

### Question unique

```sh
python claude_cli.py ask "Votre question ici"
```

Pose une question, affiche la réponse, puis propose de la sauvegarder.

**Exemples :**

```sh
python claude_cli.py ask "Explique le principe de la mémoire associative en 3 points"

python claude_cli.py ask "Traduis ce texte en anglais : Bonjour, comment vas-tu ?"

python claude_cli.py ask "Écris un poème haïku sur l'automne"
```

---

### Modifier la configuration

```sh
python claude_cli.py config
```

Menu interactif pour changer la clé API, le modèle, le vault ou le sous-dossier.

---

## Format des notes sauvegardées

**Nom de fichier :** `YYYY-MM-DD_HHMM_<titre-court>.md`

Exemple : `2026-05-29_1430_explique-le-principe-de-la-mémoire.md`

**Contenu :**

```markdown
---
date: "2026-05-29 14:30"
modèle: "claude-opus-4-7"
tags:
  - claude
  - ia
  - conversation
---

## User

Explique le principe de la mémoire associative en 3 points.

## Claude

Voici les 3 points clés...
```

---

## Utilisation de pickFolder (a-Shell)

`pickFolder` est une commande native d'a-Shell qui ouvre le sélecteur de dossiers iOS. Elle change le répertoire courant du terminal vers le dossier choisi.

**Méthode recommandée pour configurer le vault :**

```sh
# 1. Dans a-Shell, naviguez vers votre vault Obsidian :
pickFolder
# → iOS ouvre un sélecteur, choisissez votre vault

# 2. Vérifiez que vous êtes au bon endroit :
pwd
# → affiche quelque chose comme /private/var/mobile/.../Obsidian/MonVault

# 3. Lancez la configuration (option "utiliser le répertoire courant") :
python claude_cli.py config
```

---

## Modèles disponibles

| Identifiant | Caractéristiques |
|---|---|
| `claude-opus-4-7` | Défaut — équilibre intelligence/vitesse |
| `claude-opus-4-8` | Plus récent |
| `claude-sonnet-4-6` | Rapide et efficace |
| `claude-haiku-4-5` | Ultra-rapide, idéal pour les questions courtes |

Changer de modèle en cours de session : `/model claude-sonnet-4-6`

---

## Gestion des erreurs

| Erreur | Message affiché | Action |
|---|---|---|
| Clé invalide | `Clé API invalide ou expirée` | `python claude_cli.py config` |
| Rate limit | `Limite de débit atteinte. Réessayez dans Xs` | Attendre et relancer |
| Pas de réseau | `Impossible de joindre l'API` | Vérifier la connexion |
| API surchargée | `L'API est surchargée (529)` | Réessayer dans quelques instants |

---

## Emplacement des fichiers

```
~/Documents/
├── .claude_config.json      ← Configuration (permissions 600)
└── [VaultObsidian]/
    └── Claude Chats/        ← Notes sauvegardées (configurable)
        ├── 2026-05-29_1430_...md
        └── 2026-05-29_1512_...md
```
