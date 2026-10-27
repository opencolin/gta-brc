import * as THREE from "three";
import { MAP_BOX, cityImage } from "@/game/citymap";
import { PALETTE } from "@/lib/view3d";

export type GroundMeshes = { group: THREE.Group };

/**
 * The playa for the first version: the painted city map (the same canvas the minimap and the big map are made from) laid flat
 * on the ground, with the open desert beyond it. Game x is X, game y is Z (the map's top row is north, -Z), so the map needs no
 * flip: PlaneGeometry lies in XY facing +Z, and turning it -π/2 about X puts its up-edge toward -Z and its face up.
 * Phase 1 puts real streets, blocks and camps on top of it.
 */
export function buildGround(scene: THREE.Scene, maxAnisotropy = 1): GroundMeshes {
  const group = new THREE.Group();

  // the desert past the map: drawn first and writing no depth, so the map over it never z-fights at a distance
  const far = new THREE.Mesh(new THREE.PlaneGeometry(120000, 120000), new THREE.MeshBasicMaterial({ color: PALETTE.outside, depthWrite: false }));
  far.rotation.x = -Math.PI / 2; far.position.y = -0.5; far.renderOrder = -1;
  group.add(far);

  // the map's box is centred on its middle row; the image is square on the longer side (citymap.ts paint())
  const side = Math.max(2 * MAP_BOX.half, MAP_BOX.bottom - MAP_BOX.top);
  const img = cityImage();
  let mat: THREE.MeshBasicMaterial;
  if (img) {
    const tex = new THREE.CanvasTexture(img);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAnisotropy;
    mat = new THREE.MeshBasicMaterial({ map: tex });
  } else mat = new THREE.MeshBasicMaterial({ color: PALETTE.playa });
  const map = new THREE.Mesh(new THREE.PlaneGeometry(side, side), mat);
  map.rotation.x = -Math.PI / 2;
  map.position.set(0, 0, (MAP_BOX.top + MAP_BOX.bottom) / 2);
  group.add(map);

  scene.add(group);
  return { group };
}
