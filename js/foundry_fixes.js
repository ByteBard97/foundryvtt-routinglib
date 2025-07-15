// Wrapper to fix a FoundryVTT bug that causes the return values of canvas.grid.getPixelsFromGridPosition to be ordered inconsistently

// https://gitlab.com/foundrynet/foundryvtt/-/issues/4705
export function getPixelsFromGridPosition(xGrid, yGrid) {
	const coord = canvas.grid.getTopLeftPoint({i: xGrid, j: yGrid});
	if (canvas.grid.type !== CONST.GRID_TYPES.GRIDLESS) {
		return [coord.y, coord.x];
	}
	return [coord.x, coord.y];
}

// Wrapper to fix a FoundryVTT bug that causes the return values of canvas.grid.getPixelsFromGridPosition to be ordered inconsistently
// https://gitlab.com/foundrynet/foundryvtt/-/issues/4705
export function getGridPositionFromPixels(xPixel, yPixel) {
	const offset = canvas.grid.getOffset({x: xPixel, y: yPixel});
	const x = offset.i;
	const y = offset.j;
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
	const centerPoint = canvas.grid.getCenterPoint({x: r.x, y: r.y});
	r.x = centerPoint.x;
	r.y = centerPoint.y;
	return r;
}
