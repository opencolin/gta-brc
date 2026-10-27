import * as THREE from "three";

/**
 * Day light for the first version: a sky-and-ground fill and a sun. three.js lights are physical since r155 (a surface
 * facing a light of intensity 1 comes out at 1/π of its colour), where the plan's 0.9 and 1.2 were written in the old
 * "legacy" units. These are π/2 times those (the plan's numbers halved, then times π), which puts an up-facing surface
 * just under full colour. Phase 4 moves the sun with the day and brings the night: treat the plan's intensities there
 * as legacy units to recalibrate, not values to copy.
 */
export function addLights(scene: THREE.Scene): void {
  scene.add(new THREE.HemisphereLight("#cfe3f5", "#e6d3ae", 0.45 * Math.PI));
  const sun = new THREE.DirectionalLight("#fff4e0", 0.6 * Math.PI);
  sun.position.set(0.4, 1, 0.3);
  scene.add(sun);
}
