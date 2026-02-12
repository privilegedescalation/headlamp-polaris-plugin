import { ApiProxy } from '@kinvolk/headlamp-plugin/lib';
import {
  NameValueTable,
  SectionBox,
  StatusLabel,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import React from 'react';
import {
  AuditData,
  getDashboardUrl,
  getRefreshInterval,
  INTERVAL_OPTIONS,
  setDashboardUrl,
  setRefreshInterval,
} from '../api/polaris';

interface PluginSettingsProps {
  data?: { [key: string]: string | number | boolean };
  onDataChange?: (data: { [key: string]: string | number | boolean }) => void;
}

export default function PolarisSettings(props: PluginSettingsProps) {
  const { data, onDataChange } = props;
  const currentInterval = (data?.refreshInterval as number) ?? getRefreshInterval();
  const currentUrl = (data?.dashboardUrl as string) ?? getDashboardUrl();
  const [testing, setTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState<{ success: boolean; message: string } | null>(
    null
  );

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

  async function testConnection() {
    setTesting(true);
    setTestResult(null);

    try {
      const baseUrl = currentUrl;
      const apiPath = baseUrl.endsWith('/') ? `${baseUrl}results.json` : `${baseUrl}/results.json`;
      const isFullUrl = apiPath.startsWith('http://') || apiPath.startsWith('https://');

      let result: AuditData;

      if (isFullUrl) {
        const response = await fetch(apiPath);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        result = await response.json();
      } else {
        result = await ApiProxy.request(apiPath, {
          method: 'GET',
        });
      }

      setTestResult({
        success: true,
        message: `Connected successfully! Version: ${
          result.PolarisOutputVersion
        }, Last audit: ${new Date(result.AuditTime).toLocaleString()}`,
      });
    } catch (err) {
      setTestResult({
        success: false,
        message: `Connection failed: ${String(err)}`,
      });
    } finally {
      setTesting(false);
    }
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
                    border: '1px solid var(--mui-palette-divider, #e0e0e0)',
                    borderRadius: '4px',
                    fontSize: '14px',
                    backgroundColor: 'var(--mui-palette-background-paper, #fff)',
                    color: 'var(--mui-palette-text-primary, #000)',
                  }}
                />
                <div
                  style={{
                    fontSize: '12px',
                    color: 'var(--mui-palette-text-secondary, #666)',
                    marginTop: '4px',
                  }}
                >
                  Examples:
                  <br />• K8s proxy:{' '}
                  <code>/api/v1/namespaces/polaris/services/polaris-dashboard:80/proxy/</code>
                  <br />• Full URL: <code>https://my-polaris.example.com</code>
                </div>
              </div>
            ),
          },
          {
            name: 'Connection Test',
            value: (
              <div>
                <button
                  onClick={testConnection}
                  disabled={testing}
                  style={{
                    padding: '6px 16px',
                    backgroundColor: testing
                      ? 'var(--mui-palette-action-disabledBackground, #e0e0e0)'
                      : 'var(--mui-palette-primary-main, #1976d2)',
                    color: testing
                      ? 'var(--mui-palette-action-disabled, #9e9e9e)'
                      : 'var(--mui-palette-primary-contrastText, #fff)',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: testing ? 'not-allowed' : 'pointer',
                    fontSize: '13px',
                    fontWeight: 500,
                  }}
                >
                  {testing ? 'Testing...' : 'Test Connection'}
                </button>
                {testResult && (
                  <div style={{ marginTop: '8px' }}>
                    <StatusLabel status={testResult.success ? 'success' : 'error'}>
                      {testResult.message}
                    </StatusLabel>
                  </div>
                )}
              </div>
            ),
          },
        ]}
      />
    </SectionBox>
  );
}
