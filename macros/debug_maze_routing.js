// Maze Routing Debug Macro
// Use this in FoundryVTT as a Script macro to debug routing issues

(async () => {
    console.clear();
    console.log("🐛 RoutingLib Maze Debug Tools");
    console.log("==============================");
    
    // Check if routinglib is available
    if (typeof routinglib === 'undefined') {
        ui.notifications.error("RoutingLib not available! Make sure the module is active.");
        return;
    }
    
    // Debug command menu
    const debugCommands = `
🐛 ROUTING DEBUG COMMANDS:

1. Enable debug around mouse click:
   routinglib.debugNarrowPassages({x: 10, y: 18}, 3)

2. Debug specific maze barrier:
   routinglib.debugHorizontalBarrier(18, 8, 12)

3. Check walls in problem area:  
   routinglib.findWallsInArea(8, 16, 12, 20)

4. Analyze all walls:
   routinglib.analyzeWalls()

5. Test pixel/grid conversion:
   routinglib.pixelToGrid(400, 720)
   routinglib.gridToPixel(10, 18)

6. Disable debug:
   routinglib.disableDebug()

7. Show current debug status:
   routinglib.debugSummary()

VISUAL DEBUGGING:
- Red lines = blocked movement
- Orange lines = squeezing (difficult terrain) 
- Green lines = allowed movement
- Lines appear for 5-10 seconds when debug is enabled

CLICK-TO-DEBUG MODE:
`;
    
    console.log(debugCommands);
    
    // Ask user what they want to do
    const choice = await Dialog.wait({
        title: "Maze Routing Debug",
        content: `
            <h3>What would you like to debug?</h3>
            <p>Select a debug mode:</p>
        `,
        buttons: {
            clickDebug: {
                label: "🖱️ Click to Debug Area",
                callback: () => "click"
            },
            barrierDebug: {
                label: "🚧 Debug Known Barrier",
                callback: () => "barrier"
            },
            wallAnalysis: {
                label: "📊 Analyze Walls",
                callback: () => "walls"  
            },
            testPath: {
                label: "🛤️ Test Path",
                callback: () => "path"
            },
            disable: {
                label: "❌ Disable Debug",
                callback: () => "disable"
            }
        },
        default: "clickDebug"
    });
    
    switch (choice) {
        case "click":
            await clickToDebugMode();
            break;
        case "barrier":
            await barrierDebugMode(); 
            break;
        case "walls":
            analyzeWallsMode();
            break;
        case "path":
            await testPathMode();
            break;
        case "disable":
            routinglib.disableDebug();
            ui.notifications.info("🔇 Debug disabled");
            break;
    }
})();

// Click-to-debug mode
async function clickToDebugMode() {
    ui.notifications.info("🖱️ Click on the canvas to debug that area...");
    
    const handler = (event) => {
        if (event.data.button !== 0) return; // left-click only
        canvas.stage.off('pointerdown', handler);
        
        const pos = event.data.getLocalPosition(canvas.stage);
        const gridPos = routinglib.pixelToGrid(pos.x, pos.y);
        
        console.log(`🎯 Debugging area around grid position (${gridPos.x}, ${gridPos.y})`);
        
        // Enable debug for 5x5 area around click
        routinglib.debugNarrowPassages(gridPos, 2);
        
        ui.notifications.success(`🐛 Debug enabled around (${gridPos.x}, ${gridPos.y}). Watch console and canvas for red/green lines!`);
        
        // Show the debug info
        setTimeout(() => {
            routinglib.debugSummary();
            console.log("🔍 Now try testing a path that should cross this area to see debug output");
        }, 500);
    };
    
    canvas.stage.on('pointerdown', handler);
}

// Debug known problem barriers
async function barrierDebugMode() {
    const yCoord = await Dialog.wait({
        title: "Debug Horizontal Barrier",
        content: `
            <h3>Debug a horizontal barrier (like y=18)</h3>
            <div class="form-group">
                <label>Y coordinate to debug:</label>
                <input type="number" name="yCoord" value="18" />
            </div>
            <div class="form-group">
                <label>X start:</label>
                <input type="number" name="xStart" value="8" />
            </div>
            <div class="form-group">
                <label>X end:</label>
                <input type="number" name="xEnd" value="12" />
            </div>
        `,
        buttons: {
            ok: {
                label: "Debug",
                callback: (html) => {
                    return {
                        y: parseInt(html.find('[name="yCoord"]').val()),
                        xStart: parseInt(html.find('[name="xStart"]').val()), 
                        xEnd: parseInt(html.find('[name="xEnd"]').val())
                    };
                }
            }
        },
        default: "ok"
    });
    
    if (yCoord) {
        console.log(`🚧 Debugging horizontal barrier at y=${yCoord}, x=${yCoord.xStart}-${yCoord.xEnd}`);
        routinglib.debugHorizontalBarrier(yCoord.y, yCoord.xStart, yCoord.xEnd);
        ui.notifications.success(`🐛 Barrier debug enabled! Try pathfinding across y=${yCoord.y}`);
    }
}

