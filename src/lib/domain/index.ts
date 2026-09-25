/**
 * The domain layer: pure business logic, no storage and no React.
 *
 * This was one 1,405-line file with 106 exports across thirteen unrelated
 * concerns, imported by ~50 modules. The split is along those concerns, and
 * this barrel re-exports every one of them — so not a single call site moved,
 * and `@/lib/domain` still means what it always did.
 *
 * The dependency graph is one-way and shallow, which the single file could not
 * show you:
 *
 *   dates, types            (outside this folder)
 *     format, units, streaks, prs, history, session, misc   leaves
 *     weight      <- units
 *     plates      <- units
 *     volume      <- streaks
 *     rpe         <- format, units
 *     progression <- units, weight, rpe
 *     achievements<- units, volume, streaks, prs
 *
 * Adding a cycle here is now a visible act rather than an accident.
 */
export * from './format';
export * from './units';
export * from './weight';
export * from './plates';
export * from './volume';
export * from './streaks';
export * from './prs';
export * from './history';
export * from './rpe';
export * from './progression';
export * from './session';
export * from './achievements';
export * from './misc';
