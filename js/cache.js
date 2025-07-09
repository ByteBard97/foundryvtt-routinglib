import {resetJobs} from "./background.js";
import {getPixelsFromGridPositionObj} from "./foundry_fixes.js";
import {getSnapPointForTokenDataObj, isModuleActive} from "./util.js";

import * as GridlessPathfinding from "../wasm/gridless_pathfinding.js";

// Debug configuration
const DEBUG_CONFIG = {
	enabled: true, // Master debug toggle
	verboseCollision: false, // Detailed collision detection logs - too noisy
	graphConstruction: false, // Graph building logs
	specificPositions: [], // Array of {x, y} positions to debug specifically - if empty, debugs all
	wallIntersections: false, // Wall intersection details - very verbose
	squeezing: false, // Squeezing/large creature movement logs
	summaryOnly: true, // Only show final results, not detailed wall-by-wall checks
	blockedMovements: true, // Always show when movements are blocked
	allowedMovements: false // Show when movements are allowed (can be noisy)
};

// Helper function to check if debugging is enabled for a specific position
function shouldDebugPosition(from, to) {
	if (!DEBUG_CONFIG.enabled) return false;
	
	// If no specific positions are configured, debug all positions
	if (!DEBUG_CONFIG.specificPositions.length) return true;
	
	// Check if either from or to position matches our debug positions
	return DEBUG_CONFIG.specificPositions.some(pos => 
		(from.x === pos.x && from.y === pos.y) || 
		(to.x === pos.x && to.y === pos.y)
	);
}

// Export function to enable debugging for specific positions
export function enableDebugForPositions(positions, options = {}) {
	DEBUG_CONFIG.enabled = true;
	DEBUG_CONFIG.specificPositions = positions;
	DEBUG_CONFIG.verboseCollision = options.verboseCollision ?? false;
	DEBUG_CONFIG.wallIntersections = options.wallIntersections ?? false;
	DEBUG_CONFIG.squeezing = options.squeezing ?? false;
	DEBUG_CONFIG.graphConstruction = options.graphConstruction ?? false;
	DEBUG_CONFIG.summaryOnly = options.summaryOnly ?? true;
	DEBUG_CONFIG.blockedMovements = options.blockedMovements ?? true;
	DEBUG_CONFIG.allowedMovements = options.allowedMovements ?? true;
	
	console.log(`[RoutingLib] Debug enabled for positions:`, positions);
	console.log(`[RoutingLib] Debug options:`, {
		verboseCollision: DEBUG_CONFIG.verboseCollision,
		wallIntersections: DEBUG_CONFIG.wallIntersections,
		squeezing: DEBUG_CONFIG.squeezing,
		summaryOnly: DEBUG_CONFIG.summaryOnly,
		blockedMovements: DEBUG_CONFIG.blockedMovements,
		allowedMovements: DEBUG_CONFIG.allowedMovements
	});
}

// Export function to disable all debugging
export function disableDebug() {
	DEBUG_CONFIG.enabled = false;
	DEBUG_CONFIG.specificPositions = [];
	console.log(`[RoutingLib] Debug disabled`);
}

// Export function for quick debugging of narrow passage issues
export function debugNarrowPassages(centerPosition, radius = 2) {
	const positions = [];
	for (let x = centerPosition.x - radius; x <= centerPosition.x + radius; x++) {
		for (let y = centerPosition.y - radius; y <= centerPosition.y + radius; y++) {
			positions.push({x, y});
		}
	}
	
	enableDebugForPositions(positions, {
		blockedMovements: true,
		allowedMovements: true,
		wallIntersections: false,
		summaryOnly: true
	});
	
	console.log(`[RoutingLib] Narrow passage debugging enabled around (${centerPosition.x}, ${centerPosition.y}) with radius ${radius}`);
}

