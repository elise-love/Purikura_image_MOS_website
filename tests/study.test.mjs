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
const webpStimuli = readdirSync(new URL("../public/stimuli", import.meta.url)).filter((name) => name.endsWith(".webp"));

test("contains 30 blinded image assets (27 formal + 3 repeats)", () => {
  assert.equal(stimuli.length, 30);
  assert.ok(stimuli.every((name) => /^P-\d{3}\.png$/.test(name)));
  assert.equal(webpStimuli.length, 30);
  assert.deepEqual(webpStimuli.map((name) => name.replace(/\.webp$/, ".png")).sort(), stimuli.sort());
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

test("naturalness instructions isolate image-processing quality", () => {
  for (const ignoredSubjectFactor of ["動作", "表情", "姿勢", "服裝", "造型", "裝飾外框"]) {
    assert.match(app, new RegExp(ignoredSubjectFactor));
  }
  for (const imageQualityCue of ["明暗", "曝光", "過亮", "過暗", "飽和", "膚色", "銳化", "邊緣", "處理痕跡"]) {
    assert.match(app, new RegExp(imageQualityCue));
  }
  assert.match(styles, /\.rating-hint \{/);
});

test("appeal instructions ignore subject styling but include the frame", () => {
  assert.match(app, /整體喜歡度[\s\S]*請忽略人物本身的動作、表情、姿勢、服裝與造型/);
  assert.match(app, /prompt="忽略人物的動作、表情、姿勢、服裝與造型；把照片當成包含外框的現場紀念成品，你整體有多喜歡？"/);
});

test("previous-photo navigation restores answers without duplicating rows", () => {
  assert.match(app, /function goToPreviousRating\(\)/);
  assert.match(app, /const previousRating = ratings\[previousIndex\]/);
  assert.match(app, /setAppeal\(previousRating\.appeal\)/);
  assert.match(app, /setNaturalness\(previousRating\.naturalness\)/);
  assert.match(app, /nextRatings\[currentIndex\] = \{/);
  assert.match(app, /currentIndex > 0 && <button[^>]*previous-button/);
  assert.match(styles, /\.rating-actions \{/);
});

test("each rating remounts the stimulus image and returns to the photo", () => {
  assert.match(app, /<picture key=\{`\$\{currentIndex\}-\$\{displayId\}`\}>/);
  assert.match(app, /data-display-id=\{displayId\}/);
  assert.match(app, /window\.scrollTo\(\{ top: 0, left: 0, behavior: "auto" \}\)/);
  assert.match(app, /照片載入中，請稍候/);
  assert.match(app, /onLoad=\{\(\) => setImageLoaded\(true\)\}/);
  assert.match(app, /disabled=\{!imageLoaded\}/);
  assert.match(app, /<source srcSet=\{stimulusUrl\(displayId, "webp"\)\} type="image\/webp" \/>/);
  assert.match(app, /const \[nextId, \.\.\.laterIds\] = sequence\.slice\(currentIndex \+ 1, currentIndex \+ 4\)/);
  assert.match(app, /nextPreload\.onload = \(\) => \{/);
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

test("Hsinchu default source filenames have no leading spaces", () => {
  assert.match(readme, /`Lab_default_0\.png` 對應 P-227（重複題 P-283）/);
  assert.match(readme, /`Lab_default_1\.png` 對應 P-262/);
  assert.match(readme, /`Lab_default_2\.png` 對應 P-244/);
  assert.equal(readme.includes("Hsinchu/ Lab_default_"), false);
});
