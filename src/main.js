/**
 * Polifonías del Amar - Main Script
 *
 * Versión: 1.0.0 (Producción)
 * Descripción: Script principal para la visualización interactiva de testimonios
 * sobre el amor, utilizando Three.js para la representación 3D.
 */

import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import gsap from 'gsap';

// ==========================================================================
// 0. PANEL DE CONFIGURACIÓN
// ==========================================================================
const CONFIG = {
    dataPath: 'data/testimonios.json',
    starTexturePath: './textures/soft_particle.png',
    dustTexturePath: './textures/soft_particle.png',
    scene: {
        backgroundColor: 0x101015,
        hoverColor: '#FFD700',
    },
    stars: {
        initialRadius: 70,
        size: 14.0,
        colorSaturation: 0.9,
        colorLightness: 0.78,
        hueMin: 0.55,
        hueRange: 0.25
    },
    dust: {
        count: 7000,
        size: 0.6,
        radius: 300,
        color: 0xaaaaaa,
        opacity: 0.4,
    },
    animation: {
        filterDuration: 4.5,
        filterEase: 'power3.inOut',
        dustRotationSpeed: 0.0002,
    },
    interaction: {
        raycasterThreshold: 3.0,
        dragThreshold: 5,
    },
    audio: {
        backgroundVolume: 0.15,
        attenuatedVolume: 0.03,
        fadeDuration: 1.5,
    }
};

// ==========================================================================
// 1. DECLARACIÓN DE VARIABLES Y REFERENCIAS GLOBALES
// ==========================================================================
let scene, camera, renderer, controls, stars, canvas;
let testimonios = [];
let isAnimating = false;
const initialPositions = [];
let dustContainer;

const raycaster = new THREE.Raycaster();
raycaster.params.Points.threshold = CONFIG.interaction.raycasterThreshold;
const mouse = new THREE.Vector2();
let mouseX = 0, mouseY = 0;
let currentIntersectedIndex = null;
let currentAudio = null;
let backgroundAudioStarted = false;

let isDragging = false;
const mouseDownPosition = new THREE.Vector2();

let activeFilters = {
    Pregunta_Respondida: 'all',
    Genero: [],
    Edad: []
};

const hoverColor = new THREE.Color(CONFIG.scene.hoverColor);
const questionMap = {
    'Primera_Vez_Amor': '¿Cuál fue la primera vez que sentiste que amabas a alguien o algo?',
    'Amor_Palabra_Frase': 'Si tuvieras que resumir el amor en una palabra o frase, ¿cómo lo describirías?',
    'Amor_Puede_Doler': '¿Crees que el amor puede doler?',
    'Amor_Como_Persona': 'Si el amor fuera una persona, ¿cómo sería?',
    'Accion_Cotidiana_Amor': 'En tu día a día, ¿qué pequeña acción te hace sentir que ‘esto es amor’?',
    'Ensenanza_Faltante_Amor': '¿Qué te hubiera gustado que te enseñaran sobre el amor?',
    'Mensaje_Sobre_Amor': 'Si pudieras dejar un mensaje breve sobre el amor, ¿cuál sería?'
};

const UI = {
    infoPanel: document.querySelector('.info-panel'),
    filterContainer: document.querySelector('.constellation-menu'),
    closeBtn: document.querySelector('.close-btn'),
    titleElement: document.getElementById('title-element'),
    questionTitle: document.getElementById('question-title'),
    transcriptionText: document.getElementById('transcription-text'),
    toneElement: document.getElementById('tone-element'),
    metaphorElement: document.getElementById('metaphor-element'),
    archetypeElement: document.getElementById('archetype-element'),
    neuroElement: document.getElementById('neuro-element'),
    tooltip: document.getElementById('tooltip'),
    ageElement: document.getElementById('age-element'),
    toggleFiltersBtn: document.getElementById('toggle-filters-btn'),
    resetFiltersBtn: document.getElementById('reset-filters-btn'),
    backgroundAudio: document.getElementById('background-audio'),
    introOverlay: document.getElementById('intro-overlay'),
    enterButton: document.getElementById('enter-btn'),
};

// ==========================================================================
// 2. INICIALIZACIÓN Y CREACIÓN DE LA ESCENA
// ==========================================================================
scene = new THREE.Scene();

