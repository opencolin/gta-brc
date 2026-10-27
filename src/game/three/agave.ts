import * as THREE from "three";
import { AGAVE } from "@/lib/playa";
import { PALETTE } from "@/lib/view3d";
import { earthTexture, moonTexture } from "./decals";

/**
 * Agave Lounge (PLAN-3D.md 2.4): the Earth dome, a hemisphere 70 ft in radius wearing the polar map the top-down view paints, the smaller
 * Moon dome beside it, and the camp's pink ring on the ground, rainbow at night. Its bay is drawn with the others (stages.ts).
 */
export type AgaveMeshes = { group: THREE.Group; update(night: number, t: number): void };

/** A hemisphere whose texture is a picture looking straight down on it: u and v from x and z. */
function domeOf(r: number, map: THREE.Texture): THREE.Mesh {
  const g = new THREE.SphereGeometry(r, 36, 16, 0, Math.PI * 2, 0, Math.PI / 2), pos = g.getAttribute("position"), uv = g.getAttribute("uv");
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / (2 * r) + 0.5, 0.5 - pos.getZ(i) / (2 * r));
  return new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map }));
}

export function buildAgave(scene: THREE.Scene): AgaveMeshes {
  const group = new THREE.Group();
  const { dome, moon } = AGAVE;
  const earth = domeOf(dome.r, earthTexture()); earth.position.set(dome.x, 0, dome.y);
  const luna = domeOf(moon.r, moonTexture()); luna.position.set(moon.x, 0, moon.y);
  const ringMat = new THREE.MeshBasicMaterial({ color: PALETTE.pink });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(dome.r + 2, 1.5, 6, 72).rotateX(Math.PI / 2), ringMat); ring.position.set(dome.x, 0.8, dome.y);
  group.add(earth, luna, ring);
  scene.add(group);
  return { group, update: (night, t) => { if (night > 0.3) ringMat.color.setHSL(((t * 90) % 360) / 360, 1, 0.65, THREE.SRGBColorSpace); else ringMat.color.set(PALETTE.pink); } };
}
