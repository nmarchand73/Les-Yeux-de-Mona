import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RectAreaLightHelper } from 'three/addons/helpers/RectAreaLightHelper.js';

// Variables globales
let scene, camera, renderer, controls;
let painting, paintingFrame, easel;
// Variables globales pour la position du tableau (utilisées dans les animations)
let paintingCenterY = 1.5; // Hauteur du centre du tableau
let paintingZ = -7.5; // Position Z du tableau (contre le mur)
let paintingMode = 'wall'; // Mode d'affichage : 'wall' (mur) ou 'easel' (chevalet)
let mainLight, fillLight, backLight;
let centerHelper, boundingBoxHelper;
let lightHelpers = [];
let spotLights = []; // Tableau pour stocker tous les spots
let spotHelpers = []; // Tableau pour stocker les helpers des spots (pour animation)
let ambientLight = null; // Lumière ambiante (pour pouvoir l'éteindre)
let spotOnlyMode = false; // Mode "spots uniquement"
let currentLightConfigName = 'gallery-spots'; // Configuration d'éclairage active
let directionalLight = null; // Lumière directionnelle (pour config jour)
let areaLight = null; // Lumière de zone (pour config jour)
let animationEnabled = false; // Animation des spots activée
let animationTime = 0; // Temps pour l'animation

// Configurations d'éclairage
const lightConfigurations = {
    'gallery-spots': {
        name: 'Galerie spots',
        spots: {
            enabled: true,
            count: 3,
            colorTemperature: 0xfff4e5, // ~4000K (blanc neutre, norme galerie)
            defaultIntensity: 1.0,
            spacing: 0.8, // 80 cm entre les spots
            distanceFromWall: 0.6, // 60 cm du mur
            angle: 30 * Math.PI / 180, // Angle de 30° vers le tableau
            beamAngle: 40 * Math.PI / 180, // Angle du faisceau de 40°
            distance: 20,
            penumbra: 0.3,
            decay: 1.5
        },
        ambientLight: {
            enabled: true,
            color: 0xffffff,
            intensity: 0.5
        },
        fillLight: {
            enabled: true,
            type: 'point',
            color: 0xffffff,
            intensity: 0.4,
            position: { x: 0, y: 5, z: 0 } // ceilingHeight - 1
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
            enabled: false // Pièce dans le noir, seule la fenêtre éclaire
        },
        fillLight: {
            enabled: false // Pas de lumière de remplissage
        },
        directionalLight: {
            enabled: false // Pas de lumière directionnelle, seule la fenêtre
        },
        areaLight: {
            enabled: true,
            color: 0xe6f0ff, // ~6500K (blanc bleuté, ciel)
            intensity: 4.0, // Intensité augmentée car seule source de lumière
            width: 2.5, // Largeur de la fenêtre (plus large)
            height: 3.5, // Hauteur de la fenêtre (plus haute)
            position: { x: -7.4, y: 2.5, z: 0 } // Légèrement devant le mur pour éviter z-fighting
        }
    },
    'corner-spots': {
        name: 'Spots aux coins',
        spots: {
            enabled: true,
            count: 2, // 2 spots aux coins
            colorTemperature: 0xfff4e5, // ~4000K (blanc neutre)
            defaultIntensity: 1.2, // Intensité légèrement plus élevée pour éclairage focalisé
            spacing: 0, // Pas d'espacement (positions personnalisées)
            distanceFromWall: 0.4, // Plus proche du mur pour éclairage focalisé
            angle: 25 * Math.PI / 180, // Angle plus serré (25°)
            beamAngle: 30 * Math.PI / 180, // Faisceau plus serré (30°) pour spots focalisés
            distance: 15,
            penumbra: 0.2, // Pénombre réduite pour faisceau plus net
            decay: 1.5,
            // Positions personnalisées aux coins supérieurs du tableau
            // Le tableau est centré à (0, 1.5, -7.5) avec largeur ~4 et hauteur ~3
            customPositions: [
                { x: -2.0, y: 4.0, z: -6.0 }, // Spot coin supérieur gauche (au-dessus et devant)
                { x: 2.0, y: 4.0, z: -6.0 }  // Spot coin supérieur droit (au-dessus et devant)
            ],
            // Cibles personnalisées (coins supérieurs du tableau)
            customTargets: [
                { x: -2.0, y: 3.0, z: -7.5 }, // Coin supérieur gauche du tableau
                { x: 2.0, y: 3.0, z: -7.5 }  // Coin supérieur droit du tableau
            ]
        },
        ambientLight: {
            enabled: false // Pièce dans le noir pour mettre en valeur les spots
        },
        fillLight: {
            enabled: false // Pas de lumière de remplissage
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
            colorTemperature: 0xfff4e5, // ~4000K (blanc neutre)
            defaultIntensity: 0.3, // Intensité réduite pour les spots animés (effet visuel uniquement)
            spacing: 0.8, // 80 cm entre les spots
            distanceFromWall: 0.6, // 60 cm du mur
            angle: 30 * Math.PI / 180, // Angle de 30° vers le tableau
            beamAngle: 40 * Math.PI / 180, // Angle du faisceau de 40°
            distance: 20,
            penumbra: 0.3,
            decay: 1.5,
            animated: true // Activer l'animation pour cette configuration
        },
        ambientLight: {
            enabled: true,
            color: 0xffffff,
            intensity: 0.3 // Réduite pour effet dramatique
        },
        fillLight: {
            enabled: true, // Lumière de remplissage pour éclairer le tableau de manière constante
            type: 'point',
            color: 0xffffff,
            intensity: 0.8, // Intensité élevée pour bien éclairer le tableau
            position: { x: 0, y: 4.5, z: -6.5 } // Position fixe au-dessus du tableau
        },
        directionalLight: {
            enabled: false
        },
        areaLight: {
            enabled: false
        }
    }
};

// Fonction pour récupérer les paramètres d'URL
function getURLParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        image: params.get('image') || '',
        title: params.get('title') || '',
        artist: params.get('artist') || '',
        height: params.get('height') || null, // Hauteur en cm
        width: params.get('width') || null    // Largeur en cm
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
    } else if (light.type === 'RectAreaLight') {
        // Helper pour RectAreaLight : utiliser RectAreaLightHelper
        const helper = new RectAreaLightHelper(light);
        helperGroup.add(helper);
    }
    
    // Positionner le helper à la position de la lumière
    helperGroup.position.copy(light.position);
    
    return helperGroup;
}

