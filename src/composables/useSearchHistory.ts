/**
 * Composable for managing saved search queries
 * Uses localStorage for persistence
 */

import { ref } from 'vue'
import type { SavedQuery, SearchFilters } from '../types'
import { useTranslations } from './useTranslations'

const STORAGE_KEY = 'ocis-advanced-search-saved-queries'

/** Result type for storage operations */
interface StorageResult {
  success: boolean
  error?: string
}

/** Last storage error for user feedback */
let lastStorageError: string | null = null

/**
 * Load saved queries from localStorage
 */
function loadFromStorage(): SavedQuery[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      // Validate that it's an array
      if (!Array.isArray(parsed)) {
        lastStorageError = 'Corrupted data: expected array'
        return []
      }
      return parsed
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    lastStorageError = `Failed to load: ${message}`
    console.error('[SearchHistory] Failed to load saved queries:', err)
  }
  return []
}

/**
 * Save queries to localStorage
 * @returns Result indicating success or failure with error message
 */
function saveToStorage(queries: SavedQuery[]): StorageResult {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queries))
    lastStorageError = null
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    // Check for quota exceeded
    if (err instanceof Error && err.name === 'QuotaExceededError') {
      lastStorageError = 'Storage quota exceeded. Try deleting some saved searches.'
    } else {
      lastStorageError = `Failed to save: ${message}`
    }
    console.error('[SearchHistory] Failed to save queries:', err)
    return { success: false, error: lastStorageError }
  }
}

/**
 * Generate a unique ID
 */
function generateId(): string {
  return `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Composable for managing search history and saved queries
 */
export function useSearchHistory() {
  const { $gettext } = useTranslations()

  // Reactive state
  const savedQueries = ref<SavedQuery[]>(loadFromStorage())

  // Recent searches (not persisted across sessions, for autocomplete)
  const recentSearches = ref<string[]>([])
  const MAX_RECENT = 10

  // Expose storage error state
  const storageError = ref<string | null>(lastStorageError)

  /**
   * Save a query with a name
   * @returns The saved query, or null if save failed
   */
  function saveQuery(name: string, filters: SearchFilters): SavedQuery | null {
    const query: SavedQuery = {
      id: generateId(),
      name,
      // Use JSON for deep clone (structuredClone can't handle Vue reactive proxies)
      filters: JSON.parse(JSON.stringify(filters)),
      savedAt: new Date().toISOString(),
    }

    savedQueries.value.unshift(query)
    const result = saveToStorage(savedQueries.value)

    if (!result.success) {
      // Rollback on failure
      savedQueries.value.shift()
      storageError.value = result.error || $gettext('Failed to save query')
      return null
    }

    storageError.value = null
    return query
  }

  /**
   * Delete a saved query
   * @returns true if deleted successfully
   */
  function deleteQuery(id: string): boolean {
    const index = savedQueries.value.findIndex(q => q.id === id)
    if (index !== -1) {
      const removed = savedQueries.value.splice(index, 1)
      const result = saveToStorage(savedQueries.value)

      if (!result.success) {
        // Rollback on failure
        savedQueries.value.splice(index, 0, ...removed)
        storageError.value = result.error || $gettext('Failed to delete query')
        return false
      }

      storageError.value = null
      return true
    }
    return false
  }

  /**
   * Update a saved query's name
   * @returns true if renamed successfully
   */
  function renameQuery(id: string, newName: string): boolean {
    const query = savedQueries.value.find(q => q.id === id)
    if (query) {
      const oldName = query.name
      query.name = newName
      const result = saveToStorage(savedQueries.value)

      if (!result.success) {
        // Rollback on failure
        query.name = oldName
        storageError.value = result.error || $gettext('Failed to rename query')
        return false
      }

      storageError.value = null
      return true
    }
    return false
  }

  /**
   * Clear storage error
   */
  function clearStorageError(): void {
    storageError.value = null
  }

  /**
   * Get a saved query by ID
   */
  function getQuery(id: string): SavedQuery | undefined {
    return savedQueries.value.find(q => q.id === id)
  }

  /**
   * Add to recent searches (for autocomplete)
   */
  function addToRecent(term: string): void {
    if (!term || !term.trim()) return

    // Remove if already exists
    const existing = recentSearches.value.indexOf(term)
    if (existing !== -1) {
      recentSearches.value.splice(existing, 1)
    }

    // Add to front
    recentSearches.value.unshift(term)

    // Trim to max
    if (recentSearches.value.length > MAX_RECENT) {
      recentSearches.value = recentSearches.value.slice(0, MAX_RECENT)
    }
  }

  /**
   * Clear recent searches
   */
  function clearRecent(): void {
    recentSearches.value = []
  }

  /**
   * Check if a query name is already used
   */
  function isNameTaken(name: string): boolean {
    return savedQueries.value.some(q => q.name.toLowerCase() === name.toLowerCase())
  }

  /**
   * Export all saved queries as JSON
   */
  function exportQueries(): string {
    return JSON.stringify(savedQueries.value, null, 2)
  }

  /**
   * Import queries from JSON
   */
  function importQueries(json: string): number {
    try {
      const imported = JSON.parse(json) as SavedQuery[]
      let count = 0

      for (const query of imported) {
        // Validate structure
        if (query.name && query.filters) {
          // Generate new ID to avoid conflicts
          query.id = generateId()
          query.savedAt = new Date().toISOString()
          savedQueries.value.push(query)
          count++
        }
      }

      if (count > 0) {
        saveToStorage(savedQueries.value)
      }

      return count
    } catch (err) {
      console.error('[SearchHistory] Import failed:', err)
      return 0
    }
  }

  return {
    // State
    savedQueries,
    recentSearches,
    storageError,

    // Methods
    saveQuery,
    deleteQuery,
    renameQuery,
    getQuery,
    addToRecent,
    clearRecent,
    clearStorageError,
    isNameTaken,
    exportQueries,
    importQueries,
  }
}
