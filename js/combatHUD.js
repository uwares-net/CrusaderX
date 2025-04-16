// combatHUD.js
"use strict";

const CombatHUD = (function() {

  // Private references to camera, renderer, scene
  let camera = null;
  let renderer = null;
  let scene = null;

  // DOM elements for HUD
  let hudContainer = null;
  let coordX, coordY, coordZ, distanceSun, velocityValue;  
  let enemyTarget, enemyTargetCircle, enemyTargetLabel, enemyInfo;
  // Add elements for Health Indicator
  let healthIndicatorContainer, healthSegments = [];
  const MAX_HEALTH_SEGMENTS = 10; // Number of segments in the health bar

  // Raycaster (if needed in the future)
  let raycaster, mouse;

  // Enemy targeting state
  let targetedEnemy = null;
  let lastTargetCheckTime = 0;
  const TARGET_CHECK_INTERVAL = 1000; // in ms
  const MAX_TARGET_DIAMETER = 50;     // max diameter in px
  const MIN_TARGET_DIAMETER = 25;     // min diameter in px
  let lastTargetTime = 0;
  const TARGET_TIMEOUT = 2000;        // in ms

  // For debugging logs (throttling)
  let lastDebugTime = 0;

  /**
   * Initialize the Combat HUD.
   * Expects an object: { camera, renderer, scene }
   */
  function init(params) {
    camera = params.camera;
    renderer = params.renderer;
    scene = params.scene;

    console.log("CombatHUD init() called with:", params);

    // Look for an existing container with id "combat-hud" or create one
    hudContainer = document.getElementById("combat-hud");
    if (!hudContainer) {
      hudContainer = document.createElement("div");
      hudContainer.id = "combat-hud";
      hudContainer.style.position = "absolute";
      hudContainer.style.top = "0";
      hudContainer.style.left = "0";
      hudContainer.style.width = "100%";
      hudContainer.style.height = "100%";
      hudContainer.style.pointerEvents = "none";
      hudContainer.style.zIndex = "999"; // make sure it appears above your scene
      // Ensure visibility (but initially hidden since we start in exploration mode)
      hudContainer.style.display = "none"; 
      hudContainer.style.visibility = "visible";
      document.body.appendChild(hudContainer);
      console.log("Created new combat-hud container element");
    } else {
      // Existing container should maintain its current visibility state
      console.log("Using existing combat-hud container element");
    }
    createCoordinateElements();
    // Create enemy target UI elements
    createEnemyTargetElements();
    // Create health indicator UI elements
    createHealthIndicatorElements();

    // Create (or reference) an enemy info panel
    //enemyInfo = document.getElementById("enemy-info");
    //if (!enemyInfo) {
    //  enemyInfo = document.createElement("div");
    //  enemyInfo.id = "enemy-info";
    //  enemyInfo.style.position = "absolute";
    //  enemyInfo.style.top = "200px";
    //  enemyInfo.style.right = "20px";
    //  enemyInfo.style.width = "300px";
    //  enemyInfo.style.color = "#fff";
    //  enemyInfo.style.background = "rgba(0,0,0,0.5)";
    //  enemyInfo.style.padding = "10px";
    //  enemyInfo.style.borderRadius = "5px";
    //  enemyInfo.style.display = "none"; // Hidden initially
    //  hudContainer.appendChild(enemyInfo);
    //}

    // Initialize raycaster and mouse vector if needed
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    console.log("CombatHUD initialized successfully");
  }

  /**
   * Create or reference the enemy target UI elements.
   * In combat mode the enemy target is shown in red.
   */
  function createEnemyTargetElements() {
    enemyTarget = document.getElementById("enemy-target");
    if (!enemyTarget) {
      console.log("Creating enemy target elements");
      enemyTarget = document.createElement("div");
      enemyTarget.id = "enemy-target";
      enemyTarget.style.position = "absolute";
      enemyTarget.style.zIndex = "1002";
      enemyTarget.style.pointerEvents = "none";
      // Remove flex layout and transform so the container's dimensions don't shift with content
      enemyTarget.style.display = "none";
      hudContainer.appendChild(enemyTarget);
  
      // Create the red target circle
      enemyTargetCircle = document.createElement("div");
      enemyTargetCircle.id = "enemy-target-circle";
      enemyTargetCircle.style.width = "60px";
      enemyTargetCircle.style.height = "60px";
      enemyTargetCircle.style.border = "2px solid red"; // red border
      enemyTargetCircle.style.borderRadius = "50%";
      // Position the circle absolutely so its center stays fixed
      enemyTargetCircle.style.position = "absolute";
      enemyTargetCircle.style.left = "50%";
      enemyTargetCircle.style.top = "50%";
      enemyTargetCircle.style.transform = "translate(-50%, -50%)";
      enemyTarget.appendChild(enemyTargetCircle);
  
      // Create the enemy target label (red text)
      enemyTargetLabel = document.createElement("div");
      enemyTargetLabel.id = "enemy-target-label";
      enemyTargetLabel.style.fontFamily = "Orbitron, sans-serif";
      enemyTargetLabel.style.textAlign = "center";
      enemyTargetLabel.style.pointerEvents = "none";
      enemyTargetLabel.style.color = "red";
      enemyTargetLabel.style.textShadow = "1px 1px 2px black";
      enemyTargetLabel.style.fontSize = "14px";
      enemyTargetLabel.style.whiteSpace = "nowrap";
      // Position the label absolutely below the circle
      enemyTargetLabel.style.position = "absolute";
      enemyTargetLabel.style.left = "50%";
      enemyTargetLabel.style.top = "calc(50% + 35px)"; // Adjust as needed (half the circle's height + margin)
      enemyTargetLabel.style.transform = "translateX(-50%)";
      enemyTarget.appendChild(enemyTargetLabel);
    }
  }
  
  
  function createCoordinateElements() {
    // If your HTML already has an element with these IDs, just reference them:
    coordX       = document.getElementById('coord-x');
    coordY       = document.getElementById('coord-y');
    coordZ       = document.getElementById('coord-z');
    distanceSun  = document.getElementById('coord-distance');
    velocityValue= document.getElementById('velocity-display');

  }
  function updateCoordinatesAndVelocity() {
    if (!camera || !coordX || !coordY || !coordZ || !distanceSun || !velocityValue) return;

    // 1) get camera position
    const worldPos = new THREE.Vector3();
    camera.getWorldPosition(worldPos);

    coordX.textContent = worldPos.x.toFixed(2);
    coordY.textContent = worldPos.y.toFixed(2);
    coordZ.textContent = worldPos.z.toFixed(2);

    // 2) distance from sun (0,0,0) / scale
    const distanceToSun = worldPos.length(); // distance from (0,0,0)
    const distanceAU = (distanceToSun / 100).toFixed(3); // if 100 units = 1 AU
    distanceSun.textContent = distanceAU;

    // 3) velocity from ShipController if available
    let velocityKmS = 0;
    if (typeof ShipController !== 'undefined' && ShipController.getVelocity) {
      const vel = ShipController.getVelocity();
      if (typeof vel === 'number') {
        velocityKmS = vel;
      } else if (vel && vel.length) {
        // If it's a vector
        velocityKmS = vel.length();
      }
    }
    velocityValue.textContent = formatVelocityValue(velocityKmS);
  }
  function formatVelocityValue(v) {
    if (!v) return "0.00 km/s";
    if (v >= 1000) return (v / 1000).toFixed(2) + " Mm/s";
    return v.toFixed(2) + " km/s";
  }

  /**
   * Update the enemy target information (position, size, etc).
   */
  function updateEnemyTargetInfo() {
    if (!targetedEnemy || !enemyTarget || !enemyTargetCircle || !enemyTargetLabel) {
      return;
    }
  
    try {
      // Get position of enemy
      let enemyPos = new THREE.Vector3();
      if (targetedEnemy.position) {
        enemyPos.set(
          targetedEnemy.position.x,
          targetedEnemy.position.y,
          targetedEnemy.position.z
        );
      } else if (typeof targetedEnemy.getWorldPosition === 'function') {
        targetedEnemy.getWorldPosition(enemyPos);
      } else {
        console.warn("Enemy has no position information");
        return;
      }
  
      // Convert 3D position to screen coordinates
      const screenPos = worldToScreen(enemyPos);
  
      // If not on screen, hide the target and return
      if (!screenPos) {
        enemyTarget.style.display = "none";
        return;
      }
  
      // Position the target element at the screen position
      enemyTarget.style.display = "block";
      enemyTarget.style.left = `${screenPos.x}px`;
      enemyTarget.style.top = `${screenPos.y}px`;
  
      // Calculate the screen size of the enemy
      const screenSize = getObjectScreenSize(targetedEnemy);
      const targetSize = Math.min(MAX_TARGET_DIAMETER, Math.max(MIN_TARGET_DIAMETER, screenSize));
  
      // Update target circle size
      enemyTargetCircle.style.width = `${targetSize}px`;
      enemyTargetCircle.style.height = `${targetSize}px`;
  
    } catch (error) {
      console.error("Error updating enemy target info:", error);
    }
  }
  
  /**
   * Convert a world position to screen coordinates.
   */
  function worldToScreen(worldPos) {
    if (!camera || !renderer) return null;
    
    // Make sure worldPos is a valid Vector3 object
    if (!worldPos || typeof worldPos !== 'object') return null;
    
    // Safely create a Vector3 from the position
    let pos;
    if (worldPos.clone && typeof worldPos.clone === 'function') {
      // Position is already a Vector3, clone it
      pos = worldPos.clone();
    } else if (worldPos.x !== undefined && worldPos.y !== undefined && worldPos.z !== undefined) {
      // Position is an object with x, y, z properties
      pos = new THREE.Vector3(worldPos.x, worldPos.y, worldPos.z);
    } else {
      // Invalid position format
      console.warn("Invalid position format in worldToScreen:", worldPos);
      return null;
    }

    pos.project(camera);

    // Check if the object is actually in front of the camera.
    // In NDC, points in the visible frustum should have z between -1 and 1.
    if (pos.z < -1 || pos.z > 1) {
      return null;
    }
      
    const rect = renderer.domElement.getBoundingClientRect();
    const x = (pos.x * 0.5 + 0.5) * rect.width + rect.left;
    const y = (-pos.y * 0.5 + 0.5) * rect.height + rect.top;
    return { x, y };
  }

  /**
   * Compute an object's approximate on-screen size in pixels.
   * This version handles both mesh objects and simple objects with position.
   */
  function getObjectScreenSize(object) {
    if (!object || !camera || !renderer) return 60;

    // If the object has a mesh property (like our EnemyShip objects)
    if (object.mesh) {
      // Use the mesh for bounding sphere calculation
      return getObjectScreenSizeFromMesh(object.mesh);
    } 
    
    // If it's just a position object without mesh
    if (object.position) {
      // Use a default radius for objects that only have position
      const defaultRadius = 2; // A reasonable default size
      
      // Create a Vector3 from the position
      const center = new THREE.Vector3(
        object.position.x, 
        object.position.y, 
        object.position.z
      );
      
      return getScreenSizeFromSphere(center, defaultRadius);
    }

    // Fallback to default size
    return 60;
  }

  /**
   * Calculate screen size from a mesh object by getting its bounding sphere
   */
  function getObjectScreenSizeFromMesh(meshObject) {
    try {
      // Compute bounding sphere that covers the entire object (and all children)
      const { center, radius } = computeBoundingSphereForObject(meshObject);
      return getScreenSizeFromSphere(center, radius);
    } catch (error) {
      console.warn("Error calculating object screen size:", error);
      return 60; // Default fallback size
    }
  }

  /**
   * Calculate screen size given a center point and radius
   */
  function getScreenSizeFromSphere(center, radius) {
    // Project center + boundary to NDC and measure screen distance
    const centerNDC = center.clone().project(camera);

    // Create a boundary point on +X direction from center
    // (any direction is okay, we just need to measure in screen space)
    const boundaryWorld = center.clone().add(new THREE.Vector3(radius, 0, 0));
    const boundaryNDC = boundaryWorld.clone().project(camera);

    // Convert to screen coordinates
    const rect = renderer.domElement.getBoundingClientRect();
    const halfW = rect.width / 2;
    const halfH = rect.height / 2;

    const centerScreen = new THREE.Vector2(
      centerNDC.x * halfW + halfW,
      -centerNDC.y * halfH + halfH
    );
    const boundaryScreen = new THREE.Vector2(
      boundaryNDC.x * halfW + halfW,
      -boundaryNDC.y * halfH + halfH
    );

    // The distance between those two points is the object's diameter in px
    const pxRadius = centerScreen.distanceTo(boundaryScreen);
    return pxRadius * 2;
  }

  /**
   * Helper: Traverse the object and compute a bounding box that encloses all sub-meshes,
   * then convert that box to a sphere with { center, radius }.
   */
  function computeBoundingSphereForObject(object) {
    // Make sure transforms are up to date
    object.updateMatrixWorld(true);

    // Start with an empty box
    const box = new THREE.Box3();
    box.makeEmpty();

    // Traverse all children that are Mesh
    object.traverse((child) => {
      if (child.isMesh && child.geometry) {
        // Ensure boundingBox is computed
        if (!child.geometry.boundingBox) {
          child.geometry.computeBoundingBox();
        }
        // Clone local boundingBox and apply child's world transform
        const childBox = child.geometry.boundingBox.clone();
        childBox.applyMatrix4(child.matrixWorld);
        // Expand the global box
        box.union(childBox);
      }
    });

    // Derive sphere
    const center = new THREE.Vector3();
    box.getCenter(center);
    const size = new THREE.Vector3();
    box.getSize(size);
    // Sphere radius is half of the max dimension
    const radius = 0.5 * Math.max(size.x, size.y, size.z);
    return { center, radius };
  }

  /**
   * Clear the enemy target display.
   */
  function clearEnemyTarget() {
    targetedEnemy = null;
    if (enemyTarget) {
      enemyTarget.style.display = "none";
    }
    if (enemyInfo) {
      enemyInfo.innerHTML = "";
      enemyInfo.style.display = "none";
    }
  }

  /**
   * In combat mode we check for enemy ships from NetworkController.
   * We find the enemy ship that's most in view and target it.
   */
  function checkEnemyTargeting() {
    // First, try to get enemy ships from NetworkController if available
    if (typeof NetworkController !== 'undefined' && NetworkController.getEnemyShips) {
      const enemyShips = NetworkController.getEnemyShips();
      
      if (enemyShips && Object.keys(enemyShips).length > 0) {
        let bestTarget = null;
        let bestScore = Infinity;
        
        for (const id in enemyShips) {
          const ship = enemyShips[id];
          // Skip if ship is dead
          if (ship.isDead) continue;
          // Skip ships that don't have a mesh or position
          if (!ship || !ship.position) continue;
          if (ship.position.x === undefined || ship.position.y === undefined || ship.position.z === undefined) {
            console.warn("Ship has invalid position format:", ship.position);
            continue;
          }
          const screenPos = worldToScreen(ship.position);
          if (!screenPos) continue;
          
          const rect = renderer.domElement.getBoundingClientRect();
          const centerX = rect.width / 2;
          const centerY = rect.height / 2;
          const distFromCenter = Math.sqrt(
            Math.pow(screenPos.x - centerX, 2) + Math.pow(screenPos.y - centerY, 2)
          );
          if (distFromCenter < bestScore) {
            bestScore = distFromCenter;
            bestTarget = ship;
          }
        }
        
        if (bestTarget) {
          targetedEnemy = bestTarget;
          lastTargetTime = performance.now();
          if (enemyTargetLabel) {
            const nickname = bestTarget.nickname;
            const cameraPos = new THREE.Vector3();
            camera.getWorldPosition(cameraPos);
            const enemyPos = new THREE.Vector3(bestTarget.position.x, bestTarget.position.y, bestTarget.position.z);
            const dist = enemyPos.distanceTo(cameraPos);
            const distAU = dist / 100;
            enemyTargetLabel.textContent = nickname ? `${nickname} - ${distAU.toFixed(2)} AU` : 'Unknown Player';
          }
          return;
        }
      }
    }
    // Fallback or clear target
    clearEnemyTarget();
  }
  
  

  /**
   * Main update function called each frame.
   */
  function update(deltaTime) {
    if (!hudContainer) {
      console.warn("CombatHUD update called but hudContainer is null");
      return;
    }
    
    // Check if HUD is visible - skip updates if not visible
    if (hudContainer.style.display === 'none' || hudContainer.style.visibility === 'hidden') {
      return;
    }

    updateCoordinatesAndVelocity();

    updateEnemyTargetInfo();

    const now = performance.now();
    if (now - lastTargetCheckTime > TARGET_CHECK_INTERVAL) {
      lastTargetCheckTime = now;
      checkEnemyTargeting();
    }

    if (targetedEnemy && (now - lastTargetTime) > TARGET_TIMEOUT) {
      clearEnemyTarget();
    }

    // Throttled debug logging
    //if (now - lastDebugTime > 3000) {
    //  console.log(
    //    "CombatHUD container display:",
    //    hudContainer.style.display,
    //    hudContainer.style.visibility,
    //    window.getComputedStyle(hudContainer).display
    //  );
    //  lastDebugTime = now;
    //}
  }

  /**
   * Creates the health indicator elements.
   */
  function createHealthIndicatorElements() {
    healthIndicatorContainer = document.getElementById("health-indicator-container");
    if (!healthIndicatorContainer) {
      console.log("Creating health indicator elements");
      healthIndicatorContainer = document.createElement("div");
      healthIndicatorContainer.id = "health-indicator-container";
      healthIndicatorContainer.style.position = "absolute";
      healthIndicatorContainer.style.bottom = "30px";
      healthIndicatorContainer.style.left = "50%";
      healthIndicatorContainer.style.transform = "translateX(-50%)";
      healthIndicatorContainer.style.display = "flex"; // Use flexbox for segments
      healthIndicatorContainer.style.gap = "3px"; // Space between segments
      healthIndicatorContainer.style.padding = "4px";
      healthIndicatorContainer.style.background = "rgba(0, 50, 100, 0.5)"; // Semi-transparent blue background
      healthIndicatorContainer.style.border = "1px solid #0ff"; // Cyan border
      healthIndicatorContainer.style.borderRadius = "5px";
      healthIndicatorContainer.style.zIndex = "1001";
      hudContainer.appendChild(healthIndicatorContainer);

      healthSegments = []; // Clear any previous segments if re-initializing
      for (let i = 0; i < MAX_HEALTH_SEGMENTS; i++) {
        const segment = document.createElement("div");
        segment.classList.add("health-segment"); // Add class for potential external styling
        segment.style.width = "20px"; // Width of each segment
        segment.style.height = "15px"; // Height of each segment
        segment.style.backgroundColor = "#0f0"; // Default to green (full health)
        segment.style.border = "1px solid #333"; // Dark border for definition
        segment.style.transition = "background-color 0.3s ease"; // Smooth color transition
        healthIndicatorContainer.appendChild(segment);
        healthSegments.push(segment);
      }
    } else {
      // If container exists, ensure segment references are correct
      healthSegments = Array.from(healthIndicatorContainer.querySelectorAll(".health-segment"));
      console.log("Using existing health indicator elements");
    }
  }

  /**
   * Updates the visual representation of the health bar.
   * @param {number} healthPercentage - The player's health percentage (0-100).
   */
  function updateHealth(healthPercentage) {
    if (!healthIndicatorContainer || healthSegments.length === 0) {
      // console.warn("Health indicator elements not ready.");
      return; // Not initialized yet
    }

    const normalizedHealth = Math.max(0, Math.min(100, healthPercentage)); // Clamp between 0 and 100
    const activeSegments = Math.ceil((normalizedHealth / 100) * MAX_HEALTH_SEGMENTS);

    // console.log(`Updating health: ${normalizedHealth}%, Active Segments: ${activeSegments}`);

    healthSegments.forEach((segment, index) => {
      if (index < activeSegments) {
        // Determine color based on health level
        if (normalizedHealth > 66) {
          segment.style.backgroundColor = "#0f0"; // Green
        } else if (normalizedHealth > 33) {
          segment.style.backgroundColor = "#ff0"; // Yellow
        } else {
          segment.style.backgroundColor = "#f00"; // Red
        }
        segment.style.opacity = "1";
      } else {
        segment.style.backgroundColor = "#555"; // Dim color for inactive segments
        segment.style.opacity = "0.5";
      }
    });
  }

  // Public API
  return {
    init,
    update,
    show() {
      if (hudContainer) {
        hudContainer.style.display = "block";
        hudContainer.style.visibility = "visible";
        console.log("CombatHUD show() called - HUD container:", hudContainer);
      } else {
        console.warn("Attempted to show CombatHUD but hudContainer is null");
      }
    },
    hide() {
      if (hudContainer) {
        hudContainer.style.display = "none";
        console.log("CombatHUD hide() called");
      }
    },
    updateEnemyTargetInfo: updateEnemyTargetInfo,
    clearEnemyTarget: clearEnemyTarget,
    updateHealth: updateHealth
  };
})();
