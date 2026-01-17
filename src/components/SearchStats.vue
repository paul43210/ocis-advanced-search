<template>
  <div class="search-stats">
    <div class="stats-header" @click="toggleExpanded">
      <span class="stats-icon">{{ expanded ? '▼' : '▶' }}</span>
      <h4>Search Status</h4>
      <span v-if="loading" class="loading-indicator">Loading...</span>
    </div>

    <div v-if="expanded" class="stats-content">
      <!-- Index Status -->
      <div class="stats-section">
        <h5>Index Status</h5>
        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-label">Full-Text Search</span>
            <span :class="['stat-value', stats.fullTextEnabled ? 'enabled' : 'disabled']">
              {{ stats.fullTextEnabled ? 'Enabled' : 'Disabled' }}
            </span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Tika Extraction</span>
            <span :class="['stat-value', stats.tikaEnabled ? 'enabled' : 'disabled']">
              {{ stats.tikaEnabled ? 'Enabled' : 'Disabled' }}
            </span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Index Engine</span>
            <span class="stat-value">{{ stats.indexEngine }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Total Indexed Files</span>
            <span class="stat-value">{{ stats.totalIndexedFiles !== null ? stats.totalIndexedFiles.toLocaleString() : 'Counting...' }}</span>
          </div>
        </div>
      </div>

      <!-- Space Stats -->
      <div class="stats-section">
        <h5>Available Spaces</h5>
        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-label">Total Spaces</span>
            <span class="stat-value">{{ stats.totalSpaces }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Personal Space</span>
            <span class="stat-value">{{ stats.personalSpaceName || 'N/A' }}</span>
          </div>
        </div>
        <div v-if="stats.spaces && stats.spaces.length > 0" class="spaces-list">
          <div v-for="space in stats.spaces" :key="space.id" class="space-item">
            <span class="space-icon">{{ getSpaceIcon(space.driveType) }}</span>
            <span class="space-name">{{ space.name }}</span>
            <span class="space-type">{{ space.driveType }}</span>
            <span v-if="space.used" class="space-used">{{ formatBytes(space.used) }} used</span>
          </div>
        </div>
      </div>

      <!-- Server Info -->
      <div class="stats-section">
        <h5>Server Information</h5>
        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-label">Server URL</span>
            <span class="stat-value path">{{ stats.serverUrl }}</span>
          </div>
          <div v-if="stats.version" class="stat-item">
            <span class="stat-label">oCIS Version</span>
            <span class="stat-value">{{ stats.version }}</span>
          </div>
        </div>
      </div>

      <!-- Refresh Button -->
      <div class="stats-actions">
        <button class="refresh-btn" @click="loadStats" :disabled="loading">
          {{ loading ? 'Loading...' : 'Refresh Stats' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { useClientService, useConfigStore, useSpacesStore } from '@ownclouders/web-pkg'

interface SpaceInfo {
  id: string
  name: string
  driveType: string
  used?: number
}

interface SearchStatsData {
  fullTextEnabled: boolean
  tikaEnabled: boolean
  indexEngine: string
  totalIndexedFiles: number | null
  totalSpaces: number
  personalSpaceName: string | null
  spaces: SpaceInfo[]
  serverUrl: string
  version: string | null
}

const clientService = useClientService()
const configStore = useConfigStore()
const spacesStore = useSpacesStore()

const expanded = ref(false)
const loading = ref(false)
const stats = reactive<SearchStatsData>({
  fullTextEnabled: false,
  tikaEnabled: false,
  indexEngine: 'Bleve (Scorch)',
  totalIndexedFiles: null,
  totalSpaces: 0,
  personalSpaceName: null,
  spaces: [],
  serverUrl: '',
  version: null,
})

// Watch for expansion and load stats
watch(expanded, (isExpanded) => {
  if (isExpanded && stats.totalSpaces === 0) {
    loadStats()
  }
})

function toggleExpanded() {
  expanded.value = !expanded.value
}

async function loadStats(): Promise<void> {
  loading.value = true

  try {
    // Get server URL - try configStore first, then derive from window location
    let serverUrl = configStore.serverUrl || ''
    if (!serverUrl && typeof window !== 'undefined') {
      serverUrl = window.location.origin
    }
    serverUrl = serverUrl.replace(/\/$/, '')
    stats.serverUrl = serverUrl

    // Fetch spaces via Graph API
    try {
      const graphResponse = await clientService.httpAuthenticated.get(
        `${serverUrl}/graph/v1.0/me/drives`
      )
      const drives = graphResponse.data?.value || []

      stats.totalSpaces = drives.length
      stats.spaces = drives.map((d: any) => ({
        id: d.id,
        name: d.name || 'Unknown',
        driveType: d.driveType || 'unknown',
        used: d.quota?.used || undefined,
      }))

      const personalSpace = drives.find((d: any) => d.driveType === 'personal')
      stats.personalSpaceName = personalSpace?.name || null

      console.log('[SearchStats] Spaces loaded:', stats.spaces.length)
    } catch (err) {
      console.error('[SearchStats] Failed to fetch spaces via Graph API:', err)
      // Fall back to spacesStore if available
      const spaces = spacesStore.spaces || []
      stats.totalSpaces = spaces.length
      stats.spaces = spaces.map(s => ({
        id: s.id,
        name: s.name || 'Unknown',
        driveType: s.driveType || 'unknown',
        used: (s as any).quota?.used || undefined,
      }))
      const personalSpace = spaces.find(s => s.driveType === 'personal')
      stats.personalSpaceName = personalSpace?.name || null
    }

    // Try to get config.json for full-text search and Tika status
    try {
      const configResponse = await clientService.httpAuthenticated.get(`${serverUrl}/config.json`)
      const config = configResponse.data

      // Check for full-text search option
      if (config?.options?.fullTextSearch) {
        stats.fullTextEnabled = config.options.fullTextSearch.enabled !== false
      } else {
        // Default to enabled if not specified
        stats.fullTextEnabled = true
      }

      // Check for Tika in config (oCIS exposes this if configured)
      // The presence of fullTextSearch usually means Tika is enabled
      stats.tikaEnabled = stats.fullTextEnabled

      console.log('[SearchStats] Config loaded:', { fullText: stats.fullTextEnabled })
    } catch (err) {
      console.log('[SearchStats] Could not fetch config.json, assuming defaults')
      stats.fullTextEnabled = true
      stats.tikaEnabled = true
    }

    // Try to get version from capabilities
    try {
      const capabilitiesResponse = await clientService.httpAuthenticated.get(
        `${serverUrl}/ocs/v1.php/cloud/capabilities?format=json`
      )
      const capabilities = capabilitiesResponse.data?.ocs?.data
      if (capabilities?.version?.string) {
        stats.version = capabilities.version.string
      } else if (capabilities?.version?.major) {
        stats.version = `${capabilities.version.major}.${capabilities.version.minor}.${capabilities.version.micro}`
      }
    } catch (err) {
      console.log('[SearchStats] Could not fetch capabilities')
    }

    // Count total indexed files by doing a wildcard search
    await countIndexedFiles(serverUrl)

  } catch (err) {
    console.error('[SearchStats] Failed to load stats:', err)
  } finally {
    loading.value = false
  }
}

async function countIndexedFiles(serverUrl: string): Promise<void> {
  try {
    // Find the personal space for searching
    const personalSpace = stats.spaces.find(s => s.driveType === 'personal') || stats.spaces[0]

    if (!personalSpace) {
      console.log('[SearchStats] No space available for file count')
      return
    }

    // Do a search with * to count all indexed files
    // Use a large limit to get total count
    const searchBody = `<?xml version="1.0" encoding="UTF-8"?>
<oc:search-files xmlns:oc="http://owncloud.org/ns" xmlns:d="DAV:">
  <oc:search>
    <oc:pattern>*</oc:pattern>
    <oc:limit>10000</oc:limit>
  </oc:search>
  <d:prop>
    <oc:fileid/>
  </d:prop>
</oc:search-files>`

    const response = await clientService.httpAuthenticated.request({
      method: 'REPORT',
      url: `${serverUrl}/dav/spaces/${encodeURIComponent(personalSpace.id)}`,
      headers: {
        'Content-Type': 'application/xml'
      },
      data: searchBody
    })

    // Count <d:response> elements
    const xmlText = typeof response.data === 'string'
      ? response.data
      : new XMLSerializer().serializeToString(response.data)

    const responseMatches = xmlText.match(/<d:response>/gi) || []
    stats.totalIndexedFiles = responseMatches.length

    console.log('[SearchStats] Indexed files count:', stats.totalIndexedFiles)
  } catch (err) {
    console.error('[SearchStats] Failed to count indexed files:', err)
    stats.totalIndexedFiles = null
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function getSpaceIcon(driveType: string): string {
  switch (driveType) {
    case 'personal': return '👤'
    case 'project': return '📁'
    case 'virtual': return '🔗'
    case 'share': return '🤝'
    default: return '📂'
  }
}
</script>

<style scoped>
.search-stats {
  margin-top: 1rem;
  border: 1px solid var(--oc-color-border, #ddd);
  border-radius: 4px;
  background: var(--oc-color-background-muted, #f9f9f9);
}

.stats-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  cursor: pointer;
  user-select: none;
}

.stats-header:hover {
  background: var(--oc-color-background-hover, #f0f0f0);
}

.stats-header h4 {
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 600;
  flex: 1;
}

.stats-icon {
  font-size: 0.75rem;
  color: #666;
}

.loading-indicator {
  font-size: 0.75rem;
  color: var(--oc-color-primary, #0066cc);
}

.stats-content {
  padding: 0 1rem 1rem;
  border-top: 1px solid var(--oc-color-border, #ddd);
}

.stats-section {
  margin-top: 1rem;
}

.stats-section h5 {
  margin: 0 0 0.5rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.75rem;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.5rem;
  background: white;
  border-radius: 4px;
  border: 1px solid #e0e0e0;
}

.stat-label {
  font-size: 0.75rem;
  color: #888;
  font-weight: 500;
}

.stat-value {
  font-size: 0.9375rem;
  font-weight: 600;
  color: #333;
}

.stat-value.enabled {
  color: #2e7d32;
}

.stat-value.disabled {
  color: #c62828;
}

.stat-value.path {
  font-family: monospace;
  font-size: 0.8125rem;
  word-break: break-all;
}

.spaces-list {
  margin-top: 0.5rem;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  background: white;
  max-height: 200px;
  overflow-y: auto;
}

.space-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid #f0f0f0;
  font-size: 0.875rem;
}

.space-item:last-child {
  border-bottom: none;
}

.space-icon {
  font-size: 1rem;
}

.space-name {
  flex: 1;
  font-weight: 500;
}

.space-type {
  font-size: 0.75rem;
  color: #888;
  padding: 0.125rem 0.5rem;
  background: #f0f0f0;
  border-radius: 10px;
}

.space-used {
  font-size: 0.75rem;
  color: #666;
}

.stats-actions {
  margin-top: 1rem;
  display: flex;
  justify-content: flex-end;
}

.refresh-btn {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  background: var(--oc-color-primary, #0066cc);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.refresh-btn:hover {
  background: var(--oc-color-primary-hover, #0055aa);
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
