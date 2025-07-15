// Enhanced dev reload with console clearing (Script macro)
const MOD_ID = "dnd5e-ai-combat-assistant";

(async () => {
    console.log("🔄 Starting module reload...");
    
    const mod = game.modules.get(MOD_ID);
    if (!mod) {
        return ui.notifications.error(`Module ${MOD_ID} not found`);
    }

    // Reload the module
    if (typeof mod.reload === "function") {
        await mod.reload();
    } else if (typeof mod.reloadModule === "function") {
        await mod.reloadModule();
    }

    ui.notifications.info("Module reloaded – refreshing UI…");
    
    // Wait 2 seconds for everything to settle
    console.log("⏳ Waiting 2 seconds for module to fully reload...");
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Clear console and history
    console.clear();
    console.log("🧹 Console cleared! Module reload complete.");
    
    // Refresh the page to ensure clean state
    location.reload();
    
    // Note: The code below won't execute due to location.reload(), 
    // but you can run these manually after the page reloads:
    /*
    game.modules.get("dnd5e-ai-combat-assistant").api;
    game.modules.get("dnd5e-ai-combat-assistant").api.useFixtureSuggestions();
    // window.__AICA_USE_FIXTURE__
    game.modules.get("dnd5e-ai-combat-assistant").api.enableSimpleAI();
    */
})(); 