import { test as base, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const authFile = path.join(__dirname, '.auth/user.json')

/**
 * Extended test fixtures with authenticated context
 *
 * Import { test, expect } from this file instead of @playwright/test
 * to get automatic authentication in your tests.
 */
export const test = base.extend({
  // Use saved authentication state if available
  storageState: async ({}, use) => {
    try {
      if (fs.existsSync(authFile)) {
        await use(authFile)
      } else {
        console.warn('No auth file found, tests will run unauthenticated')
        await use(undefined)
      }
    } catch {
      await use(undefined)
    }
  },
})

export { expect }

/**
 * Helper to wait for oCIS page to be ready (SPA-friendly)
 *
 * Use this instead of waitForLoadState('networkidle') which
 * doesn't work well with oCIS WebSocket connections.
 */
export async function waitForPageReady(page: any, options?: { timeout?: number }) {
  const timeout = options?.timeout || 5000

  // Wait for DOM to be ready
  await page.waitForLoadState('domcontentloaded')

  // Wait a bit for Vue SPA to hydrate
  await page.waitForTimeout(Math.min(timeout, 3000))
}

/**
 * Helper to navigate to the Advanced Search app
 */
export async function navigateToAdvancedSearch(page: any) {
  // Navigate directly to the app URL
  await page.goto('/advanced-search')
  await waitForPageReady(page, { timeout: 5000 })
}

/**
 * Helper to safely click an element if it exists
 */
export async function clickIfExists(page: any, selector: string): Promise<boolean> {
  const element = page.locator(selector)
  if (await element.count() > 0) {
    await element.first().click()
    return true
  }
  return false
}

/**
 * Helper to wait for either of multiple possible elements
 */
export async function waitForAny(page: any, selectors: string[], options?: { timeout?: number }) {
  const timeout = options?.timeout || 30000

  return Promise.race(
    selectors.map(selector =>
      page.waitForSelector(selector, { timeout }).catch(() => null)
    )
  )
}

/**
 * Helper to get text content safely
 */
export async function getTextIfExists(page: any, selector: string): Promise<string | null> {
  const element = page.locator(selector)
  if (await element.count() > 0) {
    return element.first().textContent()
  }
  return null
}

/**
 * Helper to wait for search results to load
 */
export async function waitForSearchResults(page: any, options?: { timeout?: number }) {
  const timeout = options?.timeout || 30000

  // Wait for either results, empty state, or error
  await Promise.race([
    page.waitForSelector('.results-count', { timeout }),
    page.waitForSelector('.empty-state', { timeout }),
    page.waitForSelector('.error-state', { timeout }),
    page.waitForSelector('.loading-state', { timeout }).then(() =>
      // If we found loading, wait for it to disappear
      page.waitForSelector('.loading-state', { state: 'hidden', timeout })
    ),
  ])
}

/**
 * Helper to perform a search
 */
export async function performSearch(page: any, query: string) {
  const searchInput = page.locator('.search-input')
  await searchInput.fill(query)
  await page.locator('.search-btn').click()
  await waitForSearchResults(page)
}
