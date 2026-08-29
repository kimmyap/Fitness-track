import { useRef } from 'react';
import styled from '@emotion/styled';

const List = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.space[1]};
  padding: ${({ theme }) => theme.space[1]};
  background: ${({ theme }) => theme.colors.muted};
  border-radius: ${({ theme }) => theme.radii.md};
`;

const Tab = styled.button<{ selected: boolean }>`
  flex: 1;
  min-height: ${({ theme }) => theme.touchTarget};
  padding: ${({ theme }) => `${theme.space[2]} ${theme.space[3]}`};
  border: none;
  border-radius: ${({ theme }) => theme.radii.sm};
  background: ${({ theme, selected }) => (selected ? theme.colors.primary : 'transparent')};
  color: ${({ theme, selected }) => (selected ? theme.colors.onPrimary : theme.colors.mutedForeground)};
  font-family: ${({ theme }) => theme.typography.body};
  font-size: ${({ theme }) => theme.typography.fontSizes.sm};
  font-weight: ${({ selected }) => (selected ? 700 : 500)};
  cursor: pointer;
  white-space: nowrap;
  transition: opacity ${({ theme }) => `${theme.motion.duration.fast} ${theme.motion.easing.out}`};

  &:hover {
    opacity: 0.9;
  }
`;

export interface SegmentedTab {
  id: string;
  label: string;
}

export interface SegmentedTabsProps {
  tabs: SegmentedTab[];
  value: string;
  onChange: (id: string) => void;
  /** Accessible name for the tablist. */
  'aria-label': string;
}

/** Keyboard-accessible tablist: Arrow keys / Home / End move + select (roving tabindex). */
export function SegmentedTabs({ tabs, value, onChange, 'aria-label': ariaLabel }: SegmentedTabsProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const select = (index: number) => {
    const tab = tabs[index];
    if (!tab) return;
    onChange(tab.id);
    refs.current[index]?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    let next: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (index + 1) % tabs.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (index - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    if (next !== null) {
      e.preventDefault();
      select(next);
    }
  };

  return (
    <List role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab, i) => {
        const selected = tab.id === value;
        return (
          <Tab
            key={tab.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={`tabpanel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            selected={selected}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {tab.label}
          </Tab>
        );
      })}
    </List>
  );
}
