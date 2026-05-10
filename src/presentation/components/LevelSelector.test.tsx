import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LevelSelector } from './LevelSelector';

describe('LevelSelector', () => {
  it('renders all four levels', () => {
    render(<LevelSelector value="mid" onChange={() => {}} />);
    expect(screen.getByRole('radio', { name: 'Junior' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Mid' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Senior' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Staff' })).toBeInTheDocument();
  });

  it('marks the active level with aria-checked', () => {
    render(<LevelSelector value="sr" onChange={() => {}} />);
    expect(screen.getByRole('radio', { name: 'Senior' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Junior' })).toHaveAttribute('aria-checked', 'false');
  });

  it('emits onChange when a different level is clicked', () => {
    const onChange = vi.fn();
    render(<LevelSelector value="mid" onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Staff' }));
    expect(onChange).toHaveBeenCalledWith('staff');
  });

  it('disables all buttons when disabled', () => {
    render(<LevelSelector value="mid" onChange={() => {}} disabled />);
    for (const name of ['Junior', 'Mid', 'Senior', 'Staff']) {
      expect(screen.getByRole('radio', { name })).toBeDisabled();
    }
  });
});
