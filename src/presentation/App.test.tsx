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

  it('shows a dismissible first-run hint explaining the three controls', () => {
    render(<App />);
    const hint = screen.getByTestId('first-run-hint');
    expect(hint).toHaveTextContent('Role');
    expect(hint).toHaveTextContent('Level');
    expect(hint).toHaveTextContent('Highlight scope');
    fireEvent.click(screen.getByTestId('dismiss-hint'));
    expect(screen.queryByTestId('first-run-hint')).toBeNull();
  });

  it('shows the highlight legend while highlighting is on and hides it when off', () => {
    render(<App />);
    expect(screen.getByTestId('highlight-legend')).toHaveTextContent('In scope');
    expect(screen.getByTestId('highlight-legend')).toHaveTextContent('Earned later');
    fireEvent.click(screen.getByRole('switch'));
    expect(screen.queryByTestId('highlight-legend')).toBeNull();
  });

  it('filters the whole map from the global search box', () => {
    render(<App />);
    const allHeadings = screen.getAllByRole('heading', { level: 2 }).length;

    fireEvent.change(screen.getByTestId('item-search-input'), { target: { value: 'Swift' } });
    expect(
      screen.getByRole('heading', { level: 2, name: /Programming Languages/ }),
    ).toBeInTheDocument();
    // Categories without a Swift match drop out entirely.
    expect(screen.queryByRole('heading', { level: 2, name: 'Databases & Storage' })).toBeNull();
    expect(screen.getAllByRole('heading', { level: 2 }).length).toBeLessThan(allHeadings);

    // Clearing restores the full map.
    fireEvent.click(screen.getByTestId('clear-search'));
    expect(screen.getAllByRole('heading', { level: 2 }).length).toBe(allHeadings);
  });

  it('shows an empty-state message when the search matches nothing', () => {
    render(<App />);
    fireEvent.change(screen.getByTestId('item-search-input'), { target: { value: 'zzzzqqq' } });
    expect(screen.getByTestId('search-empty')).toHaveTextContent(/No items match/i);
  });

  it('uses custom-selection legend labels in custom mode', () => {
    render(<App />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Role' }), {
      target: { value: '__custom__' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Done' })); // close the editor
    expect(screen.getByTestId('highlight-legend')).toHaveTextContent('In your selection');
    expect(screen.getByTestId('highlight-legend')).toHaveTextContent('Not selected');
  });

  it('toggles items directly from the map in custom mode', () => {
    render(<App />);
    // Switch to custom mode; the drawer opens on the transition.
    fireEvent.change(screen.getByRole('combobox', { name: 'Role' }), {
      target: { value: '__custom__' },
    });
    // Pick Swift in the drawer, then close it.
    fireEvent.click(screen.getByTestId('custom-checkbox-swift'));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    // The pill on the main map is now a pressed toggle button.
    const languagesHeading = screen.getByRole('heading', { level: 2, name: /Programming Languages/ });
    const section = languagesHeading.closest('section');
    if (!section) throw new Error('Languages section not found');
    expect(within(section).getByRole('button', { name: 'Swift' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    // Clicking the pill on the map toggles it off; the header count follows.
    fireEvent.click(within(section).getByRole('button', { name: 'Swift' }));
    expect(within(section).getByRole('button', { name: 'Swift' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('button', { name: /Edit custom \(0\)/ })).toBeInTheDocument();

    fireEvent.click(within(section).getByRole('button', { name: 'Swift' }));
    expect(screen.getByRole('button', { name: /Edit custom \(1\)/ })).toBeInTheDocument();
  });

  it('keeps main-map pills non-interactive outside custom mode', () => {
    render(<App />);
    const languagesHeading = screen.getByRole('heading', { level: 2, name: /Programming Languages/ });
    const section = languagesHeading.closest('section');
    if (!section) throw new Error('Languages section not found');
    expect(within(section).queryByRole('button', { name: 'Swift' })).toBeNull();
  });
});
