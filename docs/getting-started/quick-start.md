# Quick Start

Get the Headlamp Polaris Plugin up and running in 5 minutes.

## Prerequisites

Before starting, ensure:

- Kubernetes cluster is running
- Headlamp v0.26+ is deployed
- Polaris is installed with dashboard enabled

Don't have these? See [Prerequisites](prerequisites.md) for installation instructions.

## Step 1: Install the Plugin (2 minutes)

### Via Headlamp UI

1. Open Headlamp in your browser
2. Go to **Settings → Plugins → Catalog**
3. Search for "Polaris"
4. Click **Install** on "Headlamp Polaris Plugin"
5. Hard refresh browser: **Cmd+Shift+R** (Mac) or **Ctrl+Shift+R** (Windows/Linux)

### Via Helm (if using Helm-managed Headlamp)

```bash
# Add plugin manager config to Headlamp values
cat <<EOF > headlamp-values.yaml
config:
  pluginsDir: /headlamp/plugins

pluginsManager:
  enabled: true
  repositories:
    - https://artifacthub.io/packages/search?kind=4
EOF

# Update Headlamp
helm upgrade --install headlamp headlamp/headlamp \
  --namespace kube-system \
  --values headlamp-values.yaml
```

Then install via Headlamp UI as described above.

## Step 2: Configure RBAC (1 minute)

Grant the plugin permission to access Polaris data:

```bash
kubectl apply -f - <<EOF
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: polaris-proxy-reader
  namespace: polaris
rules:
  - apiGroups: [""]
    resources: ["services/proxy"]
    resourceNames: ["polaris-dashboard"]
    verbs: ["get"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: headlamp-polaris-proxy
  namespace: polaris
subjects:
  - kind: ServiceAccount
    name: headlamp
    namespace: kube-system
roleRef:
  kind: Role
  name: polaris-proxy-reader
  apiGroup: rbac.authorization.k8s.io
EOF
```

**Note:** Adjust the `namespace` in `subjects` if your Headlamp runs in a different namespace.

## Step 3: Verify Installation (1 minute)

### UI Verification

1. **Check Plugin is Loaded:**

   - Go to **Settings → Plugins**
   - Verify "headlamp-polaris-plugin" is listed

2. **Check Sidebar:**

   - Look for **Polaris** entry in the left sidebar
   - If not visible, hard refresh: **Cmd+Shift+R** / **Ctrl+Shift+R**

3. **View Overview Dashboard:**

   - Click **Polaris** in sidebar
   - Overview page loads with:
     - Cluster score gauge
     - Check distribution charts
     - Top 10 failing checks
     - Cluster statistics

4. **Check App Bar Badge:**
   - Colored chip in top navigation bar shows cluster score
   - Click badge to navigate to overview

### CLI Verification

```bash
# Verify plugin files exist
kubectl -n kube-system exec -it deployment/headlamp -c headlamp -- \
  ls /headlamp/plugins/headlamp-polaris-plugin/dist/

# Expected output:
# main.js

# Verify RBAC is correct
kubectl auth can-i get services/proxy \
  --as=system:serviceaccount:kube-system:headlamp \
  -n polaris \
  --resource-name=polaris-dashboard

# Expected output: yes

# Test Polaris API access
kubectl get --raw /api/v1/namespaces/polaris/services/polaris-dashboard:80/proxy/results.json \
  | jq .PolarisOutputVersion

# Expected output: "1.0" or similar
```

## Step 4: Explore Features (1 minute)

### Overview Dashboard

Navigate to **Polaris → Overview**:

- **Cluster Score Gauge:** Overall cluster health (0-100%)

  - Green (≥80%): Excellent
  - Yellow (50-79%): Needs improvement
  - Red (<50%): Critical issues

- **Check Distribution:** Pass/Warning/Danger/Skipped counts with charts

- **Top 10 Failing Checks:** Most common issues across the cluster

