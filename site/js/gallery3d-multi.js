import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RectAreaLightHelper } from 'three/addons/helpers/RectAreaLightHelper.js';

// Variables globales
let scene, camera, renderer, controls;
let paintings = []; // Tableau pour stocker tous les tableaux
let paintingFrames = []; // Tableau pour stocker tous les cadres
let currentPaintingIndex = 0; // Index du tableau actuellement affiché
let mainLight, fillLight, backLight;
let lightHelpers = [];
let spotLights = [];
let spotHelpers = [];
let ambientLight = null;
let spotOnlyMode = false;
let currentLightConfigName = 'gallery-spots';
let directionalLight = null;
let areaLight = null;
let animationEnabled = false;
let animationTime = 0;
let artworksData = []; // Données des œuvres à afficher

// Configurations d'éclairage (réutilisées depuis gallery3d.js)
const lightConfigurations = {
    'gallery-spots': {
        name: 'Galerie spots',
        spots: {
            enabled: true,
            count: 3,
            colorTemperature: 0xfff4e5,
            defaultIntensity: 1.0,
            spacing: 0.8,
            distanceFromWall: 0.6,
            angle: 30 * Math.PI / 180,
            beamAngle: 40 * Math.PI / 180,
            distance: 20,
            penumbra: 0.3,
            decay: 1.5
        },
        ambientLight: {
            enabled: true,
            color: 0xffffff,
            intensity: 0.8 // Intensité augmentée pour que les murs blancs soient bien visibles
        },
        fillLight: {
            enabled: true,
            type: 'point',
            color: 0xffffff,
            intensity: 0.4,
            position: { x: 0, y: 5, z: 0 }
        },
        directionalLight: {
            enabled: false
        },
        areaLight: {
            enabled: false
        }
    },
    'daylight': {
        name: 'Lumière du jour',
        spots: {
            enabled: false
        },
        ambientLight: {
            enabled: false
        },
        fillLight: {
            enabled: false
        },
        directionalLight: {
            enabled: false
        },
        areaLight: {
            enabled: true,
            color: 0xe6f0ff,
            intensity: 4.0,
            width: 2.5,
            height: 3.5,
            position: { x: -7.4, y: 2.5, z: 0 }
        }
    },
    'corner-spots': {
        name: 'Spots aux coins',
        spots: {
            enabled: true,
            count: 2,
            colorTemperature: 0xfff4e5,
            defaultIntensity: 1.2,
            spacing: 0,
            distanceFromWall: 0.4,
            angle: 25 * Math.PI / 180,
            beamAngle: 30 * Math.PI / 180,
            distance: 15,
            penumbra: 0.2,
            decay: 1.5
        },
        ambientLight: {
            enabled: false
        },
        fillLight: {
            enabled: false
        },
        directionalLight: {
            enabled: false
        },
        areaLight: {
            enabled: false
        }
    },
    'show': {
        name: 'Spectacle animé',
        spots: {
            enabled: true,
            count: 3,
            colorTemperature: 0xfff4e5,
            defaultIntensity: 0.3,
            spacing: 0.8,
            distanceFromWall: 0.6,
            angle: 30 * Math.PI / 180,
            beamAngle: 40 * Math.PI / 180,
            distance: 20,
            penumbra: 0.3,
            decay: 1.5,
            animated: true
        },
        ambientLight: {
            enabled: true,
            color: 0xffffff,
            intensity: 0.3
        },
        fillLight: {
            enabled: true,
            type: 'point',
            color: 0xffffff,
            intensity: 0.8,
            position: { x: 0, y: 4.5, z: -6.5 }
        },
        directionalLight: {
            enabled: false
        },
        areaLight: {
            enabled: false
        }
    }
};

// Fonction pour récupérer les IDs depuis l'URL
function getArtworkIds() {
    const params = new URLSearchParams(window.location.search);
    const idsParam = params.get('ids');
    
    if (idsParam) {
        try {
            return JSON.parse(decodeURIComponent(idsParam));
        } catch (e) {
            console.error('Erreur lors du parsing des IDs:', e);
            return [];
        }
    }
    return [];
}

// Fonction pour charger les données des œuvres depuis le JSON
async function loadArtworksData() {
    try {
        // Le JSON est dans site/data/artworks.json, depuis gallery3d-multi.html dans site/
        const response = await fetch('data/artworks.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        // Flatten les données de tous les musées
        const allArtworks = [];
        for (const museum in data) {
            for (const artwork of data[museum]) {
                allArtworks.push(artwork);
            }
        }
        
        return allArtworks;
    } catch (error) {
        console.error('Erreur lors du chargement des données:', error);
        return [];
    }
}

// Fonction pour récupérer les œuvres filtrées par IDs
async function getFilteredArtworks() {
    const ids = getArtworkIds();
    if (ids.length === 0) {
        return [];
    }
    
    const allArtworks = await loadArtworksData();
    
    // Filtrer les œuvres selon les IDs et mapper les données
    return allArtworks.filter(artwork => ids.includes(artwork.id)).map(artwork => ({
        id: artwork.id,
        image: artwork.image_hd_local, // Chemin relatif depuis site/ (ex: "images/louvre/...")
        title: artwork.titre,
        artist: artwork.artiste,
        height: artwork.dimensions?.hauteur || null,
        width: artwork.dimensions?.largeur || null
    }));
}

// Fonction pour créer un helper de lumière
function createLightHelper(light) {
    const helperGroup = new THREE.Group();
    
    if (light.type === 'SpotLight') {
        const coneLength = light.distance || 5;
        const coneGeometry = new THREE.ConeGeometry(
            Math.tan(light.angle) * coneLength,
            coneLength,
            16,
            1,
            true
        );
        const coneMaterial = new THREE.MeshBasicMaterial({
            color: light.color,
            opacity: 0.2,
            transparent: true,
            wireframe: true,
            side: THREE.DoubleSide
        });
        const cone = new THREE.Mesh(coneGeometry, coneMaterial);
        cone.rotation.x = Math.PI;
        helperGroup.add(cone);
        
        const sphereGeometry = new THREE.SphereGeometry(0.15, 16, 16);
        const sphereMaterial = new THREE.MeshBasicMaterial({
            color: light.color,
            opacity: 0.6,
            transparent: true
        });
        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        helperGroup.add(sphere);
    } else if (light.type === 'RectAreaLight') {
        const helper = new RectAreaLightHelper(light);
        helperGroup.add(helper);
    }
    
    return helperGroup;
}

// Fonction pour créer une texture de parquet
function createParquetTexture() {
    const size = 512;
    const tileSize = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    
    const baseColor = '#c9a961';
    const darkColor = '#b8954f';
    const lightColor = '#d4b873';
    
    context.fillStyle = baseColor;
    context.fillRect(0, 0, size, size);
    
    context.strokeStyle = darkColor;
    context.lineWidth = 1;
    
    for (let y = 0; y < size; y += tileSize) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(size, y);
        context.stroke();
        
        for (let x = 0; x < size; x += tileSize) {
            const isDark = ((x / tileSize) + (y / tileSize)) % 2 === 0;
            context.fillStyle = isDark ? darkColor : lightColor;
            context.fillRect(x, y, tileSize, tileSize);
        }
    }
    
    for (let x = 0; x < size; x += tileSize) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, size);
        context.stroke();
    }
    
    const imageData = context.getImageData(0, 0, size, size);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 10;
        data[i] = Math.max(0, Math.min(255, data[i] + noise));
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
    }
    context.putImageData(imageData, 0, 0);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 4);
    texture.needsUpdate = true;
    
    return texture;
}

