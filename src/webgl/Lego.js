import {
    BoxGeometry,
    CylinderGeometry,
    MathUtils,
    Mesh,
    MeshBasicMaterial,
    MeshMatcapMaterial,
    MeshNormalMaterial,
    MeshPhongMaterial,
    Object3D,
    TextureLoader,
} from 'three';

export default class Lego extends Object3D {
    constructor(options = {}) {
        super();

        this.size = MathUtils.clamp(options.size || 1, 1, 3); // Lego size can be 1, 2, or 3
        this.color = options.color || 0xff0000;
        this.model = options.model || null;
        this.physics = options.physics;
        this.material = options.material || this.createMaterial();
        this.material.color.set(this.color);

        this.container = new Object3D();
        this.add(this.container);
        this.container.position.z = this.size / 2 - 0.5;

        // this.cube = this.createCube();
        // this.cylinders = this.createCylinders();

        this.model.scale.set(0.5, 0.5, 0.5);
        this.model.traverse((child) => {
            if (!child.isMesh) return;
            child.material = this.material;
            child.userData.physics = { mass: 1 };
        });

        this.container.add(this.model);
    }

    createMaterial() {
        // const matcapTexture = new TextureLoader().load('public/matcap-1.png');
        // const material = new MeshMatcapMaterial({ color: this.color, matcap: matcapTexture });
        const material = new MeshPhongMaterial({ color: this.color, shininess: 500, specular: 0xffffff });
        return material;
    }

    createCube() {
        const geometry = new BoxGeometry(this.size, 1, 1);
        const cube = new Mesh(geometry, this.material);
        this.container.add(cube);

        return cube;
    }

    createCylinders() {
        const cylinders = [];

        const radius = 0.25;
        const height = 0.5;
        const offsetY = 0.4;

        for (let i = 0; i < this.size; i++) {
            const geometry = new CylinderGeometry(radius, radius, height, 32, 1);
            const mesh = new Mesh(geometry, this.material);
            mesh.position.set(-this.size / 2 + i + 0.5, offsetY, 0);
            this.container.add(mesh);
            cylinders.push(mesh);
        }

        return cylinders;
    }
}
