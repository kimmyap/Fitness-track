/**
 * Plate calculator UI wiring (the greedy math itself is covered in
 * lib/domain.test.ts): live recompute, bar select, unit-aware options,
 * shortfall message.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithTheme } from '@/test/renderWithTheme';
import { PlateCalculatorCard } from './PlateCalculatorCard';
import { useSettingsStore } from '@/stores';

beforeEach(() => {
  useSettingsStore.getState().setUnit('lbs');
});

describe('PlateCalculatorCard (lbs)', () => {
  it('computes the greedy per-side breakdown live as the target is typed', async () => {
    const user = userEvent.setup();
    renderWithTheme(<PlateCalculatorCard />);

    await user.type(screen.getByLabelText('Target weight (lbs)'), '225');

    expect(screen.getByText(/Per side: 90 lbs/)).toBeInTheDocument();
    expect(screen.getByText(/Plates \(per side\): 45 \+ 45/)).toBeInTheDocument();
    expect(screen.queryByText(/Can't hit exactly/)).not.toBeInTheDocument();
  });

  it('recomputes when the bar changes', async () => {
    const user = userEvent.setup();
    renderWithTheme(<PlateCalculatorCard />);

    await user.type(screen.getByLabelText('Target weight (lbs)'), '95');
    expect(screen.getByText(/Per side: 25 lbs/)).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Bar'), '35');
    expect(screen.getByText(/Per side: 30 lbs/)).toBeInTheDocument();
    expect(screen.getByText(/Plates \(per side\): 25 \+ 5/)).toBeInTheDocument();
  });

  it('shows the shortfall when the target cannot be hit exactly', async () => {
    const user = userEvent.setup();
    renderWithTheme(<PlateCalculatorCard />);

    await user.type(screen.getByLabelText('Target weight (lbs)'), '46');
    expect(screen.getByText(/Per side: 0.5 lbs/)).toBeInTheDocument();
    expect(screen.getByText(/Can't hit exactly — 0.5 lbs short per side/)).toBeInTheDocument();
    expect(screen.getByText(/none, bar only/)).toBeInTheDocument();
  });

  it('prompts for a target above the bar weight', async () => {
    const user = userEvent.setup();
    renderWithTheme(<PlateCalculatorCard />);

    await user.type(screen.getByLabelText('Target weight (lbs)'), '40');
    expect(screen.getByText('Enter a target above the bar weight.')).toBeInTheDocument();
  });
});

describe('PlateCalculatorCard (kg)', () => {
  it('offers kg bars and computes with kg plates', async () => {
    useSettingsStore.getState().setUnit('kg');
    const user = userEvent.setup();
    renderWithTheme(<PlateCalculatorCard />);

    const barSelect = screen.getByLabelText('Bar');
    expect(barSelect).toHaveValue('20');
    expect(screen.getByRole('option', { name: '20 kg bar' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '10 kg bar (training)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'No bar / EZ' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('Target weight (kg)'), '60');
    expect(screen.getByText(/Per side: 20 kg/)).toBeInTheDocument();
    expect(screen.getByText(/Plates \(per side\): 20/)).toBeInTheDocument();
  });
});
