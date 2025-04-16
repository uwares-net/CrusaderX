/**
 * geckosClient.js - Exposes the geckos.io client globally
 * This is a simple wrapper around the npm module
 */

// We're expecting the geckos.io client to be available through your bundler
// or through a script tag that loads it from node_modules
(function() {
    'use strict';
    
    // Check if the module is available
    if (typeof window !== 'undefined') {
        try {
            // Assign to window.geckos for global access
            window.geckos = require('@geckos.io/client').default;
            console.log('Geckos.io client initialized and exposed globally');
        } catch (error) {
            console.error('Failed to initialize geckos.io client:', error);
            // Provide a mock implementation to prevent errors
            window.geckos = function() {
                console.warn('Using mock geckos.io client. Multiplayer features will not work.');
                return {
                    onConnect: (cb) => cb(new Error('Geckos.io client not properly loaded')),
                    close: () => {},
                    on: () => {},
                    emit: () => {}
                };
            };
        }
    }
})(); 