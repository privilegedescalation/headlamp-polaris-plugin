# Security Policy

## Overview

The Headlamp Polaris Plugin is a read-only visualization tool that displays Fairwinds Polaris audit results within the Headlamp UI. Security considerations primarily revolve around Kubernetes RBAC, network policies, and data access controls.

## Security Model

### Read-Only Operation

The plugin performs **only read operations** via the Kubernetes API server's service proxy mechanism:

- **No write operations**: The plugin never creates, updates, or deletes Kubernetes resources
- **No CRD installation**: No custom resource definitions or cluster-level modifications
- **No secrets**: The plugin does not read or store Kubernetes secrets
- **No PII**: Polaris audit data contains resource metadata but no personally identifiable information

### Data Flow

```
User Browser
    ↓ (HTTPS)
Headlamp Pod
    ↓ (in-cluster service account or user token)
Kubernetes API Server
    ↓ (service proxy: /api/v1/namespaces/polaris/services/polaris-dashboard:80/proxy/)
Polaris Dashboard Service
    ↓ (returns audit JSON)
Plugin Frontend (React)
```

All communication uses Kubernetes authentication and authorization mechanisms. The plugin never stores credentials or bypasses RBAC.

## RBAC Requirements

### Minimal Permissions

The plugin requires only one permission:

| Verb | API Group | Resource | Resource Name | Namespace |
|------|-----------|----------|---------------|-----------|
| `get` | `""` (core) | `services/proxy` | `polaris-dashboard` | `polaris` |

**Example minimal Role:**

```yaml
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
```

### RoleBinding Options

**Option 1: Service Account (Recommended)**

Bind to the Headlamp service account for all users:

```yaml
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
```

**Option 2: OIDC Groups**

Bind to user groups for OIDC authentication:

```yaml
subjects:
  - kind: Group
    name: "developers"
    apiGroup: rbac.authorization.k8s.io
```

**Option 3: Specific Users**

Bind to individual users:

```yaml
subjects:
  - kind: User
    name: "jane@example.com"
    apiGroup: rbac.authorization.k8s.io
```

### ⚠️ Security Best Practices

1. **Principle of Least Privilege**: Grant only `services/proxy` access, not broader `services` permissions
2. **Namespace Scoping**: Use a namespaced `Role`, not a `ClusterRole`, to limit access to the `polaris` namespace only
3. **Resource Name Restriction**: Always specify `resourceNames: ["polaris-dashboard"]` to prevent proxy access to other services
4. **Audit Logging**: Enable Kubernetes audit logging to track all service proxy requests
5. **Network Policies**: Restrict network access to the Polaris dashboard service (see Network Security below)

## Network Security

### Network Policies

If your cluster uses NetworkPolicies, ensure the Headlamp pod (or more specifically, the Kubernetes API server performing the proxy hop) can reach the Polaris dashboard service.

**Example NetworkPolicy for Polaris namespace:**

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-api-server-to-polaris
  namespace: polaris
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/name: polaris
  policyTypes:
    - Ingress
  ingress:
    # Allow from API server (adjust based on your cluster setup)
    - from:
        - namespaceSelector: {}  # API server typically runs in kube-system or no namespace label
      ports:
        - protocol: TCP
          port: 8080  # Polaris dashboard default port
```

**Note**: The Kubernetes API server performs the service proxy hop, so network policies should allow traffic from the API server to Polaris, not directly from Headlamp to Polaris.

### TLS/HTTPS

- **External Access**: Always access Headlamp over HTTPS, especially when using OIDC authentication
- **Internal Communication**: Communication between Headlamp and the Kubernetes API server uses the service account token over the cluster's internal network
- **Service Proxy**: The API server → Polaris dashboard communication happens over HTTP within the cluster (ClusterIP service)

## Authentication Methods

### Service Account (Default)

Headlamp runs with a dedicated service account (`headlamp` in `kube-system`). All users share the same permissions defined by this service account's RBAC bindings.

**Security Considerations:**
- All users have identical access to the plugin
- Suitable for trusted internal environments
- Simpler RBAC management

### OIDC Token Authentication

Headlamp can be configured for OIDC authentication, where each user provides their own bearer token. RBAC is enforced per-user.

**Security Considerations:**
- Fine-grained access control per user
- Users without the `polaris-proxy-reader` role will see 403 errors
- Requires OIDC provider integration
- Suitable for multi-tenant or compliance-focused environments

**Configuration Example:**

```yaml
config:
  oidc:
    clientID: "headlamp"
    clientSecret: "secret"
    issuerURL: "https://authentik.example.com/application/o/headlamp/"
    scopes: "openid profile email groups"
