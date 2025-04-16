const MobileControls = (function () {
    'use strict';

    let isMobile = false;
    
    function isMobileOrTabletDevice() {
        if (navigator.userAgentData && typeof navigator.userAgentData.mobile !== 'undefined' && navigator.userAgentData.mobile) {
            return true;
        }
        if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return true;
        if (navigator.maxTouchPoints > 0) return true;
        if ('ontouchstart' in window) return true;
        return /Mobi|Android|iPad|iPhone|iPod/i.test(navigator.userAgent);
    }
    

    function init() {
        isMobile = isMobileOrTabletDevice();

        if (isMobile) {

            let accelerationSound = new Audio('soundfx/acceleration.mp3');
            accelerationSound.volume = 0.4; // Set a reasonable volume
            accelerationSound.loop = false;  // Loop the sound while accelerating

            let decelerationSound = new Audio('soundfx/deceleration.mp3');
            decelerationSound.volume = 0.4; // Set a reasonable volume
            decelerationSound.loop = false;  // Loop the sound while decelerating

            // Remove pointer lock listeners for mobile.
            document.removeEventListener('mousedown', () => { /* pointer lock code */ });

            // Create on-screen containers for the joysticks.
            // Reduce container size from 100px to 80px.
            const leftJoystickContainer = document.createElement('div');
            leftJoystickContainer.id = 'left-joystick';
            Object.assign(leftJoystickContainer.style, {
                position: 'fixed',
                bottom: '30px',
                left: '30px',
                width: '80px',
                height: '80px',
                zIndex: '30000',
                opacity: '0.7'
            });
            document.body.appendChild(leftJoystickContainer);

            // Adjust right joystick container so it is fully visible.
            const rightJoystickContainer = document.createElement('div');
            rightJoystickContainer.id = 'right-joystick';
            Object.assign(rightJoystickContainer.style, {
                position: 'fixed',
                bottom: '30px',
                right: '30px',
                width: '80px',
                height: '80px',
                zIndex: '30000',
                opacity: '0.7'
            });
            document.body.appendChild(rightJoystickContainer);

            // Global variables for mobile rotation input.
            window.mobileYaw = 0;
            window.mobilePitch = 0;

            // Global movement state.
            window.movementState = {
                forward: false,
                backward: false,
                rollLeft: false,
                rollRight: false
            };

            // Create left joystick for aiming.
            // Reduce the joystick size to 80.
            const leftJoystick = nipplejs.create({
                zone: leftJoystickContainer,
                mode: 'static',
                position: { left: '40px', bottom: '40px' }, // Centered in 80px container.
                color: 'white',
                size: 120,
                restOpacity: 0.7
            });

            // Instead of accumulating deltas, map the current joystick displacement directly.
            leftJoystick.on('move', (evt, data) => {
                if (!data || !data.vector) return;
                // Use a sensitivity factor (experiment with this value; try 0.005 or lower).
                const sensitivity = 0.01;
                // Map the normalized vector directly.
                window.mobileYaw = -data.vector.x * sensitivity;
                window.mobilePitch = data.vector.y * sensitivity;
                // Clamp pitch to prevent flipping.
                window.mobilePitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, window.mobilePitch));
            });

            leftJoystick.on('end', (evt, data) => {
                window.mobileYaw = 0;
                window.mobilePitch = 0;
            });

            // Create right joystick for throttle and roll control.
            const rightJoystick = nipplejs.create({
                zone: rightJoystickContainer,
                mode: 'static',
                position: { left: '40px', bottom: '40px' },
                color: 'white',
                size: 120,
                restOpacity: 0.7
            });

            rightJoystick.on('move', (evt, data) => {
                if (!data || !data.vector) return;

                // Vertical control: acceleration vs. deceleration
                if (data.vector.y < -0.3) {
                    // Joystick moved up – play acceleration sound.
                    window.movementState.backward = true;
                    window.movementState.forward = false;
                    if (decelerationSound.paused) {
                        decelerationSound.currentTime = 0;
                        decelerationSound.play();
                    }
                    // Ensure acceleration sound is stopped.
                    if (!accelerationSound.paused) {
                        accelerationSound.pause();
                        accelerationSound.currentTime = 0;
                    }
                    
                } else if (data.vector.y > 0.3) {
                    // Joystick moved down – play deceleration sound.
                    window.movementState.forward = true;
                    window.movementState.backward = false;
                    if (accelerationSound.paused) {
                        accelerationSound.currentTime = 0;
                        accelerationSound.play();
                    }
                    // Ensure deceleration sound is stopped.
                    if (!decelerationSound.paused) {
                        decelerationSound.pause();
                        decelerationSound.currentTime = 0;
                    }

                } else {
                    // Joystick in neutral vertical position – stop both sounds.
                    window.movementState.forward = false;
                    window.movementState.backward = false;
                    if (!accelerationSound.paused) {
                        accelerationSound.pause();
                        accelerationSound.currentTime = 0;
                    }
                    if (!decelerationSound.paused) {
                        decelerationSound.pause();
                        decelerationSound.currentTime = 0;
                    }
                }

                // Roll: Map horizontal displacement.
                if (data.vector.x < -0.3) {
                    window.movementState.rollLeft = true;
                    window.movementState.rollRight = false;
                } else if (data.vector.x > 0.3) {
                    window.movementState.rollRight = true;
                    window.movementState.rollLeft = false;
                } else {
                    window.movementState.rollLeft = false;
                    window.movementState.rollRight = false;
                }
            });

            rightJoystick.on('end', (evt, data) => {
                window.movementState.forward = false;
                window.movementState.backward = false;
                window.movementState.rollLeft = false;
                window.movementState.rollRight = false;

                // Stop any playing sounds when the joystick is released.
                if (!accelerationSound.paused) {
                    accelerationSound.pause();
                    accelerationSound.currentTime = 0;
                }
                if (!decelerationSound.paused) {
                    decelerationSound.pause();
                    decelerationSound.currentTime = 0;
                }
            });


            // Replace pointer lock firing: simple touch handler.
            const container = document.getElementById('container');
            if (container) {
                container.addEventListener('touchstart', (evt) => {
                    // Removed: if (evt.touches.length === 1)
                    if (LaserSystem && typeof LaserSystem.fireLasers === 'function') {
                        LaserSystem.fireLasers();
                    }
                });
            }

            let creditsVisible = false;
            let leaderboardVisible = false;

            // Create a container for the mobile menu buttons
            const mobileMenuContainer = document.createElement('div');
            mobileMenuContainer.id = 'mobile-menu-container';
            Object.assign(mobileMenuContainer.style, {
                position: 'fixed',
                top: '10px',
                left: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '5px',  // Smaller gap between buttons
                zIndex: '40500'
            });
            document.body.appendChild(mobileMenuContainer);

            // Define button configurations for the four functions
            const buttonsConfig = [
                { id: 'credits', text: 'Credits' },
                { id: 'leaderboard', text: 'Leaderboard' },
                { id: 'mode', text: 'Mode' },
                { id: 'music', text: 'Music' }
            ];

            buttonsConfig.forEach(buttonData => {
                const btn = document.createElement('button');
                btn.id = buttonData.id;
                btn.textContent = buttonData.text;
                Object.assign(btn.style, {
                    padding: '5px 4px',        // Reduced padding (~30% smaller)
                    background: 'linear-gradient(45deg, #1e3c72, #2a5298)',  // Space-themed gradient
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '11px',            // Reduced font size (~30% smaller)
                    fontFamily: 'Orbitron, sans-serif',  // Futuristic font (ensure it's loaded)
                    boxShadow: '0 2px 10px rgba(0, 255, 255, 0.3)',
                    cursor: 'pointer',
                    transition: 'transform 0.1s, box-shadow 0.1s'
                });

                // Add touch and mouse feedback effects
                btn.addEventListener('touchstart', () => {
                    btn.style.transform = 'scale(0.90)';
                    btn.style.boxShadow = '0 1px 5px rgba(0, 255, 255, 0.2)';
                });
                btn.addEventListener('touchend', () => {
                    btn.style.transform = 'scale(0.95)';
                    btn.style.boxShadow = '0 2px 10px rgba(0, 255, 255, 0.3)';
                });
                btn.addEventListener('mousedown', () => {
                    btn.style.transform = 'scale(0.90)';
                    btn.style.boxShadow = '0 1px 5px rgba(0, 255, 255, 0.2)';
                });
                btn.addEventListener('mouseup', () => {
                    btn.style.transform = 'scale(0.95)';
                    btn.style.boxShadow = '0 2px 10px rgba(0, 255, 255, 0.3)';
                });

                // Set up click events with toggle functionality for Credits and Leaderboard.
                btn.addEventListener('click', (evt) => {
                    switch (buttonData.id) {
                        case 'credits':
                            if (!creditsVisible) {
                                if (typeof UIController !== 'undefined' && typeof UIController.showCreditsPage === 'function') {
                                    window.killsTableInstance.hide();
                                    UIController.showCreditsPage();
                                }
                                creditsVisible = true;
                            } else {
                                if (typeof UIController !== 'undefined' && typeof UIController.hideCreditsPage === 'function') {
                                    evt.preventDefault();
                                    UIController.hideCreditsPage();
                                }
                                creditsVisible = false;
                            }
                            break;
                        case 'leaderboard':
                            if (!leaderboardVisible) {
                                if (window.killsTableInstance) {
                                    UIController.hideCreditsPage();
                                    window.killsTableInstance.show();
                                }
                                leaderboardVisible = true;
                            } else {
                                if (window.killsTableInstance) {
                                    window.killsTableInstance.hide();
                                }
                                leaderboardVisible = false;
                            }
                            break;
                        case 'mode':
                            if (typeof UIController !== 'undefined' && typeof UIController.toggleGameMode === 'function') {
                                window.killsTableInstance.hide();
                                UIController.hideCreditsPage();
                                UIController.toggleGameMode();
                            }
                            break;
                        case 'music':
                            if (typeof UIController !== 'undefined' && typeof UIController.toggleMusic === 'function') {
                                window.killsTableInstance.hide();
                                UIController.hideCreditsPage();
                                UIController.toggleMusic();
                            }
                            break;
                        default:
                            console.warn('No action defined for button:', buttonData.id);
                    }
                });

                mobileMenuContainer.appendChild(btn);
            });
        }


    }

    function updateMobileControls(deltaTime) {
        if (isMobile) {
            // Ensure movementState exists (good practice, already there)
            if (typeof window.movementState === 'undefined') {
                window.movementState = {
                    forward: false,
                    backward: false,
                    rollLeft: false,
                    rollRight: false
                };
            }
            if (window.camera) {
                // --- CHANGE HERE ---
                // Apply yaw rotation around the camera's local Y-axis
                window.camera.rotateY(window.mobileYaw || 0);
                window.camera.rotateX(window.mobilePitch || 0);
                const rollSpeed = 0.01; // Keep the original speed for now
                if (window.movementState.rollLeft) {
                    window.camera.rotateZ(rollSpeed); // Use rotateZ
                } else if (window.movementState.rollRight) {
                    window.camera.rotateZ(-rollSpeed); // Use rotateZ
                }
            }
            // ShipController part remains the same
            if (ShipController && typeof ShipController.setMovementState === 'function') {
                ShipController.setMovementState({
                    forward: window.movementState.forward,
                    backward: window.movementState.backward,
                    rollLeft: window.movementState.rollLeft,
                    rollRight: window.movementState.rollRight
                });
            }
        }
    }

    return {
        init: init,
        updateMobileControls: updateMobileControls,
        get isMobile() { return isMobile; }
    };
})();
