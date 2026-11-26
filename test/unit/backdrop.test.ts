import { expect, it } from "vitest";
import { backdropBox } from "../../src/lib/backdrop";

// a 20x10 grey picture with a dark square at columns 8-11, rows 3-6
const picture = (border = 128) => {
  const data = new Uint8ClampedArray(20 * 10 * 4);
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 20; x++) {
      const inside = x >= 8 && x <= 11 && y >= 3 && y <= 6;
      const edge = x === 0 || y === 0 || x === 19 || y === 9;
      const v = inside ? 20 : edge ? border : 128 + (y % 3); // a slightly uneven backdrop
      data.set([v, v, v, 255], (y * 20 + x) * 4);
    }
  }
  return data;
};

it("finds the subject on a plain backdrop", () => {
  expect(backdropBox(picture(), 20, 10)).toEqual({ x: 0.4, y: 0.3, w: 0.2, h: 0.4 });
});

it("leaves a picture without a plain border alone", () => {
  expect(backdropBox(picture(250), 20, 10)).toBeNull();
});

it("leaves a subject that fills the picture alone", () => {
  const data = new Uint8ClampedArray(20 * 10 * 4).fill(128);
  for (let y = 1; y < 9; y++) for (let x = 1; x < 19; x++) data.set([0, 0, 0], (y * 20 + x) * 4);
  expect(backdropBox(data, 20, 10)).toBeNull();
});
