import * as THREE from "three";
import { CAFE_R, CENTER_CAMP, MAN_R, TEMPLE, TEMPLE_R } from "@/lib/brc";
import { mergedParts, placed, type Part } from "./materials";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * The landmarks: the Man standing on his base, the Temple, Center Camp's striped café. The same drawings the top-down painter has
 * (PlayaWin's drawMan, drawTemple, the map's café), stood up: the Man's stick figure is drawMan's points with y turned into height and
 * everything ×1.3, so he is about 100 ft tall. Phase 2 adds the stages, bays and art; phase 7 may replace these with real models.
 */
export type PlaceMeshes = { group: THREE.Group; /** the Man glows neon at night (0 = day, 1 = night) */ update(night: number): void };

/** A rod from a to b: a cylinder lying along that line, already in place. */
function rod(a: THREE.Vector3, b: THREE.Vector3, r: number): THREE.BufferGeometry {
  const dir = b.clone().sub(a), g = new THREE.CylinderGeometry(r, r, dir.length(), 6);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()));
  const mid = a.clone().add(b).multiplyScalar(0.5);
  return g.translate(mid.x, mid.y, mid.z);
}

/** The Man: a base like a drum and the figure on it, arms up, in navy by day and glowing cyan at night (two meshes: the base, the figure). */
function man(group: THREE.Group): THREE.MeshLambertMaterial {
  const BASE = 6;
  group.add(mergedParts([{ geo: placed(new THREE.CylinderGeometry(MAN_R, MAN_R, BASE, 32), 0, BASE / 2, 0), color: 0xc8b48c }]));
  const glow = new THREE.MeshLambertMaterial({ color: 0x1b1f3b, emissive: 0x7df9ff, emissiveIntensity: 0 });
  // drawMan's points (y down, feet at y = 34) as (x·1.3, (34 − y)·1.3) above the base, in the X-Y plane
  const P = (x: number, h: number) => new THREE.Vector3(x, BASE + h, 0);
  const waist = P(0, 28.6), top = P(0, 83.2), shoulders = P(0, 67.6);
  const parts: [THREE.Vector3, THREE.Vector3][] = [[waist, top], [waist, P(-18.2, 0)], [waist, P(18.2, 0)], [shoulders, P(-28.6, 96.2)], [shoulders, P(28.6, 96.2)]];
  const head = P(0, 91);
  group.add(new THREE.Mesh(mergeGeometries([...parts.map(([a, b]) => rod(a, b, 1.5)), new THREE.SphereGeometry(7.8, 14, 10).translate(head.x, head.y, head.z)])!, glow));
  return glow;
}

/** The Temple: an eight-sided platform, a taller eight-sided tower in the middle and a pyramid roof on it, eight low walls reaching to the platform's corners (one mesh). */
function temple(group: THREE.Group): void {
  const at = (geo: THREE.BufferGeometry, y: number) => placed(geo.rotateY(Math.PI / 8), TEMPLE.x, y, TEMPLE.y);   // the platform's eight corners sit where the top-down octagon's do (rotated an eighth of a turn from three's default)
  const parts: Part[] = [
    { geo: at(new THREE.CylinderGeometry(TEMPLE_R, TEMPLE_R, 18, 8), 9), color: 0xd7c29a },
    { geo: at(new THREE.CylinderGeometry(22, 22, 60, 8), 18 + 30), color: 0xf6ead2 },
    { geo: at(new THREE.ConeGeometry(27, 28, 8), 18 + 60 + 14), color: 0x8a6d45 },
  ];
  // the spokes in the top-down drawing
  const len = TEMPLE_R * 0.8 - 22;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2, mid = 22 + len / 2;
    parts.push({ geo: placed(new THREE.BoxGeometry(len, 10, 3), TEMPLE.x + Math.cos(a) * mid, 23, TEMPLE.y + Math.sin(a) * mid, -a), color: 0xb89f70 });
  }
  group.add(mergedParts(parts));
}

/** Center Camp's café: a low wall and a wide, shallow striped tent over it (16 stripes, cream and tan), CAFE_R across like the top-down drawing and the sim's wall (the painted map's disc is 1.3 times that, not this). */
function cafe(group: THREE.Group): void {
  const c = document.createElement("canvas"); c.width = 256; c.height = 4;
  const x = c.getContext("2d")!;
  for (let k = 0; k < 16; k++) { x.fillStyle = k % 2 ? "#e8c9a4" : "#f6efe2"; x.fillRect(k * 16, 0, 16, 4); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = THREE.RepeatWrapping;
  const R = CAFE_R, WALL = 3;
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(R, R, WALL, 32), new THREE.MeshLambertMaterial({ color: 0x9c7b52 })); wall.position.set(CENTER_CAMP.x, WALL / 2, CENTER_CAMP.y);
  const tent = new THREE.Mesh(new THREE.ConeGeometry(R, 30, 16, 1, true), new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide })); tent.position.set(CENTER_CAMP.x, WALL + 15, CENTER_CAMP.y);
  group.add(wall, tent);
}

export function buildPlaces(scene: THREE.Scene): PlaceMeshes {
  const group = new THREE.Group();
  const manMat = man(group);
  temple(group);
  cafe(group);
  scene.add(group);
  return { group, update: (night) => { manMat.emissiveIntensity = night; } };
}
