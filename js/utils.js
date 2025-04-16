/**
 * utils.js - Utility functions for the SOL Arena application
 * Contains general-purpose functions and specialized utilities
 */

const Utils = (function() {
  // Last camera position for starfield updates

  /**
   * Get a clickable parent with celestial data
   * @param {THREE.Object3D} object - The object to check
   * @returns {THREE.Object3D|null} - The parent object with celestial data or null
   */
  function getClickableParent(object) {
    let current = object;
    while (current) {
      if (current.userData && current.userData.celestialData) {
        return current;
      }
      current = current.parent;
    }
    return null;
  }
  
  /**
   * Focus the camera on an object
   * @param {THREE.Object3D} object - The object to focus on
   * @param {THREE.Camera} camera - The camera
   * @param {THREE.OrbitControls} orbitControls - The orbit controls
   */
  function focusOnObject(object, camera, orbitControls) {
    const worldPosition = new THREE.Vector3();
    object.getWorldPosition(worldPosition);
    
    // In guided mode, update OrbitControls target
    if (orbitControls) {
      orbitControls.target.copy(worldPosition);
    }
    
    if (object.userData && object.userData.celestialData) {
      const data = object.userData.celestialData;
      let distanceFactor = 3;
      if (data.parentObject) {
        distanceFactor = 1.5;
      } else if (data.name === "Sun") {
        distanceFactor = 4;
      } else if (data.name.includes("Space Station")) {
        distanceFactor = 0.5;
      }
      
      const objectRadius = (data.scaled_diameter || data.diameter * SCALE.SIZE) / 2;
      const offset = new THREE.Vector3(
        objectRadius * distanceFactor * 0.8,
        objectRadius * distanceFactor * 0.6,
        objectRadius * distanceFactor
      );
      
      const from = {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z
      };
      
      const to = {
        x: worldPosition.x + offset.x,
        y: worldPosition.y + offset.y,
        z: worldPosition.z + offset.z
      };
      
      new TWEEN.Tween(from)
        .to(to, 1000)
        .easing(TWEEN.Easing.Quadratic.InOut)
        .onUpdate(() => {
          camera.position.set(from.x, from.y, from.z);
        })
        .start();
    }
    
    if (orbitControls) {
      orbitControls.update();
    }
  }
  
  /**
   * Validate and fix position attributes in a BufferGeometry to prevent NaN values
   * @param {THREE.BufferGeometry} geometry - The geometry to validate
   * @returns {THREE.BufferGeometry} The fixed geometry
   */
  function validateGeometryPositions(geometry) {
    if (!geometry) return null;
    
    try {
      const positionAttribute = geometry.getAttribute('position');
      if (!positionAttribute) return geometry;
      
      const positions = positionAttribute.array;
      let fixed = false;
      
      // Check for NaN values and replace them
      for (let i = 0; i < positions.length; i++) {
        if (isNaN(positions[i])) {
          positions[i] = 0;
          fixed = true;
        }
      }
      
      if (fixed) {
        console.warn('Fixed NaN values in geometry positions');
        positionAttribute.needsUpdate = true;
        geometry.computeBoundingSphere();
      }
      
      return geometry;
    } catch (error) {
      console.error('Error validating geometry positions:', error);
      return geometry;
    }
  }
  
  // Public API
  return {
    getClickableParent,
    focusOnObject,
    validateGeometryPositions,
    // Add more utility functions as needed
  };
})(); 