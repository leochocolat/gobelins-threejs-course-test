import {
    AmbientLight,
    BoxGeometry,
    CanvasTexture,
    DirectionalLight,
    Fog,
    MathUtils,
    Mesh,
    MeshBasicMaterial,
    MeshPhongMaterial,
    NearestFilter,
    PerspectiveCamera,
    PlaneGeometry,
    Raycaster,
    RepeatWrapping,
    Scene,
    Vector2,
} from 'three';
import { GLTFLoader, OrbitControls } from 'three/examples/jsm/Addons.js';
import { gsap } from 'gsap';
import Lego from './Lego';
import { CustomBounce } from 'gsap/CustomBounce';
import { CustomEase } from 'gsap/CustomEase';
import LegoPropsManager from './LegoPropsManager';

gsap.registerPlugin(CustomEase, CustomBounce);

CustomBounce.create('bounce', { strength: 0.1 });

export default class SceneLegoBuilder extends Scene {
    constructor(options = {}) {
        super();

        this.renderer = options.renderer;
        this.renderWidth = options.renderWidth;
        this.renderHeight = options.renderHeight;
        this.debugger = options.debugger;

        this.background = 0xf1f1f1;

        this.fog = this.createFog();

        this.cameras = this.createCameras();
        this.activeCamera = 'debug';
        this.camera = this.cameras[this.activeCamera];

        this.legoPropsManager = new LegoPropsManager();

        this.gridSize = 51; // Must be ODD number
        this.gridData = this.createGridData();
        this.floorTexture = this.createFloorTexture();
        this.floor = this.createFloor();
        this.lights = this.createLights();
        this.ghostLego = this.createGhostLego();
        this.ghostCell = this.createGhoseCell();

        this.altitude = 0;

        this.pointer = new Vector2();
        this.raycaster = new Raycaster();
        this.mouseGridPosition = new Vector2();
        this.mouseGridCellX = null;
        this.mouseGridCellY = null;
        this.mouseGridFlatIndex = Math.floor((this.gridSize * this.gridSize) / 2);

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

        this.start();
    }

    start() {
        this.isReady = true;

        // Init with 3 legos
        // this.spawnLego(3);
        // this.spawnLego();
        this.spawnLego(1);
    }

    createFog() {
        const fog = new Fog(this.background, 10, 40);
        return fog;
    }

    createCameras() {
        const cameras = {};

        cameras.main = new PerspectiveCamera(75, this.renderWidth / this.renderHeight, 0.1, 1000);
        cameras.main.position.set(-4, 3, 10);
        cameras.main.lookAt(0, 0, 0);

        cameras.debug = new PerspectiveCamera(45, this.renderWidth / this.renderHeight, 0.1, 1000);
        cameras.debug.controls = new OrbitControls(cameras.debug, this.renderer.domElement);
        cameras.debug.controls.target.y = 2;
        cameras.debug.controls.enableDamping = true;
        cameras.debug.controls.dampingFactor = 0.05;
        cameras.debug.controls.maxPolarAngle = Math.PI / 2;
        cameras.debug.position.set(-4, 3, 10);
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
        const material = new MeshBasicMaterial({ map: this.floorTexture });
        const mesh = new Mesh(geometry, material);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.y = -0.5;
        this.add(mesh);

        return mesh;
    }

    createLights() {
        const lights = {};

        lights.ambient = new AmbientLight(0xffffff, 1.5);
        this.add(lights.ambient);

        lights.directional = new DirectionalLight(0xffffff, 2);
        lights.directional.position.set(10, 10, 5);
        lights.directional.target.position.set(0, 0, 0);
        this.add(lights.directional);

        return lights;
    }

    createGhostLego() {
        const geometry = new BoxGeometry(1, 1, 1);

        const material = new MeshBasicMaterial({
            color: this.legoPropsManager.color,
            wireframe: false,
            opacity: 0.5,
            transparent: true,
            depthTest: false,
            depthWrite: false,
        });

        const mesh = new Mesh(geometry, material);

        this.add(mesh);

        return mesh;
    }

    createGhoseCell() {
        const geometry = new PlaneGeometry(1, 1, 1);

        const material = new MeshBasicMaterial({
            color: this.legoPropsManager.color,
            opacity: 0.1,
            transparent: true,
            depthTest: false,
            depthWrite: false,
        });

        const mesh = new Mesh(geometry, material);

        mesh.rotation.x = -Math.PI / 2;

        this.add(mesh);

        return mesh;
    }

