/* eslint-disable no-undef */
import {initializeBackground, createAsyncPathfinder, cancelJob} from "./background.js";
import {cache, GriddedCache, initializeCaches, wipeCaches, enableDebugForPositions, disableDebug, debugNarrowPassages, debugHorizontalBarrier, debugSummary, pixelToGrid, gridToPixel, analyzeWalls, findWallsInArea} from "./cache.js";
import {GriddedPathfinder, GridlessPathfinder} from "./pathfinder.js";
import { NavmeshBuilder } from './navmesh_builder.js';
import { NavmeshDebugger } from './navmesh_debugger.js';
import { Pathfinding } from './lib/three-pathfinding.mjs';
import { jsts } from './lib/jsts-wrapper.js';
import { poly2tri } from './lib/poly2tri-wrapper.js';

import initGridlessPathfinding from "../wasm/gridless_pathfinding.js";
import {getAltOrientationFlagForToken, getHexTokenSize, isModuleActive} from "./util.js";

let foundryReady = false;
let wasmReady = false;

// Navmesh variables
let pathfinding;
let navmeshDebugger;

// Define creature sizes and their radii in grid units (e.g., 0.5 for a Medium creature)
// We'll convert this to pixels before passing it to the builder.
const CREATURE_SIZES = {
    "Medium": 0, // A radius of 0 represents a point, which is our default.
    "Large": 0.5, // A 5ft radius, assuming a 5ft grid.
    "Huge": 1.0,  // A 10ft radius.
};

// Hook into the canvasReady event
Hooks.on('canvasReady', async () => {
    console.log('RoutingLib | Canvas is ready, initializing navmesh...');
    
    navmeshDebugger = new NavmeshDebugger();
    pathfinding = new Pathfinding();

    await regenerateNavmesh();
});

/**
 * Regenerates the navmesh for all defined creature sizes and updates the cache.
 */
async function regenerateNavmesh() {
    console.log('RoutingLib | Wall change detected. Regenerating navmeshes for all sizes...');
    
    const builder = new NavmeshBuilder();
    const NAVMESH_FLAG_PREFIX = 'navmeshData';

    // Filter for walls that block movement
    const walls = canvas.walls.documents.filter(wall => !(wall.door === CONST.WALL_DOOR_TYPES.DOOR && wall.ds === CONST.WALL_DOOR_STATES.OPEN));
    
    for (const size in CREATURE_SIZES) {
        const radiusInGridUnits = CREATURE_SIZES[size];
        const agentRadiusInPixels = radiusInGridUnits * canvas.grid.size;

        console.log(`RoutingLib | Building navmesh for size: ${size} (radius: ${agentRadiusInPixels}px)...`);

        // Build the navmesh
        const zoneData = builder.build(walls, canvas.dimensions, agentRadiusInPixels);
        const flagName = `${NAVMESH_FLAG_PREFIX}-${size}`;

        if (zoneData) {
            // In a real implementation, we would set pathfinding data for each size.
            // For now, we'll just set the Medium one as the default.
            if (size === "Medium") {
                pathfinding.setZoneData('scene', zoneData);
            }
            
            // Save the new navmesh to the cache
            await canvas.scene.setFlag('routinglib', flagName, zoneData);
            console.log(`RoutingLib | Navmesh for ${size} regenerated and cache updated.`);

        } else {
            console.error(`RoutingLib | Navmesh regeneration failed for size: ${size}.`);
        }
    }

    // For debugging, always draw the last generated mesh.
    // In a real implementation, you might have a dropdown to select which mesh to view.
    navmeshDebugger.drawTriangles(builder.triangles);
}

// Hooks for wall updates
Hooks.on('createWall', regenerateNavmesh);
Hooks.on('updateWall', regenerateNavmesh);
Hooks.on('deleteWall', regenerateNavmesh);


// ---------------------------------------------------------------------------
//  Build identifier – bump manually when you make local changes and want to
//  confirm the browser has reloaded the latest code.  A simple integer or
//  date-string works fine.
// ---------------------------------------------------------------------------
export const BUILD_ID = "2025-07-15a";

function initializePathfinder(from, to, options) {
	const token = options.token;

	let elevation = options.elevation;
	/** @type {any} */ let tokenData;

	if (token) {
		tokenData = {width: token.document.width, height: token.document.height};
		if (!elevation) {
			elevation = isModuleActive("wall-height") && token.losHeight !== undefined
				? token.losHeight
				: token.document.elevation;
		}
		if (canvas.grid.isHexagonal) {
			tokenData.size = getHexTokenSize(token);
			tokenData.altOrientation = getAltOrientationFlagForToken(token, tokenData.size);
		}
	} else {
		tokenData = {width: 1, height: 1};
		elevation = elevation ?? 0;
		if (canvas.grid.isHexagonal) {
			tokenData.size = 1;
			tokenData.altOrientation = false;
		}
	}

	tokenData.elevation = elevation;

	const levelIndex = cache.getLevelIndexForElevation(elevation);
	if (canvas.grid.type === CONST.GRID_TYPES.GRIDLESS) {
		const tokenSize = Math.max(tokenData.width, tokenData.height);
		const graph = cache.getGraphFor(tokenSize, levelIndex, elevation);
		return new GridlessPathfinder(graph, from, to, options);
	} else {
		const sizeIndex = GriddedCache.getSnapPointIndexForTokenData(tokenData);
		return new GriddedPathfinder(sizeIndex, levelIndex, from, to, token, tokenData, options);
	}
}