// Analyze walls in the scene
function analyzeWallsMode() {
    console.log("📊 Analyzing all walls in scene...");
    const walls = routinglib.analyzeWalls();
    
    ui.notifications.info(`📊 Found ${walls.length} walls. Check console for details.`);
    
    // Look for common problem patterns
    const horizontalWalls = walls.filter(w => w.isHorizontal);
    const verticalWalls = walls.filter(w => w.isVertical);
    
    console.log(`\n🔍 POTENTIAL ISSUES:`);
    console.log(`- ${horizontalWalls.length} horizontal walls (potential barriers)`);
    console.log(`- ${verticalWalls.length} vertical walls`);
    
    // Find walls near common problem coordinates (like y=18)
    const problemWalls = walls.filter(w => 
        (w.startGrid.y === 18 || w.endGrid.y === 18) ||
        (w.startGrid.y === 17 || w.endGrid.y === 17) ||
        (w.startGrid.y === 19 || w.endGrid.y === 19)
    );
    
    if (problemWalls.length > 0) {
        console.log(`\n⚠️  WALLS NEAR Y=18 (common problem area):`);
        problemWalls.forEach(wall => {
            console.log(`  Wall ${wall.index}: (${wall.startGrid.x},${wall.startGrid.y}) to (${wall.endGrid.x},${wall.endGrid.y})`);
        });
    }
}

// Test pathfinding with visual feedback
async function testPathMode() {
    ui.notifications.info("🛤️ Click two points to test pathfinding between them...");
    
    // Get start point
    const startPos = await new Promise((resolve) => {
        ui.notifications.info("Click START point...");
        const handler = (event) => {
            if (event.data.button !== 0) return;
            canvas.stage.off('pointerdown', handler);
            const pos = event.data.getLocalPosition(canvas.stage);
            resolve(routinglib.pixelToGrid(pos.x, pos.y));
        };
        canvas.stage.on('pointerdown', handler);
    });
    
    // Get end point
    const endPos = await new Promise((resolve) => {
        ui.notifications.info("Click END point...");
        const handler = (event) => {
            if (event.data.button !== 0) return;
            canvas.stage.off('pointerdown', handler);
            const pos = event.data.getLocalPosition(canvas.stage);
            resolve(routinglib.pixelToGrid(pos.x, pos.y));
        };
        canvas.stage.on('pointerdown', handler);
    });
    
    console.log(`🛤️ Testing path from (${startPos.x}, ${startPos.y}) to (${endPos.x}, ${endPos.y})`);
    
    // Enable debug for the path area
    const positions = [];
    const minX = Math.min(startPos.x, endPos.x) - 1;
    const maxX = Math.max(startPos.x, endPos.x) + 1;
    const minY = Math.min(startPos.y, endPos.y) - 1;
    const maxY = Math.max(startPos.y, endPos.y) + 1;
    
    for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
            positions.push({x, y});
        }
    }
    
    routinglib.enableDebugForPositions(positions, {
        blockedMovements: true,
        allowedMovements: true,
        wallIntersections: true,
        summaryOnly: false
    });
    
    // Test the pathfinding
    try {
        const result = await routinglib.calculatePath(startPos, endPos, {
            interpolate: true
        });
        
        if (result && result.path) {
            console.log(`✅ Path found! ${result.path.length} waypoints`);
            console.log(`📊 Path cost: ${result.cost}`);
            ui.notifications.success(`✅ Path found! ${result.path.length} waypoints. Check console for details.`);
        } else {
            console.log(`❌ No path found between (${startPos.x}, ${startPos.y}) and (${endPos.x}, ${endPos.y})`);
            ui.notifications.error("❌ No path found! Check console for blocked movement details.");
        }
    } catch (error) {
        console.error("🚨 Pathfinding error:", error);
        ui.notifications.error("🚨 Pathfinding error! Check console.");
    }
} 