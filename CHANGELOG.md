# Changelog

All notable changes to the Headlamp Polaris Plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-03-22

First stable release. The plugin API (routes, sidebar entries, settings schema, and app bar action) is
now frozen — no breaking changes without a new major version.

### Security
- Patched 8 of 9 npm audit vulnerabilities via `pnpm.overrides` (#92)

### Added
- **Dual-approval CI check**: PRs now require approval from both CTO and QA before merging (#98, #76)
- **ExemptionManager test suite**: Full coverage of annotation-based exemption flows, exemption creation, and inline feedback (#82)
- **RBAC preflight check**: `deploy-e2e-headlamp.sh` now verifies runner RBAC before attempting E2E deploy (#80)

### Fixed
- **E2E infrastructure overhaul**: Replaced Dockerfile.e2e with ConfigMap volume mount for plugin loading; tests now run in the `privilegedescalation-dev` namespace (#73, #89, #94)
- **E2E token auth**: Workflow uses GitHub App token auth and handles the `/token` redirect correctly (#97)
- **E2E HTTP readiness**: `deploy-e2e-headlamp.sh` waits for HTTP reachability after rollout before running tests (#104)
- **E2E runner label**: Updated to `runners-privilegedescalation` for self-hosted ARC runners (#71)
- **Direct devDependencies**: Added `typescript`, `eslint`, `prettier`, and `@headlamp-k8s/eslint-config` as explicit direct devDependencies to prevent phantom-dep failures in clean installs (#95, #102)

### Changed
- **pnpm version pinned**: `packageManager` field in `package.json` pins the pnpm version used in CI (#103)
- **GitHub Actions SHA pinning**: Renovate `pinDigests` enabled to SHA-pin all GitHub Actions (#105)
- **ArtifactHub metadata polish**: Improved `install` instructions and `changes` section formatting (#82)

## [0.6.0] - 2026-03-04

### Fixed
- **ExemptionManager apiVersion bug**: `apps` and `batch` resources now correctly use `/apis/{group}/v1/` instead of the broken `/api/v1/` path
- **Strict TypeScript**: Replaced `resource: any` in InlineAuditSection with proper `KubeResource` interface
- **PolarisDataContext test mock**: Added missing `triggerRefresh` to mock, preventing silent `undefined` for `refresh` in context
- **DashboardView test**: Fixed `SimpleTable` mock that used `Array<any>` and didn't exercise column getters

### Changed
- **Dark mode / theming**: Replaced all `var(--mui-palette-*)` CSS variables with `useTheme()` + `theme.palette.*` across all components (DashboardView, NamespacesListView, InlineAuditSection, ExemptionManager, PolarisSettings, AppBarScoreBadge)
- **Namespace drawer**: Replaced custom `<style>` block + positioned `<div>` with MUI `Drawer` component for proper accessibility (`role="dialog"`, `aria-modal`, Escape key handling via MUI)
- **AppBarScoreBadge**: Uses `theme.palette.success/warning/error` with proper `contrastText` instead of hardcoded hex colors
- **ExemptionManager feedback**: Replaced `alert()` calls with `StatusLabel`-based inline feedback; removed dead `getExemptions()` stub and unreachable remove-exemption UI
- **URL construction**: Exported `getPolarisApiPath` and `isFullUrl` from `polaris.ts`; PolarisSettings now reuses them instead of duplicating logic

### Added
- **Error boundaries**: All registered components (routes, detail sections, app bar action) wrapped in `PolarisErrorBoundary` for graceful error rendering
- **Tests for InlineAuditSection** (7 tests): loading, unsupported kind, not found, score/summary, failing checks, link, exemption manager
- **Tests for AppBarScoreBadge** (6 tests): loading, no data, score colors, navigation, aria-label
- **Tests for topIssues.ts** (8 tests): empty, all pass, controller/pod/container results, counting, ignore filter, sorting, max 10
- **Tests for checkMapping.ts** (11 tests): name/description/category/severity lookups, unknown checks, CHECK_MAPPING structure validation

### Removed
- **NamespaceDetailView.tsx**: Dead code with no registered route (replaced by drawer in NamespacesListView)
- **NamespaceDetailView.test.tsx**: Tests for removed component
- **MockPolarisProvider in test-utils.tsx**: Unused mock provider (tests use `vi.mock` instead)
- **`getSeverityColor` export in checkMapping.ts**: Dead export not imported anywhere

## [0.3.5] - 2026-02-12

### Fixed
- Fixed drawer background remaining white in dark mode by using correct CSS variable (`--mui-palette-background-default`)

### Documentation
- Added comprehensive Priority 2 documentation (ARCHITECTURE.md, DEPLOYMENT.md, SECURITY.md)
- Added CONTRIBUTING.md with development workflow, branching strategy, and code style guidelines
- Added complete CHANGELOG.md documenting all releases from v0.0.1 to current

## [0.3.4] - 2026-02-12

### Fixed
- Removed all `@mui/material` and `@mui/icons-material` imports causing plugin load failure
- Fixed plugin settings page registration (changed name from 'polaris' to 'headlamp-polaris-plugin')
- Added dark mode support using MUI CSS variables for proper theme adaptation
- Resolved TypeScript compilation errors in plugin registration calls

### Changed
- Replaced all MUI components with standard HTML elements and inline styles
- Updated `registerDetailsViewSection` and `registerAppBarAction` to match Headlamp plugin API v0.13.0
- App bar badge, settings buttons, and UI elements now use theme-aware CSS variables

### Infrastructure
- Added CI workflow for lint, type-check, build, and test
- Enhanced E2E testing documentation with comprehensive guides
- Added documentation-engineer subagent

## [0.3.3] - 2026-02-12

### Fixed
- Corrected plugin settings registration name to match package.json
- Added displaySaveButton parameter to settings registration

## [0.3.2] - 2026-02-12

### Fixed
- Removed all MUI dependencies to fix plugin loading in Headlamp v0.39.0+
- Plugin now loads correctly in sidebar and routes

## [0.3.1] - 2026-02-12

### Fixed
- TypeScript compilation errors in `registerDetailsViewSection` and `registerAppBarAction` calls
- Test failures in DashboardView (added missing SimpleTable mock)

## [0.3.0] - 2026-02-11

### Added
- App bar badge displaying cluster Polaris score
- Inline audit sections in resource detail views (Deployment, StatefulSet, DaemonSet, Job, CronJob)
- Exemption management UI (view/add exemptions via annotations)
- Connection testing button in plugin settings
- Top issues dashboard with severity-based filtering
- Namespace drawer navigation with URL hash support

### Changed
- Migrated namespace detail to right-side drawer panel
- Improved drawer keyboard navigation (Escape to close)
- Enhanced settings page with connection testing

### Fixed
- Empty namespace crash handling
- Drawer navigation pattern for better UX

## [0.2.5] - 2025-12-XX

### Fixed
- Improved theming and settings visibility

## [0.2.4] - 2025-12-XX

### Changed
- Increased namespace detail panel width to 1000px for better readability

## [0.2.3] - 2025-12-XX

### Added
- Full URL support for custom Polaris dashboards
- Support for external Polaris instances (not just service proxy)

## [0.2.2] - 2025-12-XX

### Added
- Configurable Polaris dashboard URL setting
- Settings page for plugin configuration
- Refresh interval configuration

## [0.2.1] - 2025-12-XX

### Infrastructure
- Migrated to GitHub as primary repository
- Fixed v0.2.0 checksum in ArtifactHub metadata

## [0.2.0] - 2025-12-XX

### Added
- Namespace drawer navigation
- URL hash-based routing for namespaces
- Keyboard shortcuts (Escape to close drawer)

### Infrastructure
- GitHub release automation
- Improved CI/CD workflow

## [0.1.7] - 2025-11-XX

### Documentation
- Removed incorrect development installation instructions

## [0.1.6] - 2025-11-XX

### Fixed
- Plugin settings display name changed to "Polaris"

### Documentation
- Added tooltip to skipped count explaining limitation
- Documented skipped count limitation in README

## [0.1.5] - 2025-11-XX

### Fixed
- Restored `:80` port in service proxy URL for correct dashboard access

## [0.1.4] - 2025-11-XX

### Added
- Playwright E2E smoke tests
- Test coverage for sidebar, overview, namespaces, and detail views

### Fixed
- Empty namespace crash (graceful handling)
- Removed `:80` port suffix from service proxy URL for RBAC compatibility

## [0.1.3] - 2025-11-XX

### Fixed
- Service proxy URL format for consistent RBAC requirements

## [0.1.2] - 2025-11-XX

### Added
- Namespace filtering and sorting
- Enhanced resource table in namespace detail view

## [0.1.1] - 2025-11-XX

### Fixed
- Score calculation for resources with mixed results
- Percentage display formatting

## [0.1.0] - 2025-11-XX

### Added
- Namespace detail view with resource-level audit results
- Drill-down navigation from namespace list

### Changed
- Improved data fetching with error handling
- Better loading states

## [0.0.10] - 2025-11-XX

### Fixed
- **RBAC Documentation:** Corrected to use `services/proxy` permission instead of ConfigMap access

### Documentation
- Updated README with accurate RBAC requirements
- Added minimal Role example

## [0.0.9] - 2025-11-XX

### Added
- Refresh button for manual data reload
- Last updated timestamp display

## [0.0.8] - 2025-11-XX

### Added
- Skipped checks display in check summary
- Improved check categorization (pass/warning/danger/skipped)

## [0.0.7] - 2025-11-XX

### Changed
- Enhanced overview dashboard layout
- Better visual hierarchy for cluster score

## [0.0.6] - 2025-11-XX

### Added
- Namespace list view with per-namespace scores
- Navigation between overview and namespace views

## [0.0.5] - 2025-11-XX

### Fixed
- Data fetching error handling
- API proxy path configuration

## [0.0.4] - 2025-11-XX

### Added
- Check distribution visualization
- Pass/Warning/Danger count display

## [0.0.3] - 2025-11-XX

### Changed
- Improved cluster score calculation
- Better result aggregation logic

## [0.0.2] - 2025-11-XX

### Added
- Cluster score display
- Basic check summary table

## [0.0.1] - 2025-10-XX

### Added
- Initial release
- Basic Polaris plugin structure
- Sidebar entry "Polaris"
- Overview page with cluster info
- Data fetching from Polaris dashboard via Kubernetes service proxy
- TypeScript support with strict mode
- React components using Headlamp CommonComponents

### Infrastructure
- GitHub repository setup
- ArtifactHub package registration
- Automated release workflow
- Basic CI/CD pipeline

[Unreleased]: https://github.com/privilegedescalation/headlamp-polaris-plugin/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/privilegedescalation/headlamp-polaris-plugin/compare/v0.7.2...v1.0.0
[0.6.0]: https://github.com/privilegedescalation/headlamp-polaris-plugin/releases/tag/v0.6.0
[0.3.5]: https://github.com/privilegedescalation/headlamp-polaris-plugin/releases/tag/v0.3.5
[0.3.4]: https://github.com/privilegedescalation/headlamp-polaris-plugin/releases/tag/v0.3.4
[0.3.3]: https://github.com/privilegedescalation/headlamp-polaris-plugin/releases/tag/v0.3.3
[0.3.2]: https://github.com/privilegedescalation/headlamp-polaris-plugin/releases/tag/v0.3.2
[0.3.1]: https://github.com/privilegedescalation/headlamp-polaris-plugin/releases/tag/v0.3.1
[0.3.0]: https://github.com/privilegedescalation/headlamp-polaris-plugin/releases/tag/v0.3.0
[0.2.5]: https://github.com/privilegedescalation/headlamp-polaris-plugin/releases/tag/v0.2.5
[0.2.4]: https://github.com/privilegedescalation/headlamp-polaris-plugin/releases/tag/v0.2.4
[0.2.3]: https://github.com/privilegedescalation/headlamp-polaris-plugin/releases/tag/v0.2.3
[0.2.2]: https://github.com/privilegedescalation/headlamp-polaris-plugin/releases/tag/v0.2.2
[0.2.1]: https://github.com/privilegedescalation/headlamp-polaris-plugin/releases/tag/v0.2.1
[0.2.0]: https://github.com/privilegedescalation/headlamp-polaris-plugin/releases/tag/v0.2.0
[0.1.7]: https://github.com/privilegedescalation/headlamp-polaris-plugin/releases/tag/v0.1.7
[0.1.6]: https://github.com/privilegedescalation/headlamp-polaris-plugin/releases/tag/v0.1.6
[0.1.5]: https://github.com/privilegedescalation/headlamp-polaris-plugin/releases/tag/v0.1.5
[0.1.4]: https://github.com/privilegedescalation/headlamp-polaris-plugin/releases/tag/v0.1.4
[0.1.3]: https://github.com/privilegedescalation/headlamp-polaris-plugin/releases/tag/v0.1.3
[0.1.2]: https://github.com/privilegedescalation/headlamp-polaris-plugin/releases/tag/v0.1.2
[0.1.1]: https://github.com/privilegedescalation/headlamp-polaris-plugin/releases/tag/v0.1.1
[0.1.0]: https://github.com/privilegedescalation/headlamp-polaris-plugin/releases/tag/v0.1.0
[0.0.10]: https://github.com/privilegedescalation/headlamp-polaris-plugin/releases/tag/v0.0.10
[0.0.9]: https://github.com/privilegedescalation/headlamp-polaris-plugin/releases/tag/v0.0.9
[0.0.8]: https://github.com/privilegedescalation/headlamp-polaris-plugin/releases/tag/v0.0.8
[0.0.7]: https://github.com/privilegedescalation/headlamp-polaris-plugin/releases/tag/v0.0.7
[0.0.6]: https://github.com/privilegedescalation/headlamp-polaris-plugin/releases/tag/v0.0.6
[0.0.5]: https://github.com/privilegedescalation/headlamp-polaris-plugin/releases/tag/v0.0.5
[0.0.4]: https://github.com/privilegedescalation/headlamp-polaris-plugin/releases/tag/v0.0.4
[0.0.3]: https://github.com/privilegedescalation/headlamp-polaris-plugin/releases/tag/v0.0.3
[0.0.2]: https://github.com/privilegedescalation/headlamp-polaris-plugin/releases/tag/v0.0.2
[0.0.1]: https://github.com/privilegedescalation/headlamp-polaris-plugin/releases/tag/v0.0.1
