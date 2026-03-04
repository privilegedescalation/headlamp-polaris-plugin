import { ApiProxy } from '@kinvolk/headlamp-plugin/lib';
import { Dialog, SectionBox, StatusLabel } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { useTheme } from '@mui/material/styles';
import React from 'react';
import { getCheckName } from '../api/checkMapping';
import { Result } from '../api/polaris';

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
  const theme = useTheme();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [selectedChecks, setSelectedChecks] = React.useState<Set<string>>(new Set());
  const [exemptAll, setExemptAll] = React.useState(false);
  const [applying, setApplying] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{ success: boolean; message: string } | null>(
    null
  );

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
    setFeedback(null);

    try {
      // Construct the API path based on kind
      const apiGroup = getApiGroup(kind);
      const plural = getPlural(kind);

      const patchPath = apiGroup
        ? `/apis/${apiGroup}/v1/namespaces/${namespace}/${plural}/${name}`
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
      setFeedback({ success: true, message: 'Exemptions applied successfully' });
    } catch (err) {
      setFeedback({ success: false, message: `Failed to apply exemptions: ${String(err)}` });
    } finally {
      setApplying(false);
    }
  };

  const isDisabled = applying || (!exemptAll && selectedChecks.size === 0);

  return (
    <>
      <SectionBox title="Exemptions">
        <p>No exemptions configured</p>

        {feedback && (
          <div style={{ marginBottom: '8px' }}>
            <StatusLabel status={feedback.success ? 'success' : 'error'}>
              {feedback.message}
            </StatusLabel>
          </div>
        )}

        <button
          onClick={() => setDialogOpen(true)}
          disabled={failingChecks.length === 0}
          style={{
            marginTop: '8px',
            padding: '6px 16px',
            backgroundColor:
              failingChecks.length === 0 ? theme.palette.action.disabledBackground : 'transparent',
            color:
              failingChecks.length === 0
                ? theme.palette.action.disabled
                : theme.palette.primary.main,
            border: '1px solid',
            borderColor:
              failingChecks.length === 0 ? theme.palette.divider : theme.palette.primary.main,
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
                color: theme.palette.primary.main,
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
              disabled={isDisabled}
              style={{
                padding: '6px 16px',
                backgroundColor: isDisabled
                  ? theme.palette.action.disabledBackground
                  : theme.palette.primary.main,
                color: isDisabled
                  ? theme.palette.action.disabled
                  : theme.palette.primary.contrastText,
                border: 'none',
                borderRadius: '4px',
                cursor: isDisabled ? 'not-allowed' : 'pointer',
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
