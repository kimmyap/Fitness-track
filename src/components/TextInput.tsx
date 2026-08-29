import { useId } from 'react';
import styled from '@emotion/styled';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

export const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[1]};
`;

export const FieldLabel = styled.label`
  font-size: ${({ theme }) => theme.typography.fontSizes.sm};
  font-weight: 500;
  color: ${({ theme }) => theme.colors.foreground};
`;

export const InputBase = styled.input<{ invalid?: boolean }>`
  min-height: ${({ theme }) => theme.touchTarget};
  padding: ${({ theme }) => `${theme.space[2]} ${theme.space[3]}`};
  border: 1px solid ${({ theme, invalid }) => (invalid ? theme.colors.destructive : theme.colors.border)};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.card};
  color: ${({ theme }) => theme.colors.cardForeground};
  font-family: ${({ theme }) => theme.typography.body};
  font-size: ${({ theme }) => theme.typography.fontSizes.md};
  font-variant-numeric: tabular-nums;
  width: 100%;

  &::placeholder {
    color: ${({ theme }) => theme.colors.mutedForeground};
  }
`;

const HelperText = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSizes.xs};
  color: ${({ theme }) => theme.colors.mutedForeground};
`;

const ErrorText = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSizes.xs};
  color: ${({ theme }) => theme.colors.destructive};
`;

export interface TextInputProps extends ComponentPropsWithoutRef<'input'> {
  /** Visible label — never placeholder-only. */
  label: ReactNode;
  /** Error message below the field, wired via aria-describedby. */
  error?: string;
  /** Helper text below the field (e.g. live computed-total hint). */
  helper?: ReactNode;
}

export function TextInput({ label, error, helper, id: idProp, ...rest }: TextInputProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const errorId = `${id}-error`;
  const helperId = `${id}-helper`;
  const describedBy = [error ? errorId : null, helper ? helperId : null].filter(Boolean).join(' ') || undefined;
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <InputBase id={id} invalid={Boolean(error)} aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...rest} />
      {helper ? <HelperText id={helperId}>{helper}</HelperText> : null}
      {error ? <ErrorText id={errorId}>{error}</ErrorText> : null}
    </Field>
  );
}

/** Numeric field: decimal keyboard on mobile, tabular numerals. */
export function NumberInput(props: TextInputProps) {
  return <TextInput type="number" inputMode="decimal" {...props} />;
}
