import { useId } from 'react';
import type { Role, RoleSelection } from '../../domain/types';

interface Props {
  roles: readonly Role[];
  selection: RoleSelection | null;
  onPredefinedChange: (id: Role['id'] | null) => void;
  onCustomChosen: () => void;
}

const CUSTOM_OPTION_VALUE = '__custom__';

export function RoleSelector({
  roles,
  selection,
  onPredefinedChange,
  onCustomChosen,
}: Props) {
  const id = useId();
  const value =
    selection === null
      ? ''
      : selection.kind === 'custom'
        ? CUSTOM_OPTION_VALUE
        : selection.id;

  return (
    <div className="flex items-center gap-2 text-sm">
      <label htmlFor={id} className="text-slate-400">
        Role
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          if (v === '') return onPredefinedChange(null);
          if (v === CUSTOM_OPTION_VALUE) return onCustomChosen();
          const match = roles.find((r) => r.id === v);
          if (match) onPredefinedChange(match.id);
        }}
        className="bg-slate-900 border border-slate-700 text-slate-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-emerald-500"
      >
        <option value="">— None —</option>
        <option value={CUSTOM_OPTION_VALUE}>★ Custom selection</option>
        {roles.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
    </div>
  );
}
