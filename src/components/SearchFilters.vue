<template>
  <div class="search-filters">
    <!-- Standard Filters Section -->
    <div class="filter-section">
      <h4 class="section-title" @click="showStandard = !showStandard">
        {{ showStandard ? '▼' : '▶' }} Standard Filters
      </h4>
      
      <div v-if="showStandard" class="filter-group">
        <!-- Name -->
        <div class="filter-row">
          <label>Name</label>
          <input
            type="text"
            :value="filters.standard.name || ''"
            @input="emit('update:standard', { ...filters.standard, name: ($event.target as HTMLInputElement).value || undefined })"
            placeholder="File name (wildcards: * ?)"
          />
        </div>

        <!-- Type -->
        <div class="filter-row">
          <label>Type</label>
          <select
            :value="filters.standard.type || ''"
            @change="emit('update:standard', { ...filters.standard, type: ($event.target as HTMLSelectElement).value as '' | 'file' | 'folder' })"
          >
            <option value="">All</option>
            <option value="file">Files only</option>
            <option value="folder">Folders only</option>
          </select>
        </div>

        <!-- Media Type -->
        <div class="filter-row">
          <label>Media Type</label>
          <select
            :value="filters.standard.mediaType || ''"
            @change="emit('update:standard', { ...filters.standard, mediaType: ($event.target as HTMLSelectElement).value || undefined })"
          >
            <option v-for="mt in mediaTypes" :key="mt.value" :value="mt.value">
              {{ mt.label }}
            </option>
          </select>
        </div>

        <!-- Size Range -->
        <div class="filter-row">
          <label>Size</label>
          <div class="range-inputs">
            <input
              type="number"
              :value="filters.standard.sizeRange?.min || ''"
              @input="updateSizeRange('min', ($event.target as HTMLInputElement).value)"
              placeholder="Min (bytes)"
              min="0"
            />
            <span>to</span>
            <input
              type="number"
              :value="filters.standard.sizeRange?.max || ''"
              @input="updateSizeRange('max', ($event.target as HTMLInputElement).value)"
              placeholder="Max (bytes)"
              min="0"
            />
          </div>
        </div>

        <!-- Modified Date -->
        <div class="filter-row">
          <label>Modified</label>
          <div class="range-inputs">
            <input
              type="date"
              :value="filters.standard.modifiedRange?.start || ''"
              @input="updateModifiedRange('start', ($event.target as HTMLInputElement).value)"
            />
            <span>to</span>
            <input
              type="date"
              :value="filters.standard.modifiedRange?.end || ''"
              @input="updateModifiedRange('end', ($event.target as HTMLInputElement).value)"
            />
          </div>
        </div>

        <!-- Tags -->
        <div class="filter-row">
          <label>Tags</label>
          <input
            type="text"
            :value="filters.standard.tags || ''"
            @input="emit('update:standard', { ...filters.standard, tags: ($event.target as HTMLInputElement).value || undefined })"
            placeholder="Comma-separated tags"
          />
        </div>

        <!-- Content -->
        <div class="filter-row">
          <label>Content</label>
          <input
            type="text"
            :value="filters.standard.content || ''"
            @input="emit('update:standard', { ...filters.standard, content: ($event.target as HTMLInputElement).value || undefined })"
            placeholder="Full-text content search"
          />
        </div>
      </div>
    </div>

    <!-- Photo/EXIF Filters Section -->
    <div class="filter-section">
      <h4 class="section-title" @click="showPhoto = !showPhoto">
        {{ showPhoto ? '▼' : '▶' }} Photo / EXIF Filters
      </h4>
      
      <div v-if="showPhoto" class="filter-group">
        <!-- Camera Make -->
        <div class="filter-row">
          <label>Camera Make</label>
          <input
            type="text"
            :value="filters.photo.cameraMake || ''"
            @input="emit('update:photo', { ...filters.photo, cameraMake: ($event.target as HTMLInputElement).value || undefined })"
            placeholder="e.g., Canon, Nikon, samsung"
            list="camera-makes"
          />
          <datalist id="camera-makes">
            <option v-for="make in cameraMakes" :key="make" :value="make" />
          </datalist>
        </div>

        <!-- Camera Model -->
        <div class="filter-row">
          <label>Camera Model</label>
          <input
            type="text"
            :value="filters.photo.cameraModel || ''"
            @input="emit('update:photo', { ...filters.photo, cameraModel: ($event.target as HTMLInputElement).value || undefined })"
            placeholder="e.g., EOS R5, SM-G998B"
          />
        </div>

        <!-- Date Taken -->
        <div class="filter-row">
          <label>Date Taken</label>
          <div class="range-inputs">
            <input
              type="date"
              :value="filters.photo.takenDateRange?.start || ''"
              @input="updateTakenDateRange('start', ($event.target as HTMLInputElement).value)"
            />
            <span>to</span>
            <input
              type="date"
              :value="filters.photo.takenDateRange?.end || ''"
              @input="updateTakenDateRange('end', ($event.target as HTMLInputElement).value)"
            />
          </div>
        </div>

        <!-- ISO -->
        <div class="filter-row">
          <label>ISO</label>
          <div class="range-inputs">
            <input
              type="number"
              :value="filters.photo.isoRange?.min || ''"
              @input="updateIsoRange('min', ($event.target as HTMLInputElement).value)"
              placeholder="Min"
              min="0"
            />
            <span>to</span>
            <input
              type="number"
              :value="filters.photo.isoRange?.max || ''"
              @input="updateIsoRange('max', ($event.target as HTMLInputElement).value)"
              placeholder="Max"
              min="0"
            />
          </div>
        </div>

        <!-- Aperture -->
        <div class="filter-row">
          <label>Aperture (f/)</label>
          <div class="range-inputs">
            <input
              type="number"
              step="0.1"
              :value="filters.photo.fNumberRange?.min || ''"
              @input="updateFNumberRange('min', ($event.target as HTMLInputElement).value)"
              placeholder="Min"
              min="0"
            />
            <span>to</span>
            <input
              type="number"
              step="0.1"
              :value="filters.photo.fNumberRange?.max || ''"
              @input="updateFNumberRange('max', ($event.target as HTMLInputElement).value)"
              placeholder="Max"
              min="0"
            />
          </div>
        </div>

        <!-- Focal Length -->
        <div class="filter-row">
          <label>Focal Length (mm)</label>
          <div class="range-inputs">
            <input
              type="number"
              :value="filters.photo.focalLengthRange?.min || ''"
              @input="updateFocalLengthRange('min', ($event.target as HTMLInputElement).value)"
              placeholder="Min"
              min="0"
            />
            <span>to</span>
            <input
              type="number"
              :value="filters.photo.focalLengthRange?.max || ''"
              @input="updateFocalLengthRange('max', ($event.target as HTMLInputElement).value)"
              placeholder="Max"
              min="0"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { SearchFilters } from '../types'
