import {
  Loader,
  NameValueTable,
  PercentageBar,
  PercentageCircle,
  SectionBox,
  SectionHeader,
  SimpleTable,
  StatusLabel,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import React from 'react';
import { AuditData, computeScore, countResults, ResultCounts } from '../api/polaris';
import { usePolarisDataContext } from '../api/PolarisDataContext';
import { getTopIssues, TopIssue } from '../api/topIssues';
import { getSeverityStatus } from '../api/checkMapping';

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

function formatAuditTime(auditTime: string): string {
  const date = new Date(auditTime);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}

export default function DashboardView() {
  const { data, loading, error, refresh } = usePolarisDataContext();

  if (loading) {
    return <Loader title="Loading Polaris audit data..." />;
  }

  const counts = data ? countResults(data) : null;
  const topIssues = data ? getTopIssues(data) : [];

  return (
    <>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
        }}
      >
        <SectionHeader title="Polaris — Overview" />
        {data && (
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', color: 'var(--mui-palette-text-secondary, #666)' }}>
              Last updated: {formatAuditTime(data.AuditTime)}
            </span>
            <button
              onClick={refresh}
              style={{
                padding: '6px 16px',
                backgroundColor: 'transparent',
                color: '#1976d2',
                border: '1px solid #1976d2',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 500,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>🔄</span>
              <span>Refresh</span>
            </button>
          </div>
        )}
      </div>

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

      {data && counts && (
        <>
          <OverviewSection data={data} counts={counts} />

          {topIssues.length > 0 && (
            <SectionBox title="Top Issues">
              <SimpleTable
                columns={[
                  { label: 'Check', getter: (issue: TopIssue) => issue.checkName },
                  { label: 'Category', getter: (issue: TopIssue) => issue.category },
                  {
                    label: 'Severity',
                    getter: (issue: TopIssue) => (
                      <StatusLabel status={getSeverityStatus(issue.severity)}>
                        {issue.severity}
                      </StatusLabel>
                    ),
                  },
                  {
                    label: 'Affected Workloads',
                    getter: (issue: TopIssue) => String(issue.count),
                  },
                ]}
                data={topIssues}
              />
            </SectionBox>
          )}
        </>
      )}

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
