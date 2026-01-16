/**
 * Composable for managing saved search queries
 * Uses localStorage for persistence
 */

import { ref, computed } from 'vue'
import type { SavedQuery, SearchFilters } from '../types'

const STORAGE_KEY = 'ocis-advanced-search-saved-queries'

/**
 * Load saved queries from localStorage
 */
function loadFromStorage(): SavedQuery[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (err) {
    console.error('[SearchHistory] Failed to load saved queries:', err)
  }
  return []
}

/**
 * Save queries to localStorage
 */
function saveToStorage(queries: SavedQuery[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queries))
  } catch (err) {
    console.error('[SearchHistory] Failed to save queries:', err)
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
  // Reactive state
  const savedQueries = ref<SavedQuery[]>(loadFromStorage())

  // Recent searches (not persisted across sessions, for autocomplete)
  const recentSearches = ref<string[]>([])
  const MAX_RECENT = 10

  /**
   * Save a query with a name
   */
  function saveQuery(name: string, filters: SearchFilters): SavedQuery {
    const query: SavedQuery = {
      id: generateId(),
      name,
      filters: JSON.parse(JSON.stringify(filters)), // Deep clone
      savedAt: new Date().toISOString(),
    }

    savedQueries.value.unshift(query)
    saveToStorage(savedQueries.value)

    return query
  }

  /**
   * Delete a saved query
   */
  function deleteQuery(id: string): void {
    const index = savedQueries.value.findIndex(q => q.id === id)
    if (index !== -1) {
      savedQueries.value.splice(index, 1)
      saveToStorage(savedQueries.value)
    }
  }

  /**
   * Update a saved query's name
   */
  function renameQuery(id: string, newName: string): void {
    const query = savedQueries.value.find(q => q.id === id)
    if (query) {
      query.name = newName
      saveToStorage(savedQueries.value)
    }
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

    // Methods
    saveQuery,
    deleteQuery,
    renameQuery,
    getQuery,
    addToRecent,
    clearRecent,
    isNameTaken,
    exportQueries,
    importQueries,
  }
}