// Fonction pour créer le sol de la galerie
function createGalleryFloor() {
    const floorGeometry = new THREE.PlaneGeometry(60, 50); // Sol adapté à la taille de la salle agrandie
    const floorTexture = createParquetTexture();
    
    const floorMaterial = new THREE.MeshStandardMaterial({
        map: floorTexture,
        color: 0xd4c4b0,
        roughness: 0.75,
        metalness: 0.0,
        envMapIntensity: 0.3,
        flatShading: false
    });
    
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2;
    floor.receiveShadow = true;
    return floor;
}

// Fonction pour créer une texture de mur avec relief et nuances
function createWallTexture() {
    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    
    // Base blanche
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, size, size);
    
    // Ajouter des variations plus visibles de couleur (nuances de blanc/gris clair)
    const imageData = context.getImageData(0, 0, size, size);
    const data = imageData.data;
    
    // Créer un bruit de Perlin simplifié pour des variations plus naturelles
    for (let i = 0; i < data.length; i += 4) {
        const x = (i / 4) % size;
        const y = Math.floor((i / 4) / size);
        
        // Créer des variations avec un pattern plus visible
        const noise1 = Math.sin(x * 0.01) * Math.cos(y * 0.01) * 5;
        const noise2 = (Math.random() - 0.5) * 12;
        const noise = noise1 + noise2;
        const baseColor = 250;
        const color = Math.max(235, Math.min(255, baseColor + noise));
        
        data[i] = color;     // R
        data[i + 1] = color; // G
        data[i + 2] = color; // B
        data[i + 3] = 255;   // A
    }
    
    context.putImageData(imageData, 0, 0);
    
    // Ajouter des motifs plus visibles pour simuler le relief et les imperfections
    context.globalAlpha = 0.08;
    for (let i = 0; i < 100; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const radius = 30 + Math.random() * 50;
        
        const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0.15)');
        gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.05)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        context.fillStyle = gradient;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
    }
    
    // Ajouter des lignes subtiles pour simuler les joints de plâtre
    context.globalAlpha = 0.05;
    context.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    context.lineWidth = 1;
    for (let y = 0; y < size; y += 200) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(size, y);
        context.stroke();
    }
    
    context.globalAlpha = 1.0;
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3, 3); // Répéter la texture sur les murs
    texture.needsUpdate = true;
    
    return texture;
}

// Fonction pour créer une normal map pour le relief des murs
function createWallNormalMap() {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    
    // Base pour normal map (RGB = 128, 128, 255 = surface plate)
    context.fillStyle = 'rgb(128, 128, 255)';
    context.fillRect(0, 0, size, size);
    
    const imageData = context.getImageData(0, 0, size, size);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
        const x = (i / 4) % size;
        const y = Math.floor((i / 4) / size);
        
        // Créer des variations plus prononcées pour le relief
        const noise1 = Math.sin(x * 0.05) * Math.cos(y * 0.05) * 8;
        const noise2 = (Math.random() - 0.5) * 15;
        const noise = noise1 + noise2;
        
        const baseR = 128;
        const baseG = 128;
        const baseB = 255;
        
        data[i] = Math.max(115, Math.min(140, baseR + noise));     // R
        data[i + 1] = Math.max(115, Math.min(140, baseG + noise)); // G
        data[i + 2] = Math.max(245, Math.min(255, baseB));         // B
        data[i + 3] = 255;                                          // A
    }
    
    context.putImageData(imageData, 0, 0);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3, 3);
    texture.needsUpdate = true;
    
    return texture;
}

// Fonction pour créer une roughness map pour les murs
function createWallRoughnessMap() {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    
    // Base de rugosité moyenne
    const baseRoughness = 140;
    context.fillStyle = `rgb(${baseRoughness}, ${baseRoughness}, ${baseRoughness})`;
    context.fillRect(0, 0, size, size);
    
    const imageData = context.getImageData(0, 0, size, size);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
        const roughnessVariation = (Math.random() - 0.5) * 20;
        const roughness = Math.max(130, Math.min(150, baseRoughness + roughnessVariation));
        
        data[i] = roughness;
        data[i + 1] = roughness;
        data[i + 2] = roughness;
        data[i + 3] = 255;
    }
    
    context.putImageData(imageData, 0, 0);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2);
    texture.needsUpdate = true;
    
    return texture;
}

