import { LEVELS, LEVEL_LABELS, type Level } from '../../domain/types';

interface Props {
  value: Level;
  onChange: (next: Level) => void;
  disabled?: boolean;
}

/**
 * Segmented control for picking a seniority level. Cumulative semantics: the
 * map shows everything expected at this level OR below. Disabled when no
 * predefined role is active (custom selections ignore level).
 */
export function LevelSelector({ value, onChange, disabled }: Props) {
  return (
    <div
      className={`flex items-center gap-2 text-sm ${disabled ? 'opacity-50' : ''}`}
      data-testid="level-selector"
    >
      <span className="text-slate-400">Level</span>
      <div
        role="radiogroup"
        aria-label="Seniority level"
        className="inline-flex rounded-md border border-slate-700 overflow-hidden"
      >
        {LEVELS.map((l) => {
          const active = l === value;
          return (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onChange(l)}
              data-testid={`level-${l}`}
              className={`px-3 py-2 text-xs font-medium transition-colors sm:px-2.5 sm:py-1.5 ${
                active
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
              } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {LEVEL_LABELS[l]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
