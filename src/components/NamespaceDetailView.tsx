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
import { usePolarisDataContext } from '../api/PolarisDataContext';
import {
  computeScore,
  countResultsForItems,
  filterResultsByNamespace,
  Result,
} from '../api/polaris';

function scoreStatus(score: number): 'success' | 'warning' | 'error' {
  if (score >= 80) return 'success';
  if (score >= 50) return 'warning';
  return 'error';
}

function resourceCounts(result: Result) {
  const counts = countResultsForItems([result]);
  return counts;
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
          <NameValueTable
            rows={[{ name: 'Status', value: 'No Polaris audit results found.' }]}
          />
        </SectionBox>
      </>
    );
  }

  const results = filterResultsByNamespace(data, namespace);
  const counts = countResultsForItems(results);
  const score = computeScore(counts);
  const status = scoreStatus(score);

  return (
    <>
      <SectionHeader title={`Polaris — ${namespace}`} />

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
              getter: (row: Result) => {
                const c = resourceCounts(row);
                return <StatusLabel status="success">{c.pass}</StatusLabel>;
              },
            },
            {
              label: 'Warning',
              getter: (row: Result) => {
                const c = resourceCounts(row);
                return <StatusLabel status="warning">{c.warning}</StatusLabel>;
              },
            },
            {
              label: 'Danger',
              getter: (row: Result) => {
                const c = resourceCounts(row);
                return <StatusLabel status="error">{c.danger}</StatusLabel>;
              },
            },
          ]}
          data={results}
          emptyMessage={`No resources found in namespace "${namespace}".`}
        />
      </SectionBox>
    </>
  );
}
