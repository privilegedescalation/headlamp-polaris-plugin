# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Headlamp plugin that surfaces Fairwinds Polaris audit results inside the Headlamp UI. Queries the Polaris dashboard API via the Kubernetes service proxy (`/api/v1/namespaces/polaris/services/polaris-dashboard:80/proxy/results.json`). Target Headlamp ≥ v0.26.

## Build & Development Commands

```bash
# Install dependencies
npm install

# Build the plugin (standard Headlamp plugin build)
npx @kinvolk/headlamp-plugin build

# Start development mode with hot reload
npx @kinvolk/headlamp-plugin start

# Type-check without emitting
npx tsc --noEmit

# Lint
npx eslint src/
```

## Architecture

```
src/
├── index.tsx                    # Entry point: registerSidebarEntry + registerRoute for /polaris
├── api/
│   └── polaris.ts               # Types (AuditData schema), usePolarisData hook, countResults utility, refresh settings
└── components/
    └── PolarisView.tsx           # Main page: score badge, check summary, cluster info, error states, refresh interval selector
```

Single sidebar page at `/polaris`. Data is fetched via `ApiProxy.request` to the Polaris dashboard service proxy and refreshed on a user-configurable interval (stored in localStorage under `polaris-plugin-refresh-interval`, default 5 minutes). Score is computed from result counts (pass/total).

## Key Constraints

- **Data source**: Polaris dashboard API via K8s service proxy. Requires Polaris deployed in the `polaris` namespace with a `polaris-dashboard` service. No CRDs, no cluster write operations.
- **UI components**: Use only Headlamp-provided components (`@kinvolk/headlamp-plugin/lib/CommonComponents`). Do not import raw MUI packages. No custom theming.
- **Error handling**: Must handle 403 (RBAC denied), 404 (Polaris not installed), malformed JSON, and loading states with distinct visual states.
- **TypeScript strictness**: No `any`, no implicit `unknown` casting, no dead code, no unused imports.
- **Packaging**: `@kinvolk/headlamp-plugin` is a peer dependency. Do not bundle React or MUI.

## MCP Servers

The project has MCP server integrations configured in `.mcp.json`:
- **Gitea** (git.farh.net): Source control via `gitea-mcp-server`
- **Kubernetes** (local): Cluster access via `kubernetes-mcp-server`
- **Flux** (local): Flux Operator access via `flux-operator-mcp`
