import '@testing-library/jest-dom/vitest';

// Reset persisted state between tests: stores hydrate from localStorage at
// module load, so individual tests that care about hydration re-import or
// seed localStorage themselves. This keeps cross-test bleed out.
afterEach(() => {
  localStorage.clear();
});
