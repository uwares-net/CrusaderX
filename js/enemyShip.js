class EnemyShip {
  constructor(id, scene, initialPosition = { x: 0, y: 0, z: 0 }, initialRotation = { x: 0, y: 0, z: 0 }, playerData = {}) {
    this.id = id;
    this.scene = scene;
    this.mesh = null;
    this.position = initialPosition;
    this.rotation = initialRotation;
    this.loaded = false;
    this.debug = false; // Enable debug logging
    this.modelPath = 'models/spaceShip1.glb';
    this.scale = 0.009; 

    // Store player data
    this.nickname = playerData.nickname || id.substr(0, 6);
    this.colorIndex = playerData.colorIndex ?? Math.floor(Math.random() * 6);
    this.health = typeof playerData.health === 'number' ? playerData.health : 100; // Initialize health
    this.lastHealth = this.health; // Keep track of previous health
    
    // Define color palette - must match the IntroScreen.COLORS array
    this.shipColors = [
      0xFF0000, // Red
      0x00FF00, // Green
      0x0000FF, // Blue
      0xFF69B4, // Pink
      0xFFFF00, // Yellow
      0x800080  // Purple
    ];
    
    // Get ship color from colorIndex or fallback to random if index is invalid
    this.shipColor = this.colorIndex >= 0 && this.colorIndex < this.shipColors.length 
      ? this.shipColors[this.colorIndex] 
      : this.shipColors[0]; // Default to red

    // Flag to ensure we only update color once
    this.colorUpdated = false;
    
    this.log(`Created with position:`, initialPosition);
    this.log(`Assigned color: ${this.shipColor}`, this.shipColor);
    this.log(`Player nickname: ${this.nickname}`);
    
    this.isDead = false; // Add isDead flag
  }
  
  /**
   * Log debug messages
   * @param {string} message - Message to log
   * @param {Object} data - Optional data to log
   */
  log(message, data) {
    if (!this.debug) return;
    
    if (data) {
      console.log(`[EnemyShip ${this.id}] ${message}`, data);
    } else {
      console.log(`[EnemyShip ${this.id}] ${message}`);
    }
  }

  /**
   * Creates the ship mesh and adds it to the scene
   */
  createShipMesh() {
    try {
      this.log('Loading ship model from:', this.modelPath);
      let modelLoaded = false;
      const fallbackTimer = setTimeout(() => {
        if (!modelLoaded && !this.loaded) {
          this.log('Model loading timed out, creating fallback shape');
          this.createFallbackMesh();
        }
      }, 5000); // 5 second timeout
  
      if (typeof THREE.GLTFLoader === 'function') {
        const loader = new THREE.GLTFLoader();
  
        loader.load(
          this.modelPath,
          (gltf) => {
            clearTimeout(fallbackTimer);
            if (this.loaded) {
              this.log('Ignoring late-loaded model since fallback was already created');
              return;
            }
            if (!gltf || !gltf.scene) {
              this.log('No valid scene in loaded glTF, creating fallback mesh');
              this.createFallbackMesh();
              return;
            }
            modelLoaded = true;
            this.mesh = gltf.scene;
            this.mesh.scale.set(this.scale, this.scale, this.scale);
  
            // Traverse the loaded scene and assign the initial material with the ship color
            if (this.mesh) {
              this.mesh.traverse((child) => {
                if (child.isMesh) {
                  const material = new THREE.MeshStandardMaterial({
                    color: this.shipColor,
                    metalness: 0.8,
                    roughness: 0.2,
                    emissive: this.shipColor, // CHANGE: Use the ship's own color for emission
                    emissiveIntensity: 0.3 // CHANGE: Lower intensity might be needed here (adjust 0.1 to 0.5)
                  });
                  child.material = material;
                }
              });       
            } else {
              this.log('Loaded glTF scene is null, using fallback');
              this.createFallbackMesh();
              return;
            }
  
            this.updatePosition(this.position);
            this.updateRotation(this.rotation);
            this.scene.add(this.mesh);
            this.loaded = true;
            this.log('Model loaded and added to scene');
            this.updateNameLabelPosition();
          },
          // Progress callback
          (xhr) => {
            const percentComplete = (xhr.loaded / xhr.total) * 100;
            this.log(`Loading progress: ${Math.round(percentComplete)}%`);
          },
          // Error callback
          (error) => {
            this.log('Error loading model:', error);
            clearTimeout(fallbackTimer);
            this.createFallbackMesh();
          }
        );
      } else {
        this.log('THREE.GLTFLoader not available, using fallback shape');
        clearTimeout(fallbackTimer);
        this.createFallbackMesh();
      }
    } catch (error) {
      this.log('Error creating ship mesh:', error);
      this.createFallbackMesh();
    }
  }
  
  /**
   * Update the nickname; this function does not repaint the ship.
   */
  updateNickname(newNickname) {
    if (newNickname && newNickname !== this.nickname) {
      this.nickname = newNickname;
    }
  }

  /**
   * Update the color index and repaint the ship only once.
   * Repaints by traversing the mesh and replacing materials.
   */
  updateColorIndex(newColorIndex) {
    this.log(`Attempting to update color index to: ${newColorIndex}`);
    
    // Case 1: If the mesh is not yet created, update the color properties and create the mesh.
    if (!this.loaded || !this.mesh) {
      // Update the color index (if provided) regardless of current value.
      if (newColorIndex !== undefined) {
        this.colorIndex = newColorIndex;
      }
      this.shipColor = this.shipColors[this.colorIndex] || this.shipColors[0];
      this.log(`No mesh present. Setting color index to: ${this.colorIndex}, shipColor: ${this.shipColor}`);
      // Create the ship mesh so that the new color is applied.
      this.createShipMesh();
      this.colorUpdated = true;
      return;
    }
    
    // Case 2: The mesh already exists. If the new color index differs from current, update the material.
    if (newColorIndex !== undefined && newColorIndex !== this.colorIndex) {
      this.colorIndex = newColorIndex;
      this.shipColor = this.shipColors[this.colorIndex] || this.shipColors[0];
      this.log(`Mesh exists. Updating color index to: ${this.colorIndex}, new shipColor: ${this.shipColor}`);
      
      // Traverse the mesh and update the material's color.
      this.mesh.traverse(child => {
        if (child.isMesh && child.material) {
          child.material.color.setHex(this.shipColor);
        }
      });
      
      this.colorUpdated = true;
    }
  }
  
  
  /**
   * Creates a simple fallback mesh when the model can't be loaded
   * @private
   */
  createFallbackMesh() {
    if (this.loaded) return;
    
    try {
      const geometry = new THREE.ConeGeometry(1, 4, 8);
      const material = new THREE.MeshStandardMaterial({
        color: this.shipColor,
        metalness: 0.8,
        roughness: 0.2
      });
      
      this.mesh = new THREE.Mesh(geometry, material);
      this.mesh.rotation.x = -Math.PI / 2; // Orient the cone to point forward
      
      this.updatePosition(this.position);
      this.updateRotation(this.rotation);
      
      this.scene.add(this.mesh);
      this.loaded = true;
      this.log('Fallback shape created and added to scene');
      
      this.updateNameLabelPosition();
    } catch (error) {
      this.log('Error creating fallback mesh:', error);
    }
  }
  
  /**
   * Get a high-contrast color for the label based on ship color
   */
  getLabelColor() {
    const hexColor = this.shipColor.toString(16).padStart(6, '0');
    const r = parseInt(hexColor.substr(0, 2), 16) / 255;
    const g = parseInt(hexColor.substr(2, 2), 16) / 255;
    const b = parseInt(hexColor.substr(4, 2), 16) / 255;
    
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    
    return luminance < 0.5 ? '#FFFFFF' : '#000000';
  }
  
  /**
   * Update the position of the name label to stay above the ship
   */
  updateNameLabelPosition() {
    if (!this.nameLabel || !this.position) return;
    
    const labelPos = {
      x: this.position.x,
      y: this.position.y + 2.5, // Position above the ship
      z: this.position.z
    };
    
    this.nameLabel.position.set(labelPos.x, labelPos.y, labelPos.z);
  }

  /**
   * Updates the position of the enemy ship
   * @param {Object} position - New position with x, y, z coordinates
   */
  updatePosition(position) {
    this.position = position;
    if (this.mesh && this.loaded) {
      this.mesh.position.set(this.position.x, this.position.y, this.position.z);
      this.updateNameLabelPosition();
    } else {
      this.log('Attempted to update position, but mesh not ready');
    }
  }

  /**
   * Updates the rotation of the enemy ship.
   * Handles both Euler and Quaternion rotations.
   * @param {Object} rotation - New rotation (Euler: {x, y, z}, Quaternion: {x, y, z, w})
   */
  updateRotation(rotation) {
    this.rotation = rotation;
    if (this.mesh && this.loaded) {
      if (rotation && rotation.w !== undefined) { // Check if it's a Quaternion
        const incomingQuat = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
        // Apply correction to align model correctly (e.g., flip 180 degrees on Y)
        const correctionQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, 0));
        incomingQuat.multiply(correctionQuat);
        this.mesh.quaternion.copy(incomingQuat);
      } else if (rotation) { // Assume Euler if not Quaternion
        // Apply Euler rotation (consider if correction is needed here too)
        this.mesh.rotation.set(rotation.x, rotation.y, rotation.z);
      }
    } else {
      this.log('Attempted to update rotation, but mesh not ready');
    }
  }

  /**
   * Updates the entire state of the enemy ship based on server data.
   * @param {Object} data - Player data from the server, including position, rotation, health, etc.
   */
  updateState(data) {
    if (!data) return;

    // Update position
    if (data.position) {
      this.updatePosition(data.position);
    }

    // Update rotation
    if (data.rotation) {
      this.updateRotation(data.rotation);
    }

    // Update nickname if changed
    if (data.nickname && data.nickname !== this.nickname) {
      this.updateNickname(data.nickname);
    }

    // Update color if changed
    if (!this.isDead){
      this.updateColorIndex(data.colorIndex);
    }
    // Check for health change and trigger damage effect
    if (typeof data.health === 'number') {
      const previousHealth = this.lastHealth;
      this.health = data.health;

      if (this.health <= 0 && !this.isDead) {
        // --- Ship Death --- 
        this.log(`Health reached zero (${previousHealth} -> ${this.health}). Triggering death sequence.`);
        this.triggerDeathSequence();
        // No need to show damage effect if ship is dying
      } else if (this.health < previousHealth && !this.isDead) {
        // --- Ship Damaged (but not dead) ---
        this.log(`Health decreased from ${previousHealth} to ${this.health}. Calculating impact point for damage effect.`);
        let impactPointLocal = new THREE.Vector3(0, 0, 0); // Default to center
        try {
          // Raycasting Logic (as implemented previously)
          const camera = (typeof App !== 'undefined' && App.getCamera) ? App.getCamera() : null;
          if (camera && this.mesh && this.loaded) {
            const raycaster = new THREE.Raycaster();
            const shipWorldPosition = new THREE.Vector3();
            this.mesh.getWorldPosition(shipWorldPosition);
            const cameraPosition = new THREE.Vector3();
            camera.getWorldPosition(cameraPosition);
            const direction = shipWorldPosition.clone().sub(cameraPosition).normalize();
            raycaster.set(cameraPosition, direction);
            this.mesh.updateMatrixWorld(); // Important: Ensure matrix is updated
            const intersects = raycaster.intersectObject(this.mesh, true);
            if (intersects.length > 0) {
              const impactPointWorld = intersects[0].point;
              impactPointLocal = this.mesh.worldToLocal(impactPointWorld.clone());
              this.log('Damage Raycast hit, local coords:', impactPointLocal);
            } else {
              this.log('Damage Raycast did not intersect with the ship mesh.');
            }
          } else {
            this.log('Camera or mesh not available for damage raycasting.');
          }
          // Show the *small* damage effect
          this.showDamageEffect(impactPointLocal);
        } catch (error) {
          this.log('Error during raycasting or showing damage effect:', error);
          this.showDamageEffect(); // Fallback to default damage effect
        }
      } else if (this.health > previousHealth && this.isDead) {
        // Edge case: Ship was dead but got revived? Reset flag.
        this.log(`Ship revived? Health increased from ${previousHealth} to ${this.health}. Resetting isDead flag.`);
        this.isDead = false; 
      }

      this.lastHealth = this.health; // Update last health *after* checks
    }

    // Add other state updates here if needed (e.g., velocity)
  }

  /**
   * Creates and displays a temporary particle explosion effect at the ship's location.
   * @param {THREE.Vector3} [impactPointLocal=new THREE.Vector3(0,0,0)] - The point in the ship's local space where the effect should originate.
   */
  /**
 * Creates and displays a temporary particle explosion effect at the ship's location.
 * @param {THREE.Vector3} [impactPointLocal=new THREE.Vector3(0,0,0)] - The point in the ship's local space where the effect should originate.
 */
