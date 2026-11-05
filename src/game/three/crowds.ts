import * as THREE from "three";
import { SPOTS, type Game } from "@/lib/playa";
import { crowdSpots, fadeAt, type CrowdPerson } from "@/lib/scene3d";
import { peopleMaterial, personGeometry, type Pose } from "./people";

/**
 * The crowds at the stages (PLAN-3D.md 3.2): about 2,860 people over the 172 places, each place's crowd made by scene3d.ts crowdSpots (the
 * generator PlayaWin's drawCrowd uses, so the same people stand in the same spots), facing the stage, 72% of them dancing to the beat. Since
 * 2026-11-04 (asked) they are people as the riders are (people.ts personGeometry): those standing still, and the dancers with their hands up, their
 * arms wide or one hand up, bobbing and swaying, an instanced mesh for each pose; only the people within SHOW feet of your ride (3D, from the camera's
 * height: none from high up) are packed into them each frame, shrinking away over the last fifth.
 */
export type CrowdMeshes = { group: THREE.Group; update(g: Game, cam: THREE.Vector3): void; shown(): number };
const SHOW = 600;

export function buildCrowds(scene: THREE.Scene): CrowdMeshes {
  const group = new THREE.Group();
  const places = SPOTS.map((sp) => ({ x: sp.stage.x, y: sp.stage.y, r: sp.stage.r + 22, people: crowdSpots(sp) as CrowdPerson[], man: sp.key === "camp:the-man" }));
  const total = places.reduce((n, p) => n + p.people.length, 0);
  const POSES: Pose[] = ["stand", "up", "wide", "wave"], mat = peopleMaterial();
  const meshes = POSES.map((pose) => {
    const m = new THREE.InstancedMesh(personGeometry(pose), mat, total);
    m.count = 0; m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.setColorAt(0, new THREE.Color(1, 1, 1));
    group.add(m); return m;
  });
  scene.add(group);
  const d = new THREE.Object3D(), c = new THREE.Color();
  let shown = 0;
  return {
    group,
    shown: () => shown,
    update(g, cam) {
      const n = [0, 0, 0, 0];
      for (const pl of places) {
        const dx = pl.x - g.car.x, dz = pl.y - g.car.y, reach = SHOW + pl.r;
        if (dx * dx + dz * dz + cam.y * cam.y > reach * reach) continue;
        for (const [j, p] of pl.people.entries()) {
          const qx = p.x - g.car.x, qz = p.y - g.car.y, f = fadeAt(Math.sqrt(qx * qx + qz * qz + cam.y * cam.y), SHOW);
          if (f <= 0) continue;
          const beat = g.t * p.rate + p.phase, k = p.dancing ? 1 + (j % 3) : 0, mesh = meshes[k];
          d.position.set(p.x, p.dancing ? 0.9 * Math.abs(Math.sin(beat)) : 0, p.y);
          // facing the stage: the heading that looks inward from angle a; the Man's crowd faces the Man, who is toward the bay from his invisible stage; a dancer sways
          d.rotation.set(0, (pl.man ? -Math.atan2(-p.x, p.y) : -(p.a - Math.PI / 2)) + (p.dancing ? 0.3 * Math.sin(beat * 0.5) : 0), p.dancing ? 0.08 * Math.sin(beat) : 0); d.scale.setScalar(f); d.updateMatrix();
          mesh.setMatrixAt(n[k], d.matrix); mesh.setColorAt(n[k], c.setHSL(p.hue / 360, 0.7, 0.55, THREE.SRGBColorSpace)); n[k]++;
        }
      }
      shown = 0;
      meshes.forEach((m, k) => { m.count = n[k]; shown += n[k]; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; });
    },
  };
}
