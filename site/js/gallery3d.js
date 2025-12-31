import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Variables globales
let scene, camera, renderer, controls;
let painting, paintingFrame;
let mainLight, fillLight, backLight;
let centerHelper, boundingBoxHelper;
let lightHelpers = [];
let spotLights = []; // Tableau pour stocker tous les spots
let ambientLight = null; // Lumière ambiante (pour pouvoir l'éteindre)
let spotOnlyMode = false; // Mode "spots uniquement"

// Fonction pour récupérer les paramètres d'URL
function getURLParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        image: params.get('image') || '',
        title: params.get('title') || '',
        artist: params.get('artist') || ''
    };
}

// Fonction pour créer un helper de lumière
function createLightHelper(light) {
    const helperGroup = new THREE.Group();
    
    if (light.type === 'SpotLight') {
        // Helper pour SpotLight : cône + sphère (comme dans exemple_3D)
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
        
        // Sphère à la position de la lumière
        const sphereGeometry = new THREE.SphereGeometry(0.15, 16, 16);
        const sphereMaterial = new THREE.MeshBasicMaterial({
            color: light.color,
            opacity: 0.8,
            transparent: true
        });
        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        helperGroup.add(sphere);
        
        // Lignes pour montrer la direction
        const lineGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0, -coneLength * 0.8)
        ]);
        const lineMaterial = new THREE.LineBasicMaterial({
            color: light.color,
            opacity: 0.5,
            transparent: true
        });
        const line = new THREE.Line(lineGeometry, lineMaterial);
        helperGroup.add(line);
        
    } else if (light.type === 'DirectionalLight') {
        // Helper pour DirectionalLight : cône directionnel + flèche + sphère
        const targetPos = light.target ? light.target.position : new THREE.Vector3(0, 0, 0);
        const direction = new THREE.Vector3().subVectors(targetPos, light.position).normalize();
        const coneLength = 2;
        const coneRadius = 0.3;
        
        // Cône pour montrer la direction (comme SpotLight dans exemple_3D)
        const coneGeometry = new THREE.ConeGeometry(coneRadius, coneLength, 16, 1, true);
        const coneMaterial = new THREE.MeshBasicMaterial({
            color: light.color,
            opacity: 0.2,
            transparent: true,
            wireframe: true,
            side: THREE.DoubleSide
        });
        const cone = new THREE.Mesh(coneGeometry, coneMaterial);
        // Orienter le cône dans la direction de la lumière (vers le bas par défaut, puis rotation)
        cone.rotation.x = Math.PI;
        // Calculer la rotation pour pointer vers la direction
        const up = new THREE.Vector3(0, 1, 0);
        const quaternion = new THREE.Quaternion().setFromUnitVectors(up, direction.clone().negate());
        cone.applyQuaternion(quaternion);
        helperGroup.add(cone);
        
        // Flèche directionnelle
        const arrowLength = 1.5;
        const arrowHelper = new THREE.ArrowHelper(
            direction,
            new THREE.Vector3(0, 0, 0),
            arrowLength,
            light.color.getHex(),
            0.4,
            0.12
        );
        helperGroup.add(arrowHelper);
        
        // Sphère à la position de la lumière
        const sphereGeometry = new THREE.SphereGeometry(0.15, 16, 16);
        const sphereMaterial = new THREE.MeshBasicMaterial({
            color: light.color,
            opacity: 0.8,
            transparent: true
        });
        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        helperGroup.add(sphere);
        
        // Ligne pour montrer la direction
        const lineGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            direction.clone().multiplyScalar(coneLength * 0.8)
        ]);
        const lineMaterial = new THREE.LineBasicMaterial({
            color: light.color,
            opacity: 0.5,
            transparent: true
        });
        const line = new THREE.Line(lineGeometry, lineMaterial);
        helperGroup.add(line);
        
    } else if (light.type === 'PointLight') {
        // Helper pour PointLight : sphère + cercles
        const sphereGeometry = new THREE.SphereGeometry(0.12, 16, 16);
        const sphereMaterial = new THREE.MeshBasicMaterial({
            color: light.color,
            opacity: 0.8,
            transparent: true
        });
        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        helperGroup.add(sphere);
        
        // Cercles pour montrer la portée
        const circleGeometry = new THREE.RingGeometry(0.15, 0.17, 32);
        const circleMaterial = new THREE.MeshBasicMaterial({
            color: light.color,
            opacity: 0.3,
            transparent: true,
            side: THREE.DoubleSide
        });
        
        // 3 cercles perpendiculaires
        for (let i = 0; i < 3; i++) {
            const circle = new THREE.Mesh(circleGeometry, circleMaterial);
            if (i === 0) circle.rotation.x = Math.PI / 2;
            if (i === 1) circle.rotation.y = Math.PI / 2;
            helperGroup.add(circle);
        }
    }
    
    // Positionner le helper à la position de la lumière
    helperGroup.position.copy(light.position);
    
    return helperGroup;
}

