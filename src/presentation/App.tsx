import { useCallback, useMemo, useState } from 'react';
import { CATEGORIES } from '../data/categories';
import { ROLES, roleById } from '../data/roles';
import { filterCategories } from '../domain/filter';
import type { Level, RoleId, RoleSelection } from '../domain/types';
import { CategoryCard } from './components/CategoryCard';
import { CustomRoleEditor } from './components/CustomRoleEditor';
import { FirstRunHint } from './components/FirstRunHint';
import { Header } from './components/Header';
import { HighlightLegend } from './components/HighlightLegend';
import { ProfilesMenu } from './components/ProfilesMenu';
import { SearchBox } from './components/SearchBox';
import { ShareLinkPreview } from './components/ShareLinkPreview';
import { useCoverage } from './hooks/useCoverage';
import { useRoleSelection } from './hooks/useRoleSelection';

export function App() {
  const {
    selection,
    highlight,
    level,
    setSelection,
    setHighlight,
    setLevel,
    toggleCustomItem,
    clearCustom,
    startCustom,
  } = useRoleSelection();

  const [editorOpen, setEditorOpen] = useState(false);
  const [query, setQuery] = useState('');

  const coverage = useCoverage(CATEGORIES, selection, level);
  const selectedRoleObj =
    selection?.kind === 'predefined' ? roleById(selection.id) ?? null : null;

  const handlePredefinedChange = (id: RoleId | null) => {
    setSelection(id === null ? null : { kind: 'predefined', id });
  };

  const handleCustomChosen = () => {
    if (selection?.kind !== 'custom') startCustom();
    setEditorOpen(true);
  };

  const handleShareApply = (shareSel: RoleSelection, shareLevel: Level, shareHighlight: boolean) => {
    setSelection(shareSel);
    setLevel(shareLevel);
    setHighlight(shareHighlight);
  };

  const customItemIds: ReadonlySet<string> =
    selection?.kind === 'custom' ? selection.itemIds : new Set();

  const trimmedQuery = query.trim();
  const visibleCategories = useMemo(() => filterCategories(CATEGORIES, query), [query]);
  const searchActive = trimmedQuery.length > 0;

  // In custom mode the map itself becomes the editor: pills toggle membership.
  const onItemToggle = selection?.kind === 'custom' ? toggleCustomItem : undefined;

  const applyProfileView = useCallback(
    (view: { selection: RoleSelection | null; level: Level; highlight: boolean }) => {
      setSelection(view.selection);
      setLevel(view.level);
      setHighlight(view.highlight);
    },
    [setSelection, setLevel, setHighlight],
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <Header
        roles={ROLES}
        selection={selection}
        selectedRoleObj={selectedRoleObj}
        level={level}
        onPredefinedChange={handlePredefinedChange}
        onCustomChosen={handleCustomChosen}
        onEditCustom={() => setEditorOpen(true)}
        onLevelChange={setLevel}
        highlight={highlight}
        onHighlightChange={setHighlight}
        coverage={coverage}
        profilesMenu={
          <ProfilesMenu
            selection={selection}
            level={level}
            highlight={highlight}
            onApply={applyProfileView}
          />
        }
      />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <FirstRunHint />
        {selectedRoleObj && (
          <p className="text-sm text-slate-400 mb-5 italic">{selectedRoleObj.description}</p>
        )}
        {selection?.kind === 'custom' && (
          <p className="text-sm text-slate-400 mb-5 italic">
            Your custom selection. Click any item below to add or remove it, or use "Edit
            custom" above for a list view.
          </p>
        )}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SearchBox value={query} onChange={setQuery} />
          {/* Mirror of ItemPill's coloring rule: show the legend whenever the
              pills actually carry scope colors (highlight on, or custom edit
              mode where membership is always visible). */}
          {selection !== null && (highlight || selection.kind === 'custom') && (
            <HighlightLegend selection={selection} />
          )}
        </div>
        {searchActive && visibleCategories.length === 0 ? (
          <p
            role="status"
            data-testid="search-empty"
            className="text-sm text-slate-500 text-center py-10"
          >
            No items match "{trimmedQuery}".
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {visibleCategories.map((cat) => (
              <CategoryCard
                key={cat.id}
                category={cat}
                coverage={coverage.byCategory.get(cat.id)}
                selection={selection}
                level={level}
                highlight={highlight}
                onItemToggle={onItemToggle}
              />
            ))}
          </div>
        )}
        <footer className="mt-10 mb-6 text-xs text-slate-500 text-center">
          A reference visualization. Item-to-role mappings reflect typical scope, not strict boundaries —
          real engineers often span more (or less) than their job title implies.
        </footer>
      </main>

      <CustomRoleEditor
        open={editorOpen}
        selectedItemIds={customItemIds}
        onToggle={toggleCustomItem}
        onClear={clearCustom}
        onClose={() => setEditorOpen(false)}
      />

      <ShareLinkPreview onApply={handleShareApply} />
    </div>
  );
}
