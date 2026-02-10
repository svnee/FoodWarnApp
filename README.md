# FoodWarnLux

**Application de rappels alimentaires pour le Luxembourg** — inspirée de l'application allemande [Lebensmittelwarnung](https://www.lebensmittelwarnung.de), adaptée au contexte luxembourgeois.

## Fonctionnalités

- **Scanner de codes-barres** — Scannez un produit pour vérifier s'il fait l'objet d'un rappel
- **Liste des rappels** — Consultez tous les rappels alimentaires au Luxembourg, avec recherche et filtrage
- **Section laits infantiles** — Liste complète et dédiée des rappels de laits infantiles
- **Enrichissement automatique** — Correspondance codes-barres via Open Food Facts
- **Mise à jour automatique** — Scraping périodique de securite-alimentaire.public.lu

## Architecture

```
FoodWarnLux/
├── backend/          # API Node.js + TypeScript + Express
│   ├── src/
│   │   ├── api/      # Routes REST API
│   │   ├── db/       # SQLite schema & data access
│   │   ├── scraper/  # Scraper securite-alimentaire.public.lu
│   │   └── services/ # Open Food Facts integration
│   └── data/         # SQLite database (auto-created)
│
└── mobile/           # Application mobile Expo / React Native
    ├── src/
    │   ├── api/       # Client API
    │   ├── components/# Composants réutilisables
    │   ├── navigation/# Navigation (tabs + stack)
    │   └── screens/   # Écrans de l'app
    └── App.tsx
```

## Sources de données

| Source | Utilisation |
|--------|-------------|
| [securite-alimentaire.public.lu](https://securite-alimentaire.public.lu/fr/actualites/alertes.html) | Source principale — scraping des alertes de rappel |
| [Open Food Facts API](https://world.openfoodfacts.org/data) | Correspondance codes-barres ↔ produits |
| [RASFF](https://webgate.ec.europa.eu/rasff-window/screen/list) | Alertes au niveau européen (extension future) |

## Démarrage rapide

### Backend

```bash
cd backend
npm install
npm run migrate    # Initialise la base de données
npm run scrape     # Lance un scraping initial
npm run dev        # Démarre le serveur API (port 3000)
```

### Application mobile

```bash
cd mobile
npm install
npx expo start     # Démarre le serveur de développement Expo
```

Configurez l'URL de l'API dans le fichier `.env` :
```
EXPO_PUBLIC_API_URL=http://localhost:3000/api
```

## API Endpoints

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/recalls` | Liste des rappels (params: `limit`, `offset`, `search`, `status`) |
| GET | `/api/recalls/infant-formula` | Rappels de laits infantiles |
| GET | `/api/recalls/barcode/:ean` | Vérifier un code-barres |
| GET | `/api/recalls/:id` | Détail d'un rappel |
| POST | `/api/recalls/:id/barcodes` | Associer un code-barres manuellement |
| GET | `/api/stats` | Statistiques du tableau de bord |
| GET | `/health` | Santé du serveur |

## Stratégie de correspondance codes-barres

Les avis de rappel luxembourgeois incluent rarement des codes EAN. Notre stratégie multi-niveaux :

1. **Extraction directe** — Si un code-barres figure dans l'avis, il est stocké directement
2. **Open Food Facts** — Recherche par nom de produit/marque → codes-barres candidats avec score de confiance
3. **Enrichissement manuel** — Interface d'administration pour associer des codes-barres
4. **Vérification au scan** — Quand un utilisateur scanne, on compare les infos produit avec les rappels

## Licence

CC0 1.0 Universal — voir [LICENSE](LICENSE)
