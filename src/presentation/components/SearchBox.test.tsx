import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SearchBox } from './SearchBox';

describe('SearchBox', () => {
  it('emits typed queries through onChange', () => {
    const onChange = vi.fn();
    render(<SearchBox value="" onChange={onChange} />);
    fireEvent.change(screen.getByTestId('item-search-input'), { target: { value: 'swift' } });
    expect(onChange).toHaveBeenCalledWith('swift');
  });

  it('shows a clear button only when the query is non-empty and clears on click', () => {
    const onChange = vi.fn();
    const { rerender } = render(<SearchBox value="" onChange={onChange} />);
    expect(screen.queryByTestId('clear-search')).toBeNull();

    rerender(<SearchBox value="swift" onChange={onChange} />);
    fireEvent.click(screen.getByTestId('clear-search'));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('labels the input for assistive technology', () => {
    render(<SearchBox value="" onChange={() => {}} />);
    expect(screen.getByLabelText('Search')).toBeInTheDocument();
  });
});
