#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
claude_cli.py — Outil CLI pour discuter avec l'API Claude (Anthropic)
et sauvegarder les conversations en notes Markdown pour Obsidian.

Compatible avec a-Shell (iOS) : Python 3 pur, pas d'extensions C compilées.

Usage :
    python claude_cli.py chat              — Conversation interactive
    python claude_cli.py ask "question"    — Question unique
    python claude_cli.py config            — Modifier la configuration
"""

import sys
import os
import json
import datetime
import re
import subprocess

# Installation automatique de requests si absent
try:
    import requests
except ImportError:
    print("Installation du module 'requests'...")
    subprocess.run([sys.executable, "-m", "pip", "install", "requests"], check=True)
    import requests


# ══════════════════════════════════════════════════════════════════════════════
# Constantes
# ══════════════════════════════════════════════════════════════════════════════

CONFIG_PATH   = os.path.expanduser("~/Documents/.claude_config.json")
API_URL       = "https://api.anthropic.com/v1/messages"
API_VERSION   = "2023-06-01"
DEFAULT_MODEL = "claude-opus-4-7"
MAX_TOKENS    = 4096

MODELES_SUGGERES = [
    "claude-opus-4-7",
    "claude-opus-4-8",
    "claude-sonnet-4-6",
    "claude-haiku-4-5",
]


# ══════════════════════════════════════════════════════════════════════════════
# Gestion de la configuration
# ══════════════════════════════════════════════════════════════════════════════

def charger_config():
    """Charge la configuration depuis le fichier JSON, retourne un dict vide si absent."""
    if not os.path.exists(CONFIG_PATH):
        return {}
    try:
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError) as e:
        print(f"⚠  Impossible de lire la config ({e}). Relancement de la configuration.")
        return {}


def sauvegarder_config(config: dict) -> None:
    """Sauvegarde la configuration et restreint les permissions (clé API sensible)."""
    dossier = os.path.dirname(CONFIG_PATH)
    if dossier:
        os.makedirs(dossier, exist_ok=True)
    try:
        with open(CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
        os.chmod(CONFIG_PATH, 0o600)  # Lecture/écriture uniquement par le propriétaire
    except IOError as e:
        print(f"⚠  Impossible de sauvegarder la config : {e}")


def _saisir_non_vide(invite: str, defaut: str = "") -> str:
    """Invite de saisie avec valeur par défaut ; redemande si vide et pas de défaut."""
    while True:
        affichage = f"{invite} [{defaut}] : " if defaut else f"{invite} : "
        valeur = input(affichage).strip()
        if valeur:
            return valeur
        if defaut:
            return defaut
        print("   Cette valeur est requise.")


def _choisir_chemin_vault() -> str:
    """
    Guide l'utilisateur pour choisir le chemin du vault Obsidian.

    Dans a-Shell, 'pickFolder' change le répertoire courant du terminal.
    La méthode recommandée est :
      1. Fermer ce script
      2. Taper 'pickFolder' dans a-Shell
      3. Sélectionner le vault → le terminal se déplace dans ce dossier
      4. Relancer : python claude_cli.py config
    """
    cwd = os.getcwd()

    print()
    print("   Comment voulez-vous définir le chemin du vault Obsidian ?")
    print(f"   1) Utiliser le répertoire courant : {cwd}")
    print("   2) Saisir un chemin manuellement")
    print("   3) Aide : utiliser pickFolder (a-Shell)")
    print()

    while True:
        choix = input("   Choix [1/2/3] : ").strip()
        if choix == "1":
            return cwd
        elif choix == "2":
            chemin = input("   Chemin du vault : ").strip()
            return os.path.expanduser(chemin) if chemin else cwd
        elif choix == "3":
            print()
            print("   ┌─ Instructions pickFolder (a-Shell) ─────────────────────┐")
            print("   │  1. Quittez ce script (Ctrl+C)                          │")
            print("   │  2. Dans le terminal a-Shell, tapez : pickFolder        │")
            print("   │  3. iOS ouvre un sélecteur de dossiers                  │")
            print("   │  4. Naviguez jusqu'à votre vault Obsidian               │")
            print("   │  5. Notez le chemin avec : pwd                          │")
            print("   │  6. Relancez : python claude_cli.py config              │")
            print("   └─────────────────────────────────────────────────────────┘")
            print()
            chemin = input("   Ou entrez directement le chemin copié-collé : ").strip()
            if chemin:
                return os.path.expanduser(chemin)
        else:
            print("   Tapez 1, 2 ou 3.")


def setup_premier_lancement() -> dict:
    """Assistant de configuration interactif (premier lancement ou reset)."""
    print()
    print("╔══════════════════════════════════════════════╗")
    print("║   Configuration initiale de claude_cli.py   ║")
    print("╚══════════════════════════════════════════════╝")
    print()

    config = {}

    # ── 1. Clé API ──────────────────────────────────────────────────────────
    print("1) Clé API Anthropic (commence par 'sk-ant-')")
    print("   Obtenez-la sur : https://console.anthropic.com/")
    cle = _saisir_non_vide("   Clé API")
    if not cle.startswith("sk-ant-"):
        print("   ⚠  Cette clé ne ressemble pas à une clé Anthropic valide.")
        confirmer = input("   Continuer quand même ? [o/N] ").strip().lower()
        if confirmer not in ("o", "oui", "y", "yes"):
            print("   Configuration annulée.")
            sys.exit(0)
    config["api_key"] = cle

    # ── 2. Modèle par défaut ─────────────────────────────────────────────────
    print()
    print("2) Modèle Claude par défaut")
    print("   Modèles disponibles :", ", ".join(MODELES_SUGGERES))
    modele = input(f"   Modèle [{DEFAULT_MODEL}] : ").strip()
    config["model"] = modele if modele else DEFAULT_MODEL

    # ── 3. Chemin du vault Obsidian ──────────────────────────────────────────
    print()
    print("3) Chemin vers votre vault Obsidian")
    config["vault_path"] = _choisir_chemin_vault()
    print(f"   ✓ Vault : {config['vault_path']}")

    # ── 4. Sous-dossier cible ────────────────────────────────────────────────
    print()
    print("4) Sous-dossier dans le vault pour les conversations")
    sf = input("   Sous-dossier [Claude Chats] : ").strip()
    config["subfolder"] = sf if sf else "Claude Chats"

    sauvegarder_config(config)
    print()
    print(f"✓ Configuration sauvegardée dans {CONFIG_PATH}")
    print("  Pour modifier : python claude_cli.py config")
    print()

    return config


def obtenir_config() -> dict:
    """Retourne la config existante ou lance le setup si absente/invalide."""
    config = charger_config()
    if not config or "api_key" not in config:
        config = setup_premier_lancement()
    return config


def cmd_config() -> None:
    """Sous-commande 'config' : modification ciblée de la configuration."""
    config = charger_config()

    # Si pas de config du tout, lancer le setup complet
    if not config:
        config = setup_premier_lancement()
        return

    cle_masquee = ("***" + config["api_key"][-4:]) if config.get("api_key") else "non définie"
    print()
    print("Configuration actuelle :")
    print(f"  Clé API  : {cle_masquee}")
    print(f"  Modèle   : {config.get('model', DEFAULT_MODEL)}")
    print(f"  Vault    : {config.get('vault_path', 'non défini')}")
    print(f"  Dossier  : {config.get('subfolder', 'Claude Chats')}")
    print()
    print("Que souhaitez-vous modifier ?")
    print("  1) Clé API")
    print("  2) Modèle par défaut")
    print("  3) Chemin du vault Obsidian")
    print("  4) Sous-dossier cible")
    print("  5) Tout reconfigurer depuis le début")
    print("  q) Annuler")
    print()

    choix = input("Choix : ").strip().lower()

    if choix == "1":
        config["api_key"] = _saisir_non_vide("Nouvelle clé API")
    elif choix == "2":
        print("Modèles suggérés :", ", ".join(MODELES_SUGGERES))
        m = input(f"Modèle [{config.get('model', DEFAULT_MODEL)}] : ").strip()
        if m:
            config["model"] = m
    elif choix == "3":
        config["vault_path"] = _choisir_chemin_vault()
    elif choix == "4":
        sf = input(f"Sous-dossier [{config.get('subfolder', 'Claude Chats')}] : ").strip()
        if sf:
            config["subfolder"] = sf
    elif choix == "5":
        setup_premier_lancement()
        return
    elif choix == "q":
        print("Annulé.")
        return
    else:
        print("Choix invalide.")
        return

    sauvegarder_config(config)
    print("✓ Configuration mise à jour.")


# ══════════════════════════════════════════════════════════════════════════════
# Appels API Claude
# ══════════════════════════════════════════════════════════════════════════════

class ErreurAPI(Exception):
    """Erreur générique de l'API Claude."""


