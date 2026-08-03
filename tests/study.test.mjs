import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const stimuli = readdirSync(new URL("../public/stimuli", import.meta.url)).filter((name) => name.endsWith(".png"));

test("contains 30 blinded image assets (27 formal + 3 repeats)", () => {
  assert.equal(stimuli.length, 30);
  assert.ok(stimuli.every((name) => /^P-\d{3}\.png$/.test(name)));
});

test("public app source does not expose experimental condition labels", () => {
  for (const secret of ['"default"', '"best"', '"worst"', "Hsinchu", "Chiayi", "Tainan"]) {
    assert.equal(app.includes(secret), false, `public source leaked: ${secret}`);
  }
});

test("V1 contains 30 rating screens and no attention check", () => {
  const match = app.match(/const V1 = \[([\s\S]*?)\];/);
  assert.ok(match);
  const ids = [...match[1].matchAll(/"(P-\d{3})"/g)].map((item) => item[1]);
  assert.equal(ids.length, 30);
  assert.equal(ids.includes("P-210"), false);
  const expectedAssets = ids.map((id) => `${id}.png`).sort();
  assert.deepEqual(stimuli.sort(), expectedAssets);
});

test("test-retest pairs are separated by at least eight screens", () => {
  const match = app.match(/const V1 = \[([\s\S]*?)\];/);
  const ids = [...match[1].matchAll(/"(P-\d{3})"/g)].map((item) => item[1]);
  for (const [first, repeated] of [["P-257", "P-201"], ["P-227", "P-283"], ["P-243", "P-293"]]) {
    assert.ok(Math.abs(ids.indexOf(first) - ids.indexOf(repeated)) >= 8);
  }
});

test("mobile rating controls cannot force horizontal overflow", () => {
  assert.match(styles, /fieldset \{ min-inline-size: 0; \}/);
  assert.match(styles, /repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.rating-prompt \{[^}]*overflow-wrap: anywhere;/);
  assert.match(styles, /@media \(max-width: 560px\)[\s\S]*\.choice-grid \{ grid-template-columns: minmax\(0, 1fr\); \}/);
});
