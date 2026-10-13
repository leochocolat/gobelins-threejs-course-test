import {
    AmbientLight,
    BoxGeometry,
    CameraHelper,
    CanvasTexture,
    Color,
    DirectionalLight,
    DirectionalLightHelper,
    EquirectangularReflectionMapping,
    FloatType,
    Fog,
    MathUtils,
    Mesh,
    MeshBasicMaterial,
    MeshPhongMaterial,
    NearestFilter,
    Object3D,
    OrthographicCamera,
    PerspectiveCamera,
    PlaneGeometry,
    PMREMGenerator,
    Raycaster,
    RepeatWrapping,
    Scene,
    ShaderMaterial,
    ShadowMaterial,
    Vector2,
} from 'three';
import { GLTFLoader, HDRLoader, OrbitControls } from 'three/examples/jsm/Addons.js';
import { gsap } from 'gsap';
import Lego from './Lego';
import LegoPropsManager from './LegoPropsManager';
import floorVertexShader from './shaders/floor/vertex.glsl';
import floorFragmentShader from './shaders/floor/fragment.glsl';
import { keysAsOptions } from './utils/debug';

export default class SceneLegoBuilder extends Scene {
    constructor(options = {}) {
        super();

        this.renderer = options.renderer;
        this.renderWidth = options.renderWidth;
        this.renderHeight = options.renderHeight;
        this.debugger = options.debugger;
        this.settings = options.settings;

        this.background = new Color();
        // this.fog = this.createFog();

        this.cameras = this.createCameras();

        this.legoPropsManager = new LegoPropsManager({ colors: this.settings.legos.palette });
        this.legoSharedMaterial = Lego.createMaterial();
        this.legos = [];

        this.gridSize = 51; // Must be an ODD number
        this.gridCellX = Math.floor(this.gridSize / 2);
        this.gridCellY = Math.floor(this.gridSize / 2);
        this.gridData = this.createGridData();

        this.floorTexture = this.createFloorTexture();
        this.floor = this.createFloor();
        this.shadowFloor = this.createShadowFloor();

        this.lights = this.createLights();
        this.helpers = this.createHelpers();

        this.envmap = this.createEnvmap();

        this.ghostLego = this.createGhostLego();
        this.ghostCell = this.createGhoseCell();
        this.updateGhostSize(this.legoPropsManager.size);

        this.pointer = new Vector2();
        this.raycaster = new Raycaster();
        this.isRayIntersecting = false;
        this.mouseGridPosition = new Vector2();
        this.mouseGridCellX = null;
        this.mouseGridCellY = null;
        this.mouseGridFlatIndex = this.getGridFlatIndex(this.mouseGridCellX, this.mouseGridCellY);

        this.applySettings();

        this.setupEventListeners();

        this.debugFolder = this.createDebugFolder();

        this.load();
    }

    async load() {
        const loader = new GLTFLoader();
        const gltf = await loader.loadAsync('legos.glb');

        this.models = {
            lego1: gltf.scene.children.find((item) => item.name === 'Lego_1'),
            lego2: gltf.scene.children.find((item) => item.name === 'Lego_2'),
            lego3: gltf.scene.children.find((item) => item.name === 'Lego_3'),
        };

        // this.physics = await RapierPhysics();

        this.start();

        this.spawnLego();
    }

    start() {
        this.isReady = true;
    }

    createFog() {
        const fog = new Fog(this.background, 10, 40);
        return fog;
    }

    createCameras() {
        const cameras = {};

        // Isometric: orthographic projection, looking at the origin along the (-1, 1, 1) diagonal
        cameras.main = new OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
        cameras.main.position.set(-20, 20, 20);
        cameras.main.lookAt(0, 0, 0);

        cameras.debug = new PerspectiveCamera(45, this.renderWidth / this.renderHeight, 0.1, 1000);
        cameras.debug.controls = new OrbitControls(cameras.debug, this.renderer.domElement);
        cameras.debug.controls.target.y = 2;
        cameras.debug.controls.enableDamping = true;
        cameras.debug.controls.dampingFactor = 0.05;
        cameras.debug.controls.maxPolarAngle = Math.PI / 2;
        cameras.debug.position.set(-4, 2.5, 10);
        cameras.debug.controls.update();

        return cameras;
    }

    createFloorTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 2;
        canvas.height = 2;
        const context = canvas.getContext('2d');
        context.fillStyle = '#F1F1F1';
        context.fillRect(0, 0, 1, 1);
        context.fillRect(1, 1, 1, 1);
        context.fillStyle = '#BFBFBF';
        context.fillRect(1, 0, 1, 1);
        context.fillRect(0, 1, 1, 1);
        const texture = new CanvasTexture(canvas);
        texture.repeat = new Vector2(this.gridSize / 2, this.gridSize / 2);
        texture.wrapS = RepeatWrapping;
        texture.wrapT = RepeatWrapping;
        texture.minFilter = NearestFilter;
        texture.magFilter = NearestFilter;
        return texture;
    }

    createGridData() {
        const array = new Array(this.gridSize * this.gridSize);

        for (let i = 0; i < array.length; i++) array[i] = 0;

        return array;
    }

    createFloor() {
        const geometry = new PlaneGeometry(this.gridSize, this.gridSize, 1);
        // const geometry = new BoxGeometry(this.gridSize, 0.01, this.gridSize);
        // const material = new MeshBasicMaterial({ map: this.floorTexture, fog: true });

        const material = new ShaderMaterial({
            vertexShader: floorVertexShader,
            fragmentShader: floorFragmentShader,
            uniforms: {
                uMap: { value: this.floorTexture },
                uGridSize: { value: this.gridSize },
                uColor1: { value: new Color() },
                uColor2: { value: new Color() },
                uFogColor: { value: new Color() },
                uFogStart: { value: 0 },
                uFogEnd: { value: 0 },
                uAnimationProgress: { value: 0 },
                uAnimationColor: { value: new Color('white') },
                uAnimationOffset: { value: new Vector2(0, 0) },
                uPulseMaxRadius: { value: 0 },
                uPulseThickness: { value: 0 },
                uPulseFade: { value: 0 },
                uPulseMinIntensity: { value: 0 },
            },
        });

        const mesh = new Mesh(geometry, material);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.y = -0.5;

        mesh.receiveShadow = false;

        mesh.userData.physics = { mass: 0 };

        this.add(mesh);

        return mesh;
    }

    createShadowFloor() {
        const geometry = new PlaneGeometry(this.gridSize, this.gridSize, 1);
        const material = new ShadowMaterial();
        const mesh = new Mesh(geometry, material);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.y = -0.5 + 0.001;

        mesh.castShadow = false;
        mesh.receiveShadow = true;

        this.add(mesh);

        return mesh;
    }

    createLights() {
        const lights = {};

        lights.ambient = new AmbientLight();
        this.add(lights.ambient);

        lights.directional = new DirectionalLight();
        lights.directional.target.position.set(0, 0, 0);
        this.add(lights.directional);

        return lights;
    }

    createHelpers() {
        const helpers = {};

        helpers.directional = new DirectionalLightHelper(this.lights.directional, 1);
        helpers.directional.visible = false;
        this.add(helpers.directional);

        helpers.shadowCamera = new CameraHelper(this.lights.directional.shadow.camera);
        helpers.shadowCamera.visible = false;
        this.add(helpers.shadowCamera);

        return helpers;
    }

    async createEnvmap() {
        const loader = new HDRLoader();
        loader.setDataType(FloatType);

        loader.load('/01.hdr', (texture) => {
            texture.mapping = EquirectangularReflectionMapping;
            const generator = new PMREMGenerator(this.renderer);
            this.envmapTexture = generator.fromEquirectangular(texture, null).texture;
            this.applyEnvironmentSettings();
            generator.dispose();
        });
    }

    createGhostLego() {
        const container = new Object3D();

        const geometry = new BoxGeometry(1, 1, 1);

        const material = new MeshBasicMaterial({
            color: this.legoPropsManager.color,
            transparent: true,
            depthTest: false,
            depthWrite: false,
        });

        const mesh = new Mesh(geometry, material);

        container.add(mesh);
        this.add(container);

        return container;
    }

    createGhoseCell() {
        const geometry = new PlaneGeometry(1, 1, 1);

        const material = new MeshBasicMaterial({
            color: this.legoPropsManager.color,
            transparent: true,
            depthTest: false,
            depthWrite: false,
        });

        const mesh = new Mesh(geometry, material);

        mesh.rotation.x = -Math.PI / 2;

        this.add(mesh);

        return mesh;
    }

    setGhostColor(color) {
        this.ghostLego.children[0].material.color.set(color);
        this.ghostCell.material.color.set(color);
    }

    updateGhostSize(size) {
        const ghostLegoMesh = this.ghostLego.children[0];
        ghostLegoMesh.scale.z = size;
        ghostLegoMesh.position.z = size / 2 - 0.5;
    }

    spawnLego(_size, _color) {
        const size = _size ? _size : this.legoPropsManager.size;

        const rotation = this.legoPropsManager.rotation;
        const color = _color ? _color : this.legoPropsManager.color;

        const lego = new Lego({
            size,
            color,
            material: this.legoSharedMaterial.clone(),
            model: this.models[`lego${size}`].clone(),
        });

        this.legos.push(lego);

        if (this.mouseGridCellX !== null && this.mouseGridCellY !== null) {
            this.gridCellX = this.mouseGridCellX;
            this.gridCellY = this.mouseGridCellY;
        }

        const altitude = this.getAltitude(this.gridCellX, this.gridCellY, size, rotation);

        lego.position.y = altitude + 2;
        lego.position.x = this.mouseGridPosition.x || 0;
        lego.position.z = this.mouseGridPosition.z || 0;

        lego.rotation.y = rotation;

        this.add(lego);

        const timeline = new gsap.timeline();
        timeline.timeScale(1.5);
        timeline.fromTo(lego.scale, { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1, duration: 0.5, ease: 'power3.out' }, 0);
        if (lego.model) timeline.to(lego.model.rotation, { y: Math.PI * 2, duration: 1, ease: 'power3.out' }, 0);
        timeline.to(lego.position, { y: lego.position.y + 1.5, duration: 1, ease: 'power3.out' }, 0);
        timeline.to(lego.position, { y: altitude, duration: 0.8, ease: 'power4.in' }, 0.5);
        timeline.call(() => {
            this.playFloorImpact(color, lego.position);
        }, null);

        this.updateAltitude(this.gridCellX, this.gridCellY, size, rotation);

        return lego;
    }
    thi;

    playFloorImpact(color, position) {
        this.floorImpactTimeline?.kill();

        this.floor.material.uniforms.uAnimationColor.value.set(color);
        this.floor.material.uniforms.uAnimationOffset.value.set(position.x, position.z);

        this.floorImpactTimeline = new gsap.timeline();
        this.floorImpactTimeline.fromTo(
            this.floor.material.uniforms.uAnimationProgress,
            { value: 0 },
            { value: 1, duration: 1.5, ease: 'sine.out' },
            0,
        );
        this.floorImpactTimeline.fromTo(this.position, { y: 0 }, { y: -0.08, duration: 0.3, ease: 'power3.out' }, 0);
        this.floorImpactTimeline.to(this.position, { y: 0, duration: 0.3, ease: 'sine.out' });
    }

    raycast() {
        this.raycaster.setFromCamera(this.pointer, this.camera);
        const intersects = this.raycaster.intersectObjects([this.floor], false);

        if (!intersects[0]) {
            this.ghostLego.visible = false;
            this.ghostCell.visible = false;
            this.isRayIntersecting = false;
            return;
        }

        this.isRayIntersecting = true;

        this.ghostLego.visible = true;
        this.ghostCell.visible = true;

        const { point } = intersects[0];

        this.mouseGridPosition = point;
        this.mouseGridPosition.x = Math.round(point.x);
        this.mouseGridPosition.z = Math.round(point.z);

        // Update ghost Cell position
        this.ghostCell.position.set(this.mouseGridPosition.x, -0.5, this.mouseGridPosition.z);

        // Transform grid position into grid data index :

        this.mouseGridCellX = MathUtils.mapLinear(
            this.mouseGridPosition.x,
            -(this.gridSize - 1) / 2,
            (this.gridSize - 1) / 2,
            0,
            this.gridSize - 1,
        );

        this.mouseGridCellY = MathUtils.mapLinear(
            this.mouseGridPosition.z,
            -(this.gridSize - 1) / 2,
            (this.gridSize - 1) / 2,
            0,
            this.gridSize - 1,
        );

        this.mouseAltitude = this.getAltitude(
            this.mouseGridCellX,
            this.mouseGridCellY,
            this.legoPropsManager.size,
            this.legoPropsManager.rotation,
        );

        // Update Ghost position
        this.ghostLego.position.set(this.mouseGridPosition.x, this.mouseAltitude, this.mouseGridPosition.z);
    }

    getGridFlatIndex(x, y) {
        return this.gridSize * y + x;
    }

    getAltitude(x, y, size, rotation) {
        const baseAltitude = this.gridData[this.getGridFlatIndex(x, y)];

        if (size == 1) return baseAltitude;

        const normalizedRotation = this.normalizeRotation(rotation);
        const rotationDirection = this.getRotationDirection(rotation);

        const altitudes = [baseAltitude];

        for (let i = 2; i <= size; i++) {
            const indexOffset = { x: 0, y: 0 };

            if (normalizedRotation === 0) indexOffset.y = i - 1;
            if (normalizedRotation === Math.PI / 2) indexOffset.x = (i - 1) * rotationDirection;
            if (normalizedRotation === Math.PI) indexOffset.y = -(i - 1);
            if (normalizedRotation === 3 * (Math.PI / 2)) indexOffset.x = (i - 1) * -rotationDirection;

            const newAltitude = this.gridData[this.getGridFlatIndex(x + indexOffset.x, y + indexOffset.y)];
            altitudes.push(newAltitude);
        }

        altitudes.sort((a, b) => b - a);

        return altitudes[0];
    }

    updateAltitude(x, y, size, rotation) {
        const flatIndex = this.getGridFlatIndex(x, y);

        if (size == 1) {
            this.gridData[flatIndex] += 1;
            return;
        }

        const normalizedRotation = this.normalizeRotation(rotation);
        const rotationDirection = this.getRotationDirection(rotation);

        const flatIndexes = [flatIndex];

        for (let i = 2; i <= size; i++) {
            const indexOffset = { x: 0, y: 0 };

            if (normalizedRotation === 0) indexOffset.y = i - 1;
            if (normalizedRotation === Math.PI / 2) indexOffset.x = (i - 1) * rotationDirection;
            if (normalizedRotation === Math.PI) indexOffset.y = -(i - 1);
            if (normalizedRotation === 3 * (Math.PI / 2)) indexOffset.x = (i - 1) * -rotationDirection;

            const index = this.getGridFlatIndex(x + indexOffset.x, y + indexOffset.y);

            flatIndexes.push(index);
        }

        const altitude = this.getAltitude(x, y, size, rotation);

        flatIndexes.forEach((index) => {
            this.gridData[index] = altitude + 1;
        });
    }

    normalizeRotation(rotation) {
        const absoluteRotation = Math.abs(rotation);
        const normalizedRotation = absoluteRotation % (Math.PI * 2);
        return normalizedRotation;
    }

    getRotationDirection(rotation) {
        return rotation === 0 ? 1 : Math.sign(rotation);
    }

    resize(renderWidth, renderHeight) {
        this.renderWidth = renderWidth;
        this.renderHeight = renderHeight;

        for (const cameraKey in this.cameras) {
            const camera = this.cameras[cameraKey];
            if (camera.isOrthographicCamera) this.updateOrthographicFrustum(camera);
            else camera.aspect = this.renderWidth / this.renderHeight;
            camera.updateProjectionMatrix();
        }
    }

    updateOrthographicFrustum(camera) {
        const aspect = this.renderWidth / this.renderHeight;
        camera.top = camera.frustumSize / 2;
        camera.bottom = -camera.frustumSize / 2;
        camera.left = (-camera.frustumSize * aspect) / 2;
        camera.right = (camera.frustumSize * aspect) / 2;
        camera.updateProjectionMatrix();
    }

    update() {
        this.cameras.debug.controls.update();
    }

    setupEventListeners() {
        document.body.addEventListener('keydown', this.keydownHandler.bind(this));
        window.addEventListener('mousemove', this.mousemoveHandler.bind(this));
        document.body.addEventListener('pointerdown', this.pointerdownHandler.bind(this));
        document.body.addEventListener('pointerup', this.pointerupHandler.bind(this));
        this.cameras.debug.controls.addEventListener('change', this.controlsChangeHandler.bind(this));
        this.cameras.debug.controls.addEventListener('end', this.controlsEndHandler.bind(this));
    }

    keydownHandler(event) {
        if (!this.isReady) return;

        if (event.code === 'Space') {
            const color = this.legoPropsManager.nextColor();
            this.setGhostColor(color);
        }

        if (event.code === 'ArrowLeft') {
            const rotation = this.legoPropsManager.previousRotation();

            gsap.killTweensOf(this.ghostLego.rotation);
            gsap.to(this.ghostLego.rotation, { y: rotation, duration: 0.5, ease: 'power3.out' });

            this.raycast();
        }

        if (event.code === 'ArrowRight') {
            const rotation = this.legoPropsManager.nextRotation();

            gsap.killTweensOf(this.ghostLego.rotation);
            gsap.to(this.ghostLego.rotation, { y: rotation, duration: 0.5, ease: 'power3.out' });

            this.raycast();
        }

        if (event.code === 'ArrowUp') {
            const size = this.legoPropsManager.increaseSize();
            this.updateGhostSize(size);

            this.raycast();
        }

        if (event.code === 'ArrowDown') {
            const size = this.legoPropsManager.decreaseSize();
            this.updateGhostSize(size);

            this.raycast();
        }
    }

    mousemoveHandler(e) {
        if (!this.isReady) return;

        this.pointer.x = (e.clientX / this.renderWidth) * 2 - 1;
        this.pointer.y = -(e.clientY / this.renderHeight) * 2 + 1;

        if (this.isPointerDown) return;

        this.raycast();
    }

    pointerdownHandler(e) {
        this.isPointerDown = true;

        this.pointerStartPosition = { x: e.clientX, y: e.clientY };
    }

    pointerupHandler(e) {
        this.isPointerDown = false;

        const deltaX = e.clientX - this.pointerStartPosition.x;
        const deltaY = e.clientY - this.pointerStartPosition.y;
        const dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        if (dist > 2) return;

        if (!this.isRayIntersecting) return;

        this.spawnLego();
    }

    controlsChangeHandler(e) {}

    controlsEndHandler() {}

    /**
     * Settings
     */
    applySettings() {
        this.applyBackgroundSettings();
        this.applyCamerasSettings();
        this.applyLightsSettings();
        this.applyShadowSettings();
        this.applyEnvironmentSettings();
        this.applyLegosSettings();
        this.applyFloorSettings();
        this.applyGhostSettings();
    }

    applyBackgroundSettings() {
        // Background is linked to the floor fog so the floor keeps fading into it
        this.background.set(this.settings.background);
        this.floor.material.uniforms.uFogColor.value.set(this.settings.background);
    }

    applyCamerasSettings() {
        const settings = this.settings.cameras;

        this.camera = this.cameras[settings.active];

        this.cameras.main.frustumSize = settings.main.frustumSize;
        this.updateOrthographicFrustum(this.cameras.main);

        this.cameras.debug.fov = settings.debug.fov;
        this.cameras.debug.updateProjectionMatrix();
    }

    applyLightsSettings() {
        const { ambient, directional } = this.settings.lights;

        this.lights.ambient.color.set(ambient.color);
        this.lights.ambient.intensity = ambient.intensity;

        this.lights.directional.color.set(directional.color);
        this.lights.directional.intensity = directional.intensity;
        this.lights.directional.position.copy(directional.position);

        this.helpers.directional.update();
        this.helpers.shadowCamera.update();
    }

    applyShadowSettings() {
        const settings = this.settings.lights.shadow;
        const { directional } = this.lights;
        const { shadow } = directional;

        directional.castShadow = settings.enabled;
        shadow.intensity = settings.intensity;
        shadow.bias = settings.bias;
        shadow.normalBias = settings.normalBias;
        shadow.radius = settings.radius;
        this.shadowFloor.material.opacity = settings.floorOpacity;

        // The shadow render target has to be recreated to change its size
        if (shadow.mapSize.width !== settings.mapSize) {
            shadow.mapSize.set(settings.mapSize, settings.mapSize);
            shadow.map?.dispose();
            shadow.map = null;
        }

        shadow.camera.top = settings.cameraSize;
        shadow.camera.right = settings.cameraSize;
        shadow.camera.bottom = -settings.cameraSize;
        shadow.camera.left = -settings.cameraSize;
        shadow.camera.near = settings.near;
        shadow.camera.far = settings.far;
        shadow.camera.updateProjectionMatrix();

        this.helpers.shadowCamera.update();
    }

    applyEnvironmentSettings() {
        const settings = this.settings.environment;

        this.environment = settings.enabled ? this.envmapTexture || null : null;
        this.environmentIntensity = settings.intensity;
        this.environmentRotation.y = settings.rotation;
    }

    applyLegosSettings() {
        const { material } = this.settings.legos;

        // Updates the template material and every lego already spawned
        Object.assign(this.legoSharedMaterial, material);
        this.legos.forEach((lego) => Object.assign(lego.material, material));

        // The palette array is shared with the LegoPropsManager, only the ghost needs a refresh
        this.setGhostColor(this.legoPropsManager.color);
    }

    applyFloorSettings() {
        const settings = this.settings.floor;
        const { uniforms } = this.floor.material;

        uniforms.uColor1.value.set(settings.color1);
        uniforms.uColor2.value.set(settings.color2);
        uniforms.uFogStart.value = settings.fogStart;
        uniforms.uFogEnd.value = settings.fogEnd;
        uniforms.uPulseMaxRadius.value = settings.pulse.maxRadius;
        uniforms.uPulseThickness.value = settings.pulse.thickness;
        uniforms.uPulseFade.value = settings.pulse.fade;
        uniforms.uPulseMinIntensity.value = settings.pulse.minIntensity;
    }

    applyGhostSettings() {
        const settings = this.settings.ghost;
        const ghostLegoMaterial = this.ghostLego.children[0].material;

        ghostLegoMaterial.opacity = settings.legoOpacity;
        ghostLegoMaterial.wireframe = settings.legoWireframe;
        this.ghostCell.material.opacity = settings.cellOpacity;
    }

    /**
     * Debugging
     */
    createDebugFolder() {
        if (!this.debugger) return;

        const folder = this.debugger.addFolder({ title: 'Scene' });

        folder.addBinding(this.settings, 'background').on('change', () => this.applyBackgroundSettings());

        this.createCamerasDebugFolder(folder);
        this.createLightsDebugFolder(folder);
        this.createEnvironmentDebugFolder(folder);
        this.createLegosDebugFolder(folder);
        this.createFloorDebugFolder(folder);
        this.createGhostDebugFolder(folder);

        return folder;
    }

    createCamerasDebugFolder(parent) {
        const settings = this.settings.cameras;
        const folder = parent.addFolder({ title: 'Cameras', expanded: false });
        folder.on('change', () => this.applyCamerasSettings());

        folder.addBinding(settings, 'active', { options: keysAsOptions(this.cameras) });
        folder.addBinding(settings.main, 'frustumSize', { label: 'main size', min: 2, max: 60, step: 0.5 });
        folder.addBinding(settings.debug, 'fov', { label: 'debug fov', min: 10, max: 120, step: 1 });
    }

    createLightsDebugFolder(parent) {
        const { ambient, directional, shadow } = this.settings.lights;
        const folder = parent.addFolder({ title: 'Lights', expanded: false });

        const ambientFolder = folder.addFolder({ title: 'Ambient' });
        ambientFolder.on('change', () => this.applyLightsSettings());
        ambientFolder.addBinding(ambient, 'color');
        ambientFolder.addBinding(ambient, 'intensity', { min: 0, max: 5, step: 0.01 });

        const directionalFolder = folder.addFolder({ title: 'Directional' });
        directionalFolder.on('change', () => this.applyLightsSettings());
        directionalFolder.addBinding(directional, 'color');
        directionalFolder.addBinding(directional, 'intensity', { min: 0, max: 10, step: 0.01 });
        directionalFolder.addBinding(directional, 'position', {
            x: { min: -30, max: 30 },
            y: { min: 0, max: 30 },
            z: { min: -30, max: 30 },
        });
        // Helpers are debug-only, they are not part of the settings
        directionalFolder.addBinding(this.helpers.directional, 'visible', { label: 'helper' });

        const shadowFolder = folder.addFolder({ title: 'Shadows' });
        shadowFolder.on('change', () => this.applyShadowSettings());
        shadowFolder.addBinding(shadow, 'enabled');
        shadowFolder.addBinding(shadow, 'intensity', { min: 0, max: 1, step: 0.01 });
        shadowFolder.addBinding(shadow, 'floorOpacity', { min: 0, max: 1, step: 0.01 });
        shadowFolder.addBinding(shadow, 'bias', { min: -0.01, max: 0.01, step: 0.0001 });
        shadowFolder.addBinding(shadow, 'normalBias', { min: -0.1, max: 0.1, step: 0.001 });
        shadowFolder.addBinding(shadow, 'radius', { min: 0, max: 20, step: 0.1 });
        shadowFolder.addBinding(shadow, 'mapSize', { options: { 512: 512, 1024: 1024, 2048: 2048, 4096: 4096 } });
        shadowFolder.addBinding(shadow, 'cameraSize', { min: 1, max: 30, step: 0.5 });
        shadowFolder.addBinding(shadow, 'near', { min: 0.1, max: 20, step: 0.1 });
        shadowFolder.addBinding(shadow, 'far', { min: 1, max: 200, step: 1 });
        shadowFolder.addBinding(this.helpers.shadowCamera, 'visible', { label: 'camera helper' });
    }

    createEnvironmentDebugFolder(parent) {
        const settings = this.settings.environment;
        const folder = parent.addFolder({ title: 'Environment', expanded: false });
        folder.on('change', () => this.applyEnvironmentSettings());

        folder.addBinding(settings, 'enabled');
        folder.addBinding(settings, 'intensity', { min: 0, max: 5, step: 0.01 });
        folder.addBinding(settings, 'rotation', { min: -Math.PI, max: Math.PI, step: 0.01 });
    }

    createLegosDebugFolder(parent) {
        const { material, palette } = this.settings.legos;
        const folder = parent.addFolder({ title: 'Legos', expanded: false });
        folder.on('change', () => this.applyLegosSettings());

        const materialFolder = folder.addFolder({ title: 'Material' });
        for (const key in material) materialFolder.addBinding(material, key, { min: 0, max: 1, step: 0.01 });

        const paletteFolder = folder.addFolder({ title: 'Palette' });
        palette.forEach((_, index) => paletteFolder.addBinding(palette, index, { label: `color ${index + 1}` }));
    }

    createFloorDebugFolder(parent) {
        const settings = this.settings.floor;
        const folder = parent.addFolder({ title: 'Floor', expanded: false });
        folder.on('change', () => this.applyFloorSettings());

        folder.addBinding(settings, 'color1');
        folder.addBinding(settings, 'color2');
        folder.addBinding(settings, 'fogStart', { min: 0, max: 1, step: 0.01 });
        folder.addBinding(settings, 'fogEnd', { min: 0, max: 1, step: 0.01 });

        const pulseFolder = folder.addFolder({ title: 'Pulse' });
        pulseFolder.addBinding(settings.pulse, 'maxRadius', { min: 1, max: 60, step: 0.5 });
        pulseFolder.addBinding(settings.pulse, 'thickness', { min: 0, max: 15, step: 0.1 });
        pulseFolder.addBinding(settings.pulse, 'fade', { min: 0, max: 5, step: 0.05 });
        pulseFolder.addBinding(settings.pulse, 'minIntensity', { min: 0, max: 1, step: 0.01 });
        pulseFolder.addButton({ title: 'Play impact' }).on('click', () => {
            this.playFloorImpact(this.legoPropsManager.color, { x: 0, z: 0 });
        });
    }

    createGhostDebugFolder(parent) {
        const settings = this.settings.ghost;
        const folder = parent.addFolder({ title: 'Ghost', expanded: false });
        folder.on('change', () => this.applyGhostSettings());

        folder.addBinding(settings, 'legoOpacity', { min: 0, max: 1, step: 0.01 });
        folder.addBinding(settings, 'legoWireframe');
        folder.addBinding(settings, 'cellOpacity', { min: 0, max: 1, step: 0.01 });
    }
}
