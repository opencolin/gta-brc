import * as THREE from "three";
import type { Spot } from "@/lib/playa";
import { yawOf } from "@/lib/view3d";
import { G, blob, glowMesh, rod, type GlowPart } from "./critters";

/**
 * The real pieces behind the art places' crystals (asked 2026-11-03: "go through each of the art pieces with a diamond and see if you can find
 * photos to use to create a model of the actual art piece"), each from photos and the artists' own descriptions, at about its real size in feet:
 * one mesh and one draw call a piece, in its colours, lit at night (critters.ts glowMesh). Like the crystals they replace, you drive through them
 * (the sim has no obstacle there). The places that are performances (the orchestras, the bands, the Man's and the Temple's sets) keep their crystals.
 * In its own frame a piece's front, -Z, faces the Man.
 */
type Build = () => GlowPart[];
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const box = (w: number, h: number, d: number, color: number, o: Parameters<typeof G>[2] = {}, glow = 0) => G(new THREE.BoxGeometry(w, h, d), color, o, glow);
const cyl = (rt: number, rb: number, h: number, color: number, o: Parameters<typeof G>[2] = {}, glow = 0, seg = 10) => G(new THREE.CylinderGeometry(rt, rb, h, seg), color, o, glow);
const hue = (h: number, l = 0.6) => new THREE.Color().setHSL(h, 1, l).getHex();

