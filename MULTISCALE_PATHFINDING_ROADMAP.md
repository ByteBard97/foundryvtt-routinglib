# Multi-Scale Pathfinding Implementation Roadmap

## 🎯 **Vision: Adaptive Level-of-Detail Pathfinding**

Instead of uniform grid resolution everywhere, implement **recursive refinement** near complex boundaries for more realistic paths around obstacles.

## 🚀 **RECOMMENDED: Pre-Cached Hierarchical Grid**

The most promising approach combines the benefits of both simple subdivision and full multi-scale systems:

### **Concept: Scene-Load Cache Building**
```
Scene Load: Pre-analyze all wall intersections
Build Cache: Only subdivide squares with wall complexity  
Runtime:    Fast lookup + A* on appropriate resolution level
Memory:     Sparse storage (most squares stay coarse)
```

### **Implementation Complexity: LOW-MEDIUM** ⚡
**Estimated Time**: 2-3 weeks  
**Key Insight**: Do the expensive work once at scene load, not during every pathfinding operation

**Required Changes**:
1. **Enhanced GriddedCache** - Add multi-level storage with sparse arrays
2. **Wall Analysis** - Pre-compute which squares need subdivision during cache build
3. **Smart Pathfinding** - Use appropriate resolution level per grid area
4. **Incremental Updates** - Only rebuild affected areas when walls change

### **Performance Benefits**:
- ✅ **Predictable speed** - No subdivision delays during pathfinding
- ✅ **Memory efficient** - Only store detail where walls exist
- ✅ **Scales well** - Large empty areas stay fast, complex areas get precision
- ✅ **Integrates cleanly** - Extends existing cache system

## 🚀 **ALTERNATIVE: Simple 4x Grid Subdivision**

For an even simpler approach that could provide 80% of the benefits with 20% of the complexity:

### **Concept: Internal 4x Finer Grid**
```
Current:  70×70 pixel squares (Foundry grid)
Internal: 17.5×17.5 pixel squares (4x subdivision)  
Search:   4×4 = 16 nodes per Foundry square
Interface: Still reports results in Foundry coordinates
```

### **Implementation Complexity: MEDIUM** ⚡
**Estimated Time**: 1-2 weeks  
**Required Changes**:

1. **GriddedCache.reset()** - Calculate `gridWidth/Height` as `4 * originalDimensions` 
2. **Coordinate Conversion** - New functions:
   ```javascript
   foundryToInternal(foundryX, foundryY) -> (internalX, internalY) 
   internalToFoundry(internalX, internalY) -> (foundryX, foundryY)
   ```
3. **Interface Layer** - Convert user coordinates at boundaries
4. **Performance** - 16x more nodes but simpler algorithm

### **Benefits vs Full Multi-Scale**:
- ✅ **Much simpler** to implement and debug
- ✅ **Better paths** around 1-square gaps and obstacles  
- ✅ **Compatible** with existing collision detection
- ✅ **Gradual migration** - can upgrade to full multi-scale later
- ❌ **Fixed resolution** - no adaptive refinement
- ❌ **Higher memory** usage everywhere (not just where needed)

### **Decision Point**: 
The **pre-cached hierarchical approach** offers the best balance of complexity vs. benefits. Consider implementing this first, with simple 4x subdivision as a fallback if cache complexity proves challenging.

## 📚 **Research Summary**

### **Best Reference Implementation: mich101mich/hierarchical_pathfinding**
- **Pure Rust crate** (perfect match for our tech stack)
- **HPA* implementation** (Hierarchical Pathfinding A*)
- **Configurable chunk sizes** (adaptive resolution foundation)
- **MIT License** (can be used freely)
- **Repo**: https://github.com/mich101mich/hierarchical_pathfinding

### **Academic Foundation: HAA* Paper**
- **Hierarchical Annotated A*** for multi-size agents
- **Clearance-based pathfinding** (handles different agent sizes)
- **Proven 3-10x performance improvements**
- **Multi-terrain support** with capability annotations
- **Paper**: "Hierarchical Path Planning for Multi-Size Agents in Heterogeneous Environments"

### **Real-World Insights: CrossCode Game**
- **NavMaps with large rectangular nodes**
- **Smart edge crossing algorithms** (closest to line between current position and target)
- **Multi-level navigation** (jumping between heights)
- **Performance**: Real-time in shipped game

## 🏗️ **Implementation Plan**

### **Phase 1: Research & Foundation (1-2 weeks)**
- [ ] **Clone and analyze Rust HPA* crate**
  - Download `mich101mich/hierarchical_pathfinding`
  - Study API design and data structures
  - Understand chunk management and graph abstraction
  - Dependencies: None

- [ ] **Study academic papers**
  - Read HAA* paper for clearance-based concepts
  - Understand uncertainty detection algorithms
  - Research adaptive refinement triggers
  - Dependencies: None

- [ ] **Analyze current codebase integration points**
  - Map current `stepCollidesWithWall()` to uncertainty detection
  - Identify WASM interface adaptation needs
  - Plan Rust-side vs JS-side responsibilities
  - Dependencies: Current boundary fix

- [ ] **Create proof-of-concept integration**
  - Fork/adapt HPA* crate for FoundryVTT needs
  - Add uncertainty flags to collision detection
  - Test basic hierarchical pathfinding
  - Dependencies: Research complete

### **Phase 2: Pre-Cached Hierarchical System (2-3 weeks)**
- [ ] **Extend GriddedCache for multi-level storage**
  - Add sparse arrays for different resolution levels
  - Implement level-of-detail storage (only store subdivisions where needed)
  - Create efficient lookup methods for appropriate resolution level
  - Dependencies: Phase 1 complete

