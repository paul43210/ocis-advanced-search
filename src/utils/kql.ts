/**
 * KQL (Keyword Query Language) utilities for oCIS search
 * Handles query building, escaping, and formatting
 */

import type { SearchFilters, DateRange, NumericRange } from '../types'

/**
 * Characters that need escaping in KQL/Bleve queries
 */
const KQL_SPECIAL_CHARS = /[+\-=&|><!(){}[\]^"~*?:\\/\s]/g

/**
 * Escape special characters in KQL query values
 */
export function escapeKQL(value: string): string {
  // Don't escape wildcards if they appear to be intentional
  if (value.includes('*') || value.includes('?')) {
    // Only escape other special chars, keep wildcards
    return value.replace(/[+\-=&|><!(){}[\]^"~:\\/]/g, '\\$&')
  }
  return value.replace(KQL_SPECIAL_CHARS, '\\$&')
}

/**
 * Format date for KQL (YYYY-MM-DD)
 */
export function formatDateForKQL(date: string): string {
  // Ensure proper format
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date
  }
  // Try to parse and format
  const d = new Date(date)
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0]
  }
  return date
}

/**
 * Build a range query for KQL using comparison operators
 * oCIS KQL doesn't support [x TO y] syntax, use >= and <= instead
 */
export function buildRangeQuery(field: string, range: NumericRange): string | null {
  if (range.min === undefined && range.max === undefined) {
    return null
  }

  const parts: string[] = []
  if (range.min !== undefined) {
    parts.push(`${field}>=${range.min}`)
  }
  if (range.max !== undefined) {
    parts.push(`${field}<=${range.max}`)
  }

  // If both min and max, wrap in parentheses
  if (parts.length === 2) {
    return `(${parts.join(' AND ')})`
  }
  return parts[0]
}

/**
 * Build a date range query for KQL using comparison operators
 * oCIS KQL doesn't support [x TO y] syntax, use >= and <= instead
 */
export function buildDateRangeQuery(field: string, range: DateRange): string | null {
  if (!range.start && !range.end) {
    return null
  }

  const parts: string[] = []
  if (range.start) {
    parts.push(`${field}>=${formatDateForKQL(range.start)}`)
  }
  if (range.end) {
    parts.push(`${field}<=${formatDateForKQL(range.end)}`)
  }

  // If both start and end, wrap in parentheses
  if (parts.length === 2) {
    return `(${parts.join(' AND ')})`
  }
  return parts[0]
}

/**
 * Escape special XML characters in a string
 * Required when embedding KQL in XML body (< > & need escaping)
 */
export function escapeXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Build KQL query parts for standard filters
 */
export function buildStandardKQL(standard: SearchFilters['standard'], term: string): string[] {
  const parts: string[] = []

  // Basic text search term
  if (term && term.trim()) {
    if (!term.includes(':')) {
      parts.push(`name:*${escapeKQL(term.trim())}*`)
    } else {
      parts.push(term.trim())
    }
  }

  if (standard.name) {
    parts.push(`name:${escapeKQL(standard.name)}`)
  }

  // Type field uses numeric values: 1 = file, 2 = folder
  if (standard.type === 'file') {
    parts.push('Type:1')
  } else if (standard.type === 'folder') {
    parts.push('Type:2')
  }

  if (standard.sizeRange) {
    const sizeQuery = buildRangeQuery('size', standard.sizeRange)
    if (sizeQuery) parts.push(sizeQuery)
  }

  if (standard.modifiedRange) {
    const mtimeQuery = buildDateRangeQuery('mtime', standard.modifiedRange)
    if (mtimeQuery) parts.push(mtimeQuery)
  }

  if (standard.mediaType) {
    parts.push(`mediatype:${escapeKQL(standard.mediaType)}`)
  }

  if (standard.tags) {
    const tagList = standard.tags.split(',').map(t => t.trim()).filter(Boolean)
    if (tagList.length === 1) {
      parts.push(`tags:${escapeKQL(tagList[0])}`)
    } else if (tagList.length > 1) {
      const tagQuery = tagList.map(t => `tags:${escapeKQL(t)}`).join(' OR ')
      parts.push(`(${tagQuery})`)
    }
  }

  if (standard.content) {
    parts.push(`content:${escapeKQL(standard.content)}`)
  }

  return parts
}

/**
 * Build KQL query parts for photo/EXIF filters
 */
export function buildPhotoKQL(photo: SearchFilters['photo']): string[] {
  const parts: string[] = []

  if (photo.cameraMake) {
    parts.push(`photo.cameramake:${escapeKQL(photo.cameraMake)}`)
  }

  if (photo.cameraModel) {
    parts.push(`photo.cameramodel:${escapeKQL(photo.cameraModel)}`)
  }

  if (photo.takenDateRange) {
    const takenQuery = buildDateRangeQuery('photo.takendatetime', photo.takenDateRange)
    if (takenQuery) parts.push(takenQuery)
  }

  if (photo.isoRange) {
    const isoQuery = buildRangeQuery('photo.iso', photo.isoRange)
    if (isoQuery) parts.push(isoQuery)
  }

  if (photo.fNumberRange) {
    const fQuery = buildRangeQuery('photo.fnumber', photo.fNumberRange)
    if (fQuery) parts.push(fQuery)
  }

  if (photo.focalLengthRange) {
    const flQuery = buildRangeQuery('photo.focallength', photo.focalLengthRange)
    if (flQuery) parts.push(flQuery)
  }

  if (photo.orientation !== undefined && photo.orientation > 0) {
    parts.push(`photo.orientation:${photo.orientation}`)
  }

  return parts
}

/**
 * Build complete KQL query from filters
 */
export function buildKQL(filters: SearchFilters): string {
  const { standard, photo, term } = filters
  const parts = [
    ...buildStandardKQL(standard, term || ''),
    ...buildPhotoKQL(photo)
  ]
  return parts.length > 0 ? parts.join(' AND ') : '*'
}
