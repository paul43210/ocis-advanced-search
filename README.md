# oCIS Advanced Search

An ownCloud Infinite Scale (oCIS) web extension providing an advanced search interface with comprehensive filter support for all available search fields including photo EXIF metadata.

## Features

- **Full Filter Support**: Access all oCIS search fields including custom photo/EXIF fields
- **Visual Filter Builder**: Easy-to-use UI for building complex queries
- **Photo EXIF Filters**: Search by camera make/model, ISO, aperture, focal length, date taken
- **Active Filter Chips**: See and manage active filters at a glance
- **Multiple Result Views**: List, grid, or table view for results
- **Saved Searches**: Save and reload frequently used queries

## Requirements

- oCIS 7.x with photo metadata search support (custom fork)
- Node.js 18+
- pnpm 9+

## Installation

```bash
# Clone the repository
git clone https://github.com/paul43210/ocis-advanced-search.git
cd ocis-advanced-search

# Install dependencies
pnpm install

# Build the extension
pnpm build

# Deploy to oCIS
cp dist/index.amd.js /data/owncloud/ocis/web/assets/apps/advanced-search/index.js
cp dist/style.css /data/owncloud/ocis/web/assets/apps/advanced-search/
cp public/manifest.json /data/owncloud/ocis/web/assets/apps/advanced-search/
```

## Supported Search Fields

### Standard Fields
- Name (with wildcards)
- File type (file/folder)
- Size (range)
- Modified date
- Media type (MIME)
- Tags
- Full-text content

### Photo/EXIF Fields (requires custom oCIS build)
- Camera Make
- Camera Model
- Date Taken (takenDateTime)
- ISO
- Aperture (f-number)
- Focal Length
- Exposure Time
- Orientation

## KQL Query Examples

```
# Search by camera
photo.cameraMake:Canon

# Date range
photo.takenDateTime:[2024-01-01 TO 2024-12-31]

# ISO range
photo.iso:[100 TO 800]

# Combined query
photo.cameraMake:Canon AND photo.iso:<400 AND mediatype:image/*
```

## Development

```bash
# Development mode with watch
pnpm dev

# Run tests
pnpm test:unit

# Type checking
pnpm typecheck

# Lint
pnpm lint
```

## Related Projects

- [ocis-photo-addon](https://github.com/paul43210/ocis-photo-addon) - Photo gallery with EXIF display
- [oCIS Fork](https://github.com/paul43210/ocis) - Backend with photo metadata search

## License

Apache-2.0

## Author

Paul Faure <paul@faure.ca>
