import { useEffect, useRef, useState } from 'react';
import { Button, type ButtonVariant } from './Button';
import type { ReactNode } from 'react';

export interface ConfirmTapProps {
  /** Initial button content. */
  children: ReactNode;
  /** Content while armed (second tap confirms). */
  confirmLabel?: ReactNode;
  onConfirm: () => void;
  /** How long the armed state lasts (legacy typo guard uses 4s). */
  windowMs?: number;
  variant?: ButtonVariant;
  fullWidth?: boolean;
  disabled?: boolean;
}

/**
 * Two-tap destructive pattern from legacy: first tap arms the button and
 * swaps its label; a second tap within the window confirms.
 */
export function ConfirmTap({
  children,
  confirmLabel = 'Tap again to confirm',
  onConfirm,
  windowMs = 4000,
  variant = 'destructive',
  fullWidth,
  disabled,
}: ConfirmTapProps) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const handleClick = () => {
    if (armed) {
      if (timer.current) clearTimeout(timer.current);
      setArmed(false);
      onConfirm();
      return;
    }
    setArmed(true);
    timer.current = setTimeout(() => setArmed(false), windowMs);
  };

  return (
    <Button type="button" variant={variant} fullWidth={fullWidth} disabled={disabled} onClick={handleClick} aria-live="polite">
      {armed ? confirmLabel : children}
    </Button>
  );
}
