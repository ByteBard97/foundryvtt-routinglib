// RoutingLib Development Reload Macro
// Use this in FoundryVTT as a Script macro for development

(async () => {
    console.clear();
    console.log("🔄 RoutingLib Development Reload");
    console.log("================================");
    
    const MOD_ID = "routinglib";
    const mod = game.modules.get(MOD_ID);
    
    if (!mod) {
        ui.notifications.error(`Module ${MOD_ID} not found`);
        console.error(`❌ Module ${MOD_ID} not found`);
        return;
    }
    
    console.log(`📦 Module: ${mod.title} v${mod.version}`);
    console.log(`🔧 Active: ${mod.active}`);
    
    // Check if routinglib is ready
    if (typeof routinglib !== 'undefined') {
        console.log("✅ RoutingLib API available");
        
        // Display current build ID if available
        if (typeof BUILD_ID !== 'undefined') {
            console.log(`🏗️  Build ID: ${BUILD_ID}`);
        }
        
        // Test basic functionality
        try {
            console.log("🧪 Testing basic functionality...");
            
            // Test if we can access the cache
            if (typeof cache !== 'undefined') {
                console.log("✅ Cache system accessible");
            }
            
            // Test if WASM is loaded
            console.log("🦀 WASM status: Checking...");
            
        } catch (error) {
            console.error("❌ Error testing functionality:", error);
        }
        
    } else {
        console.log("❌ RoutingLib API not available");
    }
    
    ui.notifications.info("🔄 Refreshing page for clean reload...");
    console.log("⏳ Refreshing in 2 seconds...");
    
    // Short delay to read the output
    await new Promise(resolve => setTimeout(resolve, 2000));
    location.reload();
    
})(); 