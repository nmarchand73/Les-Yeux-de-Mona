# Les Yeux de Mona

Elegant web application showcasing artworks referenced in "Les Yeux de Mona" by Thomas Schlesser. Explore a carefully curated collection of works from the Louvre, Musée d'Orsay, and Centre Pompidou (Beaubourg).

## 🎨 Features

### Interactive Gallery
- **Gallery View**: Responsive grid with Ken Burns effect on images
- **Timeline View**: Chronological display of artworks by date
- **Advanced Filters**: Search by title, artist, museum, and artistic techniques
- **Smooth Navigation**: Elegant transitions and subtle animations

### Artwork Visualization
- **Detailed Pages**: Complete information for each artwork
- **Advanced Zoom**: Zoom up to 16x with intelligent image upscaling
- **Fullscreen Mode**: Immersive native fullscreen viewing
- **Image Upscaling**: Automatic sharpness enhancement beyond 2x zoom
- **Navigation Thumbnail**: Overview with frame indicating visible area
- **Pan and Zoom**: Smooth navigation with mouse wheel and drag

### Enriched Content
- **Detailed Explanations**: "How to understand this artwork" and "What to see"
- **Artistic Techniques**: Badges displaying techniques specific to each artwork
- **Complete Metadata**: Date, artist, museum, link to official website

## 🚀 Installation

### Prerequisites
- A local web server (or web hosting)
- No external dependencies required (static site)

### Quick Start

1. Clone the repository:
```bash
git clone https://github.com/nmarchand73/Les-Yeux-de-Mona.git
cd Les-Yeux-de-Mona
```

2. Open the site:
   - **Option 1**: Open `site/index.html` directly in your browser
   - **Option 2**: Use a local server:
     ```bash
     # With Python
     cd site
     python -m http.server 8000
     
     # With Node.js (http-server)
     npx http-server site -p 8000
     ```

3. Access `http://localhost:8000` in your browser

## 📁 Project Structure

```
Les-Yeux-de-Mona/
├── site/                    # Main website
│   ├── index.html          # Homepage with gallery
│   ├── oeuvre.html         # Artwork detail page
│   ├── css/
│   │   └── style.css       # Main styles
│   ├── js/
│   │   ├── data.js         # JSON data loading
│   │   └── app.js          # Application logic
│   └── data/
│       └── artworks.json   # Artwork data (metadata + explanations)
├── images/                  # HD artwork images
│   ├── louvre/
│   ├── orsay/
│   └── beaubourg/
└── README.md
```

## 🎯 Technologies Used

- **HTML5**: Semantic structure
- **CSS3**: Animations, transitions, visual effects
- **Vanilla JavaScript**: Interactive logic, asynchronous loading
- **Canvas API**: Image upscaling and enhancement
- **Fullscreen API**: Native fullscreen mode

## ✨ Advanced Technical Features

### Image Upscaling
- **Progressive Upscaling**: 2x step-by-step enlargement to preserve quality
- **Multi-pass Sharpening**:
  - Pass 1: Laplacian sharpening for edge detection
  - Pass 2: Unsharp mask with 3x3 kernel
  - Pass 3: Edge enhancement with contour detection (Sobel-like)
- **Dynamic Adaptation**: Sharpening strength adapted to zoom level

### Ken Burns Effect
- Pure CSS animations (no external library)
- 4 animation variants for diversity
- Acceleration on hover with enhanced zoom
- Smooth transitions without jitter

### Performance
- Asynchronous JSON data loading
- Lazy-loading images
- Intelligent canvas preloading for upscaling
- CSS optimizations with `will-change` and `transform`

## 📊 Data

Artwork data is stored in `site/data/artworks.json` and includes:
- Metadata: title, artist, date, museum, link
- Images: HD URL and local path
- Explanations: "comment_comprendre" and "ce_quil_faut_voir"
- Techniques: list of specific artistic techniques

## 🎨 Customization

### Colors
Colors are defined in `:root` of `style.css`:
```css
--color-bg: #f8f7f4;
--color-accent: #2c3e50;
--color-text: #1a1a1a;
/* ... */
```

### Animations
Zoom and transition parameters can be adjusted in `style.css`:
- Upscaling threshold: `ZOOM_THRESHOLD_FOR_UPSCALE = 2.0`
- Maximum zoom: `Math.min(16, ...)`
- Ken Burns animation durations

## 📝 License

This project is based on the book "Les Yeux de Mona" by Thomas Schlesser.

## 🙏 Acknowledgments

- **Thomas Schlesser** for the book "Les Yeux de Mona"
- **Partner Museums**: Louvre, Musée d'Orsay, Centre Pompidou
- HD images provided by respective museums

## 🔗 Links

- [GitHub Repository](https://github.com/nmarchand73/Les-Yeux-de-Mona)
- [Book "Les Yeux de Mona"](https://www.martinpaquin.com/liens-des-oeuvres-cites-dans-le-livre-les-yeux-de-mona-par-thomas-schlesser/)

---

*Developed with passion for art exploration* 🎨
