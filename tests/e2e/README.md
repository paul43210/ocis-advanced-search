# E2E Tests for oCIS Advanced Search

End-to-end tests using Playwright to verify the Advanced Search extension works correctly in oCIS.

## Prerequisites

- Node.js 18+
- pnpm
- Chromium (installed via apt or playwright)

## Running Tests

```bash
# Set credentials
export OCIS_PASSWORD='your-password'
export OCIS_USER='admin'  # optional, defaults to 'admin'
export OCIS_URL='https://cloud.faure.ca'  # optional

# Run all tests
pnpm test:e2e

# Run with visible browser
pnpm test:e2e:headed

# Run with Playwright UI
pnpm test:e2e:ui

# Debug mode
pnpm test:e2e:debug
```

## Authentication

Tests use cached authentication to avoid re-logging in for each test:

1. First run performs OIDC login via browser
2. Session state saved to `tests/e2e/.auth/user.json`
3. Subsequent runs (within 10 minutes) reuse the cached session

To force re-authentication, delete the auth file:
```bash
rm tests/e2e/.auth/user.json
```

## Test Coverage

- **Advanced Search App**: Loading, basic UI elements
- **Search Functionality**: Text search, Enter key, results/empty states
- **Filter Panel**: Standard filters, Photo/EXIF filters, KQL input
- **View Modes**: List/grid/table switching
- **Active Filters**: Filter chips, Clear All
- **Saved Searches**: Panel open/close, content display
- **Save Search Dialog**: Open, cancel, form input
- **API Integration**: Request tracking, error handling
- **Responsive**: Mobile viewport support

## Test Results

- HTML report: `playwright-report/index.html`
- Screenshots on failure: `test-results/`
- Videos on failure: `test-results/`

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OCIS_URL` | Base URL for oCIS | `https://cloud.faure.ca` |
| `OCIS_USER` | oCIS username | `admin` |
| `OCIS_PASSWORD` | oCIS password | (required) |
| `AUTH_CACHE_MINUTES` | Auth file cache duration | `10` |