- [ ] **Implement wall-intersection pre-analysis**
  - Detect which coarse grid squares intersect with walls during cache build
  - Mark squares that need subdivision (1 level, 2 levels, etc.)
  - Pre-compute passability at multiple resolution levels
  - Dependencies: Multi-level storage ready

- [ ] **Add adaptive refinement triggers**
  - Extend collision detection to return uncertainty flags
  - Implement boundary condition detection
  - Add wall endpoint and gap detection logic
  - Dependencies: Hierarchical structure

- [ ] **Create resolution manager**
  - Decide when to refine (coarse → fine → pixel-level)
  - Implement refinement area calculation
  - Add dynamic grid subdivision logic
  - Dependencies: Uncertainty detection

- [ ] **Build multi-resolution pathfinding**
  - Integrate HPA* for coarse-level pathfinding
  - Add fine-level analysis for uncertain areas
  - Implement path reconstruction across resolutions
  - Dependencies: Resolution manager

### **Phase 3: WASM Integration (1-2 weeks)**
- [ ] **Adapt WASM interface**
  - Extend js_api.rs for multi-scale operations
  - Add chunk management functions
  - Create uncertainty reporting interface
  - Dependencies: Core system complete

- [ ] **Update JavaScript layer**
  - Modify pathfinder.js to handle hierarchical results
  - Add visual debugging for different resolution levels
  - Integrate with existing cache system
  - Dependencies: WASM interface

- [ ] **Performance optimization**
  - Profile multi-scale vs current performance
  - Optimize hot paths with Rust/WASM boundary
  - Add caching for frequently accessed chunks
  - Dependencies: Basic integration working

### **Phase 4: Advanced Features (2-3 weeks)**
- [ ] **Implement CrossCode-style edge crossing**
  - Add smart entry/exit point calculation
  - Implement "closest to line" algorithm for node transitions
  - Optimize path smoothing across chunk boundaries
  - Dependencies: Basic pathfinding working

- [ ] **Add clearance-based agent support**
  - Implement HAA*-style agent size handling
  - Add terrain capability annotations
  - Support different creature sizes (Large, Huge)
  - Dependencies: Edge crossing complete

- [ ] **Enhanced uncertainty detection**
  - Add diagonal movement uncertainty
  - Implement complex terrain transition detection
  - Create squeezing scenario refinement
  - Dependencies: Agent support

- [ ] **Visual debugging system**
  - Color-code different resolution levels
  - Show chunk boundaries and refinement areas
  - Add performance metrics display
  - Dependencies: Core features complete

### **Phase 5: Testing & Optimization (1-2 weeks)**
- [ ] **Comprehensive testing**
  - Test on complex FoundryVTT maps
  - Validate performance improvements
  - Compare path quality vs current system
  - Dependencies: All features implemented

- [ ] **Performance profiling**
  - Measure 90% coarse vs 10% fine performance split
  - Optimize memory usage for large maps
  - Tune chunk sizes for optimal performance
  - Dependencies: Testing complete

- [ ] **Edge case handling**
  - Test narrow passages, diagonal walls
  - Validate different token sizes
  - Handle dynamic map changes
  - Dependencies: Performance optimization

- [ ] **Documentation and cleanup**
  - Document new API and configuration options
  - Create migration guide from current system
  - Clean up debug code and add final optimizations
  - Dependencies: All testing complete

## 🎯 **Expected Benefits**

### **Performance Improvements**
- **90% of pathfinding**: Fast coarse-grid A* (3-10x faster)
- **10% of pathfinding**: Detailed analysis only where needed
- **Memory efficiency**: Hierarchical representation uses less space

### **Path Quality Improvements**
- **Realistic obstacle navigation**: No more center-to-center rigidity
- **Smooth boundary transitions**: Proper gap detection and usage
- **Multi-agent support**: Different sizes handled efficiently
- **Complex terrain**: Better handling of narrow passages

### **Scalability**
- **Large maps**: Hierarchical structure scales better
- **Real-time updates**: Only affected chunks need recalculation
- **Dynamic content**: Easier to handle map changes

## 🚨 **Key Technical Challenges**

### **Integration Complexity**
- **WASM boundary overhead**: Minimize data transfer between JS and Rust
- **State synchronization**: Keep hierarchical graph consistent
- **Memory management**: Efficient chunk loading/unloading

### **Algorithm Challenges**
- **Refinement heuristics**: When to zoom in/out
- **Path reconstruction**: Connecting paths across resolution levels
- **Uncertainty detection**: Accurate boundary condition identification

### **Performance Risks**
- **Over-refinement**: Too much detail in simple areas
- **Cache thrashing**: Poor chunk management
- **WASM overhead**: More complex interface

## 🔄 **Fallback Strategy**

If full multi-scale proves too complex:
1. **Implement just uncertainty detection** (current boundary fix + broader triggers)
2. **Use HPA* for large maps only** (keeping current system for small maps)
3. **Add clearance-based agent support** (without full multi-scale)

## 📈 **Success Metrics**

- **Performance**: 3-5x faster pathfinding on large maps
- **Quality**: Paths through 1-square gaps work reliably
- **Scalability**: Handles 100x100+ grid maps smoothly
- **Compatibility**: Works with all existing FoundryVTT features

---

**Next Steps**: Begin Phase 1 by downloading and analyzing the `mich101mich/hierarchical_pathfinding` crate to understand the foundational concepts and API design. 