class ErreurRateLimit(ErreurAPI):
    """Limite de débit atteinte (429)."""


class ErreurCleInvalide(ErreurAPI):
    """Clé API invalide ou expirée (401)."""


class ErreurReseau(ErreurAPI):
    """Pas de réseau ou timeout."""


def appeler_claude(messages: list, model: str, api_key: str, max_tokens: int = MAX_TOKENS) -> str:
    """
    Envoie une liste de messages à l'API Claude et retourne la réponse textuelle.

    messages : [{"role": "user"/"assistant", "content": "..."}, ...]
    """
    headers = {
        "x-api-key":         api_key,
        "anthropic-version": API_VERSION,
        "content-type":      "application/json",
    }
    payload = {
        "model":      model,
        "max_tokens": max_tokens,
        "messages":   messages,
    }

    try:
        reponse = requests.post(API_URL, headers=headers, json=payload, timeout=90)
    except requests.exceptions.ConnectionError:
        raise ErreurReseau("Impossible de joindre l'API. Vérifiez votre connexion réseau.")
    except requests.exceptions.Timeout:
        raise ErreurReseau("La requête a expiré (délai 90 s). Réessayez.")
    except requests.exceptions.RequestException as e:
        raise ErreurReseau(f"Erreur réseau : {e}")

    code = reponse.status_code

    if code == 401:
        raise ErreurCleInvalide(
            "Clé API invalide ou expirée. "
            "Mettez-la à jour avec : python claude_cli.py config"
        )
    if code == 429:
        retry_after = reponse.headers.get("retry-after", "quelques secondes")
        raise ErreurRateLimit(f"Limite de débit atteinte. Réessayez dans {retry_after}.")
    if code == 400:
        detail = reponse.json().get("error", {}).get("message", "Requête invalide")
        raise ErreurAPI(f"Requête invalide (400) : {detail}")
    if code == 529:
        raise ErreurAPI("L'API est surchargée (529). Réessayez dans quelques instants.")
    if code != 200:
        raise ErreurAPI(f"Erreur API ({code}) : {reponse.text[:200]}")

    donnees = reponse.json()
    return donnees["content"][0]["text"]


