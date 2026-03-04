import {
  Loader,
  NameValueTable,
  SectionBox,
  SectionHeader,
  SimpleTable,
  StatusLabel,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import { useTheme } from '@mui/material/styles';
import React, { useEffect, useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import {
  computeScore,
  countResultsForItems,
  filterResultsByNamespace,
  getNamespaces,
  getPolarisProxyUrl,
  Result,
  ResultCounts,
} from '../api/polaris';
import { usePolarisDataContext } from '../api/PolarisDataContext';

function scoreStatus(score: number): 'success' | 'warning' | 'error' {
  if (score >= 80) return 'success';
  if (score >= 50) return 'warning';
  return 'error';
}

interface NamespaceRow {
  namespace: string;
  score: number;
  pass: number;
  warning: number;
  danger: number;
  skipped: number;
}

function resourceCounts(result: Result): ResultCounts {
  return countResultsForItems([result]);
}

interface NamespaceDetailPanelProps {
  namespace: string;
  onClose: () => void;
}

function NamespaceDetailPanel({ namespace, onClose }: NamespaceDetailPanelProps) {
  const theme = useTheme();
  const [isMaximized, setIsMaximized] = React.useState(false);
  const { data, loading, error } = usePolarisDataContext();

  if (loading) {
    return (
      <div style={{ padding: '20px' }}>
        <Loader title={`Loading Polaris data for ${namespace}...`} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px' }}>
        <SectionBox title="Error">
          <NameValueTable
            rows={[
              {
                name: 'Status',
                value: <StatusLabel status="error">{error}</StatusLabel>,
              },
            ]}
          />
        </SectionBox>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: '20px' }}>
        <SectionBox title="No Data">
          <NameValueTable rows={[{ name: 'Status', value: 'No Polaris audit results found.' }]} />
        </SectionBox>
      </div>
    );
  }

  const results = filterResultsByNamespace(data, namespace);
  const counts = countResultsForItems(results);
  const score = computeScore(counts);
  const status = scoreStatus(score);

  const countsPerResource = new Map<string, ResultCounts>();
  for (const r of results) {
    countsPerResource.set(`${r.Namespace}/${r.Kind}/${r.Name}`, resourceCounts(r));
  }

  function getResourceCounts(row: Result): ResultCounts {
    return countsPerResource.get(`${row.Namespace}/${row.Kind}/${row.Name}`) ?? resourceCounts(row);
  }

  return (
    <div
      style={{
        width: isMaximized ? 'calc(100vw - 240px)' : '1000px',
        padding: '20px',
        transition: 'width 0.3s ease',
      }}
    >
      <div
        style={{
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h2 style={{ margin: 0, color: theme.palette.text.primary }}>Polaris — {namespace}</h2>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <IconButton
            onClick={() => setIsMaximized(!isMaximized)}
            aria-label={isMaximized ? 'Minimize panel' : 'Maximize panel'}
            title={isMaximized ? 'Minimize' : 'Maximize'}
            size="small"
          >
            {isMaximized ? '\u229F' : '\u22A1'}
          </IconButton>
          <IconButton onClick={onClose} aria-label="Close panel" title="Close" size="small">
            \u00D7
          </IconButton>
        </div>
      </div>

      <SectionBox title="External">
        <NameValueTable
          rows={[
            {
              name: 'Polaris Dashboard',
              value: (
                <a href={getPolarisProxyUrl()} target="_blank" rel="noopener noreferrer">
                  View in Polaris Dashboard
                </a>
              ),
            },
          ]}
        />
      </SectionBox>

      <SectionBox title="Namespace Score">
        <NameValueTable
          rows={[
            {
              name: 'Score',
              value: <StatusLabel status={status}>{score}%</StatusLabel>,
            },
            { name: 'Total Checks', value: String(counts.total) },
            {
              name: 'Pass',
              value: <StatusLabel status="success">{counts.pass}</StatusLabel>,
            },
            {
              name: 'Warning',
              value: <StatusLabel status="warning">{counts.warning}</StatusLabel>,
            },
            {
              name: 'Danger',
              value: <StatusLabel status="error">{counts.danger}</StatusLabel>,
            },
            {
              name: 'Skipped',
              value: (
                <span title="Only counts checks with Severity=ignore. Annotation-based exemptions are not included.">
                  {counts.skipped}
                </span>
              ),
            },
          ]}
        />
      </SectionBox>

      <SectionBox title="Resources">
        <SimpleTable
          columns={[
            { label: 'Name', getter: (row: Result) => row.Name },
            { label: 'Kind', getter: (row: Result) => row.Kind },
            {
              label: 'Pass',
              getter: (row: Result) => (
                <StatusLabel status="success">{getResourceCounts(row).pass}</StatusLabel>
              ),
            },
            {
              label: 'Warning',
              getter: (row: Result) => (
                <StatusLabel status="warning">{getResourceCounts(row).warning}</StatusLabel>
              ),
            },
            {
              label: 'Danger',
              getter: (row: Result) => (
                <StatusLabel status="error">{getResourceCounts(row).danger}</StatusLabel>
              ),
            },
          ]}
          data={results}
          emptyMessage={`No resources found in namespace "${namespace}".`}
        />
      </SectionBox>
    </div>
  );
}

export default function NamespacesListView() {
  const theme = useTheme();
  const location = useLocation();
  const history = useHistory();
  const { data, loading, error } = usePolarisDataContext();

  // Initialize from URL hash
  const [selectedNamespace, setSelectedNamespace] = useState<string | null>(
    location.hash.slice(1) || null
  );

  // Sync drawer state when URL hash changes (browser back/forward)
  useEffect(() => {
    const hashNs = location.hash.slice(1);
    setSelectedNamespace(hashNs || null);
  }, [location.hash]);

  const openNamespace = (ns: string) => {
    setSelectedNamespace(ns);
    history.push(`${location.pathname}#${ns}`);
  };

  const closeNamespace = () => {
    setSelectedNamespace(null);
    history.push(location.pathname);
  };

  if (loading) {
    return <Loader title="Loading Polaris audit data..." />;
  }

  if (error) {
    return (
      <>
        <SectionHeader title="Polaris — Namespaces" />
        <SectionBox title="Error">
          <NameValueTable
            rows={[
              {
                name: 'Status',
                value: <StatusLabel status="error">{error}</StatusLabel>,
              },
            ]}
          />
        </SectionBox>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <SectionHeader title="Polaris — Namespaces" />
        <SectionBox title="No Data">
          <NameValueTable rows={[{ name: 'Status', value: 'No Polaris audit results found.' }]} />
        </SectionBox>
      </>
    );
  }

  const namespaces = getNamespaces(data);
  const rows: NamespaceRow[] = namespaces.map(ns => {
    const results = filterResultsByNamespace(data, ns);
    const counts = countResultsForItems(results);
    const score = computeScore(counts);
    return {
      namespace: ns,
      score,
      pass: counts.pass,
      warning: counts.warning,
      danger: counts.danger,
      skipped: counts.skipped,
    };
  });

  return (
    <>
      <SectionHeader title="Polaris — Namespaces" />
      <SectionBox>
        <SimpleTable
          columns={[
            {
              label: 'Namespace',
              getter: (row: NamespaceRow) => (
                <button
                  onClick={() => openNamespace(row.namespace)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: theme.palette.primary.main,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: 0,
                    font: 'inherit',
                  }}
                >
                  {row.namespace}
                </button>
              ),
            },
            {
              label: 'Score',
              getter: (row: NamespaceRow) => (
                <StatusLabel status={scoreStatus(row.score)}>{row.score}%</StatusLabel>
              ),
            },
            {
              label: 'Pass',
              getter: (row: NamespaceRow) => <StatusLabel status="success">{row.pass}</StatusLabel>,
            },
            {
              label: 'Warning',
              getter: (row: NamespaceRow) => (
                <StatusLabel status="warning">{row.warning}</StatusLabel>
              ),
            },
            {
              label: 'Danger',
              getter: (row: NamespaceRow) => <StatusLabel status="error">{row.danger}</StatusLabel>,
            },
            {
              label: 'Skipped',
              getter: (row: NamespaceRow) => String(row.skipped),
            },
          ]}
          data={rows}
          emptyMessage="No namespaces found in Polaris audit data."
        />
      </SectionBox>

      <Drawer anchor="right" open={Boolean(selectedNamespace)} onClose={closeNamespace}>
        {selectedNamespace && (
          <NamespaceDetailPanel namespace={selectedNamespace} onClose={closeNamespace} />
        )}
      </Drawer>
    </>
  );
}
