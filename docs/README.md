# Documentation

Central hub for Headlamp Polaris Plugin documentation.

## Quick Links

- 🚀 [Quick Start](getting-started/quick-start.md)
- 📖 [Installation Guide](getting-started/installation.md)
- 🔧 [Troubleshooting](troubleshooting/README.md)
- 🏗️ [Architecture](architecture/overview.md)
- 💻 [Development](development/workflow.md)

## Getting Started

New to the Headlamp Polaris Plugin? Start here:

- **[Prerequisites](getting-started/prerequisites.md)** - System requirements, Headlamp version, Polaris installation
- **[Installation](getting-started/installation.md)** - Four installation methods: Plugin Manager, Sidecar, Manual, Source
- **[Quick Start](getting-started/quick-start.md)** - Get up and running in 5 minutes

## User Guide

Learn how to use the plugin:

- **[Features](user-guide/features.md)** - Overview dashboard, namespace views, inline audits, exemption management
- **[Configuration](user-guide/configuration.md)** - Refresh intervals, dashboard URLs, settings
- **[RBAC Permissions](user-guide/rbac-permissions.md)** - Required permissions, service proxy access, token-auth mode

## Troubleshooting

Having issues? Check here:

- **[Quick Diagnosis](troubleshooting/README.md)** - Quick reference table for common symptoms
- **[Common Issues](troubleshooting/common-issues.md)** - Detailed resolution steps for frequent problems
- **[RBAC Issues](troubleshooting/rbac-issues.md)** - Permission debugging, 403 errors, token-auth
- **[Network Problems](troubleshooting/network-problems.md)** - NetworkPolicies, connectivity, proxy issues

## Architecture

Understand how the plugin works:

- **[Overview](architecture/overview.md)** - High-level architecture, component hierarchy
- **[Data Flow](architecture/data-flow.md)** - How data moves from Polaris to the UI
- **[Design Decisions](architecture/design-decisions.md)** - Key architectural choices and rationale
- **[ADRs](architecture/adr/README.md)** - Architecture Decision Records

## Development

Contributing to the plugin:

- **[Development Workflow](development/workflow.md)** - Setup, building, hot reload
- **[Testing](development/testing.md)** - Unit tests, E2E tests, CI/CD
- **[Code Style](development/code-style.md)** - TypeScript, React, linting, formatting
- **[Release Process](development/release-process.md)** - Versioning, changelog, GitHub Actions

## Deployment

Production deployment guides:

- **[Kubernetes](deployment/kubernetes.md)** - Direct Kubernetes manifest deployment
- **[Helm](deployment/helm.md)** - Helm chart configuration, values
- **[Production Checklist](deployment/production.md)** - RBAC, NetworkPolicies, security, monitoring

## API Reference

- **[polaris.ts](../src/api/polaris.ts)** - JSDoc-annotated TypeScript API (data fetching, types, utilities)
- **[PolarisDataContext.tsx](../src/api/PolarisDataContext.tsx)** - React Context provider for shared data

---

**Need help?** Open an issue on [GitHub](https://github.com/cpfarhood/headlamp-polaris-plugin/issues) or check [CONTRIBUTING.md](../CONTRIBUTING.md) for development guidelines.
