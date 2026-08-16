import { GlProgram } from 'pixi.js'

export const TERRAIN_VERTEX_SHADER = `
attribute vec2 aPosition;
attribute vec2 aUV;

uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;

varying vec2 vUV;

void main(void) {
    vUV = aUV;
    mat3 mvp = uProjectionMatrix * uWorldTransformMatrix;
    gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
}
`

export const TERRAIN_FRAGMENT_SHADER = `
precision mediump float;

varying vec2 vUV;

uniform sampler2D uAlbedoTexture;
uniform sampler2D uNormalTexture;
uniform sampler2D uDataTexture;

uniform vec3 uLightDirection;
uniform float uNormalStrength;
uniform float uAoStrength;
uniform float uAoFloor;
uniform float uEmissiveStrength;
uniform float uMinLightFactor;
uniform float uMaxLightFactor;
uniform int uDebugMode;

void main(void) {
    vec4 albedo = texture2D(uAlbedoTexture, vUV);
    if (albedo.a < 0.005) {
        discard;
    }

    if (uDebugMode == 1) {
        // Mode 1: Baked Albedo Only
        gl_FragColor = albedo;
        return;
    }

    vec4 normalRaw = texture2D(uNormalTexture, vUV);
    vec4 dataRaw = texture2D(uDataTexture, vUV);

    if (uDebugMode == 2) {
        // Mode 2: View-Space Normal Debug
        gl_FragColor = vec4(normalRaw.rgb, albedo.a);
        return;
    }

    if (uDebugMode == 3) {
        // Mode 3: Data Channels Debug (R=Height, G=AO, B=Emissive)
        gl_FragColor = vec4(dataRaw.rgb, albedo.a);
        return;
    }

    // Zero-centered normal detail enhancement
    vec3 N = normalize(normalRaw.rgb * 2.0 - 1.0);
    vec3 L = normalize(uLightDirection);

    float lambert = max(dot(N, L), 0.0);
    vec3 flatNormal = vec3(0.0, 0.0, 1.0);
    float flatLambert = max(dot(flatNormal, L), 0.001);

    float normalDelta = lambert - flatLambert;
    float normalFactor = clamp(
        1.0 + normalDelta * uNormalStrength,
        uMinLightFactor,
        uMaxLightFactor
    );

    // Ambient occlusion factor
    float ao = dataRaw.g;
    float aoFactor = mix(1.0, mix(uAoFloor, 1.0, ao), uAoStrength);

    // Emissive
    float emissive = dataRaw.b;

    vec3 finalRGB = albedo.rgb * normalFactor * aoFactor + emissive * uEmissiveStrength;

    gl_FragColor = vec4(finalRGB, albedo.a);
}
`

let cachedGlProgram: GlProgram | null = null

/**
 * Creates or returns the cached singleton PixiJS v8 GlProgram for terrain lighting.
 */
export function getTerrainGlProgram(): GlProgram {
  if (!cachedGlProgram) {
    cachedGlProgram = GlProgram.from({
      vertex: TERRAIN_VERTEX_SHADER,
      fragment: TERRAIN_FRAGMENT_SHADER
    })
  }
  return cachedGlProgram
}
