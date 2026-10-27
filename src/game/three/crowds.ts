import * as THREE from "three";
import { SPOTS, type Game } from "@/lib/playa";
import { crowdSpots, type CrowdPerson } from "@/lib/scene3d";
import { glowing } from "./camps";
import { walkerGeometry } from "./people";

/**
 * The crowds at the stages (PLAN-3D.md 3.2): about 2,860 people over the 172 places, each place's crowd made by scene3d.ts crowdSpots (the
 * generator PlayaWin's drawCrowd uses, so the same people stand in the same spots), facing the stage, 72% of them bobbing to the beat. One
 * instanced mesh of the walker shape; only the crowds within SHOW feet of the camera are packed into it each frame.
 */
export type CrowdMeshes = { group: THREE.Group; update(g: Game, cam: THREE.Vector3): void; shown(): number };
const SHOW = 600;

export function buildCrowds(scene: THREE.Scene): CrowdMeshes {
  const group = new THREE.Group();
  const places = SPOTS.map((sp) => ({ x: sp.stage.x, y: sp.stage.y, r: sp.stage.r + 22, people: crowdSpots(sp) as CrowdPerson[] }));
  const total = places.reduce((n, p) => n + p.people.length, 0);
  const mesh = new THREE.InstancedMesh(walkerGeometry(), glowing({ vertexColors: true }, "glow-people", 0.3), total);
  mesh.count = 0; mesh.frustumCulled = false; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.setColorAt(0, new THREE.Color(1, 1, 1));
  group.add(mesh); scene.add(group);
  const d = new THREE.Object3D(), c = new THREE.Color();
  let shown = 0;
  return {
    group,
    shown: () => shown,
    update(g, cam) {
      let n = 0;
      for (const pl of places) {
        const dx = pl.x - cam.x, dz = pl.y - cam.z, reach = SHOW + pl.r;
        if (dx * dx + dz * dz > reach * reach) continue;
        for (const p of pl.people) {
          d.position.set(p.x, p.dancing ? 0.6 * Math.abs(Math.sin(g.t * p.rate + p.phase)) : 0, p.y);
          d.rotation.set(0, -(p.a - Math.PI / 2), 0); d.updateMatrix();   // facing the stage: the heading that looks inward from angle a
          mesh.setMatrixAt(n, d.matrix); mesh.setColorAt(n, c.setHSL(p.hue / 360, 0.7, 0.55, THREE.SRGBColorSpace)); n++;
        }
      }
      mesh.count = n; shown = n; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
  };
}
