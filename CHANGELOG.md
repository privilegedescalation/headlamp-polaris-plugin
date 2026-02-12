# Changelog

All notable changes to the Headlamp Polaris Plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
- Migrated from Gitea to GitHub Actions exclusively
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

[Unreleased]: https://github.com/cpfarhood/headlamp-polaris-plugin/compare/v0.3.5...HEAD
[0.3.5]: https://github.com/cpfarhood/headlamp-polaris-plugin/releases/tag/v0.3.5
[0.3.4]: https://github.com/cpfarhood/headlamp-polaris-plugin/releases/tag/v0.3.4
[0.3.3]: https://github.com/cpfarhood/headlamp-polaris-plugin/releases/tag/v0.3.3
[0.3.2]: https://github.com/cpfarhood/headlamp-polaris-plugin/releases/tag/v0.3.2
[0.3.1]: https://github.com/cpfarhood/headlamp-polaris-plugin/releases/tag/v0.3.1
[0.3.0]: https://github.com/cpfarhood/headlamp-polaris-plugin/releases/tag/v0.3.0
[0.2.5]: https://github.com/cpfarhood/headlamp-polaris-plugin/releases/tag/v0.2.5
[0.2.4]: https://github.com/cpfarhood/headlamp-polaris-plugin/releases/tag/v0.2.4
[0.2.3]: https://github.com/cpfarhood/headlamp-polaris-plugin/releases/tag/v0.2.3
[0.2.2]: https://github.com/cpfarhood/headlamp-polaris-plugin/releases/tag/v0.2.2
[0.2.1]: https://github.com/cpfarhood/headlamp-polaris-plugin/releases/tag/v0.2.1
[0.2.0]: https://github.com/cpfarhood/headlamp-polaris-plugin/releases/tag/v0.2.0
[0.1.7]: https://github.com/cpfarhood/headlamp-polaris-plugin/releases/tag/v0.1.7
[0.1.6]: https://github.com/cpfarhood/headlamp-polaris-plugin/releases/tag/v0.1.6
[0.1.5]: https://github.com/cpfarhood/headlamp-polaris-plugin/releases/tag/v0.1.5
[0.1.4]: https://github.com/cpfarhood/headlamp-polaris-plugin/releases/tag/v0.1.4
[0.1.3]: https://github.com/cpfarhood/headlamp-polaris-plugin/releases/tag/v0.1.3
[0.1.2]: https://github.com/cpfarhood/headlamp-polaris-plugin/releases/tag/v0.1.2
[0.1.1]: https://github.com/cpfarhood/headlamp-polaris-plugin/releases/tag/v0.1.1
[0.1.0]: https://github.com/cpfarhood/headlamp-polaris-plugin/releases/tag/v0.1.0
[0.0.10]: https://github.com/cpfarhood/headlamp-polaris-plugin/releases/tag/v0.0.10
[0.0.9]: https://github.com/cpfarhood/headlamp-polaris-plugin/releases/tag/v0.0.9
[0.0.8]: https://github.com/cpfarhood/headlamp-polaris-plugin/releases/tag/v0.0.8
[0.0.7]: https://github.com/cpfarhood/headlamp-polaris-plugin/releases/tag/v0.0.7
[0.0.6]: https://github.com/cpfarhood/headlamp-polaris-plugin/releases/tag/v0.0.6
[0.0.5]: https://github.com/cpfarhood/headlamp-polaris-plugin/releases/tag/v0.0.5
[0.0.4]: https://github.com/cpfarhood/headlamp-polaris-plugin/releases/tag/v0.0.4
[0.0.3]: https://github.com/cpfarhood/headlamp-polaris-plugin/releases/tag/v0.0.3
[0.0.2]: https://github.com/cpfarhood/headlamp-polaris-plugin/releases/tag/v0.0.2
[0.0.1]: https://github.com/cpfarhood/headlamp-polaris-plugin/releases/tag/v0.0.1
