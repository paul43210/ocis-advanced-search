<template>
  <div class="filter-control">
    <label class="filter-label">
      <span v-if="filter.icon" class="oc-icon oc-icon-s oc-icon-passive filter-icon">
        <!-- Icon would be rendered here -->
      </span>
      {{ filter.label }}
    </label>
    
    <!-- Text Input -->
    <input
      v-if="filter.type === 'text'"
      type="text"
      class="oc-input filter-input"
      :placeholder="filter.placeholder || 'Enter value...'"
      :value="modelValue"
      @input="emit('update', ($event.target as HTMLInputElement).value)"
    />
    
    <!-- Select Dropdown -->
    <select
      v-else-if="filter.type === 'select'"
      class="oc-select filter-select"
      :value="modelValue || ''"
      @change="emit('update', ($event.target as HTMLSelectElement).value || null)"
    >
      <option value="">{{ filter.placeholder || 'Select...' }}</option>
      <option
        v-for="opt in filter.options"
        :key="opt.value"
        :value="opt.value"
      >
        {{ opt.label }}
      </option>
    </select>
    
    <!-- Multi-Select -->
    <div v-else-if="filter.type === 'multiSelect'" class="multi-select">
      <div
        v-for="opt in filter.options"
        :key="opt.value"
        class="checkbox-item"
      >
        <input
          type="checkbox"
          :id="`${filter.id}-${opt.value}`"
          :checked="(modelValue as string[] || []).includes(opt.value)"
          @change="handleMultiSelectChange(opt.value, ($event.target as HTMLInputElement).checked)"
        />
        <label :for="`${filter.id}-${opt.value}`">{{ opt.label }}</label>
      </div>
    </div>
    
    <!-- Date Range -->
    <div v-else-if="filter.type === 'dateRange'" class="date-range">
      <input
        type="date"
        class="oc-input date-input"
        :value="(modelValue as DateRange)?.from || ''"
        @input="handleDateRangeChange('from', ($event.target as HTMLInputElement).value)"
        placeholder="From"
      />
      <span class="date-separator">to</span>
      <input
        type="date"
        class="oc-input date-input"
        :value="(modelValue as DateRange)?.to || ''"
        @input="handleDateRangeChange('to', ($event.target as HTMLInputElement).value)"
        placeholder="To"
      />
    </div>
    
    <!-- Numeric Range -->
    <div v-else-if="filter.type === 'range'" class="numeric-range">
      <input
        type="number"
        class="oc-input range-input"
        :min="filter.min"
        :max="filter.max"
        :step="filter.step"
        :value="(modelValue as [number, number])?.[0] || filter.min"
        @input="handleRangeChange(0, Number(($event.target as HTMLInputElement).value))"
        placeholder="Min"
      />
      <span class="range-separator">-</span>
      <input
        type="number"
        class="oc-input range-input"
        :min="filter.min"
        :max="filter.max"
        :step="filter.step"
        :value="(modelValue as [number, number])?.[1] || filter.max"
        @input="handleRangeChange(1, Number(($event.target as HTMLInputElement).value))"
        placeholder="Max"
      />
    </div>
    
    <!-- Boolean Toggle -->
    <div v-else-if="filter.type === 'boolean'" class="boolean-toggle">
      <label class="toggle-switch">
        <input
          type="checkbox"
          :checked="modelValue === true"
          @change="emit('update', ($event.target as HTMLInputElement).checked || null)"
        />
        <span class="toggle-slider"></span>
      </label>
      <span class="toggle-label">{{ modelValue ? 'Yes' : 'No' }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SearchFilter, DateRange } from '@/types'

interface Props {
  filter: SearchFilter
  value: unknown
}

const props = defineProps<Props>()
const emit = defineEmits<{
  update: [value: unknown]
}>()

const modelValue = computed(() => props.value)

// Handlers for complex filter types
function handleMultiSelectChange(optValue: string, checked: boolean) {
  const current = (props.value as string[]) || []
  let newValue: string[]
  
  if (checked) {
    newValue = [...current, optValue]
  } else {
    newValue = current.filter(v => v !== optValue)
  }
  
  emit('update', newValue.length > 0 ? newValue : null)
}

function handleDateRangeChange(field: 'from' | 'to', value: string) {
  const current = (props.value as DateRange) || {}
  const newValue = { ...current, [field]: value || undefined }
  
  if (!newValue.from && !newValue.to) {
    emit('update', null)
  } else {
    emit('update', newValue)
  }
}

function handleRangeChange(index: 0 | 1, value: number) {
  const current = (props.value as [number, number]) || [props.filter.min || 0, props.filter.max || 100]
  const newValue: [number, number] = [...current] as [number, number]
  newValue[index] = value
  
  emit('update', newValue)
}
</script>

<script lang="ts">
import { computed } from 'vue'
</script>

<style scoped>
.filter-control {
  margin-bottom: 0.75rem;
}

.filter-label {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: 0.375rem;
  color: var(--oc-color-text-default, #041e42);
}

.filter-icon {
  opacity: 0.6;
}

.filter-input,
.filter-select {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--oc-color-input-border, #788DAB);
  border-radius: 6px;
  font-size: 0.875rem;
  background: var(--oc-color-input-bg, #ffffff);
  color: var(--oc-color-input-text-default, #041e42);
}

.filter-input:focus,
.filter-select:focus {
  outline: none;
  border-color: var(--oc-color-swatch-primary-default, #456FB3);
  box-shadow: 0 0 0 2px rgba(69, 111, 179, 0.2);
}

/* Multi-select */
.multi-select {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.checkbox-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.checkbox-item input {
  width: 1rem;
  height: 1rem;
}

.checkbox-item label {
  font-size: 0.875rem;
  cursor: pointer;
}

/* Date Range */
.date-range {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.date-input {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid var(--oc-color-input-border, #788DAB);
  border-radius: 6px;
  font-size: 0.875rem;
}

.date-separator {
  color: var(--oc-color-text-muted, #4c5f79);
  font-size: 0.875rem;
}

/* Numeric Range */
.numeric-range {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.range-input {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid var(--oc-color-input-border, #788DAB);
  border-radius: 6px;
  font-size: 0.875rem;
  text-align: center;
}

.range-separator {
  color: var(--oc-color-text-muted, #4c5f79);
  font-size: 0.875rem;
}

/* Boolean Toggle */
.boolean-toggle {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  transition: 0.3s;
  border-radius: 24px;
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.3s;
  border-radius: 50%;
}

.toggle-switch input:checked + .toggle-slider {
  background-color: var(--oc-color-swatch-primary-default, #456FB3);
}

.toggle-switch input:checked + .toggle-slider:before {
  transform: translateX(20px);
}

.toggle-label {
  font-size: 0.875rem;
  color: var(--oc-color-text-muted, #4c5f79);
}
</style>
