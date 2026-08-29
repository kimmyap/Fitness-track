/** "Logging for" date picker (max today) with a "Back to today" reset. */
import { useId } from 'react';
import styled from '@emotion/styled';
import { Button, FieldLabel, InputBase } from '@/components';

const Bar = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
  flex-wrap: wrap;
`;

const DateInput = styled(InputBase)`
  width: auto;
  flex: 1;
  min-width: 150px;
`;

export interface DatePickerBarProps {
  logDate: string;
  todayIso: string;
  onChange: (date: string) => void;
}

export function DatePickerBar({ logDate, todayIso, onChange }: DatePickerBarProps) {
  const id = useId();
  const isToday = logDate === todayIso;
  return (
    <Bar>
      <FieldLabel htmlFor={id}>Logging for:</FieldLabel>
      <DateInput
        id={id}
        type="date"
        value={logDate}
        max={todayIso}
        onChange={(e) => onChange(e.target.value || todayIso)}
      />
      {!isToday ? (
        <Button variant="secondary" onClick={() => onChange(todayIso)}>
          Back to today
        </Button>
      ) : null}
    </Bar>
  );
}
