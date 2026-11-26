/** The part of a picture that is not plain backdrop, as fractions of its width and height. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** How far a channel may stray from the backdrop colour and still count as backdrop (0-255). */
const TOLERANCE = 28;

/**
 * Finds the subject of a museum-style photograph: an object on a plain studio backdrop.
 * `data` is RGBA pixels, as from `getImageData`, best taken from a small copy (about 64px).
 * Returns null when the border is not one plain colour (a painting, a landscape) or the subject
 * already fills most of the picture, so only plain backdrop is ever cropped.
 */
export function backdropBox(data: ArrayLike<number>, width: number, height: number): Box | null {
  const at = (x: number, y: number) => (y * width + x) * 4;
  const border: number[] = [];
  for (let x = 0; x < width; x++) border.push(at(x, 0), at(x, height - 1));
  for (let y = 1; y < height - 1; y++) border.push(at(0, y), at(width - 1, y));
  const mean = [0, 1, 2].map((c) => border.reduce((sum, i) => sum + data[i + c], 0) / border.length);
  const differs = (i: number) => [0, 1, 2].some((c) => Math.abs(data[i + c] - mean[c]) > TOLERANCE);
  if (border.filter(differs).length > border.length * 0.1) return null;

  let [x0, y0, x1, y1] = [width, height, -1, -1];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!differs(at(x, y))) continue;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  }
  if (x1 < 0) return null;
  const box = { x: x0 / width, y: y0 / height, w: (x1 + 1 - x0) / width, h: (y1 + 1 - y0) / height };
  return box.w * box.h > 0.5 ? null : box;
}
