import { PCFShadowMap, WebGLRenderer } from 'three';
import { Pane } from 'tweakpane';

import SceneLegoBuilder from './SceneLegoBuilder';
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

class WebGLApplication {
    constructor() {
        this.renderWidth = window.innerWidth;
        this.renderHeight = window.innerHeight;

        this.debugger = new Pane({ title: 'Debug' });
        this.renderer = this.createRenderer();
        this.composer = this.createComposer();
        this.scene = this.createScene();
        this.passes = this.createPasses();

        this.lastTime = 0;

        this.resize();

        this.setupEventListeners();
    }

    createRenderer() {
        const renderer = new WebGLRenderer({
            canvas: document.querySelector('canvas'),
        });

        // Shadows
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = PCFShadowMap;

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
        // passes.bloom = this.createBloomPass();
        // passes.bokeh = new BokehPass(this.scene, this.scene.camera, {
        //     focus: 1,
        //     aperture: 1,
        //     maxblur: 0.01,
        // });

        passes.output = new OutputPass();

        this.composer.addPass(passes.render);
        // this.composer.addPass(passes.custom);
        // this.composer.addPass(passes.bloom);
        // this.composer.addPass(passes.bokeh);
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
}

export default new WebGLApplication();
