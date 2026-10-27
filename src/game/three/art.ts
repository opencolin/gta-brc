import * as THREE from "three";
import { ART, type ArtPiece, type Game } from "@/lib/playa";
import { LAYER, hslHex } from "@/lib/scene3d";
import { glowing } from "./camps";
import { pieceDrawing, type Drawing } from "./decals";
import { mergedParts, shaped as P, type Part } from "./materials";

/**
 * The art on the open playa (PLAN-3D.md 2.3): each of the 23 pieces is its top-down drawing laid on the ground (a decal that animates
 * with the drawing) and a stand-in built from a few solid shapes, one mesh in the piece's colours that glows at night. They are
 * placeholders for real models (phase 7): each is a small function in STAND_INS and a piece with none gets an octahedron.
 * A piece shows within SHOW feet of the camera; its decal redraws at 10 Hz within LIVE feet.
 */
export type ArtMeshes = { group: THREE.Group; update(cam: THREE.Vector3, g: Game, night: number): void };
const SHOW = 4000, LIVE = 700;

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt: number, rb: number, h: number, seg = 10) => new THREE.CylinderGeometry(rt, rb, h, seg);
const ball = (r: number, w = 12, h = 8) => new THREE.SphereGeometry(r, w, h);
const dome = (r: number, w = 14) => new THREE.SphereGeometry(r, w, 6, 0, Math.PI * 2, 0, Math.PI / 2);
const deg = (d: number) => (d * Math.PI) / 180;
/** A rod from a to b. */
const rodP = (a: number[], b: number[], r: number, color: number): Part => {
  const A = new THREE.Vector3(...(a as [number, number, number])), B = new THREE.Vector3(...(b as [number, number, number])), d = B.clone().sub(A), g = cyl(r, r, d.length(), 6);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()));
  const m = A.clone().add(B).multiplyScalar(0.5);
  return { geo: g.translate(m.x, m.y, m.z), color };
};

type Build = (hue: number) => Part[];
const GREY = 0xdcdee3, RED = 0xd9283f;
/** A standing figure on a base, arms raised in a V: Bliss Dance, Truth Is Beauty, R-Evolution, Tara Mechani. */
const figure: Build = () => [
  P(box(20, 2, 20), 0x8a8f99, { y: 1 }), P(new THREE.CapsuleGeometry(6, 40, 4, 10), GREY, { y: 28 }),
  P(cyl(2, 2, 26), GREY, { x: 7, y: 47, rz: deg(-28) }), P(cyl(2, 2, 26), GREY, { x: -7, y: 47, rz: deg(28) }), P(ball(5.5), GREY, { y: 56 }),
];

