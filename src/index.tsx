import {
  registerAppBarAction,
  registerDetailsViewSection,
  registerPluginSettings,
  registerRoute,
  registerSidebarEntry,
} from '@kinvolk/headlamp-plugin/lib';
import { SectionBox, StatusLabel } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import React from 'react';
import { PolarisDataProvider } from './api/PolarisDataContext';
import AppBarScoreBadge from './components/AppBarScoreBadge';
import DashboardView from './components/DashboardView';
import InlineAuditSection from './components/InlineAuditSection';
import NamespacesListView from './components/NamespacesListView';
import PolarisSettings from './components/PolarisSettings';

// --- Error boundary for plugin components ---

interface ErrorBoundaryState {
  error: string | null;
}

class PolarisErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error: error.message };
  }

  render() {
    if (this.state.error) {
      return (
        <SectionBox title="Polaris Plugin Error">
          <StatusLabel status="error">{this.state.error}</StatusLabel>
        </SectionBox>
      );
    }
    return this.props.children;
  }
}

// --- Sidebar entries ---

registerSidebarEntry({
  parent: null,
  name: 'polaris',
  label: 'Polaris',
  url: '/polaris',
  icon: 'mdi:shield-check',
});

registerSidebarEntry({
  parent: 'polaris',
  name: 'polaris-overview',
  label: 'Overview',
  url: '/polaris',
  icon: 'mdi:view-dashboard',
});

registerSidebarEntry({
  parent: 'polaris',
  name: 'polaris-namespaces',
  label: 'Namespaces',
  url: '/polaris/namespaces',
  icon: 'mdi:dns',
});

// --- Routes ---

registerRoute({
  path: '/polaris',
  sidebar: 'polaris-overview',
  name: 'polaris',
  exact: true,
  component: () => (
    <PolarisErrorBoundary>
      <PolarisDataProvider>
        <DashboardView />
      </PolarisDataProvider>
    </PolarisErrorBoundary>
  ),
});

registerRoute({
  path: '/polaris/namespaces',
  sidebar: 'polaris-namespaces',
  name: 'polaris-namespaces',
  exact: true,
  component: () => (
    <PolarisErrorBoundary>
      <PolarisDataProvider>
        <NamespacesListView />
      </PolarisDataProvider>
    </PolarisErrorBoundary>
  ),
});

// Register plugin settings
registerPluginSettings('headlamp-polaris', PolarisSettings, true);

// Register details view section for supported controller types
registerDetailsViewSection(({ resource }) => {
  const supportedKinds = ['Deployment', 'StatefulSet', 'DaemonSet', 'Job', 'CronJob'];

  if (!supportedKinds.includes(resource?.kind)) {
    return null;
  }

  return (
    <PolarisErrorBoundary>
      <PolarisDataProvider>
        <InlineAuditSection resource={resource} />
      </PolarisDataProvider>
    </PolarisErrorBoundary>
  );
});

// Register app bar score badge
registerAppBarAction(() => (
  <PolarisErrorBoundary>
    <PolarisDataProvider>
      <AppBarScoreBadge />
    </PolarisDataProvider>
  </PolarisErrorBoundary>
));
