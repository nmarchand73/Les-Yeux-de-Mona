// Main application logic

let currentView = 'gallery';
let filteredArtworks = [];

// Initialize - wait for data to load
document.addEventListener('DOMContentLoaded', () => {
    // Wait for artworks data to be loaded
    window.addEventListener('artworksDataLoaded', () => {
        initializeFilters();
        renderGallery();
        setupEventListeners();
    });
    
    // If data is already loaded (race condition)
    if (allArtworks.length > 0) {
        initializeFilters();
        renderGallery();
        setupEventListeners();
    }
});

// Setup event listeners
function setupEventListeners() {
    // View toggle
    document.querySelectorAll('.btn-view').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const view = e.currentTarget.dataset.view;
            switchView(view);
        });
    });
    
    // Search
    document.getElementById('search').addEventListener('input', (e) => {
        filterArtworks();
    });
    
    // Museum filter
    document.getElementById('filter-museum').addEventListener('change', (e) => {
        filterArtworks();
    });
    
    // Artist filter
    document.getElementById('filter-artist').addEventListener('change', (e) => {
        filterArtworks();
    });
    
    // Technique filter
    document.getElementById('filter-technique').addEventListener('change', (e) => {
        filterArtworks();
    });
}

// Initialize filter dropdowns
function initializeFilters() {
    const museumSelect = document.getElementById('filter-museum');
    const artistSelect = document.getElementById('filter-artist');
    const techniqueSelect = document.getElementById('filter-technique');
    
    // Populate museums
    filterData.museums.forEach(museum => {
        const option = document.createElement('option');
        option.value = museum;
        option.textContent = museum;
        museumSelect.appendChild(option);
    });
    
    // Populate artists
    filterData.artists.forEach(artist => {
        const option = document.createElement('option');
        option.value = artist;
        option.textContent = artist;
        artistSelect.appendChild(option);
    });
    
    // Populate techniques
    filterData.techniques.forEach(technique => {
        const option = document.createElement('option');
        option.value = technique;
        option.textContent = technique;
        techniqueSelect.appendChild(option);
    });
}

// Switch view
function switchView(view) {
    currentView = view;
    
    // Update buttons
    document.querySelectorAll('.btn-view').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });
    
    // Update views
    document.getElementById('gallery-view').classList.toggle('active', view === 'gallery');
    document.getElementById('timeline-view').classList.toggle('active', view === 'timeline');
    const view3d = document.getElementById('3d-view');
    if (view3d) {
        view3d.classList.toggle('active', view === '3d');
    }
    
    // Render appropriate view
    if (view === 'gallery') {
        renderGallery();
    } else if (view === 'timeline') {
        renderTimeline();
    } else if (view === '3d') {
        open3DGallery();
    }
}

// Filter artworks
function filterArtworks() {
    const searchTerm = document.getElementById('search').value.toLowerCase();
    const museumFilter = document.getElementById('filter-museum').value;
    const artistFilter = document.getElementById('filter-artist').value;
    const techniqueFilter = document.getElementById('filter-technique').value;
    
    filteredArtworks = allArtworks.filter(artwork => {
        const matchesSearch = !searchTerm || 
            artwork.titre.toLowerCase().includes(searchTerm) ||
            artwork.artiste.toLowerCase().includes(searchTerm);
        
        const matchesMuseum = !museumFilter || artwork.musee === museumFilter;
        const matchesArtist = !artistFilter || artwork.artiste === artistFilter;
        
        const matchesTechnique = !techniqueFilter || 
            (artwork.techniques && artwork.techniques.includes(techniqueFilter));
        
        return matchesSearch && matchesMuseum && matchesArtist && matchesTechnique;
    });
    
    if (currentView === 'gallery') {
        renderGallery();
    } else if (currentView === 'timeline') {
        renderTimeline();
    } else if (currentView === '3d') {
        // La vue 3D est gérée par open3DGallery
    }
}

// Render gallery view
function renderGallery() {
    if (filteredArtworks.length === 0) {
        filterArtworks(); // Initial filter
    }
    
    const grid = document.getElementById('artworks-grid');
    
    if (filteredArtworks.length === 0) {
        grid.innerHTML = '<div class="empty-state"><h2>Aucune œuvre trouvée</h2><p>Essayez de modifier vos filtres de recherche.</p></div>';
        return;
    }
    
    grid.innerHTML = filteredArtworks.map(artwork => `
        <a href="oeuvre.html?id=${artwork.id}" class="artwork-card">
            <div class="artwork-image-container">
                <img src="../${artwork.image_hd_local}" alt="${artwork.titre}" class="artwork-image" loading="lazy">
            </div>
            <div class="artwork-info">
                <h3 class="artwork-title">${artwork.titre}</h3>
                <p class="artwork-artist">${artwork.artiste}</p>
                <p class="artwork-date">${artwork.date}</p>
                <span class="artwork-museum">${artwork.musee}</span>
            </div>
        </a>
    `).join('');
}

// Render timeline view
function renderTimeline() {
    if (filteredArtworks.length === 0) {
        filterArtworks(); // Initial filter
    }
    
    const container = document.getElementById('timeline-container');
    
    if (filteredArtworks.length === 0) {
        container.innerHTML = '<div class="empty-state"><h2>Aucune œuvre trouvée</h2><p>Essayez de modifier vos filtres de recherche.</p></div>';
        return;
    }
    
    // Sort by date (extract year for sorting)
    const sorted = [...filteredArtworks].sort((a, b) => {
        const yearA = extractYear(a.date);
        const yearB = extractYear(b.date);
        return yearA - yearB;
    });
    
    container.innerHTML = `
        <div class="timeline-line"></div>
        ${sorted.map((artwork, index) => `
            <div class="timeline-item">
                <div class="timeline-year">${extractYear(artwork.date)}</div>
                <a href="oeuvre.html?id=${artwork.id}" class="timeline-content">
                    <img src="../${artwork.image_hd_local}" alt="${artwork.titre}" class="timeline-image" loading="lazy">
                    <h3 class="artwork-title">${artwork.titre}</h3>
                    <p class="artwork-artist">${artwork.artiste}</p>
                    <p class="artwork-date">${artwork.date}</p>
                    <span class="artwork-museum">${artwork.musee}</span>
                </a>
            </div>
        `).join('')}
    `;
}

// Extract year from date string
function extractYear(dateStr) {
    const match = dateStr.match(/\d{4}/);
    if (match) {
        return parseInt(match[0]);
    }
    // Try to find any 4-digit number
    const numbers = dateStr.match(/\d+/g);
    if (numbers && numbers.length > 0) {
        return parseInt(numbers[0]);
    }
    return 0;
}

// Open 3D Gallery with filtered artworks
function open3DGallery() {
    if (filteredArtworks.length === 0) {
        filterArtworks(); // Initial filter
    }
    
    if (filteredArtworks.length === 0) {
        const container = document.getElementById('3d-container');
        if (container) {
            container.innerHTML = '<div class="empty-state"><h2>Aucune œuvre trouvée</h2><p>Essayez de modifier vos filtres de recherche.</p></div>';
        }
        return;
    }
    
    // Passer uniquement les IDs des œuvres (beaucoup plus court)
    const artworkIds = filteredArtworks.map(artwork => artwork.id);
    
    // Encoder les IDs en base64 pour réduire la taille
    const encodedIds = encodeURIComponent(JSON.stringify(artworkIds));
    
    // Ouvrir la galerie 3D dans un nouvel onglet
    window.open(`gallery3d-multi.html?ids=${encodedIds}`, '_blank');
}

