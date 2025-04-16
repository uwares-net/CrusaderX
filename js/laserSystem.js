/**
 * laserSystem.js - Manages laser weapons for the player ship
 * Handles firing, rendering, and collision detection for laser weapons
 */


const LaserSystem = (function() {
    
    'use strict';
    
    // Private variables
    let scene = null;
    let camera = null;
    
    // Laser properties
    const LASER_COLOR = 0xff0000;         // Bright red
    const LASER_SECONDARY_COLOR = 0xff6666; // Lighter red for glow
    const LASER_DIAMETER = 0.04;           // Beam thickness
    const LASER_MAX_DISTANCE = 1.5;       // How far the lasers travel
    const LASER_LIFETIME = 0.1;            // Seconds lasers remain visible
    const FIRE_COOLDOWN = 0.25;            // Seconds between shots

    const ENEMY_HITBOX_INFLATION_FACTOR = 0.8; // Make hitbox 30% larger for collision
    
    
    // State tracking
    let lastFireTime = 0;
    let canFire = true;
    let isFiring = false;
    let activeLasers = [];
    let laserAudio = null; // Audio element for laser sound
    
    // Stub for client-side input validation.
    function isEnemyInView() {
        const camera = App.getCamera();
        if (!camera) return false;
        
        // Update the camera matrices.
        camera.updateMatrixWorld();
        const cameraViewProjectionMatrix = new THREE.Matrix4();
        cameraViewProjectionMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        const frustum = new THREE.Frustum();
        frustum.setFromProjectionMatrix(cameraViewProjectionMatrix);
      
        // Define maximum allowed distance.
        // 0.02 AU, given 1 AU = 100 units, equals 2 units.
        const maxDistance = 2;
        const cameraPos = new THREE.Vector3();
        camera.getWorldPosition(cameraPos);
      
        const enemyShips = NetworkController.getEnemyShips();
        for (const id in enemyShips) {
          const enemy = enemyShips[id];
          if (enemy && enemy.mesh) {
            const enemyPos = new THREE.Vector3();
            enemy.mesh.getWorldPosition(enemyPos);
            
            const distance = enemyPos.distanceTo(cameraPos);
            //console.log(`Enemy ${id} distance: ${distance.toFixed(2)} units`);
      
            // If enemy is within the camera's view and within maxDistance, return true.
            if (frustum.containsPoint(enemyPos) && distance <= maxDistance) {
            //console.log(`Enemy ${id} is in view`);
              return true;
            }
          }
        }
        return false;
      }
      
      function pointLineDistance(point, lineStart, lineEnd) {
        const AB = new THREE.Vector3().subVectors(lineEnd, lineStart);
        const AP = new THREE.Vector3().subVectors(point, lineStart);
        const ab2 = AB.dot(AB);
        if (ab2 === 0) return AP.length(); // lineStart and lineEnd are the same
        let t = AP.dot(AB) / ab2;
        t = Math.max(0, Math.min(1, t)); // Clamp t to the segment [0,1]
        const closestPoint = new THREE.Vector3().copy(lineStart).add(AB.multiplyScalar(t));
        return point.distanceTo(closestPoint);
      }
      


/**
 * Helper: Create an oriented bounding box (OBB) for the laser beam.
 * This replaces the old createLaserBox() that built an axis‐aligned Box3.
 */
function createLaserOBB(laserStart, laserEnd) {
    // Compute the direction and length of the laser beam.
    const direction = new THREE.Vector3().subVectors(laserEnd, laserStart);
    const length = direction.length();
    // Avoid division by zero if length is zero
    if (length > 0) {
        direction.normalize();
    } else {
        direction.set(0, 0, -1); // Default direction if length is zero
    }


    // Compute the midpoint for positioning the OBB.
    const center = new THREE.Vector3().addVectors(laserStart, laserEnd).multiplyScalar(0.5);

    // Set half-sizes:
    // • Along the beam’s axis: half of the total length.
    // • Perpendicular axes: half the laser’s diameter.
    // IMPORTANT: THREE.OBB constructor expects (center, halfSize, rotationMatrix)
    // We calculate halfSize for the local axes *before* rotation.
    // Assume laser cylinder is initially oriented along Y axis for standard THREE geometries.
    const halfSize = new THREE.Vector3(LASER_DIAMETER / 2, length / 2, LASER_DIAMETER / 2);

    // Determine the rotation:
    // The cylinder geometry is built along Y by default, so rotate from Y to the laser's direction.
    const quaternion = new THREE.Quaternion();
    // Handle the case where the direction is exactly opposite the up vector
    if (direction.equals(new THREE.Vector3(0, -1, 0))) {
         quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
    } else {
         quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    }
    const rotationMatrix = new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(quaternion));

    // Create and return the OBB. Use THREE.OBB
    // Pass rotationMatrix, not quaternion
    return new THREE.OBB(center, halfSize, rotationMatrix); // Use THREE.OBB
}

   /**
    * Performs an Oriented Bounding Box (OBB) collision check between a laser segment
    * and an enemy object, considering a maximum distance constraint.
    * @param {THREE.Vector3} laserStart - World space start position of the laser segment.
    * @param {THREE.Vector3} laserEnd - World space end position of the laser segment.
    * @param {Object} enemy - The enemy object, containing an `enemy.mesh` (THREE.Object3D).
    * @returns {boolean} True if the laser intersects the enemy within range, false otherwise.
    */
   function checkLaserCollisionUsingOBB(laserStart, laserEnd, enemy) {
    // --- 1. Validate Input ---
    if (!enemy || !enemy.mesh) {
        return false;
    }

    // --- 2. Compute Enemy AABB ---
    const enemyBox = new THREE.Box3();
    try {
        enemy.mesh.updateMatrixWorld(true); // Ensure matrix is up-to-date
        enemyBox.setFromObject(enemy.mesh); // Handles Groups and Meshes
    } catch (e) {
        console.error(`Error computing bounding box for enemy ${enemy.id || 'unknown'}:`, e, enemy.mesh);
        return false;
    }

    // --- 3. Validate Computed AABB ---
    if (enemyBox.isEmpty() ||
        !isFinite(enemyBox.min.x) || !isFinite(enemyBox.min.y) || !isFinite(enemyBox.min.z) ||
        !isFinite(enemyBox.max.x) || !isFinite(enemyBox.max.y) || !isFinite(enemyBox.max.z) ||
        enemyBox.min.equals(enemyBox.max)) // Check for zero volume
    {
        // console.warn(`Enemy ${enemy.id || 'unknown'} has invalid/degenerate bounding box. Skipping collision.`, enemyBox, enemy.mesh); // Debug log
        return false;
    }

    // --- 4. Create Enemy OBB ---
    const enemyCenter = enemyBox.getCenter(new THREE.Vector3());
    const enemyHalfSize = enemyBox.getSize(new THREE.Vector3()).multiplyScalar(0.5);
    enemyHalfSize.multiplyScalar(ENEMY_HITBOX_INFLATION_FACTOR); // Make target bigger

    const enemyRotation = new THREE.Matrix3().setFromMatrix4(enemy.mesh.matrixWorld);
    const enemyOBB = new THREE.OBB(enemyCenter, enemyHalfSize, enemyRotation);

    // --- 5. Create Laser OBB ---
    const laserOBB = createLaserOBB(laserStart, laserEnd);
    if (!laserOBB) {
        console.warn("Failed to create laser OBB for collision check.");
        return false;
    }

    // --- 6. Check Distance Constraint ---
    const camera = App.getCamera();
    if (!camera) return false; // Need camera for distance check
    const playerPos = new THREE.Vector3();
    camera.getWorldPosition(playerPos);
    const MAX_COLLISION_DISTANCE = 2.0; // Max distance in world units

    if (enemyCenter.distanceTo(playerPos) > MAX_COLLISION_DISTANCE) {
        return false; // Enemy too far away
    }

    // --- 7. Perform OBB Intersection Test ---
    const intersects = laserOBB.intersectsOBB(enemyOBB);

    // --- Optional Debug Logging ---
     if (intersects) {
         //console.log(`OBB Intersection DETECTED between laser and enemy ${enemy.id}`);
     }

    return intersects;
}
  
  /**
   * Updated function to loop over enemy ships and check if either laser beam collides 
   * with any enemy using OBB collision tests.
   * Replaces the old checkEnemiesForLaserHit() which used Box3.
   */
  function checkEnemiesForLaserHit(leftRemotePos, rightRemotePos, targetPos) {
    const camera = App.getCamera();
    if (!camera) return false;
  
    // Get player's world position.
    const playerPos = new THREE.Vector3();
    camera.getWorldPosition(playerPos);
  
    const enemyShips = NetworkController.getEnemyShips();
    for (const id in enemyShips) {
      const enemy = enemyShips[id];
      if (enemy && enemy.mesh) {
        // Skip enemies that are further than 2 units from the player.
        const enemyPos = new THREE.Vector3();
        enemy.mesh.getWorldPosition(enemyPos);
        if (enemyPos.distanceTo(playerPos) > 4) continue;
  
        // Optionally skip objects flagged as lasers.
        if (enemy.isLaser) continue;
         //console.log(`Enemy ${id} is within 2 units of the player`);
        // Check collision using the OBB test on both laser beams.
        if (
          checkLaserCollisionUsingOBB(leftRemotePos, targetPos, enemy) ||
          checkLaserCollisionUsingOBB(rightRemotePos, targetPos, enemy)
        ) {
          console.log(`Enemy ${id} collided with a laser beam (using OBB)`);
          return true;
        }
      }
    }
    return false;
  }
  


    /**
     * Initialize the laser system
     */
    function init(sceneRef, cameraRef) {
        try {
            scene = sceneRef;
            camera = cameraRef;
            
            laserAudio = new Audio('soundfx/Laser.mp3');
            laserAudio.volume = 0.4;
            
            document.addEventListener('mousedown', onMouseDown);
            document.addEventListener('mouseup', onMouseUp);
            document.addEventListener('keydown', onKeyDown);
            document.addEventListener('keyup', onKeyUp);
            
            console.log("Laser system initialized");
            return true;
        } catch (error) {
            console.error("Error initializing laser system:", error);
            return false;
        }
    }
    
    /**
     * Handle mouse down event for firing
     */
    function onMouseDown(event) {
        if (event.button === 0 && document.pointerLockElement) {
            isFiring = true;
            console.log("Mouse down - laser firing activated");
        }
    }
    
    /**
     * Handle mouse up event to stop firing
     */
    function onMouseUp(event) {
        if (event.button === 0) {
            isFiring = false;
        }
    }
    
    /**
     * Handle key down event (space bar) for firing
     */
    function onKeyDown(event) {
        if (event.code === 'Space') {
            isFiring = true;
            //console.log("Space down - laser firing activated");
        }
    }
    
    /**
     * Handle key up event to stop firing
     */
    function onKeyUp(event) {
        if (event.code === 'Space') {
            isFiring = false;
        }
    }
    
    /**
     * Helper: Process a laser fire given start and end positions.
     * Options can control whether to add muzzle flash, play sound, etc.
     * This function encapsulates the common code used for both local firing
     * and remote rendering.
     *
     * @param {THREE.Vector3} startPosition - Starting position of the laser beam
     * @param {THREE.Vector3} endPosition - Ending position of the laser beam
     * @param {Object} [options] - Options for processing the laser fire
     * @param {boolean} [options.addMuzzleFlash=false] - Whether to add a muzzle flash effect
     * @param {boolean} [options.playSound=false] - Whether to play the laser sound
     * @returns {Object|null} An object with the created laser beam and creationTime, or null on error.
     */
    function processLaserFire(startPosition, endPosition, options = {}) {
        try {
            //console.log("Processing laser fire:");
            //console.log("Start Position:", startPosition.toArray());
            //console.log("End Position:", endPosition.toArray());
      
            // Compute the direction and length.
            const direction = new THREE.Vector3().subVectors(endPosition, startPosition).normalize();
            const length = startPosition.distanceTo(endPosition);
            //console.log("Laser direction:", direction.toArray());
            //console.log("Laser length:", length);
      
            // Create the geometry for the laser beam (oriented along Y by default).
            const laserGeometry = new THREE.CylinderGeometry(
                LASER_DIAMETER / 2, // top radius
                LASER_DIAMETER / 2, // bottom radius
                length,             // height
                8,                  // radial segments
                1,                  // height segments
                false               // open ended
            );
      
            // Compute the midpoint for positioning the beam.
            const midpoint = new THREE.Vector3().addVectors(startPosition, endPosition).multiplyScalar(0.5);
            //console.log("Laser midpoint:", midpoint.toArray());
      
            // Create the material for the laser beam.
            const laserMaterial = new THREE.MeshBasicMaterial({
                color: LASER_COLOR,
                transparent: true,
                opacity: 0.8,
                depthWrite: false
            });
      
            // Create the laser beam mesh.
            const laserBeam = new THREE.Mesh(laserGeometry, laserMaterial);
            laserBeam.position.copy(midpoint);
      
            // Set the quaternion so that the beam aligns with the direction vector.
            laserBeam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
      
            // Add the laser beam to the scene.
            scene.add(laserBeam);
      
            // Optionally add a muzzle flash effect at the emitter position.
            if (options.addMuzzleFlash) {
                addMuzzleFlash(startPosition);
            }
      
            // Optionally play the laser sound.
            if (options.playSound && laserAudio) {
                const sound = laserAudio.cloneNode();
                sound.play().catch(err => console.warn("Could not play laser sound:", err));
            }
      
            return { beam: laserBeam, creationTime: performance.now() / 1000 };
        } catch (error) {
            console.error("Error processing laser fire:", error);
            return null;
        }
    }
    
    function getRemoteEmitterWorldPosition(emitterName) {
        if (!window.shipModel) {
            console.warn("Ship model is not loaded yet");
            return new THREE.Vector3();
          }
          const emitter = window.shipModel.getObjectByName(emitterName);
          if (!emitter) {
            console.warn(`Emitter ${emitterName} not found on ship model`);
            return new THREE.Vector3();
          }
          return emitter.getWorldPosition(new THREE.Vector3());
        }
      
      // For local rendering, apply a fixed offset to simulate the turret.
      function getLocalEmitterWorldPosition(emitterName) {
        // Define fixed local offsets (tweak as needed)
        let localOffset = new THREE.Vector3();
        if (emitterName === "LeftLaserEmitter") {
          localOffset.set(3, -0.5, 0);
        } else if (emitterName === "RightLaserEmitter") {
          localOffset.set(-3, -0.5, 0);
        }
        // Get the camera's world position and rotation.
        const cameraWorldPos = new THREE.Vector3();
        camera.getWorldPosition(cameraWorldPos);
        const cameraWorldQuat = new THREE.Quaternion();
        camera.getWorldQuaternion(cameraWorldQuat);
        // Rotate the local offset by the camera’s orientation.
        localOffset.applyQuaternion(cameraWorldQuat);
        // Return the adjusted position.
        return cameraWorldPos.add(localOffset);
      }
      
    
    /**
     * Fire lasers from the ship.
     * Computes the emitter positions and target position, then uses processLaserFire
     * to handle the creation, effects, and sending of laser data.
     */
    function fireLasers() {
        try {
          if (!scene || !camera || !canFire) return;
          const now = performance.now() / 1000;
          if (now - lastFireTime < FIRE_COOLDOWN) return;
          lastFireTime = now;
          canFire = false;
          setTimeout(() => { canFire = true; }, FIRE_COOLDOWN * 1000);
      
          // Update matrices
          camera.updateMatrixWorld(true);
          if (window.shipModel) {
            window.shipModel.updateMatrixWorld(true);
          }
      
          // Compute target point as before.
          const raycaster = new THREE.Raycaster();
          const screenOffset = new THREE.Vector2(0, 0);
          raycaster.setFromCamera(screenOffset, camera);
          const targetPos = raycaster.ray.origin.clone()
            .add(raycaster.ray.direction.clone().multiplyScalar(LASER_MAX_DISTANCE));
      
            const leftLocalPos = getLocalEmitterWorldPosition("LeftLaserEmitter");
            const rightLocalPos = getLocalEmitterWorldPosition("RightLaserEmitter");
            
            // Render the lasers using these local positions.
            const leftLaser = processLaserFire(leftLocalPos, targetPos, { addMuzzleFlash: true, playSound: true });
            const rightLaser = processLaserFire(rightLocalPos, targetPos, { addMuzzleFlash: true, playSound: true });
            if (leftLaser) activeLasers.push(leftLaser);
            if (rightLaser) activeLasers.push(rightLaser);
            
            // For network transmission, use the true emitter positions:
            const leftRemotePos = getRemoteEmitterWorldPosition("LeftLaserEmitter");
            const rightRemotePos = getRemoteEmitterWorldPosition("RightLaserEmitter");

    
            // Determine if an enemy is onscreen (client-side validation).
            const enemyInView = checkEnemiesForLaserHit(leftRemotePos, rightRemotePos, targetPos);
            //const enemyInView = isEnemyInView();
    
            // Package laser fire data for sending to the server.
            const leftLaserData = {
                startPosition: leftRemotePos,
                endPosition: targetPos,
                likelyHit: enemyInView
            };
            const rightLaserData = {
                startPosition: rightRemotePos,
                endPosition: targetPos,
                likelyHit: enemyInView
            };
    
            // Send the laser fire events via the NetworkController.
            NetworkController.sendLaserFire(leftLaserData);
            NetworkController.sendLaserFire(rightLaserData);
  
        } catch (error) {
            console.error("Error firing lasers:", error);
        }
    }
    
    /**
     * Add muzzle flash effect at the given position.
     */
    function addMuzzleFlash(position) {
        try {
            const light = new THREE.PointLight(LASER_COLOR, 2, 5);
            light.position.copy(position);
            scene.add(light);
            
            const flashGeometry = new THREE.SphereGeometry(LASER_DIAMETER * 1.5, 8, 8);
            const flashMaterial = new THREE.MeshBasicMaterial({
                color: LASER_COLOR,
                transparent: true,
                opacity: 0.8
            });
            
            const flash = new THREE.Mesh(flashGeometry, flashMaterial);
            flash.position.copy(position);
            scene.add(flash);
            
            setTimeout(() => {
                scene.remove(light);
                scene.remove(flash);
                flashGeometry.dispose();
                flashMaterial.dispose();
            }, 100);
        } catch (error) {
            console.error("Error adding muzzle flash:", error);
        }
    }
    
    /**
     * Update active lasers and remove those that exceed their lifetime.
     */
    function updateLasers(deltaTime) {
        try {
            const now = performance.now() / 1000;
            for (let i = activeLasers.length - 1; i >= 0; i--) {
                const laser = activeLasers[i];
                const age = now - laser.creationTime;
                if (age > LASER_LIFETIME) {
                    scene.remove(laser.beam);
                    if (laser.beam.geometry) laser.beam.geometry.dispose();
                    if (laser.beam.material) laser.beam.material.dispose();
                    activeLasers.splice(i, 1);
                    continue;
                }
                // Optionally update visual effects here.
            }
        } catch (error) {
            console.error("Error updating lasers:", error);
        }
    }
    
    /**
     * Clean up resources used by the laser system.
     */
    function dispose() {
        document.removeEventListener('mousedown', onMouseDown);
        document.removeEventListener('mouseup', onMouseUp);
        document.removeEventListener('keydown', onKeyDown);
        document.removeEventListener('keyup', onKeyUp);
        
        activeLasers.forEach(laser => {
            if (laser.beam) {
                scene.remove(laser.beam);
                if (laser.beam.geometry) laser.beam.geometry.dispose();
                if (laser.beam.material) laser.beam.material.dispose();
            }
            // Dispose of any additional effects if present.
        });
        activeLasers = [];
    }
    
    /**
     * Render a remote laser beam based on data received from the server.
     * Instead of calling createLaser directly, this function calls processLaserFire
     * so that it uses the same underlying logic as local laser firing.
     */
    function renderRemoteLaser(data) {
        //console.log("Rendering remote laser:", data);
        if (!data || !data.startPosition || !data.endPosition) return;
        
        const start = new THREE.Vector3(data.startPosition.x, data.startPosition.y, data.startPosition.z);
        const end = new THREE.Vector3(data.endPosition.x, data.endPosition.y, data.endPosition.z);
        
        // For remote lasers, we typically don't play sound or add muzzle flash.
        const remoteLaser = processLaserFire(start, end, { addMuzzleFlash: false, playSound: false });
        if (remoteLaser) activeLasers.push(remoteLaser);
    }
    
    // Public API
    return {
        init: init,
        update: updateLasers,
        dispose: dispose,
        fireLasers: fireLasers,
        get isFiring() { return isFiring; },
        renderRemoteLaser: renderRemoteLaser
    };
})();
