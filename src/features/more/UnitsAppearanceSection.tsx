/** Settings — Units & Appearance: lbs/kg toggle + light/dark/system theme. */
import styled from '@emotion/styled';
import { SegmentedTabs } from '@/components';
import { useSettingsStore } from '@/stores';
import type { ThemePref, Unit } from '@/lib/types';

const Group = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[2]};
`;

const GroupLabel = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSizes.sm};
  font-weight: 500;
  color: ${({ theme }) => theme.colors.foreground};
`;

const Note = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.typography.fontSizes.xs};
  color: ${({ theme }) => theme.colors.mutedForeground};
`;

const UNIT_TABS = [
  { id: 'lbs', label: 'lbs' },
  { id: 'kg', label: 'kg' },
];

const THEME_TABS = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System' },
];

export function UnitsAppearanceSection() {
  const unit = useSettingsStore((s) => s.unit);
  const setUnit = useSettingsStore((s) => s.setUnit);
  const themePref = useSettingsStore((s) => s.themePref);
  const setThemePref = useSettingsStore((s) => s.setThemePref);

  return (
    <>
      <Group>
        <GroupLabel>Weight unit</GroupLabel>
        <SegmentedTabs aria-label="Weight unit" tabs={UNIT_TABS} value={unit} onChange={(id) => setUnit(id as Unit)} />
        <Note>
          Switch if your gym&apos;s plates are labeled in kg. Display-only — your history stays stored in lbs.
        </Note>
      </Group>
      <Group>
        <GroupLabel>Appearance</GroupLabel>
        <SegmentedTabs
          aria-label="Appearance"
          tabs={THEME_TABS}
          value={themePref}
          onChange={(id) => setThemePref(id as ThemePref)}
        />
        <Note>System follows your device&apos;s light/dark setting.</Note>
      </Group>
    </>
  );
}
