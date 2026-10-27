import * as THREE from "three";
import { CAFE_R, CENTER_CAMP, MAN_R, TEMPLE, TEMPLE_R } from "@/lib/brc";
import { lambert } from "./materials";

/**
 * The landmarks: the Man standing on his base, the Temple, Center Camp's striped café. The same drawings the top-down painter has
 * (PlayaWin's drawMan, drawTemple, the map's café), stood up: the Man's stick figure is drawMan's points with y turned into height and
 * everything ×1.3, so he is about 100 ft tall. Phase 2 adds the stages, bays and art; phase 7 may replace these with real models.
 */
export type PlaceMeshes = { group: THREE.Group; /** the Man glows neon at night (0 = day, 1 = night) */ update(night: number): void };

/** A rod from a to b: a cylinder lying along that line. */
function rod(a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material): THREE.Mesh {
  const dir = b.clone().sub(a), m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, dir.length(), 6), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return m;
}

/** The Man: a base like a drum and the figure on it, arms up, in navy by day and glowing cyan at night. */
function man(group: THREE.Group): THREE.MeshLambertMaterial {
  const BASE = 6;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(MAN_R, MAN_R, BASE, 32), lambert(0xc8b48c));
  base.position.y = BASE / 2; group.add(base);
  const glow = new THREE.MeshLambertMaterial({ color: 0x1b1f3b, emissive: 0x7df9ff, emissiveIntensity: 0 });
  // drawMan's points (y down, feet at y = 34) as (x·1.3, (34 − y)·1.3) above the base, in the X-Y plane
  const P = (x: number, h: number) => new THREE.Vector3(x, BASE + h, 0);
  const waist = P(0, 28.6), top = P(0, 83.2), shoulders = P(0, 67.6);
  const parts: [THREE.Vector3, THREE.Vector3][] = [[waist, top], [waist, P(-18.2, 0)], [waist, P(18.2, 0)], [shoulders, P(-28.6, 96.2)], [shoulders, P(28.6, 96.2)]];
  for (const [a, b] of parts) group.add(rod(a, b, 1.5, glow));
  const head = new THREE.Mesh(new THREE.SphereGeometry(7.8, 14, 10), glow); head.position.copy(P(0, 91)); group.add(head);
  return glow;
}

/** The Temple: an eight-sided platform, a taller eight-sided tower in the middle and a pyramid roof on it. */
function temple(group: THREE.Group): void {
  const t = new THREE.Group(); t.position.set(TEMPLE.x, 0, TEMPLE.y);
  // the platform's eight corners sit where the top-down octagon's do (rotated an eighth of a turn from three's default)
  const platform = new THREE.Mesh(new THREE.CylinderGeometry(TEMPLE_R, TEMPLE_R, 18, 8).rotateY(Math.PI / 8), lambert(0xd7c29a)); platform.position.y = 9;
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(22, 22, 60, 8).rotateY(Math.PI / 8), lambert(0xf6ead2)); tower.position.y = 18 + 30;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(27, 28, 8).rotateY(Math.PI / 8), lambert(0x8a6d45)); roof.position.y = 18 + 60 + 14;
  t.add(platform, tower, roof);
  // eight low walls reaching from the tower to the platform's corners, the spokes in the top-down drawing
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2, wall = new THREE.Mesh(new THREE.BoxGeometry(TEMPLE_R * 0.8 - 22, 10, 3), lambert(0xb89f70));
    wall.position.set(Math.cos(a) * (22 + (TEMPLE_R * 0.8 - 22) / 2), 23, Math.sin(a) * (22 + (TEMPLE_R * 0.8 - 22) / 2)); wall.rotation.y = -a; t.add(wall);
  }
  group.add(t);
}

/** Center Camp's café: a low wall and a wide, shallow striped tent over it (16 stripes, cream and tan), CAFE_R across like the top-down drawing and the sim's wall (the painted map's disc is 1.3 times that, not this). */
function cafe(group: THREE.Group): void {
  const c = document.createElement("canvas"); c.width = 256; c.height = 4;
  const x = c.getContext("2d")!;
  for (let k = 0; k < 16; k++) { x.fillStyle = k % 2 ? "#e8c9a4" : "#f6efe2"; x.fillRect(k * 16, 0, 16, 4); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = THREE.RepeatWrapping;
  const R = CAFE_R, WALL = 3;
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(R, R, WALL, 32), lambert(0x9c7b52)); wall.position.set(CENTER_CAMP.x, WALL / 2, CENTER_CAMP.y);
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
