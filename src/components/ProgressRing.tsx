import { useTheme } from '@emotion/react';

export interface ProgressRingProps {
  /** 0–100; clamped like legacy. */
  pct: number;
  size?: number;
  stroke?: number;
  /** Accessible label, e.g. "Best weight is 80% of goal". */
  label?: string;
}

/** SVG progress ring (legacy stroke-dashoffset technique, themed). */
export function ProgressRing({ pct, size = 40, stroke = 3, label }: ProgressRingProps) {
  const theme = useTheme();
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.min(Math.max(pct, 0), 100);
  const offset = circumference * (1 - clamped / 100);
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      role={label ? 'img' : 'presentation'}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={theme.colors.muted} strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={theme.colors.primary}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}