```

When OIDC is enabled, each user's token is used for API requests, including service proxy calls.

## Vulnerability Reporting

### Supported Versions

We apply security updates to the latest release only. Please ensure you are running the most recent version.

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |
| < latest| :x:                |

### Reporting a Vulnerability

If you discover a security vulnerability in this plugin, please report it via:

1. **GitHub Security Advisories**: [Report a vulnerability](https://github.com/privilegedescalation/headlamp-polaris-plugin/security/advisories/new)
2. **Email**: Create a GitHub issue and mark it as "security" if advisories are not available

**Please do not:**
- Open public GitHub issues for security vulnerabilities
- Disclose vulnerabilities publicly before a fix is available

**Response Timeline:**
- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 1 week
- **Fix Timeline**: Depends on severity (critical: 1-2 weeks, high: 2-4 weeks, medium/low: next release cycle)

## Dependency Security

### Dependency Scanning

The project uses:
- **npm audit**: Runs automatically during `npm install`
- **Dependabot**: GitHub Dependabot monitors dependencies and creates PRs for updates
- **GitHub Actions**: CI workflow runs `npm audit` on every commit

### Updating Dependencies

Security patches are applied as follows:

1. **Critical vulnerabilities**: Emergency patch release within 48 hours
2. **High severity**: Patched in next minor release (typically within 1-2 weeks)
3. **Medium/Low severity**: Included in regular release cycle

### Headlamp Plugin API

This plugin depends on `@kinvolk/headlamp-plugin` as a peer dependency. Security updates to Headlamp itself should be applied by upgrading your Headlamp installation.

**Minimum supported Headlamp version**: v0.26.0

## Deployment Security

### Production Checklist

Before deploying to production, verify:

- [ ] **RBAC configured**: `polaris-proxy-reader` Role and RoleBinding exist
- [ ] **Network policies**: Allow API server → Polaris dashboard traffic
- [ ] **TLS enabled**: Headlamp accessible only via HTTPS
- [ ] **OIDC configured** (if using per-user auth): Token-based authentication working
- [ ] **Audit logging enabled**: Kubernetes API audit logs capture service proxy requests
- [ ] **Plugin version**: Running latest release
- [ ] **Dependencies audited**: No critical vulnerabilities in npm dependencies
- [ ] **Polaris version**: Polaris dashboard is up-to-date

### Kubernetes Cluster Security

The plugin's security posture depends on your cluster's security:

- **API Server Access**: Ensure API server is not publicly accessible without authentication
- **Service Account Tokens**: Use projected volume tokens with short expiration (Kubernetes 1.21+)
- **Pod Security Standards**: Apply appropriate pod security policies/standards to the Headlamp namespace
- **RBAC Auditing**: Regularly review RoleBindings to ensure least privilege

## Common Security Scenarios

### Scenario 1: 403 Forbidden Error

**Symptom**: Plugin shows "403 Forbidden" when loading data

**Cause**: User or service account lacks `services/proxy` permission on `polaris-dashboard`

**Resolution**:
1. Verify RoleBinding exists in `polaris` namespace
2. Check RoleBinding references correct subject (service account, group, or user)
3. Confirm Role includes `resourceNames: ["polaris-dashboard"]`

**Security Note**: This is expected behavior when RBAC is correctly enforced. Do not grant broader permissions to "fix" 403 errors.

### Scenario 2: Exposing Polaris Dashboard Externally

**Question**: Can I expose Polaris dashboard via Ingress instead of using service proxy?

**Recommendation**: **Avoid exposing Polaris dashboard externally**. The service proxy approach:
- Enforces Kubernetes RBAC on every request
- Avoids exposing internal services to the internet
- Prevents authentication bypass attacks

If you must expose Polaris externally:
- Use OAuth2 proxy or similar authentication layer
- Configure NetworkPolicies to restrict access
- Enable TLS with valid certificates
- Consider IP allowlisting

### Scenario 3: Multi-Tenant Clusters

**Question**: How do I restrict plugin access in a multi-tenant cluster?

**Solution**: Use OIDC authentication with per-user RoleBindings:

```yaml
# Bind only to specific groups or users
subjects:
  - kind: Group
    name: "team-a"
    apiGroup: rbac.authorization.k8s.io
```

Users not in `team-a` will receive 403 errors when accessing the plugin, preventing unauthorized access to Polaris audit data.

## Compliance Considerations

### Data Residency

All data remains within your Kubernetes cluster. The plugin does not:
- Send data to external services
- Store data in browser localStorage (except refresh interval preference)
- Use third-party analytics or tracking

### Audit Trail

All service proxy requests are logged in Kubernetes API audit logs (if enabled):

```json
{
  "verb": "get",
  "requestURI": "/api/v1/namespaces/polaris/services/polaris-dashboard:80/proxy/results.json",
  "user": {
    "username": "system:serviceaccount:kube-system:headlamp",
    "groups": ["system:serviceaccounts", "system:authenticated"]
  }
}
```

### GDPR/Privacy

The plugin processes only technical metadata (resource names, namespaces, check results). No personal data is collected, stored, or transmitted.

## Security Updates and Notifications

### Notification Channels

Subscribe to security updates via:

1. **GitHub Watch**: Click "Watch" → "Custom" → "Security alerts"
2. **GitHub Releases**: Monitor [releases page](https://github.com/privilegedescalation/headlamp-polaris-plugin/releases)
3. **ArtifactHub**: Follow package at [ArtifactHub](https://artifacthub.io/packages/headlamp/headlamp-polaris-plugin/headlamp-polaris-plugin)

### Security Patch Process

When a security vulnerability is identified:

1. **Private Fix**: Develop fix in private fork
2. **Security Advisory**: Publish GitHub Security Advisory
3. **Release**: Create new version with fix
4. **Notification**: Update advisory with fix version
5. **Disclosure**: Public disclosure after fix is available

## Contact

- **Security Issues**: [GitHub Security Advisories](https://github.com/privilegedescalation/headlamp-polaris-plugin/security/advisories)
- **General Questions**: [GitHub Discussions](https://github.com/privilegedescalation/headlamp-polaris-plugin/discussions)
- **Bug Reports**: [GitHub Issues](https://github.com/privilegedescalation/headlamp-polaris-plugin/issues)

## License

This plugin is provided under the Apache-2.0 License. See [LICENSE](LICENSE) for details.
