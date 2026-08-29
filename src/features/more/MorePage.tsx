/**
 * More route: plate calculator, settings accordion sections (units &
 * appearance, equipment weights, goal weights, archived/replaced) and data
 * management (export / import / reset) with save-status indicators.
 */
import { useMemo, useState } from 'react';
import styled from '@emotion/styled';
import { Archive, Database, SlidersHorizontal, Target, Weight } from 'lucide-react';
import { PageHeader } from '@/components';
import { useCustomExercisesStore } from '@/stores';
import { AccordionSection } from './Accordion';
import { PlateCalculatorCard } from './PlateCalculatorCard';
import { UnitsAppearanceSection } from './UnitsAppearanceSection';
import { EquipmentWeightsSection } from './EquipmentWeightsSection';
import { GoalWeightsSection } from './GoalWeightsSection';
import { ArchivedSection, archivedItems } from './ArchivedSection';
import { DataSection } from './DataSection';
import { SyncWarningBanner } from './SaveStatus';

const Stack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[4]};
`;

type SectionKey = 'units' | 'equipment' | 'goals' | 'archived' | 'data';

export function MorePage() {
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    units: false,
    equipment: false,
    goals: false,
    archived: false,
    data: false,
  });
  const toggle = (key: SectionKey) => setOpen((o) => ({ ...o, [key]: !o[key] }));

  const customExercises = useCustomExercisesStore((s) => s.customExercises);
  const excludedBuiltIns = useCustomExercisesStore((s) => s.excludedBuiltIns);
  const archived = useMemo(
    () => archivedItems(customExercises, excludedBuiltIns),
    [customExercises, excludedBuiltIns],
  );

  return (
    <>
      <PageHeader title="More" subtitle="Plate calculator · Settings · Data" />
      <Stack>
        <SyncWarningBanner />

        <PlateCalculatorCard />

        <AccordionSection
          title="Units & Appearance"
          icon={SlidersHorizontal}
          open={open.units}
          onToggle={() => toggle('units')}
        >
          <UnitsAppearanceSection />
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
