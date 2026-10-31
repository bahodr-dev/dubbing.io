import { useEffect, useState } from 'react';
import { api } from '../services/api';

export function QualityModeField({ value, onChange, disabled = false }: {
  value: 'standard' | 'cinema'; onChange: (value: 'standard' | 'cinema') => void; disabled?: boolean;
}) {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    let cancelled = false;
    if (typeof api.dubbing.getCapabilities === 'function') {
      Promise.resolve(api.dubbing.getCapabilities()).then(c => { if (!cancelled) setAvailable(c?.cinema?.ready === true); }).catch(() => {});
    }
    return () => { cancelled = true; };
  }, []);
  return <label className="label">Quality
    <select className="input" aria-label="Dubbing quality" value={value} disabled={disabled} onChange={e => onChange(e.target.value as 'standard' | 'cinema')}>
      <option value="standard">Standard</option>
      <option value="cinema" disabled={!available}>Cinema quality · film va serial · internal beta</option>
    </select>
  </label>;
}
