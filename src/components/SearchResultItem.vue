<template>
  <div 
    class="search-result-item oc-flex oc-flex-middle"
    @click="emit('click', item)"
    tabindex="0"
    @keydown.enter="emit('click', item)"
  >
    <!-- Thumbnail / Icon -->
    <div class="result-thumbnail">
      <img
        v-if="isImage && thumbnailUrl"
        :src="thumbnailUrl"
        :alt="item.name"
        class="thumbnail-img"
        @error="thumbnailError = true"
      />
      <div v-else class="file-icon" :class="iconClass">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
          <path v-if="isImage" d="M4.828 21l-.02.02-.021-.02H2.992A.993.993 0 0 1 2 20.007V3.993A1 1 0 0 1 2.992 3h18.016c.548 0 .992.445.992.993v16.014a1 1 0 0 1-.992.993H4.828zM20 15V5H4v14L14 9l6 6zm0 2.828l-6-6L6.828 19H20v-1.172zM8 11a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"/>
          <path v-else-if="isVideo" d="M2 3.993A1 1 0 0 1 2.992 3h18.016c.548 0 .992.445.992.993v16.014a1 1 0 0 1-.992.993H2.992A.993.993 0 0 1 2 20.007V3.993zM4 5v14h16V5H4zm6.622 3.415l4.879 3.252a.4.4 0 0 1 0 .666l-4.88 3.252A.4.4 0 0 1 10 12.919V8.08a.4.4 0 0 1 .622-.666z"/>
          <path v-else-if="isAudio" d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
          <path v-else d="M9 2.003V2h10.998C20.55 2 21 2.455 21 2.992v18.016a.993.993 0 0 1-.993.992H3.993A1 1 0 0 1 3 20.993V8l6-5.997zM5.83 8H9V4.83L5.83 8zM11 4v5a1 1 0 0 1-1 1H5v10h14V4h-8z"/>
        </svg>
      </div>
    </div>
    
    <!-- File Info -->
    <div class="result-info">
      <div class="result-name">{{ item.name }}</div>
      <div class="result-meta">
        <span class="result-path">{{ displayPath }}</span>
        <span v-if="item.size" class="result-size">{{ formatSize(item.size) }}</span>
        <span v-if="displayDate" class="result-date">{{ displayDate }}</span>
      </div>
      
      <!-- Photo Metadata -->
      <div v-if="hasPhotoData" class="result-photo-meta">
        <span v-if="item.photo?.cameraMake || item.photo?.cameraModel" class="meta-item">
          <span class="meta-icon">📷</span>
          {{ cameraDisplay }}
        </span>
        <span v-if="item.photo?.fNumber" class="meta-item">
          <span class="meta-icon">⬡</span>
          f/{{ item.photo.fNumber }}
        </span>
        <span v-if="item.photo?.iso" class="meta-item">
          <span class="meta-icon">☀</span>
          ISO {{ item.photo.iso }}
        </span>
        <span v-if="item.location?.latitude" class="meta-item location">
          <span class="meta-icon">📍</span>
          GPS
        </span>
      </div>
    </div>
    
    <!-- Actions -->
    <div class="result-actions">
      <button
        type="button"
        class="oc-button oc-button-s oc-button-passive oc-button-passive-raw"
        @click.stop="emit('click', item)"
        title="Open"
      >
        <span class="oc-icon oc-icon-s">→</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { SearchResult } from '@/types'

interface Props {
  item: SearchResult
}

const props = defineProps<Props>()
const emit = defineEmits<{
  click: [item: SearchResult]
}>()

const thumbnailError = ref(false)

// Computed properties
const isImage = computed(() => props.item.mimeType?.startsWith('image/'))
const isVideo = computed(() => props.item.mimeType?.startsWith('video/'))
const isAudio = computed(() => props.item.mimeType?.startsWith('audio/'))

const iconClass = computed(() => {
  if (isImage.value) return 'icon-image'
  if (isVideo.value) return 'icon-video'
  if (isAudio.value) return 'icon-audio'
  if (props.item.mimeType?.includes('pdf')) return 'icon-pdf'
  return 'icon-file'
})

const thumbnailUrl = computed(() => {
  if (!isImage.value || thumbnailError.value) return null
  // TODO: Generate proper thumbnail URL using oCIS WebDAV
  // For now, return null
  return null
})

const displayPath = computed(() => {
  if (!props.item.path) return ''
  // Remove filename from path
  const parts = props.item.path.split('/')
  parts.pop()
  return parts.join('/') || '/'
})

const displayDate = computed(() => {
  const dateStr = props.item.photo?.takenDateTime || props.item.lastModifiedDateTime
  if (!dateStr) return null
  
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  } catch {
    return null
  }
})

const hasPhotoData = computed(() => {
  return props.item.photo && (
    props.item.photo.cameraMake ||
    props.item.photo.cameraModel ||
    props.item.photo.fNumber ||
    props.item.photo.iso ||
    props.item.location?.latitude
  )
})

const cameraDisplay = computed(() => {
  const make = props.item.photo?.cameraMake || ''
  const model = props.item.photo?.cameraModel || ''
  
  if (make && model) {
    // Avoid duplication like "Samsung Samsung SM-G998B"
    if (model.toLowerCase().includes(make.toLowerCase())) {
      return model
    }
    return `${make} ${model}`
  }
  return make || model || ''
})

// Utility functions
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
}
</script>

<style scoped>
.search-result-item {
  padding: 0.75rem 1rem;
  background: var(--oc-color-background-default, #ffffff);
  border: 1px solid var(--oc-color-border, #ecebee);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  gap: 1rem;
}

.search-result-item:hover {
  background: var(--oc-color-background-hover, rgb(236, 236, 236));
  border-color: var(--oc-color-swatch-primary-default, #456FB3);
}

.search-result-item:focus {
  outline: 2px solid var(--oc-color-swatch-primary-default, #456FB3);
  outline-offset: 2px;
}

/* Thumbnail */
.result-thumbnail {
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  border-radius: 6px;
  overflow: hidden;
  background: var(--oc-color-background-muted, #f8f8f8);
  display: flex;
  align-items: center;
  justify-content: center;
}

.thumbnail-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.file-icon {
  width: 28px;
  height: 28px;
  color: var(--oc-color-text-muted, #4c5f79);
}

.file-icon.icon-image { color: var(--oc-color-icon-image, #ee6b3b); }
.file-icon.icon-video { color: var(--oc-color-icon-video, #045459); }
.file-icon.icon-audio { color: var(--oc-color-icon-audio, #700460); }
.file-icon.icon-pdf { color: var(--oc-color-icon-pdf, #ec0d47); }

/* Info */
.result-info {
  flex: 1;
  min-width: 0;
}

.result-name {
  font-weight: 500;
  color: var(--oc-color-text-default, #041e42);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.result-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.8125rem;
  color: var(--oc-color-text-muted, #4c5f79);
  margin-top: 0.25rem;
}

.result-path {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}

/* Photo Metadata */
.result-photo-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  font-size: 0.75rem;
  color: var(--oc-color-text-muted, #4c5f79);
  margin-top: 0.375rem;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  background: var(--oc-color-background-muted, #f8f8f8);
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
}

.meta-item.location {
  color: var(--oc-color-swatch-success-default, rgb(3, 84, 63));
}

.meta-icon {
  font-size: 0.875rem;
}

/* Actions */
.result-actions {
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.search-result-item:hover .result-actions {
  opacity: 1;
}
</style>
