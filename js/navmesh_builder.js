/* eslint-disable no-undef */
import { jsts } from './lib/jsts-wrapper.js';
import { poly2tri } from './lib/poly2tri-wrapper.js';
import { Pathfinding } from './lib/three-pathfinding.mjs';

/**
 * Builds a navigation mesh from Foundry VTT wall data.
 * This class orchestrates a multi-stage pipeline:
 * 1. Collects and cleans wall geometry.
 * 2. Polygonizes the geometry to find walkable areas (using JSTS).
 * 3. Triangulates the walkable polygons (using poly2tri.js).
 * 4. Formats the resulting mesh for use with the three-pathfinding library.
 */
export class NavmeshBuilder {
    constructor() {
        this.pathfinding = new Pathfinding();
        this.polygons = [];
        this.triangles = [];
    }

    /**
     * Main build method. Takes a list of walls and scene dimensions
     * and returns a navigation mesh zone.
     * @param {Array<Wall>} walls - The array of Wall objects from canvas.walls.
     * @param {Object} dimensions - The scene dimensions from canvas.dimensions.
     * @param {number} agentRadius - The radius of the agent, used to "inflate" walls.
     * @returns {Object} A zone object compatible with three-pathfinding.
     */
    build(walls, dimensions, agentRadius = 0) {
        console.log(`[NavmeshBuilder] Starting navmesh generation with agent radius: ${agentRadius}...`);

        this.geometryFactory = new jsts.geom.GeometryFactory();

        // Step 1: Get Scene Boundaries and Walls
        const boundaryLines = this._createBoundaryLines(dimensions);
        const wallLines = this._createWallLines(walls);
        const allLines = boundaryLines.concat(wallLines);

        // Step 2 & 3: Polygonize with JSTS
        this.polygons = this._polygonize(allLines, dimensions, agentRadius);
        if (!this.polygons || this.polygons.length === 0) {
            console.warn('[NavmeshBuilder] Polygonization resulted in no walkable areas.');
            return null;
        }

        // Step 4: Triangulate with poly2tri
        this.triangles = this._triangulate(this.polygons);

        // Step 5 & 6: Format for three-pathfinding
        const zoneData = this._formatForPathfinding(this.triangles);
        const zone = Pathfinding.createZone(zoneData);
        
        console.log(`[NavmeshBuilder] Navmesh generation complete. Found ${zone.groups.length} polygon groups.`);
        return zone;
    }

    /**
     * Creates line segments for the scene boundary.
     * @private
     */
    _createBoundaryLines(dimensions) {
        const { sceneX, sceneY, sceneWidth, sceneHeight } = dimensions;
        const boundaryCoords = [
            new jsts.geom.Coordinate(sceneX, sceneY),
            new jsts.geom.Coordinate(sceneX + sceneWidth, sceneY),
            new jsts.geom.Coordinate(sceneX + sceneWidth, sceneY + sceneHeight),
            new jsts.geom.Coordinate(sceneX, sceneY + sceneHeight),
            new jsts.geom.Coordinate(sceneX, sceneY) // Close the loop
        ];
        return [this.geometryFactory.createLineString(boundaryCoords)];
    }

    /**
     * Converts Foundry Wall objects to JSTS LineString objects.
     * @private
     */
    _createWallLines(walls) {
        return walls.map(wall => {
            const coords = [
                new jsts.geom.Coordinate(wall.c[0], wall.c[1]),
                new jsts.geom.Coordinate(wall.c[2], wall.c[3])
            ];
            return this.geometryFactory.createLineString(coords);
        });
    }

