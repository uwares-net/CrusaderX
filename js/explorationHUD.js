// explorationHUD.js
"use strict";

const ExplorationHUD = (function () {

  // Private references to camera, renderer, scene
  let camera = null;
  let renderer = null;
  let scene = null;

  // DOM elements
  let hudContainer = null;
  let coordX, coordY, coordZ, distanceSun, velocityValue;  // for coordinate/velocity display
  let planetTarget, planetTargetCircle, planetTargetLabel, objectInfo;

  // Raycasting
  let raycaster, mouse;

  // Planet targeting state
  let targetedPlanet = null;
  let lastTargetCheckTime = 0;
  const TARGET_CHECK_INTERVAL = 1000; // ms
  const MAX_TARGET_DIAMETER = 50;
  const MIN_TARGET_DIAMETER = 25;     // px
  let lastTargetTime = 0;
  const TARGET_TIMEOUT = 2000;        // ms
  const TARGETING_RECALCULATION_THRESHOLD = 2.0; // not used in this example, but included if you want

  // For debugging logs (throttling)
  let lastDebugTime = 0;

  // Initialization
  function init(params) {
    // Expect params = { camera, renderer, scene } from app.js
    camera = params.camera;
    renderer = params.renderer;
    scene = params.scene;

    //console.log("ExplorationHUD init() called with:", params);

    // Build or reference the main HUD container
    // Build or reference the main HUD container for exploration mode
    hudContainer = document.getElementById("exploration-hud");
    if (!hudContainer) {
      // If no <div id="exploration-hud"> exists in your HTML, create one
      hudContainer = document.createElement("div");
      hudContainer.id = "exploration-hud";
      hudContainer.style.position = "absolute";
      hudContainer.style.top = "0";
      hudContainer.style.left = "0";
      hudContainer.style.width = "100%";
      hudContainer.style.height = "100%";
      hudContainer.style.pointerEvents = "none";
      hudContainer.style.zIndex = "10001";
      // Ensure visibility
      hudContainer.style.display = "block";
      hudContainer.style.visibility = "visible";
      document.body.appendChild(hudContainer);
      //console.log("Created new exploration-hud container element");
    } else {
      // Make sure the existing container is visible
      hudContainer.style.display = "block";
      hudContainer.style.visibility = "visible";
      //console.log("Using existing exploration-hud container element");
    }

    // We can create or reference the coordinate display
    createCoordinateElements();

    // Create or reference the planet targeting elements
    createPlanetTargetElements();

    // Create the object info panel if needed
    objectInfo = document.getElementById('object-info');
    if (!objectInfo) {
      // If you want an <div id="object-info"> in the HUD
      objectInfo = document.createElement('div');
      objectInfo.id = 'object-info';
      objectInfo.style.position = 'absolute';
      objectInfo.style.top = '200px';
      objectInfo.style.left = '20px';
      objectInfo.style.width = '300px';
      objectInfo.style.color = '#fff';
      objectInfo.style.background = 'rgba(0,0,0,0.5)';
      objectInfo.style.padding = '10px';
      objectInfo.style.borderRadius = '5px';
      objectInfo.style.display = 'block';
      hudContainer.appendChild(objectInfo);
    }

    // Initialize raycaster for planet targeting
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    console.log("ExplorationHUD initialized successfully");

    // Do NOT call show() here - it's defined later in the public API
    // We'll show the HUD from outside instead
  }

  // Called every frame
  function update(deltaTime) {
    if (!hudContainer) {
      console.warn("ExplorationHUD update called but hudContainer is null");
      return;
    }

    // Check if HUD is visible
    if (hudContainer.style.display === 'none' || hudContainer.style.visibility === 'hidden') {
      // Skip updates if HUD is not visible
      return;
    }

    // Example: update camera coordinates & velocity
    updateCoordinatesAndVelocity();

    // Throttle planet targeting checks
    const now = performance.now();
    if (now - lastTargetCheckTime > TARGET_CHECK_INTERVAL) {
      lastTargetCheckTime = now;
      checkPlanetTargeting();
    }

    // Clear the target if we haven't "seen" a planet for a while
    if (targetedPlanet && (now - lastTargetTime) > TARGET_TIMEOUT) {
      clearPlanetTarget();
    }

    // Optionally log HUD status every 3 seconds (from the old code)
    //if (now - lastDebugTime > 3000) {
    //  console.log("ExplorationHUD container display:", hudContainer.style.display,
    //    hudContainer.style.visibility,
    //    window.getComputedStyle(hudContainer).display);
    //  lastDebugTime = now;
    //}
  }

  /**
   * Build or reference coordinate/velocity DOM elements
   */
  function createCoordinateElements() {
    // If your HTML already has an element with these IDs, just reference them:
    coordX = document.getElementById('coord-x');
    coordY = document.getElementById('coord-y');
    coordZ = document.getElementById('coord-z');
    distanceSun = document.getElementById('coord-distance');
    velocityValue = document.getElementById('velocity-display');
  }

  /**
   * Build or reference planet target UI elements
   */
  function createPlanetTargetElements() {
    //console.log("Creating planet target elements");
    // Create the main container
    planetTarget = document.createElement('div');
    planetTarget.id = 'planet-target';
    planetTarget.style.position = 'absolute';
    planetTarget.style.pointerEvents = 'none';
    planetTarget.style.zIndex = '10002';
    // Initially hidden until a planet is targeted
    planetTarget.style.display = 'none';

    hudContainer.appendChild(planetTarget);

    // Circle element (its size can be modified dynamically)
    planetTargetCircle = document.createElement('div');
    planetTargetCircle.id = 'planet-target-circle';
    planetTargetCircle.style.width = '60px';  // example size, could change dynamically
    planetTargetCircle.style.height = '60px';
    planetTargetCircle.style.border = '2px solid #0ff';
    planetTargetCircle.style.borderRadius = '50%';
    // Position the circle absolutely so its center stays fixed
    planetTargetCircle.style.position = 'absolute';
    planetTargetCircle.style.left = '50%';
    planetTargetCircle.style.top = '50%';
    planetTargetCircle.style.transform = 'translate(-50%, -50%)';
    planetTarget.appendChild(planetTargetCircle);

    // Label element placed directly below the circle
    planetTargetLabel = document.createElement('div');
    planetTargetLabel.id = 'planet-target-label';
    planetTargetLabel.style.fontFamily = 'Orbitron, sans-serif';
    planetTargetLabel.style.textAlign = 'center';
    planetTargetLabel.style.pointerEvents = 'none';
    planetTargetLabel.style.color = '#0ff';
    planetTargetLabel.style.textShadow = '1px 1px 2px black';
    planetTargetLabel.style.fontSize = '14px';
    planetTargetLabel.style.whiteSpace = 'nowrap';
    // Position the label absolutely below the circle
    planetTargetLabel.style.position = 'absolute';
    planetTargetLabel.style.left = '50%';
    planetTargetLabel.style.top = 'calc(50% + 35px)'; // Adjust the offset as needed (circle half-height + margin)
    planetTargetLabel.style.transform = 'translateX(-50%)';
    planetTarget.appendChild(planetTargetLabel);
  }


  /**
   * Update coordinates and velocity information in the HUD
   */
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

  /**
   * Format velocity for display
   */
  function formatVelocityValue(v) {
    if (!v) return "0.00 km/s";
    if (v >= 1000) return (v / 1000).toFixed(2) + " Mm/s";
    return v.toFixed(2) + " km/s";
  }


  /**
   * Check for planet targeting
   */
  function checkPlanetTargeting() {
    if (!scene || !camera || !renderer) return;

    // 1) find or get all "planets"
    let planets = [];
    if (typeof SolarSystem !== 'undefined' && typeof SolarSystem.getPlanets === 'function') {
      planets = SolarSystem.getPlanets() || [];
    }

    // If not found, you could fallback to a scene traverse
    if (!planets || planets.length === 0) {
      //console.warn("No planets available for targeting?");
      return;
    }

    // 2) find the closest planet to the screen center
    const rect = renderer.domElement.getBoundingClientRect();
    const screenCenter = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };

    let closestPlanet = null;
    let minDist = Infinity;

    planets.forEach(planet => {
      const planetWorldPos = new THREE.Vector3();
      planet.getWorldPosition(planetWorldPos);
      const screenPos = worldToScreen(planetWorldPos);
      if (screenPos) {
        const dx = screenPos.x - screenCenter.x;
        const dy = screenPos.y - screenCenter.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist) {
          minDist = dist;
          closestPlanet = planet;
        }
      }
    });

    if (closestPlanet) {
      targetPlanet(closestPlanet);
      lastTargetTime = performance.now();
    } else {
      clearPlanetTarget();
    }
  }

  /**
   * Convert a world position to screen coords
   */
  function worldToScreen(worldPos) {
    if (!camera || !renderer) return null;

    const pos = worldPos.clone();
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
   * Compute an object's approximate on-screen size in pixels
   */
  function getObjectScreenSize(object) {
    if (!object || !camera || !renderer) return 60;

    // Find a mesh with geometry within the object or its children
    let mesh = object;
    if (!mesh.geometry && mesh.children && mesh.children.length > 0) {
      for (let i = 0; i < mesh.children.length; i++) {
        if (mesh.children[i].geometry) {
          mesh = mesh.children[i];
          break;
        }
      }
    }

    // If no geometry found, return default size
    if (!mesh.geometry) return 60;

    // Compute bounding sphere if not already computed
    if (!mesh.geometry.boundingSphere) {
      mesh.geometry.computeBoundingSphere();
    }

    const radius = mesh.geometry.boundingSphere.radius;
    const center = new THREE.Vector3();
    mesh.getWorldPosition(center);

    // Create a boundary point on +X direction from center
    const boundaryLocal = new THREE.Vector3(radius, 0, 0);
    const boundaryWorld = boundaryLocal.clone().applyMatrix4(mesh.matrixWorld);

    // Project to screen space
    const centerNDC = center.clone().project(camera);
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

    // The distance between those two points is the object's radius in pixels
    const pxRadius = centerScreen.distanceTo(boundaryScreen);
    return pxRadius * 2; // Return diameter
  }

  /**
   * Target a planet
   * @param {THREE.Object3D} planet - The planet to target
   */
  function targetPlanet(planet) {
    if (!planet || !planetTarget || !planetTargetCircle || !planetTargetLabel) return;

    // Ensure the planet is passed properly
    if (!planet.userData || !planet.userData.name) {
      console.warn("Planet object does not have proper userData");
      return;
    }

    targetedPlanet = planet;

    // Get the planet's screen position
    const worldPos = new THREE.Vector3();
    planet.getWorldPosition(worldPos);
    const screenPos = worldToScreen(worldPos);
    const cameraPos = new THREE.Vector3();
    camera.getWorldPosition(cameraPos);
    const dist = worldPos.distanceTo(cameraPos);
    const distAU = dist / 100;

    if (!screenPos) {
      // The planet is not visible on screen
      if (planetTarget.style.display !== 'none') {
        planetTarget.style.display = 'none';
      }
      return;
    }

    // Update planet target position
    planetTarget.style.display = 'block';
    planetTarget.style.left = `${screenPos.x}px`;
    planetTarget.style.top = `${screenPos.y}px`;

    // Get the planet's screen size and adjust target indicator size
    const screenSize = getObjectScreenSize(planet);
    const targetSize = Math.min(MAX_TARGET_DIAMETER, Math.max(MIN_TARGET_DIAMETER, screenSize));
    planetTargetCircle.style.width = `${targetSize}px`;
    planetTargetCircle.style.height = `${targetSize}px`;

    // Update the target label
    planetTargetLabel.textContent = `${planet.userData.name} - ${distAU.toFixed(2)} AU`;

    // Update the object info panel
    if (!/Mobi|Android/i.test(navigator.userAgent)) {
      if (objectInfo) {
        let info = `<h3>${planet.userData.name}</h3>`;

        // Add detailed planet information
        if (planet.userData.diameter) {
          info += `Diameter: ${planet.userData.diameter.toLocaleString()} km<br>`;
        }

        if (planet.userData.mass) {
          info += `Mass: ${planet.userData.mass.toLocaleString()} kg<br>`;
        }

        if (planet.userData.orbitalPeriod) {
          info += `Orbital Period: ${planet.userData.orbitalPeriod.toLocaleString()} days<br>`;
        }

        if (planet.userData.description) {
          info += `<p>${planet.userData.description}</p>`;
        }

        objectInfo.innerHTML = info;
        objectInfo.style.display = 'block';
      }
    }
  }

  /**
   * Clear the current planet target
   */
  function clearPlanetTarget() {
    targetedPlanet = null;

    // Clear planet info if the element exists
    if (objectInfo) {
      objectInfo.innerHTML = '';
      objectInfo.style.display = 'none';
    }

    // Hide target indicator if it exists
    if (planetTarget) {
      planetTarget.style.display = 'none';
    }
  }

  // Public API
  return {
    init,
    update,
    show() {
      if (hudContainer) {
        hudContainer.style.display = "block";
        hudContainer.style.visibility = "visible";
        //console.log("ExplorationHUD show() called - HUD container:", hudContainer);
      } else {
        console.warn("Attempted to show ExplorationHUD but hudContainer is null");
      }
    },
    hide() {
      if (hudContainer) {
        hudContainer.style.display = "none";
        //console.log("ExplorationHUD hide() called");
      }
    }
  };
})();
