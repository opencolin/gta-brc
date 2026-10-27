import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { mergedParts, shaped as P, type Part } from "./materials";

/**
 * Big Imagination (asked 2026-10-27): a Boeing 747 on a trailer, to the shape of its top-down drawing (artcars.ts jumbo): a lathe fuselage with a rounded nose, the
 * upper-deck hump behind the cockpit, a tail that tapers to a point, swept wings 62 ft across with four engine nacelles slung under them (the Golden Ticket's pod
 * profile with dark intakes), swept tailplanes and a tall fin, white on top with a navy belly and cheat line, standing on a flatbed on truck wheels. In its own
 * frame forward is -Z and right is +X; the car's centre is the drawing's. Two draw calls: the airframe, the trailer and the wheels in one mesh; the livery
 * band (the cabin windows, dark by day and warm at night, the navy cheat line and a run of LEDs along it), one canvas repainted ten times a second (paint()),
 * which also carries the lights, three small spheres whose colours blink (the wingtips, the spine's beacon). The roof drawing is not drawn on it.
 */
export type Jumbo = { group: THREE.Group; paint(t: number, night: number): void; /** the height of the top of the fuselage, which a ride on it stands on */ roof: number };

const WHITE = 0xf4f5fa, SHADE = 0xd9dde8, NAVY = 0x1d2f6f, BLUE = 0x2f5fc4, NACELLE = 0xb9bfd0, INTAKE = 0x23242a, TYRE = 0x15161d, DECK = 0x2b2f3a, STRUT = 0x3b4157, GLASS = 0x26304a;
const HUB = 9.6, RAD = 4.6, NOSE = -33, TAIL = 32;
const smooth = (x: number) => x * x * (3 - 2 * x);
/** The fuselage's radius at z: an elliptical nose, a tube, and a tail that tapers to a point. */
function radius(z: number): number {
  if (z < -22) return RAD * Math.sqrt(Math.max(0, 1 - ((z + 22) / 11) ** 2)) + 0.12;
  if (z <= 12) return RAD;
  return RAD - 3.5 * smooth(Math.min(1, (z - 12) / 20));
}
/** A flat plate from a plan outline of [x, z] points, `depth` thick, its underside at y. */
function plate(pts: [number, number][], depth: number, y: number): THREE.BufferGeometry {
  const shape = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false }).rotateX(-Math.PI / 2).translate(0, y, 0);
}
/** The fin: an outline in the side view, [z, y] points, `thick` through (x). */
function fin(pts: [number, number][], thick: number): THREE.BufferGeometry {
  const shape = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y)));
  return new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false }).rotateY(-Math.PI / 2).translate(thick / 2, 0, 0);
}
const cyl = (r: number, h: number, seg = 12) => new THREE.CylinderGeometry(r, r, h, seg);

