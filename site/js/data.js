// Artworks data for the website
// Data is loaded from a single merged JSON file

let artworksData = {};
let allArtworks = [];
let filterData = {
    museums: ["Louvre", "Orsay", "Beaubourg", "Hudson River School"],
    artists: [],
    techniques: []
};

/**
 * Loads artworks data from JSON file and processes it into filterable arrays
 * Populates allArtworks, filterData.artists, and filterData.techniques
 * @async
 * @returns {Promise<void>}
 */
async function loadArtworksData() {
    try {
        // Load merged artworks data
        const response = await fetch('data/artworks.json');
        const data = await response.json();
        
        // Process data
        artworksData = data;
        allArtworks = [];
        const artistsSet = new Set();
        const techniquesSet = new Set();
        
        for (const museum in data) {
            for (const artwork of data[museum]) {
                allArtworks.push(artwork);
                artistsSet.add(artwork.artiste);
                
                // Extract all techniques
                if (artwork.techniques && Array.isArray(artwork.techniques)) {
                    artwork.techniques.forEach(technique => techniquesSet.add(technique));
                }
            }
        }
        
        // Update filter data
        filterData.artists = Array.from(artistsSet).sort();
        filterData.techniques = Array.from(techniquesSet).sort();
        
        // Trigger data loaded event
        window.dispatchEvent(new CustomEvent('artworksDataLoaded'));
        
    } catch (error) {
        console.error('Error loading artworks data:', error);
    }
}

// Initialize data loading
loadArtworksData();
