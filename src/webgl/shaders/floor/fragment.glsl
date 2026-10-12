varying vec2 vUv;
uniform sampler2D uMap;
uniform float uGridSize;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uFogColor;
uniform float uAnimationProgress;
uniform vec3 uAnimationColor;
uniform vec2 uAnimationOffset;

uniform float uPulseMaxRadius;
uniform float uPulseThickness;
uniform float uPulseFade;
uniform float uPulseMinIntensity;

float noise(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

void main() {
    vec2 uv = vUv;

    // Pattern
    vec2 fractUv = fract(uv * uGridSize * 0.5);
    float stripes = step(fractUv.x, 0.5);
    float checkeredPattern = mix(stripes, 1.0 - stripes, step(fractUv.y, 0.5));
    vec3 outputColor = mix(uColor1, uColor2, checkeredPattern);

    // Pulse Animation
    vec2 cellIndex = floor(uv * uGridSize);
    vec2 cellCenter = cellIndex + 0.5;

    float timingNoise = clamp(noise(cellIndex), 0.0001, 1.0);
    float intensityNoise = noise(cellIndex + 17.31);

    vec2 impact = vec2(uAnimationOffset.x, -uAnimationOffset.y) + uGridSize * 0.5;
    float distCell = length(cellCenter - impact);

    float radius = uAnimationProgress * uPulseMaxRadius;
    float front = 1.0 - smoothstep(radius - uPulseFade, radius + uPulseFade, distCell);
    float back = 1.0 - smoothstep(radius - uPulseThickness - uPulseFade, radius - uPulseThickness + uPulseFade, distCell);
    float cellActive = step(timingNoise, front) - step(timingNoise, back);
    float intensity = mix(uPulseMinIntensity, 0.8, intensityNoise) * (1.0 - uAnimationProgress);
    cellActive *= intensity;

    cellActive *= step(0.0001, uAnimationProgress);

    outputColor = mix(outputColor, uAnimationColor, cellActive);

    // "Fog"
    float fakeFog = 1.0 * distance(uv, vec2(0.5));
    fakeFog = smoothstep(0.0, 0.5, fakeFog);
    outputColor = mix(outputColor, uFogColor, fakeFog);

    gl_FragColor = vec4(vec3(outputColor), 1.0);
}