// Fonction pour créer les murs de la galerie
function createGalleryWalls() {
    const wallGroup = new THREE.Group();
    
    // Créer les textures pour les murs
    const wallTexture = createWallTexture();
    const wallNormalMap = createWallNormalMap();
    const wallRoughnessMap = createWallRoughnessMap();
    
    // Matériau avec textures pour un rendu naturel
    const wallMaterial = new THREE.MeshStandardMaterial({
        map: wallTexture,
        normalMap: wallNormalMap,
        normalScale: new THREE.Vector2(0.6, 0.6), // Relief plus visible
        roughnessMap: wallRoughnessMap,
        color: 0xffffff, // Blanc pur pour les murs de galerie
        roughness: 0.75,
        metalness: 0.0,
        envMapIntensity: 0.1,
        flatShading: false
    });
    
    const wallHeight = 8;
    const roomWidth = 60; // Largeur de la salle (encore agrandie)
    const roomDepth = 50; // Profondeur de la salle (encore agrandie)
    
    // Mur arrière
    const backWall = new THREE.Mesh(
        new THREE.PlaneGeometry(roomWidth, wallHeight),
        wallMaterial
    );
    backWall.position.set(0, wallHeight / 2 - 2, -roomDepth / 2);
    backWall.receiveShadow = true;
    backWall.castShadow = false;
    wallGroup.add(backWall);
    
    // Mur gauche
    const leftWall = new THREE.Mesh(
        new THREE.PlaneGeometry(roomDepth, wallHeight),
        wallMaterial
    );
    leftWall.position.set(-roomWidth / 2, wallHeight / 2 - 2, 0);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.receiveShadow = true;
    leftWall.castShadow = false;
    wallGroup.add(leftWall);
    
    // Mur droit
    const rightWall = new THREE.Mesh(
        new THREE.PlaneGeometry(roomDepth, wallHeight),
        wallMaterial
    );
    rightWall.position.set(roomWidth / 2, wallHeight / 2 - 2, 0);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.receiveShadow = true;
    rightWall.castShadow = false;
    wallGroup.add(rightWall);
    
    // Mur avant
    const frontWall = new THREE.Mesh(
        new THREE.PlaneGeometry(roomWidth, wallHeight),
        wallMaterial
    );
    frontWall.position.set(0, wallHeight / 2 - 2, roomDepth / 2);
    frontWall.rotation.y = Math.PI; // Face vers l'intérieur de la salle
    frontWall.receiveShadow = true;
    frontWall.castShadow = false;
    wallGroup.add(frontWall);
    
    return wallGroup;
}

// Fonction pour créer une texture d'environnement
function createEnvironmentMap() {
    // Créer une texture d'environnement équirectangulaire haute résolution
    // qui simule fidèlement l'environnement de la galerie (murs, plafond, sol, lumières)
    const size = 512; // Résolution augmentée pour plus de détails
    const canvas = document.createElement('canvas');
    canvas.width = size * 2; // Format équirectangulaire : 2:1
    canvas.height = size;
    const context = canvas.getContext('2d');
    
    // Couleurs de l'environnement
    const wallColor = '#f5f5f0'; // Murs (blanc cassé musée)
    const ceilingColor = '#fafafa'; // Plafond (plus clair)
    const floorColor = '#c9a961'; // Sol (parquet)
    const lightColor = '#fff8e6'; // Couleur des spots (4000K)
    
    // Remplir avec la couleur de base (murs)
    context.fillStyle = wallColor;
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Dessiner le sol (partie inférieure de l'image équirectangulaire)
    const floorStart = size * 0.6; // Le sol commence à 60% de la hauteur
    const floorGradient = context.createLinearGradient(0, floorStart, 0, size);
    floorGradient.addColorStop(0, wallColor);
    floorGradient.addColorStop(0.3, '#d4b873'); // Transition
    floorGradient.addColorStop(1, floorColor);
    context.fillStyle = floorGradient;
    context.fillRect(0, floorStart, canvas.width, size - floorStart);
    
    // Ajouter un motif de parquet subtil dans le reflet du sol
    context.strokeStyle = '#b8954f';
    context.lineWidth = 0.5;
    const tileSize = 20;
    for (let x = 0; x < canvas.width; x += tileSize) {
        context.beginPath();
        context.moveTo(x, floorStart);
        context.lineTo(x, size);
        context.stroke();
    }
    for (let y = floorStart; y < size; y += tileSize) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(canvas.width, y);
        context.stroke();
    }
    
    // Dessiner le plafond (partie supérieure)
    const ceilingEnd = size * 0.15; // Le plafond occupe les 15% supérieurs
    const ceilingGradient = context.createLinearGradient(0, 0, 0, ceilingEnd);
    ceilingGradient.addColorStop(0, ceilingColor);
    ceilingGradient.addColorStop(1, wallColor);
    context.fillStyle = ceilingGradient;
    context.fillRect(0, 0, canvas.width, ceilingEnd);
    
    // Ajouter les spots lumineux au plafond (reflets des lumières)
    // Utiliser le nombre réel de spots si disponible, sinon 3 par défaut
    const numSpots = spotLights.length > 0 ? spotLights.length : 3;
    const spotSpacing = canvas.width / (numSpots + 1);
    for (let i = 1; i <= numSpots; i++) {
        const spotX = i * spotSpacing;
        const spotY = ceilingEnd * 0.5;
        
        // Cône de lumière des spots - plus intense et visible
        const lightGradient = context.createRadialGradient(spotX, spotY, 0, spotX, spotY, 120);
        lightGradient.addColorStop(0, '#ffffff'); // Centre blanc pur pour reflets intenses
        lightGradient.addColorStop(0.2, lightColor);
        lightGradient.addColorStop(0.4, '#fff4e6');
        lightGradient.addColorStop(0.7, '#f5f5f0');
        lightGradient.addColorStop(1, 'transparent');
        
        context.fillStyle = lightGradient;
        context.beginPath();
        context.arc(spotX, spotY, 120, 0, Math.PI * 2);
        context.fill();
        
        // Point lumineux central - plus grand et plus visible
        context.fillStyle = '#ffffff';
        context.beginPath();
        context.arc(spotX, spotY, 8, 0, Math.PI * 2);
        context.fill();
        
        // Halo lumineux autour du point central
        const haloGradient = context.createRadialGradient(spotX, spotY, 0, spotX, spotY, 20);
        haloGradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
        haloGradient.addColorStop(1, 'transparent');
        context.fillStyle = haloGradient;
        context.beginPath();
        context.arc(spotX, spotY, 20, 0, Math.PI * 2);
        context.fill();
    }
    
    // Ajouter des reflets subtils des murs latéraux
    // Côtés gauche et droit (dans une projection équirectangulaire)
    const sideGradient = context.createLinearGradient(0, 0, canvas.width, 0);
    sideGradient.addColorStop(0, '#e8e8e3'); // Mur gauche (plus sombre)
    sideGradient.addColorStop(0.25, wallColor);
    sideGradient.addColorStop(0.75, wallColor);
    sideGradient.addColorStop(1, '#e8e8e3'); // Mur droit (plus sombre)
    
    context.fillStyle = sideGradient;
    context.globalAlpha = 0.3;
    context.fillRect(0, ceilingEnd, canvas.width, floorStart - ceilingEnd);
    context.globalAlpha = 1.0;
    
    // Ajouter des variations subtiles de lumière (fenêtres, éclairage naturel)
    const windowGradient = context.createLinearGradient(canvas.width * 0.3, 0, canvas.width * 0.7, 0);
    windowGradient.addColorStop(0, 'transparent');
    windowGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)'); // Fenêtre lumineuse
    windowGradient.addColorStop(1, 'transparent');
    
    context.fillStyle = windowGradient;
    context.fillRect(0, ceilingEnd, canvas.width, (floorStart - ceilingEnd) * 0.5);
    
    // Ajouter un peu de grain/texture pour plus de réalisme
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 3; // Grain très subtil
        data[i] = Math.max(0, Math.min(255, data[i] + noise));     // R
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise)); // G
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise)); // B
    }
    context.putImageData(imageData, 0, 0);
    
    // Convertir en texture avec mapping équirectangulaire
    const texture = new THREE.CanvasTexture(canvas);
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.needsUpdate = true;
    
    return texture;
}

