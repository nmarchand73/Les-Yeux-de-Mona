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
let spotMeshes = []; // Objets 3D visibles représentant les spots au plafond
let ambientLight = null;
let fillLights = []; // Tableau pour stocker toutes les fill lights
let spotOnlyMode = false;
let showHelpers = false; // Afficher les helpers (masqués par défaut)
let currentLightConfigName = 'gallery-spots';
let directionalLight = null;
let areaLight = null;
let animationEnabled = false;
let animationTime = 0;
let artworksData = []; // Données des œuvres à afficher

// Textures partagées pour optimiser l'utilisation des unités de texture WebGL
let sharedCanvasNormalMap = null;
let sharedCanvasRoughnessMap = null;
let sharedEnvironmentMap = null;

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
            intensity: 0.6 // Augmentée pour mieux éclairer les murs et leurs textures
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
    },
    'caterpillar': {
        name: 'Animation chenille',
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
            decay: 1.5,
            animated: true,
            animationType: 'caterpillar'
        },
        ambientLight: {
            enabled: true,
            color: 0xffffff,
            intensity: 0.7 // Augmentée pour mieux éclairer les murs et leurs textures
        },
        fillLight: {
            enabled: true,
            type: 'point',
            color: 0xffffff,
            intensity: 0.3,
            position: { x: 0, y: 5, z: 0 }
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

// Fonction pour créer un objet visuel représentant un spot au plafond
// Échelle réaliste : un spot de galerie fait environ 10-15 cm de diamètre
function createSpotMesh(position, color) {
    const spotGroup = new THREE.Group();
    
    // Échelle réduite : facteur de 0.5 pour des dimensions réalistes
    const scale = 0.5;
    
    // 1. Base de fixation au plafond (disque plat) - ~12 cm de diamètre
    const baseGeometry = new THREE.CylinderGeometry(0.06 * scale, 0.06 * scale, 0.01 * scale, 32);
    const baseMaterial = new THREE.MeshStandardMaterial({
        color: 0x1a1a1a, // Noir mat pour la base
        roughness: 0.8,
        metalness: 0.1
    });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = 0.005 * scale; // Juste au-dessus du plafond
    spotGroup.add(base);
    
    // 2. Corps principal du spot (cylindre qui sort du plafond) - ~10-12 cm de diamètre, ~9 cm de hauteur
    const bodyGeometry = new THREE.CylinderGeometry(0.05 * scale, 0.06 * scale, 0.09 * scale, 32);
    const bodyMaterial = new THREE.MeshStandardMaterial({
        color: 0x2a2a2a, // Gris foncé métallique
        roughness: 0.2,
        metalness: 0.8
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = -0.04 * scale; // Positionner dans le plafond
    spotGroup.add(body);
    
    // 3. Réflecteur/parabole (forme conique évasée) - ~7 cm de diamètre, ~6 cm de hauteur
    const reflectorGeometry = new THREE.ConeGeometry(0.07 * scale, 0.06 * scale, 32, 1, true);
    const reflectorMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff, // Blanc brillant pour le réflecteur
        roughness: 0.1,
        metalness: 0.9,
        envMapIntensity: 1.0
    });
    const reflector = new THREE.Mesh(reflectorGeometry, reflectorMaterial);
    reflector.rotation.x = Math.PI; // Inversé pour être orienté vers le bas
    reflector.position.y = -0.10 * scale; // Sous le corps
    spotGroup.add(reflector);
    
    // 4. Anneau de finition entre le corps et le réflecteur
    const ringGeometry = new THREE.TorusGeometry(0.06 * scale, 0.005 * scale, 16, 32);
    const ringMaterial = new THREE.MeshStandardMaterial({
        color: 0x3a3a3a, // Gris moyen
        roughness: 0.3,
        metalness: 0.6
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.10 * scale;
    spotGroup.add(ring);
    
    // 5. Source lumineuse principale (disque émissif au centre) - ~4 cm de diamètre
    const lightGeometry = new THREE.CircleGeometry(0.04 * scale, 32);
    const lightMaterial = new THREE.MeshStandardMaterial({
        color: color,
        side: THREE.DoubleSide,
        emissive: color,
        emissiveIntensity: 1.2
    });
    const lightDisk = new THREE.Mesh(lightGeometry, lightMaterial);
    lightDisk.rotation.x = -Math.PI / 2; // Face vers le bas
    lightDisk.position.y = -0.13 * scale; // Au centre du réflecteur
    spotGroup.add(lightDisk);
    
    // 6. Halo lumineux intense autour de la source
    const haloGeometry = new THREE.RingGeometry(0.04 * scale, 0.06 * scale, 32);
    const haloMaterial = new THREE.MeshStandardMaterial({
        color: color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.5,
        emissive: color,
        emissiveIntensity: 0.8
    });
    const halo = new THREE.Mesh(haloGeometry, haloMaterial);
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = -0.13 * scale;
    spotGroup.add(halo);
    
    // 7. Halo externe plus large et plus subtil
    const outerHaloGeometry = new THREE.RingGeometry(0.06 * scale, 0.09 * scale, 32);
    const outerHaloMaterial = new THREE.MeshStandardMaterial({
        color: color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.2,
        emissive: color,
        emissiveIntensity: 0.4
    });
    const outerHalo = new THREE.Mesh(outerHaloGeometry, outerHaloMaterial);
    outerHalo.rotation.x = -Math.PI / 2;
    outerHalo.position.y = -0.13 * scale;
    spotGroup.add(outerHalo);
    
    // 8. Point lumineux central intense (pour effet de brillance) - ~1.5 cm de diamètre
    const centerGeometry = new THREE.CircleGeometry(0.015 * scale, 16);
    const centerMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff, // Blanc pur au centre
        side: THREE.DoubleSide,
        emissive: 0xffffff,
        emissiveIntensity: 2.0
    });
    const center = new THREE.Mesh(centerGeometry, centerMaterial);
    center.rotation.x = -Math.PI / 2;
    center.position.y = -0.13 * scale;
    spotGroup.add(center);
    
    // 9. Vis de fixation (petits détails) - ~0.5 cm de diamètre
    for (let i = 0; i < 4; i++) {
        const screwGeometry = new THREE.CylinderGeometry(0.005 * scale, 0.005 * scale, 0.01 * scale, 8);
        const screwMaterial = new THREE.MeshStandardMaterial({
            color: 0x4a4a4a,
            roughness: 0.4,
            metalness: 0.7
        });
        const screw = new THREE.Mesh(screwGeometry, screwMaterial);
        const angle = (i / 4) * Math.PI * 2;
        screw.position.x = Math.cos(angle) * 0.055 * scale;
        screw.position.z = Math.sin(angle) * 0.055 * scale;
        screw.position.y = 0.01 * scale;
        spotGroup.add(screw);
    }
    
    // Positionner le groupe au plafond
    spotGroup.position.copy(position);
    
    return spotGroup;
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
        normalScale: new THREE.Vector2(0.8, 0.8), // Relief plus visible pour mieux voir les textures
        roughnessMap: wallRoughnessMap,
        color: 0xffffff, // Blanc pur pour les murs de galerie
        roughness: 0.75,
        metalness: 0.0,
        envMapIntensity: 0.2, // Augmenté pour plus de reflets et visibilité
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

// Fonction pour créer le plafond de la galerie
function createGalleryCeiling() {
    const roomWidth = 60;
    const roomDepth = 50;
    const ceilingHeight = 3; // Hauteur du plafond à 3m
    
    // Créer une texture de plafond (blanc cassé avec légère texture)
    const ceilingTexture = createWallTexture(); // Réutiliser la texture des murs
    const ceilingNormalMap = createWallNormalMap(); // Réutiliser la normal map
    
    const ceilingMaterial = new THREE.MeshStandardMaterial({
        map: ceilingTexture,
        normalMap: ceilingNormalMap,
        normalScale: new THREE.Vector2(0.4, 0.4), // Relief plus subtil pour le plafond
        color: 0xfafafa, // Blanc cassé légèrement plus clair que les murs
        roughness: 0.8,
        metalness: 0.0,
        envMapIntensity: 0.1,
        flatShading: false
    });
    
    const ceiling = new THREE.Mesh(
        new THREE.PlaneGeometry(roomWidth, roomDepth),
        ceilingMaterial
    );
    ceiling.rotation.x = Math.PI / 2; // Rotation pour être horizontal
    ceiling.position.y = ceilingHeight - 2; // Position à 3m de hauteur (sol à y=-2)
    ceiling.receiveShadow = true;
    ceiling.castShadow = false; // Le plafond ne projette pas d'ombres
    
    return ceiling;
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
                
                // Utiliser les textures partagées pour éviter de dépasser la limite de 16 unités de texture
                if (!sharedCanvasNormalMap) {
                    sharedCanvasNormalMap = createCanvasNormalMap();
                }
                if (!sharedCanvasRoughnessMap) {
                    sharedCanvasRoughnessMap = createCanvasRoughnessMap();
                }
                if (!sharedEnvironmentMap) {
                    sharedEnvironmentMap = createEnvironmentMap();
                }
                
                // Utiliser MeshStandardMaterial avec le minimum de textures pour éviter de dépasser la limite WebGL
                // On utilise seulement map (1 texture par matériau) pour éviter les problèmes de limite
                // L'envMap est désactivée pour réduire le nombre d'unités de texture utilisées
                // On simule l'effet de reflet avec une rugosité réduite
                const frontMaterial = new THREE.MeshStandardMaterial({
                    map: texture,
                    side: THREE.FrontSide,
                    roughness: 0.25, // Rugosité réduite pour simuler le vernis/reflet
                    metalness: 0.0
                    // Pas d'envMap pour économiser une unité de texture
                });
                
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
                // Stocker la hauteur et largeur du tableau pour calculer la position des spots
                paintingGroup.userData.paintingHeight = height;
                paintingGroup.userData.paintingWidth = width;
                
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
    spotLights.forEach(light => {
        scene.remove(light);
        if (light.target) scene.remove(light.target);
    });
    spotHelpers.forEach(helper => scene.remove(helper));
    spotMeshes.forEach(mesh => scene.remove(mesh));
    spotLights = [];
    spotHelpers = [];
    spotMeshes = [];
    
    if (ambientLight) scene.remove(ambientLight);
    fillLights.forEach(light => scene.remove(light));
    fillLights = [];
    fillLight = null; // Réinitialiser pour compatibilité
    if (directionalLight) {
        scene.remove(directionalLight);
        if (directionalLight.target) scene.remove(directionalLight.target);
    }
    if (areaLight) scene.remove(areaLight);
    
    const config = lightConfigurations[configName];
    if (!config) return;
    
    currentLightConfigName = configName;
    
    const roomWidth = 60;
    const roomDepth = 50;
    const ceilingHeight = 3; // Hauteur du plafond à 3m
    const paintingHeight = 1.5;
    
    // Lumière ambiante
    if (config.ambientLight && config.ambientLight.enabled) {
        ambientLight = new THREE.AmbientLight(
            config.ambientLight.color,
            config.ambientLight.intensity
        );
        scene.add(ambientLight);
    }
    
    // Lumière de remplissage - Point lights stratégiques pour éclairer toute la salle
    if (config.fillLight && config.fillLight.enabled) {
        // Utiliser plusieurs point lights positionnées stratégiquement pour couvrir toute la salle
        // sans avoir besoin de trop de spots avec ombres (coûteux en performance)
        // Positionner les fill lights juste sous le plafond (à 2.8m pour un plafond à 3m)
        const fillLightHeight = ceilingHeight - 0.2; // Juste sous le plafond
        const fillLightPositions = [
            { x: -15, y: fillLightHeight, z: -12.5 },
            { x: 15, y: fillLightHeight, z: -12.5 },
            { x: -15, y: fillLightHeight, z: 12.5 },
            { x: 15, y: fillLightHeight, z: 12.5 }
        ];
        
        fillLightPositions.forEach((pos, index) => {
            const pointLight = new THREE.PointLight(
                config.fillLight.color,
                config.fillLight.intensity * 0.4, // Réduire l'intensité car on en a plusieurs
                100 // Grande portée pour couvrir toute la salle
            );
            pointLight.position.set(pos.x, pos.y, pos.z);
            pointLight.castShadow = false; // Pas d'ombres pour les performances
            scene.add(pointLight);
            fillLights.push(pointLight);
            
            // Stocker la première comme fillLight principale pour compatibilité avec le code existant
            if (index === 0) {
                fillLight = pointLight;
            }
        });
    }
    
    // Spots - Optimisé pour la grande salle avec performance en tête
    if (config.spots && config.spots.enabled) {
        // Positionner les spots pour éclairer chaque tableau individuellement
        // Vérifier que les tableaux sont chargés
        const loadedPaintings = paintings.filter(p => p !== null);
        
        if (loadedPaintings.length === 0) {
            // Si aucun tableau n'est chargé, utiliser un éclairage par défaut
            // (peut arriver lors d'un changement de configuration avant le chargement)
            console.warn('Aucun tableau chargé, utilisation de l\'éclairage par défaut');
            return;
        }
        
        // Limiter le nombre de spots avec ombres pour les performances
        const maxShadowSpots = Math.min(12, loadedPaintings.length);
        let shadowSpotCount = 0;
        
        // Parcourir tous les tableaux chargés et créer 2 spots pour chacun (un de chaque côté)
        // Positionnement optimal selon les meilleures pratiques muséales :
        // - Angle d'incidence de 30° par rapport à la verticale
        // - Spots symétriques de chaque côté pour réduire les ombres
        // - Distance adaptée pour un éclairage uniforme
        
        loadedPaintings.forEach((painting, index) => {
            if (!painting) return; // Ignorer les tableaux non encore chargés
            
            const paintingPos = painting.position.clone();
            const paintingRot = painting.rotation.y;
            
            // Obtenir la hauteur et largeur réelles du tableau depuis userData
            const paintingActualHeight = painting.userData.paintingHeight || 2.0; // Fallback à 2m si non défini
            const paintingActualWidth = painting.userData.paintingWidth || 2.5; // Fallback à 2.5m si non défini
            const paintingCenterY = paintingPos.y; // Position du centre du tableau
            const paintingTopY = paintingPos.y + paintingActualHeight / 2; // Position du haut du tableau
            
            // Calculer la position optimale des spots avec un angle de 30° par rapport à la verticale
            // Angle optimal d'incidence : 30° (selon les standards muséaux)
            const optimalAngle = 30 * Math.PI / 180; // 30° en radians
            
            // Distance horizontale depuis le centre du tableau pour obtenir l'angle de 30°
            // tan(30°) = distance_horizontale / distance_verticale
            // On veut que les spots soient positionnés pour éclairer le centre du tableau avec cet angle
            const distanceFromCenter = (ceilingHeight - paintingCenterY) * Math.tan(optimalAngle);
            
            // Espacement horizontal optimal : les spots doivent être positionnés de manière symétrique
            // Pour un tableau, on place les spots à environ 40-50% de la largeur de chaque côté
            // Cela assure une couverture uniforme et réduit les ombres
            const spotHorizontalOffset = Math.max(
                paintingActualWidth * 0.4, // Au moins 40% de la largeur
                distanceFromCenter * 0.8   // Ou 80% de la distance calculée pour l'angle optimal
            );
            
            // Position Y du spot : au plafond ou légèrement en dessous selon l'angle optimal
            // Calculer la hauteur pour maintenir l'angle de 30° depuis le centre du tableau
            const spotY = Math.min(ceilingHeight - 0.1, paintingCenterY + distanceFromCenter / Math.tan(optimalAngle));
            
            // Calculer les positions des 2 spots (un de chaque côté du tableau)
            // Positionnement symétrique pour réduire les ombres portées
            let spot1X, spot1Z, spot2X, spot2Z;
            const spotDistanceFromWall = 0.5; // Distance minimale du spot par rapport au mur (ajustée pour l'angle optimal)
            
            if (Math.abs(paintingRot - Math.PI / 2) < 0.1) {
                // Mur gauche : spots à droite du tableau, positionnés symétriquement
                // Distance depuis le mur ajustée pour l'angle optimal
                const distanceFromWall = Math.max(spotDistanceFromWall, distanceFromCenter * 0.6);
                spot1X = paintingPos.x + distanceFromWall;
                spot1Z = paintingPos.z - spotHorizontalOffset; // Spot gauche (vue depuis le tableau)
                spot2X = paintingPos.x + distanceFromWall;
                spot2Z = paintingPos.z + spotHorizontalOffset; // Spot droit (vue depuis le tableau)
            } else if (Math.abs(paintingRot + Math.PI / 2) < 0.1) {
                // Mur droit : spots à gauche du tableau, positionnés symétriquement
                const distanceFromWall = Math.max(spotDistanceFromWall, distanceFromCenter * 0.6);
                spot1X = paintingPos.x - distanceFromWall;
                spot1Z = paintingPos.z - spotHorizontalOffset; // Spot gauche
                spot2X = paintingPos.x - distanceFromWall;
                spot2Z = paintingPos.z + spotHorizontalOffset; // Spot droit
            } else if (Math.abs(paintingRot - Math.PI) < 0.1 || Math.abs(paintingRot + Math.PI) < 0.1) {
                // Mur avant : spots derrière le tableau, positionnés symétriquement
                const distanceFromWall = Math.max(spotDistanceFromWall, distanceFromCenter * 0.6);
                spot1X = paintingPos.x - spotHorizontalOffset; // Spot gauche
                spot1Z = paintingPos.z - distanceFromWall;
                spot2X = paintingPos.x + spotHorizontalOffset; // Spot droit
                spot2Z = paintingPos.z - distanceFromWall;
            } else {
                // Mur arrière : spots devant le tableau, positionnés symétriquement
                const distanceFromWall = Math.max(spotDistanceFromWall, distanceFromCenter * 0.6);
                spot1X = paintingPos.x - spotHorizontalOffset; // Spot gauche
                spot1Z = paintingPos.z + distanceFromWall;
                spot2X = paintingPos.x + spotHorizontalOffset; // Spot droit
                spot2Z = paintingPos.z + distanceFromWall;
            }
            
            // Créer les 2 spots pour ce tableau
            for (let spotIndex = 0; spotIndex < 2; spotIndex++) {
                const spotX = spotIndex === 0 ? spot1X : spot2X;
                const spotZ = spotIndex === 0 ? spot1Z : spot2Z;
                
                // Créer le spot avec un angle de faisceau optimisé (10-15° pour un éclairage précis)
                const optimalBeamAngle = 12 * Math.PI / 180; // 12° pour un éclairage précis des œuvres
                // Utiliser la valeur du slider si disponible, sinon la valeur par défaut
                const slider = document.getElementById('spot-intensity-slider');
                const initialIntensity = slider ? parseFloat(slider.value) : config.spots.defaultIntensity;
                const spot = new THREE.SpotLight(
                    config.spots.colorTemperature,
                    initialIntensity * 2.5, // Intensité plus puissante
                    config.spots.distance * 1.5,
                    Math.tan(optimalBeamAngle) * config.spots.distance * 1.5,
                    config.spots.penumbra,
                    config.spots.decay
                );
                
                // Positionner le spot avec l'angle optimal
                spot.position.set(spotX, spotY, spotZ);
                // Cibler le centre du tableau pour un éclairage uniforme
                spot.target.position.set(paintingPos.x, paintingCenterY, paintingPos.z);
                
                // Seulement quelques spots projettent des ombres pour les performances
                // Limiter à 1 spot avec ombre par tableau pour les performances
                if (shadowSpotCount < maxShadowSpots && spotIndex === 0) {
                    spot.castShadow = true;
                    spot.shadow.mapSize.width = 2048;
                    spot.shadow.mapSize.height = 2048;
                    spot.shadow.bias = -0.0001;
                    spot.shadow.normalBias = 0.02;
                    spot.shadow.radius = 4;
                    shadowSpotCount++;
                } else {
                    spot.castShadow = false;
                }
                
                scene.add(spot);
                scene.add(spot.target);
                spotLights.push(spot);
                
                const helper = createLightHelper(spot);
                if (showHelpers) {
                    scene.add(helper);
                }
                spotHelpers.push(helper);
                
                // Créer l'objet visuel du spot au plafond
                const spotMesh = createSpotMesh(
                    new THREE.Vector3(spotX, spotY, spotZ),
                    new THREE.Color(config.spots.colorTemperature)
                );
                scene.add(spotMesh);
                spotMeshes.push(spotMesh);
            }
        });
        
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
        if (showHelpers) {
            scene.add(helper);
        }
        lightHelpers.push(helper);
    }
    
    // Appliquer le mode "spots uniquement" si activé (sans récursion)
    if (spotOnlyMode) {
        if (ambientLight) {
            ambientLight.intensity = 0;
        }
        fillLights.forEach(light => {
            light.intensity = 0;
        });
        const slider = document.getElementById('spot-intensity-slider');
        if (slider && config.spots && config.spots.enabled && spotLights.length > 0) {
            const currentSliderValue = parseFloat(slider.value);
            const multiplier = 1.5;
            const newIntensity = Math.min(currentSliderValue * multiplier, parseFloat(slider.max));
            spotLights.forEach(spot => {
                spot.intensity = newIntensity * 2.5; // Intensité plus puissante
            });
        }
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
        renderer.toneMappingExposure = 1.2; // Exposition réduite pour préserver les textures des murs
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        
        container.appendChild(renderer.domElement);
        
        // Contrôles
        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.minDistance = 0.2; // Distance minimale de 20cm pour ne pas passer de l'autre côté
        controls.maxDistance = 150; // Distance maximale augmentée pour zoomer très loin
        controls.zoomSpeed = 3.0; // Zoom beaucoup plus puissant
        controls.target.set(0, 1.5, -25); // Cible au centre de la salle agrandie
        
        // Sol, murs et plafond
        const floor = createGalleryFloor();
        scene.add(floor);
        
        const walls = createGalleryWalls();
        scene.add(walls);
        
        const ceiling = createGalleryCeiling();
        scene.add(ceiling);
        
        // Charger les tableaux d'abord, puis configurer l'éclairage
        positionPaintings().then(() => {
            // Éclairage configuré après le chargement des tableaux pour pouvoir les cibler
            changeLightConfiguration('gallery-spots');
            
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

// Fonction pour changer de configuration d'éclairage
function changeLightConfiguration(configName) {
    if (!lightConfigurations[configName]) {
        console.error(`Configuration "${configName}" non trouvée`);
        return;
    }
    
    const config = lightConfigurations[configName];
    currentLightConfigName = configName;
    
    // Activer/désactiver l'animation selon la configuration
    animationEnabled = (config.spots && config.spots.animated === true);
    if (!animationEnabled) {
        animationTime = 0; // Réinitialiser le temps d'animation
    }
    
    // Sauvegarder l'état actuel du toggle "spots uniquement" avant le changement
    const spotOnlyToggle = document.getElementById('spot-only-toggle');
    const wasSpotOnlyModeActive = spotOnlyToggle ? spotOnlyToggle.checked : false;
    
    // Sauvegarder l'intensité actuelle si applicable
    let currentIntensity = 1.0;
    const slider = document.getElementById('spot-intensity-slider');
    if (slider) {
        currentIntensity = parseFloat(slider.value);
    }
    
    // Appliquer la nouvelle configuration
    setupLights(configName);
    
    // Mettre à jour l'UI
    const select = document.getElementById('light-config-select');
    if (select) {
        select.value = configName;
    }
    
    // Adapter le slider selon la configuration - TOUJOURS actif pour les configurations avec spots
    if (slider) {
        if (config.spots && config.spots.enabled) {
            // Configuration avec spots - slider toujours actif
            slider.min = '0';
            slider.max = '5'; // Augmenté de 3 à 5 pour plus de puissance
            slider.step = '0.1';
            // Conserver la valeur actuelle du slider si elle existe, sinon utiliser la valeur par défaut
            if (!slider.value || parseFloat(slider.value) === 0) {
                slider.value = config.spots.defaultIntensity;
            }
            slider.disabled = false; // S'assurer que le slider est actif
            const label = slider.previousElementSibling;
            if (label && label.querySelector('span')) {
                label.querySelector('span').textContent = 'Intensité des spots';
            }
        } else {
            // Configuration sans spots - désactiver le slider
            slider.disabled = true;
        }
        
        // Mettre à jour l'affichage
        const valueDisplay = document.getElementById('spot-intensity-value');
        if (valueDisplay) {
            valueDisplay.textContent = parseFloat(slider.value).toFixed(1);
        }
        
        // Appliquer l'intensité aux spots avec multiplicateur plus puissant
        if (config.spots && config.spots.enabled) {
            const intensity = parseFloat(slider.value);
            spotLights.forEach(spot => {
                spot.intensity = intensity * 2.5; // Intensité plus puissante (augmentée de 1.2 à 2.5)
            });
        }
    }
    
    // Adapter le mode "spots uniquement" selon la configuration
    if (spotOnlyToggle) {
        // Vérifier si la configuration a un éclairage principal (spots)
        const hasMainLight = (config.spots && config.spots.enabled);
        
        if (hasMainLight) {
            spotOnlyToggle.disabled = false;
            // Mettre à jour le label selon la configuration
            const label = document.getElementById('spot-only-label');
            if (label) {
                if (config.spots && config.spots.enabled) {
                    label.textContent = 'Mode spots uniquement';
                }
            }
            
            // Réappliquer le mode "spots uniquement" si il était activé avant le changement
            if (wasSpotOnlyModeActive) {
                spotOnlyToggle.checked = true;
                toggleSpotOnlyMode(true);
            } else {
                // S'assurer que le toggle est désactivé et que le mode normal est appliqué
                spotOnlyToggle.checked = false;
                toggleSpotOnlyMode(false);
            }
        } else {
            // Configuration sans spots : désactiver le toggle et le mode
            spotOnlyToggle.checked = false;
            spotOnlyToggle.disabled = true;
            toggleSpotOnlyMode(false);
        }
    }
}

// Fonction pour basculer entre le mode normal et le mode "spots uniquement"
// S'adapte à la configuration active
function toggleSpotOnlyMode(enabled) {
    const wasInSpotOnlyMode = spotOnlyMode;
    spotOnlyMode = enabled;
    
    const config = lightConfigurations[currentLightConfigName];
    if (!config) return;
    
    if (enabled) {
        // Mode "spots uniquement" : éteindre la lumière ambiante et les fill lights
        if (ambientLight) {
            ambientLight.intensity = 0;
        }
        // Éteindre toutes les fill lights
        fillLights.forEach(light => {
            light.intensity = 0;
        });
        
        // Réduire l'exposition du tone mapping pour un effet plus dramatique
        if (renderer) {
            renderer.toneMappingExposure = 0.8; // Réduire l'exposition pour plus de contraste
        }
        
        // Augmenter modérément l'intensité des spots (mais pas trop pour garder le contraste)
        const slider = document.getElementById('spot-intensity-slider');
        const currentSliderValue = slider ? parseFloat(slider.value) : 1.0;
        const multiplier = 1.3; // Multiplicateur réduit pour garder plus de contraste
        const newIntensity = Math.min(currentSliderValue * multiplier, parseFloat(slider ? slider.max : 5));
        
        if (config.spots && config.spots.enabled && spotLights.length > 0) {
            // Configuration avec spots : augmenter modérément les spots
            spotLights.forEach(spot => {
                spot.intensity = newIntensity * 2.5; // Intensité plus puissante
            });
        }
        
        // Mettre à jour l'affichage du slider
        const valueDisplay = document.getElementById('spot-intensity-value');
        if (valueDisplay) {
            valueDisplay.textContent = newIntensity.toFixed(1);
        }
    } else {
        // Mode normal : rallumer la lumière ambiante et les fill lights
        if (ambientLight && config.ambientLight && config.ambientLight.enabled) {
            ambientLight.intensity = config.ambientLight.intensity;
        }
        // Rétablir toutes les fill lights
        if (config.fillLight && config.fillLight.enabled) {
            const baseIntensity = config.fillLight.intensity * 0.4;
            fillLights.forEach(light => {
                light.intensity = baseIntensity;
            });
        }
        
        // Restaurer l'exposition normale du tone mapping (réduite pour préserver les textures des murs)
        if (renderer) {
            renderer.toneMappingExposure = 1.2; // Exposition réduite pour mieux voir les textures des murs
        }
        
        // Restaurer l'intensité normale des spots
        const slider = document.getElementById('spot-intensity-slider');
        if (slider) {
            const currentIntensity = parseFloat(slider.value);
            // Si on était en mode "spots uniquement", diviser par le multiplicateur
            const originalIntensity = wasInSpotOnlyMode ? currentIntensity / 1.3 : currentIntensity;
            
            if (config.spots && config.spots.enabled && spotLights.length > 0) {
                spotLights.forEach(spot => {
                    spot.intensity = originalIntensity * 2.5; // Intensité plus puissante
                });
            }
            
            // Mettre à jour l'affichage
            const valueDisplay = document.getElementById('spot-intensity-value');
            if (valueDisplay) {
                valueDisplay.textContent = originalIntensity.toFixed(1);
            }
        }
    }
}

// Fonction pour basculer l'affichage des helpers
function toggleHelpers(enabled) {
    showHelpers = enabled;
    
    // Ajouter ou retirer tous les helpers de lumière de la scène
    lightHelpers.forEach(helper => {
        if (enabled) {
            if (!scene.children.includes(helper)) {
                scene.add(helper);
            }
        } else {
            scene.remove(helper);
        }
    });
    
    // Ajouter ou retirer les helpers de spots
    spotHelpers.forEach(helper => {
        if (enabled) {
            if (!scene.children.includes(helper)) {
                scene.add(helper);
            }
        } else {
            scene.remove(helper);
        }
    });
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
        changeLightConfiguration(e.target.value);
    });
    
    document.getElementById('spot-intensity-slider').addEventListener('input', (e) => {
        const intensity = parseFloat(e.target.value);
        // Si on est en mode spots uniquement, appliquer le multiplicateur
        const actualIntensity = spotOnlyMode ? Math.min(intensity * 1.5, 5.0) : intensity;
        document.getElementById('spot-intensity-value').textContent = intensity.toFixed(1);
        spotLights.forEach(spot => {
            // Intensité plus puissante : multiplier par 2.5 au lieu de 1.2
            spot.intensity = actualIntensity * 2.5;
        });
    });
    
    // Toggle "spots uniquement"
    const spotOnlyToggle = document.getElementById('spot-only-toggle');
    if (spotOnlyToggle) {
        spotOnlyToggle.addEventListener('change', (e) => {
            toggleSpotOnlyMode(e.target.checked);
        });
    }
    
    // Toggle "afficher les helpers"
    const showHelpersToggle = document.getElementById('show-helpers-toggle');
    if (showHelpersToggle) {
        showHelpersToggle.checked = showHelpers; // Synchroniser avec l'état actuel
        showHelpersToggle.addEventListener('change', (e) => {
            toggleHelpers(e.target.checked);
        });
    }
    
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
        const config = lightConfigurations[currentLightConfigName];
        const animationType = config?.spots?.animationType || 'show';
        
        if (animationType === 'caterpillar') {
            // Animation chenille : les spots s'allument et s'éteignent séquentiellement
            animationTime += 0.015; // Vitesse de l'animation
            const cycleDuration = 4; // Durée d'un cycle complet (en secondes)
            const totalSpots = spotLights.length;
            
            spotLights.forEach((spot, index) => {
                // Calculer la phase de chaque spot (décalage dans le cycle)
                const phase = (animationTime + (index / totalSpots) * cycleDuration) % cycleDuration;
                
                // Fonction d'intensité : monte, reste allumé, puis descend
                let intensity = 0;
                if (phase < 0.5) {
                    // Montée : 0 à 1 sur 0.5 secondes
                    intensity = phase * 2;
                } else if (phase < 1.5) {
                    // Allumé : reste à 1 pendant 1 seconde
                    intensity = 1.0;
                } else if (phase < 2.0) {
                    // Descente : 1 à 0 sur 0.5 secondes
                    intensity = 1.0 - (phase - 1.5) * 2;
                } else {
                    // Éteint : reste à 0 pendant 2 secondes
                    intensity = 0.0;
                }
                
                // Appliquer l'intensité avec un peu de variation pour plus de réalisme
                // Utiliser la valeur du slider pour respecter le contrôle utilisateur
                const slider = document.getElementById('spot-intensity-slider');
                const sliderIntensity = slider ? parseFloat(slider.value) : config.spots.defaultIntensity;
                const baseIntensity = sliderIntensity * 2.5; // Intensité plus puissante
                spot.intensity = intensity * baseIntensity;
                
                // Légère variation de couleur pour l'effet
                if (intensity > 0.1) {
                    const colorVariation = Math.sin(phase * Math.PI * 2) * 0.05;
                    const r = ((config.spots.colorTemperature >> 16) & 0xff) / 255;
                    const g = ((config.spots.colorTemperature >> 8) & 0xff) / 255;
                    const b = (config.spots.colorTemperature & 0xff) / 255;
                    spot.color.setRGB(
                        Math.max(0, Math.min(1, r + colorVariation)),
                        Math.max(0, Math.min(1, g + colorVariation * 0.5)),
                        Math.max(0, Math.min(1, b + colorVariation * 0.3))
                    );
                } else {
                    spot.color.setHex(config.spots.colorTemperature);
                }
                
                // Mettre à jour le helper avec la nouvelle couleur et opacité
                if (spotHelpers[index]) {
                    scene.remove(spotHelpers[index]);
                    spotHelpers[index] = createLightHelper(spot);
                    if (showHelpers) {
                        scene.add(spotHelpers[index]);
                    }
                }
                
                // Mettre à jour la couleur du spot visuel
                if (spotMeshes[index]) {
                    spotMeshes[index].traverse((child) => {
                        if (child.isMesh && child.material) {
                            if (child.material.emissive !== undefined) {
                                child.material.emissive.copy(spot.color);
                                child.material.color.copy(spot.color);
                                // Ajuster l'intensité émissive selon l'intensité du spot
                                if (child.material.emissiveIntensity !== undefined) {
                                    const normalizedIntensity = Math.min(spot.intensity / (config.spots.defaultIntensity * 2.5), 1.5);
                                    child.material.emissiveIntensity = normalizedIntensity * 0.8;
                                }
                            }
                        }
                    });
                }
            });
        } else {
            // Animation "show" adaptée à la grande salle avec mouvements dynamiques
            // Chaque spot a des mouvements variés et synchronisés pour créer un spectacle immersif
            animationTime += 0.016; // Incrémenter le temps (environ 60 FPS)
            
            const ceilingHeight = 3; // Hauteur du plafond à 3m (définie localement pour l'animation)
            const loadedPaintings = paintings.filter(p => p !== null);
            
            spotLights.forEach((spot, index) => {
                // Calculer l'index du tableau et l'index du spot dans ce tableau
                // Il y a 2 spots par tableau, donc :
                const paintingIndex = Math.floor(index / 2);
                const spotIndexInPainting = index % 2;
                
                // Trouver le tableau correspondant à ce spot
                const painting = loadedPaintings[paintingIndex];
                if (!painting) return;
                
                const paintingPos = painting.position.clone();
                const paintingRot = painting.rotation.y;
                
                // Mouvements variés selon l'index pour créer de la diversité
                const movementType = paintingIndex % 4; // 4 types de mouvements différents
                const phase = (paintingIndex / loadedPaintings.length) * Math.PI * 2; // Déphasage entre les tableaux
                const spotPhase = spotIndexInPainting * Math.PI; // Déphasage entre les 2 spots du même tableau
                
                // Paramètres de mouvement adaptés à la grande salle
                const baseRadius = 3.5; // Rayon de base plus grand pour la grande salle
                const speed = 0.35 + (paintingIndex % 3) * 0.15; // Vitesses variées (0.35 à 0.65)
                const angle = animationTime * speed + phase + spotPhase;
                
                // Rayon variable pour créer des ellipses et des figures de 8
                const radiusVariation = 0.3;
                const radiusX = baseRadius * (1 + Math.sin(animationTime * 0.5 + phase) * radiusVariation);
                const radiusZ = baseRadius * (1 + Math.cos(animationTime * 0.7 + phase) * radiusVariation);
                
                // Obtenir les dimensions réelles du tableau depuis userData
                const paintingActualHeightAnim = painting.userData.paintingHeight || 2.0;
                const paintingActualWidthAnim = painting.userData.paintingWidth || 2.5;
                const paintingCenterYAnim = paintingPos.y;
                
                // Calculer la position optimale avec angle de 30°
                const optimalAngleAnim = 30 * Math.PI / 180;
                const distanceFromCenterAnim = (ceilingHeight - paintingCenterYAnim) * Math.tan(optimalAngleAnim);
                const spotHorizontalOffsetAnim = Math.max(
                    paintingActualWidthAnim * 0.4,
                    distanceFromCenterAnim * 0.8
                );
                
                // Calculer la position de base du spot selon l'orientation du tableau et son index (gauche/droit)
                let baseOffsetX, baseOffsetZ;
                const spotDistanceFromWallAnim = 0.5;
                const distanceFromWallAnim = Math.max(spotDistanceFromWallAnim, distanceFromCenterAnim * 0.6);
                
                if (Math.abs(paintingRot - Math.PI / 2) < 0.1) {
                    // Mur gauche : spots à droite du tableau
                    baseOffsetX = distanceFromWallAnim;
                    baseOffsetZ = spotIndexInPainting === 0 ? -spotHorizontalOffsetAnim : spotHorizontalOffsetAnim;
                } else if (Math.abs(paintingRot + Math.PI / 2) < 0.1) {
                    // Mur droit : spots à gauche du tableau
                    baseOffsetX = -distanceFromWallAnim;
                    baseOffsetZ = spotIndexInPainting === 0 ? -spotHorizontalOffsetAnim : spotHorizontalOffsetAnim;
                } else if (Math.abs(paintingRot - Math.PI) < 0.1 || Math.abs(paintingRot + Math.PI) < 0.1) {
                    // Mur avant : spots derrière le tableau
                    baseOffsetX = spotIndexInPainting === 0 ? -spotHorizontalOffsetAnim : spotHorizontalOffsetAnim;
                    baseOffsetZ = -distanceFromWallAnim;
                } else {
                    // Mur arrière : spots devant le tableau
                    baseOffsetX = spotIndexInPainting === 0 ? -spotHorizontalOffsetAnim : spotHorizontalOffsetAnim;
                    baseOffsetZ = distanceFromWallAnim;
                }
                
                // Mouvements variés selon le type de mouvement
                let offsetX, offsetZ;
                let movementX, movementZ;
                
                switch (movementType) {
                    case 0:
                        // Mouvement circulaire classique
                        movementX = Math.cos(angle) * radiusX;
                        movementZ = Math.sin(angle) * radiusZ;
                        break;
                    case 1:
                        // Figure de 8 (lemniscate)
                        const t = angle;
                        movementX = radiusX * Math.sin(t);
                        movementZ = radiusZ * Math.sin(t) * Math.cos(t);
                        break;
                    case 2:
                        // Ellipse avec rotation
                        movementX = radiusX * Math.cos(angle) * Math.cos(animationTime * 0.3) - radiusZ * Math.sin(angle) * Math.sin(animationTime * 0.3);
                        movementZ = radiusX * Math.cos(angle) * Math.sin(animationTime * 0.3) + radiusZ * Math.sin(angle) * Math.cos(animationTime * 0.3);
                        break;
                    case 3:
                        // Mouvement en spirale
                        const spiralRadius = baseRadius * (0.5 + (angle % (Math.PI * 2)) / (Math.PI * 4));
                        movementX = Math.cos(angle) * spiralRadius;
                        movementZ = Math.sin(angle) * spiralRadius;
                        break;
                }
                
                // Adapter le mouvement selon l'orientation du mur
                if (Math.abs(paintingRot - Math.PI / 2) < 0.1) {
                    // Mur gauche : mouvement perpendiculaire au mur
                    offsetX = baseOffsetX + movementX * 0.4;
                    offsetZ = baseOffsetZ + movementZ * 0.8;
                } else if (Math.abs(paintingRot + Math.PI / 2) < 0.1) {
                    // Mur droit : mouvement perpendiculaire au mur
                    offsetX = baseOffsetX - movementX * 0.4;
                    offsetZ = baseOffsetZ + movementZ * 0.8;
                } else if (Math.abs(paintingRot - Math.PI) < 0.1 || Math.abs(paintingRot + Math.PI) < 0.1) {
                    // Mur avant : mouvement perpendiculaire au mur
                    offsetX = baseOffsetX + movementX * 0.8;
                    offsetZ = baseOffsetZ - movementZ * 0.4;
                } else {
                    // Mur arrière : mouvement perpendiculaire au mur
                    offsetX = baseOffsetX + movementX * 0.8;
                    offsetZ = baseOffsetZ + movementZ * 0.4;
                }
                
                // Position du spot avec mouvement circulaire
                // IMPORTANT : maintenir l'angle optimal de 30° même pendant l'animation
                const ceilingHeightAnim = 3; // Hauteur du plafond à 3m
                const optimalAngleAnim2 = 30 * Math.PI / 180;
                const paintingCenterYAnim2 = paintingPos.y;
                
                // Calculer la position Y optimale pour maintenir l'angle de 30°
                const distanceFromCenterAnim2 = (ceilingHeightAnim - paintingCenterYAnim2) * Math.tan(optimalAngleAnim2);
                const optimalSpotY = Math.min(ceilingHeightAnim - 0.1, paintingCenterYAnim2 + distanceFromCenterAnim2 / Math.tan(optimalAngleAnim2));
                
                spot.position.x = paintingPos.x + offsetX;
                // Position Y : mouvements verticaux plus prononcés pour la grande salle
                const verticalMovement = Math.sin(animationTime * 0.6 + phase) * 0.3 + 
                                        Math.cos(animationTime * 0.9 + spotPhase) * 0.15;
                spot.position.y = optimalSpotY + verticalMovement;
                spot.position.z = paintingPos.z + offsetZ;
                
                // Cibler le centre du tableau avec légère variation pour effet dynamique
                const targetVariation = 0.1; // Légère variation du point de visée
                spot.target.position.x = paintingPos.x + Math.sin(animationTime * 0.4 + phase) * targetVariation;
                spot.target.position.y = paintingCenterYAnim2 + Math.cos(animationTime * 0.5 + phase) * targetVariation * 0.5;
                spot.target.position.z = paintingPos.z + Math.cos(animationTime * 0.4 + phase) * targetVariation;
                
                // Variation d'intensité plus dynamique (pulsation et vagues)
                // Utiliser la valeur du slider pour respecter le contrôle utilisateur
                const slider = document.getElementById('spot-intensity-slider');
                const sliderIntensity = slider ? parseFloat(slider.value) : config.spots.defaultIntensity || 0.3;
                
                const intensityVariation = 0.3; // Variation plus importante
                const intensityPhase = animationTime * 1.5 + phase;
                const waveIntensity = Math.sin(animationTime * 0.8 + paintingIndex * 0.5) * 0.15; // Effet de vague
                const baseIntensity = sliderIntensity;
                const intensity = baseIntensity + 
                                 Math.sin(intensityPhase) * intensityVariation + 
                                 waveIntensity;
                // Intensité plus puissante : multiplier par 2.5 au lieu de 1.2
                spot.intensity = Math.max(0.2, Math.min(5.0, intensity)) * 2.5;
                
                // Variation de couleur dynamique (spectacle coloré adapté à la grande salle)
                const colorSpeed = 0.25 + (paintingIndex % 3) * 0.1; // Vitesses variées
                const colorPhase = phase * 2.5 + spotPhase;
                const hueVariation = (animationTime * colorSpeed + colorPhase) % 1;
                
                // Base : blanc chaud (4000K), puis variation vers différentes couleurs
                const baseColor = new THREE.Color(config.spots.colorTemperature);
                const baseHSL = baseColor.getHSL({});
                
                // Variation de teinte plus prononcée avec transitions fluides
                const baseHueOffset = (paintingIndex / loadedPaintings.length) * 0.5;
                const hueWave = Math.sin(animationTime * 0.3 + paintingIndex * 0.4) * 0.15; // Onde de couleur
                const hue = (baseHSL.h + baseHueOffset + hueVariation * 0.5 + hueWave) % 1;
                
                // Variation de saturation plus dynamique
                const saturationBase = 0.4 + (paintingIndex % 2) * 0.2; // Saturation de base variée
                const saturationVariation = Math.sin(animationTime * 0.5 + phase) * 0.25 + 
                                          Math.cos(animationTime * 0.7 + spotPhase) * 0.15;
                const saturation = Math.max(0.15, Math.min(0.9, saturationBase + saturationVariation));
                
                // Variation de luminosité avec pulsations
                const lightnessBase = 0.7;
                const lightnessVariation = Math.sin(animationTime * 0.8 + phase) * 0.2 + 
                                          Math.cos(animationTime * 1.1 + spotPhase) * 0.1;
                const lightness = Math.max(0.4, Math.min(1.0, lightnessBase + lightnessVariation));
                
                // Appliquer la couleur avec variations
                spot.color.setHSL(hue, saturation, lightness);
                
                // Mettre à jour le helper
                if (spotHelpers[index]) {
                    scene.remove(spotHelpers[index]);
                    spotHelpers[index] = createLightHelper(spot);
                    if (showHelpers) {
                        scene.add(spotHelpers[index]);
                    }
                }
                
                // Mettre à jour la position et la couleur du spot visuel
                if (spotMeshes[index]) {
                    spotMeshes[index].position.copy(spot.position);
                    // Mettre à jour la couleur de la source lumineuse
                    spotMeshes[index].traverse((child) => {
                        if (child.isMesh && child.material) {
                            if (child.material.emissive) {
                                child.material.emissive.copy(spot.color);
                                child.material.color.copy(spot.color);
                            }
                        }
                    });
                }
            });
        }
    }
    
    renderer.render(scene, camera);
}

// Initialiser quand le DOM est prêt
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

