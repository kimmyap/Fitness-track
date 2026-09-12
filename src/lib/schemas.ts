/**
 * Runtime validation for everything read out of localStorage.
 *
 * `storage.ts` used to do `JSON.parse(raw) as T`. The `catch` around it only
 * protects against invalid JSON, never against the wrong SHAPE — so a
 * half-written record, or an object where an array belongs, sailed through the
 * cast and crashed somewhere far away in domain code.
 *
 * Two rules make adding this safe for real user data:
 *
 * 1. **Validate, never transform.** Callers check with `safeParse` and then use
 *    the ORIGINAL parsed value, never zod's output. Zod object schemas strip
 *    unknown keys, and this app must preserve fields it does not know about —
 *    a newer version's data opened by an older build has to survive.
 * 2. **Never widen a failure.** One malformed row must not discard a history.
 *    Array readers drop only the individual rows that fail; scalar and map
 *    readers fall back to their default. Nothing is ever written back as a
 *    result of validation (see `getEntries` in storage.ts).
 */
/*
 * zod/mini, not zod: same validation, a much smaller bundle. The full builder
 * API pulls in every method on every schema; mini exposes them as standalone
 * functions that tree-shake. This file only needs a dozen of them.
 */
import { z } from 'zod/mini';

const isoDate = z.string().check(z.regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD'));

/**
 * Optional flags are `true`-or-absent in legacy data. `.optional()` accepts
 * absent; a literal `false` is rejected as the shape violation it is.
 */
const trueOnly = z.optional(z.literal(true));

/** A logged lift set. Unknown keys are tolerated — see rule 1. */
export const liftSetSchema = z.looseObject({
  id: z.optional(z.string()), // absent in very old data; backfilled on read
  exercise: z.string().check(z.minLength(1)),
  weight: z.number(),
  sets: z.number(),
  reps: z.number(),
  date: isoDate,
  createdAt: z.optional(z.number()),
  rpe: z.optional(z.number()),
  variation: z.optional(z.string()),
  warmupSet: trueOnly,
  assistedPullup: trueOnly,
  dropSet: trueOnly,
  toFailure: trueOnly,
});

export const activitySchema = z.looseObject({
  id: z.optional(z.string()),
  type: z.literal('activity'),
  activity: z.enum(['Pilates', 'Volleyball']),
  date: isoDate,
});

export const completionSchema = z.looseObject({
  id: z.optional(z.string()),
  type: z.enum(['warmup', 'core']),
  date: isoDate,
});

/**
 * The heterogeneous entries array. Legacy discriminates on `exercise` being
 * truthy vs `type`, so this is a plain union rather than a discriminated one —
 * lift sets carry no `type` field at all.
 */
export const entrySchema = z.union([liftSetSchema, activitySchema, completionSchema]);

export const bodyweightSchema = z.looseObject({
  id: z.optional(z.string()),
  date: isoDate,
  weight: z.number(),
});

export const measurementSchema = z.looseObject({
  id: z.optional(z.string()),
  date: isoDate,
  waist: z.nullable(z.number()),
  hips: z.nullable(z.number()),
});

export const customExerciseSchema = z.looseObject({
  name: z.string().check(z.minLength(1)),
  goal: z.number(),
  targetSets: z.number(),
  targetReps: z.string(),
  prefillReps: z.number(),
  custom: z.literal(true),
  notes: z.nullable(z.string()),
  archived: z.optional(z.boolean()),
});

export const coreOverrideSchema = z.looseObject({ name: z.string(), target: z.string() });

export const equipmentWeightsSchema = z.looseObject({
  trapBar: z.nullable(z.number()),
  legPressSled: z.nullable(z.number()),
});

/**
 * A day's wellness metrics. Every field optional — a day with only sleep
 * recorded is valid — but a present field must be a number, so a half-written
 * `{ calories: "" }` is dropped rather than reaching the chart maths.
 */
export const dailyMetricSchema = z.looseObject({
  calories: z.optional(z.number()),
  protein: z.optional(z.number()),
  sleepHours: z.optional(z.number()),
  energy: z.optional(z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)])),
});

/** The "YYYY-MM-DD" key of a date-keyed map. */
export const dateKeySchema = isoDate;

export const cardioSessionSchema = z.looseObject({
  id: z.optional(z.string()), // backfilled on read, like entries
  date: isoDate,
  type: z.enum(['jog', 'treadmill', 'other']),
  minutes: z.number(),
  miles: z.optional(z.number()),
});

export const notesMapSchema = z.record(z.string(), z.string());
export const goalsMapSchema = z.record(z.string(), z.number());
export const customExercisesMapSchema = z.record(z.string(), z.array(customExerciseSchema));
export const excludedBuiltInsMapSchema = z.record(z.string(), z.array(z.string()));
export const coreOverridesMapSchema = z.record(z.string(), coreOverrideSchema);
export const weightInputModesSchema = z.record(z.string(), z.enum(['total', 'perSide']));
export const exerciseOrderSchema = z.record(z.string(), z.array(z.string()));
export const achievementsSchema = z.array(z.string());
export const daysSchema = z.array(z.string());

/** All these helpers need: mini and full zod both satisfy it. */
export interface ShapeCheck {
  safeParse: (value: unknown) => { success: boolean };
}

/**
 * Keep the rows that validate, report the ones that do not. Returns the
 * ORIGINAL objects, never zod's parsed copies, so unknown keys survive.
 */
export function keepValid<T>(
  value: unknown,
  schema: ShapeCheck,
  label: string,
): { rows: T[]; dropped: number } {
  if (!Array.isArray(value)) {
    console.warn(`${label}: expected an array, got ${typeof value} — ignoring it.`);
    return { rows: [], dropped: 0 };
  }
  const rows: T[] = [];
  let dropped = 0;
  for (const row of value) {
    if (schema.safeParse(row).success) rows.push(row as T);
    else dropped++;
  }
  if (dropped) console.warn(`${label}: ignored ${dropped} malformed row(s); the rest were kept.`);
  return { rows, dropped };
}

/**
 * Map equivalent of `keepValid`: keep the pairs whose key AND value both
 * validate, drop the rest.
 *
 * The rule above says map readers fall back to their default, and for the
 * config-shaped maps (notes, goals, input modes) that is right — they are
 * small and rewritable. A map that holds a HISTORY, one row per date, is a
 * different thing: falling back to `{}` would throw away every day over one
 * bad row, which is the loss rule 2 exists to prevent. Those readers use this.
 */
export function keepValidEntries<T>(
  value: unknown,
  keySchema: ShapeCheck,
  valueSchema: ShapeCheck,
  label: string,
): Record<string, T> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    console.warn(`${label}: expected an object, got ${typeof value} — ignoring it.`);
    return {};
  }
  const out: Record<string, T> = {};
  let dropped = 0;
  for (const [key, val] of Object.entries(value)) {
    if (keySchema.safeParse(key).success && valueSchema.safeParse(val).success) out[key] = val as T;
    else dropped++;
  }
  if (dropped) console.warn(`${label}: ignored ${dropped} malformed row(s); the rest were kept.`);
  return out;
}

/** Validate a whole value, falling back when it does not match. */
export function validOr<T>(value: unknown, schema: ShapeCheck, fallback: T, label: string): T {
  if (schema.safeParse(value).success) return value as T;
  console.warn(`${label}: stored value did not match its expected shape — using the default.`);
  return fallback;
}