// Fonction pour créer une normal map de grain de toile
function createCanvasNormalMap() {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    
    const threadSize = 3;
    const threadSpacing = 5;
    
    context.fillStyle = 'rgb(128, 128, 255)';
    context.fillRect(0, 0, size, size);
    
    for (let y = 0; y < size; y += threadSpacing) {
        context.fillStyle = 'rgb(100, 100, 255)';
        context.fillRect(0, y, size, threadSize);
    }
    
    for (let x = 0; x < size; x += threadSpacing) {
        context.fillStyle = 'rgb(100, 100, 255)';
        context.fillRect(x, 0, threadSize, size);
    }
    
    const imageData = context.getImageData(0, 0, size, size);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 15;
        data[i] = Math.max(0, Math.min(255, data[i] + noise));
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
        data[i + 2] = Math.max(180, Math.min(255, data[i + 2] + noise * 0.8));
    }
    
    context.putImageData(imageData, 0, 0);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2);
    texture.needsUpdate = true;
    
    return texture;
}

// Fonction pour créer une texture de rugosité
function createCanvasRoughnessMap() {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    
    const baseRoughness = 128;
    context.fillStyle = `rgb(${baseRoughness}, ${baseRoughness}, ${baseRoughness})`;
    context.fillRect(0, 0, size, size);
    
    const imageData = context.getImageData(0, 0, size, size);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
        const roughnessVariation = (Math.random() - 0.5) * 15;
        const roughness = Math.max(100, Math.min(155, baseRoughness + roughnessVariation));
        
        data[i] = roughness;
        data[i + 1] = roughness;
        data[i + 2] = roughness;
        data[i + 3] = 255;
    }
    
    context.putImageData(imageData, 0, 0);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2);
    texture.needsUpdate = true;
    
    return texture;
}

// Styles de cadres réalistes
const frameStyles = {
    classic_gold: {
        color: 0xd4af37, // Or classique
        roughness: 0.3,
        metalness: 0.8,
        envMapIntensity: 0.5,
        depth: 0.12,
        name: 'Classique doré'
    },
    dark_wood: {
        color: 0x3d2817, // Bois foncé
        roughness: 0.8,
        metalness: 0.0,
        envMapIntensity: 0.2,
        depth: 0.1,
        name: 'Bois foncé'
    },
    light_wood: {
        color: 0xd4a574, // Bois clair
        roughness: 0.7,
        metalness: 0.0,
        envMapIntensity: 0.2,
        depth: 0.1,
        name: 'Bois clair'
    },
    ornate_gold: {
        color: 0xffd700, // Or brillant
        roughness: 0.2,
        metalness: 0.9,
        envMapIntensity: 0.6,
        depth: 0.15,
        name: 'Orné doré'
    },
    black_modern: {
        color: 0x1a1a1a, // Noir moderne
        roughness: 0.4,
        metalness: 0.1,
        envMapIntensity: 0.3,
        depth: 0.08,
        name: 'Moderne noir'
    },
    mahogany: {
        color: 0x8b4513, // Acajou
        roughness: 0.6,
        metalness: 0.0,
        envMapIntensity: 0.25,
        depth: 0.12,
        name: 'Acajou'
    },
    silver: {
        color: 0xc0c0c0, // Argent
        roughness: 0.3,
        metalness: 0.7,
        envMapIntensity: 0.4,
        depth: 0.1,
        name: 'Argent'
    },
    walnut: {
        color: 0x5c4033, // Noyer
        roughness: 0.7,
        metalness: 0.0,
        envMapIntensity: 0.2,
        depth: 0.11,
        name: 'Noyer'
    }
};

// Fonction pour obtenir un style de cadre aléatoire ou basé sur l'index
function getFrameStyle(index) {
    const styleKeys = Object.keys(frameStyles);
    // Utiliser l'index pour avoir une distribution variée mais déterministe
    return frameStyles[styleKeys[index % styleKeys.length]];
}

