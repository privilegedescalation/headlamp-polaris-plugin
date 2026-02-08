import {
  Loader,
  NameValueTable,
  SectionBox,
  SectionHeader,
  SimpleTable,
  StatusLabel,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import React from 'react';
import { useParams } from 'react-router-dom';
import {
  computeScore,
  countResultsForItems,
  filterResultsByNamespace,
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

function resourceCounts(result: Result): ResultCounts {
  return countResultsForItems([result]);
}

export default function NamespaceDetailView() {
  const { namespace } = useParams<{ namespace: string }>();
  const { data, loading, error } = usePolarisDataContext();

  if (loading) {
    return <Loader title={`Loading Polaris data for ${namespace}...`} />;
  }

  if (error) {
    return (
      <>
        <SectionHeader title={`Polaris — ${namespace}`} />
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
        <SectionHeader title={`Polaris — ${namespace}`} />
        <SectionBox title="No Data">
          <NameValueTable rows={[{ name: 'Status', value: 'No Polaris audit results found.' }]} />
        </SectionBox>
      </>
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
    <>
      <SectionHeader title={`Polaris — ${namespace}`} />

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
    </>
  );
}
