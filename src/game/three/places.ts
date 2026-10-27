import * as THREE from "three";
import { CAFE_R, CENTER_CAMP, TEMPLE, TEMPLE_R } from "@/lib/brc";
import { mergedParts, placed, type Part } from "./materials";
import { buildMan } from "./theMan";

/**
 * The landmarks: the Man (theMan.ts: a wooden lattice figure on his pavilion, burning at night), the Temple, Center Camp's striped café.
 * The Temple and the café are the top-down painter's drawings (drawTemple, the map's café) stood up; phase 7 may replace them with real models.
 */
export type PlaceMeshes = { group: THREE.Group; /** the Man's neon and fire follow the night (0 = day, 1 = night); `t` is the game clock, `camera` what the flames face */ update(night: number, t: number, camera: THREE.Camera): void };

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
  const theMan = buildMan(group);
  temple(group);
  cafe(group);
  scene.add(group);
  return { group, update: (night, t, camera) => theMan.update(night, t, camera) };
}
