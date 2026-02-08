import {
  Loader,
  NameValueTable,
  PercentageBar,
  PercentageCircle,
  SectionBox,
  SectionHeader,
  StatusLabel,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import React from 'react';
import { AuditData, computeScore, countResults, ResultCounts } from '../api/polaris';
import { usePolarisDataContext } from '../api/PolarisDataContext';

const COLORS = {
  pass: '#4caf50',
  warning: '#ff9800',
  danger: '#f44336',
  skipped: '#9e9e9e',
};

function OverviewSection(props: { data: AuditData; counts: ResultCounts }) {
  const { counts } = props;
  const score = computeScore(counts);

  const chartData = [
    { name: 'Pass', value: counts.pass, fill: COLORS.pass },
    { name: 'Warning', value: counts.warning, fill: COLORS.warning },
    { name: 'Danger', value: counts.danger, fill: COLORS.danger },
    { name: 'Skipped', value: counts.skipped, fill: COLORS.skipped },
  ];

  return (
    <>
      <SectionBox title="Cluster Score">
        <PercentageCircle data={chartData} total={counts.total} label={`${score}%`} />
      </SectionBox>
      <SectionBox title="Check Distribution">
        <PercentageBar data={chartData} total={counts.total} />
        <NameValueTable
          rows={[
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
      <SectionBox title="Cluster Info">
        <NameValueTable
          rows={[
            { name: 'Nodes', value: String(props.data.ClusterInfo.Nodes) },
            { name: 'Pods', value: String(props.data.ClusterInfo.Pods) },
            { name: 'Namespaces', value: String(props.data.ClusterInfo.Namespaces) },
            { name: 'Controllers', value: String(props.data.ClusterInfo.Controllers) },
          ]}
        />
      </SectionBox>
    </>
  );
}

export default function DashboardView() {
  const { data, loading, error } = usePolarisDataContext();

  if (loading) {
    return <Loader title="Loading Polaris audit data..." />;
  }

  const counts = data ? countResults(data) : null;

  return (
    <>
      <SectionHeader title="Polaris — Overview" />

      {error && (
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
      )}

      {data && counts && <OverviewSection data={data} counts={counts} />}

      {!data && !error && (
        <SectionBox title="No Data">
          <NameValueTable
            rows={[
              {
                name: 'Status',
                value: 'No Polaris audit results found.',
              },
            ]}
          />
        </SectionBox>
      )}
    </>
  );
}
