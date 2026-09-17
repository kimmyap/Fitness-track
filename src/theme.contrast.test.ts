/**
 * Contrast floor for the tokens that carry TEXT.
 *
 * This exists because a real gap shipped: `destructive` is tuned as a FILL
 * (it is paired with `onDestructive` on top of it) but was also used as the
 * colour of validation messages, the failed-save warning, the backup nag and
 * the negative trend figure. Measured in a browser it was 3.18:1 on `card` in
 * dark — below the 4.5:1 the accessibility rules in CLAUDE.md set, and not one
 * of the exceptions that file records as deliberate.
 *
 * The exceptions ARE deliberate and are asserted here too, as their documented
 * values rather than as a pass. If someone darkens `primary` to fix them, this
 * file fails and tells them to update the table in CLAUDE.md — a documented
 * gap that silently closes is how the docs drift.
 */
import { describe, it, expect } from 'vitest';
import { darkTheme, lightTheme } from './theme';
import type { AppTheme } from './theme';

/** WCAG 2.1 relative luminance. */
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)];
  const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  return Math.round(ratio * 100) / 100;
}

/** Every surface body text can land on. */
const surfaces = (t: AppTheme) => [
  ['card', t.colors.card],
  ['background', t.colors.background],
  ['muted', t.colors.muted],
] as const;

describe.each([
  ['dark', darkTheme],
  ['light', lightTheme],
])('%s theme text tokens clear 4.5:1', (_name, theme) => {
  it.each([
    ['foreground', theme.colors.foreground],
    ['cardForeground', theme.colors.cardForeground],
    ['mutedForeground', theme.colors.mutedForeground],
    ['destructiveText', theme.colors.destructiveText],
  ])('%s', (_token, colour) => {
    for (const [, surface] of surfaces(theme)) {
      expect(contrast(colour, surface)).toBeGreaterThanOrEqual(4.5);
    }
  });

  /** Tier words sit on cards only, and are always spelled out beside the colour. */
  it.each([
    ['tierBronze', theme.colors.tierBronze],
    ['tierSilver', theme.colors.tierSilver],
    ['tierGold', theme.colors.tierGold],
    ['tierPlatinum', theme.colors.tierPlatinum],
  ])('%s on card', (_token, colour) => {
    expect(contrast(colour, theme.colors.card)).toBeGreaterThanOrEqual(4.5);
  });
});

/**
 * The documented exceptions, pinned to the exact ratios CLAUDE.md states. A
 * change here is a change to that table, not a test to relax.
 */
describe('documented contrast exceptions still measure what CLAUDE.md says', () => {
  /**
   * Green text. Dark clears the floor; light does NOT — `accentText` is the
   * same hex as `accent` there, so the 3.30:1 CLAUDE.md accepts for the fill
   * is also what green TEXT measures on a white card. Recorded rather than
   * fixed: the palette exceptions are the owner's call, and this one is inside
   * the "look chosen over strict AA" set. It is pinned so that a future
   * darkening of the token has to come here and say so.
   */
  it('dark accentText clears 4.5:1 on every surface', () => {
    for (const surface of [darkTheme.colors.card, darkTheme.colors.background, darkTheme.colors.muted]) {
      expect(contrast(darkTheme.colors.accentText, surface)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('light accentText as text on card is 3.30:1', () => {
    expect(contrast(lightTheme.colors.accentText, lightTheme.colors.card)).toBe(3.3);
  });

  it('dark primary as text on card is 4.27:1', () => {
    expect(contrast(darkTheme.colors.primary, darkTheme.colors.card)).toBe(4.27);
  });

  it('light primary as text on card is 3.56:1', () => {
    expect(contrast(lightTheme.colors.primary, lightTheme.colors.card)).toBe(3.56);
  });

  it('light onPrimary on primary is 3.56:1', () => {
    expect(contrast(lightTheme.colors.onPrimary, lightTheme.colors.primary)).toBe(3.56);
  });

  it('light onAccent on accent is 3.30:1', () => {
    expect(contrast(lightTheme.colors.onAccent, lightTheme.colors.accent)).toBe(3.3);
  });

  /** Dark fills were measured as fine and must stay that way. */
  it('dark fills stay above 4.5:1', () => {
    expect(contrast(darkTheme.colors.onAccent, darkTheme.colors.accent)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(darkTheme.colors.onPrimary, darkTheme.colors.primary)).toBeGreaterThanOrEqual(4.5);
  });
});
