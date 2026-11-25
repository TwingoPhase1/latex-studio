# Σ LaTeX Studio

[![Go 1.23](https://img.shields.io/badge/Go-1.23-00ADD8?logo=go&logoColor=white)](https://go.dev/)
[![MathJax 3](https://img.shields.io/badge/MathJax-3-3B82F6)](https://www.mathjax.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-10B981.svg)](./LICENSE)

Un éditeur d'équations **LaTeX** moderne, rapide et auto-hébergeable, écrit en **Go pur** (bibliothèque standard uniquement, zéro dépendance Node.js en production) avec interface web embarquée (`//go:embed`) et rendu **MathJax 3** temps réel.

---

## Fonctionnalités

- **Palette de symboles complète & accessible (220+ éléments)** :
  - 9 onglets organisés : *Essentiels*, *Grec*, *Opérateurs & Relations*, *Flèches*, *Ensembles & Délimiteurs*, *Fonctions*, *Accents, Polices & Tailles*, *Couleurs & Cadres*, *Physique & Chimie*.
  - Barre **Récents** (10 derniers symboles utilisés), recherche instantanée (`Ctrl + K`), et barre d'inspection affichant le nom français et la commande exacte.
  - **Enveloppement intelligent** : sélectionnez du texte puis cliquez sur un symbole (`\frac{}{}`, `\sqrt{}`, `\color{...}{}`, etc.) pour l'encapsuler automatiquement.
- **Éditeur LaTeX assisté** :
  - Coloration syntaxique synchronisée et numérotation des lignes.
  - Fermeture automatique des paires (`{}`, `[]`, `()`, `$$`), saut intelligent avec `Tab` vers le prochain `{}`, saut des fermants déjà présents, et suppression de paire vide avec `Backspace`.
  - **Autocomplétion `\`** pour les commandes et environnements (`\begin{aligned}`, `cases`, `pmatrix`, `bmatrix`, `gather`).
  - Historique Annuler / Rétablir (80 étapes), mode multi-lignes `\\`, suppression des sauts de ligne, et copie rapide (brut, `$...$`, `$$...$$`).
- **Aperçu temps réel MathJax 3 & Exports HD** :
  - Support natif des extensions `physics`, `color`, `bbox`, `cancel` et `mhchem` (`\ce{...}`, `\pu{...}`).
  - Zoom (`14`–`64px`, boutons `−`/`+`, `Ctrl + Molette`), fonds (*Auto*, *Clair*, *Sombre*, *Grille*, *Damier*), mode Bloc/Inline, et diagnostic d'erreur syntaxique.
  - Exports en **PNG haute résolution** (`1×` à `4×`, marge et fond personnalisables), **Copie PNG** (`Ctrl + Shift + C`), **SVG vectoriel**, **Copie SVG**, **Source `.tex`**, **Impression / PDF** propre (`@media print`), et **liens courts de partage** (`/s/{id}`).
- **Outils intégrés** :
  - **Constructeur de matrices & systèmes** (grille interactive jusqu'à 8×8 pour `pmatrix`, `bmatrix`, `Bmatrix`, `vmatrix`, `Vmatrix`, `matrix`, `cases`, `aligned` avec aperçu en direct).
  - **13 modèles prêts à l'emploi** (*Classiques*, *Analyse*, *Algèbre*, *Physique*, *Chimie*).
  - **Équations enregistrées** côté serveur Go (`/api/snippets`, épinglage, renommage en ligne, export/import JSON).
  - **Interface Studio** : thème **Clair / Sombre**, panneau redimensionnable par glisser-déposer, mode Focus, et modale d'aide (`?`).

---

## Structure du projet

```text
latex-studio/
├── main.go                      # Point d'entrée Go, embed web/, serveur HTTP & graceful shutdown
├── go.mod                       # Module Go 1.23 (zéro dépendance externe)
├── internal/
│   ├── data/
│   │   ├── symbols.go           # Catalogue des 9 catégories et 220+ symboles
│   │   └── templates.go         # 13 modèles d'équations avec aperçu
│   ├── store/
│   │   └── store.go             # Persistance JSON atomique & thread-safe (snippets + liens courts)
│   └── server/
│       ├── server.go            # API REST, routage Go 1.22+, gzip & headers de sécurité
│       └── server_test.go       # Tests unitaires HTTP
├── web/
│   ├── index.html               # Interface HTML sémantique + config MathJax 3
│   └── static/
│       ├── app.css              # Design studio Clair/Sombre, grilles & print CSS
│       └── app.js               # Éditeur, autocomplétion, exports PNG/SVG/TeX & modales
├── Dockerfile                   # Build multi-stage (go test + binaire statique sur Alpine 3.21)
├── docker-compose.yml           # Stack isolée latex-studio + cloudflared
├── .env.example                 # Variables d'environnement de référence
└── LICENSE                      # Licence MIT
```

---

## Endpoints API Go

| Méthode | Route | Description |
| --- | --- | --- |
| `GET` | `/api/health` | État du service (`{"status":"ok","engine":"go"}`) |
| `GET` | `/api/symbols` | Liste des catégories et symboles (`?category=`, `?q=`) |
| `GET` | `/api/templates` | Liste des 13 modèles d'équations |
| `GET` | `/api/snippets` | Liste des équations enregistrées |
| `POST` | `/api/snippets` | Enregistre une nouvelle équation (`title`, `latex`) |
| `PATCH` | `/api/snippets/{id}` | Renomme ou épingle une équation (`title`, `pinned`) |
| `DELETE` | `/api/snippets/{id}` | Supprime une équation |
| `GET` | `/api/snippets/export` | Télécharge toutes les équations en JSON |
| `POST` | `/api/snippets/import` | Importe un tableau JSON d'équations |
| `POST` | `/api/share` | Crée un lien court `/s/{id}` pour une équation |
| `GET` | `/api/share/{id}` | Récupère l'équation associée à un lien court |

---

## Déploiement sur votre serveur (VPS Linux / Homelab)

### 1. Prérequis sur le serveur
- **Git**
- **Docker Engine** et le plugin **Docker Compose** (`docker compose version`)

### 2. Cloner le dépôt et configurer `.env`

```bash
git clone https://github.com/TwingoPhase1/latex-studio.git
cd latex-studio
cp .env.example .env
```

Éditez `.env` avec votre port hôte souhaité et votre token de tunnel Cloudflare :

```env
PORT=8088
CLOUDFLARE_TUNNEL_TOKEN=votre_token_cloudflare_tunnel
```

> **Important (Tunnel Cloudflare dédié)** : créez un tunnel dédié à `latex-studio` dans Cloudflare Zero Trust plutôt que de réutiliser le token d'un autre serveur/réseau Docker déjà actif. Si deux conteneurs `cloudflared` partagent le même token sur des réseaux Docker différents, Cloudflare répartira les requêtes entre les deux et produira des erreurs `502 Bad Gateway`.

### 3. Lancer la stack complète (Application + Tunnel Cloudflare)

```bash
docker compose up -d --build
```

Vérifiez que les conteneurs sont actifs et sains :

```bash
docker compose ps
curl -s http://localhost:8088/api/health
# {"engine":"go","status":"ok"}
```

*(Optionnel — sans Tunnel Cloudflare, si vous utilisez Nginx/Caddy/Traefik en reverse proxy)* :

```bash
docker compose up -d --build latex-studio
```

### 4. Configurer Cloudflare Zero Trust

Dans **Cloudflare Zero Trust → Networks → Tunnels → Public Hostname** :
- **Subdomain / Domain** : ex. `latex.votredomaine.tld`
- **Service Type** : `HTTP`
- **URL** : `latex-studio:8080` *(port interne du conteneur dans le réseau `latex-studio-net`, quel que soit le `PORT` hôte choisi dans `.env`)*

### 5. Maintenance & Sauvegardes

```bash
# Mettre à jour depuis GitHub et reconstruire
git pull && docker compose up -d --build

# Consulter les logs en direct
docker compose logs -f

# Sauvegarder les équations et liens courts persistés
cp ./data/store.json ./store.backup.json

# Arrêter les conteneurs
docker compose down
```

---

## Développement local en Go (sans Docker)

Prérequis : **Go 1.23+**

```bash
# Lancer les tests unitaires
go test -v ./...

# Démarrer le serveur en local (http://localhost:8080)
go run .
```

Variables d'environnement supportées par le binaire Go :
- `PORT` : port d'écoute HTTP (défaut : `8080`)
- `DATA_DIR` : dossier de persistance pour `store.json` (défaut : `./data`)

---

## Licence

Distribué sous licence [MIT](./LICENSE).
