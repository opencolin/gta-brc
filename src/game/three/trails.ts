import * as THREE from "three";
import { vehicleOf, type Game } from "@/lib/playa";

/**
 * The trip's LED trails (asked 2026-10-27): while T is on, two rainbow ribbons follow the ride's last few seconds of path, one along
 * the ground as wide as the ride and a thinner one at its lights' height, additive, their hue running along the ribbon and with time,
 * fading to nothing at the tail. One mesh, so one draw call; it lets go of its points when the trip ends.
 */
export type TrailMeshes = { mesh: THREE.Mesh; update(g: Game, trip: number): void };
const N = 140, EVERY = 0.04;   // points kept, and seconds between them: about 5.6 s of trail

export function buildTrails(scene: THREE.Scene): TrailMeshes {
  const pos = new Float32Array(N * 4 * 3), col = new Float32Array(N * 4 * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
  const idx: number[] = [];
  for (let r = 0; r < 2; r++) for (let i = 0; i < N - 1; i++) { const a = (r * N + i) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  geo.setIndex(idx);
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.visible = false; mesh.renderOrder = 15; scene.add(mesh);
  const pts: { x: number; y: number; h: number }[] = []; let last = -1;
  const c = new THREE.Color();
  return {
    mesh,
    update(g, trip) {
      if (trip <= 0.02) { if (pts.length) pts.length = 0; mesh.visible = false; last = -1; return; }
      const car = g.car, wid = vehicleOf(g).wid;
      if (g.t - last > EVERY) { pts.push({ x: car.x, y: car.y, h: car.h }); if (pts.length > N) pts.shift(); last = g.t; }
      const n = pts.length, pad = N - n;
      mesh.visible = n > 1;
      for (let r = 0; r < 2; r++) for (let i = 0; i < N; i++) {
        const used = i >= pad, p = pts[used ? i - pad : 0], k = used ? (i - pad) / Math.max(1, n - 1) : 0;   // k: 0 at the tail, 1 at the ride
        const w = used ? (r ? wid * 0.35 : wid * 0.6) * (0.4 + 0.6 * k) : 0, y = r ? 4.5 : 0.8, rx = Math.cos(p.h), ry = Math.sin(p.h);
        const b = (r * N + i) * 2 * 3;
        pos[b] = p.x - rx * w; pos[b + 1] = y; pos[b + 2] = p.y - ry * w;
        pos[b + 3] = p.x + rx * w; pos[b + 4] = y; pos[b + 5] = p.y + ry * w;
        c.setHSL((((g.t * 60 + (1 - k) * 240 + r * 40) % 360) + 360) % 360 / 360, 1, 0.55, THREE.SRGBColorSpace).multiplyScalar(used ? trip * (r ? 0.9 : 0.55) * k * k : 0);   // additive: the brightness is the alpha
        col[b] = col[b + 3] = c.r; col[b + 1] = col[b + 4] = c.g; col[b + 2] = col[b + 5] = c.b;
      }
      geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
    },
  };
}