import { KNOWN_CAMERA_MAKES, COMMON_MEDIA_TYPES } from '../types'

const props = defineProps<{
  filters: SearchFilters
}>()

const emit = defineEmits<{
  (e: 'update:standard', value: SearchFilters['standard']): void
  (e: 'update:photo', value: SearchFilters['photo']): void
}>()

// Local state for section collapse
const showStandard = ref(true)
const showPhoto = ref(false)

// Data for dropdowns
const cameraMakes = KNOWN_CAMERA_MAKES
const mediaTypes = COMMON_MEDIA_TYPES

// Helper functions for range updates
function updateSizeRange(field: 'min' | 'max', value: string): void {
  const numValue = value ? parseInt(value, 10) : undefined
  const current = props.filters.standard.sizeRange || {}
  emit('update:standard', {
    ...props.filters.standard,
    sizeRange: { ...current, [field]: numValue }
  })
}

function updateModifiedRange(field: 'start' | 'end', value: string): void {
  const current = props.filters.standard.modifiedRange || { start: '', end: '' }
  emit('update:standard', {
    ...props.filters.standard,
    modifiedRange: { ...current, [field]: value || '' }
  })
}

function updateTakenDateRange(field: 'start' | 'end', value: string): void {
  const current = props.filters.photo.takenDateRange || { start: '', end: '' }
  emit('update:photo', {
    ...props.filters.photo,
    takenDateRange: { ...current, [field]: value || '' }
  })
}

function updateIsoRange(field: 'min' | 'max', value: string): void {
  const numValue = value ? parseInt(value, 10) : undefined
  const current = props.filters.photo.isoRange || {}
  emit('update:photo', {
    ...props.filters.photo,
    isoRange: { ...current, [field]: numValue }
  })
}

function updateFNumberRange(field: 'min' | 'max', value: string): void {
  const numValue = value ? parseFloat(value) : undefined
  const current = props.filters.photo.fNumberRange || {}
  emit('update:photo', {
    ...props.filters.photo,
    fNumberRange: { ...current, [field]: numValue }
  })
}

function updateFocalLengthRange(field: 'min' | 'max', value: string): void {
  const numValue = value ? parseFloat(value) : undefined
  const current = props.filters.photo.focalLengthRange || {}
  emit('update:photo', {
    ...props.filters.photo,
    focalLengthRange: { ...current, [field]: numValue }
  })
}
</script>

<style scoped>
.search-filters {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.filter-section {
  border-bottom: 1px solid #e0e0e0;
  padding-bottom: 1rem;
}

.filter-section:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.section-title {
  margin: 0 0 0.75rem 0;
  font-size: 0.9375rem;
  font-weight: 600;
  color: #333;
  cursor: pointer;
  user-select: none;
}

.section-title:hover {
  color: var(--oc-color-primary, #0066cc);
}

.filter-group {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 0.75rem;
}

.filter-row {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.filter-row label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: #666;
}

.filter-row input,
.filter-row select {
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.875rem;
}

.filter-row input:focus,
.filter-row select:focus {
  outline: none;
  border-color: var(--oc-color-primary, #0066cc);
}

.range-inputs {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.range-inputs input {
  flex: 1;
  min-width: 0;
}

.range-inputs span {
  color: #999;
  font-size: 0.8125rem;
}
</style>