// Export function to debug a horizontal barrier (like the y=18 issue you're seeing)
export function debugHorizontalBarrier(yCoordinate, xStart = 10, xEnd = 30) {
	const positions = [];
	// Debug positions above and below the barrier
	for (let x = xStart; x <= xEnd; x++) {
		positions.push({x, y: yCoordinate - 1});  // Above barrier
		positions.push({x, y: yCoordinate});      // At barrier  
		positions.push({x, y: yCoordinate + 1});  // Below barrier
	}
	
	enableDebugForPositions(positions, {
		blockedMovements: true,
		allowedMovements: true,
		wallIntersections: true,  // Enable wall details for barriers
		squeezing: true,
		summaryOnly: false
	});
	
	console.log(`[RoutingLib] Horizontal barrier debugging enabled for y=${yCoordinate}, x=${xStart}-${xEnd}`);
	console.log(`[RoutingLib] Look for blocked movements trying to cross y=${yCoordinate}`);
}

// Export function to show a summary of what's happening
export function debugSummary() {
	console.log(`[RoutingLib] Debug Summary:`);
	console.log(`  - Enabled: ${DEBUG_CONFIG.enabled}`);
	console.log(`  - Positions being watched: ${DEBUG_CONFIG.specificPositions.length}`);
	if (DEBUG_CONFIG.specificPositions.length > 0) {
		console.log(`  - Position range: (${Math.min(...DEBUG_CONFIG.specificPositions.map(p => p.x))}, ${Math.min(...DEBUG_CONFIG.specificPositions.map(p => p.y))}) to (${Math.max(...DEBUG_CONFIG.specificPositions.map(p => p.x))}, ${Math.max(...DEBUG_CONFIG.specificPositions.map(p => p.y))})`);
	}
	console.log(`  - Options:`, DEBUG_CONFIG);
}

// Export function to convert pixel coordinates to grid coordinates
export function pixelToGrid(pixelX, pixelY) {
	const gridX = Math.floor(pixelX / canvas.grid.size);
	const gridY = Math.floor(pixelY / canvas.grid.size);
	console.log(`[RoutingLib] Pixel (${pixelX}, ${pixelY}) → Grid (${gridX}, ${gridY})`);
	return {x: gridX, y: gridY};
}

// Export function to convert grid coordinates to pixel coordinates  
export function gridToPixel(gridX, gridY) {
	const pixelX = gridX * canvas.grid.size + (canvas.grid.size / 2);
	const pixelY = gridY * canvas.grid.size + (canvas.grid.size / 2);
	console.log(`[RoutingLib] Grid (${gridX}, ${gridY}) → Pixel (${pixelX}, ${pixelY})`);
	return {x: pixelX, y: pixelY};
}

// Export function to analyze all walls and show their grid coordinates
export function analyzeWalls() {
	console.log(`[RoutingLib] === WALL ANALYSIS ===`);
	console.log(`Found ${canvas.walls.placeables.length} walls:`);
	
	const walls = canvas.walls.placeables.map((wall, index) => {
		const startPixel = {x: wall.document.c[0], y: wall.document.c[1]};
		const endPixel = {x: wall.document.c[2], y: wall.document.c[3]};
		
		const startGrid = {
			x: Math.floor(startPixel.x / canvas.grid.size),
			y: Math.floor(startPixel.y / canvas.grid.size)
		};
		const endGrid = {
			x: Math.floor(endPixel.x / canvas.grid.size), 
			y: Math.floor(endPixel.y / canvas.grid.size)
		};
		
		return {
			index,
			startPixel,
			endPixel,
			startGrid,
			endGrid,
			move: wall.document.move,
			door: wall.document.door,
			doorState: wall.document.ds,
			isHorizontal: Math.abs(startPixel.y - endPixel.y) < Math.abs(startPixel.x - endPixel.x),
			isVertical: Math.abs(startPixel.x - endPixel.x) < Math.abs(startPixel.y - endPixel.y)
		};
	});
	
	// Group walls by type
	const horizontalWalls = walls.filter(w => w.isHorizontal);
	const verticalWalls = walls.filter(w => w.isVertical);
	
	console.log(`\n=== HORIZONTAL WALLS (${horizontalWalls.length}) ===`);
	horizontalWalls.forEach(wall => {
		console.log(`Wall ${wall.index}: Grid Y=${wall.startGrid.y} from X=${wall.startGrid.x} to X=${wall.endGrid.x} (pixels: ${wall.startPixel.x},${wall.startPixel.y} to ${wall.endPixel.x},${wall.endPixel.y})`);
	});
	
	console.log(`\n=== VERTICAL WALLS (${verticalWalls.length}) ===`);
	verticalWalls.forEach(wall => {
		console.log(`Wall ${wall.index}: Grid X=${wall.startGrid.x} from Y=${wall.startGrid.y} to Y=${wall.endGrid.y} (pixels: ${wall.startPixel.x},${wall.startPixel.y} to ${wall.endPixel.x},${wall.endPixel.y})`);
	});
	
	return walls;
}

