/**
 * Composable for advanced search functionality
 * Handles KQL query building and search execution via WebDAV REPORT
 */

import { ref, computed, reactive } from 'vue'
import { useClientService, useConfigStore, useSpacesStore } from '@ownclouders/web-pkg'
import type { Resource } from '@ownclouders/web-client'
import type {
  SearchFilters,
  SearchResults,
  AdvancedSearchState,
  ActiveFilter,
  DateRange,
  NumericRange,
  SortConfig,
  ResultViewMode,
} from '../types'
import { createEmptyFilters, createEmptyResults } from '../types'

/**
 * Characters that need escaping in KQL/Bleve queries
 */
const KQL_SPECIAL_CHARS = /[+\-=&|><!(){}[\]^"~*?:\\/\s]/g

/**
 * Escape special characters in KQL query values
 */
function escapeKQL(value: string): string {
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
function formatDateForKQL(date: string): string {
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
function buildRangeQuery(field: string, range: NumericRange): string | null {
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
function buildDateRangeQuery(field: string, range: DateRange): string | null {
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
function escapeXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Parse WebDAV REPORT search response XML
 */
function parseSearchResponse(xmlText: string, spaceId: string, driveAlias: string): Resource[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlText, 'application/xml')
  const responses = doc.getElementsByTagNameNS('DAV:', 'response')
  const items: Resource[] = []

  for (let i = 0; i < responses.length; i++) {
    const response = responses[i]
    const href = response.getElementsByTagNameNS('DAV:', 'href')[0]?.textContent || ''
    const displayname = response.getElementsByTagNameNS('DAV:', 'displayname')[0]?.textContent || ''
    const contentType = response.getElementsByTagNameNS('DAV:', 'getcontenttype')[0]?.textContent || ''
    const contentLength = response.getElementsByTagNameNS('DAV:', 'getcontentlength')[0]?.textContent || '0'
    const lastModified = response.getElementsByTagNameNS('DAV:', 'getlastmodified')[0]?.textContent || ''
    const fileId = response.getElementsByTagNameNS('http://owncloud.org/ns', 'fileid')[0]?.textContent || ''
    const parentId = response.getElementsByTagNameNS('http://owncloud.org/ns', 'file-parent')[0]?.textContent || ''

    // Extract path from href
    const spacePrefix = `/dav/spaces/${spaceId}`
    const encodedSpacePrefix = `/dav/spaces/${encodeURIComponent(spaceId)}`
    let path = href
    if (href.startsWith(spacePrefix)) {
      path = decodeURIComponent(href.substring(spacePrefix.length))
    } else if (href.startsWith(encodedSpacePrefix)) {
      path = decodeURIComponent(href.substring(encodedSpacePrefix.length))
    }

    // Determine if it's a folder
    const isFolder = contentType === 'httpd/unix-directory' || href.endsWith('/')

    items.push({
      id: fileId || `${spaceId}!${path}`,
      fileId,
      name: displayname || path.split('/').pop() || '',
      path: path,
      webDavPath: href,
      mimeType: contentType,
      size: parseInt(contentLength, 10) || 0,
      mdate: lastModified,
      type: isFolder ? 'folder' : 'file',
      isFolder,
      // Additional fields expected by Resource type
      etag: '',
      permissions: '',
      starred: false,
      spaceId: spaceId,
      driveAlias: driveAlias,
      parentId: parentId,
    } as Resource)
  }

  return items
}

/**
 * Main advanced search composable
 */
export function useAdvancedSearch() {
  // Get services from web-pkg
  const clientService = useClientService()
  const configStore = useConfigStore()
  const spacesStore = useSpacesStore()

  // Reactive state
  const state = reactive<AdvancedSearchState>({
    filters: createEmptyFilters(),
    results: null,
    loading: false,
    error: null,
    kqlQuery: '',
    viewMode: 'list',
    sort: { field: 'mtime', direction: 'desc' },
  })

  // Page size for pagination
  const pageSize = ref(100)

  /**
   * Build KQL query string from current filters
   */
  const buildKQLQuery = computed(() => {
    const parts: string[] = []
    const { standard, photo, term, scope } = state.filters

    // Basic text search term
    if (term && term.trim()) {
      // If term contains no field prefix, search in name
      if (!term.includes(':')) {
        parts.push(`name:*${escapeKQL(term.trim())}*`)
      } else {
        parts.push(term.trim())
      }
    }

    // Standard filters
    if (standard.name) {
      parts.push(`name:${escapeKQL(standard.name)}`)
    }

    // Type field uses numeric values in Bleve index:
    // 1 = RESOURCE_TYPE_FILE, 2 = RESOURCE_TYPE_CONTAINER (folder)
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
      // Split tags and join with OR
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

    // Photo/EXIF filters
    // KQL requires "photo." prefix for photo fields. The compiler maps:
    // photo.cameramake -> photo.cameraMake (Bleve), photo.cameramodel -> photo.cameraModel, etc.
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

    // Combine all parts with AND
    return parts.length > 0 ? parts.join(' AND ') : '*'
  })

  /**
   * Get list of active filters for display as chips
   */
  const activeFilters = computed<ActiveFilter[]>(() => {
    const filters: ActiveFilter[] = []
    const { standard, photo, term } = state.filters

    // Text term
    if (term && term.trim()) {
      filters.push({
        id: 'term',
        label: 'Search',
        field: 'name',
        value: term.trim(),
        category: 'text',
      })
    }

    // Standard filters
    if (standard.name) {
      filters.push({
        id: 'name',
        label: 'Name',
        field: 'name',
        value: standard.name,
        category: 'standard',
      })
    }

    if (standard.type) {
      filters.push({
        id: 'type',
        label: 'Type',
        field: 'type',
        value: standard.type,
        category: 'standard',
      })
    }

    if (standard.mediaType) {
      filters.push({
        id: 'mediaType',
        label: 'Media Type',
        field: 'mediatype',
        value: standard.mediaType,
        category: 'standard',
      })
    }

    if (standard.tags) {
      filters.push({
        id: 'tags',
        label: 'Tags',
        field: 'tags',
        value: standard.tags,
        category: 'standard',
      })
    }

    if (standard.sizeRange && (standard.sizeRange.min || standard.sizeRange.max)) {
      const min = standard.sizeRange.min ? formatBytes(standard.sizeRange.min) : '0'
      const max = standard.sizeRange.max ? formatBytes(standard.sizeRange.max) : '∞'
      filters.push({
        id: 'size',
        label: 'Size',
        field: 'size',
        value: `${min} - ${max}`,
        category: 'standard',
      })
    }

    if (standard.modifiedRange && (standard.modifiedRange.start || standard.modifiedRange.end)) {
      filters.push({
        id: 'mtime',
        label: 'Modified',
        field: 'mtime',
        value: `${standard.modifiedRange.start || '*'} to ${standard.modifiedRange.end || '*'}`,
        category: 'standard',
      })
    }

    if (standard.content) {
      filters.push({
        id: 'content',
        label: 'Content',
        field: 'content',
        value: standard.content,
        category: 'text',
      })
    }

    // Photo filters
    if (photo.cameraMake) {
      filters.push({
        id: 'cameraMake',
        label: 'Camera Make',
        field: 'photo.cameraMake',
        value: photo.cameraMake,
        category: 'photo',
      })
    }

    if (photo.cameraModel) {
      filters.push({
        id: 'cameraModel',
        label: 'Camera Model',
        field: 'photo.cameraModel',
        value: photo.cameraModel,
        category: 'photo',
      })
    }

    if (photo.takenDateRange && (photo.takenDateRange.start || photo.takenDateRange.end)) {
      filters.push({
        id: 'takenDate',
        label: 'Date Taken',
        field: 'photo.takenDateTime',
        value: `${photo.takenDateRange.start || '*'} to ${photo.takenDateRange.end || '*'}`,
        category: 'photo',
      })
    }

    if (photo.isoRange && (photo.isoRange.min || photo.isoRange.max)) {
      filters.push({
        id: 'iso',
        label: 'ISO',
        field: 'photo.iso',
        value: `${photo.isoRange.min || '0'} - ${photo.isoRange.max || '∞'}`,
        category: 'photo',
      })
    }

    if (photo.fNumberRange && (photo.fNumberRange.min || photo.fNumberRange.max)) {
      filters.push({
        id: 'fNumber',
        label: 'Aperture',
        field: 'photo.fNumber',
        value: `f/${photo.fNumberRange.min || '?'} - f/${photo.fNumberRange.max || '?'}`,
        category: 'photo',
      })
    }

    if (photo.focalLengthRange && (photo.focalLengthRange.min || photo.focalLengthRange.max)) {
      filters.push({
        id: 'focalLength',
        label: 'Focal Length',
        field: 'photo.focalLength',
        value: `${photo.focalLengthRange.min || '?'}mm - ${photo.focalLengthRange.max || '?'}mm`,
        category: 'photo',
      })
    }

    return filters
  })

  /**
   * Execute search with current filters using WebDAV REPORT
   */
  async function executeSearch(page = 0): Promise<void> {
    state.loading = true
    state.error = null
    state.kqlQuery = buildKQLQuery.value

    try {
      const serverUrl = (configStore.serverUrl || '').replace(/\/$/, '')

      // Get the personal space (or first available space)
      const spaces = spacesStore.spaces
      console.log('[AdvancedSearch] Available spaces:', spaces.length, spaces.map(s => ({ id: s.id, name: s.name, driveType: s.driveType })))

      const personalSpace = spaces.find(s => s.driveType === 'personal') || spaces[0]

      if (!personalSpace) {
        throw new Error('No space available for search')
      }

      const spaceId = personalSpace.id
      const driveAlias = (personalSpace as any).driveAlias || 'personal/home'
      console.log('[AdvancedSearch] Using space:', spaceId, personalSpace.name, 'driveAlias:', driveAlias)

      const limit = pageSize.value
      const pattern = state.kqlQuery

      // Build WebDAV REPORT search request
      // Pattern must be XML-escaped since KQL can contain < > (comparison operators)
      const searchBody = `<?xml version="1.0" encoding="UTF-8"?>
<oc:search-files xmlns:oc="http://owncloud.org/ns" xmlns:d="DAV:">
  <oc:search>
    <oc:pattern>${escapeXML(pattern)}</oc:pattern>
    <oc:limit>${limit}</oc:limit>
  </oc:search>
  <d:prop>
    <d:displayname/>
    <d:getcontenttype/>
    <d:getcontentlength/>
    <d:getlastmodified/>
    <oc:fileid/>
    <oc:file-parent/>
    <oc:photo-taken-date-time/>
    <oc:photo-camera-make/>
    <oc:photo-camera-model/>
  </d:prop>
</oc:search-files>`

      console.log('[AdvancedSearch] Executing search:', { spaceId, pattern, limit })

      const response = await clientService.httpAuthenticated.request({
        method: 'REPORT',
        url: `${serverUrl}/dav/spaces/${encodeURIComponent(spaceId)}`,
        headers: {
          'Content-Type': 'application/xml'
        },
        data: searchBody
      })

      console.log('[AdvancedSearch] Response status:', response.status)
      const xmlText = typeof response.data === 'string' ? response.data : new XMLSerializer().serializeToString(response.data)
      console.log('[AdvancedSearch] Response length:', xmlText.length)

      const items = parseSearchResponse(xmlText, spaceId, driveAlias)
      console.log('[AdvancedSearch] Parsed items:', items.length)

      state.results = {
        totalCount: items.length,
        items: page === 0 ? items : [...(state.results?.items || []), ...items],
        hasMore: items.length === limit,
        currentPage: page,
      }
    } catch (err) {
      console.error('[AdvancedSearch] Search error:', err)
      state.error = err instanceof Error ? err.message : 'Search failed'
      state.results = createEmptyResults()
    } finally {
      state.loading = false
    }
  }

  /**
   * Load next page of results
   */
  async function loadMore(): Promise<void> {
    if (!state.results || !state.results.hasMore || state.loading) {
      return
    }
    await executeSearch(state.results.currentPage + 1)
  }

  /**
   * Clear all filters and reset state
   */
  function clearFilters(): void {
    state.filters = createEmptyFilters()
    state.results = null
    state.kqlQuery = ''
  }

  /**
   * Remove a specific filter by ID
   */
  function removeFilter(filterId: string): void {
    switch (filterId) {
      case 'term':
        state.filters.term = ''
        break
      case 'name':
        state.filters.standard.name = undefined
        break
      case 'type':
        state.filters.standard.type = ''
        break
      case 'mediaType':
        state.filters.standard.mediaType = undefined
        break
      case 'tags':
        state.filters.standard.tags = undefined
        break
      case 'size':
        state.filters.standard.sizeRange = undefined
        break
      case 'mtime':
        state.filters.standard.modifiedRange = undefined
        break
      case 'content':
        state.filters.standard.content = undefined
        break
      case 'cameraMake':
        state.filters.photo.cameraMake = undefined
        break
      case 'cameraModel':
        state.filters.photo.cameraModel = undefined
        break
      case 'takenDate':
        state.filters.photo.takenDateRange = undefined
        break
      case 'iso':
        state.filters.photo.isoRange = undefined
        break
      case 'fNumber':
        state.filters.photo.fNumberRange = undefined
        break
      case 'focalLength':
        state.filters.photo.focalLengthRange = undefined
        break
    }
  }

  /**
   * Set view mode
   */
  function setViewMode(mode: ResultViewMode): void {
    state.viewMode = mode
  }

  /**
   * Set sort configuration
   */
  function setSort(sort: SortConfig): void {
    state.sort = sort
  }

  /**
   * Update filters (partial update)
   */
  function updateFilters(updates: Partial<SearchFilters>): void {
    Object.assign(state.filters, updates)
  }

  /**
   * Update standard filters
   */
  function updateStandardFilters(updates: Partial<SearchFilters['standard']>): void {
    Object.assign(state.filters.standard, updates)
  }

  /**
   * Update photo filters
   */
  function updatePhotoFilters(updates: Partial<SearchFilters['photo']>): void {
    Object.assign(state.filters.photo, updates)
  }

  /**
   * Fetch camera makes - returns empty, uses static list only
   * TODO: WebDAV doesn't return photo-camera-make property in responses,
   * so dynamic discovery requires a different approach (faceted search or probing)
   */
  async function fetchCameraMakes(): Promise<string[]> {
    // Static list is used from KNOWN_CAMERA_MAKES in types.ts
    return []
  }

  /**
   * Fetch camera models - returns empty, no static list available
   * TODO: WebDAV doesn't return photo-camera-model property in responses
   */
  async function fetchCameraModels(): Promise<string[]> {
    return []
  }

  /**
   * Set KQL query directly (for manual editing)
   */
  function setKqlQuery(query: string): void {
    state.kqlQuery = query
  }

  /**
   * Parse a KQL query string and populate the filters
   * This is the reverse of buildKQLQuery
   */
  function parseKqlToFilters(kql: string): void {
    // Reset filters first
    state.filters = createEmptyFilters()

    if (!kql || kql === '*') {
      return
    }

    // Split by AND (but not inside parentheses)
    const parts = splitKqlParts(kql)

    for (const part of parts) {
      parseKqlPart(part.trim())
    }
  }

  /**
   * Split KQL by AND, respecting parentheses
   */
  function splitKqlParts(kql: string): string[] {
    const parts: string[] = []
    let current = ''
    let depth = 0

    const tokens = kql.split(/\s+(AND)\s+/i)

    for (const token of tokens) {
      if (token.toUpperCase() === 'AND') {
        if (depth === 0) {
          if (current.trim()) {
            parts.push(current.trim())
          }
          current = ''
        } else {
          current += ' AND '
        }
      } else {
        // Count parentheses
        for (const char of token) {
          if (char === '(') depth++
          if (char === ')') depth--
        }
        current += token
      }
    }

    if (current.trim()) {
      parts.push(current.trim())
    }

    return parts
  }

  /**
   * Parse a single KQL part and update filters
   */
  function parseKqlPart(part: string): void {
    // Handle parenthesized expressions (unwrap and parse recursively)
    if (part.startsWith('(') && part.endsWith(')')) {
      const inner = part.slice(1, -1)
      // Check if it's a range expression
      if (inner.includes(' AND ')) {
        const rangeParts = inner.split(/\s+AND\s+/i)
        // Try to parse as range (e.g., size>=100 AND size<=1000)
        if (rangeParts.length === 2) {
          const range1 = parseRangePart(rangeParts[0])
          const range2 = parseRangePart(rangeParts[1])
          if (range1 && range2 && range1.field === range2.field) {
            applyRangeToFilters(range1.field, range1, range2)
            return
          }
        }
      }
      // Not a range, parse each part
      const subParts = splitKqlParts(inner)
      for (const subPart of subParts) {
        parseKqlPart(subPart.trim())
      }
      return
    }

    // Try to parse as range comparison (field>=value or field<=value)
    const rangeMatch = parseRangePart(part)
    if (rangeMatch) {
      applyRangeToFilters(rangeMatch.field, rangeMatch, null)
      return
    }

    // Parse field:value patterns
    const colonIndex = part.indexOf(':')
    if (colonIndex === -1) {
      // Free text search term
      if (part.trim()) {
        state.filters.term = (state.filters.term ? state.filters.term + ' ' : '') + part.trim()
      }
      return
    }

    const field = part.substring(0, colonIndex).toLowerCase()
    let value = part.substring(colonIndex + 1)

    // Remove quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }

    // Unescape KQL escapes
    value = value.replace(/\\([+\-=&|><!(){}[\]^"~:\\/])/g, '$1')

    // Map field to filter
    switch (field) {
      case 'name':
        state.filters.standard.name = value
        break
      case 'type':
        if (value === '1') state.filters.standard.type = 'file'
        else if (value === '2') state.filters.standard.type = 'folder'
        else state.filters.standard.type = value as 'file' | 'folder'
        break
      case 'mediatype':
        state.filters.standard.mediaType = value
        break
      case 'tags':
      case 'tag':
        state.filters.standard.tags = state.filters.standard.tags
          ? state.filters.standard.tags + ',' + value
          : value
        break
      case 'content':
        state.filters.standard.content = value
        break
      case 'photo.cameramake':
        state.filters.photo.cameraMake = value
        break
      case 'photo.cameramodel':
        state.filters.photo.cameraModel = value
        break
      case 'photo.orientation':
        state.filters.photo.orientation = parseInt(value, 10)
        break
      default:
        // Unknown field - add to search term
        console.log('[parseKqlPart] Unknown field:', field, value)
        break
    }
  }

  /**
   * Parse a range comparison part (e.g., size>=100, mtime<=2024-01-01)
   */
  function parseRangePart(part: string): { field: string; op: string; value: string } | null {
    const match = part.match(/^([a-z.]+)(>=|<=|>|<)(.+)$/i)
    if (match) {
      return {
        field: match[1].toLowerCase(),
        op: match[2],
        value: match[3]
      }
    }
    return null
  }

  /**
   * Apply range values to the appropriate filter
   */
  function applyRangeToFilters(
    field: string,
    range1: { op: string; value: string },
    range2: { op: string; value: string } | null
  ): void {
    const ranges = [range1]
    if (range2) ranges.push(range2)

    let min: string | number | undefined
    let max: string | number | undefined

    for (const r of ranges) {
      if (r.op === '>=' || r.op === '>') {
        min = r.value
      } else if (r.op === '<=' || r.op === '<') {
        max = r.value
      }
    }

    switch (field) {
      case 'size':
        state.filters.standard.sizeRange = {
          min: min !== undefined ? parseInt(min as string, 10) : undefined,
          max: max !== undefined ? parseInt(max as string, 10) : undefined
        }
        break
      case 'mtime':
        state.filters.standard.modifiedRange = {
          start: min as string || '',
          end: max as string || ''
        }
        break
      case 'photo.takendatetime':
        state.filters.photo.takenDateRange = {
          start: min as string || '',
          end: max as string || ''
        }
        break
      case 'photo.iso':
        state.filters.photo.isoRange = {
          min: min !== undefined ? parseInt(min as string, 10) : undefined,
          max: max !== undefined ? parseInt(max as string, 10) : undefined
        }
        break
      case 'photo.fnumber':
        state.filters.photo.fNumberRange = {
          min: min !== undefined ? parseFloat(min as string) : undefined,
          max: max !== undefined ? parseFloat(max as string) : undefined
        }
        break
      case 'photo.focallength':
        state.filters.photo.focalLengthRange = {
          min: min !== undefined ? parseFloat(min as string) : undefined,
          max: max !== undefined ? parseFloat(max as string) : undefined
        }
        break
      default:
        console.log('[applyRangeToFilters] Unknown range field:', field)
    }
  }

  return {
    // State
    state,
    pageSize,

    // Computed
    kqlQuery: buildKQLQuery,
    activeFilters,

    // Methods
    executeSearch,
    loadMore,
    clearFilters,
    removeFilter,
    setViewMode,
    setSort,
    updateFilters,
    updateStandardFilters,
    updatePhotoFilters,
    setKqlQuery,
    parseKqlToFilters,
    fetchCameraMakes,
    fetchCameraModels,
  }
}

/**
 * Helper: Format bytes for display
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}
