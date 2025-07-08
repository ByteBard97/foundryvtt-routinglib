// Wrapper to fix a FoundryVTT bug that causes the return values of canvas.grid.getPixelsFromGridPosition to be ordered inconsistently

// https://gitlab.com/foundrynet/foundryvtt/-/issues/4705
export function getPixelsFromGridPosition(xGrid, yGrid) {
	const coord = canvas.grid.getTopLeftPoint({i: xGrid, j: yGrid});
	if (canvas.grid.type !== CONST.GRID_TYPES.GRIDLESS) {
		return [coord.y, coord.x];
	}
	// return canvas.grid.getPixelsFromGridPosition(xGrid, yGrid);
	return [coord.x, coord.y];
}

// Wrapper to fix a FoundryVTT bug that causes the return values of canvas.grid.getPixelsFromGridPosition to be ordered inconsistently
// https://gitlab.com/foundrynet/foundryvtt/-/issues/4705
export function getGridPositionFromPixels(xPixel, yPixel) {
	const [x, y] = canvas.grid.getGridPositionFromPixels(xPixel, yPixel);
	if (canvas.grid.type !== CONST.GRID_TYPES.GRIDLESS) return [y, x];
	return [x, y];
}

export function getGridPositionFromPixelsObj(o) {
	const r = {};
	[r.x, r.y] = getGridPositionFromPixels(o.x, o.y);
	return r;
}

export function getPixelsFromGridPositionObj(o) {
	const r = {};
	[r.x, r.y] = getPixelsFromGridPosition(o.x, o.y);
	return r;
}

export function getCenterFromGridPositionObj(o) {
	const r = getPixelsFromGridPositionObj(o);
	[r.x, r.y] = canvas.grid.getCenter(r.x, r.y);
	return r;
}