// Export function to find walls in a specific grid area
export function findWallsInArea(minX, minY, maxX, maxY) {
	console.log(`[RoutingLib] === WALLS IN AREA (${minX},${minY}) to (${maxX},${maxY}) ===`);
	
	const walls = canvas.walls.placeables.filter(wall => {
		const startGrid = {
			x: Math.floor(wall.document.c[0] / canvas.grid.size),
			y: Math.floor(wall.document.c[1] / canvas.grid.size)
		};
		const endGrid = {
			x: Math.floor(wall.document.c[2] / canvas.grid.size),
			y: Math.floor(wall.document.c[3] / canvas.grid.size)
		};
		
		// Check if wall intersects the area
		const wallMinX = Math.min(startGrid.x, endGrid.x);
		const wallMaxX = Math.max(startGrid.x, endGrid.x);
		const wallMinY = Math.min(startGrid.y, endGrid.y);
		const wallMaxY = Math.max(startGrid.y, endGrid.y);
		
		return !(wallMaxX < minX || wallMinX > maxX || wallMaxY < minY || wallMinY > maxY);
	});
	
	console.log(`Found ${walls.length} walls in area:`);
	walls.forEach((wall, i) => {
		const startPixel = {x: wall.document.c[0], y: wall.document.c[1]};
		const endPixel = {x: wall.document.c[2], y: wall.document.c[3]};
		const startGrid = {
			x: Math.floor(startPixel.x / canvas.grid.size),
			y: Math.floor(startPixel.y / canvas.grid.size)
		};
		const endGrid = {
			x: Math.floor(endPixel.x / canvas.grid.size),
			y: Math.floor(endPixel.y / canvas.grid.size)
		};
		
		console.log(`  ${i}: Grid (${startGrid.x},${startGrid.y}) to (${endGrid.x},${endGrid.y}) | Pixels (${startPixel.x},${startPixel.y}) to (${endPixel.x},${endPixel.y})`);
	});
	
	return walls;
}

export let cache;

export function initializeCaches() {
	if (canvas.grid.type === CONST.GRID_TYPES.GRIDLESS) {
		cache = new GridlessCache();
	} else {
		cache = new GriddedCache();
	}
}

export function wipeCaches() {
	cache.reset();
	resetJobs();
}

class Cache {
	constructor() {
		this.reset();
	}

	reset() {
		this.levelIndexes = detectLevels();
		this.graphs = [];
	}

	getLevelIndexForElevation(elevation) {
		let start = 0;
		let end = this.levelIndexes.length;
		// Bisect levelindexes to find the correct index for the current elevation
		while (start !== end) {
			const center = (start + end) >> 1; // Integer division by 2
			const border = this.levelIndexes[center];
			if (elevation == border.elevation) {
				if (border.isTop) {
					start = center - 1;
					end = center - 1;
				} else {
					start = center;
					end = center;
				}
			} else if (elevation < border.elevation) {
				end = center;
			} else {
				start = center + 1;
			}
		}
		return start;
	}
}

export class GriddedCache extends Cache {
	reset() {
		super.reset();
		if (canvas.grid.isHexagonal && canvas.grid.columnar) {
			this.gridWidth = Math.ceil(canvas.dimensions.width / ((3 / 4) * canvas.grid.sizeX));
		} else {
			this.gridWidth = Math.ceil(canvas.dimensions.width / canvas.grid.sizeX);
		}
		if (canvas.grid.isHexagonal && !canvas.grid.columnar) {
			this.gridHeight = Math.ceil(canvas.dimensions.height / ((3 / 4) * canvas.grid.sizeY));
		} else {
			this.gridHeight = Math.ceil(canvas.dimensions.height / canvas.grid.sizeY);
		}
	}

