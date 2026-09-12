/**
 * Shared chart scaffolding for the Progress page, per the design-spec chart
 * rules: explicit-height wrapper (Recharts ResponsiveContainer needs one),
 * a visually-hidden data-table alternative per chart, low-contrast gridlines
 * via theme tokens, tooltips, reduced-motion-aware entrance animation.
 */
import styled from '@emotion/styled';
import { useTheme } from '@emotion/react';
import type { CSSProperties, ReactNode } from 'react';

/** Screen-reader-only content (data-table alternatives). */
export const VisuallyHidden = styled.div`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
`;

/** Explicit-height wrapper — ResponsiveContainer requires a sized parent. */
const ChartBox = styled.div<{ chartHeight: number }>`
  width: 100%;
  height: ${({ chartHeight }) => chartHeight}px;
`;

const SectionTitle = styled.h3`
  margin: 0 0 ${({ theme }) => theme.space[3]};
  font-family: ${({ theme }) => theme.typography.display};
  font-size: ${({ theme }) => theme.typography.fontSizes.md};
  font-weight: 600;
`;

export interface DataTableSpec {
  caption: string;
  /** Any width — a chart with a second series needs a third column. */
  columns: readonly string[];
  rows: readonly (readonly string[])[];
}

/** Accessible alternative to the SVG chart (visually hidden). */
export function ChartDataTable({ caption, columns, rows }: DataTableSpec) {
  return (
    <VisuallyHidden>
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col} scope="col">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </VisuallyHidden>
  );
}

export interface ChartFrameProps {
  title: string;
  height?: number;
  table: DataTableSpec;
  children: ReactNode;
}

/**
 * Titled chart section: SVG chart hidden from the accessibility tree, with
 * the data table as the accessible equivalent.
 */
export function ChartFrame({ title, height = 240, table, children }: ChartFrameProps) {
  return (
    <section>
      <SectionTitle>{title}</SectionTitle>
      <ChartBox chartHeight={height} aria-hidden="true">
        {children}
      </ChartBox>
      <ChartDataTable {...table} />
    </section>
  );
}

/** Theme-derived Recharts props shared by every chart. */
export function useChartTokens() {
  const theme = useTheme();
  const tick = { fill: theme.colors.mutedForeground, fontSize: 11 };
  const axisLine = { stroke: theme.colors.border };
  const tooltipContentStyle: CSSProperties = {
    background: theme.colors.card,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radii.md,
    color: theme.colors.cardForeground,
    fontSize: theme.typography.fontSizes.sm,
    fontVariantNumeric: 'tabular-nums',
  };
  const tooltipLabelStyle: CSSProperties = { color: theme.colors.mutedForeground };
  const tooltipItemStyle: CSSProperties = { color: theme.colors.cardForeground };
  return {
    colors: theme.colors,
    tick,
    axisLine,
    /** Low-contrast gridlines from theme tokens. */
    grid: { stroke: theme.colors.border, strokeOpacity: 0.5 },
    tooltipContentStyle,
    tooltipLabelStyle,
    tooltipItemStyle,
  };
}

// ---------------------------------------------------------------------------
// Range switcher (4W/3M/6M/1Y/All) — toggle-button group, ≥44px targets
// ---------------------------------------------------------------------------

const RangeGroup = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.space[1]};
  padding: ${({ theme }) => theme.space[1]};
  background: ${({ theme }) => theme.colors.muted};
  border-radius: ${({ theme }) => theme.radii.md};
  width: 100%;
`;

const RangeButton = styled.button<{ active: boolean }>`
  flex: 1;
  min-height: ${({ theme }) => theme.touchTarget};
  padding: ${({ theme }) => `${theme.space[1]} ${theme.space[2]}`};
  border: none;
  border-radius: ${({ theme }) => theme.radii.sm};
  background: ${({ theme, active }) => (active ? theme.colors.primary : 'transparent')};
  color: ${({ theme, active }) => (active ? theme.colors.onPrimary : theme.colors.mutedForeground)};
  font-family: ${({ theme }) => theme.typography.body};
  font-size: ${({ theme }) => theme.typography.fontSizes.sm};
  font-weight: ${({ active }) => (active ? 700 : 500)};
  cursor: pointer;
  transition: opacity ${({ theme }) => `${theme.motion.duration.fast} ${theme.motion.easing.out}`};

  &:hover {
    opacity: 0.9;
  }
`;

export interface RangeSwitcherProps<T extends string> {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  'aria-label': string;
}

export function RangeSwitcher<T extends string>({ options, value, onChange, 'aria-label': ariaLabel }: RangeSwitcherProps<T>) {
  return (
    <RangeGroup role="group" aria-label={ariaLabel}>
      {options.map((opt) => (
        <RangeButton key={opt} type="button" active={opt === value} aria-pressed={opt === value} onClick={() => onChange(opt)}>
          {opt}
        </RangeButton>
      ))}
    </RangeGroup>
  );
}