showDamageEffect(impactPointLocal = new THREE.Vector3(0, 0, 0)) {
  if (!this.scene || !this.mesh || !this.loaded) return;

  const particleCount = 3; // Increased count for a slightly broader effect
  const particlesGeometry = new THREE.BufferGeometry();
  const positions = [];
  const colors = [];
  const velocities = [];

  const explosionColor = new THREE.Color(0xffa500); // Orange

  // Play impact sound effect randomly when enemy is hit
let impactSound = new Audio(Math.random() < 0.5 ? 'soundfx/impact1.mp3' : 'soundfx/impact2.mp3');
impactSound.volume = 1.0;
impactSound.play().catch(err => console.warn("Impact sound failed:", err));


  for (let i = 0; i < particleCount; i++) {
    // Add a slight random offset to spread the particles over a small area around the impact point
    const offsetX = (Math.random() - 0.5) * 0.05;
    const offsetY = (Math.random() - 0.5) * 0.05;
    const offsetZ = (Math.random() - 0.5) * 0.05;
    positions.push(impactPointLocal.x + offsetX, impactPointLocal.y + offsetY, impactPointLocal.z + offsetZ);

    colors.push(explosionColor.r, explosionColor.g, explosionColor.b);

    // Calculate a very slight velocity for each particle
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos((Math.random() * 2) - 1);
    const speed = Math.random() * 0.005; 
    velocities.push(
      speed * Math.sin(phi) * Math.cos(theta),
      speed * Math.sin(phi) * Math.sin(theta),
      speed * Math.cos(phi)
    );
  }

  particlesGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  particlesGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  particlesGeometry.setAttribute('velocity', new THREE.Float32BufferAttribute(velocities, 3));

  // Create a circular sprite texture using an offscreen canvas.
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');  // Center: white
  gradient.addColorStop(0.5, 'rgba(255,165,0,0.7)');  // Mid: orange-ish
  gradient.addColorStop(1, 'rgba(255,165,0,0)');       // Edge: transparent
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  const sprite = new THREE.CanvasTexture(canvas);

  // Use a PointsMaterial that leverages the circular sprite texture.
  // The size is slightly increased to 0.03, making each particle a bit larger.
  const particlesMaterial = new THREE.PointsMaterial({
    size: 0.03,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    sizeAttenuation: true,
    map: sprite,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const particleSystem = new THREE.Points(particlesGeometry, particlesMaterial);
  // Adding as a child ensures the effect is in the ship's local space.
  this.mesh.add(particleSystem);

  const duration = 200; // Quick effect (200ms)
  const startTime = performance.now();

  const animateParticles = () => {
    const currentTime = performance.now();
    const elapsedTime = currentTime - startTime;
    const progress = Math.min(elapsedTime / duration, 1);

    if (progress >= 1) {
      if (this.mesh) {
        this.mesh.remove(particleSystem);
      }
      particlesGeometry.dispose();
      particlesMaterial.dispose();
      return;
    }

    const positions = particleSystem.geometry.attributes.position.array;
    const colors = particleSystem.geometry.attributes.color.array;
    const velocities = particleSystem.geometry.attributes.velocity.array;

    // Define color transitions (orange -> red -> dark grey)
    const colorStart = new THREE.Color(0xffa500);
    const colorMid = new THREE.Color(0xff0000);
    const colorEnd = new THREE.Color(0x444444);

    for (let i = 0; i < particleCount; i++) {
      const index = i * 3;

      // Update position based on velocity for a subtle spread effect.
      positions[index] += velocities[index] * 0.02;
      positions[index + 1] += velocities[index + 1] * 0.02;
      positions[index + 2] += velocities[index + 2] * 0.02;

      // Interpolate the color over time.
      const currentColor = new THREE.Color();
      if (progress < 0.5) {
        currentColor.lerpColors(colorStart, colorMid, progress * 2);
      } else {
        currentColor.lerpColors(colorMid, colorEnd, (progress - 0.5) * 2);
      }
      colors[index] = currentColor.r;
      colors[index + 1] = currentColor.g;
      colors[index + 2] = currentColor.b;

      // Fade out the particle's opacity over time.
      particleSystem.material.opacity = 0.9 * (1 - progress);
    }

    particleSystem.geometry.attributes.position.needsUpdate = true;
    particleSystem.geometry.attributes.color.needsUpdate = true;

    requestAnimationFrame(animateParticles);
  };

  requestAnimationFrame(animateParticles);
}

  /**
   * Triggers the death sequence: removes the ship and creates an explosion.
   */
  triggerDeathSequence() {
    if (this.isDead) return; // Already dead
    this.isDead = true;
    this.log("Initiating death sequence.");
    let killSound = new Audio('soundfx/kill.mp3');
    killSound.volume = 1.0;
    killSound.play().catch(err => console.warn("Kill sound failed:", err));
    // Store current world position before removing mesh
    const lastWorldPosition = new THREE.Vector3();
    if (this.mesh) {
      this.mesh.getWorldPosition(lastWorldPosition);
    } else {
      // Fallback to stored position if mesh is somehow gone already
      lastWorldPosition.set(this.position.x, this.position.y, this.position.z);
    }

    // Remove the ship model and label
    this.remove();

    // Create the death explosion at the last known position
    this.createDeathExplosion(lastWorldPosition);
  }

  /**
   * Creates a large explosion effect at the given world position.
   * @param {THREE.Vector3} position - The world position for the explosion center.
   */
  createDeathExplosion(position) {
    if (!this.scene) return; // Need scene access
    this.log("Creating death explosion at:", position);

    const particleCount = 500; // Significantly more particles
    const particlesGeometry = new THREE.BufferGeometry();
    const positions = [];
    const colors = [];
    const velocities = [];
    const initialSizes = [];

    const color1 = new THREE.Color(0xffffff); // White
    const color2 = new THREE.Color(0xffa500); // Orange
    const color3 = new THREE.Color(0xff0000); // Red

    for (let i = 0; i < particleCount; i++) {
      // Start particles at the explosion center
      positions.push(position.x, position.y, position.z);

      // Assign initial color (mix of white/orange)
      const startColor = Math.random() > 0.5 ? color1 : color2;
      colors.push(startColor.r, startColor.g, startColor.b);

      // Random velocity vector for outward explosion (higher speed)
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);
      const speed = Math.random() * 25 + 10; // Much faster speed range (10 to 35)
      velocities.push(
        speed * Math.sin(phi) * Math.cos(theta),
        speed * Math.sin(phi) * Math.sin(theta),
        speed * Math.cos(phi)
      );

      // Random initial size
      initialSizes.push(Math.random() * 2.0 + 1.0); // Much larger particles (1.0 to 3.0)
    }

    particlesGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    particlesGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    particlesGeometry.setAttribute('velocity', new THREE.Float32BufferAttribute(velocities, 3));
    particlesGeometry.setAttribute('initialSize', new THREE.Float32BufferAttribute(initialSizes, 1));

    // Re-use the sprite texture from the damage effect
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const context = canvas.getContext('2d');
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.5, 'rgba(255,165,0,0.7)');
    gradient.addColorStop(1, 'rgba(255,0,0,0)'); // Fade to transparent red
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
    const sprite = new THREE.CanvasTexture(canvas);

    // Use PointsMaterial with vertex colors and size attenuation
    const particlesMaterial = new THREE.PointsMaterial({
      size: 4.0, // Much larger base size
      vertexColors: true,
      transparent: true,
      opacity: 1.0,
      sizeAttenuation: true,
      map: sprite,
      depthWrite: false,
      blending: THREE.AdditiveBlending // Additive blending for brighter effect
    });

    const particleSystem = new THREE.Points(particlesGeometry, particlesMaterial);
    // Add directly to the main scene
    this.scene.add(particleSystem);

    const duration = 2500; // Longer duration (2.5 seconds)
    const startTime = performance.now();

    const animateParticles = () => {
      const currentTime = performance.now();
      const elapsedTime = currentTime - startTime;
      const progress = Math.min(elapsedTime / duration, 1);

      if (progress >= 1) {
        // Remove directly from the scene
        this.scene.remove(particleSystem);
        particlesGeometry.dispose();
        particlesMaterial.dispose();
        sprite.dispose(); // Dispose texture
        return;
      }

      const positions = particleSystem.geometry.attributes.position.array;
      const colors = particleSystem.geometry.attributes.color.array;
      const velocities = particleSystem.geometry.attributes.velocity.array;
      const initialSizes = particleSystem.geometry.attributes.initialSize.array;

      const colorMid = new THREE.Color(0xff0000);   // Red
      const colorEnd = new THREE.Color(0x333333);   // Dark Grey

      for (let i = 0; i < particleCount; i++) {
        const index = i * 3;
        const sizeIndex = i;

        // Update position based on velocity
        positions[index] += velocities[index] * 0.03; // Adjust multiplier as needed
        positions[index + 1] += velocities[index + 1] * 0.03;
        positions[index + 2] += velocities[index + 2] * 0.03;

        // Interpolate color (using original start color towards red -> grey)
        const startColor = new THREE.Color(colors[index], colors[index + 1], colors[index + 2]);
        const currentColor = new THREE.Color();
        if (progress < 0.6) { // Quickly shift towards red
          currentColor.lerpColors(startColor, colorMid, progress / 0.4);
        } else { // Fade to grey
          currentColor.lerpColors(colorMid, colorEnd, (progress - 0.4) / 0.6);
        }
        colors[index] = currentColor.r;
        colors[index + 1] = currentColor.g;
        colors[index + 2] = currentColor.b;

        // Fade out opacity
        particleSystem.material.opacity = 1.0 * (1 - progress);

        // Shrink particles over time
        particleSystem.material.size = initialSizes[sizeIndex] * (1 - progress) * 4.0; // Multiply by base size
      }

      particleSystem.geometry.attributes.position.needsUpdate = true;
      particleSystem.geometry.attributes.color.needsUpdate = true;
      // Update size if material size is changed per frame
      // particleSystem.material.needsUpdate = true; // Only if size changes globally

      requestAnimationFrame(animateParticles);
    };

    requestAnimationFrame(animateParticles);
  }

  /**
   * Removes the ship from the scene
   */
  remove() {
    if (this.mesh && this.scene) {
      this.scene.remove(this.mesh);
      this.log('Removed ship from scene');
      
      if (this.mesh.geometry) {
        this.mesh.geometry.dispose();
      }
      
      if (this.mesh.material) {
        if (Array.isArray(this.mesh.material)) {
          this.mesh.material.forEach(material => material.dispose());
        } else {
          this.mesh.material.dispose();
        }
      }
      
      this.mesh = null;
    }
    
    if (this.nameLabel && this.scene) {
      this.scene.remove(this.nameLabel);
      
      if (this.nameLabel.material && this.nameLabel.material.map) {
        this.nameLabel.material.map.dispose();
        this.nameLabel.material.dispose();
      }
      
      this.nameLabel = null;
    }
    this.colorUpdated = false;
    this.loaded = false;
    this.log('All resources disposed');
  }
}

// Export the EnemyShip class
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EnemyShip;
} else {
  window.EnemyShip = EnemyShip;
}
