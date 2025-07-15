# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a FoundryVTT pathfinding library that provides sophisticated routing capabilities for tokens navigating around walls and obstacles. It's a hybrid JavaScript/Rust architecture with WebAssembly for performance-critical pathfinding algorithms.

## Essential Commands

### Development Setup
```bash
# Install Rust WebAssembly dependencies
./install_dev_dependencies.sh

# Build WASM for development (with file watching)
./build_wasm.py --debug

# Build production release
./build_release.py
```

### Testing and Validation
- No automated test suite exists
- Use the interactive test: `/macros/testRouting.js`
- API comparison test: `/macros/api_comparison_test.js`
- Always test pathfinding behavior after code changes

## Architecture Overview

### Hybrid JavaScript/Rust Design
- **JavaScript layer** (`/js/`): FoundryVTT integration, caching, async job management
- **Rust/WASM layer** (`/rust/src/`): High-performance pathfinding algorithms
- **Entry point**: `js/main.js` exposes API via `window.routinglib`

### Key Components
- **`pathfinder.js`**: GriddedPathfinder and GridlessPathfinder classes
- **`cache.js`**: Wall and graph caching system - critical for performance
- **`background.js`**: Async pathfinding job queue management
- **`foundry_fixes.js`**: Compatibility layer for FoundryVTT API changes
- **`js_api.rs`**: JavaScript-Rust interface definitions

### Coordinate System Complexity
- **Gridded scenes**: Coordinates in grid cells
- **Gridless scenes**: Coordinates in pixels
- **Current work**: `fix-coordinates-v2` branch addressing coordinate system issues
- Use `pixelToGrid()` and `gridToPixel()` utilities for conversions

## Critical Development Patterns

### WASM Integration
- Rust code compiles to WebAssembly for performance
- Use `wasm-bindgen` for JavaScript interop
- Always rebuild WASM after Rust changes: `./build_wasm.py`
- WASM module loaded asynchronously in `main.js`

### Caching Strategy
- Walls, graphs, and paths are aggressively cached
- Cache invalidation happens on scene changes
- Performance depends heavily on effective caching

### Async Pathfinding
- Long pathfinding operations run in background
- Use promises for non-blocking calculations
- Cancel operations with `cancelPathfinding(promise)`

## Current Limitations and Known Issues

### Token Movement Constraints
- Even-sized tokens cannot squeeze through 1-square hallways
- This is a fundamental architectural limitation being addressed in roadmaps

### Coordinate System Issues
- Active development on `fix-coordinates-v2` branch
- FoundryVTT v12+ deprecation warnings being resolved
- Test coordinate conversions thoroughly

## Future Architecture (Roadmaps)

### Internal Grid System
- Planned 4x subdivision grid for better narrow passage navigation
- Will replace Foundry's native grid with higher resolution internal system
- See `/INTERNAL_GRID_SYSTEM_ROADMAP.md`

### Multi-Scale Pathfinding
- Research-based hierarchical A* implementation planned
- Performance optimization for large maps
- See `/MULTISCALE_PATHFINDING_ROADMAP.md`

## API Design Principles

### Public API Pattern
```javascript
// All API exposed via window.routinglib
calculatePath(from, to, options)           // Async
calculatePathBlocking(from, to, options)   // Blocking
```

### Options Object Structure
- Consistent options pattern across all pathfinding functions
- Token size, elevation, difficult terrain support
- Debug mode for development

## Debugging and Development

### Debug Utilities
- `enableDebugForPositions(positions)` - Visual debugging
- `disableDebug()` - Clean up debug visuals
- Interactive test macro for manual verification

### Common Debug Patterns
- Always check coordinate system first for movement issues
- Verify wall cache invalidation for scene changes
- Test with different token sizes and elevation scenarios

## Integration Guidelines

### FoundryVTT Module Integration
- Designed to be imported by other modules
- Follows FoundryVTT module conventions
- Uses Foundry hooks for lifecycle management

### Performance Considerations
- WASM provides significant performance boost for complex pathfinding
- Cache effectiveness is critical - monitor cache hit rates
- Background processing prevents UI blocking