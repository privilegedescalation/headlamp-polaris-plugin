# Headlamp Plugin Loading Issue - Root Cause and Fix

## Problem

Headlamp v0.39.0 was not loading plugins installed via the plugin manager. Plugins appeared in Settings → Plugins but:

- No sidebar entries appeared
- No plugin settings were available
- Plugin JavaScript was not being executed in the browser

## Root Cause

When `config.watchPlugins: true` (the default), Headlamp treats catalog-managed plugins in `/headlamp/plugins/` as "development directory" plugins. This causes:

- Backend serves plugin metadata correctly
- Backend logs show "Treating catalog-installed plugin in development directory as user plugin"
- **Frontend does NOT execute the plugin JavaScript**
- Plugin registrations (`registerSidebarEntry`, `registerRoute`, etc.) never happen

## Solution

Set `config.watchPlugins: false` in the Headlamp HelmRelease values:

```yaml
spec:
  values:
    config:
      watchPlugins: false
    pluginsManager:
      enabled: true
      configContent: |
        plugins:
          - name: polaris
            source: https://artifacthub.io/packages/headlamp/polaris/headlamp-polaris-plugin
          # ... other plugins
```

## Why This Works

With `watchPlugins: false`:

- Headlamp no longer treats catalog-managed plugins as "development" plugins
- Frontend properly loads and executes plugin JavaScript on startup
- Plugin registrations happen correctly
- All plugin features (sidebar, routes, settings, etc.) work as expected

## Testing

After applying this fix:

1. Verify plugins are installed: `kubectl logs -n kube-system <headlamp-pod> -c headlamp-plugin`
2. Verify watchPlugins is false: `kubectl logs -n kube-system <headlamp-pod> -c headlamp | grep "Watch Plugins"`
3. Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+F5) to clear cached JavaScript
4. Verify plugin sidebar entries appear
5. Verify plugin functionality works

## Additional Notes

- This appears to be a bug/limitation in Headlamp v0.39.0
- The `watchPlugins` feature is intended for development scenarios where plugins are being actively modified
- For production deployments with catalog-managed plugins, `watchPlugins: false` is the correct configuration
- Once plugins are loaded, subsequent restarts or updates work correctly as long as `watchPlugins` remains false

## References

- Headlamp Helm Chart: <https://github.com/headlamp-k8s/headlamp/tree/main/charts/headlamp>
- Plugin Manager: <https://github.com/headlamp-k8s/headlamp/tree/main/plugins/headlamp-plugin>
- Issue discovered: 2026-02-11
- Fix applied: 2026-02-12
