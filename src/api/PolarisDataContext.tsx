import React from 'react';
import { AuditData, getRefreshInterval, usePolarisData } from './polaris';

interface PolarisDataContextValue {
  data: AuditData | null;
  loading: boolean;
  error: string | null;
}

const PolarisDataContext = React.createContext<PolarisDataContextValue | null>(null);

export function PolarisDataProvider(props: { children: React.ReactNode }) {
  const interval = getRefreshInterval();
  const state = usePolarisData(interval);

  return (
    <PolarisDataContext.Provider value={state}>{props.children}</PolarisDataContext.Provider>
  );
}

export function usePolarisDataContext(): PolarisDataContextValue {
  const ctx = React.useContext(PolarisDataContext);
  if (ctx === null) {
    throw new Error('usePolarisDataContext must be used within a PolarisDataProvider');
  }
  return ctx;
}