// Fonction pour créer un cadre avec un style spécifique
function createFrame(width, height, style = null) {
    const frameGroup = new THREE.Group();
    
    // Si aucun style n'est fourni, utiliser un style par défaut
    if (!style) {
        style = frameStyles.dark_wood;
    }
    
    const depth = style.depth || 0.1;
    const frameMaterial = new THREE.MeshStandardMaterial({
        color: style.color,
        roughness: style.roughness,
        metalness: style.metalness,
        envMapIntensity: style.envMapIntensity
    });
    
    // Créer les 4 côtés du cadre
    const topFrame = new THREE.Mesh(
        new THREE.BoxGeometry(width + depth * 2, depth, depth),
        frameMaterial
    );
    topFrame.position.set(0, height / 2 + depth / 2, 0);
    topFrame.castShadow = true;
    topFrame.receiveShadow = true;
    frameGroup.add(topFrame);
    
    const bottomFrame = new THREE.Mesh(
        new THREE.BoxGeometry(width + depth * 2, depth, depth),
        frameMaterial
    );
    bottomFrame.position.set(0, -height / 2 - depth / 2, 0);
    bottomFrame.castShadow = true;
    bottomFrame.receiveShadow = true;
    frameGroup.add(bottomFrame);
    
    const leftFrame = new THREE.Mesh(
        new THREE.BoxGeometry(depth, height, depth),
        frameMaterial
    );
    leftFrame.position.set(-width / 2 - depth / 2, 0, 0);
    leftFrame.castShadow = true;
    leftFrame.receiveShadow = true;
    frameGroup.add(leftFrame);
    
    const rightFrame = new THREE.Mesh(
        new THREE.BoxGeometry(depth, height, depth),
        frameMaterial
    );
    rightFrame.position.set(width / 2 + depth / 2, 0, 0);
    rightFrame.castShadow = true;
    rightFrame.receiveShadow = true;
    frameGroup.add(rightFrame);
    
    // Pour les cadres ornés, ajouter des détails supplémentaires
    if (style.name === 'Orné doré') {
        // Ajouter des coins décoratifs
        const cornerDetail = new THREE.Mesh(
            new THREE.BoxGeometry(depth * 1.5, depth * 1.5, depth * 1.2),
            frameMaterial
        );
        
        // 4 coins
        const corners = [
            { x: -width / 2 - depth / 2, y: height / 2 + depth / 2 },
            { x: width / 2 + depth / 2, y: height / 2 + depth / 2 },
            { x: -width / 2 - depth / 2, y: -height / 2 - depth / 2 },
            { x: width / 2 + depth / 2, y: -height / 2 - depth / 2 }
        ];
        
        corners.forEach(corner => {
            const cornerMesh = cornerDetail.clone();
            cornerMesh.position.set(corner.x, corner.y, 0);
            frameGroup.add(cornerMesh);
        });
    }
    
    return frameGroup;
}

// Fonction pour charger un tableau
function loadPainting(artwork, position) {
    return new Promise((resolve, reject) => {
        const loader = new THREE.TextureLoader();
        // Les images sont dans images/ à la racine, gallery3d-multi.html est dans site/
        // Donc le chemin doit être ../images/...
        let imagePath = artwork.image;
        
        // Convertir le chemin depuis site/ vers la racine
        if (imagePath.startsWith('images/')) {
            imagePath = `../${imagePath}`;
        } else if (!imagePath.startsWith('../')) {
            imagePath = `../images/${imagePath}`;
        }
        
        console.log('Chargement de l\'image:', imagePath);
        
        loader.load(
            imagePath,
            (texture) => {
                texture.colorSpace = THREE.SRGBColorSpace;
                
                let width, height;
                
                if (artwork.height && artwork.width) {
                    height = parseFloat(artwork.height) / 100;
                    width = parseFloat(artwork.width) / 100;
                } else {
                    const maxWidth = 2.5;
                    const maxHeight = 2;
                    const imageAspect = texture.image.height / texture.image.width;
                    
                    if (imageAspect > maxHeight / maxWidth) {
                        height = maxHeight;
                        width = height / imageAspect;
                    } else {
                        width = maxWidth;
                        height = width * imageAspect;
                    }
                }
                
                const geometry = new THREE.PlaneGeometry(width, height);
                const canvasNormalMap = createCanvasNormalMap();
                const canvasRoughnessMap = createCanvasRoughnessMap();
                
                const frontMaterial = new THREE.MeshPhysicalMaterial({
                    map: texture,
                    normalMap: canvasNormalMap,
                    normalScale: new THREE.Vector2(0.8, 0.8),
                    roughnessMap: canvasRoughnessMap,
                    side: THREE.FrontSide,
                    roughness: 0.4,
                    metalness: 0.0,
                    clearcoat: 0.1,
                    clearcoatRoughness: 0.3,
                    clearcoatNormalMap: canvasNormalMap,
                    clearcoatNormalScale: new THREE.Vector2(0.5, 0.5),
                    reflectivity: 0.1,
                    envMapIntensity: 0.15,
                    ior: 1.5,
                    transmission: 0.0,
                    thickness: 0.0
                });
                
                const envMap = createEnvironmentMap();
                if (envMap) {
                    frontMaterial.envMap = envMap;
                }
                
                const backMaterial = new THREE.MeshStandardMaterial({
                    color: 0xd4c4b0,
                    roughness: 0.8,
                    metalness: 0.0,
                    side: THREE.FrontSide,
                    transparent: false,
                    opacity: 1.0
                });
                
                const paintingGroup = new THREE.Group();
                
                const frontPainting = new THREE.Mesh(geometry, frontMaterial);
                frontPainting.castShadow = true;
                frontPainting.receiveShadow = true;
                frontPainting.renderOrder = 1;
                paintingGroup.add(frontPainting);
                
                const backPainting = new THREE.Mesh(geometry, backMaterial);
                backPainting.rotation.y = Math.PI;
                backPainting.position.z = -0.02;
                backPainting.castShadow = true;
                backPainting.receiveShadow = true;
                backPainting.renderOrder = 0;
                paintingGroup.add(backPainting);
                
                // Positionner le tableau
                paintingGroup.position.set(position.x, position.y, position.z);
                if (position.rotation !== undefined) {
                    paintingGroup.rotation.y = position.rotation;
                }
                paintingGroup.userData.artwork = artwork;
                
                // Obtenir un style de cadre varié basé sur l'index de l'œuvre
                const artworkIndex = artworksData.findIndex(a => a.id === artwork.id);
                const frameStyle = getFrameStyle(artworkIndex !== -1 ? artworkIndex : Math.floor(Math.random() * 8));
                const frame = createFrame(width, height, frameStyle);
                frame.position.copy(paintingGroup.position);
                // Ajuster la position Z du cadre selon l'orientation
                if (position.rotation === Math.PI / 2) {
                    // Mur gauche : cadre légèrement à droite
                    frame.position.x = paintingGroup.position.x + 0.01;
                } else if (position.rotation === -Math.PI / 2) {
                    // Mur droit : cadre légèrement à gauche
                    frame.position.x = paintingGroup.position.x - 0.01;
                } else {
                    // Mur arrière : cadre légèrement devant
                    frame.position.z = paintingGroup.position.z - 0.01;
                }
                frame.rotation.copy(paintingGroup.rotation);
                
                // Stocker l'index de l'œuvre pour garantir la correspondance (artworkIndex déjà déclaré plus haut)
                if (artworkIndex !== -1 && artworkIndex < paintings.length) {
                    paintings[artworkIndex] = paintingGroup;
                    paintingFrames[artworkIndex] = frame;
                } else {
                    console.warn('Index non trouvé pour l\'œuvre:', artwork.id);
                    paintings.push(paintingGroup);
                    paintingFrames.push(frame);
                }
                
                scene.add(paintingGroup);
                scene.add(frame);
                
                resolve();
            },
            (progress) => {
                // Progression du chargement (optionnel)
            },
            (error) => {
                console.error('Erreur lors du chargement de l\'image:', imagePath, error);
                // Créer un tableau placeholder pour ne pas bloquer les autres
                const placeholderGeometry = new THREE.PlaneGeometry(2, 2);
                const placeholderMaterial = new THREE.MeshStandardMaterial({
                    color: 0x888888,
                    roughness: 0.8
                });
                const placeholder = new THREE.Mesh(placeholderGeometry, placeholderMaterial);
                placeholder.position.set(position.x, position.y, position.z);
                placeholder.userData.artwork = artwork;
                
                // Stocker l'index de l'œuvre pour garantir la correspondance
                const artworkIndex = artworksData.findIndex(a => a.id === artwork.id);
                if (artworkIndex !== -1 && artworkIndex < paintings.length) {
                    paintings[artworkIndex] = placeholder;
                } else {
                    console.warn('Index non trouvé pour l\'œuvre placeholder:', artwork.id);
                    paintings.push(placeholder);
                }
                
                scene.add(placeholder);
                resolve(); // Résoudre quand même pour ne pas bloquer les autres
            }
        );
    });
}

