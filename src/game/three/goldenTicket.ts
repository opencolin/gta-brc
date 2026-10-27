import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { carRoof } from "./decals";
import { mergedParts, shaped as P, type Part } from "./materials";

/**
 * The Golden Ticket (asked 2026-10-27, from Collin's photos): a San Francisco meter-maid cart reborn in gold. In its own frame forward
 * is -Z and right is +X. The gold body on three wheels carries its top-down drawing on the roof, a pair of gold jet-engine speaker pods
 * on each side at the back (the twin barrels of a Void pod, each with a dark grille and a ring of lights), and the sign on the back:
 * GOLDEN TICKET in a black frame with the P beside it, lettered in code (no logo file). The same twinkling rainbow lights the roof
 * drawing has run round each grille and along the back; the grilles and the back are canvases repainted ten times a second (paint()).
 * One stands parked at Agave and one is the one you drive (cars.ts); one is the garage ride (rides.ts).
 */
export type Ticket = { group: THREE.Group; paint(t: number, night: number): void };

const GOLD = 0xe8b923, TRIM = 0xc9960c, TYRE = 0x15161d;
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cyl = (r: number, h: number) => new THREE.CylinderGeometry(r, r, h, 12);
const hsl = (h: number, s: number, l: number) => `hsl(${((h % 360) + 360) % 360}, ${s}%, ${l}%)`;

/** The rainbow dots the roof drawing has: the hue runs along the strip and with time, each dot with a white twinkle. */
function leds(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[], t: number, night: number, r: number) {
  pts.forEach((p, i) => {
    ctx.fillStyle = hsl(i * 22 + t * 240, 100, 55 + 15 * night);
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(255,255,255,${0.25 + 0.35 * Math.abs(Math.sin(t * 3 + i * 2.1))})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.45, 0, Math.PI * 2); ctx.fill();
  });
}

function canvasTexture(w: number, h: number): { ctx: CanvasRenderingContext2D; tex: THREE.CanvasTexture } {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return { ctx: c.getContext("2d")!, tex };
}

