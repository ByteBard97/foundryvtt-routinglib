# Navmesh Implementation Roadmap

## 🎯 **Objective**: Replace Grid-Based Pathfinding with a High-Fidelity Navmesh System

This project will replace the current grid-based pathfinding system with a superior navigation mesh (navmesh) approach. This will provide more accurate, performant, and realistic pathfinding by operating on the scene's true geometry instead of a grid approximation.

---

## 🛠️ **Core Pipeline: The "Geometry Factory"**

The implementation is a multi-stage pipeline orchestrated by the `NavmeshBuilder` class.

1.  **Collect Geometry**: Wall and scene boundary line segments are gathered from the Foundry VTT canvas. Open doors are filtered out.
2.  **Polygonize with JSTS**: The powerful **JavaScript Topology Suite (JSTS)** is used to process the raw line segments. It cleans the geometry (e.g., snapping nearly-touching endpoints) and robustly calculates the enclosed "walkable" polygons, correctly identifying interior holes.
3.  **Triangulate with `poly2tri.js`**: The resulting walkable polygons are fed into `poly2tri.js`, which uses Constrained Delaunay Triangulation (CDT) to create a high-quality mesh of triangles. This triangle quality is ideal for pathfinding and path smoothing.
4.  **Format for `three-pathfinding`**: The triangle data is converted into the specific flat vertex and indexed face array format required by the `three-pathfinding` library.
5.  **Create Zone**: The final data is loaded into `three-pathfinding` to create a usable pathfinding zone.

---

## 🏗️ **Implementation Phases**

### **Phase 1: Core Navmesh Builder (COMPLETE)**
- ✅ Research and select the optimal libraries (JSTS, poly2tri.js).
- ✅ Implement the `NavmeshBuilder` class.
- ✅ Implement the full pipeline from wall data to a `three-pathfinding` compatible zone.

### **Phase 2: Foundry VTT Integration (Current Phase)**
1.  **Create Initial Navmesh on Load**:
    - When a scene is loaded (`canvasReady` hook), check if a cached navmesh exists on the scene flags.
    - If not, instantiate `NavmeshBuilder` and generate the navmesh from `canvas.walls.documents` and `canvas.dimensions`.
2.  **Cache the Navmesh**:
    - Store the generated `{ vertices, faces }` data as a flag on the current scene (`scene.setFlag('routinglib', 'navmeshData', ...)`).
    - On subsequent loads, if the flag exists, load the navmesh directly from the cache to skip regeneration.
3.  **Live Updates with Hooks**:
    - Listen to the `createWall`, `updateWall`, and `deleteWall` hooks.
    - When triggered, re-run the `NavmeshBuilder` (filtering out open doors: `wall.ds !== 2`) and update the scene flag with the new navmesh data.
    - Update the active pathfinding zone in the module with the new mesh.

### **Phase 3: Visual Debugger**
1.  **Create a Debug Layer**: Add a new `PIXI.Graphics` layer to the canvas to draw debug information.
2.  **Render Polygonization**: Add a toggleable debug option to render the walkable polygons and holes returned by JSTS.
3.  **Render Triangulation**: Add a toggle to render the final triangulated navmesh from `poly2tri.js` over the scene.
4.  **Color Coding**: Use different colors for the exterior boundaries, holes, and the final triangles to make debugging clear.

### **Phase 4: Agent Size & Clearance (Advanced)**
1.  **Initial Implementation (Baked Navmesh)**:
    - Add an option to the `NavmeshBuilder` to accept an `agentRadius` parameter.
    - Use JSTS's buffer operation to "inflate" walls by this radius before polygonization.
    - Generate and cache separate navmeshes for different creature sizes (e.g., Medium, Large, Huge).
2.  **Advanced Implementation (Dynamic Costs)**:
    - **Research**: Investigate extending `three-pathfinding` to support a per-edge custom cost function during A* search.
    - **Portal Analysis**: After building the master (Medium creature) navmesh, iterate through all triangle edges (portals) and calculate their width. Cache these widths.
    - **Implement Custom Cost Function**: When finding a path, pass the creature's size. The cost function will:
        - Return `Infinity` if `portal_width < creature_size`.
        - Return `cost * 2` if the passage is a "tight squeeze" (e.g., `portal_width < creature_size * 1.5`).
        - Return `normal cost` otherwise.

### **Phase 5: Performance & Optimization**
1.  **Benchmarking**: Test navmesh generation time on a variety of complex community maps.
2.  **Web Worker Offloading**: If generation time exceeds ~500ms on very large maps and causes UI stutter, refactor the `NavmeshBuilder` pipeline to run inside a Web Worker to keep the main thread responsive. The final `{ vertices, faces }` data can be posted back to the main thread when complete.

---

## ⚠️ **Risk Assessment**

- **High Complexity**: The advanced "Dynamic Cost" model for agent clearance requires a deep understanding of the `three-pathfinding` library's internals and may require forking it if it's not extensible enough.
- **Floating Point Precision**: Computational geometry is sensitive to floating-point errors. JSTS is robust, but careful testing on edge cases (e.g., perfectly collinear walls, walls that terminate exactly on another wall) is critical.
- **Performance on "Messy" Maps**: Maps with thousands of tiny, disconnected wall segments could slow down the JSTS polygonizer. Pre-processing steps to merge or simplify walls may be needed in extreme cases.

---

## 📊 **Expected Outcomes**

- **Superior Path Quality**: Paths will be geometrically perfect, smooth, and natural.
- **Massively Improved Performance**: Pathfinding *searches* will be significantly faster due to the smaller graph size.
- **Elimination of Grid Artifacts**: The "1-square gap" problem and issues with diagonal walls will be completely solved.
- **Foundation for Advanced Features**: A true geometric understanding of the map enables complex rules like agent clearance and difficult terrain.

---

## 🔄 **Fallback Strategy**

- If the **Dynamic Cost** model proves too complex to implement, we will fall back to the simpler **Baked Navmesh** approach (caching a separate navmesh for each creature size). This still provides most of the benefits.
- If generation proves too slow on certain maps even with a Web Worker, we can introduce a user-facing "Rebuild Navmesh" button and only trigger updates manually or on scene save, rather than live on every wall change. 