async function initialize() {
    await loadDataAndCreateScene();
    if (testimonios.length > 0) {
        setupEventListeners();
        animate();
    } else {
        console.error("La inicialización falló porque no se cargaron los testimonios.");
    }
}

async function loadDataAndCreateScene() {
    try {
        const response = await fetch(CONFIG.dataPath);
        if (!response.ok) throw new Error(`Error al cargar ${CONFIG.dataPath}`);
        testimonios = await response.json();
        createStars();
        createDust();
        createSceneSetup();
    } catch (error) {
        console.error("Error al cargar y crear la escena:", error);
    }
}

function createStars() {
    const starGeometry = new THREE.BufferGeometry();
    const starCount = testimonios.length;
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
        const i3 = i * 3;
        const radius = CONFIG.stars.initialRadius;
        const u = Math.random(), v = Math.random();
        const theta = u * 2 * Math.PI, phi = Math.acos(2 * v - 1);
        positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
        positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
        positions[i3 + 2] = radius * Math.cos(phi);
        initialPositions.push(positions[i3], positions[i3 + 1], positions[i3 + 2]);

        const hue = CONFIG.stars.hueMin + Math.random() * CONFIG.stars.hueRange;
        const randomColor = new THREE.Color().setHSL(hue, CONFIG.stars.colorSaturation, CONFIG.stars.colorLightness);
        testimonios[i].originalColor = randomColor;
        colors.set([randomColor.r, randomColor.g, randomColor.b], i3);
    }

    starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const starMaterial = new THREE.PointsMaterial({
        size: CONFIG.stars.size,
        vertexColors: true,
        sizeAttenuation: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        map: new THREE.TextureLoader().load(CONFIG.starTexturePath)
    });
    stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);
}

function createDust() {
    const dustGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(CONFIG.dust.count * 3);
    const radius = CONFIG.dust.radius;

    for (let i = 0; i < CONFIG.dust.count; i++) {
        const i3 = i * 3;
        positions[i3] = (Math.random() - 0.5) * radius;
        positions[i3 + 1] = (Math.random() - 0.5) * radius;
        positions[i3 + 2] = (Math.random() - 0.5) * radius;
    }

    dustGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const dustMaterial = new THREE.PointsMaterial({
        size: CONFIG.dust.size,
        color: CONFIG.dust.color,
        transparent: true,
        opacity: CONFIG.dust.opacity,
        map: new THREE.TextureLoader().load(CONFIG.dustTexturePath),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });
    const dust = new THREE.Points(dustGeometry, dustMaterial);
    dustContainer = new THREE.Group();
    dustContainer.add(dust);
    scene.add(dustContainer);
}