function calculatePath(from, to, options = {}) {
	const pathfinder = initializePathfinder(from, to, options);
	return createAsyncPathfinder(pathfinder);
}

function calculatePathBlocking(from, to, options = {}) {
	if (!options.maxDistance) {
		throw "A maximum distance (options.maxDistance) must be specified when calling `calculatePathBlocking`. To calculte long paths, please use the ";
	}
	const pathfinder = initializePathfinder(from, to, options);

	let path = undefined;
	while (path === undefined) {
		path = pathfinder.step();
	}

	if (path === null) {
		return null;
	}

	return pathfinder.postProcessResult(path);
}

Hooks.once("init", async () => {
	game.settings.register("routinglib", "gridlessTokenSizeRatio", {
		scope: "world",
		config: false,
		type: Number,
		default: 0.9,
		onChange: () => {
			if (canvas.grid.type === CONST.GRID_TYPES.GRIDLESS) {
				cache.reset();
			}
		},
	});
});

Hooks.once("ready", async () => {
	foundryReady = true;
	initializeIfReady();
});

initGridlessPathfinding().then(() => {
	wasmReady = true;
	initializeIfReady();
});

function initializeIfReady() {
	if (!foundryReady || !wasmReady) return;
	initializeCaches();
	initializeBackground();

	// ────────────────────────────
	//  Fancy banner so users (and devs) know RoutingLib is active
	// ────────────────────────────
	const version = game.modules.get("routinglib")?.version ?? "dev";
	const banner = String.raw`
 ██▀███   ▒█████   █    ██ ▄▄▄█████▓ ██▓ ███▄    █   ▄████  ██▓     ██▓ ▄▄▄▄   
▓██ ▒ ██▒▒██▒  ██▒ ██  ▓██▒▓  ██▒ ▓▒▓██▒ ██ ▀█   █  ██▒ ▀█▒▓██▒    ▓██▒▓█████▄ 
▓██ ░▄█ ▒▒██░  ██▒▓██  ▒██░▒ ▓██░ ▒░▒██▒▓██  ▀█ ██▒▒██░▄▄▄░▒██░    ▒██▒▒██▒ ▄██
▒██▀▀█▄  ▒██   ██░▓▓█  ░██░░ ▓██▓ ░ ░██░▓██▒  ▐▌██▒░▓█  ██▓▒██░    ░██░▒██░█▀  
░██▓ ▒██▒░ ████▓▒░▒▒█████▓   ▒██▒ ░ ░██░▒██░   ▓██░░▒▓███▀▒░██████▒░██░░▓█  ▀█▓
░ ▒▓ ░▒▓░░ ▒░▒░▒░ ░▒▓▒ ▒ ▒   ▒ ░░   ░▓  ░ ▒░   ▒ ▒  ░▒   ▒ ░ ▒░▓  ░░▓  ░▒▓███▀▒
  ░▒ ░ ▒░  ░ ▒ ▒░ ░░▒░ ░ ░     ░     ▒ ░░ ░░   ░ ▒░  ░   ░ ░ ░ ▒  ░ ▒ ░▒░▒   ░ 
  ░░   ░ ░ ░ ░ ▒   ░░░ ░ ░   ░       ▒ ░   ░   ░ ░ ░ ░   ░   ░ ░    ▒ ░ ░    ░ 
   ░         ░ ░     ░               ░           ░       ░     ░  ░ ░   ░      
                                                                             ░ `;

	// Print with a green monospace style
	// eslint-disable-next-line no-console
	console.log(`%c${banner}`, "color:#4caf50; font-family:monospace;");
	// eslint-disable-next-line no-console
	console.log(`%cRoutingLib v${version}  build ${BUILD_ID} loaded`, "color:#4caf50; font-family:monospace;");

	window.routinglib = {
		calculatePath, 
		calculatePathBlocking, 
		cancelPathfinding,
		// Debug functions
		enableDebugForPositions,
		disableDebug,
		debugNarrowPassages,
		debugHorizontalBarrier,
		debugSummary,
		// Coordinate and wall analysis
		pixelToGrid,
		gridToPixel,
		analyzeWalls,
		findWallsInArea
	};

	Hooks.on("canvasInit", wipeCaches);
	// TODO There's no point in re-running jobs when switching scenes. Better cancel them all in that case
	Hooks.on("canvasReady", initializeCaches);
	Hooks.on("createWall", wipeCaches);
	Hooks.on("updateWall", wipeCaches);
	Hooks.on("deleteWall", wipeCaches);

	// Rebuild path-finding graphs automatically when the Scene grid
	// configuration is changed (size, type, etc.).  Otherwise a stale
	// cache from the previous grid resolution can lead to phantom blockers.
	Hooks.on("updateScene", (scene, diff) => {
		if (diff.grid || diff.gridSize || diff.gridType) {
			// eslint-disable-next-line no-console
			console.log("[RoutingLib] Grid settings changed – rebuilding caches");
			wipeCaches();        // drops all graphs immediately
			initializeCaches();  // rebuild for the new grid
		}
	});

	Hooks.callAll("routinglib.ready");
}

function cancelPathfinding(promise) {
	return cancelJob(promise);
}
