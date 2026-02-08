import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { makeAuditData, makeResult } from '../test-utils';

// Mock Headlamp lib
vi.mock('@kinvolk/headlamp-plugin/lib', () => ({
  ApiProxy: { request: vi.fn() },
}));

// Mock react-router-dom useParams
const mockNamespace = vi.fn(() => 'test-ns');
vi.mock('react-router-dom', () => ({
  useParams: () => ({ namespace: mockNamespace() }),
}));

// Mock Headlamp CommonComponents
vi.mock('@kinvolk/headlamp-plugin/lib/CommonComponents', () => ({
  Loader: ({ title }: { title: string }) => <div data-testid="loader">{title}</div>,
  SectionBox: ({ title, children }: { title?: string; children?: React.ReactNode }) => (
    <div data-testid="section-box" data-title={title}>
      {children}
    </div>
  ),
  SectionHeader: ({ title }: { title: string }) => <div data-testid="section-header">{title}</div>,
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
    emptyMessage,
  }: {
    columns: Array<{ label: string; getter: (row: unknown) => React.ReactNode }>;
    data: unknown[];
    emptyMessage?: string;
  }) =>
    data.length === 0 ? (
      <div data-testid="simple-table-empty">{emptyMessage}</div>
    ) : (
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
}));

const mockUsePolarisDataContext = vi.fn();
vi.mock('../api/PolarisDataContext', () => ({
  usePolarisDataContext: () => mockUsePolarisDataContext(),
}));

import NamespaceDetailView from './NamespaceDetailView';

describe('NamespaceDetailView', () => {
  it('renders loader when loading', () => {
    mockUsePolarisDataContext.mockReturnValue({
      data: null,
      loading: true,
      error: null,
    });

    render(<NamespaceDetailView />);
    expect(screen.getByTestId('loader')).toHaveTextContent('Loading Polaris data for test-ns');
  });

  it('renders error message when error is set', () => {
    mockUsePolarisDataContext.mockReturnValue({
      data: null,
      loading: false,
      error: 'Access denied (403)',
    });

    render(<NamespaceDetailView />);
    expect(screen.getByText('Access denied (403)')).toBeInTheDocument();
    expect(screen.getByTestId('section-header')).toHaveTextContent('Polaris — test-ns');
  });

  it('renders "No Data" when no data and no error', () => {
    mockUsePolarisDataContext.mockReturnValue({
      data: null,
      loading: false,
      error: null,
    });

    render(<NamespaceDetailView />);
    expect(screen.getByText('No Polaris audit results found.')).toBeInTheDocument();
  });

  it('renders namespace score and resource table with data', () => {
    const data = makeAuditData([
      makeResult({
        Name: 'deploy-a',
        Namespace: 'test-ns',
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
      makeResult({
        Name: 'other',
        Namespace: 'other-ns',
        Kind: 'Deployment',
        Results: {
          c3: {
            ID: 'c3',
            Message: '',
            Details: [],
            Success: true,
            Severity: 'warning',
            Category: 'X',
          },
        },
      }),
    ]);

    mockUsePolarisDataContext.mockReturnValue({
      data,
      loading: false,
      error: null,
    });

    render(<NamespaceDetailView />);

    // Header
    expect(screen.getByTestId('section-header')).toHaveTextContent('Polaris — test-ns');

    // Score section: 50% (1 pass / 2 total)
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('Total Checks')).toBeInTheDocument();

    // Resource table shows only test-ns resources
    expect(screen.getByText('deploy-a')).toBeInTheDocument();
    expect(screen.queryByText('other')).not.toBeInTheDocument();
  });

  it('renders empty table message for namespace with no results', () => {
    const data = makeAuditData([
      makeResult({
        Name: 'deploy-a',
        Namespace: 'other-ns',
        Results: {},
      }),
    ]);

    mockUsePolarisDataContext.mockReturnValue({
      data,
      loading: false,
      error: null,
    });

    render(<NamespaceDetailView />);
    expect(screen.getByTestId('simple-table-empty')).toHaveTextContent(
      'No resources found in namespace "test-ns"'
    );
  });
});
