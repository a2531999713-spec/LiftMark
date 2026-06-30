export function clampSize(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function compactByWidth(width: number) {
  return width < 380;
}

export function comfortableByWidth(width: number) {
  return width >= 430;
}
