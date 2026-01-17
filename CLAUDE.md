# CLAUDE.md - Project Instructions for Claude Code

## Session Permissions

- Bash(curl*) - Allow all curl commands without prompting
- Bash(cat*) - Allow all cat commands without prompting
- Bash(echo*) - Allow all echo commands without prompting

## Project Overview

An oCIS web extension that provides an **Advanced Search** interface with comprehensive filter support for all available search fields including photo EXIF metadata. This is a companion to the ocis-photo-addon, reusing patterns and infrastructure.

**Status**: 🚧 **IN DEVELOPMENT** - Initial scaffolding

## Goals

1. Provide an advanced search UI as a standalone app (accessible from app switcher)
2. Support ALL available search filters (standard + photo EXIF fields)
3. Mimic existing oCIS search patterns, buttons, and layout
4. Display results in a familiar file list format
5. Allow saving and loading search queries

## Available Search Fields

### Standard Fields (from oCIS Bleve compiler)
| KQL Field | Bleve Index | Description |
|-----------|-------------|-------------|
| `rootid:` | RootID | Space/root identifier |
| `path:` | Path | File path |
| `id:` | ID | File/item ID |
| `name:` | Name | File name (supports wildcards) |
| `size:` | Size | File size (supports ranges) |
| `mtime:` | Mtime | Modification time |
| `mediatype:` | MimeType | MIME type (e.g., `image/*`) |
| `type:` | Type | File type (file/folder) |
| `tag:` / `tags:` | Tags | Tags/labels |
| `content:` | Content | Full-text content search |
| `hidden:` | Hidden | Hidden file flag |

### Photo/EXIF Fields (from custom oCIS fork)
| KQL Field | Bleve Index | Description |
|-----------|-------------|-------------|
| `photo.cameraMake:` | photo.cameraMake | Camera manufacturer |
| `photo.cameraModel:` | photo.cameraModel | Camera model name |
| `photo.takenDateTime:` | photo.takenDateTime | Photo capture date/time |
| `photo.fNumber:` | photo.fNumber | Aperture f-number |
| `photo.focalLength:` | photo.focalLength | Focal length in mm |
| `photo.iso:` | photo.iso | ISO sensitivity |
| `photo.orientation:` | photo.orientation | Image orientation |
| `photo.exposureNumerator:` | photo.exposureNumerator | Exposure time numerator |
| `photo.exposureDenominator:` | photo.exposureDenominator | Exposure time denominator |

### KQL Query Syntax Examples
```
# Basic text search
name:vacation*

# Media type filter  
mediatype:image/*

# Date range (takenDateTime)
photo.takenDateTime:[2023-01-01 TO 2023-12-31]

# Camera filter
photo.cameraMake:Canon
photo.cameraModel:*R5*

# ISO range
photo.iso:>400
photo.iso:[100 TO 800]

# Aperture
photo.fNumber:<2.8

# Combined query
photo.cameraMake:Canon AND photo.takenDateTime:[2024-01-01 TO 2024-12-31] AND mediatype:image/*

# Tags
tags:exifimported

# Full text content search
content:"annual report"
```

## Environment

- **Development Server**: core-faure.ca (GCP)
- **User**: AIScripts
- **Project Path**: `/home/AIScripts/ocis-advanced-search/`
- **oCIS Instance**: https://cloud.faure.ca
- **oCIS Version**: 7.3.1+dev (custom build with photo metadata search)
- **Extension Deployment Path**: `/data/owncloud/ocis/web/assets/apps/advanced-search/`

### Related Projects
- **Photo-Addon**: `/home/AIScripts/ocis-photo-addon/` - Photo gallery with EXIF support
- **oCIS Fork**: `/home/AIScripts/ocis-upstream/` - Backend with photo metadata search

### oCIS Admin Credentials
```bash
# Credentials stored locally in /root/owncloud_pass
sudo cat /root/owncloud_pass
```

## Technology Stack

- **Language**: TypeScript
- **Framework**: Vue 3 (Composition API)
- **Build Tool**: Vite
- **Package Manager**: pnpm
- **Testing**: Vitest
- **Dependencies**:
  - @ownclouders/web-client (SDK)
  - @ownclouders/web-pkg (composables, components)
  - vue 3.4+

## Critical Build Configuration

### AMD Module Format (REQUIRED)

oCIS web extensions **MUST** use AMD module format (anonymous). See photo-addon for reference.

**vite.config.ts** key settings:
```typescript
build: {
  lib: {
    formats: ['amd']  // NOT 'es'
  },
  rollupOptions: {
    external: ['vue', '@ownclouders/web-pkg', '@ownclouders/web-client', 'vue3-gettext'],
    output: {
      // NO named AMD id - must be anonymous
    }
  }
}
```

## Architecture

```
ocis-advanced-search/
├── src/
│   ├── index.ts                    # Extension entry (defineWebApplication)
│   ├── views/
│   │   └── AdvancedSearchView.vue  # Main search interface
│   ├── components/
│   │   ├── SearchFilters.vue       # Filter panel with all fields
│   │   ├── FilterChip.vue          # Active filter display chip
│   │   ├── DateRangePicker.vue     # Date range selector
│   │   ├── RangeInput.vue          # Numeric range input
│   │   └── SearchResults.vue       # Results display (table/grid)
│   ├── composables/
│   │   ├── useAdvancedSearch.ts    # Search logic & KQL building
│   │   └── useSearchHistory.ts     # Saved queries management
│   └── types/
│       └── index.ts                # TypeScript definitions
├── public/
│   └── manifest.json               # oCIS app manifest
├── package.json
├── vite.config.ts
├── tsconfig.json
└── CLAUDE.md
```

