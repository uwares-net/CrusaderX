/**
 * pointerLockControls.js - Custom implementation of PointerLockControls
 * Based on THREE.js PointerLockControls 
 */

const PointerLockControls = (function() {
    'use strict';
    
    // Constructor function
    function PointerLockControls(camera, domElement) {
        const scope = this;
        
        // Set camera and DOM element
        this.camera = camera;
        this.domElement = domElement || document.body;
        
        // Create the camera rig
        this.yawObject = new THREE.Object3D();
        this.yawObject.name = 'yawObject';
        
        this.pitchObject = new THREE.Object3D();
        this.pitchObject.name = 'pitchObject';
        
        // Add camera to pitch object
        this.pitchObject.add(camera);
        
        // Add pitch object to yaw object
        this.yawObject.add(this.pitchObject);
        
        // State tracking
        this.isLocked = false;
        
        // Mouse position tracking
        this.mouseX = 0;  // Current mouse X position relative to center
        this.mouseY = 0;  // Current mouse Y position relative to center
        
        // Configuration parameters
        this.MOUSE_SENSITIVITY = 0.01;  // How quickly ship rotates based on mouse position
        this.MAX_ROTATION_RATE = 2.0;   // Maximum rotation rate in radians per second
        this.DEADZONE = 5;              // Deadzone in pixels to prevent micro-movements


        this.rollLeftActive = false;
        this.rollRightActive = false;
        this.ROLL_RATE = 1.8; // Radians per second for roll speed - adjust as needed
        this.currentRoll = 0; // Keep track of the current roll angle applied
        this.ROLL_DAMPING = 0.15; // Smoothing factor for roll return

        this._onKeyDown = function(event) {
            if (!scope.isLocked) return; // Only handle keys when locked
            switch (event.code) {
                case 'KeyA':
                    scope.rollLeftActive = true;
                    break;
                case 'KeyD':
                    scope.rollRightActive = true;
                    break;
            }
        }.bind(this); // Bind 'this'

        this._onKeyUp = function(event) {
            // No need to check isLocked here, just reset flags if keys are released
             switch (event.code) {
                case 'KeyA':
                    scope.rollLeftActive = false;
                    break;
                case 'KeyD':
                    scope.rollRightActive = false;
                    break;
            }
        }.bind(this); // Bind 'this'


        // Current rotation rates (angular velocities)
        this.yawRate = 0;   // Rotation rate around Y axis (left/right)
        this.pitchRate = 0; // Rotation rate around X axis (up/down)
        
        // Set screen center point at initialization
        this.centerX = window.innerWidth / 2;
        this.centerY = window.innerHeight / 2;
        
        // For virtual cursor position and limiting bounds
        this.virtualMouseX = this.centerX;
        this.virtualMouseY = this.centerY;
        this.mouseBounds = Math.min(window.innerWidth, window.innerHeight) * 0.4; // 40% of smallest dimension
        
        // Private properties
        this.isLocked = false;
        
        // Event listeners
        this.eventListeners = {};
        
        // Bind methods to ensure 'this' context
        this.onMouseMove = this.onMouseMove.bind(this);
        this.mouseMoveListener = this.onMouseMove; // Keep a reference for event handling
        this.onPointerlockChange = this.onPointerlockChange.bind(this);
        this.onPointerlockError = this.onPointerlockError.bind(this);
        this.onWindowResize = this.onWindowResize.bind(this);
        
        // Initialize event listeners
        this.connect();
        
        // Handle window resize to update center point
        window.addEventListener('resize', this.onWindowResize, false);
        
        console.log("PointerLockControls initialized ");
    }
    
    // Prototype methods
    PointerLockControls.prototype = {
        constructor: PointerLockControls,
        
        onWindowResize: function() {
            // Update center point and bounds when window resizes
            this.centerX = window.innerWidth / 2;
            this.centerY = window.innerHeight / 2;
            this.mouseBounds = Math.min(window.innerWidth, window.innerHeight) * 0.4;
            
            // Reset virtual mouse position to center
            this.virtualMouseX = this.centerX;
            this.virtualMouseY = this.centerY;
        },
        
        connect: function() {
            document.addEventListener('pointerlockchange', this.onPointerlockChange, false);
            document.addEventListener('mozpointerlockchange', this.onPointerlockChange, false);
            document.addEventListener('webkitpointerlockchange', this.onPointerlockChange, false);
            
            document.addEventListener('pointerlockerror', this.onPointerlockError, false);
            document.addEventListener('mozpointerlockerror', this.onPointerlockError, false);
            document.addEventListener('webkitpointerlockerror', this.onPointerlockError, false);
        },
        
        disconnect: function() {
            document.removeEventListener('pointerlockchange', this.onPointerlockChange, false);
            document.removeEventListener('mozpointerlockchange', this.onPointerlockChange, false);
            document.removeEventListener('webkitpointerlockchange', this.onPointerlockChange, false);
            
            document.removeEventListener('pointerlockerror', this.onPointerlockError, false);
            document.removeEventListener('mozpointerlockerror', this.onPointerlockError, false);
            document.removeEventListener('webkitpointerlockerror', this.onPointerlockError, false);
            
            document.removeEventListener('mousemove', this.mouseMoveListener, false);
 
            document.removeEventListener('keydown', this._onKeyDown, false);
            document.removeEventListener('keyup', this._onKeyUp, false);

            window.removeEventListener('resize', this.onWindowResize, false);
        },
        
        onMouseMove: function(event) {
            if (!this.isLocked) {
                return;
            }
            
            // Get mouse movement since last frame
            const movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
            const movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;
            
            // Update virtual mouse position (clamped to bounds)
            this.virtualMouseX += movementX;
            this.virtualMouseY += movementY;
            
            // Constrain virtual mouse position to prevent extreme rates
            const maxOffset = this.mouseBounds;
            this.virtualMouseX = Math.max(this.centerX - maxOffset, Math.min(this.centerX + maxOffset, this.virtualMouseX));
            this.virtualMouseY = Math.max(this.centerY - maxOffset, Math.min(this.centerY + maxOffset, this.virtualMouseY));
            
            this.mouseX = this.virtualMouseX - this.centerX;
            this.mouseY = this.virtualMouseY - this.centerY;
        },
        setRollLeft: function(isActive) {
            this.rollLeftActive = isActive;
        },

        setRollRight: function(isActive) {
            this.rollRightActive = isActive;
        },
        update: function(deltaTime) {
            // Skip update if not locked
            if (!this.isLocked) return;

            // --- Adjust Mouse Input based on Roll ---
            const currentRollAngle = this.camera.rotation.z; // Get the current roll angle

            // Calculate sin and cos for the *negative* roll angle correction
            // cos(-angle) = cos(angle), sin(-angle) = -sin(angle)
            const cosRoll = Math.cos(currentRollAngle);
            const sinRoll = Math.sin(currentRollAngle);

            // Rotate the mouse input vector by -currentRollAngle
            // This adjusts the input so horizontal mouse moves primarily affect yaw,
            // and vertical moves primarily affect pitch, regardless of roll.
            const adjustedMouseX = this.mouseX * cosRoll + this.mouseY * sinRoll;
            const adjustedMouseY = -this.mouseX * sinRoll + this.mouseY * cosRoll;
            // --- End Mouse Input Adjustment ---


            // --- Pitch/Yaw update logic (USING ADJUSTED MOUSE VALUES) ---
            let targetYawRate = 0;
            let targetPitchRate = 0;

            // Use adjustedMouseX/Y for deadzone checks and rate calculation
            if (Math.abs(adjustedMouseX) > this.DEADZONE) {
                const xOutsideDeadzone = adjustedMouseX > 0 ? adjustedMouseX - this.DEADZONE : adjustedMouseX + this.DEADZONE;
                targetYawRate = -(xOutsideDeadzone * this.MOUSE_SENSITIVITY);
                targetYawRate = Math.max(-this.MAX_ROTATION_RATE, Math.min(this.MAX_ROTATION_RATE, targetYawRate));
            }
            if (Math.abs(adjustedMouseY) > this.DEADZONE) {
                const yOutsideDeadzone = adjustedMouseY > 0 ? adjustedMouseY - this.DEADZONE : adjustedMouseY + this.DEADZONE;
                targetPitchRate = -(yOutsideDeadzone * this.MOUSE_SENSITIVITY);
                targetPitchRate = Math.max(-this.MAX_ROTATION_RATE, Math.min(this.MAX_ROTATION_RATE, targetPitchRate));
            }

            // Smoothly transition to target rates for yaw/pitch
            const transitionSpeed = 10;
            this.yawRate += (targetYawRate - this.yawRate) * Math.min(1, deltaTime * transitionSpeed);
            this.pitchRate += (targetPitchRate - this.pitchRate) * Math.min(1, deltaTime * transitionSpeed);

            // Apply yaw/pitch rotation based on rates and delta time
            if (Math.abs(this.yawRate) > 0.0001) {
                this.yawObject.rotation.y += this.yawRate * deltaTime;
            }
            if (Math.abs(this.pitchRate) > 0.0001) {
                const newPitch = this.pitchObject.rotation.x + this.pitchRate * deltaTime;
                this.pitchObject.rotation.x = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, newPitch));
            }
            // --- End of Pitch/Yaw Logic ---


            // --- Roll Logic (Uses internal rollLeftActive/rollRightActive flags - REMAINS THE SAME) ---
            let rollAmount = 0;
            if (this.rollLeftActive) {
                rollAmount = this.ROLL_RATE * deltaTime; // Roll left (positive Z rotation)
            } else if (this.rollRightActive) {
                rollAmount = -this.ROLL_RATE * deltaTime; // Roll right (negative Z rotation)
            }

            // Apply the roll ONLY if a key is pressed
            if (rollAmount !== 0) {
                 this.camera.rotateZ(rollAmount);
            }
            // No snap-back else block here
            // --- End of Roll Logic ---

        }, // End of update function
        
        onPointerlockChange: function() {
            this.isLocked = document.pointerLockElement === this.domElement || 
                         document.mozPointerLockElement === this.domElement || 
                         document.webkitPointerLockElement === this.domElement;
            
            if (this.isLocked) {
                // Mouse movement controls active
                document.addEventListener('mousemove', this.mouseMoveListener, false);
                 // ADD internal key listeners for A/D roll
                 document.addEventListener('keydown', this._onKeyDown, false);
                 document.addEventListener('keyup', this._onKeyUp, false);
                // Reset virtual mouse position to center
                this.virtualMouseX = this.centerX;
                this.virtualMouseY = this.centerY;
                
                // Reset rotation rates
                this.yawRate = 0;
                this.pitchRate = 0;
                this.rollLeftActive = false; // Reset roll state on lock
                this.rollRightActive = false;
                
                // Dispatch locked event
                this.dispatchEvent({ type: 'lock' });
            } else {
                // Mouse movement controls inactive
                document.removeEventListener('mousemove', this.mouseMoveListener, false);
                // REMOVE internal key listeners
                document.removeEventListener('keydown', this._onKeyDown, false);
                document.removeEventListener('keyup', this._onKeyUp, false);

                // Reset roll state on unlock
                this.rollLeftActive = false;
                this.rollRightActive = false;                
                // Dispatch unlocked event
                this.dispatchEvent({ type: 'unlock' });
            }
        },
        
        onPointerlockError: function() {
            console.error('PointerLockControls: Error locking pointer');
            this.dispatchEvent({ type: 'error' });
        },
        
        lock: function() {
            // Request pointer lock on the DOM element
            if (this.domElement.requestPointerLock) {
                this.domElement.requestPointerLock();
            } else if (this.domElement.mozRequestPointerLock) {
                this.domElement.mozRequestPointerLock();
            } else if (this.domElement.webkitRequestPointerLock) {
                this.domElement.webkitRequestPointerLock();
            } else {
                console.warn('Browser does not support pointer lock API');
            }
        },
        
        unlock: function() {
            // Exit pointer lock mode
            if (document.exitPointerLock) {
                document.exitPointerLock();
            } else if (document.mozExitPointerLock) {
                document.mozExitPointerLock();
            } else if (document.webkitExitPointerLock) {
                document.webkitExitPointerLock();
            }
        },
        
        getObject: function() {
            return this.yawObject;
        },
        
        getYawObject: function() {
            return this.yawObject;
        },
        
        getPitchObject: function() {
            return this.pitchObject;
        },
        
        getDirection: function() {
            const direction = new THREE.Vector3(0, 0, -1);
            const quaternion = new THREE.Quaternion();
            // Use the camera’s world quaternion which includes pitch:
            this.camera.getWorldQuaternion(quaternion);
            direction.applyQuaternion(quaternion);
            return direction;
        },
        
        getUpVector: function() {
            // Get current up vector
            const up = new THREE.Vector3(0, 1, 0);
            const quaternion = new THREE.Quaternion();
            
            // Get the camera's world quaternion
            this.camera.getWorldQuaternion(quaternion);
            
            // Apply quaternion to up vector
            up.applyQuaternion(quaternion);
            
            return up;
        },
        
        getRightVector: function() {
            // Get current right vector (cross product of up and forward)
            const right = new THREE.Vector3();
            const forward = this.getDirection();
            const up = this.getUpVector();
            
            right.crossVectors(up, forward).normalize();
            
            return right;
        },
        
        getRotationRates: function() {
            return {
                yaw: this.yawRate,
                pitch: this.pitchRate
            };
        },
        
        getVirtualMousePosition: function() {
            return {
                x: this.virtualMouseX,
                y: this.virtualMouseY,
                offsetX: this.mouseX,
                offsetY: this.mouseY
            };
        },
        
        dispose: function() {
            this.disconnect();
        },
        
        // Event handling
        addEventListener: function(type, listener) {
            if (this.eventListeners[type] === undefined) {
                this.eventListeners[type] = [];
            }
            
            if (this.eventListeners[type].indexOf(listener) === -1) {
                this.eventListeners[type].push(listener);
            }
        },
        
        removeEventListener: function(type, listener) {
            if (this.eventListeners[type] === undefined) return;
            
            const index = this.eventListeners[type].indexOf(listener);
            
            if (index !== -1) {
                this.eventListeners[type].splice(index, 1);
            }
        },
        
        dispatchEvent: function(event) {
            if (this.eventListeners[event.type] === undefined) return;
            
            const listeners = this.eventListeners[event.type].slice(0);
            
            for (let i = 0; i < listeners.length; i++) {
                listeners[i].call(this, event);
            }
        }
    };
    
    return PointerLockControls;
})(); 