	static getSnapPointIndexForTokenData(tokenData) {
		if (canvas.grid.type === CONST.GRID_TYPES.GRIDLESS) return 0;
		if (canvas.grid.isHexagonal) {
			if (tokenData.hexSizeSupport?.altSnappingFlag) {
				return tokenData.hexSizeSupport.borderSize % 2;
			} else {
				return 0;
			}
		}
		return tokenData.width % 2 | (tokenData.height % 2 << 1);
	}

	getInitializedNode(pos, sizeIndex, levelIndex, tokenData) {
		let sizeGraphs = this.graphs[sizeIndex];
		if (!sizeGraphs) {
			sizeGraphs = [];
			this.graphs[sizeIndex] = sizeGraphs;
		}
		let graph = sizeGraphs[levelIndex];
		if (!graph) {
			graph = this.makeEmptyGraph();
			sizeGraphs[levelIndex] = graph;
		}
		let node = graph[pos.y][pos.x];
		if (!node) {
			const neighbors = [];
			
			// Get adjacent positions using proper grid API
			const isSquareGrid = canvas.grid.type === CONST.GRID_TYPES.SQUARE;
			const adjacentOffsets = isSquareGrid ? 
				[
					{x: -1, y: -1}, {x: 0, y: -1}, {x: 1, y: -1},
					{x: -1, y:  0},                 {x: 1, y:  0},
					{x: -1, y:  1}, {x: 0, y:  1}, {x: 1, y:  1}
				] :
				canvas.grid.getAdjacentOffsets({i: pos.x, j: pos.y})
					.map(offset => ({x: offset.i, y: offset.j}));
			
			for (const offset of adjacentOffsets) {
				const neighborPos = {
					x: pos.x + offset.x,
					y: pos.y + offset.y
				};
				
				if (
					neighborPos.x < 0 ||
					neighborPos.y < 0 ||
					neighborPos.x >= this.gridWidth ||
					neighborPos.y >= this.gridHeight
				) {
					continue;
				}
				
				// Skip self-references
				if (neighborPos.x === pos.x && neighborPos.y === pos.y) {
					continue;
				}
				
				if (!stepCollidesWithWall(pos, neighborPos, tokenData, true)) {
					const isDiagonal =
						pos.x !== neighborPos.x &&
						pos.y !== neighborPos.y &&
						canvas.grid.type === CONST.GRID_TYPES.SQUARE;
					neighbors.push({...neighborPos, isDiagonal});
				}
			}
			node = {...pos, neighbors};

			// Debug logging for graph construction
			if (DEBUG_CONFIG.enabled && DEBUG_CONFIG.graphConstruction && neighbors.length === 0) {
				console.warn(`[RoutingLib] Node at (${pos.x},${pos.y}) has NO neighbors - this could cause pathfinding issues`);
			}

			graph[pos.y][pos.x] = node;
		}
		return node;
	}

	makeEmptyGraph() {
		const graph = new Array(this.gridHeight);
		for (let y = 0; y < this.gridHeight; y++) {
			graph[y] = new Array(this.gridWidth);
		}
		return graph;
	}
}

class GridlessCache extends Cache {
	getGraphFor(tokenSize, levelIndex, elevation) {
		let levelGraphs = this.graphs[levelIndex];
		if (!levelGraphs) {
			levelGraphs = new Map();
			this.graphs[levelIndex] = levelGraphs;
		}
		let graph = levelGraphs[tokenSize];
		if (!graph) {
			const tokenCalcSize =
				tokenSize * canvas.grid.size * game.settings.get("routinglib", "gridlessTokenSizeRatio");
			const walls = canvas.walls.placeables;
			const wallHeightEnabled = isModuleActive("wall-height");
			graph = GridlessPathfinding.initializeGraph(
				walls,
				tokenCalcSize,
				elevation,
				wallHeightEnabled,
			);
			levelGraphs[tokenSize] = graph;
		}
		return graph;
	}
}

class LevelBorder {
	constructor(elevation, isTop) {
		this.elevation = elevation;
		this.isTop = isTop;
	}
}