// Configuration des lumières avec spots classiques de galerie
function setupLights() {
    // Nettoyer les anciens helpers
    lightHelpers.forEach(helper => {
        scene.remove(helper);
        helper.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });
    });
    lightHelpers = [];
    spotLights = []; // Réinitialiser le tableau des spots
    
    // Paramètres pour l'éclairage de galerie selon les normes
    const ceilingHeight = 6; // Hauteur du plafond (2.4m en réalité, adapté à notre échelle)
    const paintingCenterY = 1.5; // Hauteur du centre du tableau
    const paintingZ = -7.5; // Position Z du tableau (contre le mur)
    const spotDistanceFromWall = 0.6; // 60 cm du mur (norme pour plafond de 2.4m)
    const spotSpacing = 0.8; // 80 cm entre les spots (norme : 60-80 cm)
    const spotAngle = 30 * Math.PI / 180; // Angle de 30° vers le tableau (norme)
    const spotBeamAngle = 40 * Math.PI / 180; // Angle du faisceau de 40° (norme)
    
    // Température de couleur : 4000K (blanc neutre, norme pour galeries)
    // 4000K = blanc neutre, équilibre entre chaud et froid
    // Conversion approximative : 4000K ≈ RGB(255, 244, 229) ou hex 0xfff4e5
    const colorTemperature = 0xfff4e5; // ~4000K (blanc neutre, norme galerie)
    
    // Intensité ajustée pour correspondre à ~150 lux max (norme pour peintures)
    // Conversion approximative : pour un spot à 2m de distance, ~1.0-1.2 intensity = ~150 lux
    const spotIntensity = 1.0; // Intensité conforme aux normes
    
    // Calculer la position des spots au plafond
    // Pour un tableau de ~4 unités de large, utiliser 2-3 spots
    const numSpots = 3;
    const totalWidth = (numSpots - 1) * spotSpacing;
    const startX = -totalWidth / 2;
    
    // Créer les spots au plafond
    for (let i = 0; i < numSpots; i++) {
        const spotX = startX + i * spotSpacing;
        const spotY = ceilingHeight;
        // Position Z : à 60 cm du mur pour créer l'angle de 30° (norme)
        const spotZ = paintingZ + spotDistanceFromWall + (ceilingHeight - paintingCenterY) * Math.tan(spotAngle);
        
        // Créer le spot selon les normes d'éclairage de galerie
        const spot = new THREE.SpotLight(colorTemperature, spotIntensity, 20, spotBeamAngle, 0.3, 1.5);
        spot.position.set(spotX, spotY, spotZ);
        spot.target.position.set(spotX, paintingCenterY, paintingZ);
        spot.castShadow = true;
        spot.shadow.mapSize.width = 2048; // Meilleure qualité d'ombre
        spot.shadow.mapSize.height = 2048;
        spot.shadow.camera.near = 0.5;
        spot.shadow.camera.far = 15;
        spot.shadow.bias = -0.0001;
        spot.shadow.radius = 4; // Ombres plus douces
        
        scene.add(spot);
        scene.add(spot.target);
        
        // Stocker le spot dans le tableau
        spotLights.push(spot);
        
        // Helper pour le spot
        const spotHelper = createLightHelper(spot);
        scene.add(spotHelper);
        lightHelpers.push(spotHelper);
        
        // Stocker le premier spot comme mainLight pour compatibilité
        if (i === 0) {
            mainLight = spot;
        }
    }
    
    // Lumière de remplissage (pour éviter les ombres trop dures)
    fillLight = new THREE.PointLight(0xffffff, 0.4);
    fillLight.position.set(0, ceilingHeight - 1, 0);
    scene.add(fillLight);
    
    // Helper pour la lumière de remplissage
    const fillLightHelper = createLightHelper(fillLight);
    scene.add(fillLightHelper);
    lightHelpers.push(fillLightHelper);
    
    // Lumière ambiante (simule la lumière diffuse d'une galerie)
    ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
}

