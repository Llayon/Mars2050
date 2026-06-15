# Martian Building Assets Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Process and integrate three new Martian building sprites (Solar Panels, Mine, Greenhouse) with multi-tile dimensions into the game.

**Architecture:** Use a Python script with Pillow for batch image processing (background removal, transparency, auto-cropping). Update the centralized asset manifest and building configuration to reflect new assets and their logical dimensions.

**Tech Stack:** Python, Pillow (PIL), TypeScript, Next.js.

---

### Task 1: Batch Process Images

**Files:**
- Create: `scripts/batch_process_sprites.py`
- Output: 
  - `public/assets/buildings/solar_panels.png`
  - `public/assets/buildings/mine.png`
  - `public/assets/buildings/greenhouse.png`

- [ ] **Step 1: Create the batch processing script**

```python
from PIL import Image
import os

assets_to_process = [
    {
        "input": r"C:\Users\Max\.gemini\tmp\mars2050\images\clipboard-1781513597881.png",
        "output": r"D:\Max\Mars2050\public\assets\buildings\solar_panels.png"
    },
    {
        "input": r"C:\Users\Max\.gemini\tmp\mars2050\images\clipboard-1781514412351.png",
        "output": r"D:\Max\Mars2050\public\assets\buildings\mine.png"
    },
    {
        "input": r"C:\Users\Max\.gemini\tmp\mars2050\images\clipboard-1781514434947.png",
        "output": r"D:\Max\Mars2050\public\assets\buildings\greenhouse.png"
    }
]

def process_sprite(img_path, output_path, threshold=20):
    if not os.path.exists(img_path):
        print(f"Error: Source file {img_path} not found.")
        return

    img = Image.open(img_path)
    img = img.convert("RGBA")
    
    datas = img.getdata()
    new_data = []
    
    for item in datas:
        # Check if pixel is close to black (R, G, B < threshold)
        if item[0] < threshold and item[1] < threshold and item[2] < threshold:
            new_data.append((0, 0, 0, 0)) # Fully transparent
        else:
            new_data.append(item)
            
    img.putdata(new_data)
    
    # Auto-crop to remove empty space around the building
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
    
    # Ensure output directory exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
    img.save(output_path, "PNG")
    print(f"Processed and saved to {output_path}")

if __name__ == "__main__":
    for asset in assets_to_process:
        process_sprite(asset["input"], asset["output"])
```

- [ ] **Step 2: Run the batch processing script**

Run: `python scripts/batch_process_sprites.py`

- [ ] **Step 3: Commit the script and assets**

```bash
git add scripts/batch_process_sprites.py public/assets/buildings/*.png
git commit -m "feat(assets): process and add building sprites"
```

### Task 2: Update Asset Manifest

**Files:**
- Modify: `src/components/colony/sprites/asset-manifest.ts`

- [ ] **Step 1: Update the asset manifest**

```typescript
import { BuildingTypeKey } from '@/domains/building/building.types'

/** 
 * Maps building types to asset paths.
 */
export const ASSET_MANIFEST: Partial<Record<BuildingTypeKey, string>> = {
  water_extractor: '/assets/buildings/water_extractor.png',
  solar_panels: '/assets/buildings/solar_panels.png',
  mine: '/assets/buildings/mine.png',
  greenhouse: '/assets/buildings/greenhouse.png',
}
```

- [ ] **Step 2: Commit manifest update**

```bash
git add src/components/colony/sprites/asset-manifest.ts
git commit -m "feat(assets): update ASSET_MANIFEST with new buildings"
```

### Task 3: Update Building Dimensions

**Files:**
- Modify: `src/domains/building/building.config.ts`

- [ ] **Step 1: Set new logical sizes in BUILDING_TYPES**

```typescript
  solar_panels: {
    name: 'Солнечные панели', cost: { minerals: 80, energy: 20 },
    production: { energy: 15 }, consumption: {},
    description: 'Генерирует энергию из солнечного света',
    width: 3, height: 3
  },
  // ... (keep oxygen_generator and water_extractor as is)
  mine: {
    name: 'Шахта', cost: { minerals: 150, energy: 40 },
    production: { minerals: 12 }, consumption: { energy: 10 },
    description: 'Добывает полезные ископаемые',
    width: 2, height: 2
  },
  greenhouse: {
    name: 'Теплица', cost: { minerals: 100, water: 30 },
    production: { food: 6 }, consumption: { water: 4, energy: 3 },
    description: 'Выращивает еду для колонистов',
    width: 3, height: 3
  },
```

- [ ] **Step 2: Commit dimension updates**

```bash
git add src/domains/building/building.config.ts
git commit -m "feat(building): update building dimensions for Solar Panels, Mine, and Greenhouse"
```

### Task 4: Verify Integration

- [ ] **Step 1: Run TypeScript checks**

Run: `npx tsc --noEmit`

- [ ] **Step 2: Run existing tests**

Run: `npm test src/__tests__/building.config.test.ts`
