# Σ LaTeX Studio

[![Go 1.23](https://img.shields.io/badge/Go-1.23-00ADD8?logo=go&logoColor=white)](https://go.dev/)
[![PWA Offline](https://img.shields.io/badge/PWA-100%25%20Hors%20Ligne-10B981)](./web/sw.js)
[![MathJax 3](https://img.shields.io/badge/MathJax-3%20Local-3B82F6)](./web/static/vendor/tex-svg-full.js)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-10B981.svg)](./LICENSE)

Un éditeur d'équations **LaTeX** moderne, installable (**PWA**) et **100 % hors ligne**.
Le serveur **Go** (stateless, zéro base de données, bibliothèque standard uniquement) distribue simplement la page et ses assets embarqués (`//go:embed web`) — y compris **MathJax 3** complet en local — puis le **Service Worker** met toute l'application en cache chez l'utilisateur. Une fois chargée ou installée sur ordinateur/mobile, elle fonctionne entièrement **sans connexion internet** et sans jamais solliciter le serveur.

---

## Fonctionnalités

- **100 % Hors ligne & Installable (PWA)** :
  - Service Worker (`/sw.js`) avec stratégie *Cache-First* et mise en cache complète de l'interface, des symboles, des modèles et de `tex-svg-full.js`.
  - Bouton **Installer l'app** dans l'en-tête (compatible Chrome, Edge, Android, iOS « Sur l'écran d'accueil »).
  - Sauvegarde locale illimitée dans le navigateur (`localStorage`) + import/export JSON + partage par lien autonome (`#tex=...`).
- **Palette de symboles complète & accessible (220+ éléments)** :
  - 9 onglets organisés : *Essentiels*, *Grec*, *Opérateurs & Relations*, *Flèches*, *Ensembles & Délimiteurs*, *Fonctions*, *Accents, Polices & Tailles*, *Couleurs & Cadres*, *Physique & Chimie*.
  - Barre **Récents** (10 derniers symboles utilisés), recherche instantanée (`Ctrl + K`), et barre d'inspection au survol.
  - **Enveloppement intelligent** : sélectionnez du texte puis cliquez sur un symbole (`\frac{}{}`, `\sqrt{}`, `\color{...}{}`, etc.) pour l'encapsuler automatiquement.
- **Éditeur LaTeX assisté** :
  - Coloration syntaxique synchronisée et numérotation des lignes.
  - Fermeture automatique des paires (`{}`, `[]`, `()`, `$$`), saut intelligent avec `Tab` vers le prochain `{}`, et suppression de paire vide avec `Backspace`.
  - **Autocomplétion `\`** pour les commandes et environnements (`\begin{aligned}`, `cases`, `pmatrix`, `bmatrix`, `gather`).
  - Historique Annuler / Rétablir (80 étapes), mode multi-lignes `\\`, suppression des sauts de ligne, et copie rapide (brut, `$...$`, `$$...$$`).
- **Aperçu temps réel MathJax 3 & Exports HD** :
  - Extensions incluses hors ligne : `physics`, `color`, `bbox`, `cancel` et `mhchem` (`\ce{...}`, `\pu{...}`).
  - Zoom (`14`–`64px`, boutons `−`/`+`, `Ctrl + Molette`), fonds (*Auto*, *Clair*, *Sombre*, *Grille*, *Damier*), mode Bloc/Inline.
  - Exports en **PNG haute résolution** (`1×` à `4×`), **Copie PNG** (`Ctrl + Shift + C`), **SVG vectoriel**, **Copie SVG**, **Source `.tex`** et **Impression / PDF** propre (`@media print`).
- **Outils intégrés** :
  - **Constructeur de matrices & systèmes** (grille interactive jusqu'à 8×8).
  - **13 modèles prêts à l'emploi** (*Classiques*, *Analyse*, *Algèbre*, *Physique*, *Chimie*).
  - **Interface Studio** : thème **Clair / Sombre**, séparateur central redimensionnable, mode Focus, et modale d'aide (`?`).

---

## Structure du projet

```text
latex-studio/
├── main.go                              # Serveur Go stateless (//go:embed web)
├── go.mod                               # Module Go 1.23 (zéro dépendance externe)
├── internal/server/
│   ├── server.go                        # Routes statiques PWA, headers de cache, gzip & /api/health
│   └── server_test.go                   # Tests unitaires HTTP
├── web/
│   ├── index.html                       # Shell HTML + manifest + config MathJax 3
│   ├── manifest.webmanifest             # Manifeste PWA (standalone)
│   ├── sw.js                            # Service Worker hors ligne (precache + cache-first)
│   ├── icon.svg / icon-192.png / 512    # Icônes de l'application
│   └── static/
│       ├── app.css                      # Design studio Clair/Sombre & print CSS
│       ├── app.js                       # Logique éditeur, exports, PWA & localStorage
│       ├── catalog.js                   # 220+ symboles et 13 modèles côté client
│       └── vendor/tex-svg-full.js       # MathJax 3 complet embarqué localement
├── Dockerfile                           # Build multi-stage (go test + binaire statique Alpine)
├── docker-compose.yml                   # Stack isolée latex-studio + cloudflared
└── .env.example                         # Variables d'environnement de référence
```

---

## Déploiement sur votre serveur (VPS Linux / Homelab)

### 1. Prérequis
- **Git**, **Docker Engine** et le plugin **Docker Compose**

### 2. Cloner et configurer `.env`

```bash
git clone https://github.com/TwingoPhase1/latex-studio.git
cd latex-studio
cp .env.example .env
```

Éditez `.env` :

```env
PORT=8088
CLOUDFLARE_TUNNEL_TOKEN=votre_token_cloudflare_tunnel
```

> Créez un tunnel dédié à `latex-studio` dans Cloudflare Zero Trust (ne réutilisez pas le token d'un autre conteneur `cloudflared` déjà actif sur un autre réseau Docker, sinon vous aurez des `502 Bad Gateway` intermittents).

### 3. Lancer la stack

```bash
docker compose up -d --build
docker compose ps
curl -s http://localhost:8088/api/health
# {"engine":"go","mode":"offline-pwa","status":"ok"}
```

*(Sans Tunnel Cloudflare, avec Nginx/Caddy/Traefik existant : `docker compose up -d --build latex-studio`.)*

### 4. Configurer Cloudflare Zero Trust

Dans **Networks → Tunnels → Public Hostname** :
- **Type** : `HTTP`
- **URL** : `latex-studio:8080` *(port interne du conteneur dans `latex-studio-net`)*

### 5. Mise à jour

```bash
git pull && docker compose up -d --build
```

*(Comme le serveur est totalement stateless, aucune base de données n'est à sauvegarder côté serveur : tout est conservé dans le navigateur de chaque utilisateur avec export/import JSON intégré.)*

---

## Développement local en Go

```bash
go test -v ./...
go run .
```

## Licence

Distribué sous licence [MIT](./LICENSE).
