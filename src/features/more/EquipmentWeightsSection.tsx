/**
 * Settings — Equipment weights (trap bar + leg-press sled).
 *
 * Legacy save semantics preserved exactly:
 * - trap bar: truthy value stores fromDisplayWeight(value), blank clears to null
 * - sled: truthy stores fromDisplayWeight(value); an EXPLICIT "0" stores 0
 *   (valid and distinct from unset); blank keeps the previous value
 */
import { useState } from 'react';
import styled from '@emotion/styled';
import { Button, NumberInput, toast } from '@/components';
import { fromDisplayWeight, toDisplayWeight } from '@/lib/domain';
import { useSettingsStore } from '@/stores';
import type { EquipmentWeights, Unit } from '@/lib/types';

const Note = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.typography.fontSizes.xs};
  color: ${({ theme }) => theme.colors.mutedForeground};
`;

interface InnerProps {
  unit: Unit;
  equipmentWeights: EquipmentWeights;
  onSave: (weights: EquipmentWeights) => void;
}

function EquipmentWeightsInner({ unit, equipmentWeights, onSave }: InnerProps) {
  const [trap, setTrap] = useState(
    equipmentWeights.trapBar != null ? String(toDisplayWeight(equipmentWeights.trapBar, unit)) : '',
  );
  const [sled, setSled] = useState(
    equipmentWeights.legPressSled != null ? String(toDisplayWeight(equipmentWeights.legPressSled, unit)) : '',
  );

  const save = () => {
    const trapVal = parseFloat(trap);
    const legVal = parseFloat(sled);
    onSave({
      trapBar: trapVal ? fromDisplayWeight(trapVal, unit) : null,
      legPressSled: legVal
        ? fromDisplayWeight(legVal, unit)
        : legVal === 0
          ? 0
          : equipmentWeights.legPressSled,
    });
    toast('Equipment weights saved');
  };

  return (
    <>
      <Note>These vary by machine/gym — set them once so the weight-entry math is accurate. Leave blank if unsure.</Note>
      <NumberInput
        label={`Trap bar (${unit})`}
        placeholder={unit === 'kg' ? '25' : '55'}
        step="0.5"
        min="0"
        value={trap}
        onChange={(e) => setTrap(e.target.value)}
        helper={`Blank uses the default (${unit === 'kg' ? '25 kg' : '55 lbs'}).`}
      />
      <NumberInput
        label={`Leg press sled (${unit})`}
        placeholder="0"
        step="0.5"
        min="0"
        value={sled}
        onChange={(e) => setSled(e.target.value)}
        helper="0 is a valid sled weight (plates-only math) and is different from leaving it blank."
      />
      <Button type="button" variant="primary" fullWidth onClick={save}>
        Save Equipment Weights
      </Button>
    </>
  );
}

export function EquipmentWeightsSection() {
  const unit = useSettingsStore((s) => s.unit);
  const equipmentWeights = useSettingsStore((s) => s.equipmentWeights);
  const setEquipmentWeights = useSettingsStore((s) => s.setEquipmentWeights);
  // Remount when unit flips so the displayed values re-derive in the new unit.
  return (
    <EquipmentWeightsInner
      key={unit}
      unit={unit}
      equipmentWeights={equipmentWeights}
      onSave={setEquipmentWeights}
    />
  );
}
