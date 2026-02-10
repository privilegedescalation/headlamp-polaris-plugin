import {
  registerPluginSettings,
  registerRoute,
  registerSidebarEntry,
} from '@kinvolk/headlamp-plugin/lib';
import React from 'react';
import { PolarisDataProvider } from './api/PolarisDataContext';
import DashboardView from './components/DashboardView';
import NamespacesListView from './components/NamespacesListView';
import PolarisSettings from './components/PolarisSettings';

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

registerPluginSettings('polaris', PolarisSettings, true);
