import { BasicShadowMap, PCFShadowMap, WebGLRenderer } from 'three';
import SceneLegoBuilder from './SceneLegoBuilder';
import { Pane } from 'tweakpane';

class WebGLApplication {
    constructor() {
        this._renderWidth = window.innerWidth;
        this._renderHeight = window.innerHeight;

        this.debugger = new Pane({ title: 'Debug' });
        this.renderer = this.createRenderer();
        this.scene = this.createScene();

        this.resize();

        this.setupEventListeners();
    }

    createRenderer() {
        const renderer = new WebGLRenderer({
            antialias: true,
            canvas: document.querySelector('canvas'),
        });

        renderer.setClearColor(0xf1f1f1, 1);

        return renderer;
    }

    createScene() {
        const scene = new SceneLegoBuilder({
            renderer: this.renderer,
            renderWidth: this._renderWidth,
            renderHeight: this._renderHeight,
            debugger: this.debugger,
        });

        return scene;
    }

    resize() {
        this.renderer.setSize(this._renderWidth, this._renderHeight);
        this.scene.resize(this._renderWidth, this._renderHeight);
    }

    update() {
        this.scene.update();
    }

    render() {
        if (!this.renderer || !this.scene || !this.scene.camera) return;

        this.renderer.render(this.scene, this.scene.camera);
    }

    setupEventListeners() {
        window.addEventListener('resize', this.resizeHandler.bind(this));

        this.tickHandler();
    }

    resizeHandler() {
        this._renderWidth = window.innerWidth;
        this._renderHeight = window.innerHeight;

        this.resize();
    }

    tickHandler() {
        window.requestAnimationFrame(this.tickHandler.bind(this));

        this.update();
        this.render();
    }
}

export default new WebGLApplication();
