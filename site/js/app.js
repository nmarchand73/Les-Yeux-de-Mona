// Main application logic

let currentView = 'gallery';
let filteredArtworks = [];

/**
 * Initialize the application when data is ready
 */
function initializeApp() {
    initializeFilters();
    renderGallery();
    setupEventListeners();
}

// Initialize - wait for data to load
document.addEventListener('DOMContentLoaded', () => {
    // Wait for artworks data to be loaded
    window.addEventListener('artworksDataLoaded', initializeApp);
    
    // If data is already loaded (race condition)
    if (allArtworks.length > 0) {
        initializeApp();
    }
});

/**
 * Set up all event listeners for user interactions
 */
function setupEventListeners() {
    // View toggle
    document.querySelectorAll('.btn-view').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const view = e.currentTarget.dataset.view;
            switchView(view);
        });
    });
    
    // Search
    document.getElementById('search').addEventListener('input', () => {
        filterArtworks();
    });
    
    // Museum filter
    document.getElementById('filter-museum').addEventListener('change', () => {
        filterArtworks();
    });
    
    // Artist filter
    document.getElementById('filter-artist').addEventListener('change', () => {
        filterArtworks();
    });
    
    // Technique filter
    document.getElementById('filter-technique').addEventListener('change', () => {
        filterArtworks();
    });
}

/**
 * Populate filter dropdowns with available museums, artists, and techniques
 */
function initializeFilters() {
    const museumSelect = document.getElementById('filter-museum');
    const artistSelect = document.getElementById('filter-artist');
    const techniqueSelect = document.getElementById('filter-technique');
    
    /**
     * Helper function to populate a select dropdown with options
     * @param {HTMLSelectElement} selectElement - The select element to populate
     * @param {string[]} values - Array of values to add as options
     */
    const populateSelect = (selectElement, values) => {
        values.forEach(value => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = value;
            selectElement.appendChild(option);
        });
    };
    
    // Populate filter dropdowns
    populateSelect(museumSelect, filterData.museums);
    populateSelect(artistSelect, filterData.artists);
    populateSelect(techniqueSelect, filterData.techniques);
}

/**
 * Switch between gallery, timeline, and 3D views
 * @param {string} view - The view to switch to ('gallery', 'timeline', or '3d')
 */
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

/**
 * Ensure filtered artworks array is populated before rendering
 */
function ensureFilteredArtworks() {
    if (filteredArtworks.length === 0) {
        filterArtworks();
    }
}

/**
 * Render an empty state message when no artworks match the filters
 * @param {HTMLElement} container - The container element to render the message in
 */
function renderEmptyState(container) {
    container.innerHTML = '<div class="empty-state"><h2>Aucune œuvre trouvée</h2><p>Essayez de modifier vos filtres de recherche.</p></div>';
}

/**
 * Filter artworks based on search term and selected filters
 * Updates filteredArtworks array and re-renders the current view
 */
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
        // 3D view is handled by open3DGallery
    }
}

/**
 * Render the gallery grid view with filtered artworks
 */
function renderGallery() {
    ensureFilteredArtworks();
    
    const grid = document.getElementById('artworks-grid');
    
    if (filteredArtworks.length === 0) {
        renderEmptyState(grid);
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

/**
 * Render the timeline view with artworks sorted by date
 */
function renderTimeline() {
    ensureFilteredArtworks();
    
    const container = document.getElementById('timeline-container');
    
    if (filteredArtworks.length === 0) {
        renderEmptyState(container);
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

/**
 * Extract year from a date string (handles various date formats)
 * @param {string} dateStr - Date string that may contain a year
 * @returns {number} The extracted year, or 0 if no year found
 */
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

/**
 * Open the 3D gallery view in a new tab with filtered artworks
 */
function open3DGallery() {
    ensureFilteredArtworks();
    
    if (filteredArtworks.length === 0) {
        const container = document.getElementById('3d-container');
        if (container) {
            renderEmptyState(container);
        }
        return;
    }
    
    // Pass only artwork IDs (much shorter)
    const artworkIds = filteredArtworks.map(artwork => artwork.id);
    
    // Encode IDs in base64 to reduce size
    const encodedIds = encodeURIComponent(JSON.stringify(artworkIds));
    
    // Open 3D gallery in a new tab
    window.open(`gallery3d-multi.html?ids=${encodedIds}`, '_blank');
}

