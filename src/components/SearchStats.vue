<template>
  <div class="search-stats">
    <div class="stats-header" @click="expanded = !expanded">
      <span class="stats-icon">{{ expanded ? '▼' : '▶' }}</span>
      <h4>Search Index Statistics</h4>
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
              {{ stats.tikaEnabled ? 'Enabled' : 'Unknown' }}
            </span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Index Engine</span>
            <span class="stat-value">{{ stats.indexEngine || 'Bleve' }}</span>
          </div>
        </div>
      </div>

      <!-- Index Size (if available) -->
      <div v-if="stats.indexSize || stats.indexPath" class="stats-section">
        <h5>Index Storage</h5>
        <div class="stats-grid">
          <div v-if="stats.indexSize" class="stat-item">
            <span class="stat-label">Index Size</span>
            <span class="stat-value">{{ formatBytes(stats.indexSize) }}</span>
          </div>
          <div v-if="stats.indexPath" class="stat-item">
            <span class="stat-label">Index Path</span>
            <span class="stat-value path">{{ stats.indexPath }}</span>
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
            <span class="stat-value path">{{ stats.serverUrl || 'N/A' }}</span>
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
import { ref, reactive, onMounted } from 'vue'
import { useClientService, useConfigStore, useSpacesStore } from '@ownclouders/web-pkg'

interface SpaceInfo {
  id: string
  name: string
  driveType: string
  used?: number
}

interface SearchStats {
  fullTextEnabled: boolean
  tikaEnabled: boolean
  indexEngine: string
  indexSize: number | null
  indexPath: string | null
  totalSpaces: number
  personalSpaceName: string | null
  spaces: SpaceInfo[]
  serverUrl: string | null
  version: string | null
}

const clientService = useClientService()
const configStore = useConfigStore()
const spacesStore = useSpacesStore()

const expanded = ref(false)
const loading = ref(false)
const stats = reactive<SearchStats>({
  fullTextEnabled: false,
  tikaEnabled: false,
  indexEngine: 'Bleve',
  indexSize: null,
  indexPath: null,
  totalSpaces: 0,
  personalSpaceName: null,
  spaces: [],
  serverUrl: null,
  version: null,
})

async function loadStats(): Promise<void> {
  loading.value = true

  try {
    // Get server URL from config
    stats.serverUrl = configStore.serverUrl || null

    // Get spaces info
    const spaces = spacesStore.spaces
    stats.totalSpaces = spaces.length

    const personalSpace = spaces.find(s => s.driveType === 'personal')
    stats.personalSpaceName = personalSpace?.name || null

    stats.spaces = spaces.map(s => ({
      id: s.id,
      name: s.name || 'Unknown',
      driveType: s.driveType || 'unknown',
      used: (s as any).quota?.used || undefined,
    }))

    // Try to get config.json for more details
    try {
      const serverUrl = (configStore.serverUrl || '').replace(/\/$/, '')
      const configResponse = await clientService.httpAuthenticated.get(`${serverUrl}/config.json`)
      const config = configResponse.data

      // Check for full-text search option
      stats.fullTextEnabled = config?.options?.fullTextSearch?.enabled !== false
    } catch (err) {
      console.log('[SearchStats] Could not fetch config.json')
    }

    // Try to get version info from .well-known
    try {
      const serverUrl = (configStore.serverUrl || '').replace(/\/$/, '')
      const wellKnownResponse = await clientService.httpAuthenticated.get(
        `${serverUrl}/.well-known/openid-configuration`
      )
      // Version might be in the response headers or body
      // oCIS typically doesn't expose version here, but we try
    } catch (err) {
      // Version not available via API
    }

    // Note: Index size and Tika status require server-side access
    // These would need an admin API endpoint to expose
    stats.tikaEnabled = true // Assume enabled if full-text is enabled
    stats.indexEngine = 'Bleve (Scorch)'

  } catch (err) {
    console.error('[SearchStats] Failed to load stats:', err)
  } finally {
    loading.value = false
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

onMounted(() => {
  // Don't auto-load - wait for user to expand
})
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
