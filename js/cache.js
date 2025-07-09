import {resetJobs} from "./background.js";
import {getPixelsFromGridPositionObj} from "./foundry_fixes.js";
import {getSnapPointForTokenDataObj, isModuleActive} from "./util.js";

import * as GridlessPathfinding from "../wasm/gridless_pathfinding.js";

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

			// Debug logging for graph construction (only for debug builds)
			if (neighbors.length === 0) {
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

	let blocked = false;

	try {
		// Temporarily use simplified ray-based collision detection for debugging
		const ray = new Ray(adjustedStart, stepEnd);
		
		// Debug logging for movements that might cross the diagonal wall
		const shouldDebug = (from.x >= 16 && from.x <= 20 && from.y >= 15 && from.y <= 19) ||
						   (to.x >= 16 && to.x <= 20 && to.y >= 15 && to.y <= 19);
		
		if (shouldDebug) {
			console.log(`[RoutingLib] DEBUG: === COLLISION CHECK ===`);
			console.log(`[RoutingLib] DEBUG: Grid movement: (${from.x}, ${from.y}) → (${to.x}, ${to.y})`);
			console.log(`[RoutingLib] DEBUG: Pixel movement: (${adjustedStart.x}, ${adjustedStart.y}) → (${stepEnd.x}, ${stepEnd.y})`);
			console.log(`[RoutingLib] DEBUG: Found ${canvas.walls.placeables.length} walls to check`);
		}
		
		// Check each wall for collision using traditional method
		blocked = canvas.walls.placeables.some(wall => {
			// Skip walls that don't block movement
			if (wall.document.move === CONST.WALL_MOVEMENT_TYPES.NONE) {
				if (shouldDebug) console.log(`[RoutingLib] DEBUG: Skipping wall - doesn't block movement: ${wall.document.move}`);
				return false;
			}
			
			// Skip open doors
			if (wall.document.door !== CONST.WALL_DOOR_TYPES.NONE && 
				wall.document.ds === CONST.WALL_DOOR_STATES.OPEN) {
				if (shouldDebug) console.log(`[RoutingLib] DEBUG: Skipping wall - open door`);
				return false;
			}
			
			// Check wall height if wall-height module is active
			if (isModuleActive("wall-height")) {
				const wallHeight = wall.document.flags["wall-height"];
				const elevation = tokenData.elevation ?? 0;
				const top = wallHeight?.top ?? Infinity;
				const bottom = wallHeight?.bottom ?? -Infinity;
				if (elevation < bottom || elevation > top) {
					if (shouldDebug) console.log(`[RoutingLib] DEBUG: Skipping wall - elevation mismatch: token=${elevation}, wall=${bottom}-${top}`);
					return false; // Token is outside wall height range
				}
			}
			
			// Use foundry.utils.lineSegmentIntersection for reliable collision detection
			if (shouldDebug) {
				console.log(`[RoutingLib] DEBUG: Testing wall segment: (${wall.document.c[0]},${wall.document.c[1]}) to (${wall.document.c[2]},${wall.document.c[3]})`);
				console.log(`[RoutingLib] DEBUG: Movement ray: (${adjustedStart.x}, ${adjustedStart.y}) to (${stepEnd.x}, ${stepEnd.y})`);
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
					if (shouldDebug) console.log(`[RoutingLib] DEBUG: Using foundry.utils.lineSegmentIntersection`);
				} else {
					// Fallback: use the ray intersectSegment method
					const wallSegment = {
						A: wallStart,
						B: wallEnd
					};
					intersection = ray.intersectSegment(wallSegment);
					if (shouldDebug) console.log(`[RoutingLib] DEBUG: Using ray.intersectSegment fallback`);
				}
			} catch (error) {
				if (shouldDebug) console.log(`[RoutingLib] DEBUG: Intersection method error:`, error.message);
				intersection = null;
			}
			
			if (shouldDebug) {
				console.log(`[RoutingLib] DEBUG: Intersection result:`, intersection);
			}
			
			// If we got an intersection with the center-to-center ray, definitely blocked
			if (intersection !== null) {
				return true;
			}
			
			// Enhanced detection: Check if wall intersects with the grid square boundaries
			// This catches walls that partially cross grid squares but don't intersect center-to-center movement
			if (shouldDebug) {
				console.log(`[RoutingLib] DEBUG: No center-to-center intersection, checking grid square boundaries`);
			}
			
			// Calculate grid square boundaries for the destination square
			const gridSize = canvas.grid.size;
			const destGridX = Math.floor(stepEnd.x / gridSize);
			const destGridY = Math.floor(stepEnd.y / gridSize);
			const squareLeft = destGridX * gridSize;
			const squareTop = destGridY * gridSize;
			const squareRight = squareLeft + gridSize;
			const squareBottom = squareTop + gridSize;
			
			// Check if wall intersects with any of the four grid square edges
			const squareEdges = [
				{ start: { x: squareLeft, y: squareTop }, end: { x: squareRight, y: squareTop } },     // Top edge
				{ start: { x: squareRight, y: squareTop }, end: { x: squareRight, y: squareBottom } }, // Right edge
				{ start: { x: squareRight, y: squareBottom }, end: { x: squareLeft, y: squareBottom } }, // Bottom edge
				{ start: { x: squareLeft, y: squareBottom }, end: { x: squareLeft, y: squareTop } }     // Left edge
			];
			
			for (let i = 0; i < squareEdges.length; i++) {
				const edge = squareEdges[i];
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
					if (shouldDebug) {
						console.log(`[RoutingLib] DEBUG: Wall intersects grid square edge ${i + 1}, blocking movement`);
					}
					return true; // Wall intersects with grid square boundary
				}
			}
			
			// Return true if there's an intersection (collision detected)
			return false;
		});
	} catch (error) {
		console.warn("[RoutingLib] Collision detection error:", error);
		// Default to allowing movement if collision detection fails
		blocked = false;
	}

	// Only log blocked movements for debugging
	if (blocked) {
		console.log(
			`%c[RoutingLib] BLOCKED  %d,%d → %d,%d (elev=%d)`,
			"color:red",
			from.x,
			from.y,
			to.x,
			to.y,
			tokenData.elevation ?? 0,
		);
	}

	// Visualise blocker if requested
	if (blocked && canvas?.stage) {
		const g = new PIXI.Graphics();
		g.lineStyle(2, 0xff0000, 0.8)
			.moveTo(stepStart.x, stepStart.y)
			.lineTo(stepEnd.x, stepEnd.y);
		// auto-remove after 3 seconds
		canvas.stage.addChild(g);
		setTimeout(() => g.destroy(), 20000);
	}
	return blocked;
}