// Configuration des lumières selon la configuration sélectionnée
function setupLights(configName = 'gallery-spots') {
    // Nettoyer les anciens helpers et lumières
    lightHelpers.forEach(helper => {
        scene.remove(helper);
        helper.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });
    });
    lightHelpers = [];
    spotHelpers = []; // Réinitialiser aussi le tableau des helpers de spots
    spotLights = []; // Réinitialiser le tableau des spots
    
    // Supprimer les anciennes lumières de la scène
    if (fillLight) {
        scene.remove(fillLight);
        fillLight = null;
    }
    if (ambientLight) {
        scene.remove(ambientLight);
        ambientLight = null;
    }
    if (directionalLight) {
        scene.remove(directionalLight);
        directionalLight = null;
    }
    if (areaLight) {
        scene.remove(areaLight);
        areaLight = null;
    }
    
    // Charger la configuration
    const config = lightConfigurations[configName];
    if (!config) {
        console.error(`Configuration d'éclairage "${configName}" non trouvée`);
        return;
    }
    
    currentLightConfigName = configName;
    
    // Paramètres constants de la scène
    const ceilingHeight = 6; // Hauteur du plafond
    const paintingCenterY = 1.5; // Hauteur du centre du tableau
    const paintingZ = -7.5; // Position Z du tableau (contre le mur)
    
    // Créer les spots si activés
    if (config.spots && config.spots.enabled) {
        const spotsConfig = config.spots;
        const numSpots = spotsConfig.count;
        
        // Vérifier si des positions personnalisées sont définies
        const hasCustomPositions = spotsConfig.customPositions && spotsConfig.customPositions.length === numSpots;
        const hasCustomTargets = spotsConfig.customTargets && spotsConfig.customTargets.length === numSpots;
        
        for (let i = 0; i < numSpots; i++) {
            let spotX, spotY, spotZ;
            let targetX, targetY, targetZ;
            
            if (hasCustomPositions && hasCustomTargets) {
                // Utiliser les positions et cibles personnalisées
                spotX = spotsConfig.customPositions[i].x;
                spotY = spotsConfig.customPositions[i].y;
                spotZ = spotsConfig.customPositions[i].z;
                targetX = spotsConfig.customTargets[i].x;
                targetY = spotsConfig.customTargets[i].y;
                targetZ = spotsConfig.customTargets[i].z;
            } else {
                // Calculer les positions selon le schéma standard
                const totalWidth = (numSpots - 1) * spotsConfig.spacing;
                const startX = -totalWidth / 2;
                spotX = startX + i * spotsConfig.spacing;
                spotY = ceilingHeight;
                spotZ = paintingZ + spotsConfig.distanceFromWall + 
                         (ceilingHeight - paintingCenterY) * Math.tan(spotsConfig.angle);
                targetX = spotX;
                targetY = paintingCenterY;
                targetZ = paintingZ;
            }
            
            const spot = new THREE.SpotLight(
                spotsConfig.colorTemperature,
                spotsConfig.defaultIntensity,
                spotsConfig.distance,
                spotsConfig.beamAngle,
                spotsConfig.penumbra,
                spotsConfig.decay
            );
            spot.position.set(spotX, spotY, spotZ);
            spot.target.position.set(targetX, targetY, targetZ);
            spot.castShadow = true;
            
            // Configuration optimale des ombres pour spots
            spot.shadow.mapSize.width = 4096;
            spot.shadow.mapSize.height = 4096;
            spot.shadow.camera.near = 0.1;
            spot.shadow.camera.far = 20;
            spot.shadow.bias = -0.0001; // Bias ajusté pour éviter les artefacts
            spot.shadow.normalBias = 0.02; // Normal bias pour surfaces inclinées
            spot.shadow.radius = 8; // Ombres plus douces
            spot.shadow.blurSamples = 25; // Plus d'échantillons pour qualité
            // Ajuster la caméra d'ombre pour couvrir la zone éclairée
            spot.shadow.camera.fov = 50; // Champ de vision adapté au faisceau
            spot.shadow.camera.updateProjectionMatrix();
            
            scene.add(spot);
            scene.add(spot.target);
            spotLights.push(spot);
            
            const spotHelper = createLightHelper(spot);
            scene.add(spotHelper);
            lightHelpers.push(spotHelper);
            spotHelpers.push(spotHelper); // Stocker aussi dans le tableau dédié pour animation
            
            if (i === 0) {
                mainLight = spot;
            }
        }
    }
    
    // Créer la lumière de remplissage si activée
    if (config.fillLight && config.fillLight.enabled) {
        fillLight = new THREE.PointLight(
            config.fillLight.color,
            config.fillLight.intensity
        );
        fillLight.position.set(
            config.fillLight.position.x,
            config.fillLight.position.y,
            config.fillLight.position.z
        );
        scene.add(fillLight);
        
        const fillLightHelper = createLightHelper(fillLight);
        scene.add(fillLightHelper);
        lightHelpers.push(fillLightHelper);
    }
    
    // Créer la lumière ambiante si activée
    if (config.ambientLight && config.ambientLight.enabled) {
        ambientLight = new THREE.AmbientLight(
            config.ambientLight.color,
            config.ambientLight.intensity
        );
        scene.add(ambientLight);
    }
    
    // Créer la lumière directionnelle si activée
    if (config.directionalLight && config.directionalLight.enabled) {
        directionalLight = new THREE.DirectionalLight(
            config.directionalLight.color,
            config.directionalLight.intensity
        );
        directionalLight.position.set(
            config.directionalLight.position.x,
            config.directionalLight.position.y,
            config.directionalLight.position.z
        );
        directionalLight.target.position.set(
            config.directionalLight.target.x,
            config.directionalLight.target.y,
            config.directionalLight.target.z
        );
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 4096;
        directionalLight.shadow.mapSize.height = 4096;
        directionalLight.shadow.camera.near = 0.1;
        directionalLight.shadow.camera.far = 25;
        // Ajuster la caméra orthographique pour couvrir toute la scène
        directionalLight.shadow.camera.left = -12;
        directionalLight.shadow.camera.right = 12;
        directionalLight.shadow.camera.top = 8;
        directionalLight.shadow.camera.bottom = -4;
        directionalLight.shadow.camera.updateProjectionMatrix();
        directionalLight.shadow.bias = -0.0002;
        directionalLight.shadow.normalBias = 0.02;
        directionalLight.shadow.radius = 10; // Ombres très douces pour lumière du jour
        directionalLight.shadow.blurSamples = 25;
        
        scene.add(directionalLight);
        scene.add(directionalLight.target);
        
        const dirLightHelper = createLightHelper(directionalLight);
        scene.add(dirLightHelper);
        lightHelpers.push(dirLightHelper);
        
        if (!mainLight) {
            mainLight = directionalLight;
        }
    }
    
    // Créer la lumière de zone (AreaLight) si activée
    if (config.areaLight && config.areaLight.enabled) {
        // Note: AreaLight nécessite RectAreaLight dans Three.js
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
        // Orienter la lumière vers l'intérieur de la pièce (vers la droite, direction positive X)
        // Rotation pour que la lumière émette depuis le mur gauche vers l'intérieur
        areaLight.rotation.y = -Math.PI / 2; // Rotation de 90° pour pointer vers la droite
        areaLight.rotation.x = 0; // Pas de rotation verticale
        scene.add(areaLight);
        
        // Utiliser RectAreaLightHelper pour RectAreaLight
        const areaLightHelper = new RectAreaLightHelper(areaLight);
        scene.add(areaLightHelper);
        lightHelpers.push(areaLightHelper);
        
        // Note: RectAreaLight ne projette pas d'ombres directement dans Three.js
        // Pour des ombres réalistes avec AreaLight, on pourrait utiliser une DirectionalLight
        // ou un système de shadow mapping personnalisé, mais cela dépasse le scope actuel
    }
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
    topFrame.castShadow = true;
    topFrame.receiveShadow = true;
    frameGroup.add(topFrame);
    
    // Cadre inférieur
    const bottomFrame = new THREE.Mesh(
        new THREE.BoxGeometry(width + depth * 2, depth, depth),
        frameMaterial
    );
    bottomFrame.position.set(0, -height / 2 - depth / 2, 0);
    bottomFrame.castShadow = true;
    bottomFrame.receiveShadow = true;
    frameGroup.add(bottomFrame);
    
    // Cadre gauche
    const leftFrame = new THREE.Mesh(
        new THREE.BoxGeometry(depth, height, depth),
        frameMaterial
    );
    leftFrame.position.set(-width / 2 - depth / 2, 0, 0);
    leftFrame.castShadow = true;
    leftFrame.receiveShadow = true;
    frameGroup.add(leftFrame);
    
    // Cadre droit
    const rightFrame = new THREE.Mesh(
        new THREE.BoxGeometry(depth, height, depth),
        frameMaterial
    );
    rightFrame.position.set(width / 2 + depth / 2, 0, 0);
    rightFrame.castShadow = true;
    rightFrame.receiveShadow = true;
    frameGroup.add(rightFrame);
    
    return frameGroup;
}

