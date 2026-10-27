import * as THREE from "three";
import { vehicleOf, type Game } from "@/lib/playa";
import type { Vec } from "@/lib/brc";
import { camAt, camAvoid, camGoal, camStep, camYaw, type CamState, type CamTarget } from "@/lib/chaseCam";
import type { RenderPerf, Renderer, ViewState } from "../view";
import { cityPlan } from "@/lib/playa";
import { buildCamps, nightUniform, type CampMeshes } from "./camps";
import { buildGround, type GroundMeshes } from "./ground";
import { addLights, buildSky } from "./lights";
import { clearMaterials } from "./materials";
import { buildPlaces, type PlaceMeshes } from "./places";
import { buildStages, type StageMeshes } from "./stages";
import { buildRides, updateRide, type RideMeshes } from "./rides";

/** A jump in where the camera wants to be bigger than this (feet) is a teleport, not a drive: start there instead of sweeping across the map. */
const SNAP = 1500;
/** frame() is not called while top-down is showing, so a gap longer than this (seconds) since the last frame means the camera's state is stale: start behind the ride again instead of easing across what it drove meanwhile. */
const STALE = 0.25;

/** What the camera needs from the game. */
const camTargetOf = (g: Game): CamTarget => {
  const v = vehicleOf(g);
  return { x: g.car.x, y: g.car.y, h: g.car.h, vx: g.car.vx, vy: g.car.vy, alt: g.alt, len: v.len, maxSpeed: v.maxSpeed, chute: g.chute, plane: g.vehicle === "plane" };
};

/**
 * The chase-camera renderer: the same Game, seen from behind your ride in three.js. It owns the scene, the camera and the
 * WebGL canvas; the game is never written to. Everything here is loaded lazily (PlayaWin's dynamic import), so top-down never pays for it.
 */
export class ChaseRenderer implements Renderer {
  private renderer!: THREE.WebGLRenderer;
  private canvas!: HTMLCanvasElement;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(60, 1, 1, 40000);
  private cam: CamState | null = null;
  private lastAt = 0;
  private samples: { at: number; dt: number; cpu: number }[] = [];
  private ride!: RideMeshes;
  private ground!: GroundMeshes;
  private camps!: CampMeshes;
  private places!: PlaceMeshes;
  private stages!: StageMeshes;
  private sky!: { update: (cam: THREE.Vector3) => void };
  private w = 1; private h = 1; private dpr = 1; private touch = false;
  private lost = false;
  private tmp = new THREE.Vector3();
  private onLost = (e: Event) => { e.preventDefault(); this.lost = true; };
  private onRestored = () => this.rebuild();

  mount(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.build();
    canvas.addEventListener("webglcontextlost", this.onLost);
    canvas.addEventListener("webglcontextrestored", this.onRestored);
    this.applySize();
  }

  private build(): void {
    this.sky = buildSky(this.scene);
    this.ground = buildGround(this.scene, Math.min(8, this.renderer.capabilities.getMaxAnisotropy()));
    this.camps = buildCamps(this.scene, cityPlan());
    this.places = buildPlaces(this.scene);
    this.stages = buildStages(this.scene);
    this.ride = buildRides(this.scene);
    addLights(this.scene);
  }

  /** Free what the scene holds on the GPU and empty it (the builders are deterministic, so build() can fill it again). */
  private clear(): void {
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      for (const mat of mats) {
        for (const v of Object.values(mat)) if (v instanceof THREE.Texture) v.dispose();
        mat.dispose();
      }
    });
    this.scene.clear();
    clearMaterials();
  }

  /** The browser took the GL context (a backgrounded phone tab) and gave it back: everything on the GPU is gone, so build it again. */
  private rebuild(): void {
    this.clear();
    this.build();
    this.applySize();
    this.lost = false;
  }

  private applySize(): void {
    this.renderer.setPixelRatio(Math.min(this.dpr, this.touch ? 1.5 : 2));
    this.renderer.setSize(this.w, this.h, false);   // the canvas is sized by CSS (100% of the stage); this sets its drawing buffer
    this.camera.aspect = this.w / this.h;
    this.camera.updateProjectionMatrix();
  }

  resize(w: number, h: number, dpr: number): void {
    this.w = Math.max(1, w); this.h = Math.max(1, h); this.dpr = dpr;
    this.applySize();
  }

  frame(g: Game, view: ViewState, dt: number): void {
    if (this.lost) return;
    const t0 = performance.now();
    if (view.touchUi !== this.touch) { this.touch = view.touchUi; this.applySize(); }
    const target = camTargetOf(g);
    const goal = camAvoid(target, camGoal(target, view.orbit));
    const now = performance.now(), stale = now - this.lastAt > STALE * 1000;
    this.lastAt = now;
    const jumped = !this.cam || stale || Math.hypot(goal.eye.x - this.cam.eye.x, goal.eye.z - this.cam.eye.z) > SNAP;
    this.cam = jumped ? camAt(goal) : camStep(this.cam!, goal, Math.min(dt, 0.1));
    const { eye: e, look: l, fov } = this.cam;
    this.camera.position.set(e.x, e.y, e.z);
    this.camera.lookAt(l.x, l.y, l.z);
    if (this.camera.fov !== fov) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }
    nightUniform.value = view.night; this.places.update(view.night); this.stages.update(g, g.t);
    this.sky.update(this.camera.position); this.ground.update(this.camera.position); this.camps.update(this.camera.position);
    updateRide(this.ride, g, view);
    this.renderer.render(this.scene, this.camera);
    const t1 = performance.now();
    this.samples.push({ at: t1, dt: this.samples.length ? t1 - this.samples[this.samples.length - 1].at : 0, cpu: t1 - t0 });
    while (this.samples.length > 1 && t1 - this.samples[0].at > 2000) this.samples.shift();
  }

  perf(): RenderPerf {
    const n = this.samples.length, r = this.renderer.info, s = this.camps.stats();
    const ms = n > 1 ? this.samples.slice(1).reduce((a, x) => a + x.dt, 0) / (n - 1) : 0, cpuMs = n ? this.samples.reduce((a, x) => a + x.cpu, 0) / n : 0;
    return { calls: r.render.calls, triangles: r.render.triangles, geometries: r.memory.geometries, textures: r.memory.textures, ms, fps: ms ? 1000 / ms : 0, cpuMs, extra: `${s.shown}/${s.meshes} camp meshes shown, ${s.prisms} pieces` };
  }

  project(p: Vec, up = 0): { x: number; y: number } | null {
    if (!this.cam) return null;
    const v = this.tmp.set(p.x, up, p.y).project(this.camera);
    if (v.z > 1) return null;   // behind the camera (or past its far plane)
    return { x: ((v.x + 1) / 2) * this.w, y: ((1 - v.y) / 2) * this.h };
  }

  yaw(): number { return this.cam ? camYaw(this.cam) : 0; }

  dispose(): void {
    this.canvas.removeEventListener("webglcontextlost", this.onLost);
    this.canvas.removeEventListener("webglcontextrestored", this.onRestored);
    this.clear();
    this.renderer.dispose();
  }
}
