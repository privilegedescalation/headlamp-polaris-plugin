import {
  Loader,
  NameValueTable,
  SectionBox,
  SectionHeader,
  SimpleTable,
  StatusLabel,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import React, { useEffect, useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import {
  computeScore,
  countResultsForItems,
  filterResultsByNamespace,
  getNamespaces,
  POLARIS_DASHBOARD_PROXY,
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
        position: 'fixed',
        right: 0,
        top: 0,
        bottom: 0,
        width: '600px',
        backgroundColor: 'var(--background-paper, #fff)',
        boxShadow: '-2px 0 8px rgba(0,0,0,0.15)',
        overflowY: 'auto',
        zIndex: 1200,
        padding: '20px',
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
        <h2 style={{ margin: 0 }}>Polaris — {namespace}</h2>
        <button
          onClick={onClose}
          style={{
            border: 'none',
            background: 'transparent',
            fontSize: '24px',
            cursor: 'pointer',
            padding: '0 8px',
          }}
          aria-label="Close panel"
        >
          ×
        </button>
      </div>

      <SectionBox title="External">
        <NameValueTable
          rows={[
            {
              name: 'Polaris Dashboard',
              value: (
                <a href={POLARIS_DASHBOARD_PROXY} target="_blank" rel="noopener noreferrer">
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

  // Handle keyboard navigation (Escape key closes drawer)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedNamespace) {
        closeNamespace();
      }
    };

    if (selectedNamespace) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNamespace]);

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
                    color: 'var(--link-color, #1976d2)',
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

      {selectedNamespace && (
        <>
          <div
            onClick={closeNamespace}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 1100,
            }}
            aria-label="Close panel backdrop"
          />
          <NamespaceDetailPanel namespace={selectedNamespace} onClose={closeNamespace} />
        </>
      )}
    </>
  );
}