# ══════════════════════════════════════════════════════════════════════════════
# Sauvegarde Markdown / Obsidian
# ══════════════════════════════════════════════════════════════════════════════

def _generer_titre(messages: list, max_mots: int = 6) -> str:
    """
    Extrait un titre court depuis le premier message utilisateur.
    Retourne une chaîne sanitisée valide comme nom de fichier.
    """
    texte = next(
        (m["content"] for m in messages if m.get("role") == "user"),
        "conversation",
    )
    mots = texte.split()[:max_mots]
    titre = " ".join(mots)
    # Supprime les caractères interdits dans les noms de fichiers iOS/macOS
    titre = re.sub(r'[/:*?"<>|\\]', '', titre)
    # Remplace les espaces et caractères de ponctuation résiduels par des tirets
    titre = re.sub(r'[\s\.,;!]+', '-', titre.strip())
    titre = titre.strip("-")[:50]
    return titre.lower() if titre else "conversation"


def _construire_markdown(messages: list, model: str) -> str:
    """Construit le contenu complet de la note (frontmatter YAML + Q/R)."""
    maintenant = datetime.datetime.now()
    date_str   = maintenant.strftime("%Y-%m-%d")
    heure_str  = maintenant.strftime("%H:%M")

    lignes = [
        "---",
        f'date: "{date_str} {heure_str}"',
        f'modèle: "{model}"',
        "tags:",
        "  - claude",
        "  - ia",
        "  - conversation",
        "---",
        "",
    ]

    for msg in messages:
        role    = msg.get("role", "")
        contenu = msg.get("content", "")
        if role == "user":
            lignes.append("## User")
        elif role == "assistant":
            lignes.append("## Claude")
        else:
            continue
        lignes.append("")
        lignes.append(contenu)
        lignes.append("")

    return "\n".join(lignes)


