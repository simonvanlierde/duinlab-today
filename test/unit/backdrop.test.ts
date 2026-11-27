import { expect, it } from "vitest";
import { backdropBox } from "../../src/lib/backdrop";

const [W, H] = [20, 10];
/** A W x H picture: `colour(x, y)` gives each pixel's RGB, on a grey 128 backdrop by default. */
const picture = (colour: (x: number, y: number) => number[] | undefined) => {
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) data.set([...(colour(x, y) ?? [128, 128, 128]), 255], (y * W + x) * 4);
  }
  return data;
};
// a dark square at columns 8-11, rows 3-6
const square = (x: number, y: number) => (x >= 8 && x <= 11 && y >= 3 && y <= 6 ? [20, 20, 20] : undefined);
const expectBox = (box: ReturnType<typeof backdropBox>, want: { x: number; y: number; w: number; h: number }) => {
  expect(box).not.toBeNull();
  for (const key of ["x", "y", "w", "h"] as const) expect(box?.[key]).toBeCloseTo(want[key]);
};

it("finds the subject on a plain backdrop, with a margin on each side", () => {
  // the backdrop is slightly uneven inside, as a real one is
  const data = picture((x, y) => square(x, y) ?? [128 + (y % 3), 128, 128]);
  expectBox(backdropBox(data, W, H), { x: 0.36, y: 0.26, w: 0.28, h: 0.48 });
});

it("leaves a picture without a plain border alone", () => {
  const edge = (x: number, y: number) => x === 0 || y === 0 || x === W - 1 || y === H - 1;
  expect(
    backdropBox(
      picture((x, y) => square(x, y) ?? (edge(x, y) ? [250, 250, 250] : undefined)),
      W,
      H,
    ),
  ).toBeNull();
});

it("leaves a subject that fills the picture alone", () => {
  const inner = (x: number, y: number) => (x > 0 && y > 0 && x < W - 1 && y < H - 1 ? [0, 0, 0] : undefined);
  expect(backdropBox(picture(inner), W, H)).toBeNull();
});

// the border has 56 pixels; up to 10% of them may differ, for a subject that touches an edge
it("allows a subject to touch the border, and keeps the margin inside the picture", () => {
  const touching = (x: number, y: number) => square(x, y) ?? (y === 0 && x >= 8 && x < 11 ? [20, 20, 20] : undefined);
  expectBox(backdropBox(picture(touching), W, H), { x: 0.36, y: 0, w: 0.28, h: 0.74 });
});

it("treats a border that differs in more than a tenth of its pixels as not plain", () => {
  const many = (x: number, y: number) => square(x, y) ?? (y === 0 && x >= 6 && x < 12 ? [20, 20, 20] : undefined);
  expect(backdropBox(picture(many), W, H)).toBeNull();
});

it("reads the side columns as border too", () => {
  expect(
    backdropBox(
      picture((x, y) => (x === 0 && y > 0 && y < H - 1 ? [20, 20, 20] : undefined)),
      W,
      H,
    ),
  ).toBeNull();
});

it("counts one channel just past the tolerance as subject, and one just within as backdrop", () => {
  const dot = (red: number) => (x: number, y: number) => (x === 10 && y === 5 ? [red, 128, 128] : undefined);
  expect(backdropBox(picture(dot(128 + 29)), W, H)).not.toBeNull();
  expect(backdropBox(picture(dot(128 + 28)), W, H)).toBeNull();
});

it("leaves a one-pixel picture alone", () => {
  expect(backdropBox(new Uint8ClampedArray([9, 9, 9, 255]), 1, 1)).toBeNull();
});
