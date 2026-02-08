import { renderHook } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { makeAuditData, makeResult } from '../test-utils';

vi.mock('@kinvolk/headlamp-plugin/lib', () => ({
  ApiProxy: { request: vi.fn() },
}));

// Mock usePolarisData so PolarisDataProvider doesn't make real API calls
vi.mock('./polaris', async importOriginal => {
  const actual = await importOriginal<typeof import('./polaris')>();
  return {
    ...actual,
    usePolarisData: vi.fn(() => ({
      data: makeAuditData([makeResult()]),
      loading: false,
      error: null,
    })),
  };
});

import { PolarisDataProvider, usePolarisDataContext } from './PolarisDataContext';

describe('usePolarisDataContext', () => {
  it('throws when used outside PolarisDataProvider', () => {
    // Suppress console.error from React during expected error
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => usePolarisDataContext());
    }).toThrow('usePolarisDataContext must be used within a PolarisDataProvider');

    spy.mockRestore();
  });

  it('returns context value when inside PolarisDataProvider', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <PolarisDataProvider>{children}</PolarisDataProvider>
    );

    const { result } = renderHook(() => usePolarisDataContext(), { wrapper });

    expect(result.current.data).not.toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });
});
