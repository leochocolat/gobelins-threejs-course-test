import {
    ACESFilmicToneMapping,
    AgXToneMapping,
    BasicShadowMap,
    CineonToneMapping,
    LinearToneMapping,
    NeutralToneMapping,
    NoToneMapping,
    PCFShadowMap,
    ReinhardToneMapping,
    VSMShadowMap,
    WebGLRenderer,
} from 'three';
import { Pane } from 'tweakpane';

import SceneLegoBuilder from './SceneLegoBuilder';
import settings from './settings.json';
import { keysAsOptions } from './utils/debug';
import {
    BloomPass,
    BokehPass,
    EffectComposer,
    OutputPass,
    RenderPass,
    ShaderPass,
    UnrealBloomPass,
} from 'three/examples/jsm/Addons.js';
import { uniform } from 'three/tsl';
import { Vector2 } from 'three/webgpu';

const TONE_MAPPINGS = {
    None: NoToneMapping,
    Linear: LinearToneMapping,
    Reinhard: ReinhardToneMapping,
    Cineon: CineonToneMapping,
    ACESFilmic: ACESFilmicToneMapping,
    AgX: AgXToneMapping,
    Neutral: NeutralToneMapping,
};

const SHADOW_MAP_TYPES = {
    Basic: BasicShadowMap,
    PCF: PCFShadowMap,
    VSM: VSMShadowMap,
};

class WebGLApplication {
    constructor() {
        this.settings = settings;

        this.renderWidth = window.innerWidth;
        this.renderHeight = window.innerHeight;

        this.debugger = new Pane({ title: 'Debug' });
        this.renderer = this.createRenderer();
        this.composer = this.createComposer();
        this.scene = this.createScene();
        this.passes = this.createPasses();
        this.debugFolder = this.createDebugFolder();

        this.lastTime = 0;

        this.resize();

        this.setupEventListeners();
    }

    createRenderer() {
        const renderer = new WebGLRenderer({
            canvas: document.querySelector('canvas'),
        });

        this.applyRendererSettings(renderer);

        return renderer;
    }

    createComposer() {
        const composer = new EffectComposer(this.renderer);

        composer.renderTarget1.samples = 4;
        composer.renderTarget2.samples = 4;

        return composer;
    }

    createPasses() {
        const passes = {};

        passes.render = new RenderPass(this.scene, this.scene.camera);
        passes.custom = this.createCustomShaderPass();

        passes.output = new OutputPass();

        this.composer.addPass(passes.render);
        // this.composer.addPass(passes.custom);
        // this.composer.addPass(passes.bloom);
        this.composer.addPass(passes.output);

        return passes;
    }

    createBloomPass() {
        const resolution = new Vector2(this.renderWidth * 0.5, this.renderHeight * 0.5);
        const bloomPass = new UnrealBloomPass(resolution, 0.5, 0.1, 0.95);
        return bloomPass;
    }

    createCustomShaderPass() {
        const shaderPass = new ShaderPass({
            uniforms: {
                tDiffuse: { value: null },
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1);
                }
            `,
            fragmentShader: `
                uniform sampler2D tDiffuse;
                varying vec2 vUv;
                void main() {
                    vec4 baseColor = texture2D(tDiffuse, vUv);
                    vec4 invertedColor = vec4(1.0 - baseColor.r, 1.0 - baseColor.g, 1.0 - baseColor.b, 1.0);
                    gl_FragColor = invertedColor;
                }
            `,
        });

        return shaderPass;
    }

    createScene() {
        const scene = new SceneLegoBuilder({
            renderer: this.renderer,
            renderWidth: this.renderWidth,
            renderHeight: this.renderHeight,
            debugger: this.debugger,
            settings: this.settings.scene,
        });

        return scene;
    }

    resize() {
        this.renderer.setSize(this.renderWidth, this.renderHeight);
        this.composer.setSize(this.renderWidth, this.renderHeight);
        this.scene.resize(this.renderWidth, this.renderHeight);
    }

    update(deltaTime) {
        this.scene.update(deltaTime);
        this.passes.render.camera = this.scene.camera;
    }

    render(deltaTime) {
        if (this.composer) this.composer.render(deltaTime);
        else if (this.scene && this.scene.camera && this.renderer) this.renderer.render(this.scene, this.scene.camera);
    }

    setupEventListeners() {
        window.addEventListener('resize', this.resizeHandler.bind(this));

        this.renderer.setAnimationLoop(this.tickHandler.bind(this));
    }

    resizeHandler() {
        this.renderWidth = window.innerWidth;
        this.renderHeight = window.innerHeight;

        this.resize();
    }

    tickHandler(now) {
        now *= 0.001; // convert to seconds
        const deltaTime = now - this.lastTime;
        this.lastTime = now;

        this.update(deltaTime);
        this.render(deltaTime);
    }

    applyRendererSettings(renderer = this.renderer) {
        const { toneMapping, exposure, shadowMap } = this.settings.renderer;

        // Tone mapping is applied by the OutputPass, which reads these renderer values
        renderer.toneMapping = TONE_MAPPINGS[toneMapping];
        renderer.toneMappingExposure = exposure;

        renderer.shadowMap.enabled = shadowMap.enabled;
        renderer.shadowMap.type = SHADOW_MAP_TYPES[shadowMap.type];
    }

    /**
     * Debugging
     */
    createDebugFolder() {
        const rendererSettings = this.settings.renderer;
        const apply = () => this.applyRendererSettings();

        const folder = this.debugger.addFolder({ title: 'Renderer', expanded: false, index: 0 });

        folder
            .addBinding(rendererSettings, 'toneMapping', { options: keysAsOptions(TONE_MAPPINGS) })
            .on('change', apply);
        folder.addBinding(rendererSettings, 'exposure', { min: 0, max: 4, step: 0.01 }).on('change', apply);

        const applyShadowMap = () => {
            apply();
            this.refreshShadows();
        };

        const shadowsFolder = folder.addFolder({ title: 'Shadow map' });
        shadowsFolder.addBinding(rendererSettings.shadowMap, 'enabled').on('change', applyShadowMap);
        shadowsFolder
            .addBinding(rendererSettings.shadowMap, 'type', { options: keysAsOptions(SHADOW_MAP_TYPES) })
            .on('change', applyShadowMap);

        // Paste the copied JSON into src/webgl/settings.json to make it the new defaults
        this.debugger.addButton({ title: 'Copy settings (JSON)' }).on('click', () => {
            const json = JSON.stringify(this.settings, null, 4);
            navigator.clipboard.writeText(json).catch(() => {});
            console.log(json);
        });

        return folder;
    }

    refreshShadows() {
        // Shadow map type/state is baked into the shaders and shadow render targets
        this.scene.traverse((child) => {
            if (child.material) child.material.needsUpdate = true;
            if (child.isLight && child.shadow?.map) {
                child.shadow.map.dispose();
                child.shadow.map = null;
            }
        });
    }
}

export default new WebGLApplication();
