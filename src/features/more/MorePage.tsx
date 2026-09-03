/**
 * More route: plate calculator, settings accordion sections (units &
 * appearance, equipment weights, goal weights, archived/replaced) and data
 * management (export / import / reset) with save-status indicators.
 */
import { useMemo, useState } from 'react';
import styled from '@emotion/styled';
import { Archive, BookOpen, CalendarCog, Database, SlidersHorizontal, Target, Weight } from 'lucide-react';
import { Button, Card, PageHeader } from '@/components';
import { ExercisePicker } from '@/features/train/ExercisePicker';
import { useCustomExercisesStore } from '@/stores';
import { AccordionSection } from './Accordion';
import { PlateCalculatorCard } from './PlateCalculatorCard';
import { UnitsAppearanceSection } from './UnitsAppearanceSection';
import { EquipmentWeightsSection } from './EquipmentWeightsSection';
import { GoalWeightsSection } from './GoalWeightsSection';
import { ArchivedSection, archivedItems } from './ArchivedSection';
import { DataSection } from './DataSection';
import { WorkoutDaysSection } from './WorkoutDaysSection';
import { SyncWarningBanner } from './SaveStatus';

const LibraryHeading = styled.h3`
  margin: 0 0 ${({ theme }) => theme.space[1]};
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
  font-family: ${({ theme }) => theme.typography.display};
  font-size: ${({ theme }) => theme.typography.fontSizes.md};
  font-weight: 700;
`;

const LibraryNote = styled.p`
  margin: 0 0 ${({ theme }) => theme.space[3]};
  font-size: ${({ theme }) => theme.typography.fontSizes.sm};
  color: ${({ theme }) => theme.colors.mutedForeground};
`;

const Stack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[4]};
`;

type SectionKey = 'units' | 'days' | 'equipment' | 'goals' | 'archived' | 'data';

export function MorePage() {
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    units: false,
    days: false,
    equipment: false,
    goals: false,
    archived: false,
    data: false,
  });
  const [libraryOpen, setLibraryOpen] = useState(false);
  const toggle = (key: SectionKey) => setOpen((o) => ({ ...o, [key]: !o[key] }));

  const customExercises = useCustomExercisesStore((s) => s.customExercises);
  const excludedBuiltIns = useCustomExercisesStore((s) => s.excludedBuiltIns);
  const archived = useMemo(
    () => archivedItems(customExercises, excludedBuiltIns),
    [customExercises, excludedBuiltIns],
  );

  return (
    <>
      <PageHeader title="More" subtitle="Exercise library · Plate calculator · Settings · Data" />
      <Stack>
        <SyncWarningBanner />

        <Card>
          <LibraryHeading>
            <BookOpen size={18} aria-hidden="true" /> Exercise Library
          </LibraryHeading>
          <LibraryNote>
            Look up any of 876 movements — form cues, muscles worked, and similar exercises. Reference only; nothing is
            added to your program.
          </LibraryNote>
          <Button type="button" variant="secondary" fullWidth onClick={() => setLibraryOpen(true)}>
            Browse exercise library
          </Button>
        </Card>
        <ExercisePicker
          open={libraryOpen}
          onClose={() => setLibraryOpen(false)}
          mode="browse"
          title="Exercise library"
        />

        <PlateCalculatorCard />

        <AccordionSection
          title="Units & Appearance"
          icon={SlidersHorizontal}
          open={open.units}
          onToggle={() => toggle('units')}
        >
          <UnitsAppearanceSection />
        </AccordionSection>

        <AccordionSection title="Workout Days" icon={CalendarCog} open={open.days} onToggle={() => toggle('days')}>
          <WorkoutDaysSection />
        </AccordionSection>

        <AccordionSection
          title="Equipment Weights"
          icon={Weight}
          open={open.equipment}
          onToggle={() => toggle('equipment')}
        >
          <EquipmentWeightsSection />
        </AccordionSection>

        <AccordionSection title="Goal Weights" icon={Target} open={open.goals} onToggle={() => toggle('goals')}>
          <GoalWeightsSection />
        </AccordionSection>

        {archived.length > 0 ? (
          <AccordionSection
            title={`Archived / Replaced (${archived.length})`}
            icon={Archive}
            open={open.archived}
            onToggle={() => toggle('archived')}
          >
            <ArchivedSection items={archived} />
          </AccordionSection>
        ) : null}

        <AccordionSection title="Data" icon={Database} open={open.data} onToggle={() => toggle('data')}>
          <DataSection />
        </AccordionSection>
      </Stack>
    </>
  );
}

export default MorePage;
