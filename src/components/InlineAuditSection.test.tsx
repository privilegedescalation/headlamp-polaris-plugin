import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { makeAuditData, makeResult } from '../test-utils';

// Mock Headlamp lib
vi.mock('@kinvolk/headlamp-plugin/lib', () => ({
  ApiProxy: { request: vi.fn() },
}));

vi.mock('@mui/material/styles', () => ({
  useTheme: () => ({
    palette: {
      primary: { main: '#1976d2' },
      text: { primary: '#000', secondary: '#666' },
      action: { disabledBackground: '#e0e0e0', disabled: '#9e9e9e' },
      divider: '#e0e0e0',
      error: { main: '#f44336', contrastText: '#fff' },
      success: { main: '#4caf50' },
      warning: { main: '#ff9800' },
    },
  }),
}));

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  Link: ({ to, children, style }: { to: string; children: React.ReactNode; style?: object }) => (
    <a href={to} style={style}>
      {children}
    </a>
  ),
}));

// Mock Headlamp CommonComponents
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
  NameValueTable: ({ rows }: { rows: Array<{ name: string; value: React.ReactNode }> }) => (
    <table data-testid="name-value-table">
      <tbody>
        {rows.map(row => (
          <tr key={row.name}>
            <td>{row.name}</td>
            <td>{row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  ),
  SimpleTable: ({
    columns,
    data,
  }: {
    columns: Array<{ label: string; getter: (row: unknown) => React.ReactNode }>;
    data: unknown[];
  }) => (
    <table data-testid="simple-table">
      <thead>
        <tr>
          {columns.map(col => (
            <th key={col.label}>{col.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, i) => (
          <tr key={i}>
            {columns.map(col => (
              <td key={col.label}>{col.getter(row)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  ),
  Dialog: () => null,
}));

// Mock ExemptionManager
vi.mock('./ExemptionManager', () => ({
  default: () => <div data-testid="exemption-manager" />,
}));

const mockUsePolarisDataContext = vi.fn();
vi.mock('../api/PolarisDataContext', () => ({
  usePolarisDataContext: () => mockUsePolarisDataContext(),
}));

import InlineAuditSection from './InlineAuditSection';

describe('InlineAuditSection', () => {
  it('returns null when loading', () => {
    mockUsePolarisDataContext.mockReturnValue({ data: null, loading: true, error: null });
    const { container } = render(
      <InlineAuditSection
        resource={{ kind: 'Deployment', metadata: { name: 'x', namespace: 'y' } }}
      />
    );
    expect(container.innerHTML).toBe('');
  });

  it('returns null for unsupported kind', () => {
    mockUsePolarisDataContext.mockReturnValue({
      data: makeAuditData([]),
      loading: false,
      error: null,
    });
    const { container } = render(
      <InlineAuditSection resource={{ kind: 'Service', metadata: { name: 'x', namespace: 'y' } }} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('shows "not detected" when workload not found in audit data', () => {
    mockUsePolarisDataContext.mockReturnValue({
      data: makeAuditData([]),
      loading: false,
      error: null,
    });
    render(
      <InlineAuditSection
        resource={{ kind: 'Deployment', metadata: { name: 'my-app', namespace: 'default' } }}
      />
    );
    expect(screen.getByText(/Polaris dashboard not detected/)).toBeInTheDocument();
  });

  it('renders score and summary for a matching workload', () => {
    const data = makeAuditData([
      makeResult({
        Name: 'my-app',
        Namespace: 'default',
        Kind: 'Deployment',
        Results: {
          c1: {
            ID: 'c1',
            Message: '',
            Details: [],
            Success: true,
            Severity: 'warning',
            Category: 'X',
          },
          c2: {
            ID: 'c2',
            Message: '',
            Details: [],
            Success: false,
            Severity: 'warning',
            Category: 'X',
          },
        },
      }),
    ]);
    mockUsePolarisDataContext.mockReturnValue({ data, loading: false, error: null });

    render(
      <InlineAuditSection
        resource={{ kind: 'Deployment', metadata: { name: 'my-app', namespace: 'default' } }}
      />
    );
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText(/1 passing, 1 warnings, 0 dangers/)).toBeInTheDocument();
  });

  it('renders failing checks table with pod and container results', () => {
    const data = makeAuditData([
      makeResult({
        Name: 'my-app',
        Namespace: 'default',
        Kind: 'Deployment',
        Results: {},
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
          },
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
      }),
    ]);
    mockUsePolarisDataContext.mockReturnValue({ data, loading: false, error: null });

    render(
      <InlineAuditSection
        resource={{ kind: 'Deployment', metadata: { name: 'my-app', namespace: 'default' } }}
      />
    );
    expect(screen.getByText('Host IPC')).toBeInTheDocument();
    expect(screen.getByText('CPU Requests')).toBeInTheDocument();
    expect(screen.getByText('Host IPC is set')).toBeInTheDocument();
  });

  it('renders link to full report', () => {
    const data = makeAuditData([
      makeResult({
        Name: 'my-app',
        Namespace: 'default',
        Kind: 'Deployment',
        Results: {
          c1: {
            ID: 'c1',
            Message: '',
            Details: [],
            Success: true,
            Severity: 'warning',
            Category: 'X',
          },
        },
      }),
    ]);
    mockUsePolarisDataContext.mockReturnValue({ data, loading: false, error: null });

    render(
      <InlineAuditSection
        resource={{ kind: 'Deployment', metadata: { name: 'my-app', namespace: 'default' } }}
      />
    );
    const link = screen.getByText('View Full Report →');
    expect(link).toHaveAttribute('href', '/polaris/namespaces#default');
  });

  it('renders ExemptionManager', () => {
    const data = makeAuditData([
      makeResult({
        Name: 'my-app',
        Namespace: 'default',
        Kind: 'Deployment',
        Results: {
          c1: {
            ID: 'c1',
            Message: '',
            Details: [],
            Success: true,
            Severity: 'warning',
            Category: 'X',
          },
        },
      }),
    ]);
    mockUsePolarisDataContext.mockReturnValue({ data, loading: false, error: null });

    render(
      <InlineAuditSection
        resource={{ kind: 'Deployment', metadata: { name: 'my-app', namespace: 'default' } }}
      />
    );
    expect(screen.getByTestId('exemption-manager')).toBeInTheDocument();
  });
});
