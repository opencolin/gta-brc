/**
 * PlayAlchemist's Pyramid stage (asked 2026-10-27): the one stage that is not a round drum. A four-sided pyramid, 70 ft tall on a square base 50 ft across,
 * standing in the stage's own place (the sim's stage is a solid circle of radius 36 at its centre, which is not changed: the square's corners are at 35.4 ft,
 * inside it, so a rider is stopped by the circle before ever touching the pyramid), with one face toward the parking bay and in it an opening with the DJ's booth.
 * The base would be 85 to 90 ft for a pyramid's usual proportions; that does not fit the circle, so the base is as wide as fits and the pyramid is steeper, not shorter.
 * Its edges carry LED strips that are pale by day and run warm to violet at night. Local frame, as both views use it: +x toward the bay, the base [-half, half] each way.
 */
export const PYRAMID = {
  key: "camp:playalchemist",
  /** half the base, ft */
  half: 25,
  height: 70,
  /** the opening in the bay-facing face: half its width and its height, ft */
  openHalf: 7, openH: 13,
  /** the deck in front of it, to this far out from the centre and half this wide */
  apron: 31, apronHalf: 10,
} as const;

/** How far the pyramid's face is from the centre at height y (the bay-facing face's plane, and every face's). */
export const faceAt = (y: number) => PYRAMID.half * (1 - y / PYRAMID.height);

/** The farthest any part of the pyramid, its strips and the apron reach from the centre, ft (inside the stage's solid radius). */
export const reach = () => Math.max(Math.hypot(PYRAMID.half + 0.4, PYRAMID.half + 0.4), Math.hypot(PYRAMID.apron, PYRAMID.apronHalf));

const STOPS: [number, number, number][] = [[255, 154, 77], [255, 95, 176], [142, 92, 255]];   // warm, pink, violet
/** The strips' colour at night for p in 0..1 (0 warm through pink to 1 violet), as sRGB 0..255. */
export function ledRgb(p: number): [number, number, number] {
  const q = Math.min(1, Math.max(0, p)) * 2, i = Math.min(1, Math.floor(q)), k = q - i, a = STOPS[i], b = STOPS[i + 1];
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}
/** The cycle along a strip: p for a strip position s (in strip segments) at time t seconds. */
export const ledPhase = (s: number, t: number) => 0.5 + 0.5 * Math.sin(t * 0.9 - s * 0.16);
/** The strips by day: pale. */
export const LED_DAY: [number, number, number] = [240, 234, 255];
