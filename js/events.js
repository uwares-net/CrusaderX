/**
 * events.js - Centralizes event handlers for the application
 * Manages keyboard, mouse, and window events
 */

const EventHandlers = (function() {
    'use strict';
    
    // Private variables
    let scene, camera, renderer;
    let raycaster;
    let moveKeys = {
        forward: false,
        backward: false,
        left: false,
        right: false,
        stop: false
    };
    let isShiftDown = false;
    
    // Sound effects
    let accelerationSound = null;
    let accelerationSoundPlaying = false;
    let decelerationSound = null;
    let decelerationSoundPlaying = false;
    
    // Initialize event handlers
    function init(sceneRef, cameraRef, rendererRef) {
        try {
            // Store references
            scene = sceneRef;
            camera = cameraRef;
            renderer = rendererRef;
            
            // Initialize sound effects
            accelerationSound = new Audio('soundfx/acceleration.mp3');
            accelerationSound.volume = 0.4; // Set a reasonable volume
            accelerationSound.loop = false;  // Loop the sound while accelerating
            
            decelerationSound = new Audio('soundfx/deceleration.mp3');
            decelerationSound.volume = 0.4; // Set a reasonable volume
            decelerationSound.loop = false;  // Loop the sound while decelerating
            
            // Set LATERAL_CONTROLS_ENABLED to false in ShipController to enable rotation
            if (typeof ShipController !== 'undefined' && ShipController) {
                // Create a custom event to signal that lateral controls should be disabled
                const event = new CustomEvent('setLateralControlsEnabled', { detail: { enabled: false } });
                document.dispatchEvent(event);
            }
            
            // Reset movement state
            moveKeys = {
                forward: false,
                backward: false,
                left: false,
                right: false,
                stop: false
            };
            
            // Create raycaster for mouse picking
            raycaster = new THREE.Raycaster();
            
            console.log("Setting up event handlers...");
            
            // Remove existing event listeners if any
            document.removeEventListener('keydown', onKeyDown);
            document.removeEventListener('keyup', onKeyUp);
            window.removeEventListener('resize', onWindowResize);
            renderer.domElement.removeEventListener('click', onMouseClick);
            
            // Add event listeners
            document.addEventListener('keydown', onKeyDown, false);
            document.addEventListener('keyup', onKeyUp, false);
            window.addEventListener('resize', onWindowResize, false);
            renderer.domElement.addEventListener('click', onMouseClick, false);
            
            console.log("Event handlers initialized.");
            return true;
        } catch (error) {
            console.error("Error initializing event handlers:", error);
            return false;
        }
    }
    
    // Handle window resize
    function onWindowResize() {
        try {
            if (!camera || !renderer) return;
            
            // Update camera aspect ratio
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            
            // Update renderer size
            renderer.setSize(window.innerWidth, window.innerHeight);
        } catch (error) {
            console.error("Error handling window resize:", error);
        }
    }
    
    // Handle mouse click for object selection
    function onMouseClick(event) {
        try {
            // Skip if pointer is locked (we're in combat mode)
            if (document.pointerLockElement) {
                // Let LaserSystem handle this
                return;
            }
            
            // Check if we have the necessary components to handle clicks
            if (!camera || !scene || !raycaster) {
                console.warn("Missing components for mouse click handling");
                return;
            }
            
            // Check for pointer lock status using App if available
            let isPointerLocked = false;
            
            if (typeof App !== 'undefined' && App && typeof App.isPointerLocked !== 'undefined') {
                isPointerLocked = App.isPointerLocked;
            } else if (typeof Controls !== 'undefined' && typeof Controls.isPointerLocked === 'function') {
                isPointerLocked = Controls.isPointerLocked();
            } else {
                isPointerLocked = document.pointerLockElement === document.querySelector('#container canvas');
            }
                                    
            // Only process celestial object selection if we're not in pointer lock mode
            if (!isPointerLocked) {
                try {
                    // Check if SolarSystem module is available
                    if (typeof SolarSystem === 'undefined' || typeof SolarSystem.getCelestialObjects !== 'function') {
                        // This is expected when using pointer lock controls, so we'll silence the warning
                        // console.warn("SolarSystem module not available for object selection");
                        return;
                    }
                    
                    // Cast a ray from the camera through the clicked point
                    const mouse = new THREE.Vector2();
                    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
                    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
                    
                    raycaster.setFromCamera(mouse, camera);
                    
                    // Get all celestial objects for checking intersections
                    const celestialObjects = SolarSystem.getCelestialObjects();
                    const planets = celestialObjects.planets || [];
                    const sun = celestialObjects.sun ? [celestialObjects.sun] : [];
                    const moons = celestialObjects.moons || [];
                    
                    const intersects = raycaster.intersectObjects([...planets, ...sun, ...moons], true);
                    
                    if (intersects.length > 0) {
                        // Find the nearest intersected object with celestial data
                        for (let i = 0; i < intersects.length; i++) {
                            const object = intersects[i].object;
                            
                            // Check if Utils module is available
                            if (typeof Utils === 'undefined' || typeof Utils.getClickableParent !== 'function') {
                                console.warn("Utils module not available for object selection");
                                break;
                            }
                            
                            const clickableParent = Utils.getClickableParent(object);
                            
                            if (clickableParent && clickableParent.userData.celestialData) {
                                const celestialData = clickableParent.userData.celestialData;
                                
                                // Focus on this object if the Utils module is available
                                if (typeof Utils.focusOnObject === 'function') {
                                    Utils.focusOnObject(camera, clickableParent, celestialData);
                                }
                                
                                // Show info panel if the UIController module is available
                                if (typeof UIController !== 'undefined' && typeof UIController.displayObjectInfo === 'function') {
                                    UIController.displayObjectInfo(celestialData);
                                }
                                break;
                            }
                        }
                    }
                } catch (error) {
                    console.error("Error handling object selection:", error);
                }
            }
        } catch (error) {
            console.error("Error handling mouse click:", error);
        }
    }
    
    // Handle key down events
    function onKeyDown(event) {
        try {
            // Ignore key events if in input field
            if (event.target && event.target.nodeName === 'INPUT') {
                return;
            }
            
            //console.log(`Key down: ${event.code}`);
            
            switch (event.code) {
                // Movement keys

                case 'KeyH':
                    // Only show help if UIController exists and has the function
                    if (typeof UIController !== 'undefined' && typeof UIController.showHelpPage === 'function') {
                        event.preventDefault(); // Prevent potential browser 'h' shortcut
                        UIController.showHelpPage();
                    }
                    break;
                case 'KeyC':
                        if (typeof UIController !== 'undefined' && typeof UIController.showCreditsPage === 'function') {
                            event.preventDefault(); // Prevent potential browser 'c' shortcut
                            UIController.showCreditsPage();
                        }
                        break;
                case 'KeyW':
                    moveKeys.forward = true;
                    
                    // Play acceleration sound if not already playing
                    if (accelerationSound && !accelerationSoundPlaying) {
                        accelerationSoundPlaying = true;
                        accelerationSound.currentTime = 0; // Reset to start of sound
                        accelerationSound.play().catch(err => console.warn("Could not play acceleration sound:", err));
                    }
                    break;
                case 'KeyS':
                    moveKeys.backward = true;
                    
                    // Play deceleration sound if not already playing
                    if (decelerationSound && !decelerationSoundPlaying) {
                        decelerationSoundPlaying = true;
                        decelerationSound.currentTime = 0; // Reset to start of sound
                        decelerationSound.play().catch(err => console.warn("Could not play deceleration sound:", err));
                    }
                    break;
                case 'Space':
                    // Check if we're in combat mode
                    const inCombatMode = typeof UIController !== 'undefined' && 
                                        typeof UIController.currentMode !== 'undefined' && 
                                        UIController.currentMode === 'COMBAT';
                                        
                    if (inCombatMode) {
                        // In combat mode, Space is for firing - do nothing here
                        // LaserSystem will handle this event
                    } else {
                        // In exploration mode, use Space for emergency stop
                    }
                    break;
                    
                case 'Tab':
                    event.preventDefault(); // prevent default tab navigation
                    if (window.killsTableInstance) {
                        window.killsTableInstance.show();
                    }
                    break;
                    
                // Mode switching
                case 'KeyG':
                    // Toggle game mode using UIController if available
                    if (typeof UIController !== 'undefined' && typeof UIController.toggleGameMode === 'function') {
                        UIController.toggleGameMode();
                    } else {
                        console.warn("UIController.toggleGameMode not available");
                    }
                    break;
                    
                // Music toggle
                case 'KeyM':
                    if (typeof UIController !== 'undefined' && typeof UIController.toggleMusic === 'function') {
                        UIController.toggleMusic();
                    }
                    break;
                    
                // Reset view
                case 'KeyV':
                    // Reset velocity only
                    if (typeof ShipController !== 'undefined' && typeof ShipController.resetVelocity === 'function') {
                        ShipController.resetVelocity();
                    }
                    break;
            }
            
            // Update ship controller with new movement state
            if (typeof ShipController !== 'undefined' && typeof ShipController.setMovementState === 'function') {
                ShipController.setMovementState({
                    forward: moveKeys.forward,
                    backward: moveKeys.backward,
                    stop: moveKeys.stop 
                });                
                //console.log("Movement state updated:", JSON.stringify(moveKeys));
            }
        } catch (error) {
            console.error("Error handling keydown:", error);
        }
    }
    
    // Handle key up events
    function onKeyUp(event) {
        try {
            //console.log(`Key up: ${event.code}`);
            
            switch (event.code) {

                case 'KeyH':
                    // Only hide help if UIController exists and has the function
                    if (typeof UIController !== 'undefined' && typeof UIController.hideHelpPage === 'function') {
                        event.preventDefault();
                        UIController.hideHelpPage();
                    }
                    break;
                case 'KeyC':
                        if (typeof UIController !== 'undefined' && typeof UIController.hideCreditsPage === 'function') {
                           event.preventDefault();
                           UIController.hideCreditsPage();
                       }
                       break;
                case 'KeyW':
                    moveKeys.forward = false;
                    
                    // Stop acceleration sound
                    if (accelerationSound && accelerationSoundPlaying) {
                        accelerationSoundPlaying = false;
                        accelerationSound.pause();
                    }
                    break;
                case 'KeyS':
                    moveKeys.backward = false;
                    
                    // Stop deceleration sound
                    if (decelerationSound && decelerationSoundPlaying) {
                        decelerationSoundPlaying = false;
                        decelerationSound.pause();
                    }
                    break; 
                case 'Space':
                    // Similar logic as keydown - only treat as stop in exploration mode
                    const inCombatMode = typeof UIController !== 'undefined' && 
                                        typeof UIController.currentMode !== 'undefined' && 
                                        UIController.currentMode === 'COMBAT';
                                        
                    if (!inCombatMode) {
                        // In exploration mode, Space releasing stops emergency braking
                        moveKeys.stop = false;
                    }
                    break;
                    
                case 'Tab':
                    event.preventDefault();
                    if (window.killsTableInstance) {
                        window.killsTableInstance.hide();
                    }
                    break;
                
                case 'ShiftLeft':
                case 'ShiftRight':
                    // ... (existing code)
                    break;
            }
            
            // Update ship controller with new movement state
            ShipController.setMovementState(moveKeys);
            //console.log("Movement state updated:", JSON.stringify(moveKeys));
        } catch (error) {
            console.error("Error handling keyup:", error);
        }
    }
    
    // Get the current state of movement keys
    function getMovementKeys() {
        return { ...moveKeys };
    }
    
    // Public API
    return {
        init: init,
        getMovementKeys: getMovementKeys,
        onKeyDown: onKeyDown,
        onKeyUp: onKeyUp,
        onWindowResize: onWindowResize
    };
})(); 