## Key Components

### 1. AdvancedSearchView.vue
Main view that combines:
- Search input field
- Filter panel (collapsible)
- Active filter chips
- Results display
- Pagination

### 2. SearchFilters.vue
Comprehensive filter panel with sections:
- **Basic Filters**: Name, Type, Size range, Date modified
- **Media Filters**: Media type dropdown, Tags
- **Photo/EXIF Filters**: 
  - Camera Make (autocomplete from known values)
  - Camera Model (autocomplete)
  - Date Taken (range picker)
  - ISO (range)
  - Aperture/f-number (range)
  - Focal Length (range)
- **Full-Text**: Content search input

### 3. useAdvancedSearch.ts
Composable that:
- Builds KQL query strings from filter state
- Calls oCIS search API via useSearch from web-pkg
- Handles pagination
- Manages loading/error states

## API Integration

### Using web-pkg's useSearch
```typescript
import { useSearch } from '@ownclouders/web-pkg'

const { search, buildSearchTerm } = useSearch()

// Basic search
const term = buildSearchTerm({
  term: 'vacation',
  mediaType: 'image',
  scope: 'allFiles'
})

const results = await search(term, 100)
```

### Custom KQL for Photo Fields
```typescript
// Build custom KQL for photo fields not in buildSearchTerm
function buildPhotoKQL(filters: PhotoFilters): string {
  const parts: string[] = []
  
  if (filters.cameraMake) {
    parts.push(`photo.cameraMake:${escapeKQL(filters.cameraMake)}`)
  }
  if (filters.dateRange) {
    parts.push(`photo.takenDateTime:[${filters.dateRange.start} TO ${filters.dateRange.end}]`)
  }
  if (filters.isoMin || filters.isoMax) {
    const min = filters.isoMin || '*'
    const max = filters.isoMax || '*'
    parts.push(`photo.iso:[${min} TO ${max}]`)
  }
  // ... etc
  
  return parts.join(' AND ')
}
```

## Development Commands

```bash
# Install dependencies
pnpm install

# Development build (watch mode)
pnpm dev

# Production build
pnpm build

# Run tests
pnpm test:unit

# Type check
pnpm typecheck

# Deploy to server
./deploy.sh
```

## Deployment

```bash
#!/bin/bash
cd /home/AIScripts/ocis-advanced-search
pnpm build
sudo cp dist/index.amd.js /data/owncloud/ocis/web/assets/apps/advanced-search/index.js
sudo cp dist/style.css /data/owncloud/ocis/web/assets/apps/advanced-search/
sudo cp public/manifest.json /data/owncloud/ocis/web/assets/apps/advanced-search/
# No restart needed - just browser refresh
```

## UI/UX Design Goals

1. **Familiar Layout**: Match oCIS search patterns
2. **Progressive Disclosure**: Basic filters visible, advanced collapsed
3. **Active Filter Visibility**: Show active filters as removable chips
4. **Smart Defaults**: Pre-populate common searches
5. **Results Preview**: Show thumbnails for image results
6. **Responsive**: Work on desktop and mobile

## Search Results Display Options

1. **List View**: Traditional file list with columns
2. **Grid View**: Thumbnail grid for images
3. **Table View**: Sortable table with all metadata

## Future Enhancements

- [ ] Save/load search queries
- [ ] Search history with autocomplete
- [ ] Export results to CSV
- [ ] Bulk actions on results
- [ ] Search within search (refine results)
- [ ] Faceted navigation (auto-suggest filters based on results)
- [ ] Integration with photo-addon (open results in PhotoView)
- [ ] Dynamic camera make/model dropdown population (WebDAV doesn't return photo-camera-make property in responses; would need faceted search API or probing approach)

## Known Bugs / Backlog

- [ ] **"Open in Files" fails for non-previewable files**: Clicking "Open" in context menu on files without a preview handler (e.g., .xlsx, .docx) takes user to a spinning page. The preview URL only works for images and other previewable types. Should detect file type and use appropriate URL: preview for images/PDFs, or navigate directly to folder location for other files.

## Resources

- [oCIS Search Documentation](https://doc.owncloud.com/ocis/next/)
- [KQL Syntax (oCIS variant)](https://github.com/owncloud/ocis/tree/master/ocis-pkg/kql)
- [Bleve Query String Syntax](https://blevesearch.com/docs/Query-String-Query/)
- [@ownclouders/web-pkg](https://www.npmjs.com/package/@ownclouders/web-pkg)
- [@ownclouders/web-client](https://www.npmjs.com/package/@ownclouders/web-client)

## GitHub Repository

- **Repository**: https://github.com/paul43210/ocis-advanced-search (to be created)
- **Branch**: `main`
- **License**: Apache-2.0 (same as oCIS)

### GitHub Authentication
```bash
# Set your GitHub token (do not commit tokens to repo)
git remote set-url origin https://${GITHUB_TOKEN}@github.com/paul43210/ocis-advanced-search.git
```
