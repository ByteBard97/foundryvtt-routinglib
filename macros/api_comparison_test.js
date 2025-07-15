// API Comparison Test
// Run this to compare old vs new Foundry grid APIs

console.clear();
console.log("🔬 Foundry Grid API Comparison Test");
console.log("===================================");

// Test coordinates
const testPixels = [
    {x: 100, y: 100},
    {x: 200, y: 300}, 
    {x: 400, y: 600}
];

const testGrids = [
    {x: 2, y: 2},
    {x: 4, y: 6},
    {x: 8, y: 12}
];

console.log("\n📐 PIXEL TO GRID CONVERSION:");
console.log("============================");

testPixels.forEach((pixel, i) => {
    console.log(`\nTest ${i+1}: Pixel (${pixel.x}, ${pixel.y})`);
    
    // OLD API (deprecated)
    try {
        const [oldX, oldY] = canvas.grid.getGridPositionFromPixels(pixel.x, pixel.y);
        console.log(`  OLD API: getGridPositionFromPixels() = [${oldX}, ${oldY}]`);
    } catch (e) {
        console.log(`  OLD API: Error - ${e.message}`);
    }
    
    // NEW API
    try {
        const offset = canvas.grid.getOffset({x: pixel.x, y: pixel.y});
        console.log(`  NEW API: getOffset() = {i: ${offset.i}, j: ${offset.j}}`);
    } catch (e) {
        console.log(`  NEW API: Error - ${e.message}`);
    }
});

console.log("\n🎯 GRID TO PIXEL CONVERSION:");
console.log("============================");

testGrids.forEach((grid, i) => {
    console.log(`\nTest ${i+1}: Grid (${grid.x}, ${grid.y})`);
    
    // OLD API (deprecated)
    try {
        const [oldX, oldY] = canvas.grid.getPixelsFromGridPosition(grid.x, grid.y);
        console.log(`  OLD API: getPixelsFromGridPosition() = [${oldX}, ${oldY}]`);
    } catch (e) {
        console.log(`  OLD API: Error - ${e.message}`);
    }
    
    // NEW API
    try {
        const topLeft = canvas.grid.getTopLeftPoint({i: grid.x, j: grid.y});
        console.log(`  NEW API: getTopLeftPoint() = {x: ${topLeft.x}, y: ${topLeft.y}}`);
    } catch (e) {
        console.log(`  NEW API: Error - ${e.message}`);
    }
});

console.log("\n🔄 CENTER POINT CONVERSION:");
console.log("===========================");

testGrids.forEach((grid, i) => {
    console.log(`\nTest ${i+1}: Grid (${grid.x}, ${grid.y})`);
    
    // OLD API (deprecated)
    try {
        const [oldX, oldY] = canvas.grid.getCenter(grid.x, grid.y);
        console.log(`  OLD API: getCenter() = [${oldX}, ${oldY}]`);
    } catch (e) {
        console.log(`  OLD API: Error - ${e.message}`);
    }
    
    // NEW API
    try {
        const center = canvas.grid.getCenterPoint({i: grid.x, j: grid.y});
        console.log(`  NEW API: getCenterPoint() = {x: ${center.x}, y: ${center.y}}`);
    } catch (e) {
        console.log(`  NEW API: Error - ${e.message}`);
    }
});

console.log("\n🧮 GRID SIZE INFO:");
console.log("==================");
console.log(`Grid size: ${canvas.grid.size}`);
console.log(`Grid type: ${canvas.grid.type} (${CONST.GRID_TYPES.SQUARE === canvas.grid.type ? 'SQUARE' : 'OTHER'})`);
console.log(`Canvas dimensions: ${canvas.dimensions.width} x ${canvas.dimensions.height}`);

console.log("\n✅ API Comparison complete!");
console.log("Look for differences that might explain the coordinate bugs."); 