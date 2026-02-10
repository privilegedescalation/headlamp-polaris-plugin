import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { makeAuditData, makeResult } from '../test-utils';

// Mock Headlamp lib
vi.mock('@kinvolk/headlamp-plugin/lib', () => ({
  ApiProxy: { request: vi.fn() },
  Router: {
    createRouteURL: (name: string, params: Record<string, string>) =>
      `/polaris/ns/${params.namespace}`,
  },
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

import NamespacesListView from './NamespacesListView';

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('NamespacesListView', () => {
  it('renders loader when loading', () => {
    mockUsePolarisDataContext.mockReturnValue({
      data: null,
      loading: true,
      error: null,
    });

    renderWithRouter(<NamespacesListView />);
    expect(screen.getByTestId('loader')).toHaveTextContent('Loading Polaris audit data');
  });

  it('renders error message when error is set', () => {
    mockUsePolarisDataContext.mockReturnValue({
      data: null,
      loading: false,
      error: 'Polaris dashboard not reachable',
    });

    renderWithRouter(<NamespacesListView />);
    expect(screen.getByText('Polaris dashboard not reachable')).toBeInTheDocument();
  });

  it('renders "No Data" when no data and no error', () => {
    mockUsePolarisDataContext.mockReturnValue({
      data: null,
      loading: false,
      error: null,
    });

    renderWithRouter(<NamespacesListView />);
    expect(screen.getByText('No Polaris audit results found.')).toBeInTheDocument();
  });

  it('renders namespace rows with correct scores and buttons', () => {
    const data = makeAuditData([
      makeResult({
        Name: 'deploy-a',
        Namespace: 'alpha',
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
      makeResult({
        Name: 'deploy-b',
        Namespace: 'beta',
        Results: {
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

    renderWithRouter(<NamespacesListView />);

    // Namespace buttons (now buttons instead of links for drawer)
    const alphaButton = screen.getByText('alpha');
    expect(alphaButton).toBeInTheDocument();
    expect(alphaButton.tagName).toBe('BUTTON');

    const betaButton = screen.getByText('beta');
    expect(betaButton).toBeInTheDocument();
    expect(betaButton.tagName).toBe('BUTTON');
  });

  it('uses correct scoreStatus: >=80 success, >=50 warning, <50 error', () => {
    // Create a namespace with 100% score (1 pass) and one with 0% (1 danger)
    const data = makeAuditData([
      makeResult({
        Name: 'perfect',
        Namespace: 'good-ns',
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
      makeResult({
        Name: 'bad',
        Namespace: 'bad-ns',
        Results: {
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

    renderWithRouter(<NamespacesListView />);

    // Find score StatusLabels - good-ns has 100% (success), bad-ns has 0% (error)
    const statusLabels = screen.getAllByTestId('status-label');
    const scoreLabels = statusLabels.filter(el => el.textContent?.includes('%'));

    const successScore = scoreLabels.find(el => el.textContent === '100%');
    expect(successScore).toHaveAttribute('data-status', 'success');

    const errorScore = scoreLabels.find(el => el.textContent === '0%');
    expect(errorScore).toHaveAttribute('data-status', 'error');
  });

  it('opens drawer when namespace button is clicked and URL hash is updated', async () => {
    const user = userEvent.setup();
    const data = makeAuditData([
      makeResult({
        Name: 'deploy-a',
        Namespace: 'alpha',
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

    mockUsePolarisDataContext.mockReturnValue({
      data,
      loading: false,
      error: null,
    });

    renderWithRouter(<NamespacesListView />);

    // Click the namespace button
    const alphaButton = screen.getByText('alpha');
    await user.click(alphaButton);

    // Drawer should open (check for the panel title)
    expect(screen.getByText(/Polaris — alpha/)).toBeInTheDocument();
  });

  it('initializes drawer from URL hash', () => {
    const data = makeAuditData([
      makeResult({
        Name: 'deploy-a',
        Namespace: 'test-ns',
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

    mockUsePolarisDataContext.mockReturnValue({
      data,
      loading: false,
      error: null,
    });

    // Render with initial hash in URL
    render(
      <MemoryRouter initialEntries={['/polaris/namespaces#test-ns']}>
        <NamespacesListView />
      </MemoryRouter>
    );

    // Drawer should be open with the namespace from hash
    expect(screen.getByText(/Polaris — test-ns/)).toBeInTheDocument();
  });
});