const STAND_INS: Record<string, Build> = {
  "bliss-dance": figure, "truth-is-beauty": figure, "r-evolution": figure, "tara-mechani": figure,
  embrace: () => [P(cyl(8, 14, 60), 0xc9a36b, { x: -15, y: 30, rz: deg(-12) }), P(cyl(8, 14, 60), 0xc9a36b, { x: 15, y: 30, rz: deg(12) })],
  "real-love": () => [P(box(30, 4, 12), 0xb89f70, { y: 2 }), P(box(24, 20, 8), RED, { y: 14 }), P(new THREE.TorusGeometry(14, 1.5, 8, 24), 0xe8e6e0, { y: 16, z: -6 })],
  "the-orb": () => [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => rodP([sx * 34, 0, sz * 34], [sx * 20, 24, sz * 20], 1.4, 0x8a8f99)),   // the sphere itself is added in buildArt
  "big-rig-jig": () => [P(cyl(6, 6, 60), 0x8a8f99, { y: 24.6, rz: deg(35) }), P(cyl(6, 6, 60), 0x9aa0ab, { y: 24.6, rz: deg(-35) })],
  lodestar: () => [P(new THREE.ConeGeometry(10, 70, 12), 0xc9c2ae, { y: 37, rz: Math.PI }), P(box(34, 2, 5), 0xb8b19c, { y: 62, ry: 0.4 }), P(box(5, 2, 34), 0xb8b19c, { y: 60, ry: 0.4 })],
  "black-rock-observatory": () => [0, 1, 2].flatMap((k) => { const a = (k / 3) * Math.PI * 2, x = Math.cos(a) * 28, z = Math.sin(a) * 28; return [P(cyl(3, 3, 10), 0xa9a79f, { x, y: 5, z }), P(dome(18), 0xe8e6e0, { x, y: 10, z })]; }),
  "shrumen-lumen": (h) => [0, 1, 2, 3, 4].flatMap((k) => { const a = (k / 5) * Math.PI * 2 + 0.4, d = k ? 30 : 0, x = Math.cos(a) * d, z = Math.sin(a) * d, s = 0.8 + 0.12 * ((k * 3) % 5); return [P(cyl(3 * s, 4 * s, 14 * s), 0xf2e8d0, { x, y: 7 * s, z }), P(dome(16 * s), hslHex(h + k * 50, 85, 58), { x, y: 14 * s, z, sy: 0.7 })]; }),
  "elder-mother": () => tree(), "tree-of-tenere": () => tree(),
  muxalove: (h) => [...Array.from({ length: 8 }, (_, k) => { const a = (k / 8) * Math.PI * 2; return P(cyl(2, 2, 24), 0xe8dcc0, { x: Math.cos(a) * 40, y: 12, z: Math.sin(a) * 40 }); }), P(new THREE.TorusGeometry(40, 3, 6, 32), hslHex(h, 60, 55), { rx: Math.PI / 2, y: 24 })],
  "elemental-dragon": () => [P(ball(1), 0xb83a3a, { sx: 18, sy: 10, sz: 10, x: -22, y: 12, z: 6 }), P(ball(1), 0xc24545, { sx: 14, sy: 8, sz: 8, x: -2, y: 11, z: 0 }), P(ball(1), 0xb83a3a, { sx: 10, sy: 6, sz: 6, x: 16, y: 10, z: -4 }), P(new THREE.ConeGeometry(6, 16, 6), 0xd85a3a, { x: 31, y: 12, z: -6, rz: -Math.PI / 2 }), P(box(6, 14, 1), 0xff8a3c, { x: -2, y: 22, z: 0 })],
  "space-whale": () => [P(cyl(2, 2, 24, 6), 0x6b7390, { x: -16, y: 12 }), P(cyl(2, 2, 24, 6), 0x6b7390, { x: 16, y: 12 }), P(ball(1, 16, 10), 0x4a90c2, { sx: 40, sy: 14, sz: 16, y: 28 }), P(box(18, 3, 14), 0x3d7fb0, { x: -48, y: 34, rz: 0.4 })],
  "ursa-mater": () => [P(ball(1), 0x8a6d45, { sx: 24, sy: 16, sz: 14, y: 22 }), P(ball(9), 0x8a6d45, { x: 25, y: 28 }), ...[[-12, -7], [-12, 7], [12, -7], [12, 7]].map(([x, z]) => P(cyl(3, 3, 14, 6), 0x7a5d38, { x, y: 7, z }))],
  "penny-the-goose": () => [P(ball(1), 0xf6f1e6, { sx: 20, sy: 14, sz: 16, y: 18 }), P(cyl(2.5, 3, 30, 8), 0xf6f1e6, { x: 18, y: 36, rz: deg(-15) }), P(ball(6), 0xf6f1e6, { x: 23, y: 52 }), P(new THREE.ConeGeometry(2, 7, 6), 0xf0a02a, { x: 30, y: 51, rz: -Math.PI / 2 }), P(cyl(1, 1, 12, 5), 0xf0a02a, { x: -3, y: 6, z: -5 }), P(cyl(1, 1, 12, 5), 0xf0a02a, { x: -3, y: 6, z: 5 })],
  "fire-horse": () => [...[[-14, -3], [-14, 3], [14, -3], [14, 3]].map(([x, z]) => P(cyl(2, 2, 14, 6), 0x1c1c1c, { x, y: 7, z })), P(box(36, 18, 10), 0x2b2b2b, { y: 23 }), P(box(7, 22, 7), 0x2b2b2b, { x: 18, y: 38, rz: deg(-18) }), P(box(15, 7, 6), 0x2b2b2b, { x: 27, y: 49, rz: deg(-10) }), P(box(6, 16, 2), 0xff8a3c, { x: 12, y: 44, rz: deg(18) }), P(box(10, 4, 2), 0xff5a1f, { x: -20, y: 28 })],
  "medusa-madness": (h) => [...Array.from({ length: 8 }, (_, k) => { const a = (k / 8) * Math.PI * 2; return P(cyl(1, 1, 28, 6), 0x6b5a44, { x: Math.cos(a) * 23, y: 14, z: Math.sin(a) * 23 }); }), P(dome(26, 18), hslHex(h, 60, 55), { y: 28 }), ...Array.from({ length: 12 }, (_, k) => { const a = (k / 12) * Math.PI * 2; return P(cyl(0.6, 0.6, 20, 5), hslHex(h + k * 12, 70, 62), { x: Math.cos(a) * 19, y: 18, z: Math.sin(a) * 19 }); })],
  mariposa: (h) => [P(cyl(1.6, 1.6, 30, 6), 0x3a2f2f, { rx: Math.PI / 2, y: 20 }), P(new THREE.PlaneGeometry(40, 30), hslHex(h, 70, 60), { rx: -Math.PI / 2, rz: deg(22), x: -19, y: 24 }), P(new THREE.PlaneGeometry(40, 30), hslHex(h + 30, 70, 60), { rx: -Math.PI / 2, rz: deg(-22), x: 19, y: 24 })],
  "chapel-of-babel": () => [40, 33, 26, 20, 14].map((w, k) => P(box(w, 16, w), 0xc9b36a, { y: 8 + k * 16 })),
  "head-maze": () => [P(box(60, 24, 44), 0xd7c29a, { y: 12 }), P(box(40, 24, 2), 0xb89f70, { y: 12, z: 23 }), P(box(8, 6, 2), 0x8a6d45, { x: -10, y: 16, z: 24.2 }), P(box(8, 6, 2), 0x8a6d45, { x: 10, y: 16, z: 24.2 })],
};
/** A trunk and a round canopy: Elder Mother, the Tree of Tenere. */
function tree(): Part[] { return [P(cyl(4, 7, 40, 8), 0x5b4a35, { y: 20 }), P(ball(32, 14, 10), 0x8db36a, { y: 44, sy: 0.6 })]; }