// Fonction pour positionner les tableaux sur les murs
function positionPaintings() {
    if (artworksData.length === 0) return;
    
    const roomWidth = 60;
    const roomDepth = 50;
    const paintingHeight = 1.5;
    const wallSpacing = 0.05; // Légèrement devant le mur
    const wallMargin = 3; // Marge depuis les coins des murs
    
    // Répartir les tableaux sur les 4 murs de manière équilibrée
    const totalPaintings = artworksData.length;
    const paintingsPerWall = Math.ceil(totalPaintings / 4);
    
    // Initialiser le tableau paintings avec la bonne taille
    paintings = new Array(totalPaintings).fill(null);
    paintingFrames = new Array(totalPaintings).fill(null);
    
    const promises = [];
    
    // Calculer l'espacement dynamique pour chaque mur selon le nombre de tableaux
    // Avec un espacement minimum réduit pour permettre plus de tableaux
    const calculateSpacing = (wallPaintings, wallLength) => {
        if (wallPaintings <= 1) return 0;
        const availableLength = wallLength - (wallMargin * 2);
        const minSpacing = 2; // Espacement minimum réduit entre les tableaux
        const calculatedSpacing = availableLength / (wallPaintings - 1);
        // Utiliser le maximum entre l'espacement calculé et l'espacement minimum
        return Math.max(calculatedSpacing, minSpacing);
    };
    
    artworksData.forEach((artwork, index) => {
        let position;
        const wallNumber = Math.floor(index / paintingsPerWall);
        const wallIndex = index % paintingsPerWall;
        
        if (wallNumber === 0) {
            // Mur arrière (de gauche à droite)
            const wallPaintings = Math.min(paintingsPerWall, totalPaintings);
            const wallLength = roomWidth;
            const spacing = calculateSpacing(wallPaintings, wallLength);
            const startX = -(wallLength / 2) + wallMargin;
            
            position = {
                x: startX + wallIndex * spacing,
                y: paintingHeight,
                z: -roomDepth / 2 + wallSpacing,
                rotation: 0 // Face vers l'intérieur de la salle
            };
        } else if (wallNumber === 1) {
            // Mur droit (de l'arrière vers l'avant)
            const remainingPaintings = totalPaintings - paintingsPerWall;
            const wallPaintings = Math.min(paintingsPerWall, remainingPaintings);
            const wallLength = roomDepth;
            const spacing = calculateSpacing(wallPaintings, wallLength);
            const startZ = -roomDepth / 2 + wallMargin;
            
            position = {
                x: roomWidth / 2 - wallSpacing,
                y: paintingHeight,
                z: startZ + wallIndex * spacing,
                rotation: -Math.PI / 2 // Rotation de -90° pour faire face à la salle
            };
        } else if (wallNumber === 2) {
            // Mur avant (de droite à gauche, face vers l'intérieur)
            const remainingPaintings = totalPaintings - (paintingsPerWall * 2);
            const wallPaintings = Math.min(paintingsPerWall, remainingPaintings);
            const wallLength = roomWidth;
            const spacing = calculateSpacing(wallPaintings, wallLength);
            const startX = (wallLength / 2) - wallMargin;
            
            position = {
                x: startX - wallIndex * spacing,
                y: paintingHeight,
                z: roomDepth / 2 - wallSpacing,
                rotation: Math.PI // Rotation de 180° pour faire face à la salle
            };
        } else {
            // Mur gauche (de l'avant vers l'arrière)
            const remainingPaintings = totalPaintings - (paintingsPerWall * 3);
            const wallPaintings = Math.min(paintingsPerWall, remainingPaintings);
            const wallLength = roomDepth;
            const spacing = calculateSpacing(wallPaintings, wallLength);
            const startZ = (roomDepth / 2) - wallMargin;
            
            position = {
                x: -roomWidth / 2 + wallSpacing,
                y: paintingHeight,
                z: startZ - wallIndex * spacing,
                rotation: Math.PI / 2 // Rotation de 90° pour faire face à la salle
            };
        }
        
        promises.push(loadPainting(artwork, position));
    });
    
    return Promise.all(promises);
}

