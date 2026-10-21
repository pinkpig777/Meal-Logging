import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MacroTile } from './MacroTile';

describe('MacroTile', () => {
  it('renders the nutrient label, value, and goal', () => {
    render(<MacroTile nutrient="protein" value={81.6} goal={120} />);
    expect(screen.getByText('Protein')).toBeInTheDocument();
    expect(screen.getByText('82 g')).toBeInTheDocument();
    expect(screen.getByText('of 120 g')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Protein toward goal' })).toBeInTheDocument();
  });

  it('shows an unknown value as an em dash, never 0', () => {
    render(<MacroTile nutrient="fat" value={null} goal={null} />);
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByText(/^0 g$/)).not.toBeInTheDocument();
  });
});