const BUILDS: Record<string, Build> = {
  // Aaron Taylor Kuffner's robotic gamelan: carved red-and-gold frames in an arc, bronze hanging gongs, a row of kettle gongs, each with its mallet
  gamelatron: () => {
    const p: GlowPart[] = [box(34, 0.4, 20, 0x7a2a2a, { y: 0.2 })];
    for (let k = 0; k < 5; k++) {
      const a = -0.8 + k * 0.4, x = Math.sin(a) * 14, z = -Math.cos(a) * 14 + 8;
      p.push(box(0.6, 8, 0.6, 0x8b1a1a, { x: x - 2.2, y: 4, z }), box(0.6, 8, 0.6, 0x8b1a1a, { x: x + 2.2, y: 4, z }), box(5.8, 1, 0.8, 0xc9a227, { x, y: 8.2, z }, 0.3));
      p.push(G(new THREE.CylinderGeometry(1.6, 1.6, 0.3, 18), 0xb08d57, { rx: Math.PI / 2, ry: -a, x, y: 4.6, z }, 0.15), blob(0.4, 0.4, 0.3, x, 4.6, z - 0.3, 0x8a6a3a));
    }
    for (let k = 0; k < 10; k++) p.push(blob(0.7, 0.45, 0.7, -6.3 + k * 1.4, 2.4, 2, 0xb08d57, 0.15, 10, 5), box(0.15, 0.15, 1.6, 0x2a2a2a, { x: -6.3 + k * 1.4, y: 3.3, z: 2.6 }));
    p.push(box(15, 2, 2.4, 0x8b1a1a, { y: 1, z: 2 }));
    return p;
  },
  // William Close's Earth Harp: a wooden resonator on a low stage and long golden strings fanning up to an anchor pole 150 ft off
  "earth-harp": () => {
    const p: GlowPart[] = [box(20, 2, 14, 0x6e4b2e, { y: 1 }), box(8, 8, 4, 0xa0703c, { y: 6, z: 2 }), cyl(0.8, 1.2, 46, 0x6b5a48, { y: 23, z: 150 })];
    for (let k = 0; k < 16; k++) p.push(rod(V(-3 + k * 0.4, 9.5, 2), V(-5 + k * 0.67, 44, 150), 0.12, 0.12, 0xd4af37, 0.9, 4));
    return p;
  },
  // Rob Jensen and Warren Trezevant's Sonic Runway: a corridor of light gates 18 ft wide and 13 tall, 30 ft apart, running away from the Man, lights racing down it at the speed of sound
  "sonic-runway": () => {
    const p: GlowPart[] = [box(10, 3, 8, 0x2a2d3a, { y: 1.5, z: -10 })];
    for (let k = 0; k < 20; k++) {
      const z = k * 30, c = hue(k / 20);
      p.push(G(new THREE.TorusGeometry(9, 0.35, 4, 18, Math.PI), c, { y: 4, z }, 1), box(0.6, 4, 0.6, 0x808080, { x: -9, y: 2, z }), box(0.6, 4, 0.6, 0x808080, { x: 9, y: 2, z }));
      for (let s = 1; s < 6; s++) { const a = (s / 6) * Math.PI; p.push(rod(V(0, 4, z), V(Math.cos(a) * 9, 4 + Math.sin(a) * 9, z), 0.12, 0.12, c, 1, 3)); }
    }
    return p;
  },
  // the Folly Builders' The Folly: a shanty village of crooked reclaimed-wood towers, linked by bridges, huts round a plaza
  "the-folly": () => {
    const p: GlowPart[] = [];
    const towers = [[-22, -18, 52], [8, -24, 68], [26, -4, 44], [18, 22, 58], [-12, 24, 36], [-28, 6, 40], [0, 0, 30]];
    const wood = [0x8a6e4b, 0x5c4632, 0x7a5f40, 0x6d5338];
    towers.forEach(([x, z, h], i) => {
      const w = 10 + (i % 3) * 2, lean = ((i % 2) * 2 - 1) * 0.04;
      p.push(box(w, h, w, wood[i % 4], { x, y: h / 2, z, rz: lean }, 0.05));
      p.push(G(new THREE.ConeGeometry(w * 0.8, 9, 4), 0x4a3a2a, { ry: Math.PI / 4 + i * 0.2, x: x - lean * h, y: h + 4.5, z, rz: lean * 2 }));
      for (let f = 1; f < h / 12; f++) p.push(box(2, 2.4, 0.3, 0xffcf7a, { x: x + 1.5, y: f * 12, z: z - w / 2 - 0.2 }, 1.2));
    });
    for (let i = 0; i < towers.length - 1; i++) { const [ax, az] = towers[i], [bx, bz] = towers[i + 1]; p.push(rod(V(ax, 26, az), V(bx, 26, bz), 0.6, 0.6, 0x5c4632, 0, 4)); }
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + 0.3; p.push(box(8, 9, 6, wood[(k + 1) % 4], { x: Math.cos(a) * 42, y: 4.5, z: Math.sin(a) * 42, ry: -a }), box(9, 1.5, 7, 0x3a2d22, { x: Math.cos(a) * 42, y: 9.6, z: Math.sin(a) * 42, ry: -a })); }
    return p;
  },
  // the Folly Builders' Paradisium: a triangular grove of 27 faceted wooden trees in three heights, their hexagonal crowns meeting in a canopy, four pods
  paradisium: () => {
    const p: GlowPart[] = [];
    let k = 0;
    for (let row = 0; row < 7; row++) for (let col = 0; col <= row; col++) {
      if (k >= 27) break;
      const x = (col - row / 2) * 18, z = -50 + row * 16, h = [15, 22, 32][k % 3 === 0 ? 2 : k % 3 === 1 ? 0 : 1], c = [0x9c6b43, 0x6e4b2e, 0xb07d50][k % 3];
      p.push(cyl(1.4, 1.8, h, c, { x, y: h / 2, z }, 0, 6), G(new THREE.CylinderGeometry(7, 1.5, 7, 6), c, { x, y: h + 3.5, z }, 0.15));
      k++;
    }
    for (const [x, z] of [[-30, 50], [30, 50], [0, -66], [0, 64]]) p.push(blob(5, 4, 5, x, 3, z, 0x8a5e3a, 0.4, 8, 5));
    return p;
  },
  // the ConeCophony Collective's Coney McConeface: a traffic cone 58 ft tall on its black base, two reflective bands, steam round its foot
  "coney-mcconeface": () => [
    box(28, 3, 28, 0x1b1b1b, { y: 1.5 }), cyl(2, 12.5, 55, 0xff6a13, { y: 30.5 }, 0.35, 24),
    cyl(5.6, 6.6, 6, 0xd9d9d9, { y: 40 }, 0.8, 24), cyl(8.7, 9.8, 6, 0xd9d9d9, { y: 25 }, 0.8, 24),
    ...[0, 1, 2, 3].map((i) => blob(4, 3, 4, Math.cos(i * 1.6) * 15, 4, Math.sin(i * 1.6) * 15, 0xf2f2f2, 0.2, 8, 5)),
  ],
  // Leeroy New's Mebuyan: six spheres skinned in water jugs and fluorescent bottles, raised in a cluster on legs, a glowing orb on the ground under them
  mebuyan: () => {
    const p: GlowPart[] = [blob(4, 4, 4, 0, 4, 0, 0xc6ffb0, 1.2)];
    const balls = [[0, 20, 0, 9], [-14, 18, -6, 6], [13, 19, -5, 7], [-8, 17, 13, 5], [10, 17, 12, 6], [0, 26, -16, 4.5]];
    for (const [x, y, z, r] of balls) { p.push(blob(r, r, r, x, y, z, 0x7cff4f, 0.9, 14, 10)); p.push(rod(V(x, y - r, z), V(x * 1.2, 0, z * 1.2), 0.5, 0.7, 0xc9a66b, 0, 5)); }
    for (let i = 0; i < balls.length - 1; i++) { const [ax, ay, az] = balls[i], [bx, by, bz] = balls[i + 1]; p.push(rod(V(ax, ay, az), V(bx, by, bz), 1.2, 1.2, 0x9be37a, 0.6, 6)); }
    return p;
  },
  // Proyecto GAM's Etznab, the temple of mirrors: a mirrored totem in two rings, four mirror monoliths at the cardinal points
  etznab: () => {
    const p: GlowPart[] = [cyl(30, 30, 0.6, 0x2a2a2e, { y: 0.3 }, 0, 32), cyl(14, 14, 1.2, 0x1a1a1a, { y: 0.6 }, 0, 24), box(6, 26, 6, 0xc8ccd6, { y: 13 }, 0.7), G(new THREE.ConeGeometry(4.2, 6, 4), 0xe6e9f0, { ry: Math.PI / 4, y: 29 }, 0.9)];
    for (let k = 0; k < 4; k++) { const a = (k * Math.PI) / 2; p.push(box(4, 12, 1.5, 0xb8bdc8, { x: Math.sin(a) * 24, y: 6, z: Math.cos(a) * 24, ry: a }, 0.6)); }
    return p;
  },
  // Choo Choo Camp's Singularity Tree: a trunk of bundled steel tubes, forking branches strung with LED vines, a glowing core
  "singularity-tree": () => {
    const p: GlowPart[] = [cyl(5, 7, 2, 0x5a5a5a, { y: 1 })];
    for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; p.push(rod(V(Math.cos(a) * 2.5, 0, Math.sin(a) * 2.5), V(Math.cos(a) * 0.8, 18, Math.sin(a) * 0.8), 0.7, 0.5, 0x8c8c8c, 0, 6)); }
    p.push(blob(3, 3, 3, 0, 19, 0, 0x9ff7ff, 1.4));
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2, b = V(Math.cos(a) * 12, 29, Math.sin(a) * 12);
      p.push(rod(V(0, 18, 0), b, 0.6, 0.35, 0xb87333, 0, 5));
      for (const s of [-0.4, 0.4]) { const c = V(Math.cos(a + s) * 19, 36, Math.sin(a + s) * 19); p.push(rod(b, c, 0.3, 0.15, 0xb87333, 0, 4), rod(V(0, 18.5, 0), c, 0.08, 0.08, [0x39ff88, 0x29d8ff, 0xb46bff][k % 3], 1.3, 3)); }
    }
    return p;
  },
  // Konoon Studio's Zhina: rows of tall deep-red banners, painted with messages, on poles in curving rows round a closed heart
  "zhina-art-project": () => {
    const p: GlowPart[] = [];
    for (let ring = 0; ring < 3; ring++) for (let k = 0; k < 10 + ring * 4; k++) {
      const a = (k / (10 + ring * 4)) * Math.PI * 2 + ring * 0.2, r = 14 + ring * 11, x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (ring === 2 && Math.abs(Math.sin(a)) < 0.12 && Math.cos(a) < 0) continue;   // a way in
      p.push(box(0.3, 15, 0.3, 0x2a2a2a, { x, y: 7.5, z }), box(4, 13, 0.15, 0xb0121b, { x: x + Math.sin(a) * 2, y: 8.5, z: z - Math.cos(a) * 2, ry: -a + Math.PI / 2, rz: 0.06 }, 0.5));
    }
    return p;
  },
  // Capra J'neva's Aeolian Pyrophonic Hall: a lattice hall casting dappled light, a wind harp on its ridge, a fire organ's pipes, the whispering wall
  "aeolian-pyrophonic-hall": () => {
    const p: GlowPart[] = [];
    for (let k = 0; k <= 8; k++) { const z = -20 + k * 5; p.push(box(0.8, 14, 0.8, 0xa07850, { x: -10, y: 7, z }), box(0.8, 14, 0.8, 0xa07850, { x: 10, y: 7, z }), rod(V(-10, 14, z), V(0, 21, z), 0.4, 0.4, 0xa07850, 0, 4), rod(V(10, 14, z), V(0, 21, z), 0.4, 0.4, 0xa07850, 0, 4)); }
    for (let k = 0; k < 6; k++) { p.push(box(0.4, 0.4, 40, 0x8a6440, { x: -10, y: 2 + k * 2.4, z: 0 }), box(0.4, 0.4, 40, 0x8a6440, { x: 10, y: 2 + k * 2.4, z: 0 })); }
    for (let k = 0; k < 9; k++) p.push(rod(V(0, 21.5, -20), V(0, 21.5, 20), 0.05, 0.05, 0xd8d0c0, 0.4, 3));
    for (let k = 0; k < 12; k++) { const h = 4 + k * 0.75; p.push(cyl(0.45, 0.45, h, 0x6f6f6f, { x: -6 + k * 1.1, y: h / 2, z: 26 }), blob(0.6, 1.2, 0.6, -6 + k * 1.1, h + 1, 26, 0xff8a2a, 1.6, 6, 4)); }
    p.push(G(new THREE.CylinderGeometry(16, 16, 8, 16, 1, true, -0.8, 1.6), 0xb89a70, { y: 4, z: -40 }));
    return p;
  },
  // Christopher Schardt's Firmament: a dome of 21,600 LEDs 52 ft across hung from a black steel frame, people lying on the playa under it
  firmament: () => {
    const p: GlowPart[] = [];
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      p.push(rod(V(Math.cos(a) * 26, 0, Math.sin(a) * 26), V(Math.cos(a) * 26, 12, Math.sin(a) * 26), 0.3, 0.3, 0x1b1b1b, 0, 4));
      let prev = V(Math.cos(a) * 26, 12, Math.sin(a) * 26);
      for (let s = 1; s <= 6; s++) { const f = s / 6, r = 26 * Math.cos(f * Math.PI / 2), q = V(Math.cos(a) * r, 12 + 30 * Math.sin(f * Math.PI / 2), Math.sin(a) * r); p.push(rod(prev, q, 0.18, 0.18, hue((k / 12 + f * 0.3) % 1), 1.3, 3)); prev = q; }
    }
    for (const [r, y] of [[24, 24], [17, 35], [9, 40.5]]) p.push(G(new THREE.TorusGeometry(r, 0.2, 3, 32), 0x7fd3ff, { rx: Math.PI / 2, y }, 1.2));
    return p;
  },
  // Jade Fusco's Aquarian Shrine: a two-tailed water nymph lying in two great cupped hands on a plinth
  "aquarian-shrine": () => [
    box(14, 2, 10, 0x2f6f73, { y: 1 }),
    blob(3.4, 2, 4.4, -2.6, 5, 0, 0x3fb8af, 0.3), blob(3.4, 2, 4.4, 2.6, 5, 0, 0x3fb8af, 0.3),   // the palms
    ...[-1, 1].flatMap((s) => [0, 1, 2, 3].map((k) => rod(V(s * (4 + k * 0.2), 5.5, -2.4 + k * 1.6), V(s * (6.4 + k * 0.2), 9, -2.6 + k * 1.7), 0.55, 0.45, 0x3fb8af, 0.3, 6))),   // fingers curling up
    blob(1.3, 1.6, 3.4, 0, 7.6, -0.4, 0xe0b48c), blob(1, 1, 1, 0, 8.4, -3.6, 0xe0b48c), blob(1.4, 0.9, 1.6, 0, 9, -4.4, 0x2a9d8f, 0.4),   // her body, head and hair
    rod(V(-0.4, 7, 2.6), V(-2.6, 8.4, 6.4), 0.7, 0.2, 0x2a9d8f, 0.5, 6), rod(V(0.4, 7, 2.6), V(2.6, 8.4, 6.4), 0.7, 0.2, 0x2a9d8f, 0.5, 6),   // two tails
  ],
  // Tyson Ayers's Shrine of Sympathetic Resonance: a round shrine walled with ninety gold piano harps under a dome and finial, 38 ft tall, 50 across
  "shrine-of-sympathetic-resonance": () => {
    const p: GlowPart[] = [cyl(25, 25, 1, 0x5a4632, { y: 0.5 }, 0, 30)];
    for (let tier = 0; tier < 2; tier++) for (let k = 0; k < 20; k++) {
      if (tier === 0 && k % 5 === 0) continue;   // the arched ways in
      const a = (k / 20) * Math.PI * 2, r = 22 - tier * 3;
      p.push(box(6.4, 7.5, 0.6, 0xc9a227, { x: Math.sin(a) * r, y: 4.5 + tier * 8, z: Math.cos(a) * r, ry: a }, 0.55));
    }
    p.push(G(new THREE.SphereGeometry(19, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0x8a6a2a, { sy: 0.6, y: 20 }, 0.2), cyl(0.5, 1.4, 9, 0xc9a227, { y: 35 }, 0.6), blob(1.4, 1.4, 1.4, 0, 39.5, 0, 0xffd27a, 1.2));
    return p;
  },
  // Outline Creative Lab's Aluna: a golden body of interlocking planes sitting on its own reflection, water trays at hand height, the cymatic image above
  "aluna-the-frequency-of-being": () => {
    const p: GlowPart[] = [cyl(13, 13, 0.4, 0x8fb8d8, { y: 0.2 }, 0.5, 30)];
    for (let k = 0; k < 4; k++) p.push(G(new THREE.CylinderGeometry(8, 8, 0.6, 20, 1, false, 0, Math.PI), 0xd4a93c, { rx: Math.PI / 2, ry: (k * Math.PI) / 4, y: 0.5 }, 0.4));
    for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; p.push(cyl(1.6, 1.2, 3.6, 0xb08a2c, { x: Math.cos(a) * 9, y: 1.8, z: Math.sin(a) * 9 }), cyl(1.5, 1.5, 0.2, 0x6fd3ff, { x: Math.cos(a) * 9, y: 3.7, z: Math.sin(a) * 9 }, 1.2)); }
    p.push(G(new THREE.CylinderGeometry(2.6, 2.6, 0.3, 20), 0xa8f0ff, { rx: Math.PI / 2, y: 13 }, 1.6));
    return p;
  },
  // the Fire Organ of 2007: a rank of steel pipes on a plinth with the keyboard in front, flames at their tops
  "fire-organ": () => {
    const p: GlowPart[] = [box(16, 2, 6, 0x3a3a3a, { y: 1 }), box(6, 3.4, 2, 0x2a2a2a, { y: 1.7, z: -5 })];
    for (let k = 0; k < 13; k++) { const h = 15 - Math.abs(k - 6) * 1.6, x = -7.2 + k * 1.2; p.push(cyl(0.5, 0.5, h, 0x5a5a5a, { x, y: 2 + h / 2 }), blob(0.6, 1.6, 0.6, x, 2 + h + 1.2, 0, 0xff7a1a, 1.8, 6, 4)); }
    return p;
  },
  // Geordie Van Der Bosch's Temple of Direction: a tunnel of plain pine torii gates on the 12-6 line, rising to a great hall in the middle, 180 ft long
  "temple-of-direction": () => {
    const p: GlowPart[] = [];
    for (let k = 0; k <= 44; k++) {
      const z = -90 + k * (180 / 44), f = 1 - Math.abs(z) / 90, h = 12 + 24 * f * f, w = 12 + 20 * f * f;
      p.push(box(1.2, h, 1.2, 0xc9a77c, { x: -w / 2, y: h / 2, z }), box(1.2, h, 1.2, 0xc9a77c, { x: w / 2, y: h / 2, z }), box(w + 6, 1.2, 1.6, 0xd8b88a, { y: h + 0.6, z }), box(w, 0.8, 1, 0xb8956a, { y: h - 2.4, z }));
      if (k % 4 === 2) p.push(blob(0.6, 0.9, 0.6, 0, h - 4, z, 0xffc66b, 1.6, 6, 4));
    }
    return p;
  },
  // Renzo Verbeck's Temple Empyrean: an eight-pointed star, a canopied wing sloping up from each point to the hall, portals round it, a lantern flame atop the spire
  "temple-empyrean": () => {
    const p: GlowPart[] = [];
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2, s = Math.sin(a), c = Math.cos(a);
      p.push(G(new THREE.ConeGeometry(14, 40, 4), 0xcfa875, { rx: Math.PI / 2 - 0.5, ry: -a, x: s * 34, y: 14, z: c * 34, sz: 0.4 }, 0.25));
      p.push(box(2, 22, 2, 0xb89060, { x: Math.sin(a + 0.39) * 62 - 4 * Math.cos(a), y: 11, z: Math.cos(a + 0.39) * 62 }), box(2, 22, 2, 0xb89060, { x: Math.sin(a + 0.39) * 62 + 4 * Math.cos(a), y: 11, z: Math.cos(a + 0.39) * 62 }), box(12, 2.4, 2.4, 0xcfa875, { x: Math.sin(a + 0.39) * 62, y: 23, z: Math.cos(a + 0.39) * 62, ry: a + 0.39 + Math.PI / 2 }));
    }
    p.push(G(new THREE.CylinderGeometry(14, 18, 24, 8), 0xd8b888, { y: 12 }, 0.2), G(new THREE.ConeGeometry(12, 32, 8), 0xcfa875, { y: 40 }, 0.2), blob(1.6, 2.6, 1.6, 0, 58, 0, 0xffa53a, 1.8, 8, 5));
    return p;
  },
  // Arthur Mamou-Mani's Galaxia: twenty timber trusses from a ring 197 ft across, curving the same way round and thinning as they rise to one peak 66 ft up
  "temple-of-galaxia": () => {
    const p: GlowPart[] = [G(new THREE.CylinderGeometry(4, 4, 6, 12), 0xf4f4f4, { y: 3 }, 0.6)];
    for (let k = 0; k < 20; k++) {
      const a0 = (k / 20) * Math.PI * 2;
      let prev = V(Math.cos(a0) * 98, 0, Math.sin(a0) * 98);
      for (let s = 1; s <= 8; s++) {
        const f = s / 8, r = 98 * (1 - f), a = a0 + f * 1.6, q = V(Math.cos(a) * r, 66 * Math.sin(f * Math.PI / 2), Math.sin(a) * r);
        p.push(rod(prev, q, 2.4 * (1 - f * 0.7) + 0.4, 2.4 * (1 - (f + 0.125) * 0.7) + 0.3, 0xd2b48c, 0.15, 3));
        prev = q;
      }
      p.push(box(8, 7, 6, 0xc4a47a, { x: Math.cos(a0) * 94, y: 3.5, z: Math.sin(a0) * 94, ry: -a0 }));
    }
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; p.push(blob(1.6, 2.4, 1.6, Math.cos(a) * 22, 30, Math.sin(a) * 22, 0xfff3d0, 1.4, 8, 5)); }
    return p;
  },
};
/** The art places that have a model of their own (the rest keep their crystals, stages.ts). */
export const MODELLED = new Set(Object.keys(BUILDS));

/** How far off a piece is still drawn. */
const SHOW = 4500;
export type ArtPlaceMeshes = { group: THREE.Group; update(cx: number, cz: number): void };
export function buildArtPlaces(group: THREE.Group, spots: Spot[]): ArtPlaceMeshes {
  const placed = spots.filter((s) => s.camp && MODELLED.has(s.camp.id)).map((s) => {
    const mesh = glowMesh(BUILDS[s.camp!.id]());
    mesh.position.set(s.stage.x, 0, s.stage.y);
    mesh.rotation.y = yawOf(Math.atan2(-s.stage.x, s.stage.y));   // its front (-Z) toward the Man
    group.add(mesh);
    return { s, mesh };
  });
  return {
    group,
    update(cx, cz) { for (const { s, mesh } of placed) mesh.visible = Math.hypot(s.stage.x - cx, s.stage.y - cz) < SHOW; },
  };
}