/** A pod's grille, 64 px for 2.6 ft: a dark mesh in a gold rim, lit from behind at night, twelve lights round it. */
function paintGrille(ctx: CanvasRenderingContext2D, t: number, night: number) {
  const s = 64, cx = s / 2;
  ctx.clearRect(0, 0, s, s);
  ctx.fillStyle = "#e8b923"; ctx.beginPath(); ctx.arc(cx, cx, 31, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#23242a"; ctx.beginPath(); ctx.arc(cx, cx, 24, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = `rgba(232, 185, 35, ${0.18 + 0.25 * night})`;
  for (let y = 10; y < s - 10; y += 4) for (let x = 10; x < s - 10; x += 4) if (Math.hypot(x - cx, y - cx) < 22) ctx.fillRect(x, y, 1.6, 1.6);
  ctx.fillStyle = `rgba(255, 220, 120, ${0.15 + 0.3 * night})`; ctx.beginPath(); ctx.arc(cx, cx, 9, 0, Math.PI * 2); ctx.fill();
  leds(ctx, Array.from({ length: 12 }, (_, i) => ({ x: cx + Math.cos((i / 12) * Math.PI * 2) * 27.5, y: cx + Math.sin((i / 12) * Math.PI * 2) * 27.5 })), t, night, 2.2);
}

/** The back of the cart, 200 × 120 px for 10 × 6 ft: gold with the roof's sparkle, the framed sign and the P, a blank plate, the tail lights, and lights along the top and bottom. */
function paintBack(ctx: CanvasRenderingContext2D, t: number, night: number) {
  const w = 200, h = 120;
  ctx.fillStyle = "#e8b923"; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#c9960c"; ctx.fillRect(0, 0, w, 10);
  for (let k = 0; k < 7; k++) { const a = t * 3 + k * 2.1; ctx.fillStyle = `rgba(255,255,255,${0.3 + 0.35 * Math.abs(Math.sin(a))})`; ctx.fillRect(14 + ((k * 37 + t * 20) % 172), 14 + ((k * 23) % 90), 3, 3); }
  ctx.strokeStyle = "#111"; ctx.lineWidth = 5; ctx.lineJoin = "round";
  ctx.beginPath(); ctx.roundRect(22, 28, 112, 66, 9); ctx.stroke();
  ctx.beginPath(); ctx.roundRect(140, 28, 40, 66, 9); ctx.stroke();
  ctx.fillStyle = "#111"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = "900 25px Rockwell, 'Arial Black', Impact, 'Helvetica Neue', Arial, sans-serif";
  ctx.fillText("GOLDEN", 78, 48, 100); ctx.fillText("TICKET", 78, 76, 100);
  ctx.font = "900 38px Rockwell, 'Arial Black', Impact, 'Helvetica Neue', Arial, sans-serif";
  ctx.fillText("P", 160, 62);
  ctx.fillStyle = "#f4f1e8"; ctx.fillRect(6, 96, 30, 15); ctx.fillStyle = "#1b3a8a"; ctx.fillRect(8, 98, 26, 3);
  ctx.fillStyle = night > 0.3 ? "#ff3b5c" : "#b3122f"; ctx.fillRect(8, 108, 18, 8); ctx.fillRect(w - 26, 108, 18, 8);
  ctx.fillStyle = "#15161d"; ctx.fillRect(0, 116, w, 4);
  const strip = (y: number) => Array.from({ length: 18 }, (_, i) => ({ x: 10 + i * 10.6, y }));
  leds(ctx, [...strip(5), ...strip(103)], t, night, 2.4);
}

export function goldenTicket(): Ticket {
  const group = new THREE.Group();
  // the gold body on three wheels, the trim round the deck, the brackets the pods hang from
  const body: Part[] = [
    P(box(10, 6, 20), GOLD, { y: 5.2 }), P(box(8.4, 1, 18), TRIM, { y: 8.6 }),
    P(cyl(2, 1), TYRE, { y: 2, z: -8, rz: Math.PI / 2 }), P(cyl(2, 1), TYRE, { x: -4.6, y: 2, z: 6, rz: Math.PI / 2 }), P(cyl(2, 1), TYRE, { x: 4.6, y: 2, z: 6, rz: Math.PI / 2 }),
  ];
  for (const s of [-1, 1]) for (const z of [2.2, 5.8]) body.push(P(box(1.6, 0.7, 1.2), TRIM, { x: s * 5.6, y: 7.2, z }));
  group.add(mergedParts(body));
  // the pods: a rounded barrel each, its grille facing out, the pair joined by a bridge; polished gold
  const pods: Part[] = [], grilles: THREE.BufferGeometry[] = [];
  const profile = [[0.05, -1.7], [1.0, -1.4], [1.5, -0.7], [1.7, 0.2], [1.55, 0.95], [1.3, 1.1]].map(([r, y]) => new THREE.Vector2(r, y));
  for (const s of [-1, 1]) {
    for (const z of [2.2, 5.8]) {
      pods.push(P(new THREE.LatheGeometry(profile, 20), GOLD, { rz: (-s * Math.PI) / 2, x: s * 7.0, y: 7.4, z }));   // the lathe's +Y turned to face out along ±X
      grilles.push(new THREE.CircleGeometry(1.32, 24).rotateY((s * Math.PI) / 2).translate(s * 8.12, 7.4, z));
    }
    pods.push(P(box(1.4, 1.5, 2.6), GOLD, { x: s * 6.9, y: 7.4, z: 4 }));
  }
  group.add(mergedParts(pods, new THREE.MeshPhongMaterial({ color: GOLD, specular: 0xfff0b0, shininess: 70 })));
  const grille = canvasTexture(64, 64), back = canvasTexture(200, 120);
  group.add(new THREE.Mesh(mergeGeometries(grilles)!, new THREE.MeshBasicMaterial({ map: grille.tex })));
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(10, 6), new THREE.MeshBasicMaterial({ map: back.tex }));
  sign.position.set(0, 5.2, 10.03); group.add(sign);
  // the top-down drawing on the roof
  const roof = carRoof("golden-ticket");
  if (roof) { const m = new THREE.Mesh(new THREE.PlaneGeometry(roof.w * 0.9, roof.l * 0.9).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: roof.tex, alphaTest: 0.04 })); m.position.y = 9.2; group.add(m); }
  const paint = (t: number, night: number) => {
    paintGrille(grille.ctx, t, night); grille.tex.needsUpdate = true;
    paintBack(back.ctx, t, night); back.tex.needsUpdate = true;
    roof?.paint(t, night);
  };
  paint(0, 0);
  const ticket: Ticket = { group, paint };
  group.userData.ticket = ticket;
  return ticket;
}
