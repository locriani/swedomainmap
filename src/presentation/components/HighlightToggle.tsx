import { useId } from 'react';

interface Props {
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
}

export function HighlightToggle({ value, onChange, disabled, label }: Props) {
  const labelId = useId();
  return (
    <div className={`flex items-center gap-2 text-sm ${disabled ? 'opacity-50' : ''}`}>
      <span id={labelId} className="text-slate-300">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-labelledby={labelId}
        disabled={disabled}
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
          value ? 'bg-emerald-500' : 'bg-slate-700'
        } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
            value ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}
