import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@emotion/react';
import { themeFor } from '@/theme';
import { ActiveSetBar } from './ActiveSetBar';

const renderBar = (props: Parameters<typeof ActiveSetBar>[0]) =>
  render(
    <ThemeProvider theme={themeFor('dark')}>
      <ActiveSetBar {...props} />
    </ThemeProvider>,
  );

describe('ActiveSetBar', () => {
  it('names the set you are about to log, not the one just finished', () => {
    renderBar({ exerciseName: 'Sumo Squats', setsLogged: 1, targetSets: 4, targetReps: '8-12' });
    expect(screen.getByText(/Set 2 of 4/)).toBeInTheDocument();
    expect(screen.getByText('Sumo Squats')).toBeInTheDocument();
  });

  it('starts at set 1 when nothing is logged yet', () => {
    renderBar({ exerciseName: 'Deadlifts', setsLogged: 0, targetSets: 3, targetReps: '6-8' });
    expect(screen.getByText(/Set 1 of 3/)).toBeInTheDocument();
  });

  it('reports the target met rather than inviting a set beyond it', () => {
    renderBar({ exerciseName: 'Hip Thrust', setsLogged: 3, targetSets: 3, targetReps: '10-12' });
    expect(screen.getByText(/Target met/)).toBeInTheDocument();
    expect(screen.queryByText(/Set 4 of 3/)).not.toBeInTheDocument();
  });

  it('is a labelled live region, so the name is announced with the count', () => {
    renderBar({ exerciseName: 'Rows', setsLogged: 0, targetSets: 3, targetReps: '10-12' });
    expect(screen.getByRole('status', { name: 'Currently logging' })).toBeInTheDocument();
  });

  it('offers a way back to the inputs once the card has scrolled away', async () => {
    const onJumpToCard = vi.fn();
    renderBar({ exerciseName: 'Rows', setsLogged: 0, targetSets: 3, targetReps: '10-12', onJumpToCard });
    await userEvent.click(screen.getByRole('button', { name: /jump to card/i }));
    expect(onJumpToCard).toHaveBeenCalledOnce();
  });

  it('hides the jump control when no handler is wired', () => {
    renderBar({ exerciseName: 'Rows', setsLogged: 0, targetSets: 3, targetReps: '10-12' });
    expect(screen.queryByRole('button', { name: /jump to card/i })).not.toBeInTheDocument();
  });
});
