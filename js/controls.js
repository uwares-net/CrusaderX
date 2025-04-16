/**
 * controls.js - Manages camera controls for both exploration and combat modes
 * Handles mouse movement, pointer lock, and camera positioning
 */

const Controls = (function() {
    'use strict';
    
    // Constants for camera controls
    const CAMERA_DISTANCE = 5; // Distance behind spaceship in combat mode
    const CAMERA_HEIGHT = 1;   // Height above spaceship in combat mode
    const MOUSE_SENSITIVITY = 0.002;
    const ROTATION_DAMPING = 0.15;
    
    // Private variables
    let camera = null;
    let domElement = null;
    let scene = null;
    
    let yawObject = null;
    let pitchObject = null;
    
    // Current rotations
    let currentYawRotation = 0;
    let currentPitchRotation = 0;
    let targetYawRotation = 0;
    let targetPitchRotation = 0;
    let targetRollRotation = 0;
    let currentRollRotation = 0;
    
    // Mouse movement tracking
    let mouseMoveX = 0;
    let mouseMoveY = 0;
    
    // Control state
    let isPointerLocked = false;
    let isExplorationMode = true;
    
    // Initialize controls
    function init(cameraRef, domElementRef, sceneRef) {
        try {
            // Store references
            camera = cameraRef;
            domElement = domElementRef;
            scene = sceneRef;
            
            // Create objects for yaw/pitch rotation
            initPitchYawObjects();
            
            // Set up pointer lock controls for direct mouse input
            initPointerLock();
            
            // Set initial mode
            setExplorationMode(true);
            
            console.log("Controls initialized");
        } catch (error) {
            console.error("Error initializing controls:", error);
        }
    }
    
    // Initialize the pitch/yaw control objects
        function initPitchYawObjects() {
            // Create yaw object (rotates around Y axis)
            yawObject = new THREE.Object3D();
            
            // Position near Earth (Earth is at approximately 100 units from the Sun on the X-axis)
            // Earth's orbit isn't fixed, but we can position the ship in the area where Earth typically is
            // The Sun is at (0,0,0), so we position the ship at positive X-axis at ~100 units (1 AU)
            // with a small Y offset to avoid being directly on the orbital plane
            yawObject.position.set(100, 10, 0);
            
            scene.add(yawObject);
            
            // Create pitch object (rotates around X axis)
            pitchObject = new THREE.Object3D();
            yawObject.add(pitchObject);
            
            // Add camera to pitch object to keep proper hierarchy
            pitchObject.add(camera);
            
            // Initial camera position: behind and slightly above where the ship would be
            camera.position.set(0, CAMERA_HEIGHT, CAMERA_DISTANCE);
            camera.lookAt(new THREE.Vector3(0, 0, -1));
        }
        
    // Initialize pointer lock controls
    function initPointerLock() {
        // Remove any existing listeners first to avoid duplicates
        document.removeEventListener('pointerlockchange', onPointerLockChange, false);
        document.removeEventListener('mozpointerlockchange', onPointerLockChange, false);
        document.removeEventListener('webkitpointerlockchange', onPointerLockChange, false);
        
        // Set up event listener for pointer lock change
        document.addEventListener('pointerlockchange', onPointerLockChange, false);
        document.addEventListener('mozpointerlockchange', onPointerLockChange, false);
        document.addEventListener('webkitpointerlockchange', onPointerLockChange, false);
        
        // Set up event listener for pointer lock error
        document.addEventListener('pointerlockerror', onPointerLockError, false);
        document.addEventListener('mozpointerlockerror', onPointerLockError, false);
        document.addEventListener('webkitpointerlockerror', onPointerLockError, false);
        
        // Remove any existing click listeners to avoid duplicates
        domElement.removeEventListener('click', requestPointerLock, false);
        
        // Click the domElement to request pointer lock
        domElement.addEventListener('click', requestPointerLock, false);
        
        console.log("Pointer lock event listeners initialized on:", domElement);
    }
    
    // Update the pointer lock controls based on current mode
    function updatePointerLockControls() {
        try {
            // Make sure matrices are updated
            if (yawObject) {
                yawObject.updateMatrix();
                yawObject.updateMatrixWorld(true);
            }
            
            if (pitchObject) {
                pitchObject.updateMatrix();
                pitchObject.updateMatrixWorld(true);
            }
            
            console.log(`Updated pointer lock controls for ${isExplorationMode ? 'exploration' : 'combat'} mode`);
        } catch (error) {
            console.error("Error updating pointer lock controls:", error);
        }
    }
    
    // Handle pointer lock change
    function onPointerLockChange() {
        isPointerLocked = (
            document.pointerLockElement === domElement ||
            document.mozPointerLockElement === domElement ||
            document.webkitPointerLockElement === domElement
        );
        
        if (isPointerLocked) {
            document.addEventListener('mousemove', onMouseMove, false);
            console.log("Pointer locked - Flight controls active");
        } else {
            document.removeEventListener('mousemove', onMouseMove, false);
            console.log("Pointer unlocked - Flight controls inactive");
        }
    }
    
    // Handle pointer lock error
    function onPointerLockError() {
        console.error("Error obtaining pointer lock");
    }
    
    // Request pointer lock on the document
    function requestPointerLock() {
        if (!isPointerLocked) {
            console.log("Requesting pointer lock on:", domElement);
            
            // Try to focus if the element supports it
            try {
                if (domElement && typeof domElement.focus === 'function') {
                    domElement.focus();
                }
            } catch (error) {
                console.warn("Could not focus element:", error);
            }
            
            // Get pointer lock method based on browser capabilities
            if (domElement) {
                domElement.requestPointerLock = (
                    domElement.requestPointerLock ||
                    domElement.mozRequestPointerLock ||
                    domElement.webkitRequestPointerLock
                );
                
                if (typeof domElement.requestPointerLock === 'function') {
                    domElement.requestPointerLock();
                } else {
                    console.error("Pointer lock API not supported in this browser");
                }
            } else {
                console.error("domElement is null or undefined");
            }
        }
    }
    
    // Handle mouse movement
    function onMouseMove(event) {
        if (!isPointerLocked) {
            console.log("Mouse move ignored - pointer not locked");
            return;
        }
        
        // Get mouse movement and apply sensitivity
        const movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
        const movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;
        
        // Only log if there's significant movement
        if (Math.abs(movementX) > 1 || Math.abs(movementY) > 1) {
            console.log(`Mouse move: X=${movementX}, Y=${movementY}`);
        }
        
        // Update target rotations for smooth movement
        targetYawRotation -= movementX * MOUSE_SENSITIVITY;
        targetPitchRotation -= movementY * MOUSE_SENSITIVITY;
        
        // Limit pitch to prevent flipping
        targetPitchRotation = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, targetPitchRotation));
    }
    
    // Apply roll rotation (called from keyboard handler in events.js)
    function applyRoll(amount) {
        if (!isExplorationMode) return;
        targetRollRotation += amount;
        
        // Limit roll to prevent complete flipping
        targetRollRotation = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, targetRollRotation));
    }
    
    // Reset rotation (called when switching modes or resetting view)
    function resetRotation() {
        // Reset target rotation
        targetYawRotation = 0;
        targetPitchRotation = 0;
        targetRollRotation = 0;
        currentYawRotation = 0;
        currentPitchRotation = 0;
        currentRollRotation = 0;
        
        // Reset current rotation softly in update function
        if (pitchObject) pitchObject.rotation.x = 0;
        if (yawObject) yawObject.rotation.y = 0;
        if (camera) camera.rotation.z = 0;
    }
    
    // Get the forward direction vector based on current orientation
    function getForwardVector() {
        // Calculate forward direction from yaw and pitch
        const direction = new THREE.Vector3(0, 0, -1);
        
        // Apply pitch and yaw rotations
        const quaternion = new THREE.Quaternion();
        quaternion.setFromEuler(pitchObject.rotation);
        direction.applyQuaternion(quaternion);
        
        quaternion.setFromEuler(yawObject.rotation);
        direction.applyQuaternion(quaternion);
        
        return direction.normalize();
    }
    
    // Get the up vector based on current orientation
    function getUpVector() {
        // Calculate up direction considering roll
        const upVector = new THREE.Vector3(0, 1, 0);
        
        // Apply roll rotation
        const rollQuat = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 0, -1),
            currentRollRotation
        );
        upVector.applyQuaternion(rollQuat);
        
        // Apply yaw rotation
        const yawQuat = new THREE.Quaternion().setFromEuler(yawObject.rotation);
        upVector.applyQuaternion(yawQuat);
        
        return upVector.normalize();
    }
    
    // Get the right vector based on current orientation
    function getRightVector() {
        const forwardVector = getForwardVector();
        const upVector = getUpVector();
        
        // Right is the cross product of forward and up
        return new THREE.Vector3().crossVectors(forwardVector, upVector).normalize();
    }
    
    // Update controls each frame
    function update(deltaTime) {
        if (!camera || !yawObject || !pitchObject) return;
        
        try {
            // Multiply damping by deltaTime for frame-rate independence
            const factor = ROTATION_DAMPING * deltaTime * 60; // Adjust multiplier as needed
            currentYawRotation += (targetYawRotation - currentYawRotation) * factor;
            currentPitchRotation += (targetPitchRotation - currentPitchRotation) * factor;
            currentRollRotation += (targetRollRotation - currentRollRotation) * factor;
            
            // Apply rotations
            yawObject.rotation.y = currentYawRotation;
            pitchObject.rotation.x = currentPitchRotation;
            camera.rotation.z = currentRollRotation;
            
            // Force update the world matrices so that the camera's transformation reflects the changes
            yawObject.updateMatrixWorld(true);
            
            // Log rotations for debugging
            if (isPointerLocked && (Math.abs(targetYawRotation - currentYawRotation) > 0.001 || 
                Math.abs(targetPitchRotation - currentPitchRotation) > 0.001 || 
                Math.abs(targetRollRotation - currentRollRotation) > 0.001)) {
                console.log(`Rotations - Yaw: ${currentYawRotation.toFixed(3)}, Pitch: ${currentPitchRotation.toFixed(3)}, Roll: ${currentRollRotation.toFixed(3)}`);
            }
        } catch (error) {
            console.error("Error updating controls:", error);
        }
    }
    
    // Switch between exploration and combat modes
    function setExplorationMode(isExploration) {
        isExplorationMode = isExploration;
        
        // Set appropriate controls based on mode
        if (isExplorationMode) {
            // Exploration mode - switch to pointer lock controls
            // Keep up vector consistent
            updatePointerLockControls();
        } else {
            // Combat mode - switch to spaceship controls
            // Allow free movement
            updatePointerLockControls();
        }
        
        console.log(`Controls mode set to ${isExplorationMode ? 'exploration' : 'combat'}`);
    }
    
    // Get the current exploration mode state
    function getExplorationMode() {
        return isExplorationMode;
    }
    
    function setPointerLock(lock) {
        if (lock) {
            requestPointerLock();
        } else if (document.exitPointerLock) {
            document.exitPointerLock();
        }
    }
    
    // Exit pointer lock
    function exitPointerLock() {
        if (isPointerLocked) {
            document.exitPointerLock = (
                document.exitPointerLock ||
                document.mozExitPointerLock ||
                document.webkitExitPointerLock
            );
            
            if (document.exitPointerLock) {
                document.exitPointerLock();
            } else {
                console.warn("Pointer lock exit API not supported in this browser");
            }
        }
    }
    
    // Public API
    return {
        init: init,
        update: update,
        getForwardVector: getForwardVector,
        getUpVector: getUpVector,
        getRightVector: getRightVector,
        applyRoll: applyRoll,
        resetRotation: resetRotation,
        setExplorationMode: setExplorationMode,
        getExplorationMode: getExplorationMode,
        getYawObject: () => yawObject,
        getPitchObject: () => pitchObject,
        getObject: () => yawObject,
        setPointerLock: function(shouldLock) {
            if (shouldLock && !isPointerLocked) {
                requestPointerLock();
            } else if (!shouldLock && isPointerLocked) {
                exitPointerLock();
            }
        },
        exitPointerLock: exitPointerLock,
        requestPointerLock: requestPointerLock,
        isPointerLocked: () => isPointerLocked,
        get cameraPitchRotation() { return currentPitchRotation; },
        get cameraYawRotation() { return currentYawRotation; },
        get cameraRollRotation() { return currentRollRotation; },
        setRollLeft: function(isActive) {
            targetRollRotation = isActive ? -0.2 : 0;
        },
        setRollRight: function(isActive) {
            targetRollRotation = isActive ? 0.2 : 0;
        }
    };
})(); 

// Expose Controls globally
window.Controls = Controls; 