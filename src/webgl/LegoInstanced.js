import { InstancedMesh, Matrix4, MeshBasicMaterial } from 'three';
import { BufferGeometryUtils } from 'three/examples/jsm/Addons.js';

const _matrix = new Matrix4();

export default class LegoInstanced {
    constructor(options = {}) {
        this.count = options.count;
        this.model = options.model;

        this.geometry = this.createGeometry();
        this.material = this.createMaterial();
        this.mesh = this.createMesh();
    }

    createGeometry() {
        const geometries = this.model.children.map((child) => child.geometry);
        const mergedGeometry = BufferGeometryUtils.mergeGeometries(geometries);
        return mergedGeometry;
    }

    createMaterial() {
        const material = new MeshBasicMaterial({ color: 'red' });
        return material;
    }

    createMesh() {
        const mesh = new InstancedMesh(this.geometry, this.material, this.count);
        mesh.scale.set(0.5, 0.5, 0.5);
        return mesh;
    }

    setInstancePosition(i, position) {
        _matrix.setPosition(position.x, position.y, position.z);
        this.mesh.setMatrixAt(i, _matrix);
    }
}
