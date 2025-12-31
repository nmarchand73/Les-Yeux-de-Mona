import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/UnrealBloomPass.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/OBJLoader.js';
import { STLLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/STLLoader.js';

// Paramètres globaux
const params = {
    shadowContrast: 2.5,
    lightIntensity: 1.5,
    shadowHardness: 0.7,
    scatterAmount: 0.15,
    edgeSoftness: 0.3,
    sssIntensity: 0.4,
    effectsEnabled: true, // Mode avec effets shader activé par défaut
    rotateBust: false, // Mode rotation : false = caméra, true = buste
    lightAnimation: false, // Animation de la lumière spot autour de l'objet
    lightAnimationSpeed: 0.5, // Vitesse de rotation de la lumière (rad/s)
    lightAnimationRadius: 5, // Rayon de rotation de la lumière
    lightAnimationHeight: 4, // Hauteur de la lumière par rapport au centre
    lightColor: 0xffffee // Couleur de la lumière spot (blanc chaud par défaut)
};

// Variables pour la rotation du buste
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };
let bustRotation = { x: 0, y: 0, z: 0 };

// Variables pour la rotation automatique avec inertie
let autoRotationVelocity = { x: 0, y: 0, z: 0 };
let autoRotationEnabled = false;
const friction = 0.95; // Facteur de friction pour ralentir progressivement

// Variable pour l'animation de la lumière spot
let lightAnimationAngle = 0; // Angle actuel de rotation de la lumière

// Liste des modèles disponibles
const availableModels = [
    {
        name: 'Erato (Muse de la Poésie)',
        file: './models/erato.obj',
        type: 'obj',
        description: 'Buste de la muse Erato - Sculpture classique détaillée (103MB)',
        recommended: true
    },
    {
        name: 'Sérapis (Buste)',
        file: './models/serapis.stl',
        type: 'stl',
        description: 'Buste de Sérapis - Dieu gréco-égyptien (21MB)',
        recommended: true
    },
    {
        name: 'Dragon',
        file: './models/dragon.obj',
        type: 'obj',
        description: 'Modèle de dragon - Sculpture détaillée (71MB)',
        recommended: false
    }
];

// Configuration de la scène
let scene, camera, renderer, composer;
let mainLight, fillLight, backLight;
let bust, bustPivot;
let controls;
let stats = { fps: 0, lastTime: performance.now(), frames: 0 };
let centerHelper, boundingBoxHelper; // Helpers pour le centre et la bounding box
let lightHelpers = []; // Helpers pour les sources de lumière

// Shader vertex pour le sfumato/chiaroscuro
const customVertexShader = `
#ifdef GL_ES
precision mediump float;
#endif

varying vec3 vNormal;
varying vec3 vPosition;
varying vec3 vWorldPosition;
varying vec3 vViewPosition;

void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = position;
    
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    
    gl_Position = projectionMatrix * mvPosition;
}
`;

// Shader fragment pour le sfumato/chiaroscuro - Version améliorée et fidèle
const customFragmentShader = `
#ifdef GL_ES
precision highp float;
#endif

uniform vec3 lightPosition;
uniform vec3 lightColor;
uniform float lightIntensity;
uniform float shadowContrast;
uniform float shadowHardness;
uniform float scatterAmount;
uniform float edgeSoftness;
uniform float sssIntensity;
uniform vec3 baseColor;

varying vec3 vNormal;
varying vec3 vPosition;
varying vec3 vWorldPosition;
varying vec3 vViewPosition;

// Fonction de Fresnel améliorée pour le sfumato
float fresnel(vec3 viewDir, vec3 normal, float power) {
    float fresnel = 1.0 - max(0.0, dot(viewDir, normal));
    return pow(fresnel, power);
}

// Subsurface scattering réaliste (style Léonard de Vinci)
vec3 subsurfaceScattering(vec3 normal, vec3 lightDir, vec3 viewDir, vec3 worldPos) {
    // Calcul de la transmission de la lumière à travers la surface
    float NdotL = dot(normal, lightDir);
    float transmission = max(0.0, -NdotL); // Côté opposé à la lumière
    
    // Distance de diffusion (simule la pénétration de la lumière dans la matière)
    vec3 lightToPoint = normalize(worldPos - lightPosition);
    float distFactor = 1.0 / (1.0 + length(worldPos - lightPosition) * 0.1);
    
    // Rétrodiffusion (rim lighting) - caractéristique du sfumato
    float rim = 1.0 - max(0.0, dot(normal, viewDir));
    float rimPower = pow(rim, 3.0);
    
    // Diffusion douce dans la matière
    vec3 scatter = vec3(transmission * distFactor * rimPower);
    
    // Ajout d'une composante de diffusion directionnelle
    vec3 halfVec = normalize(lightDir + viewDir);
    float NdotH = max(0.0, dot(normal, halfVec));
    scatter += vec3(pow(NdotH, 8.0) * 0.3);
    
    return scatter;
}

// Clair-Obscur précis (style Caravaggio)
float chiaroscuro(float NdotL, float contrast, float hardness) {
    // Éclairage de base avec pénombre contrôlée
    float penumbra = mix(0.15, 0.35, hardness); // Zone de transition ombre/lumière
    float shadow = smoothstep(-penumbra, penumbra, NdotL);
    
    // Application du contraste (courbe de ton caractéristique du chiaroscuro)
    // Utilisation d'une courbe sigmoïde pour un contraste naturel
    float contrastCurve = pow(shadow, contrast);
    
    // Zones d'ombre profonde (tenebrismo - style Caravaggio)
    // Les ombres sont presque noires, avec très peu de lumière résiduelle
    float deepShadowThreshold = 0.15;
    float deepShadow = smoothstep(0.0, deepShadowThreshold, contrastCurve);
    contrastCurve = mix(contrastCurve * 0.05, contrastCurve, deepShadow);
    
    // Zones de lumière vive (haute clarté)
    float highlightThreshold = 0.7;
    float highlight = smoothstep(highlightThreshold, 1.0, contrastCurve);
    contrastCurve = mix(contrastCurve, contrastCurve * 1.3, highlight * 0.5);
    
    return max(0.0, contrastCurve);
}

// Adoucissement des contours (sfumato - style Léonard de Vinci)
float edgeSoftening(vec3 normal, vec3 viewDir, float softness) {
    // Calcul de la visibilité des bords
    float edgeFactor = 1.0 - abs(dot(normal, viewDir));
    
    // Application du sfumato : adoucissement progressif des contours
    float sfumato = pow(edgeFactor, 2.0 + softness * 3.0);
    
    // Mélange avec la couleur de base pour créer la transition douce
    return sfumato * softness;
}

// Diffusion atmosphérique (brume légère du sfumato)
vec3 atmosphericScattering(vec3 color, float distance, float amount) {
    // Couleur de la brume atmosphérique (légèrement bleutée)
    vec3 fogColor = vec3(0.12, 0.13, 0.15);
    
    // Calcul de la densité de la brume (exponentielle)
    float fogDensity = 1.0 - exp(-distance * amount * 0.03);
    
    // Mélange progressif avec la couleur de la brume
    return mix(color, fogColor, fogDensity * amount);
}

void main() {
    vec3 normal = normalize(vNormal);
    vec3 lightDir = normalize(lightPosition - vWorldPosition);
    vec3 viewDir = normalize(vViewPosition);
    float distance = length(vViewPosition);
    
    // ===== CLAIR-OBSCUR (CHIAROSCURO) - Version précise =====
    
    float NdotL = dot(normal, lightDir);
    
    // Application du chiaroscuro avec courbe de ton précise
    float chiaroscuroValue = chiaroscuro(NdotL, shadowContrast, shadowHardness);
    
    // ===== SFUMATO - Version précise =====
    
    // Subsurface scattering réaliste
    vec3 sss = subsurfaceScattering(normal, lightDir, viewDir, vWorldPosition) * sssIntensity;
    
    // Adoucissement des contours (caractéristique principale du sfumato)
    float edgeSoft = edgeSoftening(normal, viewDir, edgeSoftness);
    
    // Fresnel pour les bords (adoucissement supplémentaire)
    float fresnelTerm = fresnel(viewDir, normal, 1.5 + edgeSoftness);
    float edgeGlow = fresnelTerm * edgeSoftness * 0.4;
    
    // ===== COMPOSITION FINALE =====
    
    // Couleur de base
    vec3 color = baseColor;
    
    // Application du chiaroscuro (éclairage directionnel avec contraste fort)
    vec3 litColor = color * lightColor * lightIntensity;
    color = litColor * chiaroscuroValue;
    
    // Ajout du subsurface scattering (sfumato - douceur de la peau/marbre)
    // Le SSS ajoute de la lumière dans les zones d'ombre, créant la transition douce
    vec3 sssColor = sss * lightColor * lightIntensity * 0.6;
    color += sssColor;
    
    // Adoucissement des bords (sfumato)
    // Mélange progressif avec la couleur ambiante pour adoucir les contours
    vec3 edgeColor = mix(color, baseColor * 0.4, edgeSoft * 0.3);
    color = mix(color, edgeColor, edgeSoft);
    
    // Ajout de la lueur des bords (rim lighting subtil)
    color += edgeGlow * lightColor * lightIntensity * 0.2;
    
    // Lumière ambiante minimale (pour préserver les détails dans les ombres)
    // Plus faible que précédemment pour respecter le chiaroscuro
    vec3 ambient = baseColor * 0.08;
    color += ambient;
    
    // Diffusion atmosphérique (sfumato - brume légère)
    color = atmosphericScattering(color, distance, scatterAmount);
    
    // S'assurer que les valeurs sont valides
    color = max(vec3(0.0), color);
    
    // Tone mapping amélioré (préserve les détails dans les hautes et basses lumières)
    // Utilisation de la fonction Reinhard modifiée
    color = color / (color + vec3(1.0));
    
    // Ajustement du contraste final (pour correspondre aux peintures classiques)
    color = pow(color, vec3(0.95)); // Légère compression des tons moyens
    
    // Gamma correction
    color = pow(color, vec3(1.0 / 2.2));
    
    gl_FragColor = vec4(color, 1.0);
}
`;