// Fonction pour créer un chevalet moderne et simple
function createEasel() {
    const easelGroup = new THREE.Group();
    
    // Matériau du chevalet (métal moderne)
    const easelMaterial = new THREE.MeshStandardMaterial({
        color: 0x6b6b6b, // Gris métallique moderne
        roughness: 0.3,
        metalness: 0.7
    });
    
    // Dimensions du chevalet moderne
    const legHeight = 2.0; // Hauteur totale des pieds
    const legThickness = 0.04; // Épaisseur des barres
    const frontSpread = 1.0; // Écartement des pieds avant
    const backDistance = 0.65; // Distance du pied arrière
    
    // Position de base (niveau du sol)
    const baseY = -2;
    
    // Pied avant gauche
    const leftLeg = new THREE.Mesh(
        new THREE.BoxGeometry(legThickness, legHeight, legThickness),
        easelMaterial
    );
    leftLeg.position.set(-frontSpread / 2, baseY + legHeight / 2, 0);
    easelGroup.add(leftLeg);
    
    // Pied avant droit
    const rightLeg = new THREE.Mesh(
        new THREE.BoxGeometry(legThickness, legHeight, legThickness),
        easelMaterial
    );
    rightLeg.position.set(frontSpread / 2, baseY + legHeight / 2, 0);
    easelGroup.add(rightLeg);
    
    // Pied arrière
    const backLeg = new THREE.Mesh(
        new THREE.BoxGeometry(legThickness, legHeight, legThickness),
        easelMaterial
    );
    backLeg.position.set(0, baseY + legHeight / 2, -backDistance);
    easelGroup.add(backLeg);
    
    // Traverse supérieure (support du haut du tableau)
    const topBar = new THREE.Mesh(
        new THREE.BoxGeometry(frontSpread + 0.1, legThickness, legThickness),
        easelMaterial
    );
    topBar.position.set(0, baseY + legHeight - 0.15, 0);
    easelGroup.add(topBar);
    
    // Traverse inférieure (support du bas)
    const bottomBar = new THREE.Mesh(
        new THREE.BoxGeometry(frontSpread + 0.1, legThickness, legThickness),
        easelMaterial
    );
    bottomBar.position.set(0, baseY + legHeight / 2 - 0.25, 0);
    easelGroup.add(bottomBar);
    
    // Support arrière (barre diagonale reliant le haut au pied arrière)
    const supportHeight = 0.65;
    const supportLength = Math.sqrt(backDistance * backDistance + supportHeight * supportHeight);
    const supportBar = new THREE.Mesh(
        new THREE.BoxGeometry(legThickness, supportLength, legThickness),
        easelMaterial
    );
    supportBar.position.set(0, baseY + legHeight - 0.3, -backDistance / 2);
    supportBar.rotation.z = Math.atan2(supportHeight, backDistance);
    easelGroup.add(supportBar);
    
    // Ajouter des ombres
    easelGroup.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });
    
    return easelGroup;
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
        roughness: 0.75, // Parquet légèrement mat avec reflets subtils
        metalness: 0.0,
        envMapIntensity: 0.3, // Reflets subtils de l'environnement
        flatShading: false // Smooth shading pour meilleur rendu
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
        roughness: 0.65, // Surface légèrement matte (plâtre) avec reflets subtils
        metalness: 0.0,
        envMapIntensity: 0.2, // Reflets très subtils de l'environnement
        flatShading: false // Smooth shading pour meilleur rendu
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
    backWall.castShadow = false; // Les murs ne projettent pas d'ombres
    wallGroup.add(backWall);
    
    // Mur gauche
    const leftWall = new THREE.Mesh(
        new THREE.PlaneGeometry(roomSize, wallHeight),
        wallMaterial
    );
    leftWall.position.set(-roomSize / 2, wallHeight / 2 - 2, 0);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.receiveShadow = true;
    leftWall.castShadow = false;
    wallGroup.add(leftWall);
    
    // Mur droit
    const rightWall = new THREE.Mesh(
        new THREE.PlaneGeometry(roomSize, wallHeight),
        wallMaterial
    );
    rightWall.position.set(roomSize / 2, wallHeight / 2 - 2, 0);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.receiveShadow = true;
    rightWall.castShadow = false;
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
// Simule la texture de la toile sous la peinture et le vernis
function createCanvasNormalMap() {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    
    // Créer un motif de grain de toile (tissage)
    // Les toiles ont un motif de tissage avec des fils qui se croisent
    const threadSize = 3; // Taille des fils de la toile (augmentée pour plus de visibilité)
    const threadSpacing = 5; // Espacement entre les fils (augmenté pour plus de visibilité)
    
    // Remplir avec une couleur neutre (128, 128, 255 pour normal map)
    // Le bleu à 255 indique une surface plane normale
    context.fillStyle = 'rgb(128, 128, 255)';
    context.fillRect(0, 0, size, size);
    
    // Dessiner le motif de tissage (chaîne et trame)
    // Fils horizontaux (trame)
    for (let y = 0; y < size; y += threadSpacing) {
        context.fillStyle = 'rgb(100, 100, 255)'; // Légèrement plus sombre = légèrement en relief
        context.fillRect(0, y, size, threadSize);
    }
    
    // Fils verticaux (chaîne)
    for (let x = 0; x < size; x += threadSpacing) {
        context.fillStyle = 'rgb(100, 100, 255)';
        context.fillRect(x, 0, threadSize, size);
    }
    
    // Ajouter des variations subtiles pour simuler l'irrégularité de la toile
    const imageData = context.getImageData(0, 0, size, size);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
        // Générer un bruit plus prononcé pour simuler les imperfections de la toile
        const noise = (Math.random() - 0.5) * 15; // Variation plus importante pour plus de visibilité
        
        // Ajuster les valeurs RGB pour créer une normal map
        // R et G représentent les directions X et Y de la normale
        // B représente la profondeur (Z)
        data[i] = Math.max(0, Math.min(255, data[i] + noise));     // R (X)
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise)); // G (Y)
        data[i + 2] = Math.max(180, Math.min(255, data[i + 2] + noise * 0.8)); // B (Z) - plus de variation pour relief plus visible
    }
    
    context.putImageData(imageData, 0, 0);
    
    // Convertir en texture
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2); // Répéter la texture pour couvrir tout le tableau
    texture.needsUpdate = true;
    
    return texture;
}

