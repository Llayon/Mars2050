import { Container, Graphics } from 'pixi.js'
import type { SpriteState } from './battle-replay-units'
import type { UnitTypeKey } from '@/domains/combat/combat.types'
import { UNIT_TYPES } from '@/domains/combat/combat.config'
import { UNIT_VISUALS } from './battle-replay-visuals'

export type MotionVfxConfig = {
  dt: number;
  globalTime: number;
}

// Bounded particle pool
const MAX_PARTICLES = 50;
const particlePool: { g: Graphics; life: number; maxLife: number; vx: number; vy: number; active: boolean }[] = [];
let nextTrailAt: Record<string, number> = {};

function spawnTrailParticle(x: number, y: number, color: number, layer: Container) {
  let p = particlePool.find(p => !p.active);
  if (!p) {
    if (particlePool.length >= MAX_PARTICLES) return; // Cap reached
    const g = new Graphics();
    layer.addChild(g);
    p = { g, life: 0, maxLife: 0, vx: 0, vy: 0, active: false };
    particlePool.push(p);
  }
  
  p.active = true;
  p.life = 500; // ms
  p.maxLife = 500;
  p.g.clear();
  p.g.circle(0, 0, 4).fill({ color, alpha: 0.6 });
  p.g.position.set(x, y);
  
  // Deterministic tiny offset based on position
  p.vx = (x % 3) - 1.5;
  p.vy = (y % 3) - 1.5;
  p.g.scale.set(0.5);
  p.g.visible = true;
}

export function updateParticles(dt: number) {
  for (const p of particlePool) {
    if (!p.active) continue;
    p.life -= dt;
    if (p.life <= 0) {
      p.active = false;
      p.g.visible = false;
      continue;
    }
    p.g.x += p.vx * (dt / 16);
    p.g.y += p.vy * (dt / 16);
    p.g.alpha = p.life / p.maxLife;
    p.g.scale.set(0.5 + (1 - p.life / p.maxLife) * 1.5);
  }
}

export function applyProceduralMotion(s: SpriteState, config: MotionVfxConfig, fxLayer: Container) {
  if (!s.s) return;
  const vConf = UNIT_VISUALS[s.type as UnitTypeKey] || {};
  const { dt, globalTime } = config;
  
  // Recoil decay (dt-independent)
  if (s.recoil && s.recoil > 0) {
    s.recoil = s.recoil * Math.exp(-0.01 * dt);
    if (s.recoil < 0.1) s.recoil = 0;
  }
  
  let recoilX = 0, recoilY = 0;
  if (s.recoil && s.recoil > 0 && s.recoilAngle !== undefined) {
     recoilX = -Math.cos(s.recoilAngle) * s.recoil;
     recoilY = -Math.sin(s.recoilAngle) * s.recoil;
  }
  
  // Locomotion bobbing
  let bobY = 0;
  let tilt = 0;
  if (s.act === 'walk' && vConf.locomotion) {
     if (vConf.locomotion === 'tracks' || vConf.locomotion === 'wheels') {
       bobY = Math.sin(globalTime * 0.4) * 1.5;
     } else if (vConf.locomotion === 'legs') {
       bobY = Math.abs(Math.sin(globalTime * 0.05)) * -4;
       tilt = Math.sin(globalTime * 0.05) * 0.05;
     } else if (vConf.locomotion === 'hover') {
       tilt = 0.05; // tilt forward
     }
  }
  
  // Hover logic (from engine)
  let hoverY = 0;
  const isFlying = UNIT_TYPES[s.type as UnitTypeKey]?.baseStats.isFlying;
  if (isFlying) {
     const hAmp = vConf.hoverAmplitude || 3;
     const hSpeed = vConf.hoverSpeed || 0.05;
     hoverY = Math.sin(globalTime * hSpeed + (s.c.uid || 0)) * hAmp;
  }
  
  // Trail emission
  if (s.act === 'walk' && vConf.locomotion && vConf.trailColor) {
    const uid = String(s.c.uid || s.type); // unique enough for deterministic pool
    if (!nextTrailAt[uid]) nextTrailAt[uid] = 0;
    
    if (globalTime >= nextTrailAt[uid]) {
      nextTrailAt[uid] = globalTime + 150; // 150ms cooldown
      spawnTrailParticle(s.c.x, s.c.y, vConf.trailColor, fxLayer);
    }
  }

  // Apply all transforms to Sprite
  s.s.x = recoilX;
  s.s.y = (vConf.yOffset || (isFlying ? -20 : 0)) + hoverY + bobY + recoilY;
  s.s.rotation = tilt;
}
