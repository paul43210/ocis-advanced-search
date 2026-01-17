<template>
  <div class="advanced-search-app">
    <!-- Header -->
    <div class="search-header">
      <h1>{{ $gettext('Advanced Search') }}</h1>
      <div class="header-actions">
        <button
          class="btn btn-secondary"
          @click="showSavedQueries = !showSavedQueries"
        >
          📁 {{ $gettext('Saved Searches') }} ({{ savedQueries.length }})
        </button>
        <button
          v-if="activeFilters.length > 0"
          class="btn btn-secondary"
          @click="showSaveDialog = true"
        >
          💾 {{ $gettext('Save Search') }}
        </button>
      </div>
    </div>

    <!-- Main search input -->
    <div class="search-bar">
      <div class="search-input-wrapper">
        <input
          type="text"
          v-model="searchTerm"
          class="search-input"
          :placeholder="$gettext('Search files... (or use filters below)')"
          @keyup.enter="handleSearch"
        />
        <button class="search-btn" @click="handleSearch" :disabled="loading">
          {{ loading ? '⏳' : '🔍' }} {{ $gettext('Search') }}
        </button>
      </div>
      <button
        class="toggle-filters-btn"
        @click="showFilters = !showFilters"
      >
        {{ showFilters ? '▼' : '▶' }} {{ $gettext('Advanced') }}
      </button>
    </div>

    <!-- Active filter chips -->
    <div v-if="activeFilters.length > 0" class="active-filters">
      <FilterChip
        v-for="filter in activeFilters"
        :key="filter.id"
        :filter="filter"
        @remove="removeFilter(filter.id)"
      />
      <button class="clear-all-btn" @click="clearFilters">
        {{ $gettext('Clear All') }}
      </button>
    </div>

    <!-- Filter panel (collapsible) -->
    <div v-if="showFilters" class="filters-panel">
      <SearchFilters
        :filters="state.filters"
        :fetch-camera-makes="fetchCameraMakes"
        :fetch-camera-models="fetchCameraModels"
        :kql-query="kqlQuery"
        @update:standard="updateStandardFilters"
        @update:photo="updatePhotoFilters"
        @search="handleSearch"
        @kql-input="onKqlInput"
        @apply-kql="applyKqlToFilters"
      />
    </div>

    <!-- Results section -->
    <div class="results-section">
      <!-- Results header -->
      <div v-if="state.results" class="results-header">
        <span class="results-count">
          {{ $ngettext('%{count} result', '%{count} results', state.results.totalCount ?? state.results.items.length).replace('%{count}', String(state.results.totalCount ?? state.results.items.length)) }}
        </span>
        <div class="view-controls">
          <button
            :class="['view-btn', { active: state.viewMode === 'list' }]"
            @click="setViewMode('list')"
            :title="$gettext('List view')"
          >
            ☰
          </button>
          <button
            :class="['view-btn', { active: state.viewMode === 'grid' }]"
            @click="setViewMode('grid')"
            :title="$gettext('Grid view')"
          >
            ⊞
          </button>
          <button
            :class="['view-btn', { active: state.viewMode === 'table' }]"
            @click="setViewMode('table')"
            :title="$gettext('Table view')"
          >
            ▦
          </button>
        </div>
      </div>

      <!-- Loading state -->
      <div v-if="loading" class="loading-state">
        <span class="spinner"></span>
        {{ $gettext('Searching...') }}
      </div>

      <!-- Error state -->
      <div v-else-if="state.error" class="error-state">
        ⚠️ {{ state.error }}
      </div>

      <!-- Empty state -->
      <div v-else-if="state.results && state.results.items.length === 0" class="empty-state">
        <span class="empty-icon">🔍</span>
        <p>{{ $gettext('No results found') }}</p>
        <p class="empty-hint">{{ $gettext('Try adjusting your search terms or filters') }}</p>
      </div>

      <!-- Results display -->
      <SearchResults
        v-else-if="state.results && state.results.items.length > 0"
        :items="state.results.items"
        :view-mode="state.viewMode"
        @item-click="handleItemClick"
        @context-menu="openContextMenu"
      />

      <!-- Load more -->
      <div v-if="state.results?.hasMore" class="load-more">
        <button class="btn btn-secondary" @click="loadMore" :disabled="loading">
          {{ $gettext('Load More') }}
        </button>
      </div>
    </div>

    <!-- Search Status -->
    <SearchStats />

    <!-- Saved queries sidebar -->
    <div v-if="showSavedQueries" class="saved-queries-panel">
      <div class="panel-header">
        <h3>{{ $gettext('Saved Searches') }}</h3>
        <button class="close-btn" @click="showSavedQueries = false">×</button>
      </div>
      <div v-if="savedQueries.length === 0" class="no-saved">
        <p>{{ $gettext('No saved searches yet') }}</p>
        <p class="hint">{{ $gettext('Create a search and click "Save Search" to save it.') }}</p>
      </div>
      <ul v-else class="saved-list">
        <li
          v-for="query in savedQueries"
          :key="query.id"
          class="saved-item"
        >
          <button class="saved-name" @click="loadSavedQuery(query)">
            {{ query.name }}
          </button>
          <span class="saved-date">{{ formatDate(query.savedAt) }}</span>
          <button class="delete-btn" @click="deleteQuery(query.id)">🗑️</button>
        </li>
      </ul>
    </div>

    <!-- Save dialog -->
    <div v-if="showSaveDialog" class="modal-overlay" @click.self="showSaveDialog = false">
      <div class="modal-dialog">
        <h3>{{ $gettext('Save Search') }}</h3>
        <input
          type="text"
          v-model="saveQueryName"
          :placeholder="$gettext('Enter a name for this search')"
          class="save-input"
          @keyup.enter="handleSaveQuery"
        />
        <div class="modal-actions">
          <button class="btn btn-secondary" @click="showSaveDialog = false">
            {{ $gettext('Cancel') }}
          </button>
          <button
            class="btn btn-primary"
            @click="handleSaveQuery"
            :disabled="!saveQueryName.trim()"
          >
            {{ $gettext('Save') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Context Menu -->
    <ResultContextMenu
      :visible="contextMenuVisible"
      :item="contextMenuItem"
      :position="contextMenuPosition"
      @close="closeContextMenu"
      @action="handleContextAction"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import type { Resource } from '@ownclouders/web-client'
import { useAdvancedSearch } from '../composables/useAdvancedSearch'
import { useSearchHistory } from '../composables/useSearchHistory'
import { useTranslations } from '../composables/useTranslations'
import type { SavedQuery } from '../types'
import SearchFilters from '../components/SearchFilters.vue'
import FilterChip from '../components/FilterChip.vue'
import SearchResults from '../components/SearchResults.vue'
import SearchStats from '../components/SearchStats.vue'
import ResultContextMenu from '../components/ResultContextMenu.vue'

// Translations
const { $gettext, $ngettext } = useTranslations()

// Props (for saved query route)
const props = defineProps<{
  queryId?: string
}>()

// Composables
const {
  state,
  kqlQuery,
  activeFilters,
  executeSearch,
  loadMore,
  clearFilters,
  removeFilter,
  setViewMode,
  updateStandardFilters,
  updatePhotoFilters,
  setKqlQuery,
  parseKqlToFilters,
  fetchCameraMakes,
  fetchCameraModels,
} = useAdvancedSearch()

const {
  savedQueries,
  saveQuery,
  deleteQuery,
  getQuery,
} = useSearchHistory()

// Local state
const searchTerm = ref('')
const showFilters = ref(true)
const showSavedQueries = ref(false)
const showSaveDialog = ref(false)
const saveQueryName = ref('')

// Context menu state
const contextMenuVisible = ref(false)
const contextMenuItem = ref<Resource | null>(null)
const contextMenuPosition = ref({ x: 0, y: 0 })

// Computed
const loading = computed(() => state.loading)

// URL helper functions
function getServerUrl(): string {
  return ((state as any).serverUrl || window.location.origin).replace(/\/$/, '')
}

function encodePath(path: string): string {
  return path.split('/').map(s => encodeURIComponent(s)).join('/')
}

function buildDavUrl(item: Resource): string {
  const serverUrl = getServerUrl()
  const spaceId = (item as any).spaceId || ''
  const itemPath = (item as any).path || item.name || ''
  return `${serverUrl}/dav/spaces/${encodeURIComponent(spaceId)}${encodePath(itemPath)}`
}

// Watch for search term changes
watch(searchTerm, (newTerm) => {
  state.filters.term = newTerm
})

// Methods
async function handleSearch(): Promise<void> {
  await executeSearch()
}

function handleItemClick(item: Resource): void {
  // Navigate to file location or open preview
  console.log('[AdvancedSearch] Item clicked:', item.name)
  // TODO: Implement file navigation/preview
}

// Context menu functions
function openContextMenu(event: MouseEvent, item: Resource): void {
  event.preventDefault()
  event.stopPropagation()
  contextMenuItem.value = item
  contextMenuPosition.value = { x: event.clientX, y: event.clientY }
  contextMenuVisible.value = true
}

function closeContextMenu(): void {
  contextMenuVisible.value = false
  contextMenuItem.value = null
}

async function handleContextAction(action: string, item: Resource): Promise<void> {
  switch (action) {
    case 'download':
      await downloadItem(item)
      break
    case 'openInFiles':
      openInFiles(item)
      break
    case 'copyLink':
      await copyItemLink(item)
      break
    case 'delete':
      await confirmAndDelete(item)
      break
  }
}

async function downloadItem(item: Resource): Promise<void> {
  try {
    const response = await fetch(buildDavUrl(item), { credentials: 'include' })
    if (!response.ok) throw new Error('Download failed')

    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = item.name || 'download'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch (err) {
    console.error('Failed to download:', err)
    alert('Failed to download file. Please try again.')
  }
}

function openInFiles(item: Resource): void {
  const serverUrl = getServerUrl()
  const fileId = (item as any).fileId || item.id || ''
  const filePath = (item as any).path || item.name || ''
  const driveAlias = (item as any).driveAlias || 'personal/home'

  // Build paths for preview URL
  const fullPath = `${driveAlias}${filePath}`
  const lastSlash = filePath.lastIndexOf('/')
  const folderPath = lastSlash > 0 ? filePath.substring(0, lastSlash) : ''
  const parentId = (item as any).parentReference?.id || (item as any).parentId || ''

  // Build preview URL with context parameters
  const params = new URLSearchParams({
    fileId,
    contextRouteName: 'files-spaces-generic',
    'contextRouteParams.driveAliasAndItem': `${driveAlias}${folderPath}`
  })
  if (parentId) {
    params.set('contextRouteQuery.fileId', parentId)
  }

  window.open(`${serverUrl}/preview/${encodePath(fullPath)}?${params}`, '_blank')
}

async function copyItemLink(item: Resource): Promise<void> {
  try {
    const fileId = (item as any).fileId || item.id || ''
    const link = `${getServerUrl()}/f/${encodeURIComponent(fileId)}`
    await navigator.clipboard.writeText(link)
    alert('Link copied to clipboard!')
  } catch (err) {
    console.error('Failed to copy link:', err)
    alert('Failed to copy link. Please try again.')
  }
}

async function confirmAndDelete(item: Resource): Promise<void> {
  if (!confirm(`Are you sure you want to delete "${item.name}"?`)) return

  try {
    const response = await fetch(buildDavUrl(item), {
      method: 'DELETE',
      credentials: 'include'
    })
    if (!response.ok) throw new Error('Delete failed')
    await executeSearch()
  } catch (err) {
    console.error('Failed to delete:', err)
    alert('Failed to delete file. Please try again.')
  }
}

function loadSavedQuery(query: SavedQuery): void {
  // Deep clone the filters
  state.filters = JSON.parse(JSON.stringify(query.filters))
  searchTerm.value = query.filters.term || ''
  showSavedQueries.value = false
  
  // Execute the search
  executeSearch()
}

function handleSaveQuery(): void {
  if (!saveQueryName.value.trim()) return
  
  saveQuery(saveQueryName.value.trim(), state.filters)
  saveQueryName.value = ''
  showSaveDialog.value = false
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

// KQL input handlers
function onKqlInput(value: string): void {
  setKqlQuery(value)
}

function applyKqlToFilters(): void {
  const currentKql = state.kqlQuery || kqlQuery.value
  parseKqlToFilters(currentKql)
  // Update the search term input to match
  searchTerm.value = state.filters.term || ''
}

// Inject CSS stylesheet (oCIS doesn't auto-load external app CSS)
function injectStylesheet() {
  const styleId = 'advanced-search-styles'
  if (document.getElementById(styleId)) return

  const link = document.createElement('link')
  link.id = styleId
  link.rel = 'stylesheet'
  link.href = '/assets/apps/advanced-search/style.css'
  document.head.appendChild(link)
}

// Load saved query if route param present
onMounted(() => {
  injectStylesheet()

  if (props.queryId) {
    const query = getQuery(props.queryId)
    if (query) {
      loadSavedQuery(query)
    }
  }
})
</script>

<style scoped>
.advanced-search-app {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 1rem;
  background: var(--oc-color-background-default, #fff);
  overflow: auto;
}

/* Header */
.search-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.search-header h1 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
}

/* Search bar */
.search-bar {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.search-input-wrapper {
  flex: 1;
  display: flex;
  gap: 0;
}

.search-input {
  flex: 1;
  padding: 0.75rem 1rem;
  font-size: 1rem;
  border: 1px solid var(--oc-color-border, #ddd);
  border-radius: 4px 0 0 4px;
  outline: none;
}

.search-input:focus {
  border-color: var(--oc-color-primary, #0066cc);
}

.search-btn {
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  background: var(--oc-color-primary, #0066cc);
  color: white;
  border: none;
  border-radius: 0 4px 4px 0;
  cursor: pointer;
}

.search-btn:hover {
  background: var(--oc-color-primary-hover, #0055aa);
}

.search-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.toggle-filters-btn {
  padding: 0.75rem 1rem;
  background: var(--oc-color-background-muted, #f5f5f5);
  border: 1px solid var(--oc-color-border, #ddd);
  border-radius: 4px;
  cursor: pointer;
}

/* Active filters */
.active-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
  align-items: center;
}

.clear-all-btn {
  padding: 0.25rem 0.75rem;
  font-size: 0.875rem;
  background: none;
  border: none;
  color: var(--oc-color-text-muted, #666);
  cursor: pointer;
  text-decoration: underline;
}

.clear-all-btn:hover {
  color: var(--oc-color-text-default, #333);
}

/* Filter panel */
.filters-panel {
  background: var(--oc-color-background-muted, #f9f9f9);
  border: 1px solid var(--oc-color-border, #ddd);
  border-radius: 4px;
  padding: 1rem;
  margin-bottom: 1rem;
}

/* Results section */
.results-section {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--oc-color-border, #ddd);
  margin-bottom: 1rem;
}

.results-count {
  font-weight: 500;
}

.view-controls {
  display: flex;
  gap: 0.25rem;
}

.view-btn {
  width: 2rem;
  height: 2rem;
  background: var(--oc-color-background-muted, #f5f5f5);
  border: 1px solid var(--oc-color-border, #ddd);
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
}

.view-btn.active {
  background: var(--oc-color-primary, #0066cc);
  color: white;
  border-color: var(--oc-color-primary, #0066cc);
}

/* States */
.loading-state,
.error-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  text-align: center;
  color: var(--oc-color-text-muted, #666);
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.empty-hint {
  font-size: 0.875rem;
}

.error-state {
  color: var(--oc-color-danger, #cc0000);
}

.spinner {
  display: inline-block;
  width: 1.5rem;
  height: 1.5rem;
  border: 2px solid #ddd;
  border-top-color: var(--oc-color-primary, #0066cc);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 0.5rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Load more */
.load-more {
  display: flex;
  justify-content: center;
  padding: 1rem;
}

/* Saved queries panel */
.saved-queries-panel {
  position: fixed;
  right: 0;
  top: 0;
  bottom: 0;
  width: 320px;
  background: white;
  box-shadow: -2px 0 8px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #ddd;
}

.panel-header h3 {
  margin: 0;
}

.close-btn {
  width: 2rem;
  height: 2rem;
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #666;
}

.no-saved {
  padding: 2rem;
  text-align: center;
  color: #666;
}

.hint {
  font-size: 0.875rem;
}

.saved-list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  flex: 1;
}

.saved-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #eee;
}

.saved-name {
  flex: 1;
  text-align: left;
  background: none;
  border: none;
  font-size: 0.9375rem;
  cursor: pointer;
  color: var(--oc-color-primary, #0066cc);
}

.saved-name:hover {
  text-decoration: underline;
}

.saved-date {
  font-size: 0.75rem;
  color: #999;
}

.delete-btn {
  background: none;
  border: none;
  cursor: pointer;
  opacity: 0.5;
}

.delete-btn:hover {
  opacity: 1;
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.modal-dialog {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  width: 320px;
  max-width: 90vw;
}

.modal-dialog h3 {
  margin: 0 0 1rem 0;
}

.save-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
  margin-bottom: 1rem;
  box-sizing: border-box;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

/* Buttons */
.btn {
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9375rem;
}

.btn-primary {
  background: var(--oc-color-primary, #0066cc);
  color: white;
  border: none;
}

.btn-primary:hover {
  background: var(--oc-color-primary-hover, #0055aa);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: var(--oc-color-background-muted, #f5f5f5);
  border: 1px solid var(--oc-color-border, #ddd);
  color: var(--oc-color-text-default, #333);
}

.btn-secondary:hover {
  background: #e9e9e9;
}

.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
