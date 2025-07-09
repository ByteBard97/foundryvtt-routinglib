# Internal Grid System Implementation Roadmap

## 🎯 **Objective**: Implement 4x Subdivision Grid System

Replace Foundry's native grid resolution with an internal grid system that operates at 4x higher resolution for better pathfinding around narrow obstacles.

```
Foundry Grid:  70×70 pixel squares
Internal Grid: 17.5×17.5 pixel squares (4x subdivision)
Search Space:  4×4 = 16 nodes per original Foundry square
```

---

## 🔍 **Current Foundry Grid Dependencies Analysis**

### **Direct Grid API Usage Locations:**

#### **1. js/cache.js - GriddedCache**
```javascript
// LINE 273-284: Grid dimension calculations
this.gridWidth = Math.ceil(canvas.dimensions.width / canvas.grid.sizeX);
this.gridHeight = Math.ceil(canvas.dimensions.height / canvas.grid.sizeY);

// ISSUE: Directly uses Foundry's grid.sizeX/sizeY
// REPLACEMENT NEEDED: Use internal grid calculations
```

#### **2. js/cache.js - Node neighbor detection**
```javascript
// LINE 318-320: Adjacent position calculations
const adjacentOffsets = isSquareGrid ? 
  [{x: -1, y: -1}, {x: 0, y: -1}, {x: 1, y: -1}, ...] :
  canvas.grid.getAdjacentOffsets({i: pos.x, j: pos.y})

// ISSUE: Uses Foundry's adjacency logic
// REPLACEMENT NEEDED: Internal adjacency system
```

#### **3. js/foundry_fixes.js - Coordinate conversions**
```javascript
// Grid position to pixel conversion
export function getPixelsFromGridPositionObj(gridPosition) 
export function getCenterFromGridPositionObj(gridPosition)

// ISSUE: Core coordinate conversion between grid and pixels
// REPLACEMENT NEEDED: Internal grid coordinate system
```

#### **4. js/pathfinder.js - Grid boundary checks**
```javascript
// LINE 41-42: Grid dimension usage
this.gridWidth = Math.ceil(canvas.dimensions.width / canvas.grid.sizeX);
this.gridHeight = Math.ceil(canvas.dimensions.height / canvas.grid.sizeY);

// ISSUE: Pathfinder uses Foundry grid dimensions
// REPLACEMENT NEEDED: Internal grid dimensions
```

#### **5. js/cache.js - Collision detection coordinate conversion**
```javascript
// LINE 448: stepCollidesWithWall coordinate conversion
const stepStart = getSnapPointForTokenDataObj(getPixelsFromGridPositionObj(from), tokenData);
const stepEnd = getSnapPointForTokenDataObj(getPixelsFromGridPositionObj(to), tokenData);

// ISSUE: Uses Foundry grid-to-pixel conversion
// REPLACEMENT NEEDED: Internal grid-to-pixel conversion
```

---

## 🛠️ **Required Helper Methods**

### **1. Core Coordinate Conversion System**

