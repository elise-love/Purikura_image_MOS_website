import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import {
  buildRandomizedSequence,
  FORMAL_IDS,
  MIN_INTERVENING_SCREENS,
  REPEAT_PAIRS,
} from "../src/sequence.ts";

const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const sequenceSource = readFileSync(new URL("../src/sequence.ts", import.meta.url), "utf8");
const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const receiver = readFileSync(new URL("../google-apps-script/Code.gs", import.meta.url), "utf8");
const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
const stimuli = readdirSync(new URL("../public/stimuli", import.meta.url)).filter((name) => name.endsWith(".png"));

test("contains 30 blinded image assets (27 formal + 3 repeats)", () => {
  assert.equal(stimuli.length, 30);
  assert.ok(stimuli.every((name) => /^P-\d{3}\.png$/.test(name)));
});

test("public app source does not expose experimental condition labels", () => {
  for (const secret of ['"default"', '"best"', '"worst"', "Hsinchu", "Chiayi", "Tainan"]) {
    assert.equal(`${app}\n${sequenceSource}`.includes(secret), false, `public source leaked: ${secret}`);
  }
});

test("stimulus plan contains 27 formal screens and three hidden repeats", () => {
  assert.equal(FORMAL_IDS.length, 27);
  assert.equal(REPEAT_PAIRS.length, 3);
  const ids = [...FORMAL_IDS, ...REPEAT_PAIRS.map((pair) => pair.repeat)];
  assert.equal(new Set(ids).size, 30);
  const expectedAssets = ids.map((id) => `${id}.png`).sort();
  assert.deepEqual(stimuli.sort(), expectedAssets);
});

test("participant-specific sequences are deterministic and constrained", () => {
  const observedOrders = new Set();
  for (let index = 0; index < 500; index += 1) {
    const participantId = `MOS-TEST-${index}`;
    const first = buildRandomizedSequence(participantId);
    const second = buildRandomizedSequence(participantId);
    assert.deepEqual(first, second);
    assert.equal(first.sequence.length, 30);
    assert.equal(new Set(first.sequence).size, 30);
    assert.match(first.sequenceVersion, /^R1-[0-9a-f]{8}$/);
    for (const pair of REPEAT_PAIRS) {
      const intervening = Math.abs(first.sequence.indexOf(pair.original) - first.sequence.indexOf(pair.repeat)) - 1;
      assert.ok(intervening >= MIN_INTERVENING_SCREENS);
    }
    observedOrders.add(first.sequence.join(","));
  }
  assert.ok(observedOrders.size > 490);
});

test("mobile rating controls cannot force horizontal overflow", () => {
  assert.match(styles, /fieldset \{ min-inline-size: 0; \}/);
  assert.match(styles, /repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.rating-prompt \{[^}]*overflow-wrap: anywhere;/);
  assert.match(styles, /@media \(max-width: 560px\)[\s\S]*\.choice-grid \{ grid-template-columns: minmax\(0, 1fr\); \}/);
});

test("Google Sheets receiver writes linked participant and rating tables", () => {
  assert.match(receiver, /MOS_participants/);
  assert.match(receiver, /MOS_ratings/);
  assert.match(receiver, /participantRowsAdded:\s*1/);
  assert.match(receiver, /ratingRowsAdded:\s*ratingRows\.length/);
  assert.match(receiver, /repeat_mae_appeal/);
  assert.match(receiver, /repeat_mae_naturalness/);
  assert.equal(receiver.includes("deleteSheet"), false);
});

test("Hsinchu best style-2 mapping uses the corrected source filename", () => {
  assert.match(readme, /Lab_best_2\.png/);
  assert.match(readme, /P-257（重複題 P-201）/);
  assert.equal(readme.includes("Lab_default_1.png` 的條件名稱有歧義"), false);
});
