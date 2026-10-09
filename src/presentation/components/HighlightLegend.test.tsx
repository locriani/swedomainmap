import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HighlightLegend } from './HighlightLegend';
import type { RoleSelection } from '../../domain/types';

describe('HighlightLegend', () => {
  it('shows scope, future, and out-of-scope entries for a predefined role', () => {
    const sel: RoleSelection = { kind: 'predefined', id: 'ios' };
    render(<HighlightLegend selection={sel} />);
    expect(screen.getByTestId('highlight-legend')).toHaveTextContent('In scope');
    expect(screen.getByTestId('highlight-legend')).toHaveTextContent(
      'Earned later (badge shows the level)',
    );
    expect(screen.getByTestId('highlight-legend')).toHaveTextContent('Not in scope');
  });

  it('shows picked/unpicked entries for a custom selection', () => {
    const sel: RoleSelection = { kind: 'custom', itemIds: new Set(['swift']) };
    render(<HighlightLegend selection={sel} />);
    expect(screen.getByTestId('highlight-legend')).toHaveTextContent('In your selection');
    expect(screen.getByTestId('highlight-legend')).toHaveTextContent('Not selected');
    // The "earned later" future state can't occur for custom selections.
    expect(screen.getByTestId('highlight-legend')).not.toHaveTextContent('Earned later');
  });
});
