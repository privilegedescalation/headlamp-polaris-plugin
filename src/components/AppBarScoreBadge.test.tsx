import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { makeAuditData, makeResult } from '../test-utils';

// Mock Headlamp lib
vi.mock('@kinvolk/headlamp-plugin/lib', () => ({
  ApiProxy: { request: vi.fn() },
  K8s: {
    useCluster: () => 'test-cluster',
  },
  Router: {
    createRouteURL: (name: string, params?: { cluster?: string }) =>
      `/c/${params?.cluster ?? 'default'}/${name}`,
  },
}));

vi.mock('@mui/material/styles', () => ({
  useTheme: () => ({
    palette: {
      success: { main: '#4caf50', contrastText: '#fff' },
      warning: { main: '#ff9800', contrastText: '#000' },
      error: { main: '#f44336', contrastText: '#fff' },
    },
  }),
}));

const mockPush = vi.fn();
vi.mock('react-router-dom', () => ({
  useHistory: () => ({ push: mockPush }),
  useLocation: () => ({ pathname: '/c/test-cluster/some-page', search: '', hash: '' }),
}));

const mockUsePolarisDataContext = vi.fn();
vi.mock('../api/PolarisDataContext', () => ({
  usePolarisDataContext: () => mockUsePolarisDataContext(),
}));

import AppBarScoreBadge from './AppBarScoreBadge';

describe('AppBarScoreBadge', () => {
  it('returns null when loading', () => {
    mockUsePolarisDataContext.mockReturnValue({ data: null, loading: true });
    const { container } = render(<AppBarScoreBadge />);
    expect(container.innerHTML).toBe('');
  });

  it('returns null when no data', () => {
    mockUsePolarisDataContext.mockReturnValue({ data: null, loading: false });
    const { container } = render(<AppBarScoreBadge />);
    expect(container.innerHTML).toBe('');
  });

  it('renders score with success color for high score', () => {
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
        },
      }),
    ]);
    mockUsePolarisDataContext.mockReturnValue({ data, loading: false });

    render(<AppBarScoreBadge />);
    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('Polaris: 100%');
    expect(button.style.backgroundColor).toBe('rgb(76, 175, 80)');
  });

  it('renders score with error color for low score', () => {
    const data = makeAuditData([
      makeResult({
        Results: {
          c1: {
            ID: 'c1',
            Message: '',
            Details: [],
            Success: false,
            Severity: 'danger',
            Category: 'X',
          },
        },
      }),
    ]);
    mockUsePolarisDataContext.mockReturnValue({ data, loading: false });

    render(<AppBarScoreBadge />);
    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('Polaris: 0%');
    expect(button.style.backgroundColor).toBe('rgb(244, 67, 54)');
  });

  it('navigates to /polaris on click', async () => {
    const user = userEvent.setup();
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
        },
      }),
    ]);
    mockUsePolarisDataContext.mockReturnValue({ data, loading: false });

    render(<AppBarScoreBadge />);
    await user.click(screen.getByRole('button'));
    expect(mockPush).toHaveBeenCalledWith('/c/test-cluster/polaris');
  });

  it('has correct aria-label', () => {
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
        },
      }),
    ]);
    mockUsePolarisDataContext.mockReturnValue({ data, loading: false });

    render(<AppBarScoreBadge />);
    expect(screen.getByLabelText('Polaris: 100%')).toBeInTheDocument();
  });
});
