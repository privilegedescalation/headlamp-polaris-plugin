import {
  Link,
  Loader,
  NameValueTable,
  SectionBox,
  SectionHeader,
  SimpleTable,
  StatusLabel,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import React from 'react';
import {
  computeScore,
  countResultsForItems,
  filterResultsByNamespace,
  getNamespaces,
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

export default function NamespacesListView() {
  const { data, loading, error } = usePolarisDataContext();

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
                <Link routeName="polaris-namespace" params={{ namespace: row.namespace }}>
                  {row.namespace}
                </Link>
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
              getter: (row: NamespaceRow) => <StatusLabel status="">{row.skipped}</StatusLabel>,
            },
          ]}
          data={rows}
          emptyMessage="No namespaces found in Polaris audit data."
        />
      </SectionBox>
    </>
  );
}
