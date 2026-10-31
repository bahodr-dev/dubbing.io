import type { SpeechCadence } from '../types';
import { useId } from 'react';
import { SPEECH_CADENCE_OPTIONS } from '../data/speechCadences';
import { WorkspaceSelect } from './dashboard/WorkspaceSelect';

export function SpeechCadenceField({ value, onChange, disabled = false }: {
  value: SpeechCadence | null;
  onChange: (value: SpeechCadence) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return <div style={{ margin: '12px 0' }}>
    <WorkspaceSelect id={id} label="Speech Cadence" value={value || ''}
      placeholder="Select speech cadence" disabled={disabled} options={SPEECH_CADENCE_OPTIONS}
      onChange={(next) => onChange(next as SpeechCadence)} />
    {value && <p role="status" style={{ marginTop: 8, fontSize: 'var(--text-meta)' }}>
      {SPEECH_CADENCE_OPTIONS.find((option) => option.value === value)?.description}
    </p>}
  </div>;
}