// Shader de post-processing amélioré pour le vignetting et le grain
const vignetteShader = {
    uniforms: {
        'tDiffuse': { value: null },
        'vignetteIntensity': { value: 0.5 },
        'vignetteSmoothness': { value: 0.6 },
        'grainAmount': { value: 0.03 },
        'time': { value: 0.0 }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float vignetteIntensity;
        uniform float vignetteSmoothness;
        uniform float grainAmount;
        uniform float time;
        varying vec2 vUv;
        
        // Générateur de bruit amélioré (plus réaliste)
        float random(vec2 co) {
            return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
        }
        
        // Bruit de grain de film (plus organique)
        float filmGrain(vec2 uv, float amount) {
            // Bruit multi-échelle pour un grain plus réaliste
            float grain1 = random(uv * 1000.0 + time * 0.1);
            float grain2 = random(uv * 500.0 + time * 0.15);
            float grain3 = random(uv * 250.0 + time * 0.2);
            
            // Combinaison des différentes échelles
            float grain = (grain1 * 0.5 + grain2 * 0.3 + grain3 * 0.2) - 0.5;
            
            return grain * amount;
        }
        
        void main() {
            vec4 color = texture2D(tDiffuse, vUv);
            
            // Vignette améliorée (courbe plus naturelle)
            vec2 center = vUv - 0.5;
            float dist = length(center);
            
            // Vignette avec courbe exponentielle (plus réaliste)
            float vignette = 1.0 - smoothstep(0.3, 0.7, dist) * vignetteIntensity;
            
            // Application de la vignette avec préservation des tons moyens
            color.rgb *= vignette;
            
            // Film grain subtil (caractéristique des peintures classiques)
            float grain = filmGrain(vUv, grainAmount);
            color.rgb += grain;
            
            // Saturation légèrement réduite dans les bords (effet atmosphérique)
            float saturation = mix(0.95, 1.0, vignette);
            float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
            color.rgb = mix(vec3(gray), color.rgb, saturation);
            
            gl_FragColor = color;
        }
    `
};

function init() {
    try {
    const container = document.getElementById('canvas-container');
        if (!container) {
            console.error('Canvas container not found');
            return;
        }
    
    // Scène
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a);
    scene.fog = new THREE.FogExp2(0x0f0f12, 0.05);
    
    // Caméra
    camera = new THREE.PerspectiveCamera(
        45,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.set(0, 1.5, 5);
        camera.lookAt(0, 1.5, 0); // Regarder vers le buste
    
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
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);
    
        // Contrôles de la caméra (OrbitControls)
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 2;
    controls.maxDistance = 10;
        // Permettre la rotation complète sur les 3 axes (suppression de la limitation)
        controls.minPolarAngle = 0; // Permet de passer sous le modèle
        controls.maxPolarAngle = Math.PI; // Permet la rotation complète verticale
        controls.enablePan = true; // Permet le déplacement latéral
        controls.panSpeed = 0.8;
        controls.rotateSpeed = 0.5;
        controls.zoomSpeed = 1.2;
        // Définir le point cible au centre du buste (y = 1.5)
        controls.target.set(0, 1.5, 0);
        controls.update();
        
        // Gestion des événements souris pour la rotation du buste
        setupBustRotationControls();
    
    // Lumières
    setupLights();
    
        // UI (doit être initialisé avant createScene pour que le sélecteur soit prêt)
        setupUI();
        
        // Objets de la scène (charge le modèle par défaut)
    createScene();
        
        // Vérifier que la scène contient des objets
        console.log('Nombre d\'objets dans la scène:', scene.children.length);
        console.log('Objets de la scène:', scene.children.map(obj => obj.type));
    
    // Post-processing
    setupPostProcessing();
    
    // Masquer le loading
        const loadingElement = document.getElementById('loading');
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
    
    // Démarrer l'animation
    animate();
    } catch (error) {
        console.error('Error during initialization:', error);
        const loadingElement = document.getElementById('loading');
        if (loadingElement) {
            loadingElement.textContent = 'Erreur de chargement: ' + error.message;
            loadingElement.style.color = '#ff0000';
        }
    }
}

// Fonction pour créer un helper de lumière
function createLightHelper(light) {
    const helperGroup = new THREE.Group();
    
    if (light.type === 'SpotLight') {
        // Helper pour SpotLight : cône + sphère
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
        
        // Cercles pour montrer la portée (optionnel)
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
    
    // Lumière principale (Caravaggio style - latérale forte)
    mainLight = new THREE.SpotLight(params.lightColor, params.lightIntensity);
    mainLight.position.set(-3, 4, 2);
    mainLight.angle = Math.PI / 6;
    mainLight.penumbra = 0.5;
    mainLight.decay = 2;
    mainLight.distance = 20;
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 15;
    // Cibler le centre du buste
    mainLight.target.position.set(0, 1.5, 0);
    scene.add(mainLight);
    scene.add(mainLight.target);
    
    // Helper pour la lumière principale
    const mainLightHelper = createLightHelper(mainLight);
    scene.add(mainLightHelper);
    lightHelpers.push(mainLightHelper);
    
    // Lumière de remplissage (très faible)
    fillLight = new THREE.PointLight(0x4466aa, 0.15);
    fillLight.position.set(2, 1, 3);
    scene.add(fillLight);
    
    // Helper pour la lumière de remplissage
    const fillLightHelper = createLightHelper(fillLight);
    scene.add(fillLightHelper);
    lightHelpers.push(fillLightHelper);
    
    // Contre-jour subtil
    backLight = new THREE.PointLight(0xffeedd, 0.2);
    backLight.position.set(0, 2, -3);
    scene.add(backLight);
    
    // Helper pour le contre-jour
    const backLightHelper = createLightHelper(backLight);
    scene.add(backLightHelper);
    lightHelpers.push(backLightHelper);
    
    // Lumière ambiante (augmentée pour le mode sans effets)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);
    // Pas de helper pour la lumière ambiante (elle n'a pas de position)
}

// Fonction pour créer le matériau shader
function createBustMaterial() {
    let bustMaterial;
    
    try {
        bustMaterial = new THREE.ShaderMaterial({
        vertexShader: customVertexShader,
        fragmentShader: customFragmentShader,
        uniforms: {
                lightPosition: { value: mainLight ? mainLight.position.clone() : new THREE.Vector3(-3, 4, 2) },
            lightColor: { value: new THREE.Color(params.lightColor) },
            lightIntensity: { value: params.lightIntensity },
            shadowContrast: { value: params.shadowContrast },
            shadowHardness: { value: params.shadowHardness },
            scatterAmount: { value: params.scatterAmount },
            edgeSoftness: { value: params.edgeSoftness },
            sssIntensity: { value: params.sssIntensity },
            baseColor: { value: new THREE.Color(0xd4c4b0) } // Couleur pierre/marbre
            },
            side: THREE.DoubleSide, // Rendre les deux faces visibles
            lights: false // Désactiver l'éclairage par défaut de Three.js
        });
        
        // Vérifier les erreurs de compilation des shaders
        if (renderer) {
            renderer.compile(scene, camera);
        }
    } catch (error) {
        console.error('Erreur lors de la création du matériau shader:', error);
        // Fallback vers un matériau standard
        bustMaterial = new THREE.MeshStandardMaterial({
            color: 0xd4c4b0,
            roughness: 0.7,
            metalness: 0.1
        });
    }
    
    return bustMaterial;
}

// Fonction pour appliquer un matériau standard (sans effets)
function applyStandardMaterial(mesh) {
    const standardMaterial = new THREE.MeshStandardMaterial({
        color: 0xe8dcc0, // Couleur pierre/marbre plus claire
        roughness: 0.6,
        metalness: 0.05,
        side: THREE.DoubleSide, // Rendre les deux faces visibles
        flatShading: false // Smooth shading pour meilleure visibilité
    });
    
    // Pour les meshes simples (comme STL)
    if (mesh.isMesh) {
        mesh.material = standardMaterial;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        return mesh;
    }
    
    // Pour les groupes d'objets
    mesh.traverse((child) => {
        if (child.isMesh) {
            child.material = standardMaterial.clone();
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });
    
    return mesh;
}

// Fonction pour appliquer le matériau shader à un mesh
function applyShaderMaterial(mesh) {
    const bustMaterial = createBustMaterial();
    
    mesh.traverse((child) => {
        if (child.isMesh) {
            child.material = bustMaterial;
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });
    
    return mesh;
}

// Fonction pour appliquer le matériau approprié selon le mode
function applyMaterial(mesh) {
    if (params.effectsEnabled) {
        return applyShaderMaterial(mesh);
    } else {
        return applyStandardMaterial(mesh);
    }
}

// Fonction pour centrer et dimensionner un modèle
function centerAndScaleModel(model, targetHeight = 1.5) {
    // Réinitialiser toutes les transformations
    model.position.set(0, 0, 0);
    model.scale.set(1, 1, 1);
    model.rotation.set(0, 0, 0);
    
    // Mettre à jour la matrice pour que la bounding box soit calculée correctement
    model.updateMatrixWorld(true);
    
    // Calculer la bounding box dans l'espace monde
    const box = new THREE.Box3().setFromObject(model);
    
    // Si la bounding box est invalide, essayer de la calculer différemment
    if (box.isEmpty()) {
        console.warn('Bounding box vide, tentative de calcul alternatif');
        model.traverse((child) => {
            if (child.isMesh && child.geometry) {
                child.geometry.computeBoundingBox();
                if (child.geometry.boundingBox) {
                    box.union(child.geometry.boundingBox);
                }
            }
        });
    }
    
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    
    if (maxDim === 0) {
        console.warn('Taille du modèle nulle, utilisation d\'une échelle par défaut');
        return model;
    }
    
    // Calculer l'échelle nécessaire
    const scale = targetHeight / maxDim;
    
    // Déplacer le modèle pour que son centre soit à l'origine
    model.position.sub(center);
    
    // Appliquer l'échelle
    model.scale.multiplyScalar(scale);
    
    // Positionner le modèle à la hauteur désirée
    // Le centre du modèle sera maintenant à y = targetHeight
    model.position.y = targetHeight;
    
    console.log('Modèle centré - Centre original:', center, 'Taille:', size, 'Échelle:', scale, 'Position finale:', model.position);
    
    return model;
}

// Fonction pour créer un helper de centre de rotation (axes en pointillés)
function createCenterHelper() {
    const helperGroup = new THREE.Group();
    const axisLength = 0.6;
    // Couleurs élégantes et professionnelles
    const colorX = 0xe74c3c; // Rouge profond
    const colorY = 0x2ecc71; // Vert émeraude
    const colorZ = 0x3498db; // Bleu professionnel
    
    // Fonction helper pour créer une ligne élégante avec glow
    function createAxisLine(points, color) {
        // Ligne principale
        const mainMaterial = new THREE.LineBasicMaterial({ 
            color: color, 
            opacity: 0.8,
            transparent: true,
            linewidth: 2
        });
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const mainLine = new THREE.Line(geometry, mainMaterial);
        helperGroup.add(mainLine);
        
        // Ligne de glow (plus large et plus transparente)
        const glowMaterial = new THREE.LineBasicMaterial({ 
            color: color, 
            opacity: 0.2,
            transparent: true,
            linewidth: 4
        });
        const glowLine = new THREE.Line(geometry, glowMaterial);
        helperGroup.add(glowLine);
        
        // Flèche à la fin de l'axe
        const arrowLength = 0.08;
        const arrowGeometry = new THREE.ConeGeometry(0.03, arrowLength, 8);
        const arrowMaterial = new THREE.MeshBasicMaterial({ 
            color: color, 
            opacity: 0.9,
            transparent: true
        });
        const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
        
        // Positionner la flèche à la fin de l'axe
        const direction = new THREE.Vector3().subVectors(points[1], points[0]).normalize();
        arrow.position.copy(points[1]);
        arrow.lookAt(points[1].clone().add(direction));
        arrow.rotateX(Math.PI / 2);
        helperGroup.add(arrow);
    }
    
    // Axe X (rouge)
    createAxisLine([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(axisLength, 0, 0)
    ], colorX);
    
    // Axe Y (vert)
    createAxisLine([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, axisLength, 0)
    ], colorY);
    
    // Axe Z (bleu)
    createAxisLine([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, axisLength)
    ], colorZ);
    
    // Sphère centrale élégante avec gradient
    const sphereGeometry = new THREE.SphereGeometry(0.035, 24, 24);
    const sphereMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffffff,
        opacity: 0.95,
        transparent: true
    });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    helperGroup.add(sphere);
    
    // Anneau élégant autour du centre
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

// Fonction pour créer un helper de bounding box en pointillés
function createBoundingBoxHelper(mesh) {
    const box = new THREE.Box3().setFromObject(mesh);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    
    const helperGroup = new THREE.Group();
    // Couleur élégante et professionnelle
    const boxColor = 0xff9500; // Orange moderne et élégant
    
    // Matériau pour les lignes principales
    const mainMaterial = new THREE.LineBasicMaterial({ 
        color: boxColor, 
        opacity: 0.7,
        transparent: true,
        linewidth: 2
    });
    
    // Matériau pour l'effet glow
    const glowMaterial = new THREE.LineBasicMaterial({ 
        color: boxColor, 
        opacity: 0.15,
        transparent: true,
        linewidth: 5
    });
    
    // Créer les 12 arêtes de la bounding box
    const vertices = [
        // Face inférieure
        new THREE.Vector3(center.x - size.x/2, center.y - size.y/2, center.z - size.z/2),
        new THREE.Vector3(center.x + size.x/2, center.y - size.y/2, center.z - size.z/2),
        new THREE.Vector3(center.x + size.x/2, center.y - size.y/2, center.z + size.z/2),
        new THREE.Vector3(center.x - size.x/2, center.y - size.y/2, center.z + size.z/2),
        // Face supérieure
        new THREE.Vector3(center.x - size.x/2, center.y + size.y/2, center.z - size.z/2),
        new THREE.Vector3(center.x + size.x/2, center.y + size.y/2, center.z - size.z/2),
        new THREE.Vector3(center.x + size.x/2, center.y + size.y/2, center.z + size.z/2),
        new THREE.Vector3(center.x - size.x/2, center.y + size.y/2, center.z + size.z/2)
    ];
    
    // Arêtes horizontales (4 en bas, 4 en haut)
    const edges = [
        [0, 1], [1, 2], [2, 3], [3, 0], // Face inférieure
        [4, 5], [5, 6], [6, 7], [7, 4], // Face supérieure
        [0, 4], [1, 5], [2, 6], [3, 7]  // Arêtes verticales
    ];
    
    edges.forEach(([i, j]) => {
        const geometry = new THREE.BufferGeometry().setFromPoints([vertices[i], vertices[j]]);
        
        // Ligne principale
        const mainLine = new THREE.Line(geometry, mainMaterial);
        helperGroup.add(mainLine);
        
        // Ligne de glow (effet de lueur subtil)
        const glowLine = new THREE.Line(geometry, glowMaterial);
        helperGroup.add(glowLine);
    });
    
    // Coins élégants avec effet de brillance (5 fois plus petits)
    const cornerSize = 0.02; // 0.1 / 5
    const cornerGlowSize = 0.03; // 0.15 / 5
    
    vertices.forEach(vertex => {
        // Coins principaux
        const cornerGeometry = new THREE.SphereGeometry(cornerSize, 16, 16);
        const cornerMaterial = new THREE.MeshBasicMaterial({ 
            color: boxColor, 
            opacity: 0.9, 
            transparent: true 
        });
        const corner = new THREE.Mesh(cornerGeometry, cornerMaterial);
        corner.position.copy(vertex);
        helperGroup.add(corner);
        
        // Effet de glow autour des coins
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
    
    // Créer le helper du centre de rotation au pivot
    if (bustPivot) {
        centerHelper = createCenterHelper();
        centerHelper.position.copy(bustPivot.position);
        scene.add(centerHelper);
    }
    
    // Créer le helper de la bounding box
    if (bust) {
        boundingBoxHelper = createBoundingBoxHelper(bust);
        scene.add(boundingBoxHelper);
    }
}

// Fonction pour créer un groupe pivot centré
function createBustPivot(bustMesh) {
    // Calculer le centre réel de l'objet
    const objectCenter = calculateObjectCenter();
    
    // Créer un groupe pivot au centre de l'objet
    bustPivot = new THREE.Group();
    bustPivot.position.copy(objectCenter);
    
    // Le buste est déjà centré et positionné par centerAndScaleModel
    // On le met simplement dans le pivot, le pivot étant au centre
    // Ajuster la position du buste pour qu'il soit relatif au pivot
    const currentPos = bustMesh.position.clone();
    bustMesh.position.sub(objectCenter); // Position relative au pivot
    
    // Ajouter le buste au pivot
    bustPivot.add(bustMesh);
    
    // Mettre à jour les helpers
    updateHelpers();
    
    return bustPivot;
}

// Fonction pour charger un modèle OBJ
function loadOBJModel(file, onSuccess, onProgress, onError) {
    const loader = new OBJLoader();
    loader.load(
        file,
        (object) => {
            console.log('Modèle OBJ chargé:', object);
            const model = object.clone();
            centerAndScaleModel(model);
            bust = applyMaterial(model);
            
            // Créer le pivot et ajouter à la scène
            bustPivot = createBustPivot(bust);
            scene.add(bustPivot);
            onSuccess();
        },
        onProgress,
        onError
    );
}

// Fonction pour charger un modèle STL
function loadSTLModel(file, onSuccess, onProgress, onError) {
    const loader = new STLLoader();
    loader.load(
        file,
        (geometry) => {
            console.log('Modèle STL chargé:', geometry);
            
            // Calculer la bounding box de la géométrie
            geometry.computeBoundingBox();
            const box = geometry.boundingBox;
            const center = new THREE.Vector3();
            box.getCenter(center);
            
            // Centrer la géométrie à l'origine
            geometry.translate(-center.x, -center.y, -center.z);
            
            // Créer le mesh avec la géométrie centrée
            const material = params.effectsEnabled ? createBustMaterial() : new THREE.MeshStandardMaterial({
                color: 0xe8dcc0, // Couleur plus claire
                roughness: 0.6,
                metalness: 0.05,
                side: THREE.DoubleSide
            });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            
            // Dimensionner le modèle
            centerAndScaleModel(mesh);
            bust = mesh;
            
            // Créer le pivot et ajouter à la scène
            bustPivot = createBustPivot(bust);
            scene.add(bustPivot);
            onSuccess();
        },
        onProgress,
        onError
    );
}

// Fonction pour charger un modèle GLTF
function loadGLTFModel(file, onSuccess, onProgress, onError) {
    const loader = new GLTFLoader();
    loader.load(
        file,
        (gltf) => {
            console.log('Modèle GLTF chargé:', gltf);
            const model = gltf.scene.clone();
            centerAndScaleModel(model);
            bust = applyMaterial(model);
            
            // Créer le pivot et ajouter à la scène
            bustPivot = createBustPivot(bust);
            scene.add(bustPivot);
            onSuccess();
        },
        onProgress,
        onError
    );
}

// Fonction principale pour charger un modèle
function loadModel(modelInfo) {
    if (!modelInfo) {
        console.error('Aucun modèle sélectionné');
        return;
    }
    
    // Supprimer l'ancien buste et pivot s'ils existent
    if (bustPivot) {
        scene.remove(bustPivot);
        bustPivot = null;
    }
    if (bust) {
        if (bust.geometry) bust.geometry.dispose();
        if (bust.material) {
            if (Array.isArray(bust.material)) {
                bust.material.forEach(mat => mat.dispose());
            } else {
                bust.material.dispose();
            }
        }
        bust.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(mat => mat.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });
        bust = null;
    }
    
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
        loadingElement.style.display = 'block';
        loadingElement.textContent = `Chargement: ${modelInfo.name}...`;
        loadingElement.style.color = '#ffd700';
    }
    
    const onSuccess = () => {
        console.log('Modèle chargé et ajouté à la scène');
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
    };
    
    const onProgress = (progress) => {
        if (progress.lengthComputable && loadingElement) {
            const percent = (progress.loaded / progress.total * 100).toFixed(0);
            loadingElement.textContent = `Chargement: ${modelInfo.name}... ${percent}%`;
        }
    };
    
    const onError = (error) => {
        console.error('Erreur lors du chargement du modèle:', error);
        if (loadingElement) {
            loadingElement.textContent = `Erreur: Impossible de charger ${modelInfo.name}`;
            loadingElement.style.color = '#ff0000';
        }
    };
    
    // Charger selon le type
    switch (modelInfo.type) {
        case 'obj':
            loadOBJModel(modelInfo.file, onSuccess, onProgress, onError);
            break;
        case 'stl':
            loadSTLModel(modelInfo.file, onSuccess, onProgress, onError);
            break;
        case 'gltf':
        case 'glb':
            loadGLTFModel(modelInfo.file, onSuccess, onProgress, onError);
            break;
        default:
            console.error('Type de modèle non supporté:', modelInfo.type);
            onError(new Error('Type de modèle non supporté'));
    }
}

function createScene() {
    // La scène sera créée lors de la sélection d'un modèle
    // Initialiser avec le premier modèle recommandé par défaut
    const defaultModel = availableModels.find(m => m.recommended) || availableModels[0];
    if (defaultModel) {
        loadModel(defaultModel);
    }
    
    // Tous les objets décoratifs ont été supprimés - seule l'objet chargé reste
}

function setupPostProcessing() {
    if (!renderer || !scene || !camera) {
        console.error('Cannot setup post-processing: renderer, scene, or camera not initialized');
        return;
    }
    
    try {
    composer = new EffectComposer(renderer);
    
    // Pass de rendu principal
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);
    
    // Bloom pour la diffusion lumineuse (sfumato) - ajusté pour être plus subtil et fidèle
    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.25, // strength - réduit pour plus de subtilité (sfumato léger)
        0.6,  // radius - réduit pour un effet plus localisé
        0.9   // threshold - plus élevé pour ne bloomer que les zones très lumineuses
    );
    composer.addPass(bloomPass);
    
    // Vignette et grain (post-processing final)
    const vignettePass = new ShaderPass(vignetteShader);
    vignettePass.renderToScreen = true; // Dernier pass
    composer.addPass(vignettePass);
    } catch (error) {
        console.error('Error setting up post-processing:', error);
        composer = null;
    }
}

// Fonction pour basculer entre les modes avec/sans effets
function toggleEffects() {
    if (!bust) return;
    
    // Créer une copie du buste pour préserver la structure
    const currentBust = bust;
    
    // Ajuster l'intensité des lumières selon le mode
    if (params.effectsEnabled) {
        // Mode avec effets - éclairage dramatique
        if (mainLight) mainLight.intensity = params.lightIntensity;
        if (fillLight) fillLight.intensity = 0.15;
        if (backLight) backLight.intensity = 0.2;
        const ambientLight = scene.children.find(child => child.type === 'AmbientLight');
        if (ambientLight) ambientLight.intensity = 0.3;
        
        applyShaderMaterial(currentBust);
        updateShaderUniforms();
    } else {
        // Mode sans effets - éclairage plus fort pour meilleure visibilité
        if (mainLight) mainLight.intensity = params.lightIntensity * 1.5;
        if (fillLight) fillLight.intensity = 0.4;
        if (backLight) backLight.intensity = 0.3;
        const ambientLight = scene.children.find(child => child.type === 'AmbientLight');
        if (ambientLight) ambientLight.intensity = 0.5;
        
        applyStandardMaterial(currentBust);
    }
    
    console.log('Mode effets:', params.effectsEnabled ? 'Activé' : 'Désactivé');
}

function setupUI() {
    // Toggle des effets
    const effectsToggle = document.getElementById('effects-toggle');
    if (effectsToggle) {
        effectsToggle.checked = params.effectsEnabled;
        
        // Fonction pour activer/désactiver les contrôles
        function updateControlsState() {
            const controls = document.querySelectorAll('#shadow-contrast, #light-intensity, #shadow-hardness, #scatter-amount, #edge-softness, #sss-intensity');
            controls.forEach(control => {
                control.disabled = !params.effectsEnabled;
                control.style.opacity = params.effectsEnabled ? '1' : '0.5';
                control.style.cursor = params.effectsEnabled ? 'pointer' : 'not-allowed';
            });
            
            // Masquer/afficher les sections de contrôles
            const allHeadings = Array.from(document.querySelectorAll('h2'));
            const chiaroscuroHeading = allHeadings.find(h2 => h2.textContent.includes('Clair-Obscur'));
            const sfumatoHeading = allHeadings.find(h2 => h2.textContent.includes('Sfumato'));
            
            if (chiaroscuroHeading) {
                const section = chiaroscuroHeading.parentElement;
                if (section) {
                    section.style.opacity = params.effectsEnabled ? '1' : '0.5';
                }
            }
            if (sfumatoHeading) {
                const section = sfumatoHeading.parentElement;
                if (section) {
                    section.style.opacity = params.effectsEnabled ? '1' : '0.5';
                }
            }
        }
        
        // Initialiser l'état des contrôles
        updateControlsState();
        
        effectsToggle.addEventListener('change', (e) => {
            params.effectsEnabled = e.target.checked;
            toggleEffects();
            updateControlsState();
        });
    }
    
    // Toggle rotation buste/caméra
    const rotateBustToggle = document.getElementById('rotate-bust-toggle');
    if (rotateBustToggle) {
        rotateBustToggle.checked = params.rotateBust;
        
        rotateBustToggle.addEventListener('change', (e) => {
            params.rotateBust = e.target.checked;
            
            // Activer/désactiver OrbitControls selon le mode
            if (controls) {
                controls.enabled = !params.rotateBust;
            }
            
            // Réinitialiser la rotation du buste si on passe en mode caméra
            if (!params.rotateBust && bustPivot) {
                bustRotation = { x: 0, y: 0, z: 0 };
                bustPivot.rotation.x = 0;
                bustPivot.rotation.y = 0;
                bustPivot.rotation.z = 0;
            }
            
            // Réinitialiser la rotation automatique
            autoRotationVelocity = { x: 0, y: 0, z: 0 };
            
            // Changer le curseur
            const canvas = renderer.domElement;
            if (canvas) {
                canvas.style.cursor = params.rotateBust ? 'grab' : 'default';
            }
            
            console.log('Mode rotation:', params.rotateBust ? 'Buste' : 'Caméra');
        });
    }
    
    // Toggle rotation automatique avec inertie
    const autoRotationToggle = document.getElementById('auto-rotation-toggle');
    if (autoRotationToggle) {
        autoRotationToggle.checked = autoRotationEnabled;
        
        autoRotationToggle.addEventListener('change', (e) => {
            autoRotationEnabled = e.target.checked;
            
            // Réinitialiser la vélocité si on désactive
            if (!autoRotationEnabled) {
                autoRotationVelocity = { x: 0, y: 0, z: 0 };
            }
            
            console.log('Rotation automatique:', autoRotationEnabled ? 'Activée' : 'Désactivée');
        });
    }
    
    // Toggle animation de la lumière spot
    const lightAnimationToggle = document.getElementById('light-animation-toggle');
    if (lightAnimationToggle) {
        lightAnimationToggle.checked = params.lightAnimation;
        
        lightAnimationToggle.addEventListener('change', (e) => {
            params.lightAnimation = e.target.checked;
            
            // Réinitialiser l'angle si on désactive
            if (!params.lightAnimation && mainLight) {
                // Repositionner la lumière à sa position initiale
                const objectCenter = calculateObjectCenter();
                mainLight.position.set(objectCenter.x - 3, objectCenter.y + 4, objectCenter.z + 2);
                mainLight.target.position.copy(objectCenter);
                
                // Mettre à jour le helper
                if (lightHelpers[0]) {
                    lightHelpers[0].position.copy(mainLight.position);
                    lightHelpers[0].lookAt(objectCenter);
                }
            }
            
            console.log('Animation lumière:', params.lightAnimation ? 'Activée' : 'Désactivée');
        });
    }
    
    // Initialiser le sélecteur de modèle
    const modelSelector = document.getElementById('model-selector');
    if (modelSelector) {
        // Vider les options existantes
        modelSelector.innerHTML = '';
        
        // Ajouter les modèles disponibles
        availableModels.forEach((model, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = `${model.name}${model.recommended ? ' ⭐' : ''}`;
            option.title = model.description;
            modelSelector.appendChild(option);
        });
        
        // Sélectionner le modèle recommandé par défaut
        const defaultIndex = availableModels.findIndex(m => m.recommended);
        if (defaultIndex >= 0) {
            modelSelector.value = defaultIndex;
        } else if (availableModels.length > 0) {
            modelSelector.value = 0;
        }
        
        // Afficher la description du modèle sélectionné
        const modelDescription = document.getElementById('model-description');
        function updateDescription(index) {
            if (modelDescription && index >= 0 && index < availableModels.length) {
                modelDescription.textContent = availableModels[index].description;
            }
        }
        
        // Mettre à jour la description au chargement
        if (modelSelector.value !== '') {
            updateDescription(parseInt(modelSelector.value));
        }
        
        // Gérer le changement de modèle
        modelSelector.addEventListener('change', (e) => {
            const selectedIndex = parseInt(e.target.value);
            if (selectedIndex >= 0 && selectedIndex < availableModels.length) {
                const selectedModel = availableModels[selectedIndex];
                console.log('Modèle sélectionné:', selectedModel);
                updateDescription(selectedIndex);
                loadModel(selectedModel);
            }
        });
    }
    
    // Contraste des ombres
    const shadowContrastSlider = document.getElementById('shadow-contrast');
    const contrastValue = document.getElementById('contrast-value');
    shadowContrastSlider.addEventListener('input', (e) => {
        params.shadowContrast = parseFloat(e.target.value);
        contrastValue.textContent = params.shadowContrast.toFixed(2);
        updateShaderUniforms();
    });
    
    // Intensité lumière
    const lightIntensitySlider = document.getElementById('light-intensity');
    const lightValue = document.getElementById('light-value');
    lightIntensitySlider.addEventListener('input', (e) => {
        params.lightIntensity = parseFloat(e.target.value);
        lightValue.textContent = params.lightIntensity.toFixed(2);
        if (mainLight) {
        mainLight.intensity = params.lightIntensity;
        }
        updateShaderUniforms();
    });
    
    // Couleur de la lumière spot
    const lightColorPicker = document.getElementById('light-color');
    if (lightColorPicker) {
        // Convertir la couleur hex en string pour l'input color
        lightColorPicker.value = '#' + params.lightColor.toString(16).padStart(6, '0');
        
        lightColorPicker.addEventListener('input', (e) => {
            // Convertir la couleur hex en nombre
            const hexColor = e.target.value;
            params.lightColor = parseInt(hexColor.replace('#', '0x'));
            
            // Mettre à jour la couleur de la lumière
            if (mainLight) {
                mainLight.color.setHex(params.lightColor);
            }
            
            // Mettre à jour le helper de la lumière
            if (lightHelpers[0]) {
                lightHelpers[0].traverse((child) => {
                    if (child.material) {
                        child.material.color.setHex(params.lightColor);
                    }
                });
            }
            
            // Mettre à jour les uniformes du shader
            updateShaderUniforms();
            
            console.log('Couleur lumière mise à jour:', hexColor);
        });
    }
    
    // Dureté des ombres
    const shadowHardnessSlider = document.getElementById('shadow-hardness');
    const hardnessValue = document.getElementById('hardness-value');
    shadowHardnessSlider.addEventListener('input', (e) => {
        params.shadowHardness = parseFloat(e.target.value);
        hardnessValue.textContent = params.shadowHardness.toFixed(2);
        updateShaderUniforms();
    });
    
    // Diffusion atmosphérique
    const scatterSlider = document.getElementById('scatter-amount');
    const scatterValue = document.getElementById('scatter-value');
    scatterSlider.addEventListener('input', (e) => {
        params.scatterAmount = parseFloat(e.target.value);
        scatterValue.textContent = params.scatterAmount.toFixed(2);
        updateShaderUniforms();
    });
    
    // Adoucissement contours
    const softnessSlider = document.getElementById('edge-softness');
    const softnessValue = document.getElementById('softness-value');
    softnessSlider.addEventListener('input', (e) => {
        params.edgeSoftness = parseFloat(e.target.value);
        softnessValue.textContent = params.edgeSoftness.toFixed(2);
        updateShaderUniforms();
    });
    
    // SSS
    const sssSlider = document.getElementById('sss-intensity');
    const sssValue = document.getElementById('sss-value');
    sssSlider.addEventListener('input', (e) => {
        params.sssIntensity = parseFloat(e.target.value);
        sssValue.textContent = params.sssIntensity.toFixed(2);
        updateShaderUniforms();
    });
    
    // Presets
    document.getElementById('preset-davinci').addEventListener('click', () => {
        applyPreset('davinci');
    });
    
    document.getElementById('preset-caravaggio').addEventListener('click', () => {
        applyPreset('caravaggio');
    });
    
    document.getElementById('preset-rembrandt').addEventListener('click', () => {
        applyPreset('rembrandt');
    });
}

function applyPreset(preset) {
    const presets = {
        davinci: {
            shadowContrast: 1.8,
            lightIntensity: 1.2,
            shadowHardness: 0.3,
            scatterAmount: 0.25,
            edgeSoftness: 0.6,
            sssIntensity: 0.7
        },
        caravaggio: {
            shadowContrast: 3.5,
            lightIntensity: 2.2,
            shadowHardness: 0.9,
            scatterAmount: 0.05,
            edgeSoftness: 0.1,
            sssIntensity: 0.2
        },
        rembrandt: {
            shadowContrast: 2.2,
            lightIntensity: 1.6,
            shadowHardness: 0.6,
            scatterAmount: 0.15,
            edgeSoftness: 0.4,
            sssIntensity: 0.5
        }
    };
    
    const p = presets[preset];
    params.shadowContrast = p.shadowContrast;
    params.lightIntensity = p.lightIntensity;
    params.shadowHardness = p.shadowHardness;
    params.scatterAmount = p.scatterAmount;
    params.edgeSoftness = p.edgeSoftness;
    params.sssIntensity = p.sssIntensity;
    
    // Mettre à jour les sliders
    document.getElementById('shadow-contrast').value = p.shadowContrast;
    document.getElementById('light-intensity').value = p.lightIntensity;
    document.getElementById('shadow-hardness').value = p.shadowHardness;
    document.getElementById('scatter-amount').value = p.scatterAmount;
    document.getElementById('edge-softness').value = p.edgeSoftness;
    document.getElementById('sss-intensity').value = p.sssIntensity;
    
    // Mettre à jour les valeurs affichées (précision à 2 décimales pour tous)
    document.getElementById('contrast-value').textContent = p.shadowContrast.toFixed(2);
    document.getElementById('light-value').textContent = p.lightIntensity.toFixed(2);
    document.getElementById('hardness-value').textContent = p.shadowHardness.toFixed(2);
    document.getElementById('scatter-value').textContent = p.scatterAmount.toFixed(2);
    document.getElementById('softness-value').textContent = p.edgeSoftness.toFixed(2);
    document.getElementById('sss-value').textContent = p.sssIntensity.toFixed(2);
    
    if (mainLight) {
    mainLight.intensity = p.lightIntensity;
    }
    updateShaderUniforms();
}

function updateShaderUniforms() {
    if (!bust) return;
    
    // Parcourir tous les meshes dans le buste (peut être un Group ou un Mesh)
    bust.traverse((child) => {
        if (child.isMesh && child.material && child.material.uniforms) {
            child.material.uniforms.shadowContrast.value = params.shadowContrast;
            child.material.uniforms.lightIntensity.value = params.lightIntensity;
            child.material.uniforms.shadowHardness.value = params.shadowHardness;
            child.material.uniforms.scatterAmount.value = params.scatterAmount;
            child.material.uniforms.edgeSoftness.value = params.edgeSoftness;
            child.material.uniforms.sssIntensity.value = params.sssIntensity;
            // Update light position and color
            if (mainLight) {
                child.material.uniforms.lightPosition.value.copy(mainLight.position);
                child.material.uniforms.lightColor.value.setHex(params.lightColor);
            }
        }
    });
    
    // Support pour les meshes simples (pas de groupe)
    if (bust.isMesh && bust.material && bust.material.uniforms) {
        bust.material.uniforms.shadowContrast.value = params.shadowContrast;
        bust.material.uniforms.lightIntensity.value = params.lightIntensity;
        bust.material.uniforms.shadowHardness.value = params.shadowHardness;
        bust.material.uniforms.scatterAmount.value = params.scatterAmount;
        bust.material.uniforms.edgeSoftness.value = params.edgeSoftness;
        bust.material.uniforms.sssIntensity.value = params.sssIntensity;
        if (mainLight) {
            bust.material.uniforms.lightPosition.value.copy(mainLight.position);
            bust.material.uniforms.lightColor.value.setHex(params.lightColor);
        }
    }
}

// Fonction pour configurer les contrôles de rotation du buste
function setupBustRotationControls() {
    if (!renderer) {
        console.warn('Renderer non initialisé, impossible de configurer les contrôles de rotation');
        return;
    }
    
    const canvas = renderer.domElement;
    
    // Démarrer le drag
    canvas.addEventListener('mousedown', (e) => {
        if (params.rotateBust && bustPivot) {
            isDragging = true;
            previousMousePosition = {
                x: e.clientX,
                y: e.clientY
            };
            canvas.style.cursor = 'grabbing';
        }
    });
    
    // Arrêter le drag
    canvas.addEventListener('mouseup', () => {
        if (params.rotateBust) {
            isDragging = false;
            canvas.style.cursor = 'grab';
        }
    });
    
    // Sortir du canvas
    canvas.addEventListener('mouseleave', () => {
        if (params.rotateBust) {
            isDragging = false;
            canvas.style.cursor = 'default';
        }
    });
    
    // Rotation pendant le drag
    canvas.addEventListener('mousemove', (e) => {
        if (!isDragging || !params.rotateBust || !bustPivot) return;
        
        const deltaX = e.clientX - previousMousePosition.x;
        const deltaY = e.clientY - previousMousePosition.y;
        
        // Rotation horizontale (Y) et verticale (X)
        bustRotation.y += deltaX * 0.01;
        bustRotation.x += deltaY * 0.01;
        
        // Enregistrer la vélocité pour la rotation automatique
        if (autoRotationEnabled) {
            autoRotationVelocity.y = deltaX * 0.001; // Vitesse de rotation Y
            autoRotationVelocity.x = deltaY * 0.001; // Vitesse de rotation X
            if (e.shiftKey) {
                autoRotationVelocity.z = deltaX * 0.001; // Vitesse de rotation Z
            }
        }
        
        // Appliquer les rotations sur le pivot (rotation complète sur les 3 axes)
        bustPivot.rotation.y = bustRotation.y;
        bustPivot.rotation.x = bustRotation.x;
        // Rotation Z (roulis) avec Shift + drag
        if (e.shiftKey) {
            bustRotation.z = (bustRotation.z || 0) + deltaX * 0.01;
            bustPivot.rotation.z = bustRotation.z;
        }
        
        previousMousePosition = {
            x: e.clientX,
            y: e.clientY
        };
    });
    
    // Arrêter la rotation automatique quand on relâche la souris
    canvas.addEventListener('mouseup', () => {
        if (params.rotateBust && autoRotationEnabled) {
            // La vélocité est déjà enregistrée, elle continuera avec friction
        }
    });
    
    // Zoom avec la molette (même en mode rotation buste)
    canvas.addEventListener('wheel', (e) => {
        if (params.rotateBust) {
            e.preventDefault();
            const delta = e.deltaY * 0.01;
            camera.position.z += delta;
            camera.position.z = Math.max(2, Math.min(10, camera.position.z));
        }
    });
    
    // Recentrer la vue avec le bouton du milieu (molette) - fonctionne dans tous les modes
    canvas.addEventListener('mousedown', (e) => {
        if (e.button === 1) { // Bouton du milieu (molette)
            e.preventDefault();
            recenterView();
            return false;
        }
    });
    
    // Empêcher le comportement par défaut du bouton du milieu (scroll)
    canvas.addEventListener('auxclick', (e) => {
        if (e.button === 1) {
            e.preventDefault();
            recenterView();
            return false;
        }
    });
    
    // Changer le curseur au survol
    canvas.addEventListener('mouseenter', () => {
        if (params.rotateBust) {
            canvas.style.cursor = 'grab';
        }
    });
}

// Fonction pour calculer le centre réel de l'objet
function calculateObjectCenter() {
    if (!bust) return new THREE.Vector3(0, 1.5, 0);
    
    // Calculer la bounding box de l'objet dans l'espace monde
    const box = new THREE.Box3().setFromObject(bust);
    
    if (box.isEmpty()) {
        // Si la bounding box est vide, retourner le centre par défaut
        return new THREE.Vector3(0, 1.5, 0);
    }
    
    // Obtenir le centre de la bounding box
    const center = box.getCenter(new THREE.Vector3());
    
    return center;
}

// Fonction pour ajuster le centre de la vue automatiquement
function adjustViewCenter() {
    if (!bust || !camera) return;
    
    // Calculer le centre réel de l'objet
    const objectCenter = calculateObjectCenter();
    
    // Ajuster le target des OrbitControls pour pointer vers le centre de l'objet
    if (controls) {
        // Calculer le déplacement nécessaire
        const offset = objectCenter.clone().sub(controls.target);
        
        // Ajuster le target
        controls.target.copy(objectCenter);
        
        // Ajuster la position de la caméra pour compenser le déplacement
        camera.position.add(offset);
        
        // Mettre à jour les contrôles
        controls.update();
    }
    
    // Ajuster la position du pivot si on est en mode rotation buste
    if (bustPivot && params.rotateBust) {
        bustPivot.position.copy(objectCenter);
    }
    
    // Mettre à jour les helpers
    updateHelpers();
}

// Fonction pour recentrer la vue
function recenterView() {
    // Calculer le centre réel de l'objet
    const objectCenter = calculateObjectCenter();
    
    // Réinitialiser la position de la caméra
    const distance = camera.position.distanceTo(controls ? controls.target : objectCenter);
    camera.position.set(objectCenter.x, objectCenter.y, objectCenter.z + distance);
    camera.lookAt(objectCenter);
    
    // Réinitialiser les contrôles OrbitControls
    if (controls) {
        controls.target.copy(objectCenter);
        controls.update();
    }
    
    // Ajuster la position du pivot au centre de l'objet
    if (bustPivot) {
        bustPivot.position.copy(objectCenter);
    }
    
    // Réinitialiser la rotation du buste si on est en mode rotation buste
    if (bustPivot && params.rotateBust) {
        bustRotation = { x: 0, y: 0, z: 0 };
        bustPivot.rotation.x = 0;
        bustPivot.rotation.y = 0;
        bustPivot.rotation.z = 0;
    }
    
    // Réinitialiser la rotation automatique
    autoRotationVelocity = { x: 0, y: 0, z: 0 };
    
    // Mettre à jour les helpers
    updateHelpers();
    
    console.log('Vue recentrée sur:', objectCenter);
}

function animate() {
    requestAnimationFrame(animate);
    
    if (!renderer || !scene || !camera) return;
    
    // Animation de la lumière spot autour de l'objet (pour mettre en valeur le clair-obscur)
    if (params.lightAnimation && mainLight && bust) {
        const objectCenter = calculateObjectCenter();
        const time = performance.now() * 0.001; // Temps en secondes
        
        // Calculer la position de la lumière sur un cercle autour de l'objet
        // Rotation horizontale (autour de Y) et variation verticale
        const radius = params.lightAnimationRadius;
        const height = params.lightAnimationHeight;
        
        // Angle de rotation horizontal
        lightAnimationAngle += params.lightAnimationSpeed * 0.016; // ~60fps
        if (lightAnimationAngle > Math.PI * 2) {
            lightAnimationAngle -= Math.PI * 2;
        }
        
        // Position de la lumière sur un cercle horizontal avec variation verticale
        const x = objectCenter.x + Math.cos(lightAnimationAngle) * radius;
        const z = objectCenter.z + Math.sin(lightAnimationAngle) * radius;
        const y = objectCenter.y + height + Math.sin(lightAnimationAngle * 2) * 0.5; // Légère variation verticale
        
        mainLight.position.set(x, y, z);
        
        // Orienter la lumière vers le centre de l'objet
        mainLight.target.position.copy(objectCenter);
        mainLight.target.updateMatrixWorld();
        
        // Mettre à jour le helper de la lumière
        if (lightHelpers[0]) {
            lightHelpers[0].position.copy(mainLight.position);
            lightHelpers[0].lookAt(objectCenter);
        }
    }
    
    // Mettre à jour les contrôles selon le mode
    if (params.rotateBust) {
        // Mode rotation buste - pas de mise à jour OrbitControls
        // Le buste est tourné directement via les événements souris
    } else {
        // Mode rotation caméra - utiliser OrbitControls
    controls.update();
    
        // Ajuster automatiquement le centre si la caméra a bougé (pan)
        // On vérifie si le target s'est éloigné du centre de l'objet
    if (bust) {
            const objectCenter = calculateObjectCenter();
            const targetDistance = controls.target.distanceTo(objectCenter);
            
            // Si le target est trop éloigné du centre (plus de 0.1 unité), ajuster
            if (targetDistance > 0.1) {
                adjustViewCenter();
            }
        }
    }
    
    // Rotation automatique avec inertie (si activée)
    if (bustPivot && params.rotateBust && autoRotationEnabled && !isDragging) {
        // Appliquer la rotation avec la vélocité enregistrée
        bustRotation.y += autoRotationVelocity.y;
        bustRotation.x += autoRotationVelocity.x;
        bustRotation.z += autoRotationVelocity.z;
        
        bustPivot.rotation.y = bustRotation.y;
        bustPivot.rotation.x = bustRotation.x;
        bustPivot.rotation.z = bustRotation.z;
        
        // Appliquer la friction pour ralentir progressivement
        autoRotationVelocity.y *= friction;
        autoRotationVelocity.x *= friction;
        autoRotationVelocity.z *= friction;
        
        // Arrêter si la vélocité est trop faible
        const minVelocity = 0.0001;
        if (Math.abs(autoRotationVelocity.y) < minVelocity && 
            Math.abs(autoRotationVelocity.x) < minVelocity && 
            Math.abs(autoRotationVelocity.z) < minVelocity) {
            autoRotationVelocity = { x: 0, y: 0, z: 0 };
        }
    }
    
    // Mettre à jour les helpers (rotation du centre et bounding box)
    if (centerHelper && bustPivot) {
        centerHelper.position.copy(bustPivot.position);
        centerHelper.rotation.copy(bustPivot.rotation);
    }
    
    if (boundingBoxHelper && bust) {
        // Mettre à jour la bounding box helper
        scene.remove(boundingBoxHelper);
        boundingBoxHelper.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });
        boundingBoxHelper = createBoundingBoxHelper(bust);
        scene.add(boundingBoxHelper);
    }
    
    // Mettre à jour les helpers de lumière (suivre les positions des lumières)
    if (mainLight && lightHelpers[0]) {
        lightHelpers[0].position.copy(mainLight.position);
        // Orienter le helper selon la direction de la lumière
        if (mainLight.target) {
            lightHelpers[0].lookAt(mainLight.target.position);
        }
    }
    if (fillLight && lightHelpers[1]) {
        lightHelpers[1].position.copy(fillLight.position);
    }
    if (backLight && lightHelpers[2]) {
        lightHelpers[2].position.copy(backLight.position);
    }
    
    // Rotation automatique subtile du buste (seulement si pas en mode drag et pas de rotation auto)
    if (bustPivot && !params.rotateBust && !isDragging && !autoRotationEnabled) {
        bustPivot.rotation.y += 0.001;
    }
    
    // Update light position and color in shader (pour tous les meshes)
    if (bust && mainLight) {
        bust.traverse((child) => {
            if (child.isMesh && child.material && child.material.uniforms) {
                if (child.material.uniforms.lightPosition) {
                    child.material.uniforms.lightPosition.value.copy(mainLight.position);
                }
                if (child.material.uniforms.lightColor) {
                    child.material.uniforms.lightColor.value.setHex(params.lightColor);
                }
            }
        });
        
        // Support pour les meshes simples
        if (bust.isMesh && bust.material && bust.material.uniforms) {
            if (bust.material.uniforms.lightPosition) {
                bust.material.uniforms.lightPosition.value.copy(mainLight.position);
            }
            if (bust.material.uniforms.lightColor) {
                bust.material.uniforms.lightColor.value.setHex(params.lightColor);
            }
        }
    }
    
    // Mettre à jour le temps pour le grain de film (si le shader l'utilise)
    if (composer && composer.passes) {
        composer.passes.forEach(pass => {
            if (pass.uniforms && pass.uniforms.time) {
                pass.uniforms.time.value = performance.now() * 0.001;
            }
        });
    }
    
    // Mise à jour des stats
    stats.frames++;
    const currentTime = performance.now();
    if (currentTime >= stats.lastTime + 1000) {
        stats.fps = Math.round((stats.frames * 1000) / (currentTime - stats.lastTime));
        stats.lastTime = currentTime;
        stats.frames = 0;
        
        const statsElement = document.getElementById('stats');
        if (statsElement) {
            statsElement.innerHTML = `FPS: ${stats.fps}<br>Polygons: ~${(scene.children.length * 2048).toLocaleString()}`;
        }
    }
    
    // Render with composer if available, otherwise use renderer directly
    if (composer) {
    composer.render();
    } else {
        renderer.render(scene, camera);
    }
}

// Gestion du redimensionnement
window.addEventListener('resize', () => {
    if (!camera || !renderer) return;
    
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    if (composer) {
    composer.setSize(window.innerWidth, window.innerHeight);
    }
});

// Initialisation
init();
