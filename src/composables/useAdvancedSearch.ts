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
 * Build a range query for KQL
 */
function buildRangeQuery(field: string, range: NumericRange): string | null {
  if (range.min === undefined && range.max === undefined) {
    return null
  }
  const min = range.min !== undefined ? range.min : '*'
  const max = range.max !== undefined ? range.max : '*'
  return `${field}:[${min} TO ${max}]`
}

/**
 * Build a date range query for KQL
 */
function buildDateRangeQuery(field: string, range: DateRange): string | null {
  if (!range.start && !range.end) {
    return null
  }
  const start = range.start ? formatDateForKQL(range.start) : '*'
  const end = range.end ? formatDateForKQL(range.end) : '*'
  return `${field}:[${start} TO ${end}]`
}

/**
 * Parse WebDAV REPORT search response XML
 */
function parseSearchResponse(xmlText: string, spaceId: string): Resource[] {
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

    if (standard.type === 'file') {
      parts.push('type:file')
    } else if (standard.type === 'folder') {
      parts.push('type:folder')
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
    if (photo.cameraMake) {
      parts.push(`photo.cameraMake:${escapeKQL(photo.cameraMake)}`)
    }

    if (photo.cameraModel) {
      parts.push(`photo.cameraModel:${escapeKQL(photo.cameraModel)}`)
    }

    if (photo.takenDateRange) {
      const takenQuery = buildDateRangeQuery('photo.takenDateTime', photo.takenDateRange)
      if (takenQuery) parts.push(takenQuery)
    }

    if (photo.isoRange) {
      const isoQuery = buildRangeQuery('photo.iso', photo.isoRange)
      if (isoQuery) parts.push(isoQuery)
    }

    if (photo.fNumberRange) {
      const fQuery = buildRangeQuery('photo.fNumber', photo.fNumberRange)
      if (fQuery) parts.push(fQuery)
    }

    if (photo.focalLengthRange) {
      const flQuery = buildRangeQuery('photo.focalLength', photo.focalLengthRange)
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
      console.log('[AdvancedSearch] Using space:', spaceId, personalSpace.name)

      const limit = pageSize.value
      const pattern = state.kqlQuery

      // Build WebDAV REPORT search request
      const searchBody = `<?xml version="1.0" encoding="UTF-8"?>
<oc:search-files xmlns:oc="http://owncloud.org/ns" xmlns:d="DAV:">
  <oc:search>
    <oc:pattern>${pattern}</oc:pattern>
    <oc:limit>${limit}</oc:limit>
  </oc:search>
  <d:prop>
    <d:displayname/>
    <d:getcontenttype/>
    <d:getcontentlength/>
    <d:getlastmodified/>
    <oc:fileid/>
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

      const items = parseSearchResponse(xmlText, spaceId)
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
