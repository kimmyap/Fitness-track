/**
 * The barrel's contract: `@/lib/domain` must keep meaning what it meant when it
 * was one 1,405-line file, and the split must stay acyclic.
 *
 * ~50 modules import from here. If a symbol stops being re-exported they break
 * at build time — but a CYCLE would not: TypeScript allows it, and the symptom
 * is an undefined const at runtime in whichever module happened to load second.
 * So the graph is asserted, not assumed.
 *
 * Sources come from `import.meta.glob(..., '?raw')` rather than node's fs: the
 * src tsconfig has no node types, and this reads the same module graph Vite
 * builds, so a file that stops being part of the bundle stops being checked.
 */
import { describe, it, expect } from 'vitest';
import * as domain from './index';

const RAW = import.meta.glob('./*.ts', { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>;

/** Module name → its source, excluding the barrel and the tests. */
const sources = Object.entries(RAW)
  .map(([path, src]) => [path.replace('./', '').replace('.ts', ''), src] as const)
  .filter(([name]) => name !== 'index' && !name.includes('.test'));

const siblingImports = (src: string): string[] =>
  [...src.matchAll(/from '\.\/([a-zA-Z]+)'/g)].map((m) => m[1]!);

describe('the domain barrel', () => {
  it('re-exports every module in the folder', () => {
    const barrel = RAW['./index.ts'] ?? '';
    for (const [name] of sources) {
      expect(barrel, `${name} is not re-exported`).toContain(`from './${name}'`);
    }
  });

  it('still exposes the whole surface the single file did', () => {
    // One or more per concern: if the barrel drops a module wholesale, at least
    // one of these goes undefined.
    const expected = [
      'isoDate', 'fmtNum', 'displayDateWithWeekday', // format
      'toDisplayWeight', 'barWeight', 'PLATE_SIZES', // units
      'computeTotalDisplayWeightWithMode', 'isBigJump', // weight
      'plateCalculator', // plates
      'epley1RM', 'volumeInRange', 'weeklyRecap', // volume
      'computeStats', 'trainingDates', // streaks
      'isPR', 'prHistory', // prs
      'lastLoggedWorkingSet', // history
      'suggestedNextWeight', // rpe
      'detectStall', 'warmupRamp', // progression
      'sessionSpanMinutes', // session
      'ACHIEVEMENTS', 'achievementTier', 'newlyUnlockedAchievements', // achievements
      'weeksSinceReview', 'daysSinceBackup', // misc
    ];
    for (const name of expected) {
      expect(domain[name as keyof typeof domain], `${name} missing from the barrel`).toBeDefined();
    }
  });
});

describe('the split stays acyclic', () => {
  it('has no module pair importing each other', () => {
    const graph = new Map(sources.map(([name, src]) => [name, siblingImports(src)]));
    const cycles: string[] = [];
    for (const [a, deps] of graph) {
      for (const b of deps) {
        if (graph.get(b)?.includes(a)) cycles.push(`${a} <-> ${b}`);
      }
    }
    expect(cycles).toEqual([]);
  });

  it('keeps the leaves leaves', () => {
    // These depend on nothing inside the folder, which is what makes the rest
    // safe to build on.
    const leaves = ['format', 'units', 'streaks', 'prs', 'history', 'session', 'misc'];
    for (const leaf of leaves) {
      const src = sources.find(([name]) => name === leaf)?.[1] ?? '';
      expect(siblingImports(src), `${leaf} gained a sibling import`).toEqual([]);
    }
  });

  it('no module imports the barrel, which would cycle through index', () => {
    for (const [name, src] of sources) {
      expect(siblingImports(src), `${name} imports the barrel`).not.toContain('index');
    }
  });
});
