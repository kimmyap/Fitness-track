import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, act } from '@testing-library/react';
import { renderWithTheme } from '@/test/renderWithTheme';
import { Button } from './Button';
import { IconButton } from './IconButton';
import { ConfirmTap } from './ConfirmTap';
import { Modal } from './Modal';
import { SegmentedTabs } from './SegmentedTabs';
import { TextInput, NumberInput } from './TextInput';
import { NumberStepper } from './NumberStepper';
import { WeekStrip } from './WeekStrip';
import { Toaster, useToastStore } from './Toast';
import { ProgressRing } from './ProgressRing';
import { EmptyState } from './EmptyState';
import { X } from 'lucide-react';

describe('Button / IconButton', () => {
  it('renders variants and honors disabled', () => {
    renderWithTheme(
      <>
        <Button>Log Set</Button>
        <Button variant="destructive" disabled>
          Delete
        </Button>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Log Set' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
  });

  it('IconButton requires and exposes an aria-label', () => {
    renderWithTheme(
      <IconButton aria-label="Close dialog">
        <X aria-hidden="true" />
      </IconButton>,
    );
    expect(screen.getByRole('button', { name: 'Close dialog' })).toBeInTheDocument();
  });
});

describe('ConfirmTap', () => {
  it('requires two taps within the window', () => {
    vi.useFakeTimers();
    const onConfirm = vi.fn();
    renderWithTheme(<ConfirmTap onConfirm={onConfirm}>Reset all data</ConfirmTap>);
    const btn = screen.getByRole('button', { name: 'Reset all data' });
    fireEvent.click(btn);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(btn).toHaveTextContent('Tap again to confirm');
    fireEvent.click(btn);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(btn).toHaveTextContent('Reset all data');
    vi.useRealTimers();
  });

  it('disarms after the window elapses', () => {
    vi.useFakeTimers();
    const onConfirm = vi.fn();
    renderWithTheme(<ConfirmTap onConfirm={onConfirm} windowMs={4000}>Reset</ConfirmTap>);
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    act(() => {
      vi.advanceTimersByTime(4100);
    });
    expect(btn).toHaveTextContent('Reset');
    fireEvent.click(btn);
    expect(onConfirm).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});

describe('Modal', () => {
  it('renders a dialog, closes on Escape and restores focus', () => {
    const onClose = vi.fn();
    renderWithTheme(
      <Modal open onClose={onClose} title="Finish Workout">
        <button>OK</button>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Finish Workout' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    // focus moved inside the panel
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('renders nothing when closed', () => {
    renderWithTheme(
      <Modal open={false} onClose={() => {}} title="Hidden">
        <p>content</p>
      </Modal>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('SegmentedTabs', () => {
  const tabs = [
    { id: 'lower-a', label: 'Lower A' },
    { id: 'upper', label: 'Upper' },
    { id: 'lower-b', label: 'Lower B' },
  ];

  it('marks the active tab and switches on click', () => {
    const onChange = vi.fn();
    renderWithTheme(<SegmentedTabs tabs={tabs} value="lower-a" onChange={onChange} aria-label="Workout day" />);
    expect(screen.getByRole('tab', { name: 'Lower A' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: 'Upper' }));
    expect(onChange).toHaveBeenCalledWith('upper');
  });

  it('supports arrow-key navigation with wrap-around', () => {
    const onChange = vi.fn();
    renderWithTheme(<SegmentedTabs tabs={tabs} value="lower-b" onChange={onChange} aria-label="Workout day" />);
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Lower B' }), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('lower-a');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Lower B' }), { key: 'Home' });
    expect(onChange).toHaveBeenCalledWith('lower-a');
  });
});

describe('TextInput / NumberInput / NumberStepper', () => {
  it('has a visible label and wires error text via aria-describedby', () => {
    renderWithTheme(<TextInput label="Weight (lbs)" error="Enter a weight" defaultValue="" />);
    const input = screen.getByLabelText('Weight (lbs)');
    expect(input).toHaveAccessibleDescription('Enter a weight');
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('NumberInput uses a decimal keyboard', () => {
    renderWithTheme(<NumberInput label="Reps" />);
    expect(screen.getByLabelText('Reps')).toHaveAttribute('inputmode', 'decimal');
  });

  it('NumberStepper nudges by step with accessible buttons', () => {
    const onChange = vi.fn();
    renderWithTheme(<NumberStepper label="Weight" value={100} onChange={onChange} step={5} unitLabel="lbs" />);
    fireEvent.click(screen.getByRole('button', { name: 'Increase Weight by 5lbs' }));
    expect(onChange).toHaveBeenCalledWith(105);
    fireEvent.click(screen.getByRole('button', { name: 'Decrease Weight by 5lbs' }));
    expect(onChange).toHaveBeenCalledWith(95);
  });
});

describe('Toast system', () => {
  it('announces politely and fires the undo action', () => {
    const undoSpy = vi.fn();
    renderWithTheme(<Toaster />);
    act(() => {
      useToastStore.getState().show('Entry deleted', { undo: undoSpy });
    });
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByText('Entry deleted')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(undoSpy).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Entry deleted')).not.toBeInTheDocument();
  });
});

describe('WeekStrip / ProgressRing / EmptyState', () => {
  it('WeekStrip renders 7 labelled days', () => {
    const days = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-08-${String(22 + i).padStart(2, '0')}`,
      done: i % 2 === 0,
    }));
    renderWithTheme(<WeekStrip days={days} label="Warm-up completion, last 7 days" />);
    expect(screen.getByRole('img', { name: 'Warm-up completion, last 7 days' })).toBeInTheDocument();
  });

  it('ProgressRing exposes a label when given', () => {
    renderWithTheme(<ProgressRing pct={75} label="75% of goal" />);
    expect(screen.getByRole('img', { name: '75% of goal' })).toBeInTheDocument();
  });

  it('EmptyState shows title, description and action', () => {
    renderWithTheme(<EmptyState title="No data yet" description="Log your first set" action={<Button>Log it</Button>} />);
    expect(screen.getByText('No data yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log it' })).toBeInTheDocument();
  });
});
