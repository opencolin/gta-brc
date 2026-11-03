import * as THREE from "three";
import { G, blob, critter, glowMesh, tyres, type Critter, type GlowPart } from "./critters";

/**
 * El Pulpo Mecánico (asked 2026-11-02): the copper octopus of scrap steel, as its top-down drawing has it (artcars.ts elPulpo): a great domed head rising up and forward over
 * the cab, riveted ridges running along it, two big cream eyes with dark pupils at its foot looking out, and eight tentacles from under it, copper and darker
 * copper by turns, spreading out over the ground and curling up at their tips, where the drawing has them at t = 0. At night a jet of fire bursts from the top of the
 * head, leaning forward, and flickers. Inside the drawing's footprint (52 x 52 ft; the flame reaches up past the head at night only). Two draw calls: the octopus, and
 * the fire (its own mesh so it can flicker, hidden by day).
 */
const COPPER = 0xc98a4b, ARM = 0xb8743a, ARM2 = 0x9a5a28, RIDGE = 0x7a4520, EYE = 0xf2d18a, NAVY = 0x1b1f3b, DARK = 0x23252f;
/** The head: half-sizes, centre and tilt (its long axis rising forward from the eyes at HT, so from above it is the drawing's ellipse, 12 x 17 about y -6, foreshortened),
 * and the solid box the tentacles must keep inside (decals.ts SOLID). */
const HX = 12, HY = 11, HZ = 17, HC = 22, HZC = -6.3, HT = 0.88, BOX = { x0: -27.5, x1: 24.5, z0: -23, z1: 29 };

/** A tube along the points, tapering from r0 to r1: a TubeGeometry whose rings are shrunk toward the curve as they go. */
function tentacle(pts: THREE.Vector3[], r0: number, r1: number, segs = 12, radial = 5): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(pts), geo = new THREE.TubeGeometry(curve, segs, 1, radial, false), pos = geo.getAttribute("position");
  const p = new THREE.Vector3(), q = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const u = i / segs, r = r0 + (r1 - r0) * u; curve.getPointAt(u, p);
    for (let j = 0; j <= radial; j++) { const k = i * (radial + 1) + j; q.fromBufferAttribute(pos, k).sub(p).multiplyScalar(r).add(p); pos.setXYZ(k, q.x, q.y, q.z); }
  }
  geo.computeVertexNormals();
  return geo;
}

/** Where a ride on top stands: the head's top over the car's centre. */
const ROOF = (() => {
  const c = Math.cos(HT), s = Math.sin(HT);
  for (let y = 60; y > 0; y -= 0.1) { const dy = y - HC, dz = 0 - HZC, ly = dy * c + dz * s, lz = -dy * s + dz * c; if ((ly / HY) ** 2 + (lz / HZ) ** 2 <= 1) return Math.round(y * 10) / 10; }
  return HC;
})();

