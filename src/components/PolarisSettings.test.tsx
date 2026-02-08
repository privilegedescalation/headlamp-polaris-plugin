import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

// Mock Headlamp lib
vi.mock('@kinvolk/headlamp-plugin/lib', () => ({
  ApiProxy: { request: vi.fn() },
}));

// Mock Headlamp CommonComponents
vi.mock('@kinvolk/headlamp-plugin/lib/CommonComponents', () => ({
  SectionBox: ({ title, children }: { title?: string; children?: React.ReactNode }) => (
    <div data-testid="section-box" data-title={title}>
      {children}
    </div>
  ),
  NameValueTable: ({ rows }: { rows: Array<{ name: string; value: React.ReactNode }> }) => (
    <div data-testid="name-value-table">
      {rows.map(row => (
        <div key={row.name}>
          <span>{row.name}</span>
          <span>{row.value}</span>
        </div>
      ))}
    </div>
  ),
}));

import PolarisSettings from './PolarisSettings';

describe('PolarisSettings', () => {
  it('renders with interval from props.data', () => {
    render(<PolarisSettings data={{ refreshInterval: 60 }} />);

    const select = screen.getByRole('combobox');
    expect(select).toHaveValue('60');
  });

  it('falls back to getRefreshInterval when no prop data', () => {
    // Default is 300 (5 minutes)
    render(<PolarisSettings />);

    const select = screen.getByRole('combobox');
    expect(select).toHaveValue('300');
  });

  it('renders all interval options', () => {
    render(<PolarisSettings />);

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(4);
    expect(options[0]).toHaveTextContent('1 minute');
    expect(options[1]).toHaveTextContent('5 minutes');
    expect(options[2]).toHaveTextContent('10 minutes');
    expect(options[3]).toHaveTextContent('30 minutes');
  });

  it('calls setRefreshInterval and onDataChange when selection changes', async () => {
    const onDataChange = vi.fn();
    render(<PolarisSettings data={{ refreshInterval: 300 }} onDataChange={onDataChange} />);

    const select = screen.getByRole('combobox');
    await userEvent.selectOptions(select, '1800');

    // Check localStorage was updated
    expect(localStorage.getItem('polaris-plugin-refresh-interval')).toBe('1800');

    // Check callback was called with merged data
    expect(onDataChange).toHaveBeenCalledWith({ refreshInterval: 1800 });
  });

  it('works without onDataChange callback', async () => {
    render(<PolarisSettings data={{ refreshInterval: 300 }} />);

    const select = screen.getByRole('combobox');
    // Should not throw even without onDataChange
    await userEvent.selectOptions(select, '60');

    expect(localStorage.getItem('polaris-plugin-refresh-interval')).toBe('60');
  });
});