def sauvegarder_conversation(messages: list, model: str, config: dict) -> str | None:
    """
    Sauvegarde la conversation dans le vault Obsidian configuré.
    Retourne le chemin du fichier créé, ou None en cas d'échec.
    """
    if not messages:
        print("Aucun message à sauvegarder.")
        return None

    vault_path = config.get("vault_path", os.path.expanduser("~/Documents"))
    subfolder  = config.get("subfolder", "Claude Chats")
    dossier    = os.path.join(vault_path, subfolder)

    try:
        os.makedirs(dossier, exist_ok=True)
    except OSError as e:
        print(f"⚠  Impossible de créer le dossier '{dossier}' : {e}")
        # Repli sur ~/Documents pour ne pas perdre la note
        dossier = os.path.expanduser("~/Documents")
        os.makedirs(dossier, exist_ok=True)

    maintenant   = datetime.datetime.now()
    horodatage   = maintenant.strftime("%Y-%m-%d_%H%M")
    titre        = _generer_titre(messages)
    nom_fichier  = f"{horodatage}_{titre}.md"
    chemin       = os.path.join(dossier, nom_fichier)

    contenu = _construire_markdown(messages, model)

    try:
        with open(chemin, "w", encoding="utf-8") as f:
            f.write(contenu)
        print(f"✓ Note sauvegardée : {chemin}")
        return chemin
    except IOError as e:
        print(f"⚠  Impossible d'écrire le fichier : {e}")
        return None


# ══════════════════════════════════════════════════════════════════════════════
# Mode Chat interactif
# ══════════════════════════════════════════════════════════════════════════════

_AIDE_CHAT = """
Commandes disponibles :
  /save         Sauvegarder la conversation en note Markdown
  /clear        Effacer l'historique et démarrer une nouvelle conversation
  /model <nom>  Changer de modèle (ex : /model claude-sonnet-4-6)
  /models       Lister les modèles suggérés
  /aide         Afficher cette aide
  /quitter      Quitter (propose de sauvegarder si historique non vide)
"""


def _demander_sauvegarde() -> bool:
    """Retourne True si l'utilisateur confirme la sauvegarde."""
    rep = input("Sauvegarder la conversation ? [o/N] ").strip().lower()
    return rep in ("o", "oui", "y", "yes")


def cmd_chat(config: dict) -> None:
    """Lance la boucle de conversation interactive avec Claude."""
    model      = config.get("model", DEFAULT_MODEL)
    historique = []

    print()
    print("╔══════════════════════════════════════════════╗")
    print("║   Claude CLI — Conversation interactive     ║")
    print("╚══════════════════════════════════════════════╝")
    print(f"  Modèle actif : {model}")
    print("  /aide pour les commandes  |  Ctrl+C pour quitter")
    print()

    while True:
        try:
            saisie = input("Vous : ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\n\nAu revoir !")
            if historique and _demander_sauvegarde():
                sauvegarder_conversation(historique, model, config)
            break

        if not saisie:
            continue

        # ── Traitement des commandes /... ────────────────────────────────────
        if saisie.startswith("/"):
            tokens  = saisie.split(maxsplit=1)
            cmd     = tokens[0].lower()
            arg     = tokens[1].strip() if len(tokens) > 1 else ""

            if cmd == "/quitter":
                print("Au revoir !")
                if historique and _demander_sauvegarde():
                    sauvegarder_conversation(historique, model, config)
                break

            elif cmd == "/save":
                if historique:
                    sauvegarder_conversation(historique, model, config)
                else:
                    print("Rien à sauvegarder — la conversation est vide.")

            elif cmd == "/clear":
                historique = []
                print("✓ Historique effacé. Nouvelle conversation démarrée.\n")

            elif cmd == "/model":
                if not arg:
                    print(f"Usage : /model <nom>  — Modèle actuel : {model}")
                else:
                    model = arg
                    print(f"✓ Modèle changé : {model}\n")

            elif cmd == "/models":
                print("Modèles suggérés :")
                for m in MODELES_SUGGERES:
                    marqueur = "  ◄ actuel" if m == model else ""
                    print(f"  {m}{marqueur}")
                print()

            elif cmd in ("/aide", "/help"):
                print(_AIDE_CHAT)

            else:
                print(f"Commande inconnue : '{cmd}'. Tapez /aide pour la liste.\n")

            continue

        # ── Message normal : envoi à l'API ───────────────────────────────────
        historique.append({"role": "user", "content": saisie})
        print()
        print("Claude : ", end="", flush=True)

        try:
            reponse = appeler_claude(historique, model, config["api_key"])
            print(reponse)
            print()
            historique.append({"role": "assistant", "content": reponse})

        except ErreurCleInvalide as e:
            print(f"\n⚠  {e}\n")
            historique.pop()

        except ErreurRateLimit as e:
            print(f"\n⚠  {e}\n")
            historique.pop()

        except ErreurReseau as e:
            print(f"\n⚠  {e}\n")
            historique.pop()

        except ErreurAPI as e:
            print(f"\n⚠  {e}\n")
            historique.pop()


