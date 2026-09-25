/**
 * Exercise library picker: search, filter, and inspect the 876-exercise
 * library, then hand a chosen exercise back to the caller.
 *
 * The library is loaded on demand (its own ~188 KB gzipped chunk), so this
 * component shows a loading state on first open and nothing at all until the
 * user asks for it.
 */
import { useEffect, useMemo, useState } from 'react';
import styled from '@emotion/styled';
import { ChevronLeft, Dumbbell, Search } from 'lucide-react';
import { Badge, Button, EmptyState, Field, FieldLabel, Modal, Skeleton, TextInput } from '@/components';
import { alternativesFor, type LibraryExercise } from '@/services/exerciseLibraryService';
import { useExerciseLibrary } from '@/services/useExerciseLibrary';
import { Muted, Row, SelectBase, Stack } from './ui';

/** Categories that belong in a lifting tracker; the rest are opt-in. */
const LIFTING_CATEGORIES = ['strength', 'powerlifting', 'olympic weightlifting', 'strongman'];

/** Rendering all 876 rows janks on a phone; refine-to-narrow instead. */
const MAX_RESULTS = 60;

const ScrollArea = styled.div`
  max-height: 55vh;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
`;

const ResultList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[1]};
`;

const ResultButton = styled.button`
  width: 100%;
  min-height: ${({ theme }) => theme.touchTarget};
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${({ theme }) => theme.space[1]};
  padding: ${({ theme }) => theme.space[3]};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.muted};
  color: ${({ theme }) => theme.colors.foreground};
  font-family: ${({ theme }) => theme.typography.body};
  font-size: ${({ theme }) => theme.typography.fontSizes.sm};
  text-align: left;
  cursor: pointer;

  &:hover {
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

const ResultName = styled.span`
  font-family: ${({ theme }) => theme.typography.display};
  font-weight: 600;
  font-size: ${({ theme }) => theme.typography.fontSizes.md};
`;

const FilterRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.space[2]};
`;

const CueList = styled.ol`
  margin: 0;
  padding-left: ${({ theme }) => theme.space[5]};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[2]};
  font-size: ${({ theme }) => theme.typography.fontSizes.sm};
  line-height: ${({ theme }) => theme.typography.lineHeight};
`;

const DemoImage = styled.img`
  width: 100%;
  max-width: 320px;
  border-radius: ${({ theme }) => theme.radii.md};
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.muted};
`;

const CheckboxRow = styled.label`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
  min-height: ${({ theme }) => theme.touchTarget};
  font-size: ${({ theme }) => theme.typography.fontSizes.sm};
  cursor: pointer;
