# Les Yeux de Mona

Site web élégant présentant les œuvres d'art citées dans le livre "Les Yeux de Mona" de Thomas Schlesser. Explorez une collection soigneusement sélectionnée d'œuvres du Louvre, du Musée d'Orsay et du Centre Pompidou (Beaubourg).

## 🎨 Fonctionnalités

### Galerie interactive
- **Vue galerie** : Grille responsive avec effet Ken Burns sur les images
- **Vue timeline** : Chronologie des œuvres par date
- **Filtres avancés** : Recherche par titre, artiste, musée et techniques artistiques
- **Navigation fluide** : Transitions élégantes et animations subtiles

### Visualisation d'œuvres
- **Pages détaillées** : Informations complètes sur chaque œuvre
- **Zoom avancé** : Zoom jusqu'à 16x avec rééchantillonnage intelligent
- **Mode plein écran** : Visualisation immersive en plein écran natif
- **Rééchantillonnage d'images** : Amélioration automatique de la netteté au-delà de 2x de zoom
- **Miniature de navigation** : Vue d'ensemble avec cadre indiquant la zone visible
- **Pan et zoom** : Navigation fluide avec la molette et le glisser-déposer

### Contenu enrichi
- **Explications détaillées** : "Comment comprendre cette œuvre" et "Ce qu'il faut voir"
- **Techniques artistiques** : Badges affichant les techniques spécifiques à chaque œuvre
- **Métadonnées complètes** : Date, artiste, musée, lien vers le site officiel

## 🚀 Installation

### Prérequis
- Un serveur web local (ou hébergement web)
- Aucune dépendance externe requise (site statique)

### Démarrage rapide

1. Clonez le dépôt :
```bash
git clone https://github.com/nmarchand73/Les-Yeux-de-Mona.git
cd Les-Yeux-de-Mona
```

2. Ouvrez le site :
   - **Option 1** : Ouvrez `site/index.html` directement dans votre navigateur
   - **Option 2** : Utilisez un serveur local :
     ```bash
     # Avec Python
     cd site
     python -m http.server 8000
     
     # Avec Node.js (http-server)
     npx http-server site -p 8000
     ```

3. Accédez à `http://localhost:8000` dans votre navigateur

## 📁 Structure du projet

```
Les-Yeux-de-Mona/
├── site/                    # Site web principal
│   ├── index.html          # Page d'accueil avec galerie
│   ├── oeuvre.html         # Page de détail d'une œuvre
│   ├── css/
│   │   └── style.css       # Styles principaux
│   ├── js/
│   │   ├── data.js         # Chargement des données JSON
│   │   └── app.js          # Logique de l'application
│   └── data/
│       └── artworks.json   # Données des œuvres (métadonnées + explications)
├── images/                  # Images HD des œuvres
│   ├── louvre/
│   ├── orsay/
│   └── beaubourg/
└── README.md
```

## 🎯 Technologies utilisées

- **HTML5** : Structure sémantique
- **CSS3** : Animations, transitions, effets visuels
- **JavaScript (Vanilla)** : Logique interactive, chargement asynchrone
- **Canvas API** : Rééchantillonnage et amélioration d'images
- **Fullscreen API** : Mode plein écran natif

## ✨ Fonctionnalités techniques avancées

### Rééchantillonnage d'images
- **Upscaling progressif** : Agrandissement par étapes de 2x pour préserver la qualité
- **Sharpening multi-passes** :
  - Passe 1 : Laplacian sharpening pour la détection des bords
  - Passe 2 : Unsharp mask avec kernel 3x3
  - Passe 3 : Edge enhancement avec détection de contours (Sobel-like)
- **Adaptation dynamique** : Force du sharpening adaptée au niveau de zoom

### Effet Ken Burns
- Animations CSS pures (pas de bibliothèque externe)
- 4 variantes d'animation pour plus de diversité
- Accélération au survol avec zoom accentué
- Transitions fluides sans saccades

### Performance
- Chargement asynchrone des données JSON
- Images lazy-loading
- Préchargement intelligent du canvas pour le rééchantillonnage
- Optimisations CSS avec `will-change` et `transform`

## 📊 Données

Les données des œuvres sont stockées dans `site/data/artworks.json` et incluent :
- Métadonnées : titre, artiste, date, musée, lien
- Images : URL HD et chemin local
- Explications : "comment_comprendre" et "ce_quil_faut_voir"
- Techniques : liste des techniques artistiques spécifiques

## 🎨 Personnalisation

### Couleurs
Les couleurs sont définies dans `:root` de `style.css` :
```css
--color-bg: #f8f7f4;
--color-accent: #2c3e50;
--color-text: #1a1a1a;
/* ... */
```

### Animations
Les paramètres de zoom et de transition peuvent être ajustés dans `style.css` :
- Seuil de rééchantillonnage : `ZOOM_THRESHOLD_FOR_UPSCALE = 2.0`
- Zoom maximum : `Math.min(16, ...)`
- Durées d'animation Ken Burns

## 📝 Licence

Ce projet est basé sur le livre "Les Yeux de Mona" de Thomas Schlesser.

## 🙏 Remerciements

- **Thomas Schlesser** pour le livre "Les Yeux de Mona"
- **Musées partenaires** : Louvre, Musée d'Orsay, Centre Pompidou
- Images HD fournies par les musées respectifs

## 🔗 Liens

- [Dépôt GitHub](https://github.com/nmarchand73/Les-Yeux-de-Mona)
- [Livre "Les Yeux de Mona"](https://www.martinpaquin.com/liens-des-oeuvres-cites-dans-le-livre-les-yeux-de-mona-par-thomas-schlesser/)

---

*Développé avec passion pour l'exploration des œuvres d'art* 🎨

