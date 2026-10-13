import { MathUtils } from 'three';

function randomIntFromRange(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min) + min); // The maximum is exclusive and the minimum is inclusive
}

export default class LegoPropsManager {
    constructor(options = {}) {
        this.colors = options.colors || [0xff0000, 0x0000ff, 0xffff00];
        this.rotationStep = Math.PI / 2;
        this.size = 1;

        this.currentColorIndex = randomIntFromRange(0, this.colors.length - 1);
        this.currentRotationIndex = 0;
    }

    get color() {
        return this.colors[this.currentColorIndex];
    }

    get rotation() {
        return this.currentRotationIndex * this.rotationStep;
    }

    get props() {
        return {
            size: this.size,
            color: this.color,
            rotation: this.rotation,
        };
    }

    nextColor() {
        this.currentColorIndex += 1;
        this.currentColorIndex = this.currentColorIndex % this.colors.length;
        return this.color;
    }

    nextRotation() {
        this.currentRotationIndex += 1;
        return this.rotation;
    }

    previousRotation() {
        this.currentRotationIndex -= 1;
        return this.rotation;
    }

    shuffleColor() {
        this.currentColorIndex = randomIntFromRange(0, this.colors.length - 1);
        return this.color;
    }

    shuffleRotation() {
        this.currentRotationIndex = randomIntFromRange(0, this.rotations.length - 1);
        return this.rotation;
    }

    increaseSize() {
        this.size = MathUtils.clamp(this.size + 1, 1, 3);
        return this.size;
    }

    decreaseSize() {
        this.size = MathUtils.clamp(this.size - 1, 1, 3);
        return this.size;
    }
}