#### **File: `js/internal_grid.js` (NEW)**
```javascript
// Grid subdivision factor
export const INTERNAL_SUBDIVISION_FACTOR = 4;

/**
 * Convert Foundry grid coordinates to internal grid coordinates
 * @param {number} foundryX - Foundry grid X coordinate
 * @param {number} foundryY - Foundry grid Y coordinate  
 * @returns {{x: number, y: number}} Internal grid coordinates
 */
export function foundryToInternal(foundryX, foundryY) {
    return {
        x: foundryX * INTERNAL_SUBDIVISION_FACTOR,
        y: foundryY * INTERNAL_SUBDIVISION_FACTOR
    };
}

/**
 * Convert internal grid coordinates to Foundry grid coordinates
 * @param {number} internalX - Internal grid X coordinate
 * @param {number} internalY - Internal grid Y coordinate
 * @returns {{x: number, y: number}} Foundry grid coordinates
 */
export function internalToFoundry(internalX, internalY) {
    return {
        x: Math.floor(internalX / INTERNAL_SUBDIVISION_FACTOR),
        y: Math.floor(internalY / INTERNAL_SUBDIVISION_FACTOR)
    };
}

/**
 * Convert internal grid coordinates to pixel coordinates
 * @param {number} internalX - Internal grid X coordinate  
 * @param {number} internalY - Internal grid Y coordinate
 * @returns {{x: number, y: number}} Pixel coordinates (center of internal grid cell)
 */
export function internalGridToPixels(internalX, internalY) {
    const internalGridSize = canvas.grid.size / INTERNAL_SUBDIVISION_FACTOR;
    return {
        x: internalX * internalGridSize + (internalGridSize / 2),
        y: internalY * internalGridSize + (internalGridSize / 2)
    };
}

/**
 * Convert pixel coordinates to internal grid coordinates
 * @param {number} pixelX - Pixel X coordinate
 * @param {number} pixelY - Pixel Y coordinate  
 * @returns {{x: number, y: number}} Internal grid coordinates
 */
export function pixelsToInternalGrid(pixelX, pixelY) {
    const internalGridSize = canvas.grid.size / INTERNAL_SUBDIVISION_FACTOR;
    return {
        x: Math.floor(pixelX / internalGridSize),
        y: Math.floor(pixelY / internalGridSize)
    };
}

/**
 * Get internal grid dimensions for current canvas
 * @returns {{width: number, height: number}} Internal grid dimensions
 */
export function getInternalGridDimensions() {
    const internalGridSize = canvas.grid.size / INTERNAL_SUBDIVISION_FACTOR;
    return {
        width: Math.ceil(canvas.dimensions.width / internalGridSize),
        height: Math.ceil(canvas.dimensions.height / internalGridSize)
    };
}

/**
 * Get adjacent positions for internal grid (8-directional for square grids)
 * @param {{x: number, y: number}} pos - Internal grid position
 * @returns {Array<{x: number, y: number}>} Array of adjacent positions
 */
export function getInternalGridAdjacents(pos) {
    const isSquareGrid = canvas.grid.type === CONST.GRID_TYPES.SQUARE;
    
    if (isSquareGrid) {
        return [
            {x: pos.x - 1, y: pos.y - 1}, {x: pos.x, y: pos.y - 1}, {x: pos.x + 1, y: pos.y - 1},
            {x: pos.x - 1, y: pos.y},                                {x: pos.x + 1, y: pos.y},
            {x: pos.x - 1, y: pos.y + 1}, {x: pos.x, y: pos.y + 1}, {x: pos.x + 1, y: pos.y + 1}
        ];
    } else {
        // For hex grids, need to implement hex adjacency logic scaled to internal grid
        // This is more complex and requires hex grid math
        throw new Error("Hex grid internal adjacency not yet implemented");
    }
}
```

### **2. Interface Layer Methods**

#### **File: `js/internal_grid_interface.js` (NEW)**
```javascript
import { foundryToInternal, internalToFoundry, internalGridToPixels } from './internal_grid.js';

/**
 * Public API: Convert user-provided Foundry coordinates to internal pathfinding
 * @param {{x: number, y: number}} foundryPos - Position in Foundry grid coordinates
 * @returns {{x: number, y: number}} Position in internal grid coordinates  
 */
export function convertUserPositionToInternal(foundryPos) {
    return foundryToInternal(foundryPos.x, foundryPos.y);
}

/**
 * Public API: Convert internal pathfinding result back to Foundry coordinates
 * @param {Array<{x: number, y: number}>} internalPath - Path in internal grid coordinates
 * @returns {Array<{x: number, y: number}>} Path in Foundry grid coordinates
 */
export function convertInternalPathToUser(internalPath) {
    return internalPath.map(pos => internalToFoundry(pos.x, pos.y));
}

/**
 * Backwards compatibility: Replace getPixelsFromGridPositionObj for internal grid
 * @param {{x: number, y: number}} internalGridPos - Position in internal grid
 * @returns {{x: number, y: number}} Pixel coordinates
 */
export function getPixelsFromInternalGridPosition(internalGridPos) {
    return internalGridToPixels(internalGridPos.x, internalGridPos.y);
}

/**
 * Token snap point calculation for internal grid
 * @param {{x: number, y: number}} pixelPos - Pixel position
 * @param {Object} tokenData - Token data object
 * @returns {{x: number, y: number}} Snapped pixel position
 */
export function getSnapPointForInternalGrid(pixelPos, tokenData) {
    // Reuse existing snap logic but with internal grid calculations
    return getSnapPointForTokenDataObj(pixelPos, tokenData); // May need modification
}
```

