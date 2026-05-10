import type { Coverage, Level, Role, RoleSelection } from '../../domain/types';
import { HighlightToggle } from './HighlightToggle';
import { LevelSelector } from './LevelSelector';
import { RoleSelector } from './RoleSelector';

interface Props {
  roles: readonly Role[];
  selection: RoleSelection | null;
  /** The Role object for the currently selected predefined role, if any. */
  selectedRoleObj: Role | null;
  level: Level;
  onPredefinedChange: (id: Role['id'] | null) => void;
  onCustomChosen: () => void;
  onEditCustom: () => void;
  onLevelChange: (level: Level) => void;
  highlight: boolean;
  onHighlightChange: (next: boolean) => void;
  coverage: Coverage;
}

export function Header({
  roles,
  selection,
  selectedRoleObj,
  level,
  onPredefinedChange,
  onCustomChosen,
  onEditCustom,
  onLevelChange,
  highlight,
  onHighlightChange,
  coverage,
}: Props) {
  const isCustom = selection?.kind === 'custom';
  const customSize = isCustom ? selection.itemIds.size : 0;
  const isPredefined = selection?.kind === 'predefined';

  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-6 py-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-slate-100 text-xl font-semibold">
              Software engineering knowledge domain map
            </h1>
            <p className="text-slate-400 text-sm mt-1 max-w-2xl">
              A bird's-eye view of the SWE field. Pick a role to see what a typical engineer in
              that specialty would be expected to know — or build a custom selection of your own.
            </p>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <RoleSelector
              roles={roles}
              selection={selection}
              onPredefinedChange={onPredefinedChange}
              onCustomChosen={onCustomChosen}
            />
            {isCustom && (
              <button
                type="button"
                onClick={onEditCustom}
                className="text-sm rounded-md border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 px-2.5 py-1.5 hover:bg-emerald-500/20"
              >
                Edit custom ({customSize})
              </button>
            )}
            <LevelSelector
              value={level}
              onChange={onLevelChange}
              disabled={!isPredefined}
            />
            <HighlightToggle
              value={highlight}
              onChange={onHighlightChange}
              disabled={selection === null}
              label="Highlight scope"
            />
          </div>
        </div>
        <div className="mt-3 text-sm text-slate-400" data-testid="scope-summary">
          {selection === null && (
            <>
              Pick a role above to see scope coverage.{' '}
              <span className="text-slate-300">{coverage.total}</span> total areas across{' '}
              {coverage.byCategory.size} categories.
            </>
          )}
          {selection?.kind === 'predefined' && selectedRoleObj && (
            <>
              <span className="text-slate-200 font-medium">{selectedRoleObj.name}</span> at{' '}
              <span className="text-slate-200 font-medium">{levelName(level)}</span>:{' '}
              <span className="text-emerald-400 font-medium">{coverage.scoped}</span> of{' '}
              <span className="text-slate-300">{coverage.total}</span> typical areas
            </>
          )}
          {selection?.kind === 'custom' && (
            <>
              <span className="text-slate-200 font-medium">Custom selection</span>:{' '}
              <span className="text-emerald-400 font-medium">{coverage.scoped}</span> of{' '}
              <span className="text-slate-300">{coverage.total}</span> areas chosen
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function levelName(l: Level): string {
  return l === 'jr' ? 'Junior' : l === 'mid' ? 'Mid' : l === 'sr' ? 'Senior' : 'Staff';
}
