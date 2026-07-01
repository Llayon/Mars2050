import fs from 'fs'
import path from 'path'

const OUT_DIR = path.join(process.cwd(), 'public', 'assets', 'terrain')

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true })
}

const TILE_W = 128
const TILE_H = 64

// We draw isometric tiles. The standard isometric tile has points:
// Top: (64, 0)
// Right: (128, 32)
// Bottom: (64, 64)
// Left: (0, 32)
const ISO_POLY = "64,0 128,32 64,64 0,32"
const ISO_POLY_INNER = "64,4 120,32 64,60 8,32"

interface TerrainGen {
  name: string
  svg: string
}

const TERRAINS: TerrainGen[] = [
  {
    name: 'regolith',
    svg: `
      <svg width="${TILE_W}" height="${TILE_H}" viewBox="0 0 ${TILE_W} ${TILE_H}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="regoGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#b05b33"/>
            <stop offset="100%" stop-color="#8b4513"/>
          </radialGradient>
          <filter id="noise">
            <feTurbulence type="fractalNoise" baseFrequency="0.1" numOctaves="3" result="noise"/>
            <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.15 0" in="noise" result="coloredNoise"/>
            <feComposite operator="in" in="coloredNoise" in2="SourceGraphic" result="composite"/>
            <feBlend mode="multiply" in="composite" in2="SourceGraphic"/>
          </filter>
        </defs>
        <polygon points="${ISO_POLY}" fill="url(#regoGrad)" stroke="#663300" stroke-width="1" />
        <polygon points="${ISO_POLY}" fill="none" filter="url(#noise)" />
        <!-- Grid overlay slightly visible -->
        <polygon points="${ISO_POLY}" fill="none" stroke="#ffffff" stroke-width="0.5" stroke-opacity="0.1" />
      </svg>
    `
  },
  {
    name: 'iron_deposit',
    svg: `
      <svg width="${TILE_W}" height="${TILE_H}" viewBox="0 0 ${TILE_W} ${TILE_H}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="ironGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#a0522d"/>
            <stop offset="100%" stop-color="#5c2e16"/>
          </radialGradient>
        </defs>
        <polygon points="${ISO_POLY}" fill="url(#ironGrad)" stroke="#3a1d0e" stroke-width="1" />
        <!-- Iron veins -->
        <path d="M30,32 L50,20 L70,30 L90,25 L100,40 L70,50 L40,45 Z" fill="#404040" stroke="#707070" stroke-width="1.5" opacity="0.8"/>
        <path d="M40,32 L50,25 L60,35 L80,28" stroke="#808080" fill="none" stroke-width="2" stroke-dasharray="2 2" />
        <!-- Shiny dots -->
        <circle cx="50" cy="20" r="1.5" fill="#ffffff" opacity="0.6"/>
        <circle cx="70" cy="30" r="1" fill="#ffffff" opacity="0.6"/>
        <circle cx="90" cy="25" r="2" fill="#ffffff" opacity="0.6"/>
        <circle cx="70" cy="50" r="1.5" fill="#ffffff" opacity="0.6"/>
      </svg>
    `
  },
  {
    name: 'ice_pocket',
    svg: `
      <svg width="${TILE_W}" height="${TILE_H}" viewBox="0 0 ${TILE_W} ${TILE_H}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="iceGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#add8e6"/>
            <stop offset="100%" stop-color="#4682b4"/>
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <polygon points="${ISO_POLY}" fill="#8b4513" stroke="#663300" stroke-width="1" />
        <!-- Ice cracking through regolith -->
        <polygon points="64,10 100,32 64,54 28,32" fill="url(#iceGrad)" opacity="0.8"/>
        <!-- Cracks -->
        <path d="M64,32 L40,25 M64,32 L80,20 M64,32 L90,40 M64,32 L50,45 M64,32 L64,15" stroke="#ffffff" stroke-width="1.5" filter="url(#glow)" opacity="0.9" fill="none"/>
        <path d="M64,32 L40,25 M64,32 L80,20 M64,32 L90,40 M64,32 L50,45 M64,32 L64,15" stroke="#e0ffff" stroke-width="0.5" fill="none"/>
      </svg>
    `
  },
  {
    name: 'geothermal',
    svg: `
      <svg width="${TILE_W}" height="${TILE_H}" viewBox="0 0 ${TILE_W} ${TILE_H}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="geoGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#ff4500"/>
            <stop offset="100%" stop-color="#8b0000"/>
          </radialGradient>
          <filter id="lavaGlow">
            <feGaussianBlur stdDeviation="3" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <polygon points="${ISO_POLY}" fill="#5c2e16" stroke="#3a1d0e" stroke-width="1" />
        <!-- Lava vent -->
        <path d="M50,32 Q64,20 78,32 Q64,44 50,32" fill="url(#geoGrad)" filter="url(#lavaGlow)"/>
        <!-- Core hot spot -->
        <ellipse cx="64" cy="32" rx="10" ry="5" fill="#ffff00" filter="url(#lavaGlow)"/>
        <!-- Steam plumes (subtle) -->
        <circle cx="60" cy="20" r="5" fill="#ffffff" opacity="0.2" filter="url(#lavaGlow)"/>
        <circle cx="70" cy="25" r="8" fill="#ffffff" opacity="0.15" filter="url(#lavaGlow)"/>
        <circle cx="55" cy="40" r="6" fill="#ffffff" opacity="0.2" filter="url(#lavaGlow)"/>
      </svg>
    `
  },
  {
    name: 'blocked_rock',
    svg: `
      <svg width="${TILE_W}" height="${TILE_H * 2}" viewBox="0 0 ${TILE_W} ${TILE_H * 2}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="rockGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#8b5a42"/>
            <stop offset="50%" stop-color="#69412e"/>
            <stop offset="100%" stop-color="#3a2318"/>
          </linearGradient>
        </defs>
        <!-- Offset the Y by TILE_H so the base sits at the bottom half -->
        <g transform="translate(0, ${TILE_H})">
          <polygon points="${ISO_POLY}" fill="#4a2e20" stroke="#2a1a12" stroke-width="1" />
        </g>
        <!-- The tall rock -->
        <path d="
          M 20,${TILE_H + 32} 
          L 40,30 
          L 60,10 
          L 80,40 
          L 100,${TILE_H + 32} 
          L 64,${TILE_H + 50} 
          Z" 
        fill="url(#rockGrad)" stroke="#1a0f0a" stroke-width="1.5"/>
        
        <!-- Rock highlights/facets -->
        <path d="M 20,${TILE_H + 32} L 60,10 L 64,${TILE_H + 50} Z" fill="#9c684d" opacity="0.3"/>
        <path d="M 60,10 L 100,${TILE_H + 32} L 64,${TILE_H + 50} Z" fill="#000000" opacity="0.3"/>
        <path d="M 40,30 L 60,10 L 64,${TILE_H + 50} Z" fill="#ffffff" opacity="0.1"/>
      </svg>
    `
  }
]

async function generate() {
  for (const t of TERRAINS) {
    const p = path.join(OUT_DIR, `${t.name}.svg`)
    fs.writeFileSync(p, t.svg.trim())
    console.log(`Generated ${p}`)
  }
}

generate().catch(console.error)
