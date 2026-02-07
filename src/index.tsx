import {
  registerPluginSettings,
  registerRoute,
  registerSidebarEntry,
} from '@kinvolk/headlamp-plugin/lib';
import React from 'react';
import { PolarisDataProvider } from './api/PolarisDataContext';
import DynamicSidebarRegistrar from './components/DynamicSidebarRegistrar';
import NamespaceDetailView from './components/NamespaceDetailView';
import PolarisSettings from './components/PolarisSettings';
import PolarisView from './components/PolarisView';

registerSidebarEntry({
  parent: null,
  name: 'polaris',
  label: 'Polaris',
  url: '/polaris',
  icon: 'mdi:shield-check',
});

registerRoute({
  path: '/polaris',
  sidebar: 'polaris',
  name: 'polaris',
  exact: true,
  component: () => (
    <PolarisDataProvider>
      <DynamicSidebarRegistrar />
      <PolarisView />
    </PolarisDataProvider>
  ),
});

registerRoute({
  path: '/polaris/:namespace',
  sidebar: 'polaris',
  name: 'polaris-namespace',
  exact: true,
  component: () => (
    <PolarisDataProvider>
      <DynamicSidebarRegistrar />
      <NamespaceDetailView />
    </PolarisDataProvider>
  ),
});

registerPluginSettings('polaris-headlamp-plugin', PolarisSettings, true);
