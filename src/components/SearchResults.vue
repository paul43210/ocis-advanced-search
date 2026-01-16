<template>
  <div class="search-results" :class="`view-${viewMode}`">
    <!-- List View -->
    <div v-if="viewMode === 'list'" class="results-list">
      <div
        v-for="item in items"
        :key="item.id"
        class="list-item"
        @click="emit('item-click', item)"
      >
        <span class="item-icon">{{ getIcon(item) }}</span>
        <div class="item-details">
          <span class="item-name">{{ item.name }}</span>
          <span class="item-path">{{ getPath(item) }}</span>
        </div>
        <span class="item-size">{{ formatSize(item.size) }}</span>
        <span class="item-date">{{ formatDate(item.mdate) }}</span>
      </div>
    </div>

    <!-- Grid View -->
    <div v-else-if="viewMode === 'grid'" class="results-grid">
      <div
        v-for="item in items"
        :key="item.id"
        class="grid-item"
        @click="emit('item-click', item)"
      >
        <div class="grid-thumbnail">
          <img
            v-if="isImage(item)"
            :src="getThumbnailUrl(item)"
            :alt="item.name"
            loading="lazy"
            @error="handleImageError"
          />
          <span v-else class="grid-icon">{{ getIcon(item) }}</span>
        </div>
        <span class="grid-name">{{ item.name }}</span>
      </div>
    </div>

    <!-- Table View -->
    <table v-else-if="viewMode === 'table'" class="results-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Type</th>
          <th>Size</th>
          <th>Modified</th>
          <th v-if="hasPhotoItems">Camera</th>
          <th v-if="hasPhotoItems">Date Taken</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="item in items"
          :key="item.id"
          @click="emit('item-click', item)"
        >
          <td class="cell-name">
            <span class="item-icon">{{ getIcon(item) }}</span>
            {{ item.name }}
          </td>
          <td>{{ item.mimeType || 'folder' }}</td>
          <td>{{ formatSize(item.size) }}</td>
          <td>{{ formatDate(item.mdate) }}</td>
          <td v-if="hasPhotoItems">{{ getCameraInfo(item) }}</td>
          <td v-if="hasPhotoItems">{{ getPhotoDate(item) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Resource } from '@ownclouders/web-client'
import type { ResultViewMode } from '../types'

const props = defineProps<{
  items: Resource[]
  viewMode: ResultViewMode
}>()

const emit = defineEmits<{
  (e: 'item-click', item: Resource): void
}>()

// Check if any items have photo metadata
const hasPhotoItems = computed(() => {
  return props.items.some(item => item.photo)
})

// Helper functions
function getIcon(item: Resource): string {
  if (item.isFolder || item.type === 'folder') return '📁'
  const mime = item.mimeType || ''
  if (mime.startsWith('image/')) return '🖼️'
  if (mime.startsWith('video/')) return '🎬'
  if (mime.startsWith('audio/')) return '🎵'
  if (mime.includes('pdf')) return '📄'
  if (mime.includes('word') || mime.includes('document')) return '📝'
  if (mime.includes('sheet') || mime.includes('excel')) return '📊'
  if (mime.includes('presentation') || mime.includes('powerpoint')) return '📽️'
  return '📄'
}

function getPath(item: Resource): string {
  // Extract parent path from file path
  const path = (item as any).path || item.name
  const parts = path.split('/')
  parts.pop() // Remove filename
  return parts.join('/') || '/'
}

function formatSize(bytes?: number): string {
  if (!bytes) return '—'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

function isImage(item: Resource): boolean {
  const mime = item.mimeType || ''
  return mime.startsWith('image/')
}

function getThumbnailUrl(item: Resource): string {
  // Use WebDAV preview endpoint
  // This is a simplified version - actual implementation needs authentication
  const spaceId = (item as any).spaceId || ''
  const itemId = item.id || ''
  return `/dav/spaces/${spaceId}/${item.name}?preview=1&x=128&y=128&a=1`
}

function handleImageError(event: Event): void {
  const img = event.target as HTMLImageElement
  img.style.display = 'none'
  // Show fallback icon
  const parent = img.parentElement
  if (parent) {
    const fallback = document.createElement('span')
    fallback.className = 'grid-icon'
    fallback.textContent = '🖼️'
    parent.appendChild(fallback)
  }
}

function getCameraInfo(item: Resource): string {
  if (!item.photo) return '—'
  const make = item.photo.cameraMake || ''
  const model = item.photo.cameraModel || ''
  if (make && model) return `${make} ${model}`
  return make || model || '—'
}

function getPhotoDate(item: Resource): string {
  if (!item.photo?.takenDateTime) return '—'
  return formatDate(item.photo.takenDateTime)
}
</script>

<style scoped>
.search-results {
  flex: 1;
  overflow: auto;
}

/* List View */
.results-list {
  display: flex;
  flex-direction: column;
}

.list-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #eee;
  cursor: pointer;
}

.list-item:hover {
  background: #f5f5f5;
}

.item-icon {
  font-size: 1.25rem;
}

.item-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.item-name {
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-path {
  font-size: 0.75rem;
  color: #888;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-size,
.item-date {
  font-size: 0.8125rem;
  color: #666;
  white-space: nowrap;
}

.item-size {
  width: 80px;
  text-align: right;
}

.item-date {
  width: 100px;
  text-align: right;
}

/* Grid View */
.results-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 1rem;
  padding: 1rem;
}

.grid-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 4px;
}

.grid-item:hover {
  background: #f5f5f5;
}

.grid-thumbnail {
  width: 100px;
  height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f0f0f0;
  border-radius: 4px;
  overflow: hidden;
}

.grid-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.grid-icon {
  font-size: 2.5rem;
}

.grid-name {
  margin-top: 0.5rem;
  font-size: 0.8125rem;
  text-align: center;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Table View */
.results-table {
  width: 100%;
  border-collapse: collapse;
}

.results-table th,
.results-table td {
  padding: 0.75rem 1rem;
  text-align: left;
  border-bottom: 1px solid #eee;
}

.results-table th {
  background: #f9f9f9;
  font-weight: 600;
  font-size: 0.8125rem;
  color: #666;
  position: sticky;
  top: 0;
}

.results-table tr {
  cursor: pointer;
}

.results-table tr:hover {
  background: #f5f5f5;
}

.cell-name {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.cell-name .item-icon {
  font-size: 1rem;
}
</style>
