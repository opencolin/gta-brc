import * as THREE from "three";
import { CENTER_CAMP, TEMPLE } from "@/lib/brc";
import { AGAVE, ART, MUTANTS, SPOTS, npcAt, vehicleOf, type Game } from "@/lib/playa";
import { DAY_SECONDS } from "@/lib/playa";
import { hslHex } from "@/lib/scene3d";
import type { ViewState } from "../view";

/**
 * The light of the day and of the night (PLAN-3D.md phase 4). three.js lights are physical since r155, so the plan's intensities (written in
 * the old legacy units) are recalibrated: the day's fill and sun are π/2 times the plan's, as phase 0 set them, and the night's lamps are
 * candelas chosen by eye so a stage lights the ride beside it, the Man lights the plaza round him, and the dark between them stays dark.
 */

/** The horizon's colour by day, which the fog fades the far ground into so the two meet without a seam. */
export const HORIZON = "#f6ead2";
const ZENITH = "#8ec5fc", N_ZENITH = "#0a0c24", N_HORIZON = "#2a2440", DUST = "#e6d3ae";

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const c1 = new THREE.Color(), c2 = new THREE.Color();
/** a → b by t, as 0xRRGGBB-ish CSS strings or numbers, into `out`. */
const mixTo = (out: THREE.Color, a: THREE.ColorRepresentation, b: THREE.ColorRepresentation, t: number) => out.set(a).lerp(c2.set(b), t);

/**
 * The sky: a tall open cylinder round the camera with a gradient from the horizon up, repainted as the night and the dust storm come and go
 * (day blue over cream; night navy over plum; storm, the dust's colour all through), the stars, and the fog that fades the distance into
 * the horizon's colour (2,500 to 14,000 ft by day, closing to 900 to 5,000 at night and to 70 to 300 in a storm). The sky and the stars ignore the fog and
 * ride with the camera, or they would be fog-coloured and sit at the Gate's distance. Above the cylinder's rim the scene's background is the zenith.
 */
export function buildSky(scene: THREE.Scene): { update: (cam: THREE.Vector3, night: number, storm: number) => void } {
  const c = document.createElement("canvas"); c.width = 2; c.height = 256;
  const x = c.getContext("2d")!;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sky = new THREE.Mesh(new THREE.CylinderGeometry(35000, 35000, 12000, 32, 1, true), new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.position.y = 6000; sky.renderOrder = -10; sky.frustumCulled = false;
  scene.add(sky);
  scene.background = new THREE.Color(ZENITH);
  scene.fog = new THREE.Fog(HORIZON, 2500, 14000);
  // stars: points on a dome, white to blue to warm, brighter at the zenith, shown only at night
  const n = 900, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), q = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, e = Math.asin(0.04 + Math.random() * 0.96), R = 32000;
    pos.set([Math.cos(a) * Math.cos(e) * R, Math.sin(e) * R, Math.sin(a) * Math.cos(e) * R], i * 3);
    q.setHSL(0.55 + Math.random() * 0.12 - (Math.random() < 0.2 ? 0.5 : 0), 0.4, 0.7 + Math.random() * 0.3).toArray(col, i * 3);
  }
  const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.BufferAttribute(pos, 3)); sg.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, fog: false }));
  stars.renderOrder = -9; stars.frustumCulled = false; stars.visible = false;
  scene.add(stars);
  let last = [-1, -1];
  const top = new THREE.Color(), hor = new THREE.Color();
  return {
    update(cam, night, storm) {
      sky.position.x = cam.x; sky.position.z = cam.z; stars.position.set(cam.x, 0, cam.z);
      stars.visible = night > 0.05 && storm < 0.9; (stars.material as THREE.PointsMaterial).opacity = Math.max(0, night - 0.3) / 0.7 * (1 - storm);
      // the gradient is only redrawn when the night or the storm has moved
      // the storm's colour is the dust's, darker at night (a lit whiteout in the dark would be the one bright thing)
      const dust = mixTo(c1, DUST, "#3a3550", night).clone();
      mixTo(top, ZENITH, N_ZENITH, night); top.lerp(dust, storm); mixTo(hor, HORIZON, N_HORIZON, night); hor.lerp(dust, storm);
      if (Math.abs(night - last[0]) + Math.abs(storm - last[1]) > 0.004) {
        last = [night, storm];
        const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, "#" + top.getHexString(THREE.SRGBColorSpace)); g.addColorStop(1, "#" + hor.getHexString(THREE.SRGBColorSpace));
        x.fillStyle = g; x.fillRect(0, 0, 2, 256); tex.needsUpdate = true;
      }
      (scene.background as THREE.Color).copy(top);
      const fog = scene.fog as THREE.Fog;
      fog.color.copy(hor);
      fog.near = lerp(lerp(2500, 900, night), 70, storm); fog.far = lerp(lerp(14000, 5000, night), 300, storm);
    },
  };
}

