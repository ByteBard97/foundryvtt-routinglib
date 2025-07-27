// @ts-nocheck
// Debug Movement Test Macro - Now with Wall Collision Testing & RoutingLib Diagnostics
// Select a token and run this to test pathfinding and movement fixes

(async () => {
    const selectedTokens = canvas.tokens.controlled;
    
    if (selectedTokens.length !== 1) {
        ui.notifications.warn('Please select exactly one token to test movement.');
        return;
    }
    
    const token = selectedTokens[0];
    const MODULE_ID = 'dnd5e-ai-combat-assistant';
    
    // Import helper functions
    const helpers = game.modules.get(MODULE_ID)?.api;
    const { findPath, moveTokenAlongPath, debugRenderPath } = helpers || {};
    
    if (!findPath || !moveTokenAlongPath) {
        ui.notifications.error('AI helpers not loaded. Make sure the module is enabled.');
        return;
    }
    
    console.log('🧪 === MOVEMENT DEBUG TEST ===');
    console.log('Selected token:', token.name, 'at', token.x, token.y);
    
    // === ROUTINGLIB DIAGNOSTICS ===
    console.log('\n📊 === ROUTINGLIB DIAGNOSTICS ===');
    const rl = globalThis.routinglib;
    if (!rl) {
        console.error('❌ RoutingLib not available!');
        ui.notifications.error('RoutingLib is not loaded. Check that foundryvtt-routinglib module is active.');
        return;
    }
    
    console.log('✅ RoutingLib loaded');
    console.log('Available functions:', Object.keys(rl).filter(k => typeof rl[k] === 'function'));
    
    // Check walls in current scene
    console.log('\n🧱 === WALL ANALYSIS ===');
    const walls = canvas.walls.placeables;
    console.log(`Total walls: ${walls.length}`);
    
    const movementBlockingWalls = walls.filter(wall => 
        wall.document.move !== CONST.WALL_MOVEMENT_TYPES.NONE
    );
    console.log(`Movement-blocking walls: ${movementBlockingWalls.length}`);
    
    if (movementBlockingWalls.length > 0) {
        console.log('First 5 movement-blocking walls:');
        for (let i = 0; i < Math.min(5, movementBlockingWalls.length); i++) {
            const wall = movementBlockingWalls[i];
            console.log(`  Wall ${i + 1}: (${wall.document.c[0]}, ${wall.document.c[1]}) → (${wall.document.c[2]}, ${wall.document.c[3]})`);
        }
    }
    
    // Test RoutingLib wall detection
    if (typeof rl.analyzeWalls === 'function') {
        try {
            console.log('\n🔍 RoutingLib wall analysis:');
            const wallAnalysis = rl.analyzeWalls();
            console.log(wallAnalysis);
        } catch (err) {
            console.warn('RoutingLib analyzeWalls failed:', err);
        }
    }
    
    // === INTERACTIVE TARGET SELECTION ===
    console.log('\n🎯 === INTERACTIVE TARGET SELECTION ===');
    ui.notifications.info('Click on the canvas to test movement to that location.');
    
    // Create a click handler for target selection
    const clickHandler = async (event) => {
        // Remove the click handler after first use
        canvas.stage.off('click', clickHandler);
        
        // Get click coordinates
        const clickPos = event.data.getLocalPosition(canvas.stage);
        console.log(`🖱️ Click detected at: (${clickPos.x.toFixed(1)}, ${clickPos.y.toFixed(1)})`);
        
        try {
            // === PATH CALCULATION TEST ===
            console.log('\n🗺️ === PATH CALCULATION ===');
            const pathResult = await findPath(token, clickPos);
            console.log('Path result:', pathResult);
            
            if (pathResult.path && pathResult.path.length > 0) {
                console.log(`Path has ${pathResult.path.length} waypoints, cost: ${pathResult.cost.toFixed(1)} ft`);
                
                // Show path visually
                if (debugRenderPath) {
                    await debugRenderPath(token, pathResult.path, 5000);
                }
                
                // === COLLISION VALIDATION TEST ===
                console.log('\n🛡️ === COLLISION VALIDATION ===');
                
                // Import the validation function directly
                const { validateMovementPath } = await import('../utils/pathService.js');
                const isPathValid = validateMovementPath(token, pathResult.path);
                
                console.log(`Path validation result: ${isPathValid ? '✅ VALID' : '❌ BLOCKED'}`);
                
                if (isPathValid) {
                    // === MOVEMENT TEST ===
                    console.log('\n🚶 === MOVEMENT TEST ===');
                    const confirmation = await Dialog.confirm({
                        title: "Execute Movement?", 
                        content: `<p>Path validation passed. Execute movement to target?</p>
                                 <p><strong>Distance:</strong> ${pathResult.cost.toFixed(1)} ft</p>
                                 <p><strong>Waypoints:</strong> ${pathResult.path.length}</p>`,
                        yes: () => true,
                        no: () => false
                    });
                    
                    if (confirmation) {
                        console.log('🏃 Executing movement...');
                        const moveResult = await moveTokenAlongPath(token, pathResult.path);
                        console.log('Movement result:', moveResult);
                        
                        if (moveResult.reached) {
                            ui.notifications.info(`✅ Movement successful! Moved ${moveResult.movedFt.toFixed(1)} ft`);
                        } else {
                            ui.notifications.warn(`⚠️ Movement failed - ${moveResult.actualDistance.toFixed(1)} pixels from target`);
                        }
                    }
                } else {
                    ui.notifications.warn('❌ Movement blocked by walls - path validation failed');
                }
            } else {
                console.error('❌ No valid path found');
                ui.notifications.error('No valid path to target location');
            }
            
        } catch (error) {
            console.error('Movement test failed:', error);
            ui.notifications.error(`Movement test failed: ${error.message}`);
        }
        
        console.log('🧪 === MOVEMENT DEBUG TEST COMPLETE ===');
    };
    
    // Add click handler to canvas
    canvas.stage.on('click', clickHandler);
    
    // === ROUTINGLIB SPECIFIC TESTS ===
    if (typeof rl.testMovement === 'function') {
        console.log('\n🧪 === ROUTINGLIB MOVEMENT TESTS ===');
        
        // Test movement to adjacent squares
        const tokenCenter = {
            x: token.x + token.w / 2,
            y: token.y + token.h / 2
        };
        
        const gridSize = canvas.grid.size;
        const testOffsets = [
            { dx: gridSize, dy: 0, name: 'East' },
            { dx: -gridSize, dy: 0, name: 'West' },
            { dx: 0, dy: gridSize, name: 'South' },
            { dx: 0, dy: -gridSize, name: 'North' }
        ];
        
        for (const offset of testOffsets) {
            const testTarget = {
                x: tokenCenter.x + offset.dx,
                y: tokenCenter.y + offset.dy
            };
            
            try {
                    const startOffset = canvas.grid.getOffset(tokenCenter);
    const startGrid = [startOffset.i, startOffset.j];
    const targetOffset = canvas.grid.getOffset(testTarget);
    const targetGrid = [targetOffset.i, targetOffset.j];
                
                const canMove = rl.testMovement(
                    { x: startGrid[1], y: startGrid[0] },
                    { x: targetGrid[1], y: targetGrid[0] },
                    { token }
                );
                
                console.log(`  ${offset.name}: ${canMove ? '✅ Clear' : '❌ Blocked'}`);
            } catch (err) {
                console.warn(`  ${offset.name}: ⚠️ Test failed -`, err.message);
            }
        }
    }
    
    ui.notifications.info('Movement debug test ready. Click on canvas to test movement to a location.');
})(); 