// Fonction pour créer une texture de grain de toile (pour la rugosité)
function createCanvasRoughnessMap() {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    
    // Créer un motif de grain subtil
    // Les toiles ont une rugosité légèrement variable
    const baseRoughness = 128; // Rugosité de base (0-255, 128 = moyen)
    
    // Remplir avec la rugosité de base
    context.fillStyle = `rgb(${baseRoughness}, ${baseRoughness}, ${baseRoughness})`;
    context.fillRect(0, 0, size, size);
    
    // Ajouter des variations subtiles de rugosité
    const imageData = context.getImageData(0, 0, size, size);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
        // Variation subtile de rugosité pour simuler le grain de la toile
        const roughnessVariation = (Math.random() - 0.5) * 15;
        const roughness = Math.max(100, Math.min(155, baseRoughness + roughnessVariation));
        
        data[i] = roughness;     // R
        data[i + 1] = roughness; // G
        data[i + 2] = roughness; // B
        data[i + 3] = 255;       // Alpha
    }
    
    context.putImageData(imageData, 0, 0);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2);
    texture.needsUpdate = true;
    
    return texture;
}

// Fonction pour charger et créer le tableau
function loadPainting(imageSrc, realHeight = null, realWidth = null) {
    return new Promise((resolve, reject) => {
        const loader = new THREE.TextureLoader();
        loader.load(
            imageSrc,
            (texture) => {
                // Configurer la texture pour préserver les couleurs originales
                texture.colorSpace = THREE.SRGBColorSpace; // Assurer le bon espace colorimétrique
                // flipY reste à true par défaut (Three.js gère automatiquement l'inversion nécessaire)
                
                // Calculer les dimensions
                let width, height;
                
                if (realHeight && realWidth) {
                    // Utiliser les dimensions réelles (convertir de cm en mètres)
                    height = parseFloat(realHeight) / 100; // Convertir cm en mètres
                    width = parseFloat(realWidth) / 100;   // Convertir cm en mètres
                } else {
                    // Fallback : calculer les dimensions proportionnelles à partir de l'image
                    const maxWidth = 4;
                    const maxHeight = 3;
                    const imageAspect = texture.image.height / texture.image.width;
                    
                    if (imageAspect > maxHeight / maxWidth) {
                        height = maxHeight;
                        width = height / imageAspect;
                    } else {
                        width = maxWidth;
                        height = width * imageAspect;
                    }
                }
                
                // Créer le plan avec la texture
                const geometry = new THREE.PlaneGeometry(width, height);
                
                // Créer les textures de grain de toile
                const canvasNormalMap = createCanvasNormalMap();
                const canvasRoughnessMap = createCanvasRoughnessMap();
                
                // Créer un matériau personnalisé avec reflet réaliste de vernis/verre
                // Paramètres optimisés pour simuler un tableau encadré avec verre protecteur
                // Le matériau simule : toile (avec grain) -> peinture -> vernis/verre (reflets)
                const frontMaterial = new THREE.MeshPhysicalMaterial({
                    map: texture, // Texture de l'image du tableau
                    normalMap: canvasNormalMap, // Normal map pour le grain de la toile
                    normalScale: new THREE.Vector2(0.8, 0.8), // Intensité du relief augmentée pour être visible de biais
                    roughnessMap: canvasRoughnessMap, // Carte de rugosité pour variations subtiles
                    side: THREE.FrontSide, // Face avant uniquement
                    roughness: 0.4, // Rugosité modérée pour préserver les couleurs
                    metalness: 0.0,
                    clearcoat: 0.1, // Vernis très réduit pour préserver les couleurs originales
                    clearcoatRoughness: 0.3, // Vernis rugueux pour moins d'atténuation
                    clearcoatNormalMap: canvasNormalMap, // Le vernis suit aussi le grain de la toile
                    clearcoatNormalScale: new THREE.Vector2(0.5, 0.5), // Relief modéré
                    reflectivity: 0.1, // Réflexion très réduite pour préserver les couleurs
                    envMapIntensity: 0.15, // Intensité très réduite pour préserver les couleurs
                    ior: 1.5, // Indice de réfraction du verre (standard pour verre/vernis)
                    transmission: 0.0, // Pas de transmission (tableau opaque)
                    thickness: 0.0 // Pas d'épaisseur (surface plane)
                });
                
                // Créer l'environnement map pour les reflets (très subtil pour préserver les couleurs)
                const envMap = createEnvironmentMap();
                if (envMap) {
                    frontMaterial.envMap = envMap;
                }
                
                // Créer le matériau pour le dos du tableau (opaque, couleur toile/bois)
                const backMaterial = new THREE.MeshStandardMaterial({
                    color: 0xd4c4b0, // Couleur toile brute/bois clair
                    roughness: 0.8, // Surface matte
                    metalness: 0.0,
                    side: THREE.FrontSide, // Face avant du plan (qui sera tourné vers l'arrière)
                    transparent: false, // Complètement opaque
                    opacity: 1.0 // Opacité maximale
                });
                
                // Créer un groupe pour contenir les deux faces du tableau
                const paintingGroup = new THREE.Group();
                
                // Face avant (avec l'image) - rendue en premier
                const frontPainting = new THREE.Mesh(geometry, frontMaterial);
                frontPainting.castShadow = true;
                frontPainting.receiveShadow = true;
                frontPainting.renderOrder = 1; // Rendu en premier
                paintingGroup.add(frontPainting);
                
                // Face arrière (opaque) - légèrement décalée et rendue en second
                const backPainting = new THREE.Mesh(geometry, backMaterial);
                backPainting.rotation.y = Math.PI; // Rotation de 180° pour la face arrière
                backPainting.position.z = -0.02; // Légèrement en arrière pour éviter le z-fighting
                backPainting.castShadow = true;
                backPainting.receiveShadow = true;
                backPainting.renderOrder = 0; // Rendu en second
                paintingGroup.add(backPainting);
                
                painting = paintingGroup;
                
                // Créer le cadre
                paintingFrame = createFrame(width, height, 0.15);
                paintingFrame.castShadow = true;
                paintingFrame.receiveShadow = true;
                
                // S'assurer que tous les enfants du cadre projettent et reçoivent des ombres
                paintingFrame.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });
                
                // Positionner le tableau selon le mode (mur ou chevalet)
                positionPainting();
                
                scene.add(painting);
                scene.add(paintingFrame);
                
                // Ajouter le chevalet si nécessaire
                if (paintingMode === 'easel' && easel) {
                    scene.add(easel);
                }
                
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
        
        // Stocker les dimensions réelles pour le chargement du tableau
        const realHeight = params.height;
        const realWidth = params.width;
        
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
        
        // Renderer avec paramètres optimisés pour qualité maximale
        renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            powerPreference: 'high-performance',
            alpha: false,
            stencil: false,
            depth: true,
            logarithmicDepthBuffer: false
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        // Pixel ratio optimisé : jusqu'à 3 pour meilleure qualité sur écrans haute résolution
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 3));
        
        // Configuration avancée des ombres pour qualité maximale
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Ombres douces de haute qualité
        renderer.shadowMap.autoUpdate = true;
        renderer.shadowMap.needsUpdate = true;
        
        // Tone mapping ACES Filmic pour rendu cinématique réaliste
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.6; // Exposition augmentée pour préserver les couleurs originales
        
        // Color space et encoding pour meilleure précision des couleurs
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        // Note: useLegacyLights a été supprimé dans Three.js r155+, le nouveau système d'éclairage est utilisé par défaut
        
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
        
        // Lumières (configuration par défaut)
        setupLights(currentLightConfigName);
        
        // Sol de la galerie
        const floor = createGalleryFloor();
        scene.add(floor);
        
        // Murs de la galerie
        const walls = createGalleryWalls();
        scene.add(walls);
        
        // Charger le tableau avec les dimensions réelles
        loadPainting(params.image, realHeight, realWidth).then(() => {
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

// Fonction pour positionner le tableau selon le mode (mur ou chevalet)
function positionPainting() {
    if (!painting || !paintingFrame) return;
    
    if (paintingMode === 'wall') {
        // Positionner le tableau contre le mur arrière
        const roomSize = 15;
        const wallZ = -roomSize / 2;
        const paintingOffset = 0.05; // Légèrement devant le mur pour éviter le z-fighting
        const paintingHeight = 1.5; // Hauteur du centre du tableau (à hauteur des yeux)
        
        painting.position.set(0, paintingHeight, wallZ + paintingOffset);
        painting.rotation.set(0, 0, 0); // Vertical, face à la caméra
        
        // Mettre à jour les variables globales pour les animations
        paintingCenterY = paintingHeight;
        paintingZ = wallZ + paintingOffset;
        
        // Positionner le cadre
        paintingFrame.position.copy(painting.position);
        paintingFrame.position.z = painting.position.z - 0.01; // Légèrement devant le tableau
        paintingFrame.rotation.copy(painting.rotation);
        
        // Retirer le chevalet de la scène si présent
        if (easel && scene) {
            scene.remove(easel);
        }
        
    } else if (paintingMode === 'easel') {
        // Positionner le tableau sur le chevalet près du mur
        const roomSize = 15;
        const wallZ = -roomSize / 2;
        const easelOffset = 1.5; // Distance du mur (le chevalet est devant le mur)
        
        const easelHeight = 2.0; // Hauteur du chevalet
        const easelY = easelHeight / 2 - 2; // Position Y de la base du chevalet
        const paintingHeight = easelY + easelHeight - 0.3; // Hauteur du centre du tableau sur le chevalet
        const easelPaintingZ = wallZ + easelOffset; // Position Z du chevalet (près du mur)
        const easelAngle = -15 * Math.PI / 180; // Inclinaison du tableau (15° vers l'arrière)
        
        // Créer le chevalet s'il n'existe pas
        if (!easel) {
            easel = createEasel();
        }
        easel.position.set(0, 0, easelPaintingZ);
        easel.rotation.set(0, 0, 0);
        
        // Positionner le tableau sur le chevalet
        painting.position.set(0, paintingHeight, easelPaintingZ + 0.1); // Légèrement devant le chevalet
        painting.rotation.set(easelAngle, 0, 0); // Incliné vers l'arrière
        
        // Mettre à jour les variables globales pour les animations
        paintingCenterY = paintingHeight;
        paintingZ = easelPaintingZ + 0.1; // Mettre à jour la variable globale
        
        // Positionner le cadre
        paintingFrame.position.copy(painting.position);
        paintingFrame.position.z = painting.position.z - 0.01; // Légèrement devant le tableau
        paintingFrame.rotation.copy(painting.rotation);
        
        // Ajouter le chevalet à la scène
        if (easel && scene) {
            scene.add(easel);
        }
    }
}

// Fonction pour changer le mode d'affichage (mur/chevalet)
function changePaintingMode(mode) {
    if (mode !== 'wall' && mode !== 'easel') {
        console.error(`Mode "${mode}" non valide. Utiliser "wall" ou "easel".`);
        return;
    }
    
    paintingMode = mode;
    
    // Repositionner le tableau
    if (painting) {
        positionPainting();
        
        // Mettre à jour les helpers si nécessaire
        updateHelpers();
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

// Fonction pour animer les spots en mode spectacle
function animateSpots() {
    const config = lightConfigurations[currentLightConfigName];
    if (!config || !config.spots || !config.spots.animated || spotLights.length === 0) {
        return;
    }
    
    animationTime += 0.016; // Incrémenter le temps (environ 60 FPS)
    
    // Animation des spots : mouvement circulaire autour du tableau
    // Les spots tournent autour du tableau mais ne l'éclairent pas directement
    spotLights.forEach((spot, index) => {
        // Mouvement circulaire autour du tableau (plus large pour être visible autour)
        const radius = 2.5; // Rayon du mouvement augmenté pour être plus visible autour
        const speed = 0.4; // Vitesse de rotation légèrement réduite
        const phase = (index / spotLights.length) * Math.PI * 2; // Déphasage entre les spots
        
        // Position de base (centre du mouvement = position du tableau)
        const baseX = 0;
        const baseY = 4.5; // Hauteur du plafond
        const baseZ = -6.5; // Position Z du tableau
        
        // Calculer la nouvelle position avec mouvement circulaire
        const angle = animationTime * speed + phase;
        const offsetX = Math.cos(angle) * radius;
        const offsetZ = Math.sin(angle) * radius * 0.6; // Mouvement elliptique
        
        spot.position.x = baseX + offsetX;
        spot.position.z = baseZ + offsetZ;
        spot.position.y = baseY + Math.sin(animationTime * 0.8 + phase) * 0.5; // Variation verticale plus prononcée
        
        // Orienter les spots vers l'extérieur (pas vers le tableau) pour l'effet spectacle
        // Les spots éclairent l'espace autour, pas directement le tableau
        const outwardAngle = angle + Math.PI / 2; // Perpendiculaire au rayon
        const targetOffsetX = Math.cos(outwardAngle) * 3;
        const targetOffsetZ = Math.sin(outwardAngle) * 3;
        
        // Variation d'intensité (pulsation) - mais garder une intensité minimale pour l'effet visuel
        const intensityVariation = 0.2; // Variation réduite de ±20% pour ne pas trop affecter le tableau
        const intensityPhase = animationTime * 1.2 + phase;
        const baseIntensity = config.spots.defaultIntensity || 0.3;
        const intensity = baseIntensity + Math.sin(intensityPhase) * intensityVariation;
        spot.intensity = Math.max(0.15, intensity); // Minimum 0.15 pour garder l'effet visuel
        
        // Variation de couleur (variation prononcée pour effet spectacle)
        // Chaque spot a une couleur différente qui varie dans le temps
        const colorSpeed = 0.3; // Vitesse de changement de couleur
        const colorPhase = phase * 2; // Déphasage plus prononcé entre les spots
        
        // Variation de teinte (hue) sur tout le spectre
        const hueVariation = (animationTime * colorSpeed + colorPhase) % 1;
        
        // Créer des couleurs variées : blanc chaud, bleu, rouge, vert, violet, etc.
        // Base : blanc chaud (4000K), puis variation vers différentes couleurs
        const baseColor = new THREE.Color(config.spots.colorTemperature);
        const baseHSL = baseColor.getHSL({});
        
        // Variation de teinte plus prononcée (0.0 à 1.0 = tout le spectre)
        // Chaque spot a une couleur de base différente qui varie
        const baseHueOffset = (index / spotLights.length) * 0.3; // Décalage initial par spot
        const hue = (baseHSL.h + baseHueOffset + hueVariation * 0.4) % 1;
        
        // Variation de saturation (plus saturé pour effet spectacle)
        const saturationVariation = 0.3 + Math.sin(animationTime * 0.4 + phase) * 0.2;
        const saturation = Math.max(0.2, Math.min(0.8, baseHSL.s + saturationVariation));
        
        // Variation de luminosité (pour effet pulsant)
        const lightnessVariation = 0.1 * Math.sin(animationTime * 0.6 + phase);
        const lightness = Math.max(0.5, Math.min(1.0, baseHSL.l + lightnessVariation));
        
        // Appliquer la couleur avec variations
        spot.color.setHSL(hue, saturation, lightness);
        
        // Mettre à jour la cible pour que les spots éclairent l'espace autour (pas directement le tableau)
        if (spot.target) {
            // Cibler un point dans l'espace autour du tableau, pas le tableau lui-même
            spot.target.position.set(
                baseX + targetOffsetX,
                paintingCenterY + 0.5, // Légèrement au-dessus du tableau
                baseZ + targetOffsetZ
            );
        }
        
        // Mettre à jour le helper correspondant pour qu'il suive le spot
        if (spotHelpers[index]) {
            spotHelpers[index].position.copy(spot.position);
            // Orienter le helper vers la cible du spot
            if (spot.target) {
                spotHelpers[index].lookAt(spot.target.position);
            }
            
            // Mettre à jour la couleur du helper pour qu'elle corresponde à la couleur du spot
            spotHelpers[index].traverse((child) => {
                if (child.isMesh && child.material) {
                    // Mettre à jour la couleur du matériau du helper
                    if (child.material.color) {
                        child.material.color.copy(spot.color);
                    }
                    // Mettre à jour l'opacité selon l'intensité du spot (normalisée)
                    const defaultIntensity = config.spots.defaultIntensity || 1.0;
                    const normalizedIntensity = defaultIntensity > 0 ? Math.min(spot.intensity / defaultIntensity, 1.5) : 1.0;
                    if (child.material.opacity !== undefined) {
                        child.material.opacity = Math.min(0.9, 0.3 + normalizedIntensity * 0.6);
                    }
                } else if (child.isLine && child.material) {
                    // Pour les lignes (Line)
                    if (child.material.color) {
                        child.material.color.copy(spot.color);
                    }
                    const defaultIntensity = config.spots.defaultIntensity || 1.0;
                    const normalizedIntensity = defaultIntensity > 0 ? Math.min(spot.intensity / defaultIntensity, 1.5) : 1.0;
                    if (child.material.opacity !== undefined) {
                        child.material.opacity = Math.min(0.8, 0.2 + normalizedIntensity * 0.6);
                    }
                } else if (child.isArrowHelper) {
                    // Pour les flèches (ArrowHelper)
                    child.setColor(spot.color);
                }
            });
        }
    });
}

// Boucle d'animation
function animate() {
    requestAnimationFrame(animate);
    
    if (!renderer || !scene || !camera) return;
    
    // Mettre à jour les contrôles
    if (controls) {
        controls.update();
    }
    
    // Animer les spots si la configuration le permet
    if (animationEnabled) {
        animateSpots();
    }
    
    // Mettre à jour les helpers de lumière (suivre les positions des lumières)
    // Pour les spots, utiliser directement le tableau spotHelpers (plus précis et performant)
    spotLights.forEach((spot, index) => {
        if (spotHelpers[index]) {
            // Les helpers des spots animés sont déjà mis à jour dans animateSpots()
            // Mais on les met à jour aussi ici pour les autres configurations
            if (!animationEnabled) {
                spotHelpers[index].position.copy(spot.position);
                if (spot.target) {
                    spotHelpers[index].lookAt(spot.target.position);
                }
                
                // Mettre à jour la couleur du helper pour qu'elle corresponde à la couleur du spot
                spotHelpers[index].traverse((child) => {
                    if (child.isMesh && child.material) {
                        // Mettre à jour la couleur du matériau du helper
                        if (child.material.color) {
                            child.material.color.copy(spot.color);
                        }
                    } else if (child.isLine && child.material) {
                        // Pour les lignes (Line)
                        if (child.material.color) {
                            child.material.color.copy(spot.color);
                        }
                    } else if (child.isArrowHelper) {
                        // Pour les flèches (ArrowHelper)
                        child.setColor(spot.color);
                    }
                });
            }
        }
    });
    
    // Pour les autres lumières (PointLight, DirectionalLight, etc.), utiliser la méthode par position
    scene.children.forEach((child) => {
        if (child.type === 'PointLight' || child.type === 'DirectionalLight') {
            // Trouver le helper correspondant par position
            const helper = lightHelpers.find(h => 
                h !== spotHelpers.find(sh => sh === h) && // Exclure les helpers de spots déjà traités
                Math.abs(h.position.x - child.position.x) < 0.5 &&
                Math.abs(h.position.y - child.position.y) < 0.5 &&
                Math.abs(h.position.z - child.position.z) < 0.5
            );
            
            if (helper) {
                helper.position.copy(child.position);
                // Pour DirectionalLight, orienter le helper vers le target
                if (child.type === 'DirectionalLight' && child.target) {
                    helper.lookAt(child.target.position);
                }
            }
        }
    });
    
    // Mettre à jour les ombres si nécessaire (pour meilleure qualité)
    if (renderer && renderer.shadowMap) {
        renderer.shadowMap.needsUpdate = true;
    }
    
    // Rendu
    renderer.render(scene, camera);
}

// Gestion du redimensionnement avec optimisations
window.addEventListener('resize', () => {
    if (!camera || !renderer) return;
    
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    // Réinitialiser le pixel ratio après redimensionnement
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 3));
});

// Fonction pour mettre à jour l'intensité des lumières selon la configuration active
function updateLightIntensity(intensity) {
    const config = lightConfigurations[currentLightConfigName];
    if (!config) return;
    
    // Mettre à jour selon le type de configuration
    if (config.spots && config.spots.enabled && spotLights.length > 0) {
        // Configuration avec spots
        spotLights.forEach(spot => {
            spot.intensity = intensity;
        });
    } else if (config.directionalLight && config.directionalLight.enabled && directionalLight) {
        // Configuration avec lumière directionnelle
        directionalLight.intensity = intensity;
    } else if (config.areaLight && config.areaLight.enabled && areaLight) {
        // Configuration avec lumière de zone
        areaLight.intensity = intensity;
    }
    
    // Mettre à jour l'affichage de la valeur
    const valueDisplay = document.getElementById('spot-intensity-value');
    if (valueDisplay) {
        valueDisplay.textContent = intensity.toFixed(1);
    }
}

// Fonction pour mettre à jour l'intensité des spots (pour compatibilité)
function updateSpotIntensity(intensity) {
    updateLightIntensity(intensity);
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
    
    // Adapter le slider selon la configuration
    if (slider) {
        if (config.spots && config.spots.enabled) {
            // Configuration avec spots
            slider.min = '0';
            slider.max = '3';
            slider.step = '0.1';
            slider.value = config.spots.defaultIntensity;
            const label = slider.previousElementSibling;
            if (label && label.querySelector('span')) {
                label.querySelector('span').textContent = 'Intensité des spots';
            }
        } else if (config.directionalLight && config.directionalLight.enabled) {
            // Configuration avec lumière directionnelle
            slider.min = '0';
            slider.max = '3';
            slider.step = '0.1';
            slider.value = config.directionalLight.intensity;
            const label = slider.previousElementSibling;
            if (label && label.querySelector('span')) {
                label.querySelector('span').textContent = 'Intensité lumière du jour';
            }
        } else if (config.areaLight && config.areaLight.enabled) {
            // Configuration avec lumière de zone
            slider.min = '0';
            slider.max = '5';
            slider.step = '0.1';
            slider.value = config.areaLight.intensity;
            const label = slider.previousElementSibling;
            if (label && label.querySelector('span')) {
                label.querySelector('span').textContent = 'Intensité fenêtre';
            }
        }
        
        // Mettre à jour l'affichage
        updateLightIntensity(parseFloat(slider.value));
    }
    
    // Adapter le mode "éclairage principal uniquement" selon la configuration
    const spotOnlyToggle = document.getElementById('spot-only-toggle');
    if (spotOnlyToggle) {
        // Vérifier si la configuration a un éclairage principal (spots, DirectionalLight, ou AreaLight)
        const hasMainLight = (config.spots && config.spots.enabled) || 
                            (config.directionalLight && config.directionalLight.enabled) || 
                            (config.areaLight && config.areaLight.enabled);
        
        if (hasMainLight) {
            spotOnlyToggle.disabled = false;
            // Mettre à jour le label selon la configuration
            const label = document.getElementById('spot-only-label');
            if (label) {
                if (config.spots && config.spots.enabled) {
                    label.textContent = 'Mode spots uniquement';
                } else if (config.directionalLight && config.directionalLight.enabled) {
                    label.textContent = 'Mode lumière du jour uniquement';
                } else if (config.areaLight && config.areaLight.enabled) {
                    label.textContent = 'Mode fenêtre uniquement';
                }
            }
        } else {
            spotOnlyToggle.checked = false;
            spotOnlyToggle.disabled = true;
            toggleSpotOnlyMode(false);
        }
    }
}

// Fonction pour basculer entre le mode normal et le mode "éclairage principal uniquement"
// S'adapte à la configuration active (spots, DirectionalLight, ou AreaLight)
function toggleSpotOnlyMode(enabled) {
    const wasInSpotOnlyMode = spotOnlyMode;
    spotOnlyMode = enabled;
    
    const config = lightConfigurations[currentLightConfigName];
    if (!config) return;
    
    if (enabled) {
        // Mode "éclairage principal uniquement" : éteindre la lumière ambiante et la lumière de remplissage
        if (ambientLight) {
            ambientLight.intensity = 0;
        }
        if (fillLight) {
            fillLight.intensity = 0;
        }
        
        // Augmenter l'intensité de l'éclairage principal selon la configuration
        const slider = document.getElementById('spot-intensity-slider');
        const currentSliderValue = slider ? parseFloat(slider.value) : 1.0;
        const multiplier = 1.5;
        const newIntensity = Math.min(currentSliderValue * multiplier, parseFloat(slider ? slider.max : 3));
        
        if (config.spots && config.spots.enabled && spotLights.length > 0) {
            // Configuration avec spots : augmenter les spots
            spotLights.forEach(spot => {
                spot.intensity = newIntensity;
            });
        } else if (config.directionalLight && config.directionalLight.enabled && directionalLight) {
            // Configuration avec DirectionalLight : augmenter la DirectionalLight
            directionalLight.intensity = newIntensity;
        } else if (config.areaLight && config.areaLight.enabled && areaLight) {
            // Configuration avec AreaLight : augmenter l'AreaLight
            areaLight.intensity = newIntensity;
        }
        
        // Mettre à jour l'affichage du slider
        const valueDisplay = document.getElementById('spot-intensity-value');
        if (valueDisplay) {
            valueDisplay.textContent = newIntensity.toFixed(1);
        }
    } else {
        // Mode normal : rallumer la lumière ambiante et la lumière de remplissage
        if (ambientLight && config.ambientLight && config.ambientLight.enabled) {
            ambientLight.intensity = config.ambientLight.intensity;
        }
        if (fillLight && config.fillLight && config.fillLight.enabled) {
            fillLight.intensity = config.fillLight.intensity;
        }
        
        // Restaurer l'intensité normale de l'éclairage principal
        const slider = document.getElementById('spot-intensity-slider');
        if (slider) {
            const currentIntensity = parseFloat(slider.value);
            // Si on était en mode "éclairage principal uniquement", diviser par le multiplicateur
            const originalIntensity = wasInSpotOnlyMode ? currentIntensity / 1.5 : currentIntensity;
            
            if (config.spots && config.spots.enabled && spotLights.length > 0) {
                spotLights.forEach(spot => {
                    spot.intensity = originalIntensity;
                });
            } else if (config.directionalLight && config.directionalLight.enabled && directionalLight) {
                directionalLight.intensity = originalIntensity;
            } else if (config.areaLight && config.areaLight.enabled && areaLight) {
                areaLight.intensity = originalIntensity;
            }
            
            updateLightIntensity(originalIntensity);
        }
    }
}

// Gestion de la fermeture (attendre que le DOM soit chargé)
function setupEventListeners() {
    const closeButton = document.getElementById('gallery-close');
    if (closeButton) {
        closeButton.addEventListener('click', closeGallery3D);
    }
    
    // Menu déroulant de configuration
    const lightConfigSelect = document.getElementById('light-config-select');
    if (lightConfigSelect) {
        lightConfigSelect.value = currentLightConfigName;
        lightConfigSelect.addEventListener('change', (e) => {
            changeLightConfiguration(e.target.value);
        });
    }
    
    // Menu déroulant de position (mur/chevalet)
    const paintingModeSelect = document.getElementById('painting-mode-select');
    if (paintingModeSelect) {
        paintingModeSelect.value = paintingMode;
        paintingModeSelect.addEventListener('change', (e) => {
            changePaintingMode(e.target.value);
        });
    }
    
    // Slider d'intensité des lumières
    const spotIntensitySlider = document.getElementById('spot-intensity-slider');
    if (spotIntensitySlider) {
        spotIntensitySlider.addEventListener('input', (e) => {
            const intensity = parseFloat(e.target.value);
            // Si on est en mode spots uniquement, appliquer le multiplicateur
            const actualIntensity = spotOnlyMode ? Math.min(intensity * 1.5, 3.0) : intensity;
            updateLightIntensity(actualIntensity);
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

