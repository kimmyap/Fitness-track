/**
 * Plate calculator (legacy Plates tab): target total weight + bar select,
 * greedy per-side breakdown with a visual plate stack, live recompute.
 */
import { useId, useState } from 'react';
import styled from '@emotion/styled';
import { Calculator } from 'lucide-react';
import { Card, Field, FieldLabel, NumberInput, InputBase } from '@/components';
import { BAR_OPTIONS, PLATE_SIZES, fmtNum, plateCalculator } from '@/lib/domain';
import { useSettingsStore } from '@/stores';
import type { Unit } from '@/lib/types';

const Title = styled.h2`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
  margin: 0;
  font-family: ${({ theme }) => theme.typography.display};
  font-size: ${({ theme }) => theme.typography.fontSizes.md};
  font-weight: 600;
`;

const Hint = styled.p`
  margin: ${({ theme }) => `${theme.space[1]} 0 0`};
  font-size: ${({ theme }) => theme.typography.fontSizes.sm};
  color: ${({ theme }) => theme.colors.mutedForeground};
`;

const Row = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.space[3]};
  margin-top: ${({ theme }) => theme.space[3]};

  > * {
    flex: 1;
    min-width: 0;
  }
`;

const SelectBase = InputBase.withComponent('select');

const ResultBox = styled.div`
  margin-top: ${({ theme }) => theme.space[4]};
  padding: ${({ theme }) => theme.space[3]};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.muted};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[2]};
`;

const PerSide = styled.p`
  margin: 0;
  font-family: ${({ theme }) => theme.typography.display};
  font-size: ${({ theme }) => theme.typography.fontSizes.lg};
  font-weight: 700;
  font-variant-numeric: tabular-nums;
`;

const PlateRow = styled.div`
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.space[1]};
`;

/** Decorative plate block; height scales with plate size (labels carry the data). */
const PlateVisual = styled('span', { shouldForwardProp: (p) => p !== 'scale' })<{ scale: number }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: ${({ scale }) => Math.round(30 + scale * 42)}px;
  border-radius: ${({ theme }) => theme.radii.sm};
  background: ${({ theme }) => theme.colors.primary};
  color: ${({ theme }) => theme.colors.onPrimary};
  font-size: ${({ theme }) => theme.typography.fontSizes.xs};
  font-weight: 700;
  font-variant-numeric: tabular-nums;
`;

const PlatesText = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.typography.fontSizes.sm};
  color: ${({ theme }) => theme.colors.mutedForeground};
  font-variant-numeric: tabular-nums;
`;

const Shortfall = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.typography.fontSizes.sm};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.destructive};
`;

function barLabel(bar: number, index: number, unit: Unit): string {
  if (bar === 0) return 'No bar / EZ';
  const suffix = index === 2 ? ' (training)' : '';
  return unit === 'kg' ? `${bar} kg bar${suffix}` : `${bar} lb bar${suffix}`;
}

function PlateCalculatorInner({ unit }: { unit: Unit }) {
  const barId = useId();
  const bars = BAR_OPTIONS[unit];
  const maxPlate = PLATE_SIZES[unit][0] as number;
  const [target, setTarget] = useState('');
  const [bar, setBar] = useState(String(bars[0]));

  const targetNum = parseFloat(target);
  const barNum = parseFloat(bar);
  const result = plateCalculator(targetNum || 0, barNum, unit);

  return (
    <Card>
      <Title>
        <Calculator size={18} aria-hidden="true" />
        Plate Calculator
      </Title>
      <Hint>Enter your target total weight (bar + plates)</Hint>
      <Row>
        <NumberInput
          label={`Target weight (${unit})`}
          step="0.5"
          min="0"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
        />
        <Field>
          <FieldLabel htmlFor={barId}>Bar</FieldLabel>
          <SelectBase id={barId} value={bar} onChange={(e) => setBar(e.target.value)}>
            {bars.map((b, i) => (
              <option key={b} value={b}>
                {barLabel(b, i, unit)}
              </option>
            ))}
          </SelectBase>
        </Field>
      </Row>
      <div aria-live="polite">
        {result ? (
          <ResultBox>
            <PerSide>
              Per side: {fmtNum(result.perSide)} {unit}
            </PerSide>
            {result.plates.length ? (
              <PlateRow aria-hidden="true">
                {result.plates.map((p, i) => (
                  <PlateVisual key={i} scale={p / maxPlate}>
                    {p}
                  </PlateVisual>
                ))}
              </PlateRow>
            ) : null}
            <PlatesText>
              Plates (per side): {result.plates.length ? result.plates.join(' + ') : 'none, bar only'}
            </PlatesText>
            {result.leftover > 0 ? (
              <Shortfall>
                Can&apos;t hit exactly — {result.leftover} {unit} short per side
              </Shortfall>
            ) : null}
          </ResultBox>
        ) : target !== '' ? (
          <Hint>Enter a target above the bar weight.</Hint>
        ) : null}
      </div>
    </Card>
  );
}

export function PlateCalculatorCard() {
  const unit = useSettingsStore((s) => s.unit);
  // Remount when the unit flips: the typed target and bar choice are unit-specific.
  return <PlateCalculatorInner key={unit} unit={unit} />;
}
