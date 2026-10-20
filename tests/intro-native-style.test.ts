import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { busTransformOrigin } from "../src/ui/intro/motion";

test("tyre anchor passes the installed React Native DEV style processor at every layout size", () => {
  // Exercise the real native parser: browser rendering doesn't run this code.
  // Expo already supplies Babel/Flow tooling; no new test dependency is needed.
  const require = createRequire(import.meta.url);
  const { transformSync } = require("@babel/core");
  const filename = require.resolve("react-native/Libraries/StyleSheet/processTransformOrigin");
  const { code } = transformSync(readFileSync(filename, "utf8"), {
    filename, babelrc: false, configFile: false,
    plugins: [require.resolve("@babel/plugin-transform-flow-strip-types"), require.resolve("@babel/plugin-transform-modules-commonjs")],
  });
  const exports: { default?: (origin: number[]) => number[] } = {};
  runInNewContext(code, { exports, require, __DEV__: true }, { filename });
  assert.equal(typeof exports.default, "function");
  for (const viewport of [0, 320, 390, 430, 768]) {
    const width = viewport * 0.82;
    const height = width / (817 / 459);
    const origin = busTransformOrigin(width, height);
    assert.deepEqual(exports.default!(origin), origin);
    assert.ok(origin.every(Number.isFinite));
    assert.equal(origin[2], 0);
    if (width > 0) {
      assert.ok(Math.abs(origin[0] / width - 0.508) < 1e-12);
      assert.ok(Math.abs(origin[1] / height - 0.985) < 1e-12);
    }
  }
});
