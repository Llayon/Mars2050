import {
  Container,
  Mesh,
  MeshGeometry,
  Shader,
  Sprite,
  Texture,
  UniformGroup
} from 'pixi.js'
import type { MapRenderProfile, VisualAssetFrame } from './mars-map-asset.types'
import { applyMapAssetTransform } from './mars-map-assets'
import {
  calculateViewSpaceSunDirection,
  DEFAULT_TERRAIN_LIGHTING,
  type TerrainLightingMode,
  type TerrainLightingSettings,
  type ViewSpaceDirection
} from './mars-map-lighting'
import {
  TERRAIN_FRAGMENT_SHADER,
  TERRAIN_VERTEX_SHADER
} from './mars-map-lighting.shader'
import type { LoadedMapAssets, RuntimeMapAsset } from './mars-map-render.types'

/**
 * Creates anchor-aware 2D quad geometry for a terrain mesh.
 * Vertex coordinates are centered on the canonical asset anchor point.
 */
export function createLitMeshGeometry(
  frame: VisualAssetFrame,
  texture: Texture
): MeshGeometry {
  const w = frame.frame.w
  const h = frame.frame.h
  const ax = frame.anchor.x
  const ay = frame.anchor.y

  const left = -ax * w
  const right = (1 - ax) * w
  const top = -ay * h
  const bottom = (1 - ay) * h

  // 4 vertices, 2 floats each (X, Y)
  const positions = new Float32Array([
    left, top,       // 0: top-left
    right, top,      // 1: top-right
    right, bottom,   // 2: bottom-right
    left, bottom     // 3: bottom-left
  ])

  // 2 triangles
  const indices = new Uint32Array([0, 1, 2, 0, 2, 3])

  // Texture atlas UV coordinates
  const uvs = new Float32Array([
    texture.uvs.x0, texture.uvs.y0,
    texture.uvs.x1, texture.uvs.y1,
    texture.uvs.x2, texture.uvs.y2,
    texture.uvs.x3, texture.uvs.y3
  ])

  return new MeshGeometry({
    positions,
    uvs,
    indices
  })
}

/**
 * Context holding shared uniform groups and per-atlas-page Shader instances.
 */
export class TerrainLightingContext {
  public readonly uniformGroup: UniformGroup
  public readonly lightDirection: ViewSpaceDirection
  private readonly pageShaders = new Map<number, Shader>()

  constructor(
    profile: MapRenderProfile,
    settings: TerrainLightingSettings = DEFAULT_TERRAIN_LIGHTING,
    debugMode = 0
  ) {
    this.lightDirection = calculateViewSpaceSunDirection(profile)

    this.uniformGroup = new UniformGroup({
      uLightDirection: {
        value: new Float32Array([this.lightDirection.x, this.lightDirection.y, this.lightDirection.z]),
        type: 'vec3<f32>'
      },
      uNormalStrength: { value: settings.normalStrength, type: 'f32' },
      uAoStrength: { value: settings.aoStrength, type: 'f32' },
      uAoFloor: { value: settings.aoFloor, type: 'f32' },
      uEmissiveStrength: { value: settings.emissiveStrength, type: 'f32' },
      uMinLightFactor: { value: settings.minLightFactor, type: 'f32' },
      uMaxLightFactor: { value: settings.maxLightFactor, type: 'f32' },
      uDebugMode: { value: debugMode, type: 'i32' }
    })
  }

  /**
   * Returns or constructs the cached GPU shader for a given atlas page.
   */
  public getOrCreateShader(pageIndex: number, assets: LoadedMapAssets): Shader {
    const cached = this.pageShaders.get(pageIndex)
    if (cached) return cached

    const albedoPage = assets.albedoPages[pageIndex]
    const normalPage = assets.normalPages[pageIndex]
    const dataPage = assets.dataPages[pageIndex]

    if (!albedoPage || !normalPage || !dataPage) {
      throw new Error(`Cannot create lit shader: missing atlas textures for page ${pageIndex}`)
    }

    const shader = Shader.from({
      gl: {
        vertex: TERRAIN_VERTEX_SHADER,
        fragment: TERRAIN_FRAGMENT_SHADER
      },
      resources: {
        uAlbedoTexture: albedoPage.source,
        uNormalTexture: normalPage.source,
        uDataTexture: dataPage.source,
        terrainUniforms: this.uniformGroup
      }
    })

    this.pageShaders.set(pageIndex, shader)
    return shader
  }
}

export interface CreateTerrainRenderableOptions {
  asset: RuntimeMapAsset
  assets: LoadedMapAssets
  lightingContext?: TerrainLightingContext | null
  lightingMode?: TerrainLightingMode
  alpha?: number
  scaleMultiplier?: number
}

/**
 * Universal factory creating either a Lit Mesh or a fallback Baked Sprite.
 */
export function createTerrainRenderable(options: CreateTerrainRenderableOptions): Container {
  const {
    asset,
    assets,
    lightingContext,
    lightingMode = 'enhanced',
    alpha,
    scaleMultiplier
  } = options

  let renderable: Container

  if (
    lightingMode === 'enhanced' &&
    lightingContext &&
    assets.lightingAvailable &&
    asset.normalTexture &&
    asset.dataTexture
  ) {
    try {
      const geometry = createLitMeshGeometry(asset.frame, asset.texture)
      const shader = lightingContext.getOrCreateShader(asset.frame.page, assets)
      renderable = new Mesh({ geometry, shader })
    } catch (err) {
      console.warn(`Failed to initialize lit mesh for asset "${asset.frame.id}", falling back to baked sprite:`, err)
      renderable = new Sprite(asset.texture)
    }
  } else {
    renderable = new Sprite(asset.texture)
  }

  if (typeof alpha === 'number') {
    renderable.alpha = alpha
  }

  applyMapAssetTransform(renderable, asset.frame, assets.manifest.profile)

  if (typeof scaleMultiplier === 'number') {
    renderable.scale.x *= scaleMultiplier
    renderable.scale.y *= scaleMultiplier
  }

  return renderable
}