// Fonction pour créer un helper de centre de rotation
function createCenterHelper() {
    const helperGroup = new THREE.Group();
    const axisLength = 0.6;
    const colorX = 0xe74c3c; // Rouge
    const colorY = 0x2ecc71; // Vert
    const colorZ = 0x3498db; // Bleu
    
    function createAxisLine(points, color) {
        const mainMaterial = new THREE.LineBasicMaterial({ 
            color: color, 
            opacity: 0.8,
            transparent: true,
            linewidth: 2
        });
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const mainLine = new THREE.Line(geometry, mainMaterial);
        helperGroup.add(mainLine);
        
        const glowMaterial = new THREE.LineBasicMaterial({ 
            color: color, 
            opacity: 0.2,
            transparent: true,
            linewidth: 4
        });
        const glowLine = new THREE.Line(geometry, glowMaterial);
        helperGroup.add(glowLine);
        
        const arrowLength = 0.08;
        const arrowGeometry = new THREE.ConeGeometry(0.03, arrowLength, 8);
        const arrowMaterial = new THREE.MeshBasicMaterial({ 
            color: color, 
            opacity: 0.9,
            transparent: true
        });
        const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
        const direction = new THREE.Vector3().subVectors(points[1], points[0]).normalize();
        arrow.position.copy(points[1]);
        arrow.lookAt(points[1].clone().add(direction));
        arrow.rotateX(Math.PI / 2);
        helperGroup.add(arrow);
    }
    
    createAxisLine([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(axisLength, 0, 0)
    ], colorX);
    
    createAxisLine([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, axisLength, 0)
    ], colorY);
    
    createAxisLine([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, axisLength)
    ], colorZ);
    
    const sphereGeometry = new THREE.SphereGeometry(0.035, 24, 24);
    const sphereMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffffff,
        opacity: 0.95,
        transparent: true
    });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    helperGroup.add(sphere);
    
    const ringGeometry = new THREE.RingGeometry(0.05, 0.07, 64);
    const ringMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffffff,
        opacity: 0.4,
        transparent: true,
        side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = Math.PI / 2;
    helperGroup.add(ring);
    
    return helperGroup;
}

