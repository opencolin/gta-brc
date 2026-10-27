import * as THREE from "three";
import { CAFE_R, CENTER_CAMP } from "@/lib/brc";
import { buildMan } from "./theMan";
import { buildTemple } from "./theTemple";

/**
 * The landmarks: the Man (theMan.ts: a wooden lattice figure on his pavilion, burning at night), the Temple of the Moon (theTemple.ts), Center Camp's striped café
 * (the map's drawing stood up); phase 7 may replace the café with a real model.
 */
export type PlaceMeshes = { group: THREE.Group; /** the Man's neon and fire follow the night (0 = day, 1 = night); `t` is the game clock, `camera` what the flames face */ update(night: number, t: number, camera: THREE.Camera): void };

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
  const theTemple = buildTemple(group);
  cafe(group);
  scene.add(group);
  return { group, update: (night, t, camera) => { theMan.update(night, t, camera); theTemple.update(night); } };
}
