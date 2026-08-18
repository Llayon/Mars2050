import { GlProgram, Shader, UniformGroup } from 'pixi.js'
import { MARS_TERRAIN_PALETTE } from './mars-terrain-palette.config'

export const MARS_GROUND_VERTEX_SHADER = `
attribute vec2 aPosition;
attribute vec2 aUV;

uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;

varying vec2 vWorldPos;
varying vec2 vUV;

void main(void) {
    vUV = aUV;
    vWorldPos = aPosition;
    mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
    gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
}
`

export const MARS_GROUND_FRAGMENT_SHADER = `
precision mediump float;

varying vec2 vWorldPos;
varying vec2 vUV;

uniform vec3 uRegolithColor;
uniform vec3 uOxideColor;
uniform vec3 uDustColor;
uniform vec3 uBasaltColor;
uniform vec3 uHighlandsColor;

uniform float uFlowAngle;
uniform float uMapSeed;

// 8 Macro region descriptors: xy = world center, z = radius, w = biome type (0=regolith, 1=dust, 2=dune, 3=basalt, 4=highlands, 5=canyon)
uniform vec4 uRegions[8];
uniform float uRegionCount;

// Cheap deterministic 2D noise
float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21) + uMapSeed * 0.013);
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

float smoothNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(hash21(i + vec2(0.0, 0.0)), hash21(i + vec2(1.0, 0.0)), u.x),
        mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
        u.y
    );
}

void main(void) {
    vec2 p = vWorldPos;

    // Macro warp using low-frequency noise
    vec2 warp = vec2(
        smoothNoise(p * 0.0015 + vec2(1.7, 9.2)),
        smoothNoise(p * 0.0015 + vec2(8.3, 2.8))
    ) * 120.0;

    vec2 warpedPos = p + warp;

    // Base regolith
    vec3 col = uRegolithColor;

    // Soft organic biome blending from macro region fields
    int count = int(uRegionCount + 0.5);
    for (int i = 0; i < 8; i++) {
        if (i >= count) break;
        vec4 reg = uRegions[i];
        float d = length(warpedPos - reg.xy);
        float radius = reg.z * 1.8;
        float w = 1.0 - smoothstep(radius * 0.25, radius, d);

        if (w > 0.001) {
            int bType = int(reg.w + 0.5);
            vec3 targetCol = uRegolithColor;
            if (bType == 1 || bType == 2) targetCol = uDustColor;
            else if (bType == 3) targetCol = uBasaltColor;
            else if (bType == 4) targetCol = uHighlandsColor;
            else if (bType == 5) targetCol = uOxideColor;

            col = mix(col, targetCol, w * 0.85);
        }
    }

    // Meso geological variation & oxide patches
    float meso = smoothNoise(p * 0.004);
    col = mix(col, uOxideColor, smoothstep(0.48, 0.75, meso) * 0.35);

    // Directional wind / erosion streaks aligned with geological flow
    vec2 dir = vec2(cos(uFlowAngle), sin(uFlowAngle));
    float streakCoord = dot(p, dir) * 0.006;
    float streak = smoothNoise(vec2(streakCoord, dot(p, vec2(-dir.y, dir.x)) * 0.0015));
    col = mix(col, uDustColor, (streak - 0.5) * 0.25);

    // Micro grain (subtle surface tooth)
    float grain = hash21(p * 0.1) * 0.06 - 0.03;
    col += grain;

    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`

/**
 * Creates a ground shader with initialized uniform defaults.
 */
export function createMarsGroundShader(
  seed: number = 2050,
  regionArray: Float32Array = new Float32Array(32),
  regionCount: number = 0
): Shader {
  const groundUniforms = new UniformGroup({
    uRegolithColor: { value: new Float32Array(MARS_TERRAIN_PALETTE.regolith.rgb), type: 'vec3<f32>' },
    uOxideColor: { value: new Float32Array(MARS_TERRAIN_PALETTE.oxide.rgb), type: 'vec3<f32>' },
    uDustColor: { value: new Float32Array(MARS_TERRAIN_PALETTE.dust.rgb), type: 'vec3<f32>' },
    uBasaltColor: { value: new Float32Array(MARS_TERRAIN_PALETTE.basalt.rgb), type: 'vec3<f32>' },
    uHighlandsColor: { value: new Float32Array(MARS_TERRAIN_PALETTE.highlands.rgb), type: 'vec3<f32>' },
    uFlowAngle: { value: (35 * Math.PI) / 180, type: 'f32' },
    uMapSeed: { value: seed, type: 'f32' },
    uRegionCount: { value: regionCount, type: 'f32' },
    uRegions: { value: regionArray, type: 'vec4<f32>', size: 8 }
  })

  return Shader.from({
    gl: {
      vertex: MARS_GROUND_VERTEX_SHADER,
      fragment: MARS_GROUND_FRAGMENT_SHADER
    },
    resources: {
      groundUniforms
    }
  })
}
