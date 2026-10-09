import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildExportFile } from '../../domain/profileImport';
import type { ProfileSnapshot } from '../../domain/profiles';
import type { ViewSnapshot } from '../../domain/profileView';
import { ProfilesMenu } from './ProfilesMenu';

const KEY = 'swedomainmap.profiles.v1';
// Real item ids from the data layer (slugified labels in `categories.ts`).
const SWIFT = 'swift';
const LANG_C = 'lang-c';

function seedRegistry(profiles: unknown[]) {
  window.localStorage.setItem(KEY, JSON.stringify({ v: 1, profiles }));
}

function readRegistry(): { v: number; profiles: ProfileSnapshot[] } {
  const raw = window.localStorage.getItem(KEY);
  expect(raw).not.toBeNull();
  return JSON.parse(raw as string);
}

const predefinedBackend: ProfileSnapshot = {
  id: 'p-backend',
  v: 1,
  name: 'Backend sr',
  selection: { kind: 'predefined', id: 'backend' },
  level: 'sr',
  highlight: true,
  savedAt: '2026-01-01T10:00:00Z',
};

const customProfile: ProfileSnapshot = {
  id: 'p-custom',
  v: 1,
  name: 'My custom mix',
  selection: { kind: 'custom', itemIds: [SWIFT, LANG_C] },
  level: 'jr',
  highlight: false,
  savedAt: '2026-01-02T10:00:00Z',
};

/** Harness holding the live view so tests can mutate it the way the app does. */
function Harness({ initialView }: { initialView?: Partial<ViewSnapshot> }) {
  const [view, setView] = useState<ViewSnapshot>({
    selection: { kind: 'predefined', id: 'backend' },
    level: 'sr',
    highlight: true,
    ...initialView,
  });
  const levelCycle = { jr: 'mid', mid: 'sr', sr: 'staff', staff: 'jr' } as const;
  return (
    <div>
      <div data-testid="live-view">
        {view.selection === null
          ? 'no-selection'
          : view.selection.kind === 'predefined'
            ? `predefined:${view.selection.id}`
            : `custom:${[...view.selection.itemIds].sort().join(',')}`}
        |{view.level}|{String(view.highlight)}
      </div>
      <button
        type="button"
        data-testid="bump-level"
        onClick={() => setView((v) => ({ ...v, level: levelCycle[v.level] }))}
      >
        bump
      </button>
      <ProfilesMenu
        selection={view.selection}
        level={view.level}
        highlight={view.highlight}
        onApply={setView}
      />
    </div>
  );
}

function openMenu() {
  const trigger = screen.getByTestId('profiles-trigger');
  trigger.focus();
  fireEvent.click(trigger);
  return trigger;
}

function containerFileInput(): HTMLElement {
  const dialog = screen.getByTestId('profiles-dialog');
  const input = dialog.querySelector('input[type="file"]');
  if (!(input instanceof HTMLElement)) throw new Error('file input not found');
  return input;
}

/** jsdom ignores fireEvent's `target.files` assignment — define the property instead. */
function chooseFile(file: File) {
  const input = containerFileInput();
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  fireEvent.change(input);
}

/** jsdom has no blob-URL APIs; install test doubles and return the cleanup. */
function stubBlobUrls() {
  const createdUrls: string[] = [];
  const createObjectURL = vi.fn(() => {
    const url = `blob:mock-${createdUrls.length}`;
    createdUrls.push(url);
    return url;
  });
  const revokeObjectURL = vi.fn();
  Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true, writable: true });
  Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true, writable: true });
  return { createdUrls, createObjectURL, revokeObjectURL };
}

function removeBlobUrlStubs() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (URL as any).createObjectURL;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (URL as any).revokeObjectURL;
}