/** A light that can stand anywhere: the Man, the Temple, a stage, a piece of art. */
type Lamp = { x: number; y: number; z: number; color: number; I: number; dist: number; decay: number };
const LAMPS: Lamp[] = (() => {
  const out: Lamp[] = [
    { x: 0, y: 70, z: 0, color: 0x7df9ff, I: 140000, dist: 380, decay: 1.4 },                                      // the Man, neon cyan
    { x: TEMPLE.x, y: 40, z: TEMPLE.y, color: 0xffbe78, I: 90000, dist: 300, decay: 1.4 },                          // the Temple, warm
    { x: AGAVE.dome.x, y: 50, z: AGAVE.dome.y, color: 0xff6b9a, I: 70000, dist: 240, decay: 1.4 },                  // Agave's dome, pink
    { x: CENTER_CAMP.x, y: 40, z: CENTER_CAMP.y, color: 0xffd28c, I: 80000, dist: 280, decay: 1.4 },                // Center Camp, amber
  ];
  for (const sp of SPOTS) if (sp.kind === "camp" || sp.kind === "fence") out.push({ x: sp.stage.x, y: 9, z: sp.stage.y, color: hslHex(sp.hue, 90, 60), I: 26000, dist: 150, decay: 1.4 });
  for (const a of ART) out.push({ x: a.x, y: 30, z: a.y, color: hslHex(a.hue, 90, 62), I: 45000, dist: a.r * 2.8, decay: 1.4 });
  return out;
})();

export type Lights = { update(g: Game, view: ViewState, cam: THREE.Vector3, dt: number): void };
const NEAR_LAMPS = 8, CAR_LAMPS = 2, RESORT = 0.5;

/**
 * The lights: the hemisphere fill and the sun by day (the sun lower, warmer and dimmer toward dusk), a faint cool moon, your headlight, and a fixed pool of
 * point lights moved among the places that glow: the 8 nearest of the Man, the Temple, Agave's dome, Center Camp, the stages and the art (re-chosen twice
 * a second and faded in, so the shaders never change), and 2 on the nearest art cars. Every light always exists (a light that came and went would recompile every material); by day their intensity is 0.
 */
