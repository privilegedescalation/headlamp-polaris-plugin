import { registerSidebarEntry } from '@kinvolk/headlamp-plugin/lib';
import React from 'react';
import { usePolarisDataContext } from '../api/PolarisDataContext';
import { getNamespaces } from '../api/polaris';

const registeredNamespaces = new Set<string>();

export default function DynamicSidebarRegistrar() {
  const { data } = usePolarisDataContext();

  React.useEffect(() => {
    if (!data) return;

    const namespaces = getNamespaces(data);
    for (const ns of namespaces) {
      if (registeredNamespaces.has(ns)) continue;
      registeredNamespaces.add(ns);
      registerSidebarEntry({
        parent: 'polaris',
        name: `polaris-ns-${ns}`,
        label: ns,
        url: `/polaris/${ns}`,
        icon: 'mdi:folder-outline',
      });
    }
  }, [data]);

  return null;
}
