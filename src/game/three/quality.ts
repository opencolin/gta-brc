/**
 * What the 3D view is built for (PLAN-3D.md 5.3), fixed when the renderer mounts, before anything is built: `touch` is a phone or a tablet,
 * which gets smaller textures (the art decals and the car roofs at two thirds of their pixels or half, the surround's painting at 1024),
 * four night lamps instead of ten, no headlight, no glow pass and a pixel ratio that gives way when frames run long.
 */
export const quality = { touch: false };
