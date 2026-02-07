import { NameValueTable, SectionBox } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import React from 'react';
import { getRefreshInterval, INTERVAL_OPTIONS, setRefreshInterval } from '../api/polaris';

interface PluginSettingsProps {
  data?: { [key: string]: string | number | boolean };
  onDataChange?: (data: { [key: string]: string | number | boolean }) => void;
}

export default function PolarisSettings(props: PluginSettingsProps) {
  const { data, onDataChange } = props;
  const currentInterval = (data?.refreshInterval as number) ?? getRefreshInterval();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const seconds = Number(e.target.value);
    setRefreshInterval(seconds);
    onDataChange?.({ ...data, refreshInterval: seconds });
  }

  return (
    <SectionBox title="Polaris Settings">
      <NameValueTable
        rows={[
          {
            name: 'Refresh Interval',
            value: (
              <select value={currentInterval} onChange={handleChange}>
                {INTERVAL_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ),
          },
        ]}
      />
    </SectionBox>
  );
}
