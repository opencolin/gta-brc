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

/** The horizon's colour by day, which the fog fades the far ground into so the two meet without a seam. */
export const HORIZON = "#f6ead2";
const ZENITH = "#8ec5fc";

/**
 * The sky: a tall open cylinder round the camera with a gradient from the horizon's cream up to blue, and the fog that fades the
 * distance into the cream (2,500 ft to 14,000 ft). Both ignore the fog themselves and ride with the camera, or they would be fog-coloured
 * and sit at the Gate's distance. Above the cylinder's rim the scene's background is the zenith blue.
 */
export function buildSky(scene: THREE.Scene): { update: (cam: THREE.Vector3) => void } {
  const c = document.createElement("canvas"); c.width = 2; c.height = 256;
  const x = c.getContext("2d")!, g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, ZENITH); g.addColorStop(1, HORIZON);
  x.fillStyle = g; x.fillRect(0, 0, 2, 256);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sky = new THREE.Mesh(new THREE.CylinderGeometry(35000, 35000, 12000, 32, 1, true), new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.position.y = 6000; sky.renderOrder = -10; sky.frustumCulled = false;
  scene.add(sky);
  scene.background = new THREE.Color(ZENITH);
  scene.fog = new THREE.Fog(HORIZON, 2500, 14000);
  return { update: (cam) => { sky.position.x = cam.x; sky.position.z = cam.z; } };
}