// Fonction pour créer un helper de bounding box
function createBoundingBoxHelper(mesh) {
    const box = new THREE.Box3().setFromObject(mesh);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    
    const helperGroup = new THREE.Group();
    const boxColor = 0xff9500;
    
    const mainMaterial = new THREE.LineBasicMaterial({ 
        color: boxColor, 
        opacity: 0.7,
        transparent: true,
        linewidth: 2
    });
    
    const glowMaterial = new THREE.LineBasicMaterial({ 
        color: boxColor, 
        opacity: 0.15,
        transparent: true,
        linewidth: 5
    });
    
    const vertices = [
        new THREE.Vector3(center.x - size.x/2, center.y - size.y/2, center.z - size.z/2),
        new THREE.Vector3(center.x + size.x/2, center.y - size.y/2, center.z - size.z/2),
        new THREE.Vector3(center.x + size.x/2, center.y - size.y/2, center.z + size.z/2),
        new THREE.Vector3(center.x - size.x/2, center.y - size.y/2, center.z + size.z/2),
        new THREE.Vector3(center.x - size.x/2, center.y + size.y/2, center.z - size.z/2),
        new THREE.Vector3(center.x + size.x/2, center.y + size.y/2, center.z - size.z/2),
        new THREE.Vector3(center.x + size.x/2, center.y + size.y/2, center.z + size.z/2),
        new THREE.Vector3(center.x - size.x/2, center.y + size.y/2, center.z + size.z/2)
    ];
    
    const edges = [
        [0, 1], [1, 2], [2, 3], [3, 0],
        [4, 5], [5, 6], [6, 7], [7, 4],
        [0, 4], [1, 5], [2, 6], [3, 7]
    ];
    
    edges.forEach(([i, j]) => {
        const geometry = new THREE.BufferGeometry().setFromPoints([vertices[i], vertices[j]]);
        const mainLine = new THREE.Line(geometry, mainMaterial);
        helperGroup.add(mainLine);
        const glowLine = new THREE.Line(geometry, glowMaterial);
        helperGroup.add(glowLine);
    });
    
    const cornerSize = 0.02;
    const cornerGlowSize = 0.03;
    
    vertices.forEach(vertex => {
        const cornerGeometry = new THREE.SphereGeometry(cornerSize, 16, 16);
        const cornerMaterial = new THREE.MeshBasicMaterial({ 
            color: boxColor, 
            opacity: 0.9, 
            transparent: true 
        });
        const corner = new THREE.Mesh(cornerGeometry, cornerMaterial);
        corner.position.copy(vertex);
        helperGroup.add(corner);
        
        const glowGeometry = new THREE.SphereGeometry(cornerGlowSize, 16, 16);
        const glowCornerMaterial = new THREE.MeshBasicMaterial({ 
            color: boxColor, 
            opacity: 0.2, 
            transparent: true 
        });
        const glowCorner = new THREE.Mesh(glowGeometry, glowCornerMaterial);
        glowCorner.position.copy(vertex);
        helperGroup.add(glowCorner);
    });
    
    return helperGroup;
}

// Fonction pour mettre à jour les helpers
function updateHelpers() {
    // Supprimer les anciens helpers
    if (centerHelper) {
        scene.remove(centerHelper);
        centerHelper.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });
        centerHelper = null;
    }
    
    if (boundingBoxHelper) {
        scene.remove(boundingBoxHelper);
        boundingBoxHelper.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });
        boundingBoxHelper = null;
    }
    
    // Créer le helper du centre au centre du tableau
    centerHelper = createCenterHelper();
    if (painting) {
        centerHelper.position.copy(painting.position);
    } else {
        // Position par défaut sur le mur arrière
        const roomSize = 15;
        centerHelper.position.set(0, 1.5, -roomSize / 2 + 0.05);
    }
    scene.add(centerHelper);
    
    // Créer le helper de la bounding box
    if (painting) {
        boundingBoxHelper = createBoundingBoxHelper(painting);
        scene.add(boundingBoxHelper);
    }
}

// Fonction pour créer un cadre autour du tableau
function createFrame(width, height, depth = 0.1) {
    const frameGroup = new THREE.Group();
    const frameMaterial = new THREE.MeshStandardMaterial({
        color: 0x8b7355, // Couleur bois doré
        roughness: 0.6,
        metalness: 0.2
    });
    
    // Cadre supérieur
    const topFrame = new THREE.Mesh(
        new THREE.BoxGeometry(width + depth * 2, depth, depth),
        frameMaterial
    );
    topFrame.position.set(0, height / 2 + depth / 2, 0);
    frameGroup.add(topFrame);
    
    // Cadre inférieur
    const bottomFrame = new THREE.Mesh(
        new THREE.BoxGeometry(width + depth * 2, depth, depth),
        frameMaterial
    );
    bottomFrame.position.set(0, -height / 2 - depth / 2, 0);
    frameGroup.add(bottomFrame);
    
    // Cadre gauche
    const leftFrame = new THREE.Mesh(
        new THREE.BoxGeometry(depth, height, depth),
        frameMaterial
    );
    leftFrame.position.set(-width / 2 - depth / 2, 0, 0);
    frameGroup.add(leftFrame);
    
    // Cadre droit
    const rightFrame = new THREE.Mesh(
        new THREE.BoxGeometry(depth, height, depth),
        frameMaterial
    );
    rightFrame.position.set(width / 2 + depth / 2, 0, 0);
    frameGroup.add(rightFrame);
    
    return frameGroup;
}