`;

/** "HORIZONTAL_PUSH" → "Horizontal push" */
export function humanizePattern(pattern: string): string {
  const words = pattern.toLowerCase().replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** "EZ_CURL_BAR" → "EZ curl bar" */
export function humanizeEquipment(equipment: string): string {
  if (equipment === 'EZ_CURL_BAR') return 'EZ curl bar';
  const words = equipment.toLowerCase().replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export interface ExercisePickerFilters {
  query: string;
  muscle: string;
  equipment: string;
  includeNonLifting: boolean;
}

/** Pure filter step, unit-tested separately from the component. */
export function filterExercises(
  library: LibraryExercise[],
  { query, muscle, equipment, includeNonLifting }: ExercisePickerFilters,
): LibraryExercise[] {
  const q = query.trim().toLowerCase();
  return library.filter((ex) => {
    if (!includeNonLifting && !LIFTING_CATEGORIES.includes(ex.category)) return false;
    if (muscle && !ex.primary_muscles.includes(muscle)) return false;
    if (equipment && ex.equipment !== equipment) return false;
    if (q && !ex.name.toLowerCase().includes(q)) return false;
    return true;
  });
}

export interface ExercisePickerProps {
  open: boolean;
  onClose: () => void;
  /** Called with the chosen exercise; the picker closes itself afterwards. */
  onSelect?: (exercise: LibraryExercise) => void;
  /**
   * 'select' (default) offers "Use this exercise"; 'browse' is read-only
   * reference, for looking a movement up outside the add-exercise flow.
   */
  mode?: 'select' | 'browse';
  /** Dialog heading for the results view. */
  title?: string;
}

export function ExercisePicker({
  open,
  onClose,
  onSelect,
  mode = 'select',
  title = 'Exercise library',
}: ExercisePickerProps) {
  /*
   * `open` gates the load: never on mount, or the 1.2 MB chunk downloads for
   * everyone whether they open the picker or not.
   */
  const { status, library, retry } = useExerciseLibrary(open);
  const loadFailed = status === 'failed';
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState('');
  const [equipment, setEquipment] = useState('');
  const [includeNonLifting, setIncludeNonLifting] = useState(false);
  const [detail, setDetail] = useState<LibraryExercise | null>(null);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [detail]);

  const muscles = useMemo(
    () => [...new Set((library ?? []).flatMap((e) => e.primary_muscles))].sort((a, b) => a.localeCompare(b)),
    [library],
  );
  const equipmentTypes = useMemo(
    () => [...new Set((library ?? []).map((e) => e.equipment))].sort((a, b) => a.localeCompare(b)),
    [library],
  );

  const matches = useMemo(
    () => (library ? filterExercises(library, { query, muscle, equipment, includeNonLifting }) : []),
    [library, query, muscle, equipment, includeNonLifting],
  );
  const shown = matches.slice(0, MAX_RESULTS);

  const close = () => {
    setDetail(null);
    onClose();
  };

  const choose = (exercise: LibraryExercise) => {
    onSelect?.(exercise);
    setDetail(null);
    onClose();
  };

  const alternatives = detail && library ? alternativesFor(detail) : [];

  return (
    <Modal open={open} onClose={close} title={detail ? detail.name : title}>
      {loadFailed ? (
        <EmptyState
          icon={Dumbbell}
          title="Couldn't load the exercise library"
          description="Check your connection and try again."
          action={
            <Button onClick={retry}>Retry</Button>
          }
        />
      ) : !library ? (
        <Stack gap={2}>
          <Skeleton height="44px" />
          <Skeleton height="64px" />
          <Skeleton height="64px" />
          <Skeleton height="64px" />
          <Muted>Loading 876 exercises…</Muted>
        </Stack>
      ) : detail ? (
        <Stack gap={3}>
          <Row>
            <Button variant="secondary" onClick={() => setDetail(null)}>
              <ChevronLeft size={16} aria-hidden="true" /> Back to results
            </Button>
          </Row>

          <Row wrap>
            <Badge>{humanizeEquipment(detail.equipment)}</Badge>
            <Badge>{humanizePattern(detail.movement_pattern)}</Badge>
            <Badge>{detail.level}</Badge>
            {detail.default_setup.is_unilateral ? <Badge>Single side</Badge> : null}
          </Row>

          <div>
            <strong>Works:</strong> {detail.primary_muscles.join(', ')}
            {detail.secondary_muscles.length ? (
              <Muted as="div">Also: {detail.secondary_muscles.join(', ')}</Muted>
            ) : null}
          </div>

          {detail.default_setup.supports_plate_calculator ? (
            <Muted>
              Plate-loaded — the logging form will offer plates-per-side with a{' '}
              {detail.default_setup.bar_weight_lbs}lb bar.
            </Muted>
          ) : null}

          <ScrollArea>
            <Stack gap={3}>
              {detail.images.length && !imageFailed ? (
                <DemoImage
                  src={detail.images[0]}
                  alt={`${detail.name} demonstration`}
                  loading="lazy"
                  onError={() => setImageFailed(true)}
                />
              ) : null}

              <div>
                <strong>How to do it</strong>
                <CueList>
                  {detail.execution_cues.map((cue, i) => (
                    <li key={i}>{cue}</li>
                  ))}
                </CueList>
              </div>

              {alternatives.length ? (
                <div>
                  <strong>Similar exercises</strong>
                  <ResultList>
                    {alternatives.map((alt) => (
                      <li key={alt.id}>
                        <ResultButton type="button" onClick={() => setDetail(alt)}>
                          <ResultName>{alt.name}</ResultName>
                          <Muted as="span">{humanizeEquipment(alt.equipment)}</Muted>
                        </ResultButton>
                      </li>
                    ))}
                  </ResultList>
                </div>
              ) : null}
            </Stack>
          </ScrollArea>

          {mode === 'select' ? <Button onClick={() => choose(detail)}>Use {detail.name}</Button> : null}
        </Stack>
      ) : (
        <Stack gap={3}>
          <TextInput
            label={
              <>
                <Search size={14} aria-hidden="true" /> Search exercises
              </>
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />

          <FilterRow>
            <Field>
              <FieldLabel htmlFor="picker-muscle">Muscle</FieldLabel>
              <SelectBase id="picker-muscle" value={muscle} onChange={(e) => setMuscle(e.target.value)}>
                <option value="">Any muscle</option>
                {muscles.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </SelectBase>
            </Field>
            <Field>
              <FieldLabel htmlFor="picker-equipment">Equipment</FieldLabel>
              <SelectBase id="picker-equipment" value={equipment} onChange={(e) => setEquipment(e.target.value)}>
                <option value="">Any equipment</option>
                {equipmentTypes.map((eq) => (
                  <option key={eq} value={eq}>
                    {humanizeEquipment(eq)}
                  </option>
                ))}
              </SelectBase>
            </Field>
          </FilterRow>

          <CheckboxRow>
            <input
              type="checkbox"
              checked={includeNonLifting}
              onChange={(e) => setIncludeNonLifting(e.target.checked)}
            />
            <span>
              Include stretches and cardio <Muted as="span">(off by default)</Muted>
            </span>
          </CheckboxRow>

          <Muted aria-live="polite">
            {matches.length === 0
              ? 'No matches'
              : shown.length < matches.length
                ? `Showing ${shown.length} of ${matches.length} matches — narrow your search to see the rest`
                : `${matches.length} ${matches.length === 1 ? 'match' : 'matches'}`}
          </Muted>

          <ScrollArea>
            {matches.length === 0 ? (
              <EmptyState
                icon={Search}
                title="Nothing matched"
                description="Try a shorter search, or clear the muscle and equipment filters."
              />
            ) : (
              <ResultList>
                {shown.map((ex) => (
                  <li key={ex.id}>
                    <ResultButton type="button" onClick={() => setDetail(ex)}>
                      <ResultName>{ex.name}</ResultName>
                      <Row wrap>
                        <Badge>{humanizeEquipment(ex.equipment)}</Badge>
                        <Muted as="span">{ex.primary_muscles.join(', ')}</Muted>
                      </Row>
                    </ResultButton>
                  </li>
                ))}
              </ResultList>
            )}
          </ScrollArea>
        </Stack>
      )}
    </Modal>
  );
}
