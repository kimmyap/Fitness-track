import { useId } from 'react';
import styled from '@emotion/styled';
import { Minus, Plus } from 'lucide-react';
import { Field, FieldLabel, InputBase } from './TextInput';
import { IconButton } from './IconButton';

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
`;

const StepButton = styled(IconButton)`
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.muted};
`;

export interface NumberStepperProps {
  label: string;
  value: number | '';
  onChange: (value: number | '') => void;
  /** Legacy weight stepper: ±5 lb / ±2.5 kg. */
  step?: number;
  min?: number;
  max?: number;
  /** Unit suffix announced with the buttons, e.g. "lbs". */
  unitLabel?: string;
  id?: string;
}

/** Labeled numeric input with ≥44px −/+ buttons and a decimal keyboard. */
export function NumberStepper({ label, value, onChange, step = 5, min, max, unitLabel, id: idProp }: NumberStepperProps) {
  const autoId = useId();
  const id = idProp ?? autoId;

  const clamp = (n: number) => {
    let next = n;
    if (min !== undefined) next = Math.max(min, next);
    if (max !== undefined) next = Math.min(max, next);
    // avoid float drift from repeated ±2.5 steps
    return Math.round(next * 100) / 100;
  };

  const nudge = (delta: number) => onChange(clamp((value === '' ? 0 : value) + delta));

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Row>
        <StepButton
          aria-label={`Decrease ${typeof label === 'string' ? label : 'value'} by ${step}${unitLabel ?? ''}`}
          onClick={() => nudge(-step)}
        >
          <Minus size={18} aria-hidden="true" />
        </StepButton>
        <InputBase
          id={id}
          type="number"
          inputMode="decimal"
          value={value}
          min={min}
          max={max}
          onChange={(e) => {
            const raw = e.target.value;
            onChange(raw === '' ? '' : Number(raw));
          }}
        />
        <StepButton
          aria-label={`Increase ${typeof label === 'string' ? label : 'value'} by ${step}${unitLabel ?? ''}`}
          onClick={() => nudge(step)}
        >
          <Plus size={18} aria-hidden="true" />
        </StepButton>
      </Row>
    </Field>
  );
}
