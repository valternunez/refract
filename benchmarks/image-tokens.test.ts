import { describe, expect, it } from 'vitest';
// @ts-expect-error — plain-JS sibling module, no .d.ts
import { claudeImageTokens, geminiImageTokens, gptImageTokens } from './image-tokens.mjs';

// Each assertion is a documented example from the model's own vision docs, so a
// future edit to the formulas can't silently change the headline numbers.
describe('image-token formulas', () => {
  it('Claude: ceil(w/28)*ceil(h/28)', () => {
    expect(claudeImageTokens(1000, 1000)).toBe(1296); // 36 * 36
    expect(claudeImageTokens(28, 28)).toBe(1);
  });

  it('GPT-4o: 85 + 170*tiles after the resize rules', () => {
    expect(gptImageTokens(1024, 1024)).toBe(765); // → 768×768 → 4 tiles → 85+680
    expect(gptImageTokens(512, 512)).toBe(255); // 1 tile → 85+170
  });

  it('Gemini: 258 when small, else 258 per 768 tile', () => {
    expect(geminiImageTokens(300, 300)).toBe(258);
    expect(geminiImageTokens(384, 384)).toBe(258);
    expect(geminiImageTokens(800, 800)).toBe(1032); // 2 * 2 * 258
  });
});
