export const FORMAL_IDS = [
  "P-265", "P-244", "P-204", "P-241", "P-261", "P-245", "P-284", "P-279",
  "P-218", "P-257", "P-216", "P-288", "P-262", "P-219", "P-227", "P-243",
  "P-258", "P-249", "P-250", "P-230", "P-272", "P-237", "P-290", "P-267",
  "P-214", "P-202", "P-259",
] as const;

export const REPEAT_PAIRS = [
  { original: "P-257", repeat: "P-201" },
  { original: "P-227", repeat: "P-283" },
  { original: "P-243", repeat: "P-293" },
] as const;

export const MIN_INTERVENING_SCREENS = 8;
const SEQUENCE_ALGORITHM = "R1";

function seedFromString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number) {
  return () => {
    let value = seed += 0x6d2b79f5;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: readonly T[], random: () => number) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function gapAfterInsertion(sourceIndex: number, insertIndex: number) {
  const finalSourceIndex = insertIndex <= sourceIndex ? sourceIndex + 1 : sourceIndex;
  return Math.abs(insertIndex - finalSourceIndex) - 1;
}

export function buildRandomizedSequence(participantId: string) {
  const seed = seedFromString(`${SEQUENCE_ALGORITHM}:${participantId}`);
  const random = mulberry32(seed);
  const sequence: string[] = shuffled(FORMAL_IDS, random);
  const repeatIds = new Set<string>(REPEAT_PAIRS.map((pair) => pair.repeat));

  for (const pair of shuffled(REPEAT_PAIRS, random)) {
    const sourceIndex = sequence.indexOf(pair.original);
    const validSlots = Array.from({ length: sequence.length + 1 }, (_, index) => index)
      .filter((index) => gapAfterInsertion(sourceIndex, index) >= MIN_INTERVENING_SCREENS)
      .filter((index) => !repeatIds.has(sequence[index - 1]) && !repeatIds.has(sequence[index]));

    if (validSlots.length === 0) {
      throw new Error("Unable to construct a valid randomized MOS sequence.");
    }

    const insertIndex = validSlots[Math.floor(random() * validSlots.length)];
    sequence.splice(insertIndex, 0, pair.repeat);
  }

  return {
    sequence,
    sequenceVersion: `${SEQUENCE_ALGORITHM}-${seed.toString(16).padStart(8, "0")}`,
  };
}