// Fonction pour créer une texture de parquet
function createParquetTexture() {
    const size = 512;
    const tileSize = 64; // Taille d'une latte de parquet
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    
    // Couleur de base du parquet (chêne clair)
    const baseColor = '#c9a961';
    const darkColor = '#b8954f';
    const lightColor = '#d4b873';
    
    // Remplir avec la couleur de base
    context.fillStyle = baseColor;
    context.fillRect(0, 0, size, size);
    
    // Dessiner les lattes de parquet (motif chevron ou droit)
    context.strokeStyle = darkColor;
    context.lineWidth = 1;
    
    // Lattes horizontales
    for (let y = 0; y < size; y += tileSize) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(size, y);
        context.stroke();
        
        // Alternance de couleurs pour créer l'effet de parquet
        for (let x = 0; x < size; x += tileSize) {
            const isDark = ((x / tileSize) + (y / tileSize)) % 2 === 0;
            context.fillStyle = isDark ? darkColor : lightColor;
            context.fillRect(x, y, tileSize, tileSize);
        }
    }
    
    // Lignes verticales pour les joints
    for (let x = 0; x < size; x += tileSize) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, size);
        context.stroke();
    }
    
    // Ajouter un peu de grain/texture
    const imageData = context.getImageData(0, 0, size, size);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 10;
        data[i] = Math.max(0, Math.min(255, data[i] + noise));     // R
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise)); // G
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise)); // B
    }
    context.putImageData(imageData, 0, 0);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 4); // Répéter la texture 4x4 fois
    texture.needsUpdate = true;
    
    return texture;
}

// Fonction pour créer le sol de la galerie
function createGalleryFloor() {
    const floorGeometry = new THREE.PlaneGeometry(20, 20);
    const floorTexture = createParquetTexture();
    
    const floorMaterial = new THREE.MeshStandardMaterial({
        map: floorTexture,
        color: 0xd4c4b0, // Couleur de base (parquet chêne clair)
        roughness: 0.8, // Parquet légèrement mat
        metalness: 0.0
    });
    
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2;
    floor.receiveShadow = true;
    return floor;
}

// Fonction pour créer les murs de la galerie
function createGalleryWalls() {
    const wallGroup = new THREE.Group();
    // Couleur standard de musée : blanc cassé neutre (comme le Louvre, Musée d'Orsay)
    // 0xf5f5f0 = blanc cassé très légèrement gris, standard pour les musées
    const wallMaterial = new THREE.MeshStandardMaterial({
        color: 0xf5f5f0, // Blanc cassé neutre standard musée
        roughness: 0.7, // Surface légèrement matte (plâtre)
        metalness: 0.0
    });
    
    const wallHeight = 8;
    const wallDepth = 0.2;
    const roomSize = 15;
    
    // Mur arrière
    const backWall = new THREE.Mesh(
        new THREE.PlaneGeometry(roomSize, wallHeight),
        wallMaterial
    );
    backWall.position.set(0, wallHeight / 2 - 2, -roomSize / 2);
    backWall.rotation.y = 0;
    backWall.receiveShadow = true;
    wallGroup.add(backWall);
    
    // Mur gauche
    const leftWall = new THREE.Mesh(
        new THREE.PlaneGeometry(roomSize, wallHeight),
        wallMaterial
    );
    leftWall.position.set(-roomSize / 2, wallHeight / 2 - 2, 0);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.receiveShadow = true;
    wallGroup.add(leftWall);
    
    // Mur droit
    const rightWall = new THREE.Mesh(
        new THREE.PlaneGeometry(roomSize, wallHeight),
        wallMaterial
    );
    rightWall.position.set(roomSize / 2, wallHeight / 2 - 2, 0);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.receiveShadow = true;
    wallGroup.add(rightWall);
    
    return wallGroup;
}