// Fonction pour configurer l'éclairage
function setupLights(configName) {
    // Nettoyer les lumières existantes
    spotLights.forEach(light => scene.remove(light));
    lightHelpers.forEach(helper => scene.remove(helper));
    spotLights = [];
    spotHelpers = [];
    
    if (ambientLight) scene.remove(ambientLight);
    if (fillLight) scene.remove(fillLight);
    if (directionalLight) scene.remove(directionalLight);
    if (areaLight) scene.remove(areaLight);
    
    const config = lightConfigurations[configName];
    if (!config) return;
    
    currentLightConfigName = configName;
    
    // Lumière ambiante
    if (config.ambientLight && config.ambientLight.enabled) {
        ambientLight = new THREE.AmbientLight(
            config.ambientLight.color,
            config.ambientLight.intensity
        );
        scene.add(ambientLight);
    }
    
    // Lumière de remplissage
    if (config.fillLight && config.fillLight.enabled) {
        fillLight = new THREE.PointLight(
            config.fillLight.color,
            config.fillLight.intensity,
            80 // Portée adaptée à la salle agrandie
        );
        fillLight.position.set(
            config.fillLight.position.x,
            config.fillLight.position.y,
            config.fillLight.position.z
        );
        fillLight.castShadow = true;
        scene.add(fillLight);
    }
    
    // Spots
    if (config.spots && config.spots.enabled) {
        const numSpots = config.spots.count || 3;
        const spacing = config.spots.spacing || 0.8;
        const startX = -(numSpots - 1) * spacing / 2;
        
        for (let i = 0; i < numSpots; i++) {
            const spot = new THREE.SpotLight(
                config.spots.colorTemperature,
                config.spots.defaultIntensity,
                config.spots.distance,
                Math.tan(config.spots.beamAngle) * config.spots.distance,
                config.spots.penumbra,
                config.spots.decay
            );
            
            const x = startX + i * spacing;
            const roomDepth = 50; // Profondeur de la salle agrandie
            spot.position.set(x, 5, -18); // Position ajustée pour la salle agrandie
            spot.target.position.set(x, 1.5, -roomDepth / 2);
            spot.castShadow = true;
            spot.shadow.mapSize.width = 4096;
            spot.shadow.mapSize.height = 4096;
            spot.shadow.bias = -0.0001;
            spot.shadow.normalBias = 0.02;
            spot.shadow.radius = 6;
            
            scene.add(spot);
            scene.add(spot.target);
            spotLights.push(spot);
            
            const helper = createLightHelper(spot);
            scene.add(helper);
            spotHelpers.push(helper);
        }
        
        animationEnabled = config.spots.animated || false;
    }
    
    // Lumière de zone
    if (config.areaLight && config.areaLight.enabled) {
        areaLight = new THREE.RectAreaLight(
            config.areaLight.color,
            config.areaLight.intensity,
            config.areaLight.width,
            config.areaLight.height
        );
        areaLight.position.set(
            config.areaLight.position.x,
            config.areaLight.position.y,
            config.areaLight.position.z
        );
        areaLight.rotation.y = -Math.PI / 2;
        scene.add(areaLight);
        
        const helper = new RectAreaLightHelper(areaLight);
        scene.add(helper);
        lightHelpers.push(helper);
    }
}

// Fonction pour mettre à jour l'affichage du tableau actuel
function updateCurrentPaintingDisplay() {
    if (artworksData.length === 0) return;
    
    const artwork = artworksData[currentPaintingIndex];
    document.getElementById('artwork-title').textContent = artwork.title;
    document.getElementById('artwork-artist').textContent = artwork.artist;
    
    // Afficher les dimensions si disponibles
    const dimensionsElement = document.getElementById('artwork-dimensions');
    if (dimensionsElement) {
        if (artwork.height && artwork.width) {
            dimensionsElement.textContent = `${artwork.width} × ${artwork.height} cm`;
            dimensionsElement.style.display = 'block';
        } else {
            dimensionsElement.style.display = 'none';
        }
    }
    
    document.getElementById('artwork-counter').textContent = `${currentPaintingIndex + 1} / ${artworksData.length}`;
    
    // Mettre à jour les boutons de navigation
    document.getElementById('prev-artwork').disabled = currentPaintingIndex === 0;
    document.getElementById('next-artwork').disabled = currentPaintingIndex === artworksData.length - 1;
    
    // Centrer la caméra sur le tableau actuel
    if (paintings[currentPaintingIndex]) {
        const painting = paintings[currentPaintingIndex];
        // Calculer la position de la caméra selon l'orientation du tableau
        const paintingPos = painting.position.clone();
        const paintingRot = painting.rotation.y;
        
        let targetPosition;
        if (Math.abs(paintingRot - Math.PI / 2) < 0.1) {
            // Mur gauche : caméra à droite du tableau
            targetPosition = new THREE.Vector3(
                paintingPos.x + 3,
                paintingPos.y,
                paintingPos.z
            );
        } else if (Math.abs(paintingRot + Math.PI / 2) < 0.1) {
            // Mur droit : caméra à gauche du tableau
            targetPosition = new THREE.Vector3(
                paintingPos.x - 3,
                paintingPos.y,
                paintingPos.z
            );
        } else if (Math.abs(paintingRot - Math.PI) < 0.1 || Math.abs(paintingRot + Math.PI) < 0.1) {
            // Mur avant : caméra derrière le tableau
            targetPosition = new THREE.Vector3(
                paintingPos.x,
                paintingPos.y,
                paintingPos.z - 3
            );
        } else {
            // Mur arrière : caméra devant le tableau
            targetPosition = new THREE.Vector3(
                paintingPos.x,
                paintingPos.y,
                paintingPos.z + 3
            );
        }
        
        // Animation douce de la caméra
        animateCameraTo(targetPosition, paintingPos, paintingRot);
    }
}