---

## 🔄 **Required API Replacements**

### **Phase 1: Core Grid System Replacement**

#### **1. Update GriddedCache.reset()**
```javascript
// CURRENT (js/cache.js:273-284)
reset() {
    super.reset();
    if (canvas.grid.isHexagonal && canvas.grid.columnar) {
        this.gridWidth = Math.ceil(canvas.dimensions.width / ((3 / 4) * canvas.grid.sizeX));
    } else {
        this.gridWidth = Math.ceil(canvas.dimensions.width / canvas.grid.sizeX);
    }
    // ... similar for gridHeight
}

// REPLACEMENT
import { getInternalGridDimensions } from './internal_grid.js';

reset() {
    super.reset();
    const internalDimensions = getInternalGridDimensions();
    this.gridWidth = internalDimensions.width;
    this.gridHeight = internalDimensions.height;
}
```

#### **2. Update GriddedPathfinder constructor**
```javascript
// CURRENT (js/pathfinder.js:41-42)  
this.gridWidth = Math.ceil(canvas.dimensions.width / canvas.grid.sizeX);
this.gridHeight = Math.ceil(canvas.dimensions.height / canvas.grid.sizeY);

// REPLACEMENT
import { getInternalGridDimensions } from './internal_grid.js';

const internalDimensions = getInternalGridDimensions();
this.gridWidth = internalDimensions.width;
this.gridHeight = internalDimensions.height;
```

#### **3. Update neighbor calculation**
```javascript
// CURRENT (js/cache.js:318-320)
const adjacentOffsets = isSquareGrid ? 
    [{x: -1, y: -1}, {x: 0, y: -1}, {x: 1, y: -1}, /*...*/] :
    canvas.grid.getAdjacentOffsets({i: pos.x, j: pos.y})
        .map(offset => ({x: offset.i, y: offset.j}));

// REPLACEMENT  
import { getInternalGridAdjacents } from './internal_grid.js';

const adjacentOffsets = getInternalGridAdjacents(pos);
```

### **Phase 2: Coordinate Conversion Replacement**

#### **4. Update collision detection coordinate conversion**
```javascript
// CURRENT (js/cache.js:448)
const stepStart = getSnapPointForTokenDataObj(getPixelsFromGridPositionObj(from), tokenData);
const stepEnd = getSnapPointForTokenDataObj(getPixelsFromGridPositionObj(to), tokenData);

// REPLACEMENT
import { getPixelsFromInternalGridPosition, getSnapPointForInternalGrid } from './internal_grid_interface.js';

const stepStart = getSnapPointForInternalGrid(getPixelsFromInternalGridPosition(from), tokenData);
const stepEnd = getSnapPointForInternalGrid(getPixelsFromInternalGridPosition(to), tokenData);
```

### **Phase 3: Public API Interface Update**

#### **5. Update main pathfinding entry points**
```javascript  
// CURRENT (js/main.js) - User passes Foundry coordinates
export function findPath(from, to, options) {
    // from/to are in Foundry grid coordinates
    const pathfinder = initializePathfinder(from, to, options);
    // ...
}

// REPLACEMENT - Add coordinate conversion layer
import { convertUserPositionToInternal, convertInternalPathToUser } from './internal_grid_interface.js';

export function findPath(foundryFrom, foundryTo, options) {
    // Convert user input to internal coordinates
    const internalFrom = convertUserPositionToInternal(foundryFrom);
    const internalTo = convertUserPositionToInternal(foundryTo);
    
    // Run pathfinding on internal grid
    const pathfinder = initializePathfinder(internalFrom, internalTo, options);
    const internalResult = pathfinder.findPath();
    
    // Convert result back to Foundry coordinates
    if (internalResult.path) {
        internalResult.path = convertInternalPathToUser(internalResult.path);
    }
    
    return internalResult;
}
```

---

## 📋 **Implementation Phases**

