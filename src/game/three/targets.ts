import * as THREE from "three";
import { GATE } from "@/lib/brc";
import { STOP_R, atGate, missionTarget, type Game } from "@/lib/playa";
import { LAYER } from "@/lib/scene3d";

/**
 * The rings on the ground you pull up in (PLAN-3D.md phase 2, the flat target ring): the pager's target, a pink ring of radius STOP_R that
 * breathes with the same pulse as the top-down painter's, with its faint pink fill; and the Gate's, 60 ft across at GATE.stop, rainbow
 * while you are in it. (PlayaWin's screen-space ring and beam stay: the beam to find the target from afar, the ring where this one is too small to see.)
 */
export type TargetMeshes = { group: THREE.Group; update(g: Game): void };

export function buildTargets(scene: THREE.Scene): TargetMeshes {
  const group = new THREE.Group();
  const flat = (geo: THREE.BufferGeometry, color: number, opacity = 1) => {
    const m = new THREE.Mesh(geo.rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: -LAYER.target }));
    m.position.y = 0.7; m.renderOrder = LAYER.target; m.visible = false; group.add(m); return m;
  };
  // the pager's: a ring 0.06 of its radius wide, and a disc under it
  const ring = flat(new THREE.RingGeometry(0.94, 1, 64), 0xff6b9a), fill = flat(new THREE.CircleGeometry(1, 48), 0xff6b9a, 0.2);
  // the Gate's stop
  const gate = flat(new THREE.RingGeometry(0.95, 1, 72), 0xff6b9a); gate.position.set(GATE.stop.x, 0.7, GATE.stop.y); gate.scale.set(60, 1, 60); gate.visible = true;
  scene.add(group);
  return {
    group,
    update(g) {
      const tg = missionTarget(g.mission, g.t), pulse = 0.5 + 0.5 * Math.sin(g.t * 5);
      ring.visible = fill.visible = !!tg;
      if (tg) {
        const r = STOP_R * (0.85 + 0.15 * pulse);
        for (const m of [ring, fill]) { m.position.set(tg.at.x, 0.7, tg.at.y); m.scale.set(r, 1, r); }
        (fill.material as THREE.MeshBasicMaterial).opacity = 0.15 + 0.15 * pulse;
      }
      const here = atGate(g), c = (gate.material as THREE.MeshBasicMaterial).color;
      if (here) c.setHSL(((g.t * 90) % 360) / 360, 1, 0.62); else c.set(0xff6b9a);
    },
  };
}
