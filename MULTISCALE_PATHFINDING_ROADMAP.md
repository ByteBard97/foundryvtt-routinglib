# Multi-Scale Pathfinding Implementation Roadmap

## 🎯 **Vision: Adaptive Level-of-Detail Pathfinding**

Instead of uniform grid resolution everywhere, implement **recursive refinement** near complex boundaries for more realistic paths around obstacles.

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

### **Phase 2: Core Multi-Scale System (2-3 weeks)**
- [ ] **Implement hierarchical graph structure**
  - Extend current GriddedCache with cluster support
  - Add chunk-based node management
  - Create inter-cluster and intra-cluster edge systems
  - Dependencies: Phase 1 complete

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