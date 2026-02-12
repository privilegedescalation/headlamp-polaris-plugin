import { NameValueTable, SectionBox, Dialog } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { ApiProxy } from '@kinvolk/headlamp-plugin/lib';
import React from 'react';
import { Result } from '../api/polaris';
import { getCheckName } from '../api/checkMapping';

interface ExemptionManagerProps {
  workloadResult: Result;
  namespace: string;
  kind: string;
  name: string;
}

interface CheckFailure {
  checkId: string;
  checkName: string;
}

/**
 * Exemption management UI for adding/removing Polaris exemptions
 * Uses annotation patches on the workload resource
 */
export default function ExemptionManager({
  workloadResult,
  namespace,
  kind,
  name,
}: ExemptionManagerProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [selectedChecks, setSelectedChecks] = React.useState<Set<string>>(new Set());
  const [exemptAll, setExemptAll] = React.useState(false);
  const [applying, setApplying] = React.useState(false);

  // Extract current exemptions from workload metadata
  const getExemptions = (): string[] => {
    // This would need to fetch the actual workload from K8s API
    // For now, return empty array as placeholder
    return [];
  };

  // Extract failing checks for this workload
  const getFailingChecks = (): CheckFailure[] => {
    const failures: CheckFailure[] = [];

    // Pod-level checks
    if (workloadResult.PodResult?.Results) {
      for (const [checkId, checkResult] of Object.entries(workloadResult.PodResult.Results)) {
        if (!checkResult.Success && checkResult.Severity !== 'ignore') {
          failures.push({
            checkId,
            checkName: getCheckName(checkId),
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
              });
            }
          }
        }
      }
    }

    return failures;
  };

  const failingChecks = getFailingChecks();
  const currentExemptions = getExemptions();

  const handleCheckToggle = (checkId: string) => {
    const newSelected = new Set(selectedChecks);
    if (newSelected.has(checkId)) {
      newSelected.delete(checkId);
    } else {
      newSelected.add(checkId);
    }
    setSelectedChecks(newSelected);
  };

  const applyExemptions = async () => {
    setApplying(true);

    try {
      // Construct the API path based on kind
      const apiGroup = getApiGroup(kind);
      const apiVersion = 'v1'; // This would need to be dynamic based on kind
      const plural = getPlural(kind);

      const patchPath = apiGroup
        ? `/apis/${apiGroup}/${apiVersion}/namespaces/${namespace}/${plural}/${name}`
        : `/api/v1/namespaces/${namespace}/${plural}/${name}`;

      // Build annotations patch
      const annotations: Record<string, string> = {};

      if (exemptAll) {
        annotations['polaris.fairwinds.com/exempt'] = 'true';
      } else {
        for (const checkId of selectedChecks) {
          annotations[`polaris.fairwinds.com/${checkId}-exempt`] = 'true';
        }
      }

      const patch = {
        metadata: {
          annotations,
        },
      };

      await ApiProxy.request(patchPath, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/strategic-merge-patch+json',
        },
        body: JSON.stringify(patch),
      });

      setDialogOpen(false);
      setSelectedChecks(new Set());
      setExemptAll(false);

      // Show success message (would need notistack integration)
      alert('Exemptions applied successfully');
    } catch (err) {
      alert(`Failed to apply exemptions: ${String(err)}`);
    } finally {
      setApplying(false);
    }
  };

  return (
    <>
      <SectionBox title="Exemptions">
        {currentExemptions.length > 0 ? (
          <NameValueTable
            rows={currentExemptions.map(exemption => ({
              name: exemption,
              value: (
                <button
                  style={{
                    padding: '4px 12px',
                    backgroundColor: 'var(--mui-palette-error-main, #f44336)',
                    color: 'var(--mui-palette-error-contrastText, #fff)',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                  onClick={() => {
                    // Remove exemption logic
                    alert('Remove exemption: ' + exemption);
                  }}
                >
                  Remove
                </button>
              ),
            }))}
          />
        ) : (
          <p>No exemptions configured</p>
        )}

        <button
          onClick={() => setDialogOpen(true)}
          disabled={failingChecks.length === 0}
          style={{
            marginTop: '8px',
            padding: '6px 16px',
            backgroundColor:
              failingChecks.length === 0
                ? 'var(--mui-palette-action-disabledBackground, #e0e0e0)'
                : 'transparent',
            color:
              failingChecks.length === 0
                ? 'var(--mui-palette-action-disabled, #9e9e9e)'
                : 'var(--mui-palette-primary-main, #1976d2)',
            border: '1px solid',
            borderColor:
              failingChecks.length === 0
                ? 'var(--mui-palette-divider, #e0e0e0)'
                : 'var(--mui-palette-primary-main, #1976d2)',
            borderRadius: '4px',
            cursor: failingChecks.length === 0 ? 'not-allowed' : 'pointer',
            fontSize: '13px',
          }}
        >
          Add Exemption
        </button>
      </SectionBox>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Add Exemptions">
        <div style={{ padding: '16px', minWidth: '400px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={exemptAll}
              onChange={e => setExemptAll(e.target.checked)}
            />
            <span>Exempt from all checks</span>
          </label>

          {!exemptAll && (
            <>
              <div style={{ marginTop: '16px', marginBottom: '8px', fontWeight: 600 }}>
                Select checks to exempt:
              </div>
              <div>
                {failingChecks.map(check => (
                  <label
                    key={check.checkId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '8px',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedChecks.has(check.checkId)}
                      onChange={() => handleCheckToggle(check.checkId)}
                    />
                    <span>{check.checkName}</span>
                  </label>
                ))}
              </div>
            </>
          )}

          <div
            style={{ marginTop: '16px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}
          >
            <button
              onClick={() => setDialogOpen(false)}
              style={{
                padding: '6px 16px',
                backgroundColor: 'transparent',
                color: 'var(--mui-palette-primary-main, #1976d2)',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              Cancel
            </button>
            <button
              onClick={applyExemptions}
              disabled={applying || (!exemptAll && selectedChecks.size === 0)}
              style={{
                padding: '6px 16px',
                backgroundColor:
                  applying || (!exemptAll && selectedChecks.size === 0)
                    ? 'var(--mui-palette-action-disabledBackground, #e0e0e0)'
                    : 'var(--mui-palette-primary-main, #1976d2)',
                color:
                  applying || (!exemptAll && selectedChecks.size === 0)
                    ? 'var(--mui-palette-action-disabled, #9e9e9e)'
                    : 'var(--mui-palette-primary-contrastText, #fff)',
                border: 'none',
                borderRadius: '4px',
                cursor:
                  applying || (!exemptAll && selectedChecks.size === 0) ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                fontWeight: 500,
              }}
            >
              {applying ? 'Applying...' : 'Apply'}
            </button>
          </div>
        </div>
      </Dialog>
    </>
  );
}

// Helper functions to get API info based on kind
function getApiGroup(kind: string): string | null {
  switch (kind) {
    case 'Deployment':
    case 'StatefulSet':
    case 'DaemonSet':
      return 'apps';
    case 'Job':
    case 'CronJob':
      return 'batch';
    default:
      return null;
  }
}

function getPlural(kind: string): string {
  switch (kind) {
    case 'Deployment':
      return 'deployments';
    case 'StatefulSet':
      return 'statefulsets';
    case 'DaemonSet':
      return 'daemonsets';
    case 'Job':
      return 'jobs';
    case 'CronJob':
      return 'cronjobs';
    default:
      return kind.toLowerCase() + 's';
  }
}
