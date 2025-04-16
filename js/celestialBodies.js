/**
 * celestialBodies.js - Defines celestial bodies for the SOL Arena solar system
 * Contains celestial body data and utility functions for manipulating it
 */

const CelestialBodies = (function() {
    'use strict';
    
    // Private helper functions
    function createSunGlow(sunObject, size) {
        const glowGeometry = new THREE.SphereGeometry(size * 0.9, 32, 32);
        const glowMaterial = new THREE.ShaderMaterial({
            uniforms: {
                viewVector: { value: new THREE.Vector3(0, 0, 1) },
                c: { value: 0.1 },
                p: { value: 4.5 },
                glowColor: { value: new THREE.Color(0xff7700) }
            },
            vertexShader: `
                uniform vec3 viewVector;
                varying float intensity;
                void main() {
                    vec3 vNormal = normalize(normalMatrix * normal);
                    vec3 vNormel = normalize(normalMatrix * viewVector);
                    intensity = pow(0.63 - dot(vNormal, vNormel), 3.0);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 glowColor;
                varying float intensity;
                void main() {
                    vec3 glow = glowColor * intensity;
                    gl_FragColor = vec4(glow, intensity);
                }
            `,
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending,
            transparent: true
        });
        
        // Create a mesh for the glow effect
        const sunGlow = new THREE.Mesh(glowGeometry, glowMaterial);
        
        // Tag with userData for easy identification
        sunGlow.userData.isGlow = true;
        
        // Make the glow slightly larger than the sun
        sunGlow.scale.multiplyScalar(1.3);
        
        // Add the glow to the sun object
        sunObject.add(sunGlow);
        
        return sunGlow;
    }
    
    // Exported API
    return {
        // Convert the existing celestial body data to a new format
        // that can be used by our modular code
        processCelestialBodies: function() {
            // Use the global CELESTIAL_BODIES object defined in constants.js
            const processedData = {};
            
            // Process Sun
            if (CELESTIAL_BODIES.SUN) {
                processedData.sun = CELESTIAL_BODIES.SUN;
            }
            
            // Process planets
            processedData.planets = [];
            
            // Loop through each planet in CELESTIAL_BODIES
            ['MERCURY', 'VENUS', 'EARTH', 'MARS', 'JUPITER', 'SATURN', 'URANUS', 'NEPTUNE'].forEach(planetKey => {
                if (CELESTIAL_BODIES[planetKey]) {
                    processedData.planets.push(CELESTIAL_BODIES[planetKey]);
                }
            });
            
            // Process asteroid belt
            if (CELESTIAL_BODIES.ASTEROID_BELT) {
                processedData.asteroidBelt = CELESTIAL_BODIES.ASTEROID_BELT;
            }
            
            return processedData;
        },
        
        // Expose the createSunGlow function to the public API
        createSunGlow: createSunGlow,
        
        // Function to create a celestial body - used by the SolarSystem module
        createBody: function(data, scene, textureLoader, parentObject = null) {
            try {
                const textureMap = {
                    'sun': 'textures/2k_sun.jpg',
                    'mercury': 'textures/2k_mercury.jpg',
                    'venus': 'textures/2k_venus_surface.jpg',
                    'earth': 'textures/2k_earth_daymap.jpg',
                    'moon': 'textures/2k_moon.jpg',
                    'mars': 'textures/2k_mars.jpg',
                    'phobos': 'textures/2k_mars.jpg', // Using Mars texture as placeholder
                    'deimos': 'textures/2k_mars.jpg', // Using Mars texture as placeholder
                    'jupiter': 'textures/2k_jupiter.jpg',
                    'saturn': 'textures/2k_saturn.jpg',
                    'uranus': 'textures/2k_uranus.jpg',
                    'neptune': 'textures/2k_neptune.jpg'
                };
                
                // Create the object holder (for rotation and position)
                const object = new THREE.Object3D();
                object.name = data.name;
                
                // Add user data for identification
                object.userData = {
                    ...data,
                    isSun: data.type === 'star',
                    isPlanet: data.type === 'planet' || data.type === 'dwarf_planet',
                    isMoon: data.type === 'moon'
                };
                
                console.log(`Creating celestial body: ${data.name}`, {
                    type: data.type,
                    userData: object.userData,
                    isPlanet: object.userData.isPlanet,
                    isMoon: object.userData.isMoon
                });
                
                // Create geometry based on the object type and size
                const radius = ((data.scaled_diameter !== undefined ? data.scaled_diameter : data.diameter * SCALE.SIZE) / 2);
                const segments = 32;
                const geometry = new THREE.SphereGeometry(radius, segments, segments);
                
                // Create material based on the type
                let material;
                
                // Use provided texture if available; otherwise use textureMap or fallback
                const texturePath = data.texture || textureMap[data.name.toLowerCase()] || 'textures/2k_earth_daymap.jpg';
                
                // Create basic material with texture for the body
                const texture = textureLoader.load(texturePath);
                material = new THREE.MeshStandardMaterial({
                    map: texture,
                    roughness: 0.8,
                    metalness: 0.1
                });
                
                // Create the mesh
                const mesh = new THREE.Mesh(geometry, material);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                
                // Set rotation for certain bodies
                if (data.axialTilt) {
                    mesh.rotation.z = data.axialTilt * Math.PI / 180;
                }
                
                // Add mesh to the object
                object.add(mesh);
                
                // Special handling for the sun: create a dedicated sun core with glow
                if (data.type === 'star' || data.name === 'Sun') {
                    console.log(`Creating sun core for ${data.name}`);
                    // Remove the default mesh so we can replace it with a dedicated sun core
                    object.remove(mesh);
                    
                    // Create the sun core using the same geometry but a MeshBasicMaterial
                    const sunCoreMaterial = new THREE.MeshBasicMaterial({
                        map: texture,
                        emissive: new THREE.Color(0xffaa33),
                        emissiveIntensity: 1.0
                    });
                    const sunCoreMesh = new THREE.Mesh(geometry, sunCoreMaterial);
                    sunCoreMesh.castShadow = false;
                    sunCoreMesh.receiveShadow = false;
                    object.add(sunCoreMesh);
                    
                    // Create the glow mesh and ensure it renders behind the core
                    const sunGlow = createSunGlow(object, radius);
                    sunGlow.renderOrder = -1;
                    
                    // Add a point light at the center for extra effect
                    const coreLight = new THREE.PointLight(0xffaa33, 1.5, 0, 2);
                    coreLight.position.set(0, 0, 0);
                    object.add(coreLight);
                }
                
                // Check if this is Saturn and add rings
                if (data.name.toLowerCase() === 'saturn') {
                    const rings = createSaturnRings(radius, textureLoader);
                    object.add(rings);
                }
                
                // Apply initial position if provided
                if (data.position) {
                    object.position.set(
                        data.position.x || 0, 
                        data.position.y || 0, 
                        data.position.z || 0
                    );
                }
                
                // If parent specified, add to parent
                if (parentObject) {
                    parentObject.add(object);
                    console.log(`Added ${data.name} to parent ${parentObject.name || 'unnamed'}`);
                } else {
                    // Otherwise add to scene
                    scene.add(object);
                    console.log(`Added ${data.name} directly to scene`);
                }
                
                // Debug in console
                if (data.type === 'planet' || data.type === 'moon') {
                    object.userData.isPlanet = true; // Consider moons as targetable celestial bodies
                    console.log(`Marked ${data.name} as targetable with isPlanet=true`);
                }
                
                return object;
                } catch (error) {
                console.error(`Error creating celestial body ${data.name}:`, error);
                return null;
            }
        },
        
        // Function to update sun glow effect
        updateSunGlow: function(sunObject, camera) {
            try {
                if (!sunObject || !camera) {
                    return; // Safety check
                }
                
                // Find the glow effect in the sun's children
                const sunGlow = sunObject.children.find(child => child.userData && child.userData.isGlow);
                
                // If we have a glow mesh with a shader material
                if (sunGlow && sunGlow.material && sunGlow.material.uniforms) {
                    // Create a vector from camera to sun
                    const viewVector = new THREE.Vector3();
                    // Get camera world position
                    const cameraWorldPos = new THREE.Vector3();
                    camera.getWorldPosition(cameraWorldPos);
                    
                    // Calculate view vector (camera to sun direction)
                    viewVector.subVectors(cameraWorldPos, sunObject.position).normalize();
                    
                    // Update the shader uniform
                    sunGlow.material.uniforms.viewVector.value.copy(viewVector);
                }
            } catch (error) {
                console.error("Error updating sun glow effect:", error);
            }
        },
        
        // Function to create asteroid belt
        createAsteroidBelt: function(data, scene, textureLoader) {
            const asteroids = new THREE.Group();
            asteroids.name = "Asteroid Belt";
            
            // Calculate min and max distances
            const minDistance = data.innerRadius * SCALE.DISTANCE;
            const maxDistance = data.outerRadius * SCALE.DISTANCE;
            
            const asteroidCount = data.asteroidCount || 1000;
            
            // Create individual asteroids
            for (let i = 0; i < asteroidCount; i++) {
                // Random distance within the belt range
                const distance = minDistance + Math.random() * (maxDistance - minDistance);
                
                // Random position on a circle at that distance
                const angle = Math.random() * Math.PI * 2;
                const x = Math.cos(angle) * distance;
                const z = Math.sin(angle) * distance;
                
                // Random y value for a more 3D distribution
                const y = (Math.random() - 0.5) * (maxDistance - minDistance) * 0.1;
                
                // Create asteroid (small sphere)
                const size = Math.random() * 0.08 + 0.02; // Random size between 0.02 and 0.1
                const geometry = new THREE.SphereGeometry(size, 4, 4); // Low poly for performance
                
                // Random gray color
                const grayValue = Math.min(255, Math.max(0, Math.floor(Math.random() * 50 + 100))); // Value between 100-150
                const color = new THREE.Color(grayValue/255, grayValue/255, grayValue/255);
                
                const material = new THREE.MeshStandardMaterial({
                    color: color,
                    roughness: 0.8,
                    metalness: 0.2
                });
                
                const asteroid = new THREE.Mesh(geometry, material);
                asteroid.position.set(x, y, z);
                
                // Random rotation
                asteroid.rotation.x = Math.random() * Math.PI;
                asteroid.rotation.y = Math.random() * Math.PI;
                asteroid.rotation.z = Math.random() * Math.PI;
                
                asteroids.add(asteroid);
            }
            
            // Add the asteroid belt to the scene
            scene.add(asteroids);
            
            return asteroids;
        },
        
        // Add rings around a planet (for Saturn, etc.)
        addRings: function(planetObject, planetData, scene, textureLoader) {
            // Skip if planet doesn't have rings
            if (!planetData.rings) return;
            
            // Create geometry for rings
            const innerRadius = ((planetData.scaled_diameter || planetData.diameter * SCALE.SIZE) / 2) * 1.3;
            const outerRadius = ((planetData.scaled_diameter || planetData.diameter * SCALE.SIZE) / 2) * 2.5;
            const ringGeometry = new THREE.RingGeometry(innerRadius, outerRadius, 64);
            
            // Create material for rings
            const ringMaterial = new THREE.MeshBasicMaterial({
                color: planetData.rings.color || 0xffffff,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.8
            });
            
            // Rotate the ring geometry to be in the correct plane
            ringGeometry.rotateX(Math.PI / 2);
            
            // Try to load texture if specified
            if (planetData.rings.texture) {
                try {
                    // Configure texture loader for rings
                    const onTextureLoad = (loadedTexture) => {
                        // Configure texture to avoid WebGL errors
                        loadedTexture.generateMipmaps = false;
                        loadedTexture.minFilter = THREE.LinearFilter;
                        loadedTexture.magFilter = THREE.LinearFilter;
                        loadedTexture.wrapS = THREE.ClampToEdgeWrapping;
                        loadedTexture.wrapT = THREE.ClampToEdgeWrapping;
                        
                        // Apply to material
                        ringMaterial.map = loadedTexture;
                        ringMaterial.color.set(0xffffff);
                        ringMaterial.needsUpdate = true;
                    };
                    
                    // Load the texture
                    const texture = textureLoader.load(
                        planetData.rings.texture,
                        onTextureLoad,
                        undefined,
                        (error) => {
                            console.error(`Error loading ring texture for ${planetData.name}:`, error);
                        }
                    );
                } catch (error) {
                    console.error(`Error loading ring texture for ${planetData.name}:`, error);
                }
            }
            
            // Create ring mesh
            const rings = new THREE.Mesh(ringGeometry, ringMaterial);
            rings.name = planetData.name + " Rings";
            rings.userData.isRing = true;
            
            // Add rings to the planet
            planetObject.add(rings);
            
            console.log(`Added rings to ${planetData.name}`);
            
            return rings;
        }
    };
    
    // Private helper functions
    function createRings(planetObject, planetData, textureLoader) {
        // Scale rings to be more visible
        const ringScale = 3;
        const innerRadius = planetData.rings.innerRadius * SCALE.DISTANCE * ringScale;
        const outerRadius = planetData.rings.outerRadius * SCALE.DISTANCE * ringScale;
        
        // Create ring geometry
        const ringGeometry = new THREE.RingGeometry(
            innerRadius,
            outerRadius,
            64
        );
        
        // Need to rotate the ring geometry to be horizontal
        ringGeometry.rotateX(Math.PI / 2);
        
        // Create material for rings
        let ringMaterial = new THREE.MeshStandardMaterial({
            color: 0xd8d8d8,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.9,
            roughness: 0.3,
            metalness: 0.2
        });
        
        // Try to load texture if specified
        if (planetData.rings.texture) {
            try {
                const texture = textureLoader.load(
                    planetData.rings.texture,
                    // Success callback
                    (loadedTexture) => {
                        ringMaterial.map = loadedTexture;
                        ringMaterial.color.set(0xffffff);
                        ringMaterial.needsUpdate = true;
                    },
                    // Progress callback
                    undefined,
                    // Error callback
                    (error) => {
                        console.error(`Error loading ring texture for ${planetData.name}:`, error);
                    }
                );
            } catch (error) {
                console.error(`Error loading ring texture for ${planetData.name}:`, error);
            }
        }
        
        // Create ring mesh
        const rings = new THREE.Mesh(ringGeometry, ringMaterial);
        
        // Add rings to the planet
        planetObject.add(rings);
    }

    // Create Saturn rings
    function createSaturnRings(saturnRadius, textureLoader) {
        try {
            // Create ring geometry
            const innerRadius = saturnRadius * 1.2;
            const outerRadius = saturnRadius * 2.0;
            const segments = 64;
            
            const ringGeometry = new THREE.RingGeometry(
                innerRadius, outerRadius, segments
            );
            
            // Load ring texture
            const ringTexture = textureLoader.load('textures/2k_saturn_ring_alpha.png');
            
            // Create material with transparency
            const ringMaterial = new THREE.MeshStandardMaterial({
                map: ringTexture,
                color: 0xffffff,
                side: THREE.DoubleSide,
                transparent: true,
                alphaTest: 0.1
            });
            
            // Create ring mesh
            const rings = new THREE.Mesh(ringGeometry, ringMaterial);
            
            // Rotate rings to correct orientation
            rings.rotation.x = Math.PI / 2;
            
            console.log('Created Saturn rings successfully');
            return rings;
        } catch (error) {
            console.error('Error creating Saturn rings:', error);
            return null;
        }
    }
})();
