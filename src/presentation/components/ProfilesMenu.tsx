import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ChangeEvent,
} from 'react';
import { CATEGORIES } from '../../data/categories';
import { ROLES, roleById } from '../../data/roles';
import {
  computeDataVersion,
  type ProfileSelection,
  type ProfileSnapshot,
} from '../../domain/profiles';
import { buildExportFile, exportFileName, parseImportedProfile } from '../../domain/profileImport';
import { profileSummary, viewsMatch } from '../../domain/profileView';
import type { Level, RoleId, RoleSelection } from '../../domain/types';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useProfiles } from '../hooks/useProfiles';

interface ProfilesMenuProps {
  /** Live view — owned by App via `useRoleSelection`; passed in so there is exactly one source of truth. */
  selection: RoleSelection | null;
  level: Level;
  highlight: boolean;
  /** Apply a profile (or any view config) to the live view. */
  onApply: (view: { selection: RoleSelection | null; level: Level; highlight: boolean }) => void;
}

/**
 * Profile manager: trigger button in the Header plus a modal dialog listing
 * saved profiles with save-as / overwrite / load / rename / duplicate /
 * delete / import / export. All profile logic lives here — Header only
 * renders the slot (merge-surface discipline). Keyboard: focus is trapped
 * while open, Escape closes, and focus returns to the trigger on close.
 */
