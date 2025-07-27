/*
 * Draw Routinglib Path
 * --------------------
 * 1. Run the macro.
 * 2. Click a start point, then an end point on the canvas.
 * 3. A green poly-line Drawing will be created that traces the optimal path
 *    returned by Routinglib between the two points.
 *
 * Notes
 * -----
 * • Requires the "foundryvtt-routinglib" module to be active.
 * • Ignores D&D 5e movement rules – purely visual.
 * • Works on square or hex grids. Grid-less scenes will simply draw a
 *   straight line (Routinglib treats those as grid-less graphs).
 */

(async () => {
  // ---------------------------------------------------------------------------
  // Safety checks
  // ---------------------------------------------------------------------------
  const rl = globalThis.routinglib;
  if (!rl || typeof rl.calculatePath !== 'function') {
    ui.notifications.error('Routinglib is not available or failed to initialise.');
    return;
  }

  // Helper: wait for a single left-click on the canvas and return pixel coords
  const waitForClick = (label) =>
    new Promise((resolve) => {
      ui.notifications.info(`Click a point on the canvas to set the ${label}.`);
      const handler = (event) => {
        if (event.data.button !== 0) return; // left-click only
        canvas.stage.off('pointerdown', handler);
        const pos = event.data.getLocalPosition(canvas.stage);
        resolve({ x: pos.x, y: pos.y });
      };
      canvas.stage.on('pointerdown', handler);
    });

  // Convert helpers -----------------------------------------------------------
  const pixelToGrid = (pt) => {
            const offset = canvas.grid.getOffset(pt);
        const [row, col] = [offset.i, offset.j];
    return { x: col, y: row }; // routinglib expects {x:col, y:row}
  };

  const gridToPixelCenter = (gp) => {
    const tl = canvas.grid.getTopLeftPoint({ i: gp.y, j: gp.x });
    const [cx, cy] = canvas.grid.getCenter(tl.x, tl.y);
    return { x: cx, y: cy };
  };

  // ---------------------------------------------------------------------------
  // Gather user input
  // ---------------------------------------------------------------------------
  const startPx = await waitForClick('start point');
  const endPx   = await waitForClick('end point');

  // ---------------------------------------------------------------------------
  // Pathfinding via Routinglib (with debug logging)
  // ---------------------------------------------------------------------------
  const startGrid = pixelToGrid(startPx);
  const endGrid   = pixelToGrid(endPx);

  console.debug('Routinglib input (grid):', startGrid, '→', endGrid);

  let pathRes;
  try {
    pathRes = await rl.calculatePath(startGrid, endGrid, { interpolate: true });
    console.debug('Routinglib result:', pathRes);
  } catch (err) {
    console.error('Routinglib threw an error:', err);
    ui.notifications.error('Routinglib error – see console.');
    return;
  }

  if (!pathRes || !pathRes.path?.length) {
    ui.notifications.warn('Routinglib returned no path between the selected points.');
    return;
  }

  // Convert grid waypoints -> pixel centres -----------------------------------
  const pixelPath = pathRes.path.map(gridToPixelCenter);

  // ---------------------------------------------------------------------------
  // Create a Drawing object that traces the path
  // ---------------------------------------------------------------------------
  const minX = Math.min(...pixelPath.map((p) => p.x));
  const minY = Math.min(...pixelPath.map((p) => p.y));
  const relPoints = pixelPath.flatMap((p) => [p.x - minX, p.y - minY]);

  const drawingData = {
    type: 'polygon',
    author: game.user.id,
    x: minX,
    y: minY,
    strokeWidth: 4,
    strokeColor: '#00ff00',
    strokeAlpha: 0.9,
    fillAlpha: 0,
    points: relPoints,
    flags: { 'ai-combat-assistant': { routingPath: true } },
  };

  await canvas.scene.createEmbeddedDocuments('Drawing', [drawingData]);
})(); 