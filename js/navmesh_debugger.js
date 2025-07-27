/* eslint-disable no-undef */

/**
 * A class dedicated to rendering navmesh debugging information onto the canvas.
 */
export class NavmeshDebugger {
    constructor() {
        this.debugLayer = null;
        this.initialize();
    }

    /**
     * Initializes the PIXI.Graphics layer for drawing.
     */
    initialize() {
        this.debugLayer = canvas.stage.addChild(new PIXI.Graphics());
        console.log("RoutingLib | Navmesh debugger initialized.");
    }

    /**
     * Clears all drawings from the debug layer.
     */
    clear() {
        if (this.debugLayer) {
            this.debugLayer.clear();
        }
    }

    /**
     * Draws the walkable polygons and holes returned by JSTS.
     * @param {Array<jsts.geom.Polygon>} polygons - The array of polygons from JSTS.
     */
    drawPolygons(polygons) {
        if (!this.debugLayer) return;
        this.clear();

        polygons.forEach(polygon => {
            // Draw exterior ring (walkable area)
            const exterior = polygon.getExteriorRing().getCoordinates();
            this.debugLayer.lineStyle(2, 0x00FF00, 0.8); // Green for walkable
            this.debugLayer.beginFill(0x00FF00, 0.2);
            this.drawJstsPolygon(exterior);
            this.debugLayer.endFill();

            // Draw interior rings (holes)
            for (let i = 0; i < polygon.getNumInteriorRing(); i++) {
                const interior = polygon.getInteriorRingN(i).getCoordinates();
                this.debugLayer.lineStyle(2, 0xFF0000, 0.8); // Red for holes
                this.debugLayer.beginFill(0xFF0000, 0.2);
                this.drawJstsPolygon(interior);
                this.debugLayer.endFill();
            }
        });
    }

    /**
     * Draws the final triangulated mesh.
     * @param {Array<poly2tri.Triangle>} triangles - The array of triangles from poly2tri.
     */
    drawTriangles(triangles) {
        if (!this.debugLayer) return;
        this.clear();

        this.debugLayer.lineStyle(1, 0x0000FF, 0.5); // Blue for triangle edges
        triangles.forEach(triangle => {
            const points = triangle.getPoints();
            this.debugLayer.moveTo(points[0].x, points[0].y);
            this.debugLayer.lineTo(points[1].x, points[1].y);
            this.debugLayer.lineTo(points[2].x, points[2].y);
            this.debugLayer.lineTo(points[0].x, points[0].y);
        });
    }

    /**
     * Helper to draw a polygon from JSTS coordinates.
     * @param {Array<jsts.geom.Coordinate>} coords - The JSTS coordinates.
     */
    drawJstsPolygon(coords) {
        if (coords.length === 0) return;
        this.debugLayer.moveTo(coords[0].x, coords[0].y);
        for (let i = 1; i < coords.length; i++) {
            this.debugLayer.lineTo(coords[i].x, coords[i].y);
        }
    }
} 