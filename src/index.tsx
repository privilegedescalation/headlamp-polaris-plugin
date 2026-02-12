import {
  registerAppBarAction,
  registerDetailsViewSection,
  registerPluginSettings,
  registerRoute,
  registerSidebarEntry,
} from '@kinvolk/headlamp-plugin/lib';
import React from 'react';
import { PolarisDataProvider } from './api/PolarisDataContext';
import DashboardView from './components/DashboardView';
import NamespacesListView from './components/NamespacesListView';
import PolarisSettings from './components/PolarisSettings';
import InlineAuditSection from './components/InlineAuditSection';
import AppBarScoreBadge from './components/AppBarScoreBadge';

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
    <PolarisDataProvider>
      <DashboardView />
    </PolarisDataProvider>
  ),
});

registerRoute({
  path: '/polaris/namespaces',
  sidebar: 'polaris-namespaces',
  name: 'polaris-namespaces',
  exact: true,
  component: () => (
    <PolarisDataProvider>
      <NamespacesListView />
    </PolarisDataProvider>
  ),
});

// Register plugin settings
registerPluginSettings('headlamp-polaris-plugin', PolarisSettings, true);

// Register details view section for supported controller types
registerDetailsViewSection(({ resource }) => {
  const supportedKinds = ['Deployment', 'StatefulSet', 'DaemonSet', 'Job', 'CronJob'];

  if (!supportedKinds.includes(resource?.kind)) {
    return null;
  }

  return (
    <PolarisDataProvider>
      <InlineAuditSection resource={resource} />
    </PolarisDataProvider>
  );
});

// Register app bar score badge
registerAppBarAction(() => (
  <PolarisDataProvider>
    <AppBarScoreBadge />
  </PolarisDataProvider>
));