function createSceneSetup() {
    const sizes = { width: window.innerWidth, height: window.innerHeight };
    camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 1000);
    camera.position.set(0, 0, 180);
    scene.add(camera);
    canvas = document.querySelector('canvas.webgl');
    controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setClearColor(CONFIG.scene.backgroundColor, 1);
    renderer.setSize(sizes.width, sizes.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

// ==========================================================================
// 3. LÓGICA DE TRANSFORMACIÓN E INTERACCIÓN
// ==========================================================================

function applyFilters() {
    if (isAnimating || !stars) return;
    isAnimating = true;
    const centerRadius = 50;
    const scatterRadius = 300;

    const testimonioMatchesFilters = (testimonio) => {
        const { Pregunta_Respondida, Genero, Edad } = activeFilters;
        if (Pregunta_Respondida !== 'all' && testimonio.Pregunta_Respondida !== Pregunta_Respondida) return false;
        if (Genero.length > 0 && !Genero.includes(testimonio.Genero)) return false;
        if (Edad.length > 0 && !Edad.some(rango => {
            const [min, max] = rango.split('-').map(Number);
            return testimonio.Edad >= min && testimonio.Edad <= max;
        })) {
            return false;
        }
        return true;
    };

    for (let i = 0; i < testimonios.length; i++) {
        const i3 = i * 3;
        const debeEstarAgrupada = testimonioMatchesFilters(testimonios[i]);
        let targetX, targetY, targetZ;

        if (debeEstarAgrupada) {
            if (activeFilters.Pregunta_Respondida === 'all' && activeFilters.Genero.length === 0 && activeFilters.Edad.length === 0) {
                targetX = initialPositions[i3];
                targetY = initialPositions[i3 + 1];
                targetZ = initialPositions[i3 + 2];
            } else {
                const u = Math.random(), v = Math.random();
                const theta = u * 2 * Math.PI, phi = Math.acos(2 * v - 1);
                targetX = centerRadius * Math.sin(phi) * Math.cos(theta);
                targetY = centerRadius * Math.sin(phi) * Math.sin(theta);
                targetZ = centerRadius * Math.cos(phi);
            }
        } else {
            const u = Math.random(), v = Math.random();
            const theta = u * 2 * Math.PI, phi = Math.acos(2 * v - 1);
            targetX = scatterRadius * Math.sin(phi) * Math.cos(theta);
            targetY = scatterRadius * Math.sin(phi) * Math.sin(theta);
            targetZ = scatterRadius * Math.cos(phi);
        }
        gsap.to(stars.geometry.attributes.position.array, {
            duration: CONFIG.animation.filterDuration,
            ease: CONFIG.animation.filterEase,
            [i3]: targetX, [i3 + 1]: targetY, [i3 + 2]: targetZ,
        });
    }

    gsap.to({}, {
        duration: CONFIG.animation.filterDuration,
        onUpdate: () => { stars.geometry.attributes.position.needsUpdate = true; },
        onComplete: () => { isAnimating = false; }
    });
}

function resetAllFilters() {
    if (isAnimating) return;
    activeFilters = { Pregunta_Respondida: 'all', Genero: [], Edad: [] };
    UI.filterContainer.querySelectorAll('input[type="checkbox"]').forEach(checkbox => { checkbox.checked = false; });
    const nebulaRadio = UI.filterContainer.querySelector('input[type="radio"][value="all"]');
    if (nebulaRadio) nebulaRadio.checked = true;
    applyFilters();
}

function setupEventListeners() {
    if (UI.enterButton) {
        UI.enterButton.addEventListener('click', () => {
            UI.introOverlay.classList.add('hidden');
            if (!backgroundAudioStarted && UI.backgroundAudio) {
                UI.backgroundAudio.volume = CONFIG.audio.backgroundVolume;
                UI.backgroundAudio.play().catch(e => console.error("Error al reproducir audio de fondo:", e));
                backgroundAudioStarted = true;
            }
            UI.introOverlay.addEventListener('transitionend', () => {
                UI.introOverlay.remove();
            });
             document.body.classList.add('filters-panel-visible');
        }, { once: true });
    }

    UI.toggleFiltersBtn.addEventListener('click', () => {
        document.body.classList.toggle('filters-panel-visible');
    });

    UI.resetFiltersBtn.addEventListener('click', resetAllFilters);

    UI.filterContainer.addEventListener('change', (event) => {
        if (isAnimating) {
            event.target.checked = !event.target.checked;
            return;
        }
        const input = event.target;
        const key = input.dataset.filterKey;
        const value = input.value;
        if (input.type === 'radio') {
            activeFilters[key] = value;
        } else if (input.type === 'checkbox') {
            if (input.checked) {
                activeFilters[key].push(value);
            } else {
                activeFilters[key] = activeFilters[key].filter(item => item !== value);
            }
        }
        applyFilters();
    });

    canvas.addEventListener('mousedown', (event) => {
        isDragging = false;
        mouseDownPosition.set(event.clientX, event.clientY);
    });

    canvas.addEventListener('mousemove', (event) => {
        if (mouseDownPosition.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) > CONFIG.interaction.dragThreshold) {
            isDragging = true;
        }
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        mouseX = event.clientX;
        mouseY = event.clientY;
    });

    canvas.addEventListener('click', () => {
        if (isDragging || isAnimating || currentIntersectedIndex === null) return;
        
        if (currentAudio) { currentAudio.pause(); currentAudio.currentTime = 0; }
        
        const testimonio = testimonios[currentIntersectedIndex];
        currentAudio = new Audio(`./audio/${testimonio.Nombre_archivo}`);
        
        if (backgroundAudioStarted) {
            gsap.to(UI.backgroundAudio, {
                volume: CONFIG.audio.attenuatedVolume,
                duration: CONFIG.audio.fadeDuration
            });
        }
        
        currentAudio.play().catch(e => console.error("Error al reproducir audio:", e));
        
        currentAudio.addEventListener('ended', () => {
            if (backgroundAudioStarted) {
                gsap.to(UI.backgroundAudio, {
                    volume: CONFIG.audio.backgroundVolume,
                    duration: CONFIG.audio.fadeDuration
                });
            }
        });
        
        UI.titleElement.textContent = testimonio.Titulo_Fragmento || 'Testimonio';
        UI.questionTitle.textContent = questionMap[testimonio.Pregunta_Respondida] || '';
        UI.transcriptionText.textContent = `"${testimonio.Transcripcion_Fragmento_Clave || 'No disponible'}"`;
        UI.ageElement.textContent = testimonio.Edad ? `${testimonio.Edad} años` : 'No registrada';
        UI.toneElement.textContent = testimonio.Tono_Emocional_Fragmento || 'No analizado';
        UI.metaphorElement.textContent = testimonio.Temas_Principales_Fragmento || 'No analizado';
        UI.archetypeElement.textContent = testimonio.Analisis_Cultural_Fragmento || 'No analizado';
        UI.neuroElement.textContent = testimonio.Neurociencia_Conexion_Fragmento || 'No analizado';
        
        UI.infoPanel.classList.add('visible');
    });

    UI.closeBtn.addEventListener('click', () => {
        UI.infoPanel.classList.remove('visible');
        if (currentAudio) {
            currentAudio.pause();
            currentAudio.currentTime = 0;
        }
        if (backgroundAudioStarted) {
            gsap.to(UI.backgroundAudio, {
                volume: CONFIG.audio.backgroundVolume,
                duration: CONFIG.audio.fadeDuration
            });
        }
    });

    window.addEventListener('resize', () => {
        const sizes = { width: window.innerWidth, height: window.innerHeight };
        camera.aspect = sizes.width / sizes.height;
        camera.updateProjectionMatrix();
        renderer.setSize(sizes.width, sizes.height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    });
}

// ==========================================================================
// 4. BUCLE DE ANIMACIÓN
// ==========================================================================

function animate() {
    requestAnimationFrame(animate);
    controls.update();

    if (dustContainer) {
        dustContainer.rotation.y += CONFIG.animation.dustRotationSpeed;
    }

    if (stars && !UI.infoPanel.classList.contains('visible') && !isAnimating) {
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObject(stars);

        if (intersects.length > 0) {
            const newIndex = intersects[0].index;
            if (newIndex !== currentIntersectedIndex) {
                if (currentIntersectedIndex !== null) {
                    const oldColor = testimonios[currentIntersectedIndex].originalColor;
                    stars.geometry.attributes.color.setXYZ(currentIntersectedIndex, oldColor.r, oldColor.g, oldColor.b);
                }
                stars.geometry.attributes.color.setXYZ(newIndex, hoverColor.r, hoverColor.g, hoverColor.b);
                currentIntersectedIndex = newIndex;
                stars.geometry.attributes.color.needsUpdate = true;
            }
            document.body.style.cursor = 'pointer';
            const testimonioIntersectado = testimonios[currentIntersectedIndex];
            UI.tooltip.classList.add('visible');
            UI.tooltip.textContent = testimonioIntersectado.Titulo_Fragmento;
            UI.tooltip.style.left = mouseX + 15 + 'px';
            UI.tooltip.style.top = mouseY + 15 + 'px';
        } else {
            if (currentIntersectedIndex !== null) {
                const oldColor = testimonios[currentIntersectedIndex].originalColor;
                stars.geometry.attributes.color.setXYZ(currentIntersectedIndex, oldColor.r, oldColor.g, oldColor.b);
                stars.geometry.attributes.color.needsUpdate = true;
                currentIntersectedIndex = null;
            }
            document.body.style.cursor = 'default';
            UI.tooltip.classList.remove('visible');
        }
    } else {
        if (document.body.style.cursor !== 'default') document.body.style.cursor = 'default';
        UI.tooltip.classList.remove('visible');
    }

    renderer.render(scene, camera);
};

// ==========================================================================
// 5. INICIO DE LA APLICACIÓN
// ==========================================================================
initialize();