    /**
     * Uses JSTS to convert a network of lines into polygons.
     * If an agentRadius is provided, it will buffer the walls and
     * subtract them from the scene boundary instead.
     * @private
     */
    _polygonize(lines, dimensions, agentRadius) {
        if (agentRadius > 0) {
            // "Carve from solid" method for agents with size
            const boundaryCoords = [
                new jsts.geom.Coordinate(dimensions.sceneX, dimensions.sceneY),
                new jsts.geom.Coordinate(dimensions.sceneX + dimensions.sceneWidth, dimensions.sceneY),
                new jsts.geom.Coordinate(dimensions.sceneX + dimensions.sceneWidth, dimensions.sceneY + dimensions.sceneHeight),
                new jsts.geom.Coordinate(dimensions.sceneX, dimensions.sceneY + dimensions.sceneHeight),
                new jsts.geom.Coordinate(dimensions.sceneX, dimensions.sceneY)
            ];
            const boundaryPolygon = this.geometryFactory.createPolygon(this.geometryFactory.createLinearRing(boundaryCoords));

            if (lines.length === 0) {
                return [boundaryPolygon];
            }

            const bufferedWalls = this._bufferWalls(lines, agentRadius);
            const walkableArea = boundaryPolygon.difference(bufferedWalls);
            
            // The result might be a MultiPolygon, so we need to handle that.
            const polygonArray = [];
            if (walkableArea.getGeometryType() === 'MultiPolygon') {
                for (let i = 0; i < walkableArea.getNumGeometries(); i++) {
                    polygonArray.push(walkableArea.getGeometryN(i));
                }
            } else {
                polygonArray.push(walkableArea);
            }
            return polygonArray;

        } else {
            // Original method for point-sized agents
            const polygonizer = new jsts.operation.polygonize.Polygonizer();
            lines.forEach(line => polygonizer.add(line));

            const polygons = polygonizer.getPolygons();
            const polygonArray = [];
            for (let i = 0; i < polygons.size(); i++) {
                polygonArray.push(polygons.get(i));
            }
            return polygonArray;
        }
    }

    /**
     * Buffers a list of LineStrings by a given radius and unions them.
     * @private
     */
    _bufferWalls(lines, radius) {
        let bufferedWalls = lines.map(line => line.buffer(radius));
        // Union all the buffered walls into a single geometry
        let unionedWalls = bufferedWalls[0];
        for (let i = 1; i < bufferedWalls.length; i++) {
            unionedWalls = unionedWalls.union(bufferedWalls[i]);
        }
        return unionedWalls;
    }

    /**
     * Uses poly2tri.js to triangulate polygons with holes.
     * @private
     */
    _triangulate(polygons) {
        let allTriangles = [];
        polygons.forEach(polygon => {
            // Exterior ring
            const exteriorCoords = polygon.getExteriorRing().getCoordinates();
            const contour = exteriorCoords.map(c => new poly2tri.Point(c.x, c.y));
            // The last point is a duplicate of the first to close the loop, which poly2tri doesn't need.
            contour.pop();

            const sweepContext = new poly2tri.SweepContext(contour);

            // Interior rings (holes)
            for (let i = 0; i < polygon.getNumInteriorRing(); i++) {
                const holeCoords = polygon.getInteriorRingN(i).getCoordinates();
                const holeContour = holeCoords.map(c => new poly2tri.Point(c.x, c.y));
                holeContour.pop();
                sweepContext.addHole(holeContour);
            }

            sweepContext.triangulate();
            allTriangles = allTriangles.concat(sweepContext.getTriangles());
        });
        return allTriangles;
    }

    /**
     * Converts the triangulation output into the format needed by three-pathfinding.
     * @private
     */
    _formatForPathfinding(triangles) {
        const vertices = [];
        const faces = [];
        const vertexMap = new Map();
        let vertexIndex = 0;

        triangles.forEach(triangle => {
            const faceIndices = [];
            triangle.getPoints().forEach(point => {
                const key = `${point.x},${point.y}`;
                if (!vertexMap.has(key)) {
                    vertexMap.set(key, vertexIndex);
                    vertices.push(point.x, point.y, 0);
                    vertexIndex++;
                }
                faceIndices.push(vertexMap.get(key));
            });
            faces.push(...faceIndices);
        });

        return { vertices, faces };
    }
} 