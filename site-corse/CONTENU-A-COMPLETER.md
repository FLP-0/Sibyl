# Contenu à compléter

**Pourquoi ce fichier existe.** Le site d'origine
(`https://www.location-maison-en-corse.fr`) n'a **pas pu être téléchargé** :
la politique réseau de l'environnement d'exécution bloque tout accès HTTPS
sortant vers des domaines non autorisés (le proxy répond `403` au tunnel
CONNECT, y compris pour `example.com`). Les textes et les photos présents ici
sont donc une **structure de remplacement**, pas une copie du contenu réel.

Ce qui a pu être vérifié sur le site d'origine, via la recherche web :

- titre de la page d'accueil : « Home — Maison à louer en Corse » ;
- situation : Balagne, Haute-Corse, **entre Calvi et l'Île-Rousse** ;
- accroche : région « entre mer et montagne », riche en curiosités naturelles.

Tout le reste (surface, nombre de chambres, capacité, tarifs, coordonnées,
photos) reste à reprendre depuis l'original.

## Liste des éléments à remplacer

Chaque emplacement est signalé dans le code par un commentaire
`<!-- À COMPLÉTER : … -->`, repérable avec :

```bash
grep -rn "À COMPLÉTER" site-corse
```

| Fichier | À faire |
| --- | --- |
| `assets/img/*.svg` | Remplacer par les photos réelles (`.jpg`/`.webp`), puis corriger les `src` et les `alt` dans les pages. |
| `index.html` | Reprendre l'accroche et le texte de bienvenue de l'original ; adresse e-mail dans le pied de page. |
| `la-maison.html` | Description réelle : surface, nombre de chambres et de couchages, salles de bain, équipements exacts, jours d'arrivée. |
| `galerie.html` | Légendes (`alt`) des photos réelles. |
| `tarifs.html` | Grille tarifaire réelle, taxe de séjour, dépôt de garantie, forfait ménage, conditions d'annulation. |
| `la-region.html` | Ajuster si l'original décrit d'autres lieux ; textes régionaux vérifiables tels quels. |
| `contact.html` | E-mail et téléphone réels ; brancher le formulaire (voir `README.md`). |
| `mentions-legales.html` | Identité de l'éditeur, adresse, SIRET éventuel, hébergeur. |
| `sitemap.xml`, `robots.txt` | Vérifier le domaine si le site est publié ailleurs. |
| Toutes les pages | **Supprimer le bandeau `.bandeau-brouillon`** (bloc `<div>` en haut du `<body>`) avant la mise en ligne. |

## Récupérer le contenu réel

Deux façons de débloquer la reprise à l'identique :

1. **Autoriser le domaine** dans la politique réseau de l'environnement Claude
   Code, puis relancer la copie (voir la documentation :
   <https://code.claude.com/docs/en/claude-code-on-the-web>) ;
2. **Fournir les fichiers** : une archive du site (export FTP, `wget -mkEpnp`
   depuis un poste non filtré) ou le HTML des pages, déposée dans le dépôt.

Une fois le contenu disponible, la structure de ce dossier reste valable : il
n'y a que du texte et des images à substituer.