function detectLevels() {
	const levelBorders = new Map();
	levelBorders[-Infinity] = {hasTop: false, hasBottom: true};
	levelBorders[Infinity] = {hasTop: true, hasBottom: false};
	const levelBorderElevations = [-Infinity, Infinity];
	if (isModuleActive("wall-height")) {
		for (const wall of canvas.walls.placeables) {
			const wallHeight = wall.document.flags["wall-height"];
			const top = wallHeight?.top ?? Infinity;
			const topBorder = levelBorders[top];
			if (!topBorder) {
				levelBorders[top] = {hasTop: true, hasBottom: false};
				levelBorderElevations.push(top);
			} else {
				topBorder.hasTop = true;
			}
			const bottom = wallHeight?.bottom ?? -Infinity;
			const bottomBorder = levelBorders[bottom];
			if (!bottomBorder) {
				levelBorders[bottom] = {hasTop: false, hasBottom: true};
				levelBorderElevations.push(bottom);
			} else {
				bottomBorder.hasBottom = true;
			}
		}
	}
	// Levels must be sorted because it will be bisected later
	levelBorderElevations.sort();
	const levels = [];
	for (const elevation of levelBorderElevations) {
		const border = levelBorders[elevation];
		if (border.hasBottom) {
			levels.push(new LevelBorder(elevation, false));
		}
		if (border.hasTop) {
			levels.push(new LevelBorder(elevation, true));
		}
	}
	return levels;
}

