import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HighlightToggle } from './HighlightToggle';

describe('HighlightToggle', () => {
  it('renders the visible label', () => {
    render(<HighlightToggle value={false} onChange={() => {}} label="Highlight scope" />);
    expect(screen.getByText('Highlight scope')).toBeInTheDocument();
  });

  it('reflects value via aria-checked', () => {
    const { rerender } = render(<HighlightToggle value={false} onChange={() => {}} label="L" />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
    rerender(<HighlightToggle value={true} onChange={() => {}} label="L" />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  it('calls onChange with toggled value when clicked', () => {
    const onChange = vi.fn();
    render(<HighlightToggle value={false} onChange={onChange} label="L" />);
    fireEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('does not invoke onChange when disabled', () => {
    const onChange = vi.fn();
    render(<HighlightToggle value={false} onChange={onChange} disabled label="L" />);
    fireEvent.click(screen.getByRole('switch'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('associates label via aria-labelledby (no duplicate aria-label)', () => {
    render(<HighlightToggle value={false} onChange={() => {}} label="Highlight scope" />);
    const sw = screen.getByRole('switch');
    expect(sw).not.toHaveAttribute('aria-label');
    expect(sw).toHaveAttribute('aria-labelledby');
  });
});