    spawnLego(_size, _color) {
        const size = _size ? _size : Math.floor(Math.random() * 3 + 1);

        const rotation = this.legoPropsManager.rotation;
        const color = _color ? _color : this.legoPropsManager.color;

        console.log(this.mouseGridFlatIndex);

        const lego = new Lego({
            size,
            color,
            material: this.legoSharedMaterial?.clone(),
            model: this.models[`lego${size}`].clone(),
            physics: this.physics,
        });

        if (!this.legoSharedMaterial) this.legoSharedMaterial = lego.material;

        const altitude = this.gridData[this.mouseGridFlatIndex];

        console.log(altitude);

        lego.position.y = altitude + 2;
        lego.position.x = this.mouseGridPosition.x || 0;
        lego.position.z = this.mouseGridPosition.z || 0;

        lego.rotation.y = rotation;

        this.add(lego);

        const timeline = new gsap.timeline();
        timeline.fromTo(lego.scale, { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1, duration: 0.5, ease: 'power3.out' }, 0);
        timeline.to(lego.rotation, { y: Math.PI * 2, duration: 1, ease: 'power3.out' }, 0);
        timeline.to(lego.position, { y: lego.position.y + 1.5, duration: 1, ease: 'power3.out' }, 0);
        timeline.to(lego.position, { y: altitude, duration: 0.8, ease: 'power4.in' }, 0.5);
        timeline.call(() => {
            this.playFloorImpact();
        }, null);

        // Store altitude on grid data buffer
        this.gridData[this.mouseGridFlatIndex] += 1;

        return lego;
    }

    playFloorImpact() {
        this.floorImpactTimeline?.kill();

        this.floorImpactTimeline = new gsap.timeline();
        // this.floorImpactTimeline.timeScale(2);
        this.floorImpactTimeline.fromTo(this.position, { y: 0 }, { y: -0.08, duration: 0.3, ease: 'power3.out' });
        this.floorImpactTimeline.to(this.position, { y: 0, duration: 0.3, ease: 'sine.out' });
    }

    raycast() {
        this.raycaster.setFromCamera(this.pointer, this.camera);
        const intersects = this.raycaster.intersectObjects([this.floor], false);

        if (!intersects[0]) {
            this.ghostLego.visible = false;
            this.ghostCell.visible = false;
            return;
        }

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

        this.mouseGridFlatIndex = this.gridSize * this.mouseGridCellY + this.mouseGridCellX;
        this.mouseAltitude = this.gridData[this.mouseGridFlatIndex];

        // Update Ghost position
        this.ghostLego.position.set(this.mouseGridPosition.x, this.mouseAltitude, this.mouseGridPosition.z);
    }

    resize(renderWidth, renderHeight) {
        this.renderWidth = renderWidth;
        this.renderHeight = renderHeight;

        for (const cameraKey in this.cameras) {
            this.cameras[cameraKey].aspect = this.renderWidth / this.renderHeight;
            this.cameras[cameraKey].updateProjectionMatrix();
        }
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

            this.ghostLego.material.color.set(color);
            this.ghostCell.material.color.set(color);
        }

        if (event.code === 'ArrowLeft') {
            const rotation = this.legoPropsManager.previousRotation();

            gsap.killTweensOf(this.ghostLego.rotation);
            gsap.to(this.ghostLego.rotation, { y: rotation, duration: 0.5, ease: 'power3.out' });
        }

        if (event.code === 'ArrowRight') {
            const rotation = this.legoPropsManager.nextRotation();

            gsap.killTweensOf(this.ghostLego.rotation);
            gsap.to(this.ghostLego.rotation, { y: rotation, duration: 0.5, ease: 'power3.out' });
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

        this.spawnLego(1);
    }

    controlsChangeHandler(e) {}

    controlsEndHandler() {}

    /**
     * Debugging
     */
    createDebugFolder() {
        if (!this.debugger) return;

        const folder = this.debugger.addFolder({ title: 'Scene' });

        folder
            .addBinding(this, 'activeCamera', {
                options: {
                    main: 'main',
                    debug: 'debug',
                },
            })
            .on('change', (event) => {
                this.camera = this.cameras[event.value];
            });

        return folder;
    }
}
