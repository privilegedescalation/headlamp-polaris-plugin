import { NameValueTable, SectionBox } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import React from 'react';
import { getDashboardUrl, getRefreshInterval, INTERVAL_OPTIONS, setDashboardUrl, setRefreshInterval } from '../api/polaris';

interface PluginSettingsProps {
  data?: { [key: string]: string | number | boolean };
  onDataChange?: (data: { [key: string]: string | number | boolean }) => void;
}

export default function PolarisSettings(props: PluginSettingsProps) {
  const { data, onDataChange } = props;
  const currentInterval = (data?.refreshInterval as number) ?? getRefreshInterval();
  const currentUrl = (data?.dashboardUrl as string) ?? getDashboardUrl();

  function handleIntervalChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const seconds = Number(e.target.value);
    setRefreshInterval(seconds);
    onDataChange?.({ ...data, refreshInterval: seconds });
  }

  function handleUrlChange(e: React.ChangeEvent<HTMLInputElement>) {
    const url = e.target.value;
    setDashboardUrl(url);
    onDataChange?.({ ...data, dashboardUrl: url });
  }

  return (
    <SectionBox title="Polaris Settings">
      <NameValueTable
        rows={[
          {
            name: 'Refresh Interval',
            value: (
              <select value={currentInterval} onChange={handleIntervalChange}>
                {INTERVAL_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ),
          },
          {
            name: 'Dashboard URL',
            value: (
              <div>
                <input
                  type="text"
                  value={currentUrl}
                  onChange={handleUrlChange}
                  placeholder="/api/v1/namespaces/polaris/services/polaris-dashboard:80/proxy/"
                  style={{
                    width: '100%',
                    padding: '4px 8px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '14px',
                  }}
                />
                <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                  Examples:<br />
                  • K8s proxy: <code>/api/v1/namespaces/polaris/services/polaris-dashboard:80/proxy/</code><br />
                  • Full URL: <code>https://my-polaris.example.com</code>
                </div>
              </div>
            ),
          },
        ]}
      />
    </SectionBox>
  );
}
