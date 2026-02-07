import {
  registerPluginSettings,
  registerRoute,
  registerSidebarEntry,
} from '@kinvolk/headlamp-plugin/lib';
import React from 'react';
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
  component: () => <PolarisView />,
});

registerPluginSettings('polaris-headlamp-plugin', PolarisSettings, true);
