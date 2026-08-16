# Mars2050 Blender Terrain Asset Factory

Automated 2.5D procedural terrain generation pipeline for Mars2050.

## Overview
The Blender Asset Factory compiles 3D procedural Martian terrain models (craters, ridges, rock clusters, basalt formations, and sand dunes) into authoritative 2.5D sprite maps matching the project render profile.

## Pipeline Architecture
```
assets/pipeline/map-render-profile.json
               +
assets/pipeline/map-asset-factory.json
               │
               ▼
tools/blender/map_asset_factory.py (Headless Blender)
               │
               ▼
assets/raw_renders/.factory-staging/
 (Albedo PNG, View-Space Normal PNG, Data PNG, raw_manifest.json)
               │
   [Validation & Atomic Promotion]
               ▼
      assets/raw_renders/
               │
   [Existing Stage-2 Compiler]
               ▼
       public/assets/map/
 (WebP Albedo Atlas, PNG Normal Atlas, PNG Data Atlas, Manifest V2)
```

## Channel Specifications

### 1. Albedo Pass
- RGB: Diffuse surface color.
- Alpha: 255 for opaque object surface, 0 for transparent background.

### 2. Normal Map Pass (Camera / View-Space)
- **R**: Camera-space +X (Screen Right)
- **G**: Camera-space +Y (Screen Up)
- **B**: Camera-space +Z (Toward Camera)
- **Neutral Surface**: `(128, 128, 255)`
- **Alpha**: 255 for object surface, 0 for background.

### 3. Data Pass (Packed Texture)
- **R (Height)**: Asset-local normalized height (`0` = contact plane, `255` = highest point of asset).
- **G (AO)**: Ambient occlusion (`0` = fully occluded crevices, `255` = unoccluded).
- **B (Emissive)**: Surface glow intensity (`0` = inert).
- **A**: Mask (`255` = object, `0` = background).

## Usage & CLI

### Validate Factory Config
```bash
npm run map:assets:factory:validate
```

### Run Asset Factory
```bash
npm run map:assets:factory
```

### Specifying Custom Blender Path
On Windows / macOS / Linux, you can specify custom Blender executable via `BLENDER_BIN`:
```bash
BLENDER_BIN="C:\Program Files\Blender Foundation\Blender 4.2\blender.exe" npm run map:assets:factory
```