# ══════════════════════════════════════════════════════════════════════════════
# Mode Ask (question unique)
# ══════════════════════════════════════════════════════════════════════════════

def cmd_ask(question: str, config: dict) -> None:
    """Pose une question unique à Claude, affiche la réponse, propose la sauvegarde."""
    if not question:
        print("Usage : python claude_cli.py ask \"Votre question ici\"")
        sys.exit(1)

    model    = config.get("model", DEFAULT_MODEL)
    messages = [{"role": "user", "content": question}]

    print()
    print(f"Modèle : {model}")
    print("─" * 60)
    print(f"Question : {question}")
    print("─" * 60)
    print("Claude : ", end="", flush=True)

    try:
        reponse = appeler_claude(messages, model, config["api_key"])
        print(reponse)
        print("─" * 60)
        messages.append({"role": "assistant", "content": reponse})

        if _demander_sauvegarde():
            sauvegarder_conversation(messages, model, config)

    except ErreurCleInvalide as e:
        print(f"\n⚠  {e}")
        sys.exit(1)

    except ErreurRateLimit as e:
        print(f"\n⚠  {e}")
        sys.exit(1)

    except ErreurReseau as e:
        print(f"\n⚠  {e}")
        sys.exit(1)

    except ErreurAPI as e:
        print(f"\n⚠  {e}")
        sys.exit(1)


# ══════════════════════════════════════════════════════════════════════════════
# Point d'entrée
# ══════════════════════════════════════════════════════════════════════════════

_AIDE_PRINCIPALE = """
Usage : python claude_cli.py <commande> [arguments]

Commandes :
  chat              Lance une conversation interactive avec Claude
  ask "question"    Pose une question et affiche la réponse directement
  config            Modifier la configuration (clé API, vault, modèle...)

Exemples :
  python claude_cli.py chat
  python claude_cli.py ask "Qu'est-ce que la mémoire associative ?"
  python claude_cli.py ask "Résume ce concept en 3 points : transformer"
  python claude_cli.py config
"""


def main() -> None:
    args = sys.argv[1:]

    if not args or args[0] in ("-h", "--help", "aide", "help"):
        print(_AIDE_PRINCIPALE)
        sys.exit(0)

    sous_commande = args[0].lower()

    # 'config' ne charge pas la config existante mais la modifie
    if sous_commande == "config":
        cmd_config()
        sys.exit(0)

    # Toutes les autres sous-commandes nécessitent une config valide
    config = obtenir_config()

    if sous_commande == "chat":
        cmd_chat(config)

    elif sous_commande == "ask":
        question = " ".join(args[1:])
        cmd_ask(question, config)

    else:
        print(f"Commande inconnue : '{sous_commande}'")
        print(_AIDE_PRINCIPALE)
        sys.exit(1)


if __name__ == "__main__":
    main()
