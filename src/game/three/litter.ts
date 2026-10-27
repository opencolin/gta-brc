import * as THREE from "three";
import { MOOP_N, nightLevel, type Game } from "@/lib/playa";
import { hash } from "@/lib/scene3d";

/**
 * MOOP and wheel dust (PLAN-3D.md 3.3). MOOP: the little glints of litter on the playa, 6 x 3 ft boxes in three colours turned by their
 * own hash, as the top-down painter has them, pulsing a bright glint. Dust: puffs behind the wheels (g.dust, up to 160), soft round
 * billboards that always face the camera, `size` feet across a radius and `0.55 * life` opaque, fading and rising as they go.
 */
export type LitterMeshes = { group: THREE.Group; update(g: Game, camera: THREE.Camera): void };
const MAX_DUST = 200;
const COLORS = [0x7a4fd1, 0xe04f7a, 0x4a90c2];

export function buildLitter(scene: THREE.Scene): LitterMeshes {
  const group = new THREE.Group();
  const moop = new THREE.InstancedMesh(new THREE.BoxGeometry(6, 1, 3), new THREE.MeshLambertMaterial({ color: 0xffffff }), Math.max(MOOP_N, 1));
  moop.count = 0; moop.frustumCulled = false; moop.instanceMatrix.setUsage(THREE.DynamicDrawUsage); moop.setColorAt(0, new THREE.Color(1, 1, 1));
  // dust: a soft disc texture on a billboard, with a per-puff opacity
  const tex = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d")!; const g = x.createRadialGradient(32, 32, 4, 32, 32, 31); g.addColorStop(0, "rgba(230,211,174,1)"); g.addColorStop(0.7, "rgba(230,211,174,.75)"); g.addColorStop(1, "rgba(230,211,174,0)"); x.fillStyle = g; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const alpha = new THREE.InstancedBufferAttribute(new Float32Array(MAX_DUST), 1);
  alpha.setUsage(THREE.DynamicDrawUsage);
  const geo = new THREE.PlaneGeometry(1, 1); geo.setAttribute("aAlpha", alpha);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: true });
  mat.onBeforeCompile = (s) => {
    s.vertexShader = "attribute float aAlpha;\nvarying float vAlpha;\n" + s.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n  vAlpha = aAlpha;");
    s.fragmentShader = "varying float vAlpha;\n" + s.fragmentShader.replace("#include <color_fragment>", "#include <color_fragment>\n  diffuseColor.a *= vAlpha;");
  };
  mat.customProgramCacheKey = () => "dust-alpha";
  const dust = new THREE.InstancedMesh(geo, mat, MAX_DUST);
  dust.count = 0; dust.frustumCulled = false; dust.renderOrder = 20; dust.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  group.add(moop, dust); scene.add(group);
  const d = new THREE.Object3D(), c = new THREE.Color(), white = new THREE.Color(1, 1, 1);
  return {
    group,
    update(g, camera) {
      const n = Math.min(g.moop.length, MOOP_N);
      for (let i = 0; i < n; i++) {
        const m = g.moop[i], k = hash(Math.round(m.x * 7 + m.y));
        d.position.set(m.x, 0.6, m.y); d.rotation.set(0, -k * 6, 0); d.scale.set(1, 1, 1); d.updateMatrix(); moop.setMatrixAt(i, d.matrix);
        c.setHex(COLORS[k < 0.33 ? 0 : k < 0.66 ? 1 : 2], THREE.SRGBColorSpace).lerp(white, 0.35 * (0.5 + 0.5 * Math.sin(g.t * 5 + k * 20)));   // the glint
        moop.setColorAt(i, c);
      }
      moop.count = n; moop.instanceMatrix.needsUpdate = true; if (moop.instanceColor) moop.instanceColor.needsUpdate = true;
      const m2 = g.alt > 0 ? 0 : Math.min(g.dust.length, MAX_DUST);   // the sim spawns dust at any speed over 50, aloft too: none from a plane or a chute
      // smaller and fainter than the top-down puffs, and dimmer still at night (asked 2026-10-27: too much dust behind the ride, worst at night)
      const night = nightLevel(g.dayT), fade = 0.3 - 0.14 * night;
      mat.color.setRGB(1 - 0.8 * night, 1 - 0.78 * night, 1 - 0.66 * night);   // by night the cream puffs go to a dark dust-blue, not white (asked 2026-10-27)
      for (let i = 0; i < m2; i++) {
        const p = g.dust[i], life = Math.max(0, p.life);
        d.position.set(p.x, 1.2 + (1 - life) * 2.2, p.y); d.quaternion.copy(camera.quaternion); d.scale.setScalar(1.3 * p.size); d.updateMatrix(); dust.setMatrixAt(i, d.matrix);
        alpha.setX(i, fade * life);
      }
      d.quaternion.identity();
      dust.count = m2; dust.instanceMatrix.needsUpdate = true; alpha.needsUpdate = true;
    },
  };
}
