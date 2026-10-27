import * as THREE from "three";
import { vehicleOf, type Game } from "@/lib/playa";
import { PALETTE, yawOf } from "@/lib/view3d";
import type { ViewState } from "../view";

export type RideMeshes = { group: THREE.Group; body: THREE.Mesh; nose: THREE.Mesh };

/**
 * Your ride for the first version: a pink box the size of whatever you are on, with a navy mark on its nose so you can see
 * which way it faces. In its own frame forward is -Z and right is +X (the drawings' nose is at -y), so it takes the ride's
 * `wid` along X and `len` along Z, and the game heading h turns it by rotation.y = -h (view3d.ts).
 */
export function buildRides(scene: THREE.Scene): RideMeshes {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: PALETTE.pink }));
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: PALETTE.navy }));
  group.add(body, nose);
  scene.add(group);
  return { group, body, nose };
}

const HEIGHT = 6;

export function updateRide(r: RideMeshes, g: Game, _view: ViewState): void {
  const v = vehicleOf(g);
  r.body.scale.set(v.wid, HEIGHT, v.len);
  r.body.position.y = HEIGHT / 2;
  r.nose.scale.set(v.wid * 0.7, 1, 3);
  r.nose.position.set(0, HEIGHT + 0.5, -v.len / 2 + 2.5);
  r.group.position.set(g.car.x, g.alt, g.car.y);
  r.group.rotation.y = yawOf(g.car.h);
}
