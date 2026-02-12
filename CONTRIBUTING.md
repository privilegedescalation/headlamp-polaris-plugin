# Contributing to Headlamp Polaris Plugin

Thank you for your interest in contributing to the Headlamp Polaris Plugin! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Branching Strategy](#branching-strategy)
- [Commit Message Guidelines](#commit-message-guidelines)
- [Pull Request Process](#pull-request-process)
- [Code Style](#code-style)
- [Testing Requirements](#testing-requirements)
- [Documentation](#documentation)
- [Release Process](#release-process)

## Code of Conduct

This project follows a standard code of conduct:
- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on constructive feedback
- Assume good intentions

## Getting Started

### Prerequisites

- Node.js 20 or later
- npm or yarn
- Access to a Kubernetes cluster with Headlamp installed (for testing)
- Git

### Development Setup

1. **Fork and clone the repository:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/headlamp-polaris-plugin.git
   cd headlamp-polaris-plugin
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start development mode:**
   ```bash
   npm start
   # Plugin will be available at http://localhost:4466
   ```

4. **Run tests:**
   ```bash
   # Unit tests
   npm test

   # E2E tests (requires Headlamp instance)
   npm run e2e
   ```

5. **Build the plugin:**
   ```bash
   npm run build
   ```

## Development Workflow

### Feature Development

1. Create a feature branch from `main`
2. Make your changes
3. Write/update tests
4. Update documentation
5. Run lint and tests locally
6. Submit a pull request

### Local Testing

**Option 1: Development Mode**
```bash
npm start
# Opens Headlamp at http://localhost:4466 with hot reload
```

**Option 2: Production Build**
```bash
npm run build
# Plugin bundle created in dist/
```

**Option 3: E2E Testing**
```bash
# Set up environment (see e2e/README.md)
export HEADLAMP_TOKEN=$(kubectl create token headlamp -n kube-system --duration=24h)
npm run e2e
```

## Branching Strategy

### Main Branch

- **Purpose:** Stable, production-ready code
- **Protection:** Only merge via pull requests
- **Naming:** `main`

### Feature Branches

- **Purpose:** Development of new features or fixes
- **Naming Convention:**
  - Features: `feat/description` or `feature/description`
  - Bug fixes: `fix/description`
  - Documentation: `docs/description`
  - Refactoring: `refactor/description`
  - Chores: `chore/description`

**Examples:**
```bash
feat/add-exemption-support
fix/dark-mode-theme-colors
docs/update-rbac-guide
refactor/polaris-api-client
chore/upgrade-dependencies
```

### Branching Rules

**✅ ALWAYS use feature branches for:**
- Code changes (new features, bug fixes, refactors)
- Test updates
- CI/CD workflow changes
- Package updates

**✅ MAY push directly to main for:**
- Documentation-only changes (README.md, CLAUDE.md, comments)
- Version bump commits (`package.json` + `artifacthub-pkg.yml`)

**❌ NEVER push directly to main for:**
- Any code changes to `src/`
- Test file changes
- Workflow changes
- Dependency updates

## Commit Message Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/) format:

### Format

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

- **feat:** New feature
- **fix:** Bug fix
- **docs:** Documentation only
- **style:** Code style (formatting, no logic change)
- **refactor:** Code change that neither fixes a bug nor adds a feature
- **perf:** Performance improvement
- **test:** Adding or updating tests
- **chore:** Maintenance tasks (deps, build, CI)
- **ci:** CI/CD changes

### Scope (Optional)

- `api` - API-related changes
- `ui` - UI component changes
- `settings` - Plugin settings
- `tests` - Test-related changes
- `docs` - Documentation changes

### Examples

```bash
feat(api): add support for custom Polaris dashboard URLs

fix(ui): resolve dark mode theme color inconsistencies

docs: update RBAC examples with NetworkPolicy

chore: bump version to 0.3.5

test(e2e): add tests for plugin settings page
```

### Footer

Add `Co-Authored-By` for pair programming or AI assistance:

```
feat: add namespace filtering to overview

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
```

## Pull Request Process

### Before Creating a PR

1. **Run all checks locally:**
   ```bash
   npm run build      # Verify build succeeds
   npm run lint       # Check for linting errors
   npm run tsc        # Type-check TypeScript
   npm test           # Run unit tests
   npm run format     # Format code with Prettier
   ```

2. **Update documentation:**
   - Update README.md if you added features or changed behavior
   - Update CLAUDE.md if you changed architecture or constraints
   - Add/update JSDoc comments for new APIs

3. **Write/update tests:**
   - Add unit tests for new functions/components
   - Update E2E tests if UI behavior changed
   - Ensure all tests pass

### Creating a PR

1. **Push your branch:**
   ```bash
   git push origin feat/your-feature
   ```

2. **Create PR on GitHub:**
   - Use a descriptive title following commit conventions
   - Fill out the PR template (if available)
   - Link related issues with `Fixes #123` or `Closes #456`

3. **PR Title Format:**
   ```
   feat: add exemption management UI
   fix: correct score calculation for skipped checks
   docs: improve deployment guide with Helm examples
   ```

4. **PR Description Should Include:**
   - Summary of changes
   - Motivation and context
   - Testing performed
   - Screenshots (for UI changes)
   - Breaking changes (if any)

### PR Review Process

1. **Automated Checks:**
   - ✅ CI workflow (lint, type-check, build, test)
   - ✅ E2E tests (may fail if plugin not deployed)

2. **Maintainer Review:**
   - Code quality and style
   - Test coverage
   - Documentation completeness
   - Breaking changes assessment

3. **Merging:**
   - Use **merge commits** (not squash, not rebase)
   - Delete feature branch after merge
   - Maintainers will handle version bumps and releases

## Code Style

### TypeScript

- **Strictness:** Full TypeScript strict mode enabled
- **No `any`:** Use specific types or `unknown`
- **Interfaces over types:** Prefer `interface` for object shapes
- **Named exports:** Use named exports, not default exports

### React

- **Functional components:** Use function components with hooks
- **Props interfaces:** Always define props as interfaces
- **Headlamp components:** Use CommonComponents from Headlamp, never raw MUI
- **No inline styles:** Use theme-aware CSS variables

### Linting and Formatting

```bash
# Auto-fix linting issues
npm run lint:fix

# Format code
npm run format

# Check formatting
npm run format:check
```

### Import Organization

Imports are automatically sorted by eslint. Order:
1. React imports
2. Third-party libraries
3. Headlamp plugin imports
4. Local imports (components, API, types)

Example:
```typescript
import React from 'react';
import { SectionBox, StatusLabel } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { usePolarisDataContext } from '../api/PolarisDataContext';
import { computeScore } from '../api/polaris';
```

### Naming Conventions

- **Components:** PascalCase (`DashboardView`, `PolarisSettings`)
- **Files:** Match component name (`DashboardView.tsx`)
- **Hooks:** Prefix with `use` (`usePolarisData`)
- **Utilities:** camelCase (`countResults`, `computeScore`)
- **Constants:** UPPER_SNAKE_CASE (`DASHBOARD_URL_DEFAULT`)

## Testing Requirements

### Unit Tests (Required)

- All new functions must have unit tests
- All bug fixes should include regression tests
- Aim for meaningful coverage, not just numbers
- Use descriptive test names

Example:
```typescript
describe('countResults', () => {
  it('counts passing, warning, and danger results correctly', () => {
    // Test implementation
  });

  it('includes skipped checks in total count', () => {
    // Test implementation
  });
});
```

### E2E Tests (Recommended)

- Add E2E tests for new UI features
- Update existing tests if behavior changes
- See `e2e/README.md` for detailed instructions

### Running Tests

```bash
# Run all unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Run E2E tests
npm run e2e

# Run E2E tests in headed mode (see browser)
npm run e2e:headed
```

## Documentation

### Documentation Updates Required

When making changes, update relevant documentation:

#### Code Changes
- **README.md:** User-facing features, installation, configuration
- **CLAUDE.md:** Architecture, constraints, MCP integrations
- **JSDoc:** All public APIs, components, hooks

#### Test Changes
- **e2e/README.md:** New test scenarios or setup changes

#### Build/CI Changes
- **README.md:** Build commands, release process
- **.github/workflows/*.yaml:** Workflow comments

### JSDoc Style

Use JSDoc for all exported functions, components, and types:

```typescript
/**
 * Counts passing, warning, danger, and skipped Polaris check results.
 *
 * Skipped checks are identified by severity "ignore" with success false.
 *
 * @param data - AuditData from Polaris dashboard API
 * @returns ResultCounts with totals by status (pass/warning/danger/skipped)
 */
export function countResults(data: AuditData): ResultCounts {
  // Implementation
}
```

## Release Process

### Version Numbering

We follow [Semantic Versioning](https://semver.org/):
- **Major (1.0.0):** Breaking changes
- **Minor (0.1.0):** New features, backward compatible
- **Patch (0.0.1):** Bug fixes, backward compatible

### Creating a Release

**Maintainers only:**

1. **Merge feature PRs to main**

2. **Bump version:**
   ```bash
   # Edit package.json and artifacthub-pkg.yml
   # Update version and archive-url
   git add package.json artifacthub-pkg.yml
   git commit -m "chore: bump version to X.Y.Z"
   git push origin main
   ```

3. **Create and push tag:**
   ```bash
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```

4. **GitHub Actions automatically:**
   - Builds plugin tarball
   - Creates GitHub release
   - Uploads tarball to release
   - Updates `artifacthub-pkg.yml` with checksum

5. **ArtifactHub syncs within 30 minutes**

### Pre-release Versions

For testing before stable release:
- Use `-dev.N` suffix: `v0.3.5-dev.1`
- Follow same process as stable releases
- Mark as "pre-release" on GitHub

## Getting Help

- **Questions:** Open a [GitHub Discussion](https://github.com/privilegedescalation/headlamp-polaris-plugin/discussions)
- **Bugs:** Open a [GitHub Issue](https://github.com/privilegedescalation/headlamp-polaris-plugin/issues)
- **E2E Testing:** See [e2e/README.md](e2e/README.md)
- **Architecture:** See [CLAUDE.md](CLAUDE.md)

## License

By contributing, you agree that your contributions will be licensed under the Apache-2.0 License.
