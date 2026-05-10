import { useState } from 'react';
import { CATEGORIES } from '../data/categories';
import { ROLES, roleById } from '../data/roles';
import type { RoleId } from '../domain/types';
import { CategoryCard } from './components/CategoryCard';
import { CustomRoleEditor } from './components/CustomRoleEditor';
import { Header } from './components/Header';
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

  const customItemIds: ReadonlySet<string> =
    selection?.kind === 'custom' ? selection.itemIds : new Set();

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
      />

      <main className="max-w-6xl mx-auto px-6 py-6">
        {selectedRoleObj && (
          <p className="text-sm text-slate-400 mb-5 italic">{selectedRoleObj.description}</p>
        )}
        {selection?.kind === 'custom' && (
          <p className="text-sm text-slate-400 mb-5 italic">
            Your custom selection. Click "Edit custom" above to adjust.
          </p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {CATEGORIES.map((cat) => (
            <CategoryCard
              key={cat.id}
              category={cat}
              coverage={coverage.byCategory.get(cat.id)}
              selection={selection}
              level={level}
              highlight={highlight}
            />
          ))}
        </div>
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
    </div>
  );
}