export function ProfilesMenu({ selection, level, highlight, onApply }: ProfilesMenuProps) {
  const { profiles, saveProfile, overwriteProfile, renameProfile, deleteProfile, duplicateProfile } =
    useProfiles();

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'list' | 'save-as'>('list');
  const [saveName, setSaveName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importNotes, setImportNotes] = useState<readonly string[] | null>(null);
  const [loadedProfileId, setLoadedProfileId] = useState<string | null>(null);

  const titleId = useId();
  const fileInputId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useFocusTrap({ active: open, containerRef: panelRef });

  const knownRoleIds = useMemo(() => new Set(ROLES.map((r) => r.id)), []);
  const knownItemIds = useMemo(
    () => new Set(CATEGORIES.flatMap((c) => c.items.map((i) => i.id))),
    [],
  );
  const dataVersion = useMemo(
    () => computeDataVersion(CATEGORIES.flatMap((c) => c.items.map((i) => i.id))),
    [],
  );

  const loaded = useMemo(
    () => profiles.find((p) => p.id === loadedProfileId) ?? null,
    [profiles, loadedProfileId],
  );
  const diverged = loaded !== null && !viewsMatch({ selection, level, highlight }, loaded);
  const canSave = selection !== null;

  const resetTransient = useCallback(() => {
    setMode('list');
    setSaveName('');
    setRenamingId(null);
    setConfirmingDeleteId(null);
    setImportError(null);
    setImportNotes(null);
  }, []);

  const openPanel = useCallback(() => {
    resetTransient();
    setOpen(true);
  }, [resetTransient]);

  const closePanel = useCallback(() => {
    setOpen(false);
    resetTransient();
  }, [resetTransient]);

  // Escape closes the panel — unless an input already consumed Escape for an
  // inner surface (cancel rename / save-as form), marked via defaultPrevented.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) closePanel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, closePanel]);

  const toProfileSelection = (s: RoleSelection | null): ProfileSelection | null => {
    if (s === null) return null;
    if (s.kind === 'predefined') return { kind: 'predefined', id: s.id };
    return { kind: 'custom', itemIds: [...s.itemIds] };
  };

  const handleSaveAs = (e: FormEvent) => {
    e.preventDefault();
    const profileSelection = toProfileSelection(selection);
    if (profileSelection === null) return;
    const created = saveProfile({ name: saveName, selection: profileSelection, level, highlight });
    setLoadedProfileId(created.id);
    setSaveName('');
    setMode('list');
  };

  const handleOverwrite = () => {
    if (loaded === null) return;
    const profileSelection = toProfileSelection(selection);
    if (profileSelection === null) return;
    overwriteProfile(loaded.id, { selection: profileSelection, level, highlight });
  };

  const handleLoad = (p: ProfileSnapshot) => {
    onApply({
      selection:
        p.selection.kind === 'predefined'
          ? { kind: 'predefined', id: p.selection.id }
          : { kind: 'custom', itemIds: new Set(p.selection.itemIds), name: p.name },
      level: p.level,
      highlight: p.highlight,
    });
    setLoadedProfileId(p.id);
    closePanel();
  };

  const handleExport = (p: ProfileSnapshot) => {
    const blob = new Blob([JSON.stringify(buildExportFile(p), null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = exportFileName(p);
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleFileChosen = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset so picking the same file again still fires change.
    e.target.value = '';
    if (!file) return;
    setImportError(null);
    setImportNotes(null);
    let text: string;
    try {
      text = await readFileText(file);
    } catch {
      setImportError('Could not read the selected file.');
      return;
    }
    const result = parseImportedProfile(text, knownRoleIds, knownItemIds, dataVersion);
    if (!result.ok) {
      setImportError(result.error);
      return;
    }
    saveProfile(result.fields);
    setImportNotes(result.notes.length > 0 ? result.notes : null);
  };

  const startRename = (p: ProfileSnapshot) => {
    setConfirmingDeleteId(null);
    setRenamingId(p.id);
    setRenameValue(p.name);
  };

  const commitRename = (e: FormEvent) => {
    e.preventDefault();
    if (renamingId !== null) renameProfile(renamingId, renameValue);
    setRenamingId(null);
  };

  const confirmDelete = () => {
    if (confirmingDeleteId !== null) {
      deleteProfile(confirmingDeleteId);
      if (loadedProfileId === confirmingDeleteId) setLoadedProfileId(null);
    }
    setConfirmingDeleteId(null);
  };

  const resolveRoleName = useCallback(
    (id: RoleId) => roleById(id)?.name ?? id,
    [],
  );

  return (
    <>
      <button
        type="button"
        data-testid="profiles-trigger"
        onClick={() => (open ? closePanel() : openPanel())}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="relative text-sm rounded-md border border-slate-700 bg-slate-900 text-slate-200 px-3 py-2 sm:px-2.5 sm:py-1.5 hover:bg-slate-800"
      >
        Profiles
        {diverged && (
          <>
            <span
              aria-hidden="true"
              data-testid="unsaved-dot"
              className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-amber-400"
            />
            <span className="sr-only">(unsaved changes)</span>
          </>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          data-testid="profiles-dialog"
        >
          <button
            type="button"
            aria-label="Close profiles"
            onClick={closePanel}
            tabIndex={-1}
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
          />
          <div
            ref={panelRef}
            className="relative w-full max-w-md max-h-[85vh] flex flex-col bg-slate-950 border border-slate-800 rounded-lg shadow-2xl"
          >
            <header className="flex items-center justify-between gap-3 p-4 border-b border-slate-800">
              <h2 id={titleId} className="text-slate-100 font-semibold">
                Profiles
              </h2>
              <button
                type="button"
                data-testid="close-profiles"
                onClick={closePanel}
                className="text-sm rounded-md border border-slate-700 bg-slate-900 text-slate-200 px-2.5 py-1.5 hover:bg-slate-800"
              >
                Close
              </button>
            </header>

            {mode === 'save-as' ? (
              <form onSubmit={handleSaveAs} className="p-4 space-y-3" data-testid="save-as-form">
                <label htmlFor={`${fileInputId}-name`} className="block text-sm text-slate-300">
                  Profile name
                </label>
                <input
                  id={`${fileInputId}-name`}
                  type="text"
                  autoFocus
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      // Consume Escape: this cancels the form; the panel stays open.
                      e.preventDefault();
                      setMode('list');
                    }
                  }}
                  placeholder="e.g. Backend — interview prep"
                  className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setMode('list')}
                    className="text-sm rounded-md border border-slate-700 bg-slate-900 text-slate-200 px-3 py-1.5 hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    data-testid="save-as-submit"
                    disabled={!saveName.trim()}
                    className="text-sm rounded-md border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 px-3 py-1.5 hover:bg-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Save profile
                  </button>
                </div>
              </form>
            ) : (
              <div className="overflow-y-auto" data-testid="profiles-list-panel">
                {diverged && loaded !== null && (
                  <div
                    data-testid="unsaved-banner"
                    className="mx-4 mt-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200 flex items-center justify-between gap-2 flex-wrap"
                  >
                    <span>Unsaved changes since loading “{loaded.name}”.</span>
                    <button
                      type="button"
                      data-testid="overwrite-loaded"
                      disabled={!canSave}
                      title={
                        canSave
                          ? undefined
                          : 'Pick a role or build a custom selection first — an empty view cannot be saved.'
                      }
                      onClick={handleOverwrite}
                      className="rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-200 px-2.5 py-1 text-xs hover:bg-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Save to “{loaded.name}”
                    </button>
                  </div>
                )}

                <div className="p-4 border-b border-slate-800 space-y-2">
                  <div className="flex gap-2 flex-wrap">
                    <button
                      type="button"
                      data-testid="save-as"
                      onClick={() => setMode('save-as')}
                      disabled={!canSave}
                      title={
                        canSave
                          ? undefined
                          : 'Pick a role or build a custom selection first — an empty view cannot be saved.'
                      }
                      className="text-sm rounded-md border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 px-3 py-1.5 hover:bg-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Save current view as…
                    </button>
                    <label
                      htmlFor={fileInputId}
                      className="inline-block text-sm rounded-md border border-slate-700 bg-slate-900 text-slate-200 px-3 py-1.5 hover:bg-slate-800 cursor-pointer"
                    >
                      Import from file…
                    </label>
                    <input
                      id={fileInputId}
                      type="file"
                      accept="application/json,.json"
                      onChange={handleFileChosen}
                      className="sr-only"
                    />
                  </div>
                  {!canSave && (
                    <p className="text-xs text-slate-500">
                      Pick a role or build a custom selection first — an empty view can’t be saved.
                    </p>
                  )}
                  {importError !== null && (
                    <p role="alert" data-testid="import-error" className="text-xs text-red-400">
                      {importError}
                    </p>
                  )}
                  {importNotes !== null && (
                    <div data-testid="import-notes" className="text-xs text-amber-300/90 space-y-0.5">
                      {importNotes.map((note) => (
                        <p key={note}>{note}</p>
                      ))}
                    </div>
                  )}
                </div>

                {profiles.length === 0 ? (
                  <p data-testid="profiles-empty" className="text-sm text-slate-500 text-center py-8 px-4">
                    No saved profiles yet. Set up a view above, then save it here to reuse it later.
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-800 p-4" data-testid="profiles-list">
                    {profiles.map((p) =>
                      renderRow(p),
                    )}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );

  function renderRow(p: ProfileSnapshot) {
    const isLoaded = p.id === loadedProfileId;
    const staleData = p.dataVersion !== undefined && p.dataVersion !== dataVersion;
    return (
      <li key={p.id} data-testid={`profile-row-${p.name}`} className="py-3 first:pt-0 last:pb-0">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="min-w-0 flex-1">
            {renamingId === p.id ? (
              <form onSubmit={commitRename} data-testid={`rename-form-${p.name}`} className="flex items-center gap-2">
                <input
                  type="text"
                  autoFocus
                  aria-label="Profile name"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      // Consume Escape: cancel the rename; the panel stays open.
                      e.preventDefault();
                      setRenamingId(null);
                    }
                  }}
                  className="w-full min-w-0 bg-slate-900 border border-slate-700 text-slate-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="submit"
                  disabled={!renameValue.trim()}
                  className="text-xs rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 px-2 py-1 hover:bg-emerald-500/20 disabled:opacity-40"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setRenamingId(null)}
                  className="text-xs rounded border border-slate-700 bg-slate-900 text-slate-300 px-2 py-1 hover:bg-slate-800"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <p className="text-sm text-slate-100 font-medium flex items-center gap-2 flex-wrap">
                {p.name}
                {isLoaded && (
                  <span data-testid="loaded-badge" className="text-xs rounded bg-emerald-500/15 text-emerald-300 px-1.5 py-0.5">
                    Loaded
                  </span>
                )}
                {staleData && (
                  <span
                    title="Saved against an older version of the map — loading may restore fewer items."
                    className="text-xs rounded bg-amber-500/15 text-amber-300 px-1.5 py-0.5"
                  >
                    older map version
                  </span>
                )}
              </p>
            )}
            <p className="text-xs text-slate-400 mt-0.5">
              {profileSummary(p, resolveRoleName)} · saved {formatSavedAt(p.savedAt)}
            </p>
          </div>

          {confirmingDeleteId === p.id ? (
            <span className="flex items-center gap-2 text-xs text-slate-400 flex-wrap">
              Delete “{p.name}”?
              <button
                type="button"
                data-testid="confirm-delete"
                onClick={confirmDelete}
                className="rounded border border-red-500/40 bg-red-500/10 px-2 py-1 text-red-300 hover:bg-red-500/20"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDeleteId(null)}
                className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
            </span>
          ) : (
            <div className="flex items-center gap-1.5 flex-wrap text-xs">
              <button
                type="button"
                onClick={() => handleLoad(p)}
                aria-label={`Load profile "${p.name}"`}
                className="rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 px-2 py-1 hover:bg-emerald-500/20"
              >
                Load
              </button>
              <button
                type="button"
                onClick={() => startRename(p)}
                aria-label={`Rename profile "${p.name}"`}
                className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-300 hover:bg-slate-800"
              >
                Rename
              </button>
              <button
                type="button"
                onClick={() => duplicateProfile(p.id)}
                aria-label={`Duplicate profile "${p.name}"`}
                className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-300 hover:bg-slate-800"
              >
                Duplicate
              </button>
              <button
                type="button"
                onClick={() => handleExport(p)}
                aria-label={`Export profile "${p.name}" as JSON file`}
                className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-300 hover:bg-slate-800"
              >
                Export
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDeleteId(p.id)}
                aria-label={`Delete profile "${p.name}"`}
                className="rounded border border-red-500/30 bg-red-500/5 px-2 py-1 text-red-300 hover:bg-red-500/15"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </li>
    );
  }
}

function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsText(file);
  });
}

function formatSavedAt(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}
