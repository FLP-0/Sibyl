# Maison à louer en Corse — site statique

Copie de travail du site `location-maison-en-corse.fr`, sous forme de site
**statique pur** : sept pages HTML, une feuille de style, un fichier
JavaScript, des images. Aucune dépendance, aucune étape de build, aucun
serveur applicatif — le dossier se déploie tel quel.

> ⚠️ **Le contenu réel du site d'origine n'a pas pu être récupéré** depuis cet
> environnement (accès HTTPS sortant bloqué par la politique réseau). Les
> textes et photos sont des repères à remplacer : voir
> [`CONTENU-A-COMPLETER.md`](CONTENU-A-COMPLETER.md).

## Structure

```
site-corse/
├── index.html              Accueil
├── la-maison.html          Description et équipements
├── galerie.html            Galerie photos (visionneuse)
├── tarifs.html             Tarifs et conditions de réservation
├── la-region.html          La Balagne, que faire aux alentours
├── contact.html            Formulaire de demande de réservation
├── mentions-legales.html   Mentions légales et RGPD
├── 404.html                Page d'erreur
├── assets/
│   ├── css/style.css       Toute la mise en forme
│   ├── js/main.js          Menu mobile, visionneuse, formulaire
│   └── img/                Images (placeholders SVG)
├── robots.txt
├── sitemap.xml
├── netlify.toml            Configuration Netlify
└── vercel.json             Configuration Vercel
```

## Voir le site en local

N'importe quel serveur de fichiers suffit :

```bash
cd site-corse
python3 -m http.server 8000
# puis http://localhost:8000
```

Ouvrir `index.html` directement dans le navigateur fonctionne aussi ; passer
par un serveur reste plus proche des conditions réelles.

## Mettre en ligne

Le dossier à publier est `site-corse/` — pas la racine du dépôt.

**Netlify** — nouveau site depuis Git, *base directory* et *publish directory*
sur `site-corse`, commande de build vide. `netlify.toml` fait le reste.

**Vercel** — nouveau projet, *root directory* sur `site-corse`, preset
« Other », pas de commande de build.

**GitHub Pages** — publier depuis une branche dont la racine contient ces
fichiers (ou déplacer le contenu de `site-corse/` dans `docs/` et choisir
`/docs`). Ajouter un fichier vide `.nojekyll` si des noms commencent par `_`.

**Hébergement mutualisé (OVH, Ionos, o2switch…)** — envoyer le contenu de
`site-corse/` dans `www/` ou `public_html/` par FTP/SFTP. Rien d'autre à
installer.

Après la mise en ligne, penser au domaine : `www.location-maison-en-corse.fr`
en `CNAME` vers l'hébergeur, et HTTPS activé (Let's Encrypt chez tous les
hébergeurs cités).

## Brancher le formulaire de contact

Par défaut, le formulaire de `contact.html` a `action="#"` : le JavaScript
ouvre alors le logiciel de messagerie du visiteur, pour ne perdre aucune
demande. Pour recevoir les demandes par e-mail sans client mail :

- **Netlify Forms** — ajouter `netlify` sur la balise `<form>` :
  `<form class="formulaire" netlify method="post">`. Rien d'autre à faire.
- **Formspree** (ou équivalent) — remplacer l'attribut `action` :
  `action="https://formspree.io/f/VOTRE_ID"`. Le script se met en retrait dès
  que `action` n'est plus `#`.
- **Script PHP** sur hébergement mutualisé — `action="envoi.php"` et un script
  qui valide les champs puis appelle `mail()`.

Penser aussi à mettre à jour l'attribut `data-destinataire` du formulaire et
l'adresse affichée dans le pied de page.

## Choix techniques

- **Pas de framework.** Un site vitrine de sept pages n'a besoin ni de build ni
  de runtime : moins de maintenance, aucune dépendance à mettre à jour, et un
  hébergement possible n'importe où.
- **Pas de ressource externe.** Aucune police Google, aucun CDN, aucun
  traceur : le site fonctionne hors ligne, se charge vite et ne dépose pas de
  cookie (d'où l'absence de bandeau cookies).
- **Accessibilité.** Lien d'évitement, navigation au clavier dans la
  visionneuse (`Échap` pour fermer), `aria-current` sur la page active,
  contrastes conformes AA, `prefers-reduced-motion` respecté.
- **Responsive.** Grilles fluides, menu replié en dessous de 800 px, tableau de
  tarifs défilable horizontalement sur mobile.
