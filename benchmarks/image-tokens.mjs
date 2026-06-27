/**
 * Per-model image-token estimators. Given an image's pixel dimensions, return how
 * many tokens that image costs when sent to each model's vision API. Formulas are
 * from the official docs (see benchmarks/RESULTS.md for links) and are verified
 * against documented examples in image-tokens.test.ts.
 */

/** Claude: one visual token per 28×28 patch — `ceil(w/28) * ceil(h/28)`. */
export function claudeImageTokens(width, height) {
  return Math.ceil(width / 28) * Math.ceil(height / 28);
}

/**
 * GPT-4o (high detail): scale to fit within 2048×2048, then scale the shortest side
 * to 768, then `85 + 170 * tiles` where tiles cover the scaled image in 512px squares.
 */
export function gptImageTokens(width, height) {
  let w = width;
  let h = height;
  // 1. Fit within a 2048×2048 box (preserve aspect ratio).
  if (w > 2048 || h > 2048) {
    const s = 2048 / Math.max(w, h);
    w = Math.round(w * s);
    h = Math.round(h * s);
  }
  // 2. Scale so the shortest side is 768.
  const shortest = Math.min(w, h);
  if (shortest > 768) {
    const s = 768 / shortest;
    w = Math.round(w * s);
    h = Math.round(h * s);
  }
  // 3. Count 512px tiles.
  const tiles = Math.ceil(w / 512) * Math.ceil(h / 512);
  return 85 + 170 * tiles;
}

/** Gemini 2.0: ≤384×384 is a flat 258; otherwise `ceil(w/768) * ceil(h/768) * 258`. */
export function geminiImageTokens(width, height) {
  if (width <= 384 && height <= 384) return 258;
  return Math.ceil(width / 768) * Math.ceil(height / 768) * 258;
}

/** All three estimators keyed by model name, for table-building. */
export const IMAGE_TOKENS = {
  claude: claudeImageTokens,
  'gpt-4o': gptImageTokens,
  gemini: geminiImageTokens,
};
