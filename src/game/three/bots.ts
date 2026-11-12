import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * The bots that stand in for every person (asked 2026-11-11: "let's swap all the humans for bot avatars", libraries.dev/bots): a puffy plastic shape, a
 * rounded extrusion of its outline (a clover, a flower, a ghost, a square, a star, a blob), each in its own colour, with two dark oval eyes on its face.
 * `botParts` gives the body and the eyes as shapes for a caller to merge, upright, facing -Z, centred where it is told and `size` feet tall.
 */
export type BotType = "clover" | "flower" | "ghost" | "square" | "star" | "blob";
export const BOT_TYPES: readonly BotType[] = ["clover", "flower", "ghost", "square", "star", "blob"];
/** Each shape's own colour, as the library has them: the clover blue, the flower green, the ghost white, the square pink, the star yellow, the blob orange. */
export const BOT_COLOR: Record<BotType, number> = { clover: 0x2aa6ff, flower: 0x22d36a, ghost: 0xf3f3f7, square: 0xe455c8, star: 0xffc52a, blob: 0xff8a3d };
const EYE = 0x161a2e, N = 28;

/** The outline, about 1 across and 1 tall round the origin. */
function outline(type: BotType): THREE.Shape {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    let x: number, y: number;
    if (type === "square") { const p = 4, k = 1 / Math.pow(Math.pow(Math.abs(c), p) + Math.pow(Math.abs(s), p), 1 / p); x = c * k * 0.5; y = s * k * 0.5; }
    else if (type === "ghost") { // a dome on top, three scallops along the hem
      if (s >= 0) { x = c * 0.46; y = 0.05 + s * 0.45; }
      else { const u = (a - Math.PI) / Math.PI; x = -0.46 + u * 0.92; y = -0.42 + 0.07 * Math.abs(Math.sin(u * Math.PI * 3)); if (u <= 0.02 || u >= 0.98) y = Math.max(y, -0.4); }
    } else {
      const r = type === "clover" ? 0.43 + 0.08 * Math.cos(4 * a) : type === "flower" ? 0.43 + 0.07 * Math.cos(5 * a + Math.PI / 2) : type === "star" ? 0.4 + 0.13 * Math.cos(5 * a + Math.PI / 2) : 0.46 + 0.04 * Math.cos(3 * a + 1);
      x = c * r; y = s * r;
    }
    pts.push(new THREE.Vector2(x, y));
  }
  return new THREE.Shape(pts);
}

const cache = new Map<BotType, THREE.BufferGeometry>();
/** The body, 1 tall: the outline extruded with a deep round bevel, so it is a pillow, its face toward -Z. */
function body(type: BotType): THREE.BufferGeometry {
  let g = cache.get(type);
  if (!g) {
    const e = new THREE.ExtrudeGeometry(outline(type), { depth: 0.16, bevelEnabled: true, bevelThickness: 0.17, bevelSize: 0.1, bevelSegments: 2, curveSegments: 4 });
    e.translate(0, 0, -0.08); e.rotateY(Math.PI); // its face toward -Z
    g = mergeVertices(e); g.computeVertexNormals(); e.dispose();
    cache.set(type, g);
  }
  return g.clone();
}

/** A bot's body and its eyes, `size` feet tall, centred at `at`, turned `yaw` about Y and leaning `lean` (radians, forward). */
export function botParts(type: BotType, at: THREE.Vector3, size: number, yaw = 0, lean = 0): { geo: THREE.BufferGeometry; color: number; body: boolean }[] {
  const place = (g: THREE.BufferGeometry) => g.scale(size, size, size).rotateX(-lean).rotateY(yaw).translate(at.x, at.y, at.z);
  const eyeY = type === "ghost" ? 0.14 : 0.06, front = -0.26;
  const eye = (sx: number) => { const g = new THREE.SphereGeometry(1, 8, 6); return g.scale(0.065, 0.1, 0.04).translate(sx, eyeY, front); };
  return [
    { geo: place(body(type)), color: BOT_COLOR[type], body: true },
    { geo: place(eye(-0.12)), color: EYE, body: false },
    { geo: place(eye(0.12)), color: EYE, body: false },
  ];
}