- **Cluster Statistics:** Nodes, pods, namespaces, controllers count

- **Manual Refresh:** Click refresh button to fetch latest audit data

### Namespaces View

Navigate to **Polaris → Namespaces**:

- Table of all namespaces with per-namespace scores
- Click a namespace to open detailed side panel
- Side panel shows:
  - Namespace score and check counts
  - Resource-level audit results
  - Link to external Polaris dashboard

### Inline Resource Audits

View any workload detail page (Deployment, StatefulSet, DaemonSet, Job, CronJob):

- **Polaris Audit** section automatically appears
- Shows compact score and failing checks
- Link to full report

### App Bar Badge

Cluster score badge in top navigation:

- Color-coded by score (green/yellow/red)
- Click to navigate to overview
- Always visible for quick reference

## Troubleshooting

### Plugin Not in Sidebar

```bash
# Verify plugin files exist
kubectl -n kube-system exec -it deployment/headlamp -c headlamp -- \
  ls /headlamp/plugins/headlamp-polaris-plugin/

# If missing, reinstall via Headlamp UI or sidecar method

# Hard refresh browser
# Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows/Linux)
```

### 403 Forbidden Error

```bash
# Verify RBAC exists
kubectl -n polaris get role polaris-proxy-reader
kubectl -n polaris get rolebinding headlamp-polaris-proxy

# If missing, apply RBAC from Step 2
```

### 404 Not Found Error

```bash
# Verify Polaris is running
kubectl -n polaris get pods
kubectl -n polaris get svc polaris-dashboard

# If missing, install Polaris:
helm install polaris fairwinds-stable/polaris \
  --namespace polaris \
  --create-namespace \
  --set dashboard.enabled=true
```

### Data Not Loading

```bash
# Check Polaris dashboard is responding
kubectl get --raw /api/v1/namespaces/polaris/services/polaris-dashboard:80/proxy/results.json

# If fails, check:
# 1. Polaris pods are running
# 2. NetworkPolicies allow API server → Polaris dashboard
# 3. Polaris service exists and is ClusterIP type
```

## Next Steps

- **[Configuration](../user-guide/configuration.md)** - Customize refresh intervals, dashboard URLs
- **[Features](../user-guide/features.md)** - Learn about all plugin features
- **[RBAC Permissions](../user-guide/rbac-permissions.md)** - Advanced RBAC configuration (token-auth, OIDC)
- **[Troubleshooting](../troubleshooting/README.md)** - Comprehensive troubleshooting guide

## Common Configuration Tasks

### Change Refresh Interval

1. Go to **Settings → Plugins → Polaris**
2. Select refresh interval (1 / 5 / 10 / 30 minutes)
3. Click **Save**

Default is 5 minutes.

### Use Custom Polaris URL

If Polaris is deployed externally or in a different namespace:

1. Go to **Settings → Plugins → Polaris**
2. Update **Dashboard URL**:
   - Service proxy: `/api/v1/namespaces/custom-ns/services/polaris-dashboard:80/proxy/`
   - Full URL: `https://polaris.example.com/`
3. Click **Test Connection** to verify
4. Click **Save**

### Test Polaris Connectivity

1. Go to **Settings → Plugins → Polaris**
2. Click **Test Connection**
3. Verify green success message with Polaris version

If test fails, see [Troubleshooting](../troubleshooting/README.md).

## Additional Resources

- **[Full Installation Guide](installation.md)** - All installation methods (sidecar, manual, source)
- **[Development Workflow](../development/workflow.md)** - Build from source, hot reload
- **[RBAC Issues](../troubleshooting/rbac-issues.md)** - Permission debugging
- **[Network Problems](../troubleshooting/network-problems.md)** - Connectivity troubleshooting

---

You're now running the Headlamp Polaris Plugin. Visit the **Polaris** section in Headlamp to explore your cluster's security, reliability, and efficiency audit results.