### **Phase 1: Foundation (3-4 days)**
1. ✅ Create `js/internal_grid.js` with core coordinate conversion functions
2. ✅ Create `js/internal_grid_interface.js` with public API wrappers  
3. ✅ Write comprehensive unit tests for coordinate conversions
4. ✅ Validate conversion accuracy with known test cases

### **Phase 2: Core Integration (4-5 days)**
1. ✅ Update `GriddedCache.reset()` to use internal grid dimensions
2. ✅ Update `GriddedPathfinder` constructor grid calculations
3. ✅ Replace adjacency calculations with internal grid logic
4. ✅ Test basic pathfinding on simple maps

### **Phase 3: Collision System (3-4 days)**
1. ✅ Update `stepCollidesWithWall()` coordinate conversions
2. ✅ Test collision detection accuracy with internal grid
3. ✅ Validate against current gap detection test cases
4. ✅ Performance benchmark vs current system

### **Phase 4: Public API (2-3 days)** 
1. ✅ Add coordinate conversion layer to main pathfinding functions
2. ✅ Update debug utilities (`pixelToGrid`, `gridToPixel`, etc.)
3. ✅ Backwards compatibility testing with existing code
4. ✅ Update documentation and examples

### **Phase 5: Optimization & Polish (2-3 days)**
1. ✅ Performance optimization for 16x larger search space
2. ✅ Memory usage analysis and optimization
3. ✅ Edge case handling (grid boundaries, large tokens)
4. ✅ Final integration testing on complex maps

---

## ⚠️ **Risk Assessment**

### **High Risk Areas:**
1. **Hex Grid Support**: Current plan focuses on square grids - hex grids need separate implementation
2. **Token Size Handling**: Large tokens (2x2, 3x3) need careful internal grid alignment  
3. **Performance Impact**: 16x more nodes could impact pathfinding speed significantly
4. **Edge Cases**: Grid boundaries, partial squares, token positioning edge cases

### **Backwards Compatibility:**
1. **API Breaking**: Public APIs will need coordinate conversion - could break existing integrations
2. **Debug Tools**: All existing debug utilities need internal grid awareness
3. **Save/Load**: Any saved pathfinding data may become invalid

### **Testing Strategy:**
1. **Unit Tests**: Comprehensive coordinate conversion validation
2. **Integration Tests**: Side-by-side comparison with current system
3. **Performance Tests**: Benchmark pathfinding speed on various map sizes
4. **Regression Tests**: Validate existing functionality still works

---

## 📊 **Expected Outcomes**

### **Benefits:**
- ✅ **Better Gap Navigation**: 4x resolution allows pathfinding through 1-square gaps
- ✅ **Smoother Paths**: More waypoint options around corners and obstacles  
- ✅ **Maintained Accuracy**: Same collision detection logic, higher precision
- ✅ **Future-Proof**: Foundation for full multi-scale pathfinding later

### **Trade-offs:**
- ❌ **16x Memory Usage**: More nodes cached in memory 
- ❌ **Slower Pathfinding**: More nodes to search (potentially 16x slower worst case)
- ❌ **Implementation Complexity**: New coordinate system to maintain
- ❌ **Testing Burden**: Much more thorough testing required

### **Success Metrics:**
1. **Gap Pathfinding**: Successfully route through 1-square gaps that currently fail
2. **Performance**: Pathfinding takes less than 2x current time (not 16x)
3. **Accuracy**: Zero regression in collision detection accuracy
4. **Compatibility**: All existing integrations continue working

---

## 🎯 **Final Implementation Decision Matrix**

| Factor | Current System | 4x Internal Grid | Full Multi-Scale |
|--------|---------------|------------------|------------------|
| **Implementation Time** | N/A | 2-3 weeks | 8-12 weeks |
| **Gap Pathfinding** | ❌ Fails | ✅ Works | ✅ Works |
| **Memory Usage** | Baseline | 16x higher | Variable |
| **Performance** | Baseline | 2-4x slower | Adaptive |
| **Complexity** | Simple | Medium | High |
| **Future Expandability** | Limited | Good foundation | Full flexibility |

**Recommendation**: Implement 4x internal grid as **proof of concept** and **foundation** for future multi-scale system if needed. 