// Fonction pour créer une texture d'environnement réaliste pour les reflets
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
    const numSpots = 3;
    const spotSpacing = canvas.width / (numSpots + 1);
    for (let i = 1; i <= numSpots; i++) {
        const spotX = i * spotSpacing;
        const spotY = ceilingEnd * 0.5;
        
        // Cône de lumière des spots
        const lightGradient = context.createRadialGradient(spotX, spotY, 0, spotX, spotY, 80);
        lightGradient.addColorStop(0, lightColor);
        lightGradient.addColorStop(0.3, '#fff4e6');
        lightGradient.addColorStop(0.6, '#f5f5f0');
        lightGradient.addColorStop(1, 'transparent');
        
        context.fillStyle = lightGradient;
        context.beginPath();
        context.arc(spotX, spotY, 80, 0, Math.PI * 2);
        context.fill();
        
        // Point lumineux central
        context.fillStyle = lightColor;
        context.beginPath();
        context.arc(spotX, spotY, 3, 0, Math.PI * 2);
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

// Fonction pour charger et créer le tableau
function loadPainting(imageSrc) {
    return new Promise((resolve, reject) => {
        const loader = new THREE.TextureLoader();
        loader.load(
            imageSrc,
            (texture) => {
                // Calculer les dimensions proportionnelles
                const maxWidth = 4;
                const maxHeight = 3;
                const imageAspect = texture.image.height / texture.image.width;
                
                let width, height;
                if (imageAspect > maxHeight / maxWidth) {
                    height = maxHeight;
                    width = height / imageAspect;
                } else {
                    width = maxWidth;
                    height = width * imageAspect;
                }
                
                // Créer le plan avec la texture
                const geometry = new THREE.PlaneGeometry(width, height);
                
                // Créer un matériau personnalisé avec reflet réaliste de vernis/verre
                // Paramètres optimisés pour simuler un tableau encadré avec verre protecteur
                const material = new THREE.MeshPhysicalMaterial({
                    map: texture,
                    side: THREE.DoubleSide,
                    roughness: 0.02, // Surface très lisse (verre/vernis brillant)
                    metalness: 0.0,
                    clearcoat: 1.0, // Couche de vernis/verre transparente maximale
                    clearcoatRoughness: 0.08, // Vernis très lisse avec légère rugosité pour réalisme
                    reflectivity: 0.4, // Réflexion plus prononcée (comme un verre de protection)
                    envMapIntensity: 0.6, // Intensité augmentée pour reflets plus visibles
                    ior: 1.5, // Indice de réfraction du verre (standard pour verre/vernis)
                    transmission: 0.0, // Pas de transmission (tableau opaque)
                    thickness: 0.0 // Pas d'épaisseur (surface plane)
                });
                
                // Créer l'environnement map pour les reflets
                const envMap = createEnvironmentMap();
                if (envMap) {
                    material.envMap = envMap;
                }
                
                painting = new THREE.Mesh(geometry, material);
                // Positionner le tableau contre le mur arrière
                const roomSize = 15;
                const wallZ = -roomSize / 2;
                const paintingOffset = 0.05; // Légèrement devant le mur pour éviter le z-fighting
                const paintingHeight = 1.5; // Hauteur du centre du tableau (à hauteur des yeux)
                
                painting.position.set(0, paintingHeight, wallZ + paintingOffset);
                painting.castShadow = true;
                painting.receiveShadow = true;
                
                // Créer le cadre
                paintingFrame = createFrame(width, height, 0.15);
                paintingFrame.position.copy(painting.position);
                paintingFrame.position.z = painting.position.z - 0.01; // Légèrement devant le tableau
                paintingFrame.castShadow = true;
                
                scene.add(painting);
                scene.add(paintingFrame);
                
                // Mettre à jour les helpers
                updateHelpers();
                
                resolve();
            },
            undefined,
            (error) => {
                console.error('Erreur lors du chargement de l\'image:', error);
                reject(error);
            }
        );
    });
}

// Fonction d'initialisation
function init() {
    try {
        const container = document.getElementById('canvas-container');
        if (!container) {
            console.error('Canvas container not found');
            return;
        }
        
        // Récupérer les paramètres d'URL
        const params = getURLParams();
        if (!params.image) {
            document.getElementById('loading').textContent = 'Erreur: Aucune image spécifiée';
            return;
        }
        
        // Mettre à jour les infos de l'œuvre
        if (params.title) {
            document.getElementById('artwork-title').textContent = decodeURIComponent(params.title);
        }
        if (params.artist) {
            document.getElementById('artwork-artist').textContent = decodeURIComponent(params.artist);
        }
        if (params.title || params.artist) {
            document.getElementById('gallery-info').style.display = 'block';
        }
        
        // Scène avec fond clair (galerie)
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0xf5f5f0); // Blanc cassé neutre standard musée
        scene.fog = new THREE.FogExp2(0xf5f5f0, 0.015); // Brume légère
        
        // Caméra
        camera = new THREE.PerspectiveCamera(
            45,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        // Positionner la caméra plus proche du tableau, à hauteur des yeux (1.5m)
        // Distance optimale pour apprécier une œuvre : environ 3-4 unités
        camera.position.set(0, 1.5, 3.5);
        camera.lookAt(0, 1.5, -7.5); // Regarder vers le mur arrière où sera le tableau
        
        // Renderer
        renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            powerPreference: 'high-performance'
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.2; // Exposition légèrement augmentée pour meilleur rendu
        container.appendChild(renderer.domElement);
        
        // Contrôles de la caméra (OrbitControls)
        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.minDistance = 1.5; // Permettre de se rapprocher davantage
        controls.maxDistance = 12; // Permettre de s'éloigner un peu plus
        controls.enablePan = true;
        controls.panSpeed = 0.8;
        controls.rotateSpeed = 0.5;
        controls.zoomSpeed = 1.2;
        // Cibler le centre du tableau sur le mur
        controls.target.set(0, 1.5, -7.5);
        controls.update();
        
        // Lumières
        setupLights();
        
        // Sol de la galerie
        const floor = createGalleryFloor();
        scene.add(floor);
        
        // Murs de la galerie
        const walls = createGalleryWalls();
        scene.add(walls);
        
        // Charger le tableau
        loadPainting(params.image).then(() => {
            // Masquer le loading
            const loadingElement = document.getElementById('loading');
            if (loadingElement) {
                loadingElement.style.display = 'none';
            }
            
            // Démarrer l'animation
            animate();
        }).catch((error) => {
            document.getElementById('loading').textContent = 'Erreur de chargement: ' + error.message;
            document.getElementById('loading').style.color = '#ff0000';
        });
        
    } catch (error) {
        console.error('Error during initialization:', error);
        const loadingElement = document.getElementById('loading');
        if (loadingElement) {
            loadingElement.textContent = 'Erreur de chargement: ' + error.message;
            loadingElement.style.color = '#ff0000';
        }
    }
}

// Fonction de fermeture
function closeGallery3D() {
    // Nettoyer les ressources
    if (scene) {
        scene.traverse((object) => {
            if (object.geometry) object.geometry.dispose();
            if (object.material) {
                if (Array.isArray(object.material)) {
                    object.material.forEach(mat => mat.dispose());
                } else {
                    object.material.dispose();
                }
            }
        });
    }
    
    // Fermer la fenêtre ou retourner en arrière
    if (window.history.length > 1) {
        window.history.back();
    } else {
        window.close();
    }
}

// Boucle d'animation
function animate() {
    requestAnimationFrame(animate);
    
    if (!renderer || !scene || !camera) return;
    
    // Mettre à jour les contrôles
    if (controls) {
        controls.update();
    }
    
    // Mettre à jour les helpers de lumière (suivre les positions des lumières)
    // Parcourir toutes les lumières dans la scène et mettre à jour leurs helpers
    scene.children.forEach((child) => {
        if (child.type === 'SpotLight' || child.type === 'PointLight') {
            // Trouver le helper correspondant par position
            const helper = lightHelpers.find(h => 
                Math.abs(h.position.x - child.position.x) < 0.5 &&
                Math.abs(h.position.y - child.position.y) < 0.5 &&
                Math.abs(h.position.z - child.position.z) < 0.5
            );
            
            if (helper) {
                helper.position.copy(child.position);
                // Pour SpotLight, orienter le helper vers le target
                if (child.type === 'SpotLight' && child.target) {
                    helper.lookAt(child.target.position);
                }
            }
        }
    });
    
    // Rendu
    renderer.render(scene, camera);
}

// Gestion du redimensionnement
window.addEventListener('resize', () => {
    if (!camera || !renderer) return;
    
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Fonction pour mettre à jour l'intensité des spots
function updateSpotIntensity(intensity) {
    spotLights.forEach(spot => {
        spot.intensity = intensity;
    });
    
    // Mettre à jour l'affichage de la valeur
    const valueDisplay = document.getElementById('spot-intensity-value');
    if (valueDisplay) {
        valueDisplay.textContent = intensity.toFixed(1);
    }
}

// Fonction pour basculer entre le mode "jour" et le mode "spots uniquement"
function toggleSpotOnlyMode(enabled) {
    const wasInSpotOnlyMode = spotOnlyMode;
    spotOnlyMode = enabled;
    
    if (enabled) {
        // Mode "spots uniquement" : éteindre la lumière ambiante et la lumière de remplissage
        if (ambientLight) {
            ambientLight.intensity = 0;
        }
        if (fillLight) {
            fillLight.intensity = 0;
        }
        // Augmenter légèrement l'intensité des spots pour compenser
        const slider = document.getElementById('spot-intensity-slider');
        const currentSliderValue = slider ? parseFloat(slider.value) : 1.0;
        const newIntensity = Math.min(currentSliderValue * 1.5, 3.0);
        spotLights.forEach(spot => {
            spot.intensity = newIntensity;
        });
        // Mettre à jour l'affichage du slider
        const valueDisplay = document.getElementById('spot-intensity-value');
        if (valueDisplay) {
            valueDisplay.textContent = newIntensity.toFixed(1);
        }
    } else {
        // Mode "jour" : rallumer la lumière ambiante et la lumière de remplissage
        if (ambientLight) {
            ambientLight.intensity = 0.5;
        }
        if (fillLight) {
            fillLight.intensity = 0.4;
        }
        // Restaurer l'intensité normale des spots
        const slider = document.getElementById('spot-intensity-slider');
        if (slider) {
            const currentIntensity = parseFloat(slider.value);
            // Si on était en mode spots uniquement, diviser par 1.5 pour revenir à la valeur originale
            const originalIntensity = wasInSpotOnlyMode ? currentIntensity / 1.5 : currentIntensity;
            spotLights.forEach(spot => {
                spot.intensity = originalIntensity;
            });
            updateSpotIntensity(originalIntensity);
        }
    }
}

// Gestion de la fermeture (attendre que le DOM soit chargé)
function setupEventListeners() {
    const closeButton = document.getElementById('gallery-close');
    if (closeButton) {
        closeButton.addEventListener('click', closeGallery3D);
    }
    
    // Slider d'intensité des spots
    const spotIntensitySlider = document.getElementById('spot-intensity-slider');
    if (spotIntensitySlider) {
        spotIntensitySlider.addEventListener('input', (e) => {
            const intensity = parseFloat(e.target.value);
            // Si on est en mode spots uniquement, appliquer le multiplicateur
            const actualIntensity = spotOnlyMode ? Math.min(intensity * 1.5, 3.0) : intensity;
            updateSpotIntensity(actualIntensity);
        });
    }
    
    // Toggle "spots uniquement"
    const spotOnlyToggle = document.getElementById('spot-only-toggle');
    if (spotOnlyToggle) {
        spotOnlyToggle.addEventListener('change', (e) => {
            toggleSpotOnlyMode(e.target.checked);
        });
    }
    
    // Fermeture avec ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeGallery3D();
        }
    });
}

// Initialisation quand le DOM est prêt
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setupEventListeners();
        init();
    });
} else {
    setupEventListeners();
    init();
}