export function stepCollidesWithWall(from, to, tokenData, adjustPos = false) {
	// Return values: false = free movement, true = blocked, "squeeze" = movement allowed but at double cost
	const stepStart = getSnapPointForTokenDataObj(getPixelsFromGridPositionObj(from), tokenData);
	const stepEnd = getSnapPointForTokenDataObj(getPixelsFromGridPositionObj(to), tokenData);
	// Using an adjusted position 1 pixel away from the center of the grid
	// prevents the path from leaving that square if a wall is dead-center.
	// This matches the original implementation.
	let adjustedStart;
	if (adjustPos) {
		adjustedStart = {
			x: stepStart.x + Math.sign(stepStart.x - stepEnd.x),
			y: stepStart.y + Math.sign(stepStart.y - stepEnd.y),
		};
	} else {
		adjustedStart = stepStart;
	}

	/** @type {boolean | string} */ let blocked = false; // Can be false (free), true (blocked), or "squeeze" (difficult terrain)

	try {
		// Use simplified ray-based collision detection
		const ray = new Ray(adjustedStart, stepEnd);
		
			// Check if we should debug this specific movement
	const shouldDebug = shouldDebugPosition(from, to);
	
	// Always log when collision detection is called for our debug positions
	if (shouldDebug) {
		console.log(`[RoutingLib] COLLISION CHECK: (${from.x}, ${from.y}) → (${to.x}, ${to.y})`);
	}
	
	if (shouldDebug && DEBUG_CONFIG.verboseCollision) {
		console.log(`[RoutingLib] DEBUG: === COLLISION CHECK ===`);
		console.log(`[RoutingLib] DEBUG: Grid movement: (${from.x}, ${from.y}) → (${to.x}, ${to.y})`);
		console.log(`[RoutingLib] DEBUG: Pixel movement: (${adjustedStart.x}, ${adjustedStart.y}) → (${stepEnd.x}, ${stepEnd.y})`);
		console.log(`[RoutingLib] DEBUG: Token size: ${tokenData.width || 1}x${tokenData.height || 1} (w×h)`);
		console.log(`[RoutingLib] DEBUG: TokenData:`, { width: tokenData.width, height: tokenData.height, disposition: tokenData.disposition });
		console.log(`[RoutingLib] DEBUG: Found ${canvas.walls.placeables.length} walls to check`);
	}
		
		// Check each wall for collision using enhanced method
		// This needs to handle multiple return types: false (no collision), true (blocked), "squeeze" (difficult terrain)
		/** @type {boolean | string} */ let collisionResult = false;
		
		for (const wall of canvas.walls.placeables) {
			// Skip walls that don't block movement
			if (wall.document.move === CONST.WALL_MOVEMENT_TYPES.NONE) {
				continue;
			}
			
			// Skip open doors
			if (wall.document.door !== CONST.WALL_DOOR_TYPES.NONE && 
				wall.document.ds === CONST.WALL_DOOR_STATES.OPEN) {
				continue;
			}
			
			// Check wall height if wall-height module is active
			if (isModuleActive("wall-height")) {
				const wallHeight = wall.document.flags["wall-height"];
				const elevation = tokenData.elevation ?? 0;
				const top = wallHeight?.top ?? Infinity;
				const bottom = wallHeight?.bottom ?? -Infinity;
				if (elevation < bottom || elevation > top) {
					continue; // Token is outside wall height range
				}
			}
			
			// Define movement ray endpoints
			const rayStart = { x: adjustedStart.x, y: adjustedStart.y };
			const rayEnd = { x: stepEnd.x, y: stepEnd.y };
			
			// Define wall segment endpoints
			const wallStart = { x: wall.document.c[0], y: wall.document.c[1] };
			const wallEnd = { x: wall.document.c[2], y: wall.document.c[3] };
			
			// Use Foundry's utility function for line segment intersection
			let intersection = null;
			try {
				// Try to access the lineSegmentIntersection function (bypass TypeScript checking)
				const utils = foundry?.utils || window?.foundry?.utils;
				if (utils && utils['lineSegmentIntersection']) {
					intersection = utils['lineSegmentIntersection'](rayStart, rayEnd, wallStart, wallEnd);
					if (shouldDebug && DEBUG_CONFIG.wallIntersections) console.log(`[RoutingLib] DEBUG: Using foundry.utils.lineSegmentIntersection`);
				} else {
					// Fallback: use the ray intersectSegment method
					const wallSegment = {
						A: wallStart,
						B: wallEnd
					};
					intersection = ray.intersectSegment(wallSegment);
					if (shouldDebug && DEBUG_CONFIG.wallIntersections) console.log(`[RoutingLib] DEBUG: Using ray.intersectSegment fallback`);
				}
			} catch (error) {
				if (shouldDebug && DEBUG_CONFIG.wallIntersections) console.log(`[RoutingLib] DEBUG: Intersection method error:`, error.message);
				intersection = null;
			}
			
			if (shouldDebug && DEBUG_CONFIG.wallIntersections) {
				// Only show wall details that might actually intersect
				if (intersection !== null || 
					(Math.abs(from.x - 9) <= 1 && Math.abs(from.y - 18) <= 1) ||
					(Math.abs(from.x - 10) <= 1 && Math.abs(from.y - 18) <= 1)) {
					console.log(`[RoutingLib] DEBUG: Testing wall segment: (${wall.document.c[0]},${wall.document.c[1]}) to (${wall.document.c[2]},${wall.document.c[3]})`);
					console.log(`[RoutingLib] DEBUG: Movement ray: (${adjustedStart.x}, ${adjustedStart.y}) to (${stepEnd.x}, ${stepEnd.y})`);
					console.log(`[RoutingLib] DEBUG: Intersection result:`, intersection);
				}
			}
			
			// If we got an intersection with the center-to-center ray, definitely blocked
			if (intersection !== null) {
				collisionResult = true;
				break;
			}
			
			// Enhanced detection: Check if wall intersects with token footprint
			// This accounts for token size and D&D squeezing rules
			if (shouldDebug && DEBUG_CONFIG.squeezing) {
				console.log(`[RoutingLib] ENHANCED: No center-to-center intersection for (${from.x},${from.y}) → (${to.x},${to.y}), checking token footprint`);
			}
			
			const gridSize = canvas.grid.size;
			const tokenWidth = tokenData.width || 1;
			const tokenHeight = tokenData.height || 1;
			
			// D&D Squeezing rules:
			// Large (2x2) can squeeze through 1 square at double cost
			// Huge (3x3) can squeeze through 2 squares at double cost
			const isLargeCreature = tokenWidth >= 2 || tokenHeight >= 2;
			const isHugeCreature = tokenWidth >= 3 || tokenHeight >= 3;
			
			// Calculate movement direction and space available
			const moveFromGridX = Math.floor(adjustedStart.x / gridSize);
			const moveFromGridY = Math.floor(adjustedStart.y / gridSize);
			const moveToGridX = Math.floor(stepEnd.x / gridSize);
			const moveToGridY = Math.floor(stepEnd.y / gridSize);
			
			// Check if this is a squeezing scenario
			const isDiagonalMove = moveFromGridX !== moveToGridX && moveFromGridY !== moveToGridY;
			const isSingleSquareMove = Math.abs(moveFromGridX - moveToGridX) <= 1 && Math.abs(moveFromGridY - moveToGridY) <= 1;
			
			if (shouldDebug && DEBUG_CONFIG.squeezing) {
				console.log(`[RoutingLib] DEBUG: Creature size: ${tokenWidth}x${tokenHeight}, Large: ${isLargeCreature}, Huge: ${isHugeCreature}`);
				console.log(`[RoutingLib] DEBUG: Movement: (${moveFromGridX},${moveFromGridY}) → (${moveToGridX},${moveToGridY}), Diagonal: ${isDiagonalMove}`);
			}
			
			// For squeezing, we only check if the destination square itself is blocked
			// Large creatures can squeeze through 1 square, Huge through 2 squares
			const destSquareLeft = moveToGridX * gridSize;
			const destSquareTop = moveToGridY * gridSize;
			const destSquareRight = destSquareLeft + gridSize;
			const destSquareBottom = destSquareTop + gridSize;
			
			// Check if wall completely blocks the destination square
			const destSquareEdges = [
				{ start: { x: destSquareLeft, y: destSquareTop }, end: { x: destSquareRight, y: destSquareTop } },     // Top edge
				{ start: { x: destSquareRight, y: destSquareTop }, end: { x: destSquareRight, y: destSquareBottom } }, // Right edge
				{ start: { x: destSquareRight, y: destSquareBottom }, end: { x: destSquareLeft, y: destSquareBottom } }, // Bottom edge
				{ start: { x: destSquareLeft, y: destSquareBottom }, end: { x: destSquareLeft, y: destSquareTop } }     // Left edge
			];
			
			let destSquareBlocked = false;
			for (let i = 0; i < destSquareEdges.length; i++) {
				const edge = destSquareEdges[i];
				let edgeIntersection = null;
				
				try {
					const utils = foundry?.utils || window?.foundry?.utils;
					if (utils && utils['lineSegmentIntersection']) {
						edgeIntersection = utils['lineSegmentIntersection'](
							edge.start, edge.end,    // Grid square edge
							wallStart, wallEnd       // Wall segment
						);
					}
				} catch (error) {
					// Ignore errors, continue to next edge
				}
				
				if (edgeIntersection !== null) {
					// Check if intersection is exactly at wall endpoint (indicates gap, not blocking wall)
					const epsilon = 1.0; // Small tolerance for endpoint detection
					const isWallEndpoint = 
						(Math.abs(edgeIntersection.x - wallStart.x) < epsilon && Math.abs(edgeIntersection.y - wallStart.y) < epsilon) ||
						(Math.abs(edgeIntersection.x - wallEnd.x) < epsilon && Math.abs(edgeIntersection.y - wallEnd.y) < epsilon);
					
					// Also check if edge is exactly on grid boundary where wall ends
					const gridSize = canvas.grid.size;
					const isEdgeOnGridBoundary = 
						(edge.start.x % gridSize === 0 || edge.start.y % gridSize === 0) &&
						(edge.end.x % gridSize === 0 || edge.end.y % gridSize === 0);
					
					if (isWallEndpoint && isEdgeOnGridBoundary) {
						if (shouldDebug) {
							console.log(`[RoutingLib] 🟡 GAP: Wall endpoint at grid boundary (${edgeIntersection.x},${edgeIntersection.y}) - allowing movement`);
							console.log(`[RoutingLib] 🟡 Wall: (${wallStart.x},${wallStart.y}) to (${wallEnd.x},${wallEnd.y})`);
							console.log(`[RoutingLib] 🟡 Edge: (${edge.start.x},${edge.start.y}) to (${edge.end.x},${edge.end.y})`);
						}
						// This is a gap between walls - allow movement
						continue;
					} else {
						destSquareBlocked = true;
						if (shouldDebug) {
							console.log(`[RoutingLib] ❌ FOOTPRINT BLOCK: Wall intersects destination square (${moveToGridX},${moveToGridY}) edge ${i + 1}`);
							console.log(`[RoutingLib] ❌ Wall: (${wallStart.x},${wallStart.y}) to (${wallEnd.x},${wallEnd.y})`);
							console.log(`[RoutingLib] ❌ Edge: (${edge.start.x},${edge.start.y}) to (${edge.end.x},${edge.end.y})`);
							console.log(`[RoutingLib] ❌ Intersection: (${edgeIntersection.x},${edgeIntersection.y})`);
							console.log(`[RoutingLib] ❌ IsWallEndpoint: ${isWallEndpoint}, IsGridBoundary: ${isEdgeOnGridBoundary}`);
						}
						break;
					}
				}
			}
			
			// Apply D&D squeezing rules
			if (destSquareBlocked) {
				// Check if creature can squeeze through this space
				if (isLargeCreature && isSingleSquareMove) {
					// Large creatures can squeeze through 1 square at double cost
					if (shouldDebug && DEBUG_CONFIG.squeezing) {
						console.log(`[RoutingLib] DEBUG: Large creature squeezing through 1 square - difficult terrain`);
					}
					collisionResult = "squeeze"; // Allow movement but at double cost
					break;
				} else if (isHugeCreature && isSingleSquareMove) {
					// Huge creatures can squeeze through 2 squares - for now treat same as large
					// TODO: Could implement more complex 2-square squeezing logic
					if (shouldDebug && DEBUG_CONFIG.squeezing) {
						console.log(`[RoutingLib] DEBUG: Huge creature squeezing through narrow space - difficult terrain`);
					}
					collisionResult = "squeeze"; // Allow movement but at double cost
					break;
				} else {
					// Cannot squeeze - completely blocked
					if (shouldDebug && DEBUG_CONFIG.squeezing) {
						console.log(`[RoutingLib] DEBUG: Movement completely blocked - cannot squeeze`);
					}
					collisionResult = true;
					break;
				}
			}
		}
		
		blocked = collisionResult;
	} catch (error) {
		console.warn("[RoutingLib] Collision detection error:", error);
		// Default to allowing movement if collision detection fails
		blocked = false;
	}

	// Log movement results for debugging - only show important results
	const shouldDebug = shouldDebugPosition(from, to);
	
	if (blocked === true && (shouldDebug || DEBUG_CONFIG.blockedMovements)) {
		console.log(
			`%c[RoutingLib] BLOCKED  %d,%d → %d,%d (elev=%d)`,
			"color:red",
			from.x,
			from.y,
			to.x,
			to.y,
			tokenData.elevation ?? 0,
		);
	} else if (blocked === "squeeze" && (shouldDebug || DEBUG_CONFIG.blockedMovements)) {
		console.log(
			`%c[RoutingLib] SQUEEZE  %d,%d → %d,%d (elev=%d) - DIFFICULT TERRAIN`,
			"color:orange",
			from.x,
			from.y,
			to.x,
			to.y,
			tokenData.elevation ?? 0,
		);
	} else if (blocked === false && shouldDebug && DEBUG_CONFIG.allowedMovements) {
		console.log(
			`%c[RoutingLib] ALLOWED  %d,%d → %d,%d (elev=%d)`,
			"color:green",
			from.x,
			from.y,
			to.x,
			to.y,
			tokenData.elevation ?? 0,
		);
	}

	// Visualise movement results if requested
	if (canvas?.stage && shouldDebug) {
		if (blocked === true) {
			// Red line for completely blocked movement
			const g = new PIXI.Graphics();
			g.lineStyle(2, 0xff0000, 0.8)
				.moveTo(stepStart.x, stepStart.y)
				.lineTo(stepEnd.x, stepEnd.y);
			canvas.stage.addChild(g);
			setTimeout(() => g.destroy(), 5000);
		} else if (blocked === "squeeze") {
			// Orange line for squeezing movement (difficult terrain)
			const g = new PIXI.Graphics();
			g.lineStyle(2, 0xff8800, 0.8)
				.moveTo(stepStart.x, stepStart.y)
				.lineTo(stepEnd.x, stepEnd.y);
			canvas.stage.addChild(g);
			setTimeout(() => g.destroy(), 10000);
		} else if (blocked === false) {
			// Green line for allowed movement - make it more visible and last longer
			const g = new PIXI.Graphics();
			g.lineStyle(2, 0x00ff00, 0.6)
				.moveTo(stepStart.x, stepStart.y)
				.lineTo(stepEnd.x, stepEnd.y);
			canvas.stage.addChild(g);
			setTimeout(() => g.destroy(), 10000);
		}
	}
	return blocked;
}
