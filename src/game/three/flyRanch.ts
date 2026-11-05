import * as THREE from "three";
import { FLY_RANCH } from "@/lib/brc";
import { yawOf } from "@/lib/view3d";
import { G, blob, glowMesh, rod, type GlowPart } from "./critters";

/**
 * Fly Geyser at Fly Ranch (asked 2026-11-04: "let's add the fly ranch on the map somewhere in the distance"), past the fence at 8:44
 * (brc.ts FLY_RANCH), from the photos: three lumpy mineral cones on a pale travertine mound, banded rust red, orange, ochre and the green
 * of the algae, capped grey-white, water spraying from their tops, terraced pools stepping down round them and the reeds of the wetland
 * beyond. About six times life size (the tallest cone is about 12 ft) so it reads across a mile of playa; one mesh, one draw call, the
 * water and the spray lit at night (critters.ts glowMesh). Its front, -Z, faces the Man.
 */
const BANDS = [0xa8321e, 0xe0752d, 0xd9a441, 0x4e7f34, 0xc0522a, 0x6f8f3a];
const TOP = 0xd8d4cc, WATER = 0x5fb7c9, SPRAY = 0xeef9ff, RIM = 0xd2692e, TUFA = 0xc9a27a;
const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** A cone of stacked mineral bands with lumps on its flanks, `h` tall and `r` round at its foot, standing at (x, base, z); spray from its top. */
function cone(x: number, z: number, base: number, h: number, r: number, seed: number): GlowPart[] {
  const p: GlowPart[] = [], n = 6;
  // rounded, not pointed: each band narrows less the higher it is, the top a grey-white dome
  for (let k = 0; k < n; k++) {
    const f0 = k / n, f1 = (k + 1) / n, r0 = r * Math.sqrt(1 - f0 * 0.85), r1 = r * Math.sqrt(1 - f1 * 0.85);
    p.push(G(new THREE.CylinderGeometry(r1, r0, h / n, 12), BANDS[(k + seed) % BANDS.length], { x, y: base + h * (f0 + f1) / 2, z }, 0.12));
  }
  p.push(blob(r * 0.4, h * 0.1, r * 0.4, x, base + h, z, TOP, 0.2, 10, 6));
  for (let k = 0; k < 16; k++) {
    const a = hash(seed * 31 + k) * Math.PI * 2, f = 0.05 + hash(seed * 17 + k) * 0.85, rr = r * Math.sqrt(1 - f * 0.85);
    p.push(blob(rr * 0.4, h * 0.09, rr * 0.4, x + Math.cos(a) * rr * 0.9, base + f * h, z + Math.sin(a) * rr * 0.9, BANDS[(k + seed * 2) % BANDS.length], 0.12, 8, 5));
  }
  // the spray: jets fanning up and out from the top, a white burst where each falls apart, a mist round the top
  const top = V(x, base + h, z);
  for (let k = 0; k < 6; k++) {
    const a = seed + k * 1.05, lean = 0.2 + hash(seed * 7 + k) * 0.45, len = h * (0.35 + hash(seed * 3 + k) * 0.3);
    const end = V(x + Math.cos(a) * Math.sin(lean) * len, base + h + Math.cos(lean) * len, z + Math.sin(a) * Math.sin(lean) * len);
    p.push(rod(top, end, 1.6, 0.8, SPRAY, 1.2, 5), blob(len * 0.2, len * 0.14, len * 0.2, end.x, end.y, end.z, SPRAY, 0.9, 8, 5));
  }
  p.push(blob(r * 0.55, h * 0.18, r * 0.55, x, base + h + h * 0.12, z, SPRAY, 0.6, 10, 6));
  return p;
}

function build(): GlowPart[] {
  const p: GlowPart[] = [];
  // the pool the mound stands in, and the pale travertine mound itself
  p.push(G(new THREE.CylinderGeometry(150, 156, 3, 28), WATER, { y: 1.5 }, 0.6));
  p.push(G(new THREE.CylinderGeometry(70, 110, 14, 18), TUFA, { y: 7 }, 0.05), G(new THREE.CylinderGeometry(110, 118, 4, 18), RIM, { y: 2 }, 0.1));
  // the three cones: the big one with the smaller pair behind it
  p.push(...cone(0, -10, 14, 70, 34, 0), ...cone(-42, 28, 12, 46, 24, 2), ...cone(38, 34, 12, 32, 18, 4));
  // the terraces stepping down round the mound: rust rims holding shallow pools, lit at night
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2 + hash(k) * 0.3, d = 128 + hash(k + 40) * 60, r = 16 + hash(k + 80) * 14, y = 2 + hash(k + 120) * 5;
    p.push(G(new THREE.CylinderGeometry(r, r + 3, y, 10), RIM, { x: Math.cos(a) * d, y: y / 2, z: Math.sin(a) * d }, 0.1));
    p.push(G(new THREE.CylinderGeometry(r - 3, r - 3, 0.6, 10), WATER, { x: Math.cos(a) * d, y: y + 0.3, z: Math.sin(a) * d }, 0.7));
  }
  // the wetland: the reservoir behind and clumps of tall reeds round it all, sage and straw
  p.push(G(new THREE.CylinderGeometry(90, 96, 3, 20), 0x3f8fa6, { x: 60, y: 1.5, z: 290 }, 0.5));
  for (let k = 0; k < 40; k++) {
    const a = (k / 40) * Math.PI * 2 + hash(k + 200) * 0.2, d = 210 + hash(k + 240) * 140, cx = Math.cos(a) * d, cz = Math.sin(a) * d;
    for (let j = 0; j < 4; j++) {
      const h = 12 + hash(k * 4 + j + 280) * 12, ox = (hash(k * 4 + j + 320) - 0.5) * 14, oz = (hash(k * 4 + j + 400) - 0.5) * 14;
      p.push(G(new THREE.ConeGeometry(1.6, h, 4), [0x6f8a3c, 0x9aa456, 0xc2b27a][(k + j) % 3], { x: cx + ox, y: h / 2, z: cz + oz, rz: ox * 0.012 }));
    }
  }
  return p;
}

/** How far off it is still drawn: past the day's fog (14,000 ft) it cannot be seen. */
const SHOW = 16000;
export function buildFlyRanch(group: THREE.Group): { update(cam: THREE.Vector3): void } {
  const mesh = glowMesh(build());
  const { at } = FLY_RANCH;
  mesh.position.set(at.x, 0, at.y);
  mesh.rotation.y = yawOf(Math.atan2(-at.x, at.y));   // its front (-Z) toward the Man
  group.add(mesh);
  return { update(cam) { mesh.visible = Math.hypot(at.x - cam.x, at.y - cam.z) < SHOW; } };
}
