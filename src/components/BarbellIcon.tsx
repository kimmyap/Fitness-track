/**
 * Barbell icon — lucide has no barbell, so this is built with lucide's own
 * factory so it inherits size/color/strokeWidth and is type-compatible with
 * `LucideIcon` everywhere the icon maps are used.
 *
 * Glyph: two plates per side on a straight bar.
 */
import { createLucideIcon } from 'lucide-react';

export const BarbellIcon = createLucideIcon('Barbell', [
  ['path', { d: 'M3 8v8', key: 'plate-outer-left' }],
  ['path', { d: 'M6 6v12', key: 'plate-inner-left' }],
  ['path', { d: 'M6 12h12', key: 'bar' }],
  ['path', { d: 'M18 6v12', key: 'plate-inner-right' }],
  ['path', { d: 'M21 8v8', key: 'plate-outer-right' }],
]);
