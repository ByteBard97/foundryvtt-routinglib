// @ts-nocheck
// Test RoutingLib Trust - Verify that paths from RoutingLib are trusted by validation
// Select a token and run this to test the fixed validation system

(async () => {
    const selectedTokens = canvas.tokens.controlled;
    
    if (selectedTokens.length !== 1) {
        ui.notifications.warn('Please select exactly one token to test.');
        return;
    }
    
    const token = selectedTokens[0];
    const MODULE_ID = 'dnd5e-ai-combat-assistant';
    
    console.log('🧪 === ROUTINGLIB TRUST TEST ===');
    
    // Check RoutingLib availability
    const rl = globalThis.routinglib;
    if (!rl) {
        console.error('❌ RoutingLib not available!');
        ui.notifications.error('RoutingLib is not loaded.');
        return;
    }
    
    console.log('✅ RoutingLib available');
    
    // Import validation function
    let validateMovementPath;
    try {
        const pathModule = await import('../utils/pathService.js');
        validateMovementPath = pathModule.validateMovementPath;
        console.log('✅ Validation function imported');
    } catch (err) {
        console.error('❌ Failed to import validation function:', err);
        ui.notifications.error('Failed to load validation function');
        return;
    }
    
    // Test with a simple 2-point path (current position to nearby point)
    const currentCenter = {
        x: token.x + token.w / 2,
        y: token.y + token.h / 2
    };
    
    const nearbyPoint = {
        x: currentCenter.x + canvas.grid.size,
        y: currentCenter.y + canvas.grid.size
    };
    
    const testPath = [currentCenter, nearbyPoint];
    
    console.log('🗺️ Testing path:', testPath);
    
    // Test validation
    const isValid = validateMovementPath(token, testPath);
    
    console.log(`🎯 Validation result: ${isValid ? '✅ VALID' : '❌ BLOCKED'}`);
    
    if (isValid) {
        ui.notifications.info('✅ SUCCESS: RoutingLib paths are now trusted by validation!');
    } else {
        ui.notifications.error('❌ FAILED: Validation still rejecting paths');
    }
    
    // Test with empty path
    const emptyPathValid = validateMovementPath(token, []);
    console.log(`🌕 Empty path validation: ${emptyPathValid ? '✅ VALID' : '❌ BLOCKED'}`);
    
    // Test with single point path
    const singlePointValid = validateMovementPath(token, [currentCenter]);
    console.log(`🔘 Single point validation: ${singlePointValid ? '✅ VALID' : '❌ BLOCKED'}`);
    
    console.log('🧪 === ROUTINGLIB TRUST TEST COMPLETE ===');
})(); 