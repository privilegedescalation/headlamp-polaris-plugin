import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { makeResult } from '../test-utils';

const { mockApiRequest } = vi.hoisted(() => ({ mockApiRequest: vi.fn() }));

vi.mock('@kinvolk/headlamp-plugin/lib', () => ({
  ApiProxy: { request: mockApiRequest },
}));

vi.mock('@mui/material/styles', () => ({
  useTheme: () => ({
    palette: {
      primary: { main: '#1976d2', contrastText: '#fff' },
      action: { disabledBackground: '#e0e0e0', disabled: '#9e9e9e' },
      divider: '#e0e0e0',
    },
  }),
}));

vi.mock('@kinvolk/headlamp-plugin/lib/CommonComponents', () => ({
  SectionBox: ({ title, children }: { title?: string; children?: React.ReactNode }) => (
    <div data-testid="section-box" data-title={title}>
      {children}
    </div>
  ),
  StatusLabel: ({ status, children }: { status: string; children?: React.ReactNode }) => (
    <span data-testid="status-label" data-status={status}>
      {children}
    </span>
  ),
  Dialog: ({
    open,
    children,
    title,
  }: {
    open: boolean;
    onClose?: () => void;
    title?: string;
    children?: React.ReactNode;
  }) =>
    open ? (
      <div data-testid="dialog" data-title={title}>
        {children}
      </div>
    ) : null,
}));

import ExemptionManager from './ExemptionManager';

const defaultProps = {
  workloadResult: makeResult(),
  namespace: 'default',
  kind: 'Deployment',
  name: 'my-deploy',
};

const resultWithPodFailures = makeResult({
  PodResult: {
    Name: 'pod',
    Results: {
      hostIPCSet: {
        ID: 'hostIPCSet',
        Message: 'Host IPC is set',
        Details: [],
        Success: false,
        Severity: 'danger',
        Category: 'Security',
      },
      hostPIDSet: {
        ID: 'hostPIDSet',
        Message: 'Host PID is set',
        Details: [],
        Success: false,
        Severity: 'danger',
        Category: 'Security',
      },
    },
    ContainerResults: [],
  },
});

const resultWithContainerFailures = makeResult({
  PodResult: {
    Name: 'pod',
    Results: {},
    ContainerResults: [
      {
        Name: 'container-1',
        Results: {
          cpuRequestsMissing: {
            ID: 'cpuRequestsMissing',
            Message: 'CPU requests missing',
            Details: [],
            Success: false,
            Severity: 'warning',
            Category: 'Efficiency',
          },
        },
      },
    ],
  },
});

const resultWithIgnoredFailures = makeResult({
  PodResult: {
    Name: 'pod',
    Results: {
      hostIPCSet: {
        ID: 'hostIPCSet',
        Message: '',
        Details: [],
        Success: false,
        Severity: 'ignore',
        Category: 'Security',
      },
    },
    ContainerResults: [],
  },
});

describe('ExemptionManager', () => {
  describe('rendering failing checks', () => {
    it('shows disabled Add Exemption button when no failing checks', () => {
      render(<ExemptionManager {...defaultProps} />);
      const btn = screen.getByRole('button', { name: /add exemption/i });
      expect(btn).toBeDisabled();
    });

    it('shows enabled Add Exemption button when there are failing checks', () => {
      render(<ExemptionManager {...defaultProps} workloadResult={resultWithPodFailures} />);
      const btn = screen.getByRole('button', { name: /add exemption/i });
      expect(btn).not.toBeDisabled();
    });

    it('does not include ignored-severity checks as failing', () => {
      render(<ExemptionManager {...defaultProps} workloadResult={resultWithIgnoredFailures} />);
      const btn = screen.getByRole('button', { name: /add exemption/i });
      expect(btn).toBeDisabled();
    });

    it('collects failing checks from pod-level results', () => {
      render(<ExemptionManager {...defaultProps} workloadResult={resultWithPodFailures} />);
      fireEvent.click(screen.getByRole('button', { name: /add exemption/i }));
      expect(screen.getByText('Host IPC')).toBeInTheDocument();
      expect(screen.getByText('Host PID')).toBeInTheDocument();
    });

    it('collects failing checks from container-level results', () => {
      render(
        <ExemptionManager {...defaultProps} workloadResult={resultWithContainerFailures} />
      );
      fireEvent.click(screen.getByRole('button', { name: /add exemption/i }));
      expect(screen.getByText('CPU Requests')).toBeInTheDocument();
    });

    it('deduplicates checks that appear in multiple containers', () => {
      const resultWithDuplicate = makeResult({
        PodResult: {
          Name: 'pod',
          Results: {},
          ContainerResults: [
            {
              Name: 'container-1',
              Results: {
                cpuRequestsMissing: {
                  ID: 'cpuRequestsMissing',
                  Message: '',
                  Details: [],
                  Success: false,
                  Severity: 'warning',
                  Category: 'Efficiency',
                },
              },
            },
            {
              Name: 'container-2',
              Results: {
                cpuRequestsMissing: {
                  ID: 'cpuRequestsMissing',
                  Message: '',
                  Details: [],
                  Success: false,
                  Severity: 'warning',
                  Category: 'Efficiency',
                },
              },
            },
          ],
        },
      });
      render(<ExemptionManager {...defaultProps} workloadResult={resultWithDuplicate} />);
      fireEvent.click(screen.getByRole('button', { name: /add exemption/i }));
      const items = screen.getAllByText('CPU Requests');
      expect(items).toHaveLength(1);
    });
  });

  describe('dialog interactions', () => {
    it('opens dialog when Add Exemption button is clicked', () => {
      render(<ExemptionManager {...defaultProps} workloadResult={resultWithPodFailures} />);
      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /add exemption/i }));
      expect(screen.getByTestId('dialog')).toBeInTheDocument();
    });

    it('closes dialog when Cancel button is clicked', () => {
      render(<ExemptionManager {...defaultProps} workloadResult={resultWithPodFailures} />);
      fireEvent.click(screen.getByRole('button', { name: /add exemption/i }));
      expect(screen.getByTestId('dialog')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
    });

    it('toggles individual check selection', () => {
      render(<ExemptionManager {...defaultProps} workloadResult={resultWithPodFailures} />);
      fireEvent.click(screen.getByRole('button', { name: /add exemption/i }));

      // Find the checkbox next to "Host IPC"
      const checkboxes = screen.getAllByRole('checkbox');
      // First checkbox is "Exempt from all checks", rest are individual checks
      const hostIPCCheckbox = checkboxes[1];
      expect(hostIPCCheckbox).not.toBeChecked();
      fireEvent.click(hostIPCCheckbox);
      expect(hostIPCCheckbox).toBeChecked();
      fireEvent.click(hostIPCCheckbox);
      expect(hostIPCCheckbox).not.toBeChecked();
    });

    it('hides individual checks list when exempt-all is toggled', () => {
      render(<ExemptionManager {...defaultProps} workloadResult={resultWithPodFailures} />);
      fireEvent.click(screen.getByRole('button', { name: /add exemption/i }));
      expect(screen.getByText('Host IPC')).toBeInTheDocument();

      const exemptAllCheckbox = screen.getByRole('checkbox', { name: /exempt from all checks/i });
      fireEvent.click(exemptAllCheckbox);
      expect(screen.queryByText('Host IPC')).not.toBeInTheDocument();
    });

    it('Apply button is disabled when no checks selected and exemptAll is false', () => {
      render(<ExemptionManager {...defaultProps} workloadResult={resultWithPodFailures} />);
      fireEvent.click(screen.getByRole('button', { name: /add exemption/i }));
      expect(screen.getByRole('button', { name: /apply/i })).toBeDisabled();
    });

    it('Apply button is enabled when exemptAll is checked', () => {
      render(<ExemptionManager {...defaultProps} workloadResult={resultWithPodFailures} />);
      fireEvent.click(screen.getByRole('button', { name: /add exemption/i }));
      const exemptAllCheckbox = screen.getByRole('checkbox', { name: /exempt from all checks/i });
      fireEvent.click(exemptAllCheckbox);
      expect(screen.getByRole('button', { name: /apply/i })).not.toBeDisabled();
    });

    it('Apply button is enabled when at least one individual check is selected', () => {
      render(<ExemptionManager {...defaultProps} workloadResult={resultWithPodFailures} />);
      fireEvent.click(screen.getByRole('button', { name: /add exemption/i }));
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[1]); // select first individual check
      expect(screen.getByRole('button', { name: /apply/i })).not.toBeDisabled();
    });
  });

  describe('ApiProxy.request calls', () => {
    it('patches with exempt-all annotation when exemptAll is selected', async () => {
      mockApiRequest.mockResolvedValue({});
      render(<ExemptionManager {...defaultProps} workloadResult={resultWithPodFailures} />);
      fireEvent.click(screen.getByRole('button', { name: /add exemption/i }));
      fireEvent.click(screen.getByRole('checkbox', { name: /exempt from all checks/i }));
      fireEvent.click(screen.getByRole('button', { name: /apply/i }));

      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith(
          '/apis/apps/v1/namespaces/default/deployments/my-deploy',
          expect.objectContaining({
            method: 'PATCH',
            headers: { 'Content-Type': 'application/strategic-merge-patch+json' },
            body: JSON.stringify({
              metadata: {
                annotations: { 'polaris.fairwinds.com/exempt': 'true' },
              },
            }),
          })
        );
      });
    });

    it('patches with per-check annotations when individual checks selected', async () => {
      mockApiRequest.mockResolvedValue({});
      render(<ExemptionManager {...defaultProps} workloadResult={resultWithPodFailures} />);
      fireEvent.click(screen.getByRole('button', { name: /add exemption/i }));
      // Select first check (hostIPCSet)
      fireEvent.click(screen.getAllByRole('checkbox')[1]);
      fireEvent.click(screen.getByRole('button', { name: /apply/i }));

      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith(
          '/apis/apps/v1/namespaces/default/deployments/my-deploy',
          expect.objectContaining({
            method: 'PATCH',
            body: JSON.stringify({
              metadata: {
                annotations: { 'polaris.fairwinds.com/hostIPCSet-exempt': 'true' },
              },
            }),
          })
        );
      });
    });

    it('uses core API path for Pod kind (no api group)', async () => {
      mockApiRequest.mockResolvedValue({});
      render(
        <ExemptionManager
          {...defaultProps}
          kind="Pod"
          workloadResult={resultWithPodFailures}
        />
      );
      fireEvent.click(screen.getByRole('button', { name: /add exemption/i }));
      fireEvent.click(screen.getByRole('checkbox', { name: /exempt from all checks/i }));
      fireEvent.click(screen.getByRole('button', { name: /apply/i }));

      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith(
          '/api/v1/namespaces/default/pods/my-deploy',
          expect.anything()
        );
      });
    });

    it('uses batch API group for Job kind', async () => {
      mockApiRequest.mockResolvedValue({});
      render(
        <ExemptionManager
          {...defaultProps}
          kind="Job"
          workloadResult={resultWithPodFailures}
        />
      );
      fireEvent.click(screen.getByRole('button', { name: /add exemption/i }));
      fireEvent.click(screen.getByRole('checkbox', { name: /exempt from all checks/i }));
      fireEvent.click(screen.getByRole('button', { name: /apply/i }));

      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith(
          '/apis/batch/v1/namespaces/default/jobs/my-deploy',
          expect.anything()
        );
      });
    });

    it('uses batch API group for CronJob kind', async () => {
      mockApiRequest.mockResolvedValue({});
      render(
        <ExemptionManager
          {...defaultProps}
          kind="CronJob"
          workloadResult={resultWithPodFailures}
        />
      );
      fireEvent.click(screen.getByRole('button', { name: /add exemption/i }));
      fireEvent.click(screen.getByRole('checkbox', { name: /exempt from all checks/i }));
      fireEvent.click(screen.getByRole('button', { name: /apply/i }));

      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith(
          '/apis/batch/v1/namespaces/default/cronjobs/my-deploy',
          expect.anything()
        );
      });
    });

    it('uses apps API group for StatefulSet kind', async () => {
      mockApiRequest.mockResolvedValue({});
      render(
        <ExemptionManager
          {...defaultProps}
          kind="StatefulSet"
          workloadResult={resultWithPodFailures}
        />
      );
      fireEvent.click(screen.getByRole('button', { name: /add exemption/i }));
      fireEvent.click(screen.getByRole('checkbox', { name: /exempt from all checks/i }));
      fireEvent.click(screen.getByRole('button', { name: /apply/i }));

      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith(
          '/apis/apps/v1/namespaces/default/statefulsets/my-deploy',
          expect.anything()
        );
      });
    });
  });

  describe('feedback states', () => {
    it('shows success feedback and closes dialog after successful apply', async () => {
      mockApiRequest.mockResolvedValue({});
      render(<ExemptionManager {...defaultProps} workloadResult={resultWithPodFailures} />);
      fireEvent.click(screen.getByRole('button', { name: /add exemption/i }));
      fireEvent.click(screen.getByRole('checkbox', { name: /exempt from all checks/i }));
      fireEvent.click(screen.getByRole('button', { name: /apply/i }));

      await waitFor(() => {
        expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
        const label = screen.getByTestId('status-label');
        expect(label).toHaveAttribute('data-status', 'success');
        expect(label).toHaveTextContent('Exemptions applied successfully');
      });
    });

    it('shows error feedback and keeps dialog closed after failed apply', async () => {
      mockApiRequest.mockRejectedValue(new Error('403 Forbidden'));
      render(<ExemptionManager {...defaultProps} workloadResult={resultWithPodFailures} />);
      fireEvent.click(screen.getByRole('button', { name: /add exemption/i }));
      fireEvent.click(screen.getByRole('checkbox', { name: /exempt from all checks/i }));
      fireEvent.click(screen.getByRole('button', { name: /apply/i }));

      await waitFor(() => {
        const label = screen.getByTestId('status-label');
        expect(label).toHaveAttribute('data-status', 'error');
        expect(label).toHaveTextContent(/failed to apply exemptions/i);
      });
    });

    it('shows "Applying..." text on Apply button while in-flight', async () => {
      let resolveRequest!: () => void;
      mockApiRequest.mockReturnValue(
        new Promise<void>(res => {
          resolveRequest = res;
        })
      );

      render(<ExemptionManager {...defaultProps} workloadResult={resultWithPodFailures} />);
      fireEvent.click(screen.getByRole('button', { name: /add exemption/i }));
      fireEvent.click(screen.getByRole('checkbox', { name: /exempt from all checks/i }));
      fireEvent.click(screen.getByRole('button', { name: /apply/i }));

      expect(screen.getByRole('button', { name: /applying/i })).toBeInTheDocument();
      resolveRequest();
      await waitFor(() => {
        expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
      });
    });
  });
});