describe('ProfilesMenu', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('opens the dialog from the trigger and closes it on Escape, restoring focus', () => {
    render(<Harness />);
    expect(screen.queryByRole('dialog')).toBeNull();

    const trigger = openMenu();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('shows an empty state when no profiles are saved', () => {
    render(<Harness />);
    openMenu();
    expect(screen.getByTestId('profiles-empty')).toHaveTextContent(/no saved profiles yet/i);
  });

  it('disables saving when the live view has no selection', () => {
    render(<Harness initialView={{ selection: null }} />);
    openMenu();
    expect(screen.getByTestId('save-as')).toBeDisabled();
    expect(screen.getByText(/an empty view can’t be saved/i)).toBeInTheDocument();
  });

  it('saves the current view as a named profile and persists it', async () => {
    render(<Harness />);
    openMenu();

    fireEvent.click(screen.getByTestId('save-as'));
    fireEvent.change(screen.getByLabelText('Profile name'), { target: { value: 'Backend sr' } });
    fireEvent.click(screen.getByTestId('save-as-submit'));

    const row = screen.getByTestId('profile-row-Backend sr');
    expect(row).toHaveTextContent('Backend Engineer · Senior');
    expect(row).toHaveTextContent(/saved /);
    // Saving from the current view marks the new profile loaded.
    expect(screen.getByTestId('loaded-badge')).toBeInTheDocument();

    await waitFor(() => expect(window.localStorage.getItem(KEY)).not.toBeNull());
    const registry = readRegistry();
    expect(registry.profiles).toHaveLength(1);
    expect(registry.profiles[0]).toMatchObject({
      name: 'Backend sr',
      level: 'sr',
      highlight: true,
      selection: { kind: 'predefined', id: 'backend' },
    });
  });

  it('loads a profile into the live view and closes the panel', () => {
    seedRegistry([customProfile]);
    render(<Harness />);
    openMenu();

    fireEvent.click(screen.getByRole('button', { name: /load profile "my custom mix"/i }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('live-view')).toHaveTextContent(`custom:${LANG_C},${SWIFT}|jr|false`);
  });

  it('flags unsaved changes when the view diverges and supports overwrite', async () => {
    seedRegistry([predefinedBackend]);
    render(<Harness />);
    openMenu();
    fireEvent.click(screen.getByRole('button', { name: /load profile "backend sr"/i }));

    // Matching view → no indicator.
    expect(screen.queryByTestId('unsaved-dot')).toBeNull();

    // Diverge: bump the level like the real LevelSelector would.
    fireEvent.click(screen.getByTestId('bump-level'));
    expect(screen.getByTestId('unsaved-dot')).toBeInTheDocument();

    openMenu();
    const banner = screen.getByTestId('unsaved-banner');
    expect(banner).toHaveTextContent(/unsaved changes since loading/i);
    expect(banner).toHaveTextContent('Backend sr');

    fireEvent.click(screen.getByTestId('overwrite-loaded'));
    await waitFor(() => expect(screen.queryByTestId('unsaved-banner')).toBeNull());
    await waitFor(() => {
      const registry = readRegistry();
      expect(registry.profiles[0]).toMatchObject({ id: 'p-backend', level: 'staff' });
    });
    // Overwrite keeps the profile loaded; the view now matches it again.
    expect(screen.queryByTestId('unsaved-dot')).toBeNull();
  });

  it('renames a profile inline', async () => {
    seedRegistry([predefinedBackend]);
    render(<Harness />);
    openMenu();

    fireEvent.click(screen.getByRole('button', { name: /rename profile "backend sr"/i }));
    const input = screen.getByLabelText('Profile name');
    expect(input).toHaveValue('Backend sr');
    fireEvent.change(input, { target: { value: 'Backend — interviews' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);

    expect(screen.getByTestId('profile-row-Backend — interviews')).toBeInTheDocument();
    await waitFor(() => {
      const registry = readRegistry();
      expect(registry.profiles[0].name).toBe('Backend — interviews');
    });
  });

  it('duplicates a profile as "<name> (copy)"', () => {
    seedRegistry([predefinedBackend]);
    render(<Harness />);
    openMenu();

    fireEvent.click(screen.getByRole('button', { name: /duplicate profile "backend sr"/i }));

    expect(screen.getByTestId('profile-row-Backend sr')).toBeInTheDocument();
    expect(screen.getByTestId('profile-row-Backend sr (copy)')).toBeInTheDocument();
    // Both rows render the same summary.
    expect(screen.getAllByText(/backend engineer · senior/i)).toHaveLength(2);
  });

  it('deletes a profile only after an inline confirm, and cancel keeps it', async () => {
    seedRegistry([predefinedBackend]);
    render(<Harness />);
    openMenu();

    fireEvent.click(screen.getByRole('button', { name: /delete profile "backend sr"/i }));
    // Not deleted yet — confirmation is pending.
    expect(screen.getByTestId('profile-row-Backend sr')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByTestId('profile-row-Backend sr')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /delete profile "backend sr"/i }));
    fireEvent.click(screen.getByTestId('confirm-delete'));
    expect(screen.queryByTestId('profile-row-Backend sr')).toBeNull();
    await waitFor(() => expect(readRegistry().profiles).toHaveLength(0));
  });

  it('exports a profile as a downloaded JSON file', () => {
    seedRegistry([predefinedBackend]);
    const { createdUrls, createObjectURL, revokeObjectURL } = stubBlobUrls();
    let downloadedName = '';
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function mockClick(this: HTMLAnchorElement) {
        downloadedName = this.download;
      });

    try {
      render(<Harness />);
      openMenu();
      fireEvent.click(
        screen.getByRole('button', { name: /export profile "backend sr" as json file/i }),
      );

      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(downloadedName).toBe('backend-sr.json');
      expect(createObjectURL).toHaveBeenCalledTimes(1);
      expect(revokeObjectURL).toHaveBeenCalledWith(createdUrls[0]);
    } finally {
      removeBlobUrlStubs();
    }
  });

  it('imports a valid export file and lists it', async () => {
    render(<Harness />);
    openMenu();

    const file = new File([JSON.stringify(buildExportFile(customProfile))], 'profile.json', {
      type: 'application/json',
    });
    chooseFile(file);

    await waitFor(() =>
      expect(screen.getByTestId('profile-row-My custom mix')).toBeInTheDocument(),
    );
    const row = screen.getByTestId('profile-row-My custom mix');
    expect(row).toHaveTextContent('2 items');
    // Clean import → no repair notes.
    expect(screen.queryByTestId('import-notes')).toBeNull();
  });

  it('reports drops when importing a custom profile with unknown items', async () => {
    render(<Harness />);
    openMenu();

    const file = new File(
      [
        JSON.stringify(
          buildExportFile({
            ...customProfile,
            selection: { kind: 'custom', itemIds: [SWIFT, 'deleted-item', 'another-gone'] },
          }),
        ),
      ],
      'profile.json',
      { type: 'application/json' },
    );
    chooseFile(file);

    await waitFor(() =>
      expect(screen.getByTestId('profile-row-My custom mix')).toBeInTheDocument(),
    );
    const row = screen.getByTestId('profile-row-My custom mix');
    // Only the known id survives; the two unknown ones are dropped and reported.
    expect(row).toHaveTextContent('1 item');
    expect(screen.getByTestId('import-notes')).toHaveTextContent(/dropped 2 unknown items/i);
  });

  it('shows a clear inline error for malformed files and imports nothing', async () => {
    render(<Harness />);
    openMenu();

    const file = new File(['{not-json'], 'broken.json', { type: 'application/json' });
    chooseFile(file);

    // FileReader resolves on a later macrotask — the error needs a waitFor.
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/not valid json/i);
    expect(screen.queryByTestId('profiles-list')).toBeNull();
  });

  it('rejects profiles referencing an unknown role, naming the role', async () => {
    render(<Harness />);
    openMenu();

    // Deliberately stale input: build raw JSON (not buildExportFile) because
    // the role id intentionally isn't a valid RoleId.
    const file = new File(
      [
        JSON.stringify({
          kind: 'swedomainmap-profile',
          v: 1,
          profile: { ...predefinedBackend, selection: { kind: 'predefined', id: 'cobol' } },
        }),
      ],
      'stale-role.json',
      { type: 'application/json' },
    );
    chooseFile(file);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/"cobol"/i);
    expect(screen.queryByTestId('profiles-list')).toBeNull();
  });

  it('traps Tab focus inside the dialog while open', () => {
    render(<Harness />);
    openMenu();
    const dialog = screen.getByRole('dialog');

    fireEvent.keyDown(window, { key: 'Tab' });
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    expect(dialog.contains(document.activeElement)).toBe(true);
  });
});
