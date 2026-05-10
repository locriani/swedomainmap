import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App integration', () => {
  it('renders header, role selector, and category cards', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Role' })).toBeInTheDocument();
    // Many category headings (h2)
    expect(screen.getAllByRole('heading', { level: 2 }).length).toBeGreaterThan(10);
  });

  it('starts with iOS role selected and highlight on', () => {
    render(<App />);
    const select = screen.getByRole('combobox', { name: 'Role' }) as HTMLSelectElement;
    expect(select.value).toBe('ios');
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
    // Summary line contains literal " typical areas" only when a role is selected.
    expect(screen.getByText(/typical areas/i)).toBeInTheDocument();
  });

  it('changing role updates the summary without forcing highlight back on', () => {
    render(<App />);
    const toggle = screen.getByRole('switch');
    fireEvent.click(toggle); // turn highlight off
    expect(toggle).toHaveAttribute('aria-checked', 'false');

    fireEvent.change(screen.getByRole('combobox', { name: 'Role' }), {
      target: { value: 'backend' },
    });

    // Role description (only rendered for selected role) updates.
    expect(screen.getByText(/Builds servers, APIs/i)).toBeInTheDocument();
    // Highlight stays where the user left it (off).
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  });

  it('selecting "None" disables the highlight toggle', () => {
    render(<App />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Role' }), {
      target: { value: '' },
    });
    expect(screen.getByRole('switch')).toBeDisabled();
    expect(screen.getByText(/Pick a role above/i)).toBeInTheDocument();
  });

  it('switches in-scope items when role changes', () => {
    render(<App />);
    // Anchor on the Languages section so we test the same pill across renders
    // even if the global render order shifts.
    const findSwiftInLanguages = () => {
      const languagesHeading = screen.getByRole('heading', { level: 2, name: /Programming Languages/ });
      const section = languagesHeading.closest('section');
      if (!section) throw new Error('Languages section not found');
      return within(section).getByText('Swift').closest('[data-testid="item-pill"]');
    };

    expect(findSwiftInLanguages()).toHaveAttribute('data-in-scope', 'true');

    fireEvent.change(screen.getByRole('combobox', { name: 'Role' }), {
      target: { value: 'backend' },
    });

    expect(findSwiftInLanguages()).toHaveAttribute('data-in-scope', 'false');
  });
});
