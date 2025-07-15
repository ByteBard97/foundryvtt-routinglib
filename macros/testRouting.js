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
      const offset = canvas.grid.getOffset({x: pt.x, y: pt.y});
      return { x: offset.i, y: offset.j }; // routinglib expects {x:col, y:row}
    };

    const gridToPixelCenter = (gp) => {
      const centerPoint = canvas.grid.getCenterPoint({i: gp.x, j: gp.y});
      return { x: centerPoint.x, y: centerPoint.y };
    };
  
    // ---------------------------------------------------------------------------
    // Gather user input
    // ---------------------------------------------------------------------------
    const startPx = await waitForClick('start point');
    const endPx   = await waitForClick('end point');
  
    // ---------------------------------------------------------------------------
    // Create temporary token for pathfinding
    // ---------------------------------------------------------------------------
    const tempTokenData = {
      name: "Temp Pathfinding Token",
      x: startPx.x - (canvas.grid.size / 2), // Center the token on start point
      y: startPx.y - (canvas.grid.size / 2),
      width: 1,                // Token width in grid units
      height: 1,               // Token height in grid units
      texture: {
        src: "icons/svg/mystery-man.svg" // Default token image
      },
      actorId: null,           // No associated actor
      actorLink: false,        // Not linked to actor
      disposition: CONST.TOKEN_DISPOSITIONS.NEUTRAL, // Neutral disposition
      hidden: true,            // Hide from players
      locked: false,           // Not locked
      elevation: 0,            // Ground level
      rotation: 0,             // No rotation
      alpha: 1,                // Fully opaque
      flags: { 'ai-combat-assistant': { temporary: true } }
    };
  
    ui.notifications.info('Creating temporary token for pathfinding...');
    
    let tempToken;
    try {
      const tokenDocs = await canvas.scene.createEmbeddedDocuments('Token', [tempTokenData]);
      const tokenDoc = tokenDocs[0];
      
      // Create a token object structure that routinglib expects
      // Routinglib expects token.document.width/height, so we need to wrap our document
      tempToken = {
        document: tokenDoc,
        // Add any other properties routinglib might need
        losHeight: tokenDoc.elevation
      };
      
      console.debug('Created temporary token:', tokenDoc.id);
    } catch (err) {
      console.error('Failed to create temporary token:', err);
      ui.notifications.error('Failed to create temporary token for pathfinding.');
      return;
    }
  
    // ---------------------------------------------------------------------------
    // Pathfinding via Routinglib (with debug logging)
    // ---------------------------------------------------------------------------
    const startGrid = pixelToGrid(startPx);
    const endGrid   = pixelToGrid(endPx);
  
    console.debug('Routinglib input (grid):', startGrid, '→', endGrid);
  
    let pathRes;
    try {
      // Use the temporary token for pathfinding
      pathRes = await rl.calculatePath(startGrid, endGrid, { 
        interpolate: true,
        token: tempToken // Pass the temporary token to routinglib
      });
      console.debug('Routinglib result:', pathRes);
    } catch (err) {
      console.error('Routinglib threw an error:', err);
      ui.notifications.error('Routinglib error – see console.');
      // Clean up the temporary token before returning
      try {
        await canvas.scene.deleteEmbeddedDocuments('Token', [tempToken.document.id]);
        console.debug('Cleaned up temporary token');
      } catch (cleanupErr) {
        console.warn('Failed to clean up temporary token:', cleanupErr);
      }
      return;
    }
  
    if (!pathRes || !pathRes.path?.length) {
      ui.notifications.warn('Routinglib returned no path between the selected points.');
      // Clean up the temporary token before returning
      try {
        await canvas.scene.deleteEmbeddedDocuments('Token', [tempToken.document.id]);
        console.debug('Cleaned up temporary token');
      } catch (cleanupErr) {
        console.warn('Failed to clean up temporary token:', cleanupErr);
      }
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
      author: game.user.id,
      x: minX,
      y: minY,
      shape: {
        type: foundry.data.ShapeData.TYPES.POLYGON,
        points: relPoints
      },
      strokeWidth: 4,
      strokeColor: '#00ff00',
      strokeAlpha: 1.0,        // Ensure stroke is visible
      fillType: CONST.DRAWING_FILL_TYPES.NONE,  // No fill
      fillColor: '#ffffff',    // Default fill color (not used due to fillType)
      fillAlpha: 0.0,          // Transparent fill
      texture: null,           // No texture
      hidden: false,           // Make sure it's visible
      locked: false,           // Not locked
      flags: { 'ai-combat-assistant': { routingPath: true } },
    };
  
    try {
      await canvas.scene.createEmbeddedDocuments('Drawing', [drawingData]);
      ui.notifications.info('Path drawing created successfully!');
    } catch (error) {
      console.error('Failed to create drawing:', error);
      ui.notifications.error('Failed to create path drawing. Check console for details.');
    }
  
    // ---------------------------------------------------------------------------
    // Clean up temporary token
    // ---------------------------------------------------------------------------
    try {
      await canvas.scene.deleteEmbeddedDocuments('Token', [tempToken.document.id]);
      console.debug('Cleaned up temporary token');
    } catch (cleanupErr) {
      console.warn('Failed to clean up temporary token:', cleanupErr);
      ui.notifications.warn('Path created but failed to clean up temporary token.');
    }
  })();