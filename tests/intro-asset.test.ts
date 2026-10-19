import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { inflateSync } from "node:zlib";

// Small dependency-free reader for the 8-bit RGBA PNGs used by this asset test.
function rgba(name: string) {
  const file = readFileSync(new URL(`../assets/intro/${name}`, import.meta.url));
  assert.equal(file.subarray(1, 4).toString(), "PNG");
  assert.equal(file[24], 8);
  assert.equal(file[25], 6);
  assert.equal(file[28], 0);
  const width = file.readUInt32BE(16);
  const height = file.readUInt32BE(20);
  const chunks: Buffer[] = [];
  for (let offset = 8; offset < file.length;) {
    const length = file.readUInt32BE(offset);
    if (file.toString("ascii", offset + 4, offset + 8) === "IDAT") chunks.push(file.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  const raw = inflateSync(Buffer.concat(chunks));
  const stride = width * 4;
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    assert.ok(filter <= 4);
    for (let x = 0; x < stride; x++) {
      const i = y * stride + x;
      const a = x >= 4 ? pixels[i - 4] : 0;
      const b = y > 0 ? pixels[i - stride] : 0;
      const c = y > 0 && x >= 4 ? pixels[i - stride - 4] : 0;
      const p = a + b - c;
      const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const predictor = filter === 0 ? 0 : filter === 1 ? a : filter === 2 ? b : filter === 3 ? Math.floor((a + b) / 2) : pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      pixels[i] = (raw[y * (stride + 1) + 1 + x] + predictor) & 255;
    }
  }
  return { width, height, bytes: file.length, pixel: (x: number, y: number) => Array.from(pixels.subarray((y * width + x) * 4, (y * width + x) * 4 + 4)) };
}

test("actual bus cutout is mobile-sized RGBA with background and mirror gap removed", () => {
  const cutout = rgba("samanvi-bus.png");
  assert.deepEqual([cutout.width, cutout.height], [817, 459]);
  assert.ok(cutout.bytes < 600_000);
  for (const [x, y] of [[30, 460], [810, 310], [808, 190], [40, 10]]) {
    assert.equal(cutout.pixel(x - 29, y - 7)[3], 0, `Background should be transparent at ${x},${y}`);
  }
});

test("coach branding, body, windows, wheels and mirror retain the photograph's exact pixels", () => {
  const original = rgba("samanvi-bus-original.png");
  const cutout = rgba("samanvi-bus.png");
  for (const [x, y] of [[280, 255], [670, 160], [400, 185], [445, 415], [165, 340], [830, 190], [400, 35], [680, 375]]) {
    assert.deepEqual(cutout.pixel(x - 29, y - 7), original.pixel(x, y), `Photo pixels must not be repainted at ${x},${y}`);
  }
});
