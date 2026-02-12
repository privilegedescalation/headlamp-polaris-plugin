import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { makeAuditData, makeResult } from '../test-utils';

// Mock Headlamp lib
vi.mock('@kinvolk/headlamp-plugin/lib', () => ({
  ApiProxy: { request: vi.fn() },
}));

// Mock Headlamp CommonComponents as thin pass-throughs
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
  SimpleTable: ({ data }: { data: Array<any> }) => (
    <table data-testid="simple-table">
      <tbody>
        {data.map((item, idx) => (
          <tr key={idx}>
            <td>{JSON.stringify(item)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  ),
  PercentageCircle: ({ label }: { label: string }) => (
    <div data-testid="percentage-circle">{label}</div>
  ),
  PercentageBar: () => <div data-testid="percentage-bar" />,
}));

// Mock the context hook — we'll override per test via mockReturnValue
const mockUsePolarisDataContext = vi.fn();
vi.mock('../api/PolarisDataContext', () => ({
  usePolarisDataContext: () => mockUsePolarisDataContext(),
}));

import DashboardView from './DashboardView';

describe('DashboardView', () => {
  it('renders loader when loading', () => {
    mockUsePolarisDataContext.mockReturnValue({
      data: null,
      loading: true,
      error: null,
    });

    render(<DashboardView />);
    expect(screen.getByTestId('loader')).toHaveTextContent('Loading Polaris audit data');
  });

  it('renders error message when error is set', () => {
    mockUsePolarisDataContext.mockReturnValue({
      data: null,
      loading: false,
      error: 'Access denied (403)',
    });

    render(<DashboardView />);
    expect(screen.getByText('Access denied (403)')).toBeInTheDocument();
  });

  it('renders score, check distribution, and cluster info with data', () => {
    const data = makeAuditData([
      makeResult({
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
            Severity: 'danger',
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

    render(<DashboardView />);

    // Score circle shows 50%
    expect(screen.getByTestId('percentage-circle')).toHaveTextContent('50%');

    // Check distribution values
    expect(screen.getByText('Total Checks')).toBeInTheDocument();

    // Cluster info section (title is in data-title attr of SectionBox)
    const sectionBoxes = screen.getAllByTestId('section-box');
    const clusterInfoBox = sectionBoxes.find(
      el => el.getAttribute('data-title') === 'Cluster Info'
    );
    expect(clusterInfoBox).toBeDefined();

    // Cluster info values
    expect(screen.getByText('Nodes')).toBeInTheDocument();
    expect(screen.getByText('Pods')).toBeInTheDocument();
  });

  it('renders "No Data" when no data and no error', () => {
    mockUsePolarisDataContext.mockReturnValue({
      data: null,
      loading: false,
      error: null,
    });

    render(<DashboardView />);
    expect(screen.getByText('No Polaris audit results found.')).toBeInTheDocument();
  });
});
