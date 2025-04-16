/**
 * shipController.js - Manages ship velocity, movement, and physics
 * Handles throttle, acceleration, and position updates
 */

const ShipController = (function() {
    'use strict';
    
    // Constants for ship movement
    const MAX_VELOCITY = 500000;                  // Maximum velocity in km/s (= 100 Mm/s)
    const BASE_ACCELERATION = 0.01;               // Base acceleration factor
    const MIN_DECELERATION_FACTOR = 0.005;        // Reduced deceleration for space-like feel
    
    // Use the proper scale conversion for speeds
    // This converts from km/s to units/s in our simulation
    const MOVEMENT_SCALE = SCALE.KM_S_TO_UNITS_S; // Scale factor that converts km/s to simulation units/s
    const LATERAL_THRUST_FACTOR = 0.3;            // Scale factor for lateral movement (A/D keys)
    
    // Lateral movement constants
    const LATERAL_CONTROLS_ENABLED = true;        // Whether lateral movement is enabled (vs roll)
    const LATERAL_SPEED = 10;                     // Base speed for lateral movement
    
    // Speed display constants
    const MEGAMETER_THRESHOLD = 1000;             // 1000 km/s = 1 Mm/s threshold
    const SPEED_DISPLAY_UPDATE_INTERVAL = 0.2;    // Update speed display every 0.2 seconds
    let speedDisplayTimer = 0;
    
    // Private variables
    let shipVelocity = 0;              // Current velocity in km/s
    let currentVelocity = 0;           // Current velocity used for movement calculations (in units/s)
    let velocityVector = new THREE.Vector3(0, 0, 0);
    let shipObject = null;             // The object that represents the ship
    let shipRotation = 0;              // Current rotation angle in radians
    let thrustTime = 0;

    
    // Movement state from keyboard input
    let movementState = {
        forward: false,    // W key - increase thrust
        backward: false,   // S key - decrease thrust
        left: false,       // A key - lateral thrust left
        right: false,      // D key - lateral thrust right
        stop: false        // Space key - emergency stop
    };
    
    // Initialize the ship controller
    function init(shipRef, initialSpeed) {
        try {
            shipObject = shipRef;
            
            // Debug the shipObject to verify it's properly passed
            console.log("Ship controller initialized with:", {
                shipObject: shipObject ? "present" : "missing",
                type: shipObject ? (shipObject.constructor ? shipObject.constructor.name : "unknown") : "N/A",
                hasGetDirection: shipObject && typeof shipObject.getDirection === 'function',
                position: shipObject ? shipObject.position || shipObject.getObject().position : null
            });
            
            resetVelocity();
            
            // Update the HUD with initial velocity
            updateSpeedDisplay(0);
            
 
            // Also update the UIController coordinates display if available
            if (typeof UIController !== 'undefined' && typeof UIController.updateVelocity === 'function') {
                UIController.updateVelocity(0);
            }
            
            if (typeof initialSpeed === 'number' && initialSpeed >= 0 && initialSpeed <= MAX_VELOCITY) {
                setInitialVelocity(initialSpeed);
            }


            // Listen for the lateral controls enabled/disabled event
            document.addEventListener('setLateralControlsEnabled', function(event) {
                if (event.detail && typeof event.detail.enabled === 'boolean') {
                    // This modifies the module-level constant at runtime
                    window.LATERAL_CONTROLS_ENABLED = event.detail.enabled;
                    console.log("Lateral controls set to:", event.detail.enabled);
                }
            });
        } catch (error) {
            console.error("Error initializing ship controller:", error);
        }
    }
    function setInitialVelocity(newSpeed) {
        shipVelocity = newSpeed;
        currentVelocity = newSpeed * MOVEMENT_SCALE;
        updateSpeedDisplay(shipVelocity);
      }
      

    function resetState() {
        // Reset ship velocity
        resetVelocity();
        // Reset ship position (assume shipObject is the player's ship group or camera rig)
        if (shipObject && shipObject.position) {
          shipObject.position.set(0, 0, 0);
          shipObject.updateMatrixWorld(true);
        }
        // Optionally, also reset any rotation or other state as needed
      }
      
    // Calculate acceleration using an S-curve
    // Starts slow, accelerates faster in the middle, then tapers off near max velocity
    function calculateAcceleration(currentVelocity) {
        // Normalize current velocity to 0-1 range
        const normalizedVelocity = currentVelocity / MAX_VELOCITY;
        
        // Geometric acceleration that starts slow, rises quickly to 50 Mm/s, then tapers off
        let accelerationFactor;
        
        // Half-way point at 50 Mm/s (half of MAX_VELOCITY)
        const halfwayPoint = 0.5;
        
        if (normalizedVelocity < halfwayPoint) {
            // Geometric acceleration up to 50 Mm/s
            // This creates exponential-like growth in the first half of the velocity range
            // The 4 makes it grow faster, adjust as needed for feel
            const growthRate = 4.0;
            accelerationFactor = BASE_ACCELERATION * 0.5 + 
                (BASE_ACCELERATION * Math.pow(normalizedVelocity / halfwayPoint, growthRate) * 1.5);
        } else {
            // Tapering off from 50 Mm/s to 100 Mm/s
            // Linear decrease in acceleration
            const percentPastHalfway = (normalizedVelocity - halfwayPoint) / halfwayPoint;
            accelerationFactor = BASE_ACCELERATION * (1.0 - percentPastHalfway * 0.7);
        }
        
        // Ensure we always have at least a minimum acceleration
        return Math.max(accelerationFactor, BASE_ACCELERATION * 0.2);
    }
    
    // Update ship velocity based on keyboard input
    function updateVelocity(deltaTime) {
        try {
            // Handle emergency stop
            if (movementState.stop) {
                resetVelocity();
                return 0;
            }
            
            // Forward/backward movement (throttle)
            if (movementState.forward) {
                // Increase thrust time
                thrustTime += deltaTime;
                // Cap thrustTime at 5 seconds so that it doesn't exceed MAX_VELOCITY
                const effectiveTime = Math.min(thrustTime, 3);
                // Set shipVelocity according to the geometric curve:
                // v = MAX_VELOCITY * (effectiveTime/5)^3.322
                shipVelocity = MAX_VELOCITY * Math.pow(effectiveTime / 3, 3.322);
            } else if (movementState.backward) {
                // Decelerate - scale by deltaTime for frame-rate independence
                shipVelocity -= MAX_VELOCITY * BASE_ACCELERATION * 3 * deltaTime * 60;
                if (shipVelocity < 0) shipVelocity = 0;
            } else {
                if (shipVelocity > 0) {
                    // Reset thrust timer when no forward input is present.
                    thrustTime = 0;
                    // Decelerate linearly at rate = MAX_VELOCITY/10 per second
                    shipVelocity -= (MAX_VELOCITY / 10) * deltaTime;
                    if (shipVelocity < 0) shipVelocity = 0;
                }
            }
            
            // Calculate current velocity for movement
            // Convert km/s to units/s for the simulation
            currentVelocity = shipVelocity * MOVEMENT_SCALE;
            
            // Update the speed display periodically
            speedDisplayTimer += deltaTime;
            if (speedDisplayTimer >= SPEED_DISPLAY_UPDATE_INTERVAL) {
                updateSpeedDisplay(shipVelocity);
                
                // Also update the UIController coordinates display if available
                if (typeof UIController !== 'undefined' && typeof UIController.updateVelocity === 'function') {
                    UIController.updateVelocity(shipVelocity);
                }
                
                speedDisplayTimer = 0;
            }
            
            return shipVelocity;
        } catch (error) {
            console.error("Error updating ship velocity:", error);
            return 0;
        }
    }
    
    // Format velocity for display based on magnitude
    function formatVelocity(velocityKmS) {
        if (velocityKmS >= MEGAMETER_THRESHOLD) {
            // Display in Mm/s when over threshold
            const velocityMmS = velocityKmS / 1000;
            return velocityMmS.toFixed(2) + " Mm/s";
        } else {
            // Display in km/s
            return Math.round(velocityKmS) + " km/s";
        }
    }
    
    // Update the HUD with the current speed
    function updateSpeedDisplay(speed) {
        try {
            const speedValue = document.getElementById('speed-value');
            if (speedValue) {
                speedValue.textContent = formatVelocity(speed);
            }
        } catch (error) {
            console.error("Error updating speed display:", error);
        }
    }
    
    // Update ship position based on current velocity
    function updatePosition(deltaTime) {
        try {
            // Make sure we have a ship object to control
            if (!shipObject) {
                // Debug output disabled
                // console.warn("ShipController: No ship object available");
                return;
            }
            
            // Get the correct ship position object
            let shipPositionObject;
            
            // If this is a PointerLockControls, we need to get its camera object which has the position
            if (shipObject.constructor && shipObject.constructor.name === "PointerLockControls") {
                // PointerLockControls keeps the actual object with position in getObject()
                if (typeof shipObject.getObject === 'function') {
                    shipPositionObject = shipObject.getObject();
                } else {
                    // Fallback in case getObject doesn't exist 
                    shipPositionObject = shipObject.camera || shipObject;
                }
            } else {
                // For regular objects, use the shipObject directly
                shipPositionObject = shipObject;
            }
            
            // Verify we have a position to work with
            if (!shipPositionObject || !shipPositionObject.position) {
                console.error("Cannot find position property on ship object");
                return;
            }
            
            // Get the current forward, up and right vectors
            let forwardVector, upVector, rightVector;
            
            // Check if we're using the PointerLockControls - use instanceof check with constructor name
            // This avoids direct reference to the PointerLockControls class that might not be defined
            if (shipObject.constructor && shipObject.constructor.name === "PointerLockControls") {
                // Get normalized vectors directly from the controls
                forwardVector = shipObject.getDirection();
                
                // Get the correct quaternion from either the camera or a method that returns it
                let cameraQuaternion;
                if (typeof shipObject.getCamera === 'function') {
                    cameraQuaternion = shipObject.getCamera().quaternion;
                } else if (shipObject.camera) {
                    // Direct camera reference if getCamera() is not available
                    cameraQuaternion = shipObject.camera.quaternion;
                } else {
                    // Fallback to using original quaternion or creating a new one
                    cameraQuaternion = new THREE.Quaternion();
                }
                
                // Apply quaternion to get the right vectors
                rightVector = new THREE.Vector3(1, 0, 0).applyQuaternion(cameraQuaternion);
                upVector = new THREE.Vector3(0, 1, 0).applyQuaternion(cameraQuaternion);
                
                // Log occasionally to verify the vectors are correct (especially Y component)
                if (Math.random() < 0.005) {
                    // Debug output disabled
                    /*console.log("PointerLockControls vectors used:", {
                        forward: {
                            x: forwardVector.x.toFixed(2),
                            y: forwardVector.y.toFixed(2),
                            z: forwardVector.z.toFixed(2)
                        },
                        right: {
                            x: rightVector.x.toFixed(2),
                            y: rightVector.y.toFixed(2),
                            z: rightVector.z.toFixed(2)
                        },
                        up: {
                            x: upVector.x.toFixed(2),
                            y: upVector.y.toFixed(2),
                            z: upVector.z.toFixed(2)
                        }
                    });*/
                }
            } else {
                // Fallback to calculating from the ship's matrix if not a controls object
                // This gets direction from the ship's local transformation matrix
                forwardVector = new THREE.Vector3(0, 0, -1).applyQuaternion(shipObject.quaternion);
                rightVector = new THREE.Vector3(1, 0, 0).applyQuaternion(shipObject.quaternion);
                upVector = new THREE.Vector3(0, 1, 0).applyQuaternion(shipObject.quaternion);
            }
            
            // Ensure we have valid vectors for movement
            if (!forwardVector) forwardVector = new THREE.Vector3(0, 0, -1);
            if (!rightVector) rightVector = new THREE.Vector3(1, 0, 0);
            if (!upVector) upVector = new THREE.Vector3(0, 1, 0);

            // Check for forward/backward movement (W/S keys)
            if (movementState.forward) {
                // Update velocity based on acceleration and current speed
                const acceleration = calculateAcceleration(currentVelocity);
                currentVelocity += acceleration;
                
                // Cap at maximum velocity
                if (currentVelocity > MAX_VELOCITY) {
                    currentVelocity = MAX_VELOCITY;
                }
            } else if (movementState.backward) {
                // Decelerate when S is pressed
                currentVelocity -= MIN_DECELERATION_FACTOR;
                
                // Don't allow negative velocity (no reversing)
                if (currentVelocity < 0) {
                    currentVelocity = 0;
                }
            } else {
                // Natural deceleration over time (reduced drag in space)
                currentVelocity *= (1 - MIN_DECELERATION_FACTOR * deltaTime);
                
                // Clamp to zero if very small to avoid floating point errors
                if (currentVelocity < 0.01) {
                    currentVelocity = 0;
                }
            }
            
            // Calculate the forward movement distance
            const moveDistance = currentVelocity * deltaTime;
            
            // Apply the movement along the forward vector
            shipPositionObject.position.x += forwardVector.x * moveDistance;
            shipPositionObject.position.y += forwardVector.y * moveDistance;
            shipPositionObject.position.z += forwardVector.z * moveDistance;
            
            // Log Y position occasionally to verify vertical movement works
            if (Math.random() < 0.005 && Math.abs(forwardVector.y) > 0.1) {
                // Debug output disabled
                /*console.log("Y-axis movement:", {
                    forwardVector: forwardVector.y.toFixed(3),
                    shipY: shipPositionObject.position.y.toFixed(2),
                    moveDistance: moveDistance.toFixed(2),
                    velocity: currentVelocity.toFixed(2)
                });*/
            }
            
            // Handle lateral thrust (A/D keys for roll)
            if (movementState.left) {
                if (!LATERAL_CONTROLS_ENABLED) {
                    // Roll the ship left (counter-clockwise around forward axis)
                    shipRotation -= 1.5 * deltaTime; // Rotate at 1.5 radians per second
                    
                    // Apply rotation if we have a ship model
                    if (window.shipModel) {
                        window.shipModel.rotation.y = shipRotation;
                        window.shipModel.updateMatrixWorld(true);
                    }
                }
                // Existing lateral movement code will still run if LATERAL_CONTROLS_ENABLED is true
            } else if (movementState.right) {
                if (!LATERAL_CONTROLS_ENABLED) {
                    // Roll the ship right (clockwise around forward axis)
                    shipRotation += 1.5 * deltaTime; // Rotate at 1.5 radians per second
                    
                    // Apply rotation if we have a ship model
                    if (window.shipModel) {
                        window.shipModel.rotation.y = shipRotation;
                        window.shipModel.updateMatrixWorld(true);
                    }
                }
                // Existing lateral movement code will still run if LATERAL_CONTROLS_ENABLED is true
            }
            
            // Apply lateral movement from A/D keys if using strafing instead of roll
            // Force update the world matrix of the ship object
            shipPositionObject.updateMatrixWorld(true);
            
            // Update the velocity vector for external use
            velocityVector.copy(forwardVector).multiplyScalar(currentVelocity);
            
        } catch (error) {
            console.error("Error updating ship position:", error);
        }
    }
    
    // Helper functions for fallback calculation
    function getFallbackForwardVector(obj) {
        const direction = new THREE.Vector3(0, 0, -1);
        obj.getWorldQuaternion(new THREE.Quaternion()).multiply(direction);
        return direction.normalize();
    }
    
    function getFallbackUpVector(obj) {
        const direction = new THREE.Vector3(0, 1, 0);
        obj.getWorldQuaternion(new THREE.Quaternion()).multiply(direction);
        return direction.normalize();
    }
    
    function getFallbackRightVector(obj) {
        const direction = new THREE.Vector3(1, 0, 0);
        obj.getWorldQuaternion(new THREE.Quaternion()).multiply(direction);
        return direction.normalize();
    }
    
    // Update both velocity and position in one call
    function update(deltaTime) {
        updateVelocity(deltaTime);
        updatePosition(deltaTime);
    }
    
    // Set movement state based on keyboard input
    function setMovementState(state) {
        movementState = { ...movementState, ...state };
    }
    
    // Emergency stop - zero out velocity
    function resetVelocity() {
        shipVelocity = 0;
        currentVelocity = 0;
        velocityVector.set(0, 0, 0);
        movementState.stop = false;
        updateSpeedDisplay(0);
        
        // Also update the UIController coordinates display if available
        if (typeof UIController !== 'undefined' && typeof UIController.updateVelocity === 'function') {
            UIController.updateVelocity(0);
        }
    }
    
    // Public API
    return {
        init,
        update,
        setMovementState,
        resetVelocity,
        resetState, 
        setInitialVelocity, 
        getVelocity: () => shipVelocity,
        getCurrentVelocity: () => currentVelocity,
        getVelocityVector: () => velocityVector.clone(),
        getMovementState: () => ({ ...movementState }),
        formatVelocity: formatVelocity  // Expose the formatter for other modules
    };
})(); 