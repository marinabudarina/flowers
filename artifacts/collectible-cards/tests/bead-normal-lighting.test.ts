import assert from "node:assert/strict";
import test from "node:test";
import { decodeNormals, localLight, shadeNormalPixels, shimmerAt, sparkleAt } from "../src/lib/bead-normal-lighting.ts";

test("OpenGL normals decode to unit vectors with positive Z", () => {
  const decoded = decodeNormals(new Uint8ClampedArray([128, 128, 255, 255, 220, 128, 220, 255]));
  for (let i = 0; i < decoded.length; i += 3) {
    assert.ok(Math.abs(Math.hypot(...decoded.slice(i, i + 3)) - 1) < .00001);
    assert.ok(decoded[i + 2] > 0);
  }
});

test("moving the pointer moves the light across the bead normals", () => {
  assert.ok(localLight(-1, 0).lx < 0);
  assert.ok(localLight(1, 0).lx > 0);
  const source = new Uint8ClampedArray([255, 20, 30, 150, 255, 20, 30, 150]);
  const normals = new Float32Array([-.8, 0, .6, .8, 0, .6]);
  const active = new Uint32Array([0, 1]);
  const left = new Uint8ClampedArray(8), right = new Uint8ClampedArray(8);
  shadeNormalPixels(source, normals, active, left, -1, 0, 2);
  shadeNormalPixels(source, normals, active, right, 1, 0, 2);
  assert.ok(left[3] > left[7], "Left-facing bead catches the light from the left");
  assert.ok(right[7] > right[3], "Right-facing bead catches the light from the right");
});

test("unlit beads keep saturated emissive color, and transparent pixels stay empty", () => {
  const source = new Uint8ClampedArray([0, 25, 255, 150, 0, 0, 0, 0]);
  const output = new Uint8ClampedArray(8);
  shadeNormalPixels(source, new Float32Array([0, 0, -1, 0, 0, 1]), new Uint32Array([0]), output, 0, 0, 2);
  assert.equal(output[2], 255);
  assert.ok(output[3] >= 150 * .31);
  assert.ok(output[3] < 150 * .65, "Unlit areas should be distinctly darker");
  assert.deepEqual([...output.slice(4)], [0, 0, 0, 0]);
});

test("a visibly brighter light footprint follows the cursor in both axes, without time-based animation", () => {
  const size = 64, count = size * size;
  const source = new Uint8ClampedArray(count * 4), normals = new Float32Array(count * 3);
  const active = Uint32Array.from({ length: count }, (_, i) => i);
  for (let i = 0; i < count; i++) {
    source.set([255, 25, 35, 96], i * 4);
    normals[i * 3 + 2] = 1;
  }
  function measure(tx: number, ty: number) {
    const output = new Uint8ClampedArray(source.length);
    shadeNormalPixels(source, normals, active, output, tx, ty, size);
    let mass = 0, x = 0, y = 0, peak = 0;
    for (let i = 0; i < count; i++) {
      const alpha = output[i * 4 + 3];
      const weight = Math.max(0, alpha - 96);
      mass += weight; x += (i % size) * weight; y += Math.floor(i / size) * weight;
      peak = Math.max(peak, alpha);
    }
    assert.ok(peak > 150, "The light must be visibly brighter than the 96-alpha artwork");
    return { x: x / mass, y: y / mass, output };
  }
  assert.ok(measure(.8, 0).x - measure(-.8, 0).x > size * .3);
  assert.ok(measure(0, .8).y - measure(0, -.8).y > size * .3);
  assert.deepEqual(measure(.4, -.3).output, measure(.4, -.3).output);
});

test("cursor-lit beads are at least three times brighter than matching unlit beads", () => {
  const size = 64, count = size * size;
  const source = new Uint8ClampedArray(count * 4), normals = new Float32Array(count * 3);
  const active = Uint32Array.from({ length: count }, (_, i) => i);
  for (let i = 0; i < count; i++) {
    source.set([255, 25, 35, 96], i * 4);
    normals[i * 3 + 2] = 1;
  }
  const output = new Uint8ClampedArray(source.length);
  shadeNormalPixels(source, normals, active, output, -.8, 0, size);
  const lit = output[(32 * size + 17) * 4 + 3];
  const unlit = output[(32 * size + 54) * 4 + 3];
  assert.ok(lit > unlit * 3, `Expected strong contrast; got ${lit} lit vs ${unlit} unlit`);
  assert.ok(unlit > 0, "Shadowed beads must retain some colored fill");
});

test("shimmer travels diagonally, stays bounded, and is off without animation time", () => {
  assert.equal(shimmerAt(0, 0), 0);
  assert.equal(shimmerAt(0, 0, 2.9), 1);
  assert.equal(shimmerAt(.4, 0, 2.9), 0);
  assert.ok(shimmerAt(.4, 0, 2.9 + .4 / 2.4 * 5.8) > .99);
  for (let time = 0; time < 12; time += .1) {
    const value = shimmerAt(.2, -.1, time);
    assert.ok(value >= 0 && value <= 1);
  }
});

test("sparkles fade, pause, and select different valid beads over time", () => {
  assert.equal(sparkleAt(0, 0, 1000).strength, 0);
  assert.ok(sparkleAt(.575, 0, 1000).strength > .99);
  assert.equal(sparkleAt(1.8, 0, 1000).strength, 0);
  const positions = new Set<number>();
  for (let cycle = 0; cycle < 12; cycle++) {
    const sparkle = sparkleAt(cycle * 2.7 + .575, 0, 1000);
    assert.ok(sparkle.index >= 0 && sparkle.index < 1000);
    positions.add(sparkle.index);
  }
  assert.ok(positions.size > 8, "Sparkles should not repeat at a fixed spot");
});