/** The livery band on one side of the fuselage: a strip from angle a0 to a1 above the horizontal, hugging the skin from z0 to z1, its u along z and its v up the arc. */
function band(side: number, z0: number, z1: number, a0: number, a1: number): THREE.BufferGeometry {
  const nz = 30, na = 6, pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let i = 0; i <= nz; i++) for (let j = 0; j <= na; j++) {
    const z = z0 + ((z1 - z0) * i) / nz, a = a0 + ((a1 - a0) * j) / na, r = radius(z) + 0.04;
    pos.push(side * r * Math.cos(a), HUB + r * Math.sin(a), z); uv.push(i / nz, PADV + (1 - PADV) * (j / na));
  }
  for (let i = 0; i < nz; i++) for (let j = 0; j < na; j++) {
    const a = i * (na + 1) + j, b = a + 1, c = a + na + 1, d = c + 1;
    if (side > 0) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);   // wound to face outward on either side
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** The band's canvas: 1024 x 128 for 43 ft by 2.8 ft (and the 8 rows of white under it). Windows up the top, a navy stripe along the bottom with the LEDs running along it; everything else transparent. */
/** The canvas is BH rows of band and PAD rows of opaque white below them: the lights' vertices all point at a texel in that strip, so they draw in the band's own mesh (one call). */
const BW = 1024, BH = 128, PAD = 8, CH = BH + PAD, BZ0 = -29, BZ1 = 14, BA0 = -0.12, BA1 = 0.52, PADV = PAD / CH;
function paintBand(ctx: CanvasRenderingContext2D, t: number, night: number) {
  ctx.clearRect(0, 0, BW, CH);
  ctx.fillStyle = "#fff"; ctx.fillRect(0, BH, BW, PAD);   // the strip the lights' vertices sample: opaque white, so the vertex colour is the colour
  const px = BW / (BZ1 - BZ0), lit = night > 0.3;
  // the cheat line: navy, a shade lighter by night so it is not the darkest thing on the plane
  ctx.fillStyle = lit ? "#2a3f8a" : "#1d2f6f"; ctx.fillRect(0, BH * 0.64, BW, BH * 0.36);
  // the windows, every 2.2 ft from behind the cockpit, dark glass by day and warm light at night, each a little off the others
  for (let z = BZ0 + 5; z < BZ1 - 1; z += 2.2) {
    const x = (z - BZ0) * px, k = 0.82 + 0.18 * Math.sin(t * 2.3 + z * 1.7);
    ctx.fillStyle = lit ? `rgba(255, ${Math.round(205 + 20 * k)}, ${Math.round(110 + 40 * k)}, ${0.7 + 0.3 * k})` : "#26304a";
    ctx.beginPath(); ctx.roundRect(x - 0.4 * px, BH * 0.12, 0.8 * px, BH * 0.4, 6); ctx.fill();
    if (!lit) { ctx.fillStyle = "rgba(255,255,255,.22)"; ctx.fillRect(x - 0.3 * px, BH * 0.15, 0.2 * px, BH * 0.14); }
  }
  // the LEDs run along the stripe: a hue that travels with the time, each with a white twinkle
  for (let i = 0; i < 78; i++) {
    const x = (i + 0.5) * (BW / 78), y = BH * 0.82;
    ctx.fillStyle = `hsl(${(i * 14 + t * 240) % 360}, 100%, ${55 + 15 * night}%)`; ctx.beginPath(); ctx.arc(x, y, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(255,255,255,${0.25 + 0.35 * Math.abs(Math.sin(t * 3 + i * 2.1))})`; ctx.beginPath(); ctx.arc(x, y, 2.4, 0, Math.PI * 2); ctx.fill();
  }
}

export function bigImagination(): Jumbo {
  const group = new THREE.Group();
  const parts: Part[] = [];

  // ── the fuselage: a lathe along z, white above and navy below (the belly), the cockpit's glass at the nose, the upper deck's hump
  const prof: THREE.Vector2[] = [];
  for (let z = NOSE; z <= TAIL; z += 1.5) prof.push(new THREE.Vector2(radius(z), z));
  prof.push(new THREE.Vector2(0.1, TAIL + 0.2));
  const hull = (phi0: number) => new THREE.LatheGeometry(prof, 12, phi0, Math.PI).rotateX(Math.PI / 2).translate(0, HUB, 0);
  parts.push({ geo: hull(Math.PI / 2), color: WHITE }, { geo: hull(-Math.PI / 2), color: NAVY });
  parts.push(P(new THREE.SphereGeometry(1, 14, 8), WHITE, { sx: 2.5, sy: 2.4, sz: 10.5, y: HUB + 3.1, z: -17.5 }));
  parts.push(P(new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), GLASS, { sx: 2.3, sy: 1.5, sz: 2.2, y: HUB + 2.4, z: -27.6 }));
  parts.push(P(new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), GLASS, { sx: 1.7, sy: 0.7, sz: 1.7, y: HUB + 5.1, z: -23 }));

  // ── the wings (swept back about 35 degrees, the drawing's outline), their flaps, the tailplanes, the fin
  for (const s of [-1, 1]) {
    const w = (pts: [number, number][]) => pts.map(([x, z]): [number, number] => [s * x, z]);
    parts.push({ geo: plate(w([[4, -5], [31, 17], [31, 21], [4, 12]]), 0.9, HUB - 2.7), color: WHITE });
    parts.push({ geo: plate(w([[4, 7], [31, 19.6], [31, 21], [4, 12]]), 0.12, HUB - 1.8), color: SHADE });
    parts.push({ geo: plate(w([[1, 22], [13, 29], [13, 31.5], [1, 29]]), 0.5, HUB + 0.9), color: WHITE });
    // the engines: the Golden Ticket's pod profile stretched into a nacelle, slung under the leading edge, a dark intake at the front
    for (const [x, z] of [[11, 0.2], [21, 8.7]] as const) {
      const pod = [[0.05, -2.3], [1.3, -1.9], [2.0, -0.9], [2.25, 0.3], [2.05, 1.3], [1.75, 1.5]].map(([r, y]) => new THREE.Vector2(r, y * 2.6 - 0.2));
      parts.push(P(new THREE.LatheGeometry(pod, 18), NACELLE, { rx: -Math.PI / 2, x: s * x, y: HUB - 4.2, z }));
      parts.push({ geo: new THREE.CircleGeometry(1.74, 18).rotateY(Math.PI).translate(s * x, HUB - 4.2, z - 3.62), color: INTAKE });
      parts.push(P(cyl(0.18, 1.7, 6), STRUT, { x: s * x, y: HUB - 2.7, z: z - 0.6 }));
    }
  }
  parts.push({ geo: fin([[8, 13.2], [22, 30], [28, 30], [30.5, 10.4]], 0.9), color: BLUE });
  parts.push(P(new THREE.BoxGeometry(1, 3.4, 3), 0xffd27a, { y: 26, z: 25 }));   // the logo's gold block, as the drawing has it

  // ── the trailer: a flatbed under the fuselage, the cradles it sits in, a gooseneck and the wheels (three axles of duals at the rear, a dolly at the front)
  const wheels: Part[] = [];
  parts.push(P(new THREE.BoxGeometry(11.6, 1, 62), DECK, { y: 4.3, z: -0.5 }), P(new THREE.BoxGeometry(10.6, 0.9, 58), 0x1b1f3b, { y: 3.4, z: 0 }));
  for (const z of [-12, 2, 14]) parts.push(P(new THREE.BoxGeometry(6, 1.8, 3.2), STRUT, { y: 5.7, z }));
  parts.push(P(new THREE.BoxGeometry(7, 1.6, 6), DECK, { y: 5.4, z: -29 }));
  for (const z of [-24, 18, 22.5, 27]) for (const s of [-1, 1]) for (const d of z < 0 ? [0] : [-0.95, 0.95]) {
    wheels.push(P(cyl(2.1, 1.7, 14), TYRE, { rz: Math.PI / 2, x: s * (4.8 + d), y: 2.1, z }), P(cyl(1.2, 1.78, 10), 0xc7ccd6, { rz: Math.PI / 2, x: s * (4.8 + d), y: 2.1, z }));
  }
  const trailer = mergedParts([...parts, ...wheels].map((p) => (p.geo.index ? { ...p, geo: p.geo.toNonIndexed() } : p)));   // the extruded plates have no index: all or none
  group.add(trailer);

  // ── the livery band: both sides of the fuselage, the same canvas; and the lights: wingtips (red left, green right) and the spine's beacon, three spheres whose vertex colours are
  // repainted. They share the band's mesh (one draw call fewer): their vertices all point at the white strip under the band, so the texture is white there and the vertex colour shows.
  const c = document.createElement("canvas"); c.width = BW; c.height = CH;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const ctx = c.getContext("2d")!;
  const bands = mergeGeometries([band(1, BZ0, BZ1, BA0, BA1), band(-1, BZ0, BZ1, BA0, BA1)])!;
  bands.deleteAttribute("normal");
  bands.setAttribute("color", new THREE.BufferAttribute(new Float32Array(bands.getAttribute("position").count * 3).fill(1), 3));
  const lampGeos = [[-31, HUB - 1.6, 20.4], [31, HUB - 1.6, 20.4], [0, HUB + 5.0, 12]].map(([x, y, z]) => {
    const g = new THREE.SphereGeometry(0.55, 8, 6).translate(x, y, z), n = g.getAttribute("position").count;
    g.deleteAttribute("normal"); g.deleteAttribute("uv");
    g.setAttribute("uv", new THREE.BufferAttribute(Float32Array.from({ length: n * 2 }, (_, i) => (i % 2 ? 1 - (BH + PAD / 2) / CH : 0.5)), 2));
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 3).fill(0.2), 3));
    return g;
  });
  const lamps = mergeGeometries(lampGeos)!, lampAt = bands.getAttribute("position").count;
  const bandMat = new THREE.MeshBasicMaterial({ map: tex, vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const livery = mergeGeometries([bands, lamps])!;
  group.add(new THREE.Mesh(livery, bandMat));
  const per = lamps.getAttribute("position").count / 3, lampCol = livery.getAttribute("color") as THREE.BufferAttribute, tmp = new THREE.Color();
  const setLamp = (i: number, hex: number, k: number) => { tmp.setHex(hex, THREE.SRGBColorSpace).multiplyScalar(k); for (let v = lampAt + i * per; v < lampAt + (i + 1) * per; v++) lampCol.setXYZ(v, tmp.r, tmp.g, tmp.b); };

  const paint = (t: number, night: number) => {
    paintBand(ctx, t, night); tex.needsUpdate = true;
    const on = night > 0.3, strobe = Math.sin(t * 9) > 0.6, beacon = Math.sin(t * 6) > 0;
    setLamp(0, 0xff3048, on ? (strobe ? 3 : 1.1) : 0.35); setLamp(1, 0x40ff7a, on ? (strobe ? 3 : 1.1) : 0.35); setLamp(2, 0xff2d2d, on ? (beacon ? 2.5 : 0.35) : 0.3);
    lampCol.needsUpdate = true;
  };
  paint(0, 0);
  group.userData.ticket = { group, paint };   // the same hook the Golden Ticket's group has: whoever moves the model repaints it through this
  return { group, paint, roof: HUB + RAD + 0.4 };
}
