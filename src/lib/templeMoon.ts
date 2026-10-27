/**
 * The Temple of the Moon (BRC 2026, TEMPLE-2026.md): a night-blooming cactus flower in pale timber, as a plan the top-down drawing and the 3D
 * build share. All in game feet round the Temple's centre (x east, y south, so 3D z = y; heights up), at this city's 1.5 times scale:
 * about 200 ft across including the fence in real feet is 300 ft here, the tower 30 ft real is 45 here, the stamen 50 to 52 ft real is about 76.
 *  - a circular fence (FENCE_R) with eight moon gates at 45 degrees (GATES), the entrance on the 6:00 side among them;
 *  - 20 free-standing pointed outer petals in a ring inside it, each turned about 70 degrees off the radius so no straight line leads in (PETALS);
 *  - five curved petal arms (ARMS) leaving the tower in a pinwheel and folding back on themselves as crescent walls of vertical slats;
 *  - the tower with its pentagon of pillars, five archways between them and a crown of 16 petals that opens at night (CROWN_N);
 *  - the stamen: eight slender bent stems each tipped with a glowing globe, rising to about 76 ft.
 * The sim's solid is still TEMPLE_R (120 ft) in brc.ts and the plaza and the map's navy disc are unchanged: FENCE_R sits inside both.
 */
export const FENCE_R = 150, GATES = 8, PETALS = 20, ARMS = 5, CROWN_N = 16, STEMS = 8;
export const TOWER_R = 13, TOWER_H = 30, CROWN_LEN = 17;

/** A point on arm k, s from 0 (at the tower) to 1 (its free end): where it is, the way it runs (a canvas angle), and how tall its wall stands there. */
export function armPoint(k: number, s: number): { x: number; y: number; a: number; h: number } {
  const th = -Math.PI / 2 + (k * 2 * Math.PI) / ARMS, p = (t: number) => { const r = 18 + 62 * Math.sin(0.75 * Math.PI * t), f = th + 1.9 * t; return { x: Math.cos(f) * r, y: Math.sin(f) * r }; };
  const q = p(s), e = 0.002, a0 = p(Math.max(0, s - e)), a1 = p(Math.min(1, s + e));
  return { x: q.x, y: q.y, a: Math.atan2(a1.y - a0.y, a1.x - a0.x), h: 16 + 12 * Math.sin(Math.PI * s) };
}
/** How long arm k is, in feet (to place its slats about `step` apart). */
export function armLength(k: number): number { let l = 0, prev = armPoint(k, 0); for (let i = 1; i <= 60; i++) { const q = armPoint(k, i / 60); l += Math.hypot(q.x - prev.x, q.y - prev.y); prev = q; } return l; }

/** The twenty outer petals: where each lies, the way its tip points (a canvas angle), and its size. Alternate ones sit a little nearer and further so the ring is not a circle. */
export function outerPetals(): { x: number; y: number; a: number; len: number; wid: number; h: number; ang: number }[] {
  return Array.from({ length: PETALS }, (_, k) => {
    const ang = (k / PETALS) * Math.PI * 2 + 0.16, r = 118 + (k % 2 ? 9 : -9), a = ang + 1.2;
    return { x: Math.cos(ang) * r, y: Math.sin(ang) * r, a, len: 30, wid: 15, h: 13 + (k % 3) * 2, ang };
  });
}

/** Gate j's angle round the fence (a canvas angle; 90 degrees is south, 6:00). */
export const gateAngle = (j: number) => (j * Math.PI * 2) / GATES;

/** Stem k of the stamen as a curve of points from the chamber's floor to its globe (u 0 to 1), and the globe's place. */
export function stemPoint(k: number, u: number): { x: number; y: number; h: number } {
  const a = (k / STEMS) * Math.PI * 2 + 0.3, top = 62 + 16 * ((k * 0.618) % 1), reach = (9 + 8 * ((k * 0.37) % 1)) * u ** 1.5 + 2 * u;
  return { x: Math.cos(a) * reach, y: Math.sin(a) * reach, h: 6 + (top - 6) * (1 - (1 - u) ** 1.6) };
}
export const stemTip = (k: number) => stemPoint(k, 1);
