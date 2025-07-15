// Quick Coordinate Test Macro
// Run this in FoundryVTT console to test coordinate conversions

console.clear();
console.log("🧪 Testing Coordinate Conversions");
console.log("=================================");

// Test pixel to grid conversion
const testPixel = {x: 200, y: 300};
console.log(`🎯 Test pixel: (${testPixel.x}, ${testPixel.y})`);

// Using our fixed function
const gridResult = routinglib.pixelToGrid(testPixel.x, testPixel.y);
console.log(`📐 Grid result: (${gridResult.x}, ${gridResult.y})`);

// Convert back to pixel
const pixelResult = routinglib.gridToPixel(gridResult.x, gridResult.y);
console.log(`🔄 Back to pixel: (${pixelResult.x}, ${pixelResult.y})`);

// Test with multiple points to verify consistency
const testPoints = [
    {x: 100, y: 100},
    {x: 200, y: 200}, 
    {x: 400, y: 600}
];

console.log("\n🔍 Testing multiple points:");
testPoints.forEach((point, i) => {
    const grid = routinglib.pixelToGrid(point.x, point.y);
    const backToPixel = routinglib.gridToPixel(grid.x, grid.y);
    console.log(`Point ${i+1}: (${point.x},${point.y}) → (${grid.x},${grid.y}) → (${backToPixel.x},${backToPixel.y})`);
});

console.log("\n✅ Coordinate test complete!"); 