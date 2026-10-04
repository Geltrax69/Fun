// Feature 11d: swimming — water regions, surface height, and the climb-out
// (mantle) target search used by the player controller.
export const WATER_Y = -1.1;

/** Water surface y at (x, z), or null when not over water. */
export function waterSurfaceAt(x, z) {
  if (Math.abs(x) < 5.5 && z > -350 && z < 150) return WATER_Y; // canal + north reach
  if (z >= 150 && z < 350 && Math.abs(x) < 350) return WATER_Y; // sea
  return null;
}