export function elPulpo(): Critter {
  const group = new THREE.Group();
  const parts: GlowPart[] = [
    // the chassis and the wheels (the drawing's at x ±13, z -12 and 16)
    G(new THREE.BoxGeometry(20, 2, 36), DARK, { y: 2.6 }),
    ...tyres(12.4, [-12, 16], 3.2, 2.4),
    // the body under the head, where the tentacles meet
    blob(9.5, 5.5, 10, 0, 8.5, 4, ARM2, 0, 14, 8),
    // the head, its ridges (thin slices of the same dome, a little proud of it), and the nozzle the fire comes from
    blob(HX, HY, HZ, 0, HC, HZC, COPPER, 0.05, 16, 12, { rx: HT }),
  ];
  for (let k = -2; k <= 2; k++) {
    const x = k * 4, f = Math.sqrt(1 - (x / HX) ** 2);
    parts.push(blob(0.45, HY * f + 0.3, HZ * f + 0.3, x, HC, HZC, RIDGE, 0, 4, 8, { rx: HT }));
  }
  const NOZ = new THREE.Vector3(0, HC + (HZ - 0.6) * Math.sin(HT), HZC - (HZ - 0.6) * Math.cos(HT));
  parts.push(G(new THREE.CylinderGeometry(1.2, 1.6, 2.4, 8), 0x3a3d48, { rx: -0.7, x: NOZ.x, y: NOZ.y, z: NOZ.z }));
  // the eyes: big cream bulbs at the back corners of the head, dark pupils looking out and forward
  for (const s of [-1, 1]) {
    const c = new THREE.Vector3(s * 8.4, 14.5, 2.5), d = new THREE.Vector3(s * 0.8, 0.1, -0.6).normalize();
    parts.push(blob(3.2, 3.2, 3.2, c.x, c.y, c.z, EYE, 0.2, 10, 8));
    const p = c.clone().addScaledVector(d, 2.6);
    parts.push(blob(1.5, 1.5, 1.5, p.x, p.y, p.z, NAVY, 0, 6, 4));
  }
  // the tentacles: the drawing's curves at t = 0, from under the body out over the ground, then curling up and back at the tip; kept inside the solid box
  const clamp = (x: number, z: number) => [Math.max(BOX.x0 + 2, Math.min(BOX.x1 - 2, x)), Math.max(BOX.z0 + 2, Math.min(BOX.z1 - 2, z))] as const;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + 0.2, sw = Math.sin(k) * 0.35, at = (ang: number, r: number) => [Math.cos(ang) * r, 6 + Math.sin(ang) * r] as const;
    const [x0, z0] = at(a, 7), [xc, zc] = at(a + sw, 20), [x1, z1] = clamp(...at(a + sw * 2 + 0.6, 26));
    const bez = (t: number) => [(1 - t) ** 2 * x0 + 2 * (1 - t) * t * xc + t * t * x1, (1 - t) ** 2 * z0 + 2 * (1 - t) * t * zc + t * t * z1] as const;
    const hs = [8.5, 5.5, 3.2, 3.2, 5.5];
    const pts = [0, 0.25, 0.5, 0.75, 1].map((t, i) => { const [x, z] = bez(t); return new THREE.Vector3(x, hs[i], z); });
    // the curl: up from the tip and back toward the body
    const [xb, zb] = bez(0.85), back = new THREE.Vector3(xb - x1, 0, zb - z1).normalize();
    pts.push(new THREE.Vector3(x1 + back.x * 0.6, 10, z1 + back.z * 0.6), new THREE.Vector3(x1 + back.x * 3.2, 12.5, z1 + back.z * 3.2));
    parts.push({ geo: tentacle(pts, 2.3, 0.45), color: k % 2 ? ARM : ARM2, glow: 0 });
  }
  group.add(glowMesh(parts));

  // the fire: a jet out of the nozzle, orange round a yellow core, leaning forward, flickering, seen only at night
  const fire = new THREE.Group(); fire.position.copy(NOZ); fire.rotation.x = -0.45;
  fire.add(glowMesh([
    G(new THREE.ConeGeometry(2.8, 15, 8, 1, true).translate(0, 8.5, 0), 0xff5a14, {}, 1.6),
    G(new THREE.ConeGeometry(1.6, 9, 6, 1, true).translate(0, 5.5, 0), 0xff8a1c, { rz: 0.35, x: -1.2 }, 1.8),
    G(new THREE.ConeGeometry(1.4, 8, 6, 1, true).translate(0, 5, 0), 0xff8a1c, { rz: -0.4, x: 1.2, z: 0.4 }, 1.8),
    G(new THREE.ConeGeometry(1.5, 11, 8, 1, true).translate(0, 6.5, 0), 0xffd84a, {}, 2.2),
    blob(2.4, 1.6, 2.4, 0, 1.4, 0, 0xffe58a, 2.2, 8, 5),
  ]));
  group.add(fire);

  return critter(group, (t, night) => {
    fire.visible = night > 0.3;
    const f = 0.5 + 0.5 * Math.sin(t * 13) * Math.sin(t * 7.3 + 1);
    fire.scale.set(0.85 + 0.25 * f, 0.7 + 0.6 * f, 0.85 + 0.25 * f); fire.rotation.y = t * 5; fire.rotation.z = Math.sin(t * 9) * 0.08;
  }, ROOF);
}
