# oCIS Advanced Search - Architecture

## Overview

This extension provides an advanced search interface for oCIS with comprehensive filter support, including custom photo EXIF metadata fields added to the backend.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        oCIS Web UI                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────┐  ┌──────────────────────────────┐    │
│  │   Advanced Search    │  │       Photo Gallery          │    │
│  │     (This Addon)     │  │    (ocis-photo-addon)        │    │
│  └──────────┬───────────┘  └──────────────┬───────────────┘    │
│             │                              │                    │
│             │     @ownclouders/web-pkg     │                    │
│             │  ┌─────────────────────┐     │                    │
│             └──┤  useSearch()        ├─────┘                    │
│                │  buildSearchTerm()  │                          │
│                └──────────┬──────────┘                          │
│                           │                                      │
└───────────────────────────┼──────────────────────────────────────┘
                            │
                            │ KQL Query
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      oCIS Backend                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────┐      ┌───────────────────────────────┐  │
│  │   WebDAV Search   │      │      Search Service           │  │
│  │   Endpoint        │◄─────┤  (KQL Parser + Bleve Query)   │  │
│  └───────────────────┘      └───────────────┬───────────────┘  │
│                                              │                  │
│                              ┌───────────────▼───────────────┐  │
│                              │        Bleve Index            │  │
│                              │  ┌──────────────────────────┐ │  │
│                              │  │ Standard Fields:         │ │  │
│                              │  │  - Name, Path, Size      │ │  │
│                              │  │  - MimeType, Mtime       │ │  │
│                              │  │  - Tags, Content         │ │  │
│                              │  ├──────────────────────────┤ │  │
│                              │  │ Photo Fields (custom):   │ │  │
│                              │  │  - photo.cameraMake      │ │  │
│                              │  │  - photo.cameraModel     │ │  │
│                              │  │  - photo.takenDateTime   │ │  │
│                              │  │  - photo.iso             │ │  │
│                              │  │  - photo.fNumber         │ │  │
│                              │  │  - photo.focalLength     │ │  │
│                              │  └──────────────────────────┘ │  │
│                              └───────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Component Architecture

```
src/
├── index.ts                    # Extension entry point
│   └── defineWebApplication()  # Registers app in oCIS
│
├── views/
│   └── AdvancedSearchView.vue  # Main view (route: /advanced-search)
│       ├── Search input
│       ├── Filter toggle
│       ├── Active filter chips
│       ├── Filter panel
│       ├── Results display
│       └── Saved queries panel
│
├── components/
│   ├── SearchFilters.vue       # Filter panel component
│   │   ├── Standard filters section
│   │   └── Photo/EXIF filters section
│   │
│   ├── FilterChip.vue          # Active filter display chip
│   │   └── Remove button
│   │
│   └── SearchResults.vue       # Results display
│       ├── List view
│       ├── Grid view
│       └── Table view
│
├── composables/
│   ├── useAdvancedSearch.ts    # Core search logic
│   │   ├── buildKQLQuery()     # Converts filters to KQL
│   │   ├── executeSearch()     # Calls search API
│   │   ├── activeFilters       # Computed filter chips
│   │   └── state management
│   │
│   └── useSearchHistory.ts     # Saved queries
│       ├── saveQuery()
│       ├── deleteQuery()
│       └── localStorage persistence
│
└── types/
    └── index.ts                # TypeScript definitions
        ├── SearchFilters       # Filter state types
        ├── ActiveFilter        # Chip display type
        ├── SearchResults       # Results container
        └── SavedQuery          # Persisted query type
```

## Data Flow

### 1. User Interaction → KQL Query

```
User Input                Filter State               KQL String
───────────             ──────────────              ─────────────
Name: "vacation*"   →   standard.name: "vacation*"  → name:vacation*
Type: "file"        →   standard.type: "file"       → type:file
Media: "image/*"    →   standard.mediaType: "..."   → mediatype:image/*
Camera: "Canon"     →   photo.cameraMake: "Canon"   → photo.cameraMake:Canon
ISO: 100-800        →   photo.isoRange: {min,max}   → photo.iso:[100 TO 800]

Combined: name:vacation* AND type:file AND mediatype:image/* AND photo.cameraMake:Canon AND photo.iso:[100 TO 800]
```