/** The Orb's metal wants something to reflect: a sky and a floor of playa, as an environment map. */
function orbEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const c = document.createElement("canvas"); c.width = 256; c.height = 128;
  const x = c.getContext("2d")!, g = x.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, "#8ec5fc"); g.addColorStop(0.5, "#f6ead2"); g.addColorStop(0.51, "#e6d3ae"); g.addColorStop(1, "#c8b48c");
  x.fillStyle = g; x.fillRect(0, 0, 256, 128);
  const src = new THREE.CanvasTexture(c); src.colorSpace = THREE.SRGBColorSpace; src.mapping = THREE.EquirectangularReflectionMapping;
  const pm = new THREE.PMREMGenerator(renderer), env = pm.fromEquirectangular(src).texture;
  pm.dispose(); src.dispose();
  return env;
}

export function buildArt(scene: THREE.Scene, renderer: THREE.WebGLRenderer): ArtMeshes {
  const group = new THREE.Group();
  const body = glowing({ vertexColors: true, side: THREE.DoubleSide }, "glow-art", 0.45);
  const pieces = ART.map((a: ArtPiece) => {
    const g = new THREE.Group(); g.position.set(a.x, 0, a.y);
    const parts = (STAND_INS[a.id] ?? (() => [P(new THREE.OctahedronGeometry(a.r * 0.5), hslHex(a.hue, 60, 55), { y: a.r * 0.5 })]))(a.hue);
    const mesh = mergedParts(parts, body); g.add(mesh);
    let drawing: Drawing | null = null;
    const dr = pieceDrawing(a.id, a.r);
    if (dr) {
      drawing = dr;
      const decal = new THREE.Mesh(new THREE.PlaneGeometry(dr.w, dr.l).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: dr.tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: -LAYER.decal }));
      decal.position.y = 0.5; decal.renderOrder = LAYER.decal; g.add(decal);
    }
    group.add(g);
    return { a, g, drawing, last: -1 };
  });
  // the Orb: a mirror ball on four legs, metal that reflects the sky
  const orb = pieces.find((p) => p.a.id === "the-orb");
  if (orb) {
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(55, 32, 24), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.12, envMap: orbEnvironment(renderer), envMapIntensity: 1.1 }));
    sphere.position.y = 72; orb.g.add(sphere);
  }
  scene.add(group);
  return {
    group,
    update(cam, g, night) {
      for (const p of pieces) {
        const d = Math.hypot(p.a.x - cam.x, p.a.y - cam.z);
        p.g.visible = d < SHOW;
        // redraw an animated decal at 10 Hz while it is near; farther off it keeps the picture it was last drawn with, so at night a far piece still shows its day one until it comes within LIVE (phase 4: repaint once when night changes)
        if (p.drawing && d < LIVE && g.t - p.last > 0.1) { p.drawing.paint(g.t, night); p.last = g.t; }
      }
    },
  };
}