export function addLights(scene: THREE.Scene): Lights {
  const hemi = new THREE.HemisphereLight("#cfe3f5", "#e6d3ae", 0.45 * Math.PI);
  const sun = new THREE.DirectionalLight("#fff4e0", 0.6 * Math.PI);
  const moon = new THREE.DirectionalLight("#8aa6ff", 0), head = new THREE.SpotLight("#fff3b0", 0, 260, 0.45, 0.5, 1.2);
  moon.position.set(-0.3, 1, 0.4);
  scene.add(hemi, sun, moon, head, head.target);
  const pool = Array.from({ length: NEAR_LAMPS + CAR_LAMPS }, () => { const l = new THREE.PointLight(0xffffff, 0, 100, 1.4); scene.add(l); return { light: l, I: 0, k: 0, want: null as Lamp | null, car: null as (typeof MUTANTS)[number] | null }; });
  let since = RESORT, ride = new THREE.Vector3();
  const near: { lamp: Lamp; d: number }[] = [];

  return {
    update(g, view, _cam, dt) {
      const night = view.night, storm = view.storm;
      // the day: where the sun is (high at noon, low at dusk, rising again at dawn) and how warm
      const f = (((g.dayT / DAY_SECONDS) % 1) + 1) % 1;
      const elev = f < 0.1 ? 40 + 30 * (f / 0.1) : f < 0.45 ? 70 - 65 * ((f - 0.1) / 0.35) : f < 0.9 ? 5 : 5 + 35 * ((f - 0.9) / 0.1);
      const e = (elev * Math.PI) / 180, warm = Math.pow(1 - elev / 70, 2);
      sun.position.set(-0.55 * Math.cos(e), Math.sin(e), -0.45 * Math.cos(e));
      sun.color.set("#fff4e0").lerp(c1.set("#ff9c5a"), warm);
      sun.intensity = 0.6 * Math.PI * (1 - night) * (1 - 0.6 * storm);
      // the fill: sky and ground colours move to the night's navies, and the whole is dimmer; a storm greys it
      mixTo(hemi.color, "#cfe3f5", "#2a3466", night); mixTo(hemi.groundColor, "#e6d3ae", "#14183a", night);
      hemi.color.lerp(c1.set(DUST), storm * 0.5); hemi.groundColor.lerp(c1.set(DUST), storm * 0.5);
      hemi.intensity = lerp(0.45 * Math.PI, 0.5 * Math.PI, night) * (1 - 0.3 * storm);
      moon.intensity = 0.16 * Math.PI * night;
      // your headlight, at the nose, 200 ft ahead
      const v = vehicleOf(g), fx = Math.sin(g.car.h), fz = -Math.cos(g.car.h), y = (g.vehicle === "plane" || g.chute ? g.alt : 0) + 4;
      head.position.set(g.car.x + fx * (v.len / 2), y, g.car.y + fz * (v.len / 2));
      head.target.position.set(g.car.x + fx * 200, g.alt > 0 ? 0 : 0, g.car.y + fz * 200);
      head.intensity = 90000 * night * (g.alt > 0 ? 0 : 1);
      ride.set(g.car.x, 0, g.car.y);

      // the lamps near you, re-chosen twice a second: the 8 nearest by distance to the ride
      since += dt;
      if (since >= RESORT) {
        since = 0; near.length = 0;
        for (const lamp of LAMPS) near.push({ lamp, d: Math.hypot(lamp.x - ride.x, lamp.z - ride.z) - lamp.dist * 0.4 });
        near.sort((a, b) => a.d - b.d);
        const chosen = new Set(near.slice(0, NEAR_LAMPS).map((n) => n.lamp));
        // keep a slot that already has a chosen lamp; give the others the new ones
        const free: Lamp[] = [...chosen];
        for (let i = 0; i < NEAR_LAMPS; i++) { const w = pool[i].want; if (w && chosen.has(w)) free.splice(free.indexOf(w), 1); else pool[i].want = null; }
        for (let i = 0; i < NEAR_LAMPS; i++) if (!pool[i].want) { const l = free.shift(); if (l) { pool[i].want = l; pool[i].k = 0; pool[i].light.position.set(l.x, l.y, l.z); pool[i].light.color.setHex(l.color); pool[i].light.distance = l.dist; pool[i].light.decay = l.decay; pool[i].I = l.I; } }
        // the two nearest art cars within 300 ft, in their colours
        const cars = MUTANTS.map((m) => { const p = npcAt(m, g.t); return { m, p, d: Math.hypot(p.x - ride.x, p.y - ride.z) }; }).filter((c) => c.d < 300).sort((a, b) => a.d - b.d).slice(0, CAR_LAMPS);
        for (let i = 0; i < CAR_LAMPS; i++) {
          const slot = pool[NEAR_LAMPS + i], c = cars[i];
          if (c) { slot.light.color.setHex(hslHex(c.m.hue, 90, 62)); slot.light.distance = 130; slot.light.decay = 1.4; slot.I = 30000; slot.want = LAMPS[0]; slot.car = c.m; } else { slot.want = null; slot.car = null; }
        }
      }
      for (let i = 0; i < pool.length; i++) {
        const s = pool[i];
        s.k = s.want ? Math.min(1, s.k + dt / 0.35) : Math.max(0, s.k - dt / 0.35);
        s.light.intensity = s.I * s.k * night;
        if (s.car) { const p = npcAt(s.car, g.t); s.light.position.set(p.x, 18, p.y); }   // an art car's lamp rides with it
      }
    },
  };
}
