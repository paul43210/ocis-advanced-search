import { chromium, FullConfig } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const authFile = path.join(__dirname, '.auth/user.json')

// How long to cache auth state (in minutes)
const AUTH_CACHE_MINUTES = parseInt(process.env.AUTH_CACHE_MINUTES || '10', 10)

/**
 * Global setup - authenticates to oCIS and saves session state
 * All tests reuse this authenticated session
 *
 * oCIS uses OpenID Connect (OIDC) via its built-in IdP
 */
async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL || 'https://cloud.faure.ca'

  // Check if auth file exists and is recent enough
  if (fs.existsSync(authFile)) {
    const stats = fs.statSync(authFile)
    const ageMs = Date.now() - stats.mtimeMs
    const ageMinutes = ageMs / 1000 / 60
    if (ageMinutes < AUTH_CACHE_MINUTES) {
      console.log(`Using existing auth file (${ageMinutes.toFixed(1)} minutes old)`)
      return
    }
    console.log(`Auth file expired (${ageMinutes.toFixed(1)} minutes old), re-authenticating...`)
  }

  // Get credentials from environment
  const username = process.env.OCIS_USER || 'admin'
  const password = process.env.OCIS_PASSWORD

  if (!password) {
    console.log('OCIS_PASSWORD not set, skipping authentication setup')
    console.log('Set OCIS_PASSWORD environment variable to run E2E tests')
    return
  }

  console.log(`Authenticating to oCIS as ${username}...`)

  const browser = await chromium.launch()
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
  })
  const page = await context.newPage()

  try {
    // Navigate to oCIS - will redirect to IdP login
    await page.goto(baseURL)

    // Wait for oCIS IdP login form
    // oCIS uses its built-in IdP with a standard login form
    await page.waitForSelector(
      'input[name="login"], input[id="oc-login-username"], input[autocomplete="username"]',
      { timeout: 30000 }
    )

    console.log('Login form found, entering credentials...')

    // Fill in credentials - oCIS IdP selectors
    const usernameInput = page.locator(
      'input[name="login"], input[id="oc-login-username"], input[autocomplete="username"]'
    ).first()
    const passwordInput = page.locator(
      'input[name="password"], input[id="oc-login-password"], input[type="password"]'
    ).first()

    await usernameInput.fill(username)
    await passwordInput.fill(password)

    // Submit login form
    const submitButton = page.locator(
      'button[type="submit"], input[type="submit"], button:has-text("Log in"), button:has-text("Sign in"), .oc-button-primary'
    ).first()
    await submitButton.click()

    // Wait for successful login - should redirect to files page
    try {
      await page.waitForURL('**/files/**', { timeout: 30000 })
    } catch (e) {
      // Capture debug info on failure
      console.log('Current URL after login attempt:', page.url())
      const screenshotDir = path.join(process.cwd(), 'test-results')
      if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true })
      }
      await page.screenshot({ path: path.join(screenshotDir, 'auth-debug.png') })
      console.log('Screenshot saved to test-results/auth-debug.png')
      throw e
    }

    // Wait a bit for oCIS to fully initialize the session
    await page.waitForTimeout(2000)

    // Ensure auth directory exists
    const authDir = path.dirname(authFile)
    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true })
    }

    // Save authentication state
    await context.storageState({ path: authFile })
    console.log('oCIS authentication successful, state saved to', authFile)

  } catch (error) {
    console.error('oCIS authentication failed:', error)
    throw error
  } finally {
    await browser.close()
  }
}

export default globalSetup
