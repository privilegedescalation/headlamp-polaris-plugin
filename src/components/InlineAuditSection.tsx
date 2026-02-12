import {
  NameValueTable,
  SectionBox,
  StatusLabel,
  SimpleTable,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { Link } from 'react-router-dom';
import React from 'react';
import { usePolarisDataContext } from '../api/PolarisDataContext';
import { computeScore, countResultsForItems, ResultCounts } from '../api/polaris';
import { getCheckName, getSeverityStatus } from '../api/checkMapping';
import ExemptionManager from './ExemptionManager';

interface CheckFailure {
  checkId: string;
  checkName: string;
  severity: 'danger' | 'warning';
  message: string;
}

interface InlineAuditSectionProps {
  resource: any; // KubeObject from Headlamp
}

/**
 * Inline Polaris audit section for resource detail views
 * Shows a compact summary of Polaris findings for Deployments, StatefulSets, etc.
 */
export default function InlineAuditSection({ resource }: InlineAuditSectionProps) {
  const { data, loading } = usePolarisDataContext();

  if (loading || !data) {
    return null;
  }

  // Check if this is a supported controller kind
  const supportedKinds = ['Deployment', 'StatefulSet', 'DaemonSet', 'Job', 'CronJob'];
  const kind = resource.kind;

  if (!supportedKinds.includes(kind)) {
    return null;
  }

  const name = resource.metadata?.name;
  const namespace = resource.metadata?.namespace;

  if (!name || !namespace) {
    return null;
  }

  // Find this workload in Polaris audit data
  const workloadResult = data.Results.find(
    r => r.Kind === kind && r.Name === name && r.Namespace === namespace
  );

  if (!workloadResult) {
    return (
      <SectionBox title="Polaris Audit">
        <NameValueTable
          rows={[
            {
              name: 'Status',
              value: 'Polaris dashboard not detected — install Polaris to see audit results',
            },
          ]}
        />
      </SectionBox>
    );
  }

  // Calculate score and counts
  const counts = countResultsForItems([workloadResult]);
  const score = computeScore(counts);

  // Extract failing checks
  const failures: CheckFailure[] = [];

  // Pod-level checks
  if (workloadResult.PodResult?.Results) {
    for (const [checkId, checkResult] of Object.entries(workloadResult.PodResult.Results)) {
      if (!checkResult.Success && checkResult.Severity !== 'ignore') {
        failures.push({
          checkId,
          checkName: getCheckName(checkId),
          severity: checkResult.Severity as 'danger' | 'warning',
          message: checkResult.Message,
        });
      }
    }
  }

  // Container checks
  if (workloadResult.PodResult?.ContainerResults) {
    for (const container of workloadResult.PodResult.ContainerResults) {
      for (const [checkId, checkResult] of Object.entries(container.Results)) {
        if (!checkResult.Success && checkResult.Severity !== 'ignore') {
          // Avoid duplicates
          if (!failures.some(f => f.checkId === checkId)) {
            failures.push({
              checkId,
              checkName: getCheckName(checkId),
              severity: checkResult.Severity as 'danger' | 'warning',
              message: checkResult.Message,
            });
          }
        }
      }
    }
  }

  // Sort by severity
  failures.sort((a, b) => {
    if (a.severity === 'danger' && b.severity !== 'danger') return -1;
    if (a.severity !== 'danger' && b.severity === 'danger') return 1;
    return 0;
  });

  return (
    <SectionBox title="Polaris Audit">
      <NameValueTable
        rows={[
          {
            name: 'Score',
            value: (
              <StatusLabel status={score >= 80 ? 'success' : score >= 50 ? 'warning' : 'error'}>
                {score}%
              </StatusLabel>
            ),
          },
          {
            name: 'Summary',
            value: `${counts.pass} passing, ${counts.warning} warnings, ${counts.danger} dangers`,
          },
        ]}
      />

      {failures.length > 0 && (
        <>
          <div style={{ marginTop: '16px', marginBottom: '8px', fontWeight: 600 }}>
            Failing Checks:
          </div>
          <SimpleTable
            columns={[
              { label: 'Check', getter: (f: CheckFailure) => f.checkName },
              {
                label: 'Severity',
                getter: (f: CheckFailure) => (
                  <StatusLabel status={getSeverityStatus(f.severity)}>{f.severity}</StatusLabel>
                ),
              },
              { label: 'Message', getter: (f: CheckFailure) => f.message },
            ]}
            data={failures}
          />
        </>
      )}

      <div style={{ marginTop: '16px' }}>
        <Link
          to={`/polaris/namespaces#${namespace}`}
          style={{ color: 'var(--link-color, #1976d2)' }}
        >
          View Full Report →
        </Link>
      </div>

      <div style={{ marginTop: '16px' }}>
        <ExemptionManager
          workloadResult={workloadResult}
          namespace={namespace}
          kind={kind}
          name={name}
        />
      </div>
    </SectionBox>
  );
}