// Fonction pour animer la caméra vers une position
function animateCameraTo(targetPosition, paintingPosition = null, paintingRotation = 0) {
    const startPosition = camera.position.clone();
    const startTarget = controls.target.clone();
    const duration = 1000; // 1 seconde
    const startTime = Date.now();
    
    // Calculer la cible de la caméra selon l'orientation du tableau
    let targetLookAt;
    if (paintingPosition) {
        // Regarder vers le centre du tableau
        targetLookAt = paintingPosition.clone();
    } else {
        // Par défaut, regarder vers le centre de la salle
        targetLookAt = new THREE.Vector3(0, 1.5, -12.5);
    }
    
    function animate() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeProgress = 1 - Math.pow(1 - progress, 3); // Ease out cubic
        
        camera.position.lerpVectors(startPosition, targetPosition, easeProgress);
        controls.target.lerpVectors(startTarget, targetLookAt, easeProgress);
        controls.update();
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        }
    }
    
    animate();
}

// Fonction d'initialisation
async function init() {
    try {
        const container = document.getElementById('canvas-container');
        if (!container) {
            console.error('Canvas container not found');
            return;
        }
        
        // Charger les données des œuvres depuis le JSON
        artworksData = await getFilteredArtworks();
        
        if (artworksData.length === 0) {
            document.getElementById('loading').textContent = 'Erreur: Aucune œuvre spécifiée';
            return;
        }
        
        // Scène
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0xffffff); // Blanc pur pour le fond (standard musée/galerie)
        scene.fog = new THREE.FogExp2(0xffffff, 0.015); // Brouillard blanc
        
        // Caméra
        camera = new THREE.PerspectiveCamera(
            45,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        // Positionner la caméra au centre de la salle agrandie
        camera.position.set(0, 1.5, 15);
        
        // Renderer
        renderer = new THREE.WebGLRenderer({
            antialias: true,
            powerPreference: 'high-performance',
            alpha: false,
            stencil: false,
            depth: true
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 3));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.8; // Exposition augmentée pour des murs plus blancs
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        
        container.appendChild(renderer.domElement);
        
        // Contrôles
        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.minDistance = 0.1; // Permet de zoomer très près (10cm)
        controls.maxDistance = 150; // Distance maximale augmentée pour zoomer très loin
        controls.zoomSpeed = 1.5; // Vitesse de zoom augmentée
        controls.target.set(0, 1.5, -25); // Cible au centre de la salle agrandie
        
        // Sol et murs
        const floor = createGalleryFloor();
        scene.add(floor);
        
        const walls = createGalleryWalls();
        scene.add(walls);
        
        // Éclairage
        setupLights('gallery-spots');
        
        // Charger les tableaux
        positionPaintings().then(() => {
            document.getElementById('loading').style.display = 'none';
            updateCurrentPaintingDisplay();
            animate();
        }).catch((error) => {
            console.error('Erreur lors du chargement des tableaux:', error);
            document.getElementById('loading').textContent = 'Erreur lors du chargement';
        });
        
        // Event listeners
        setupEventListeners();
        
    } catch (error) {
        console.error('Erreur lors de l\'initialisation:', error);
        document.getElementById('loading').textContent = 'Erreur lors de l\'initialisation';
    }
}

// Fonction pour configurer les event listeners
function setupEventListeners() {
    // Fermeture
    document.getElementById('gallery-close').addEventListener('click', () => {
        window.close();
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            window.close();
        } else if (e.key === 'ArrowLeft') {
            navigateToPainting(currentPaintingIndex - 1);
        } else if (e.key === 'ArrowRight') {
            navigateToPainting(currentPaintingIndex + 1);
        }
    });
    
    // Navigation
    document.getElementById('prev-artwork').addEventListener('click', () => {
        navigateToPainting(currentPaintingIndex - 1);
    });
    
    document.getElementById('next-artwork').addEventListener('click', () => {
        navigateToPainting(currentPaintingIndex + 1);
    });
    
    // Éclairage
    document.getElementById('light-config-select').addEventListener('change', (e) => {
        setupLights(e.target.value);
    });
    
    document.getElementById('spot-intensity-slider').addEventListener('input', (e) => {
        const intensity = parseFloat(e.target.value);
        document.getElementById('spot-intensity-value').textContent = intensity.toFixed(1);
        spotLights.forEach(spot => {
            spot.intensity = intensity;
        });
    });
    
    document.getElementById('spot-only-toggle').addEventListener('change', (e) => {
        spotOnlyMode = e.target.checked;
        if (spotOnlyMode) {
            if (ambientLight) ambientLight.intensity = 0;
            if (fillLight) fillLight.intensity = 0;
            spotLights.forEach(spot => {
                spot.intensity *= 2;
            });
        } else {
            const config = lightConfigurations[currentLightConfigName];
            if (ambientLight && config.ambientLight) {
                ambientLight.intensity = config.ambientLight.intensity;
            }
            if (fillLight && config.fillLight) {
                fillLight.intensity = config.fillLight.intensity;
            }
            spotLights.forEach((spot, index) => {
                const config = lightConfigurations[currentLightConfigName];
                if (config.spots) {
                    spot.intensity = config.spots.defaultIntensity;
                }
            });
        }
    });
    
    // Redimensionnement
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

// Fonction pour naviguer vers un tableau
function navigateToPainting(index) {
    if (index < 0 || index >= artworksData.length) return;
    
    currentPaintingIndex = index;
    updateCurrentPaintingDisplay();
}

// Fonction d'animation
function animate() {
    requestAnimationFrame(animate);
    
    controls.update();
    
    // Animation des spots si activée
    if (animationEnabled) {
        animationTime += 0.01;
        spotLights.forEach((spot, index) => {
            const radius = 3;
            const angle = animationTime + (index * Math.PI * 2 / spotLights.length);
            spot.position.x = Math.cos(angle) * radius;
            spot.position.z = -8 + Math.sin(angle) * radius;
            spot.target.position.x = spot.position.x;
            
            const hue = (animationTime * 50 + index * 60) % 360;
            spot.color.setHSL(hue / 360, 0.7, 0.6);
            
            spot.intensity = 0.3 + Math.sin(animationTime * 2 + index) * 0.2;
            
            // Mettre à jour le helper
            if (spotHelpers[index]) {
                scene.remove(spotHelpers[index]);
                spotHelpers[index] = createLightHelper(spot);
                scene.add(spotHelpers[index]);
            }
        });
    }
    
    renderer.render(scene, camera);
}

// Initialiser quand le DOM est prêt
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