### 2. Search Execution

```
1. User clicks "Search" or presses Enter
2. useAdvancedSearch.executeSearch() is called
3. kqlQuery computed property builds the query string
4. web-pkg's useSearch().search(kql, limit) is called
5. Results are parsed and stored in state.results
6. SearchResults component renders the items
```

### 3. Filter Chip Management

```
activeFilters (computed)
├── Reads from state.filters
├── Creates ActiveFilter objects for each non-empty filter
└── Returns array for FilterChip rendering

removeFilter(filterId)
├── Identifies filter by ID
├── Clears the specific filter in state.filters
└── Reactive update triggers re-render
```

## KQL Query Building

### Standard Fields

| UI Control | Filter Property | KQL Output |
|------------|-----------------|------------|
| Name input | standard.name | `name:*{value}*` |
| Type select | standard.type | `type:{value}` |
| Media type | standard.mediaType | `mediatype:{value}` |
| Size range | standard.sizeRange | `size:[{min} TO {max}]` |
| Modified range | standard.modifiedRange | `mtime:[{start} TO {end}]` |
| Tags input | standard.tags | `tags:{value}` or `(tags:a OR tags:b)` |
| Content input | standard.content | `content:{value}` |

### Photo/EXIF Fields

| UI Control | Filter Property | KQL Output |
|------------|-----------------|------------|
| Camera make | photo.cameraMake | `photo.cameraMake:{value}` |
| Camera model | photo.cameraModel | `photo.cameraModel:{value}` |
| Date taken range | photo.takenDateRange | `photo.takenDateTime:[{start} TO {end}]` |
| ISO range | photo.isoRange | `photo.iso:[{min} TO {max}]` |
| Aperture range | photo.fNumberRange | `photo.fNumber:[{min} TO {max}]` |
| Focal length range | photo.focalLengthRange | `photo.focalLength:[{min} TO {max}]` |

### Escaping Rules

Special characters in values are escaped with backslash:
- `+ - = & | > < ! ( ) { } [ ] ^ " ~ : \ / space`
- Exception: Wildcards `*` and `?` are preserved if they appear intentional

## State Management

### Reactive State (useAdvancedSearch)

```typescript
state = reactive<AdvancedSearchState>({
  filters: SearchFilters,     // Current filter configuration
  results: SearchResults,     // Search results with pagination
  loading: boolean,           // Loading indicator
  error: string | null,       // Error message
  kqlQuery: string,           // Built query (debug display)
  viewMode: ResultViewMode,   // list | grid | table
  sort: SortConfig,           // Sorting configuration
})
```

### Persistence (useSearchHistory)

```typescript
// localStorage key: 'ocis-advanced-search-saved-queries'
SavedQuery[] = [
  {
    id: string,
    name: string,
    filters: SearchFilters,
    savedAt: ISO date string
  }
]
```

## Backend Requirements

This extension requires the custom oCIS build with photo metadata search support:

1. **Bleve Index** must have `Store=true` for photo fields
2. **KQL Parser** must recognize `photo.*` field prefixes
3. **WebDAV Search** must return `oc:photo-*` properties

See: `/home/AIScripts/ocis-upstream/` (branch: `feature/photo-metadata-search`)

## Build & Deployment

### Build Process

```
1. Vite compiles Vue SFC to JavaScript
2. Output is AMD format (anonymous module)
3. CSS is bundled separately
4. manifest.json copied from public/
```

### Deployment Artifacts

```
/data/owncloud/ocis/web/assets/apps/advanced-search/
├── index.js       # AMD module (from dist/index.amd.js)
├── style.css      # Component styles
└── manifest.json  # App manifest
```

### Registration

oCIS auto-discovers extensions in the assets path and registers them in `config.json`:

```json
{
  "external_apps": [
    { "id": "advanced-search", "path": "/assets/apps/advanced-search/index.js" }
  ]
}
```
