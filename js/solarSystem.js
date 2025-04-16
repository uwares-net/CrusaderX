/**
 * solarSystem.js - Manages the creation and updates of celestial bodies in the solar system
 * Handles initialization and updating of the Sun, planets, moons, and asteroid belt.
 */

const SolarSystem = (function() {
    'use strict';
    
    // Variables to store celestial objects
    let scene = null;
    let textureLoader = null;
    let orbitSpeed = 0.5;
    let sunGlow = null;
    let celestialObjects = {};
    
    // Store celestial body objects for reference and updating
    let sun = null;
    let planets = [];
    let moons = [];
    let asteroidBelt = null;
    
    // Initialize the solar system
    function init(sceneRef) {
        try {
            scene = sceneRef;
            textureLoader = new THREE.TextureLoader();
            
            // Set up lighting for the solar system
            setupLighting(scene);
            
            // Process celestial body data
            const celestialData = CelestialBodies.processCelestialBodies();
            
            // Get initial planet positions based on current date
            const initialPositions = getInitialPlanetPositions();
            
            // Create the sun
            if (celestialData.sun) {
                sun = CelestialBodies.createBody(celestialData.sun, scene, textureLoader);
                celestialObjects.sun = sun;
                
                // Get the first mesh child from the sun object
                let sunMesh = null;
                if (sun.children && sun.children.length > 0) {
                    for (let i = 0; i < sun.children.length; i++) {
                        if (sun.children[i] instanceof THREE.Mesh) {
                            sunMesh = sun.children[i];
                            break;
                        }
                    }
                }
                
                // Create sun glow effect only if we have a mesh
                if (sunMesh && sunMesh.geometry) {
                    try {
                        // If we have a dedicated function in CelestialBodies, use that
                        if (typeof CelestialBodies.createSunGlow === 'function') {
                            const glowSize = sunMesh.geometry.parameters.radius || 5;
                            CelestialBodies.createSunGlow(sun, glowSize);
                            console.log("Created sun glow using CelestialBodies.createSunGlow");
                        } else {
                            // Otherwise use our local function
                            createSunGlow(sun);
                            console.log("Created sun glow using local createSunGlow");
                        }
                    } catch (error) {
                        console.error("Error creating sun glow:", error);
                    }
                } else {
                    console.warn("Cannot create sun glow: Sun mesh not found");
                }
            }
            
            // Create planets
            planets = [];
            if (celestialData.planets && celestialData.planets.length > 0) {
                celestialData.planets.forEach(planetData => {
                    const planet = CelestialBodies.createBody(planetData, scene, textureLoader);
                    
                    // Get the initial angle for this planet based on current date
                    const initialAngle = initialPositions[planetData.name.toLowerCase()] || Math.random() * Math.PI * 2;
                    
                    // Create a planet object with all required properties for correct orbit calculation
                    const planetObj = {
                        object: planet,
                        name: planetData.name,
                        data: planetData,
                        // Essential orbital parameters
                        semimajorAxis: planetData.distance * SCALE.DISTANCE,
                        eccentricity: planetData.eccentricity || 0.05, // Default if not specified
                        orbitalInclination: planetData.inclination || 0, // Default if not specified
                        currentAngle: initialAngle, // Initial position based on current date
                    };
                    
                    // Calculate initial position
                    const distance = planetObj.semimajorAxis * (1 - planetObj.eccentricity * planetObj.eccentricity) / 
                                    (1 + planetObj.eccentricity * Math.cos(initialAngle));
                    
                    // Set initial position
                    const x = distance * Math.cos(initialAngle);
                    const z = distance * Math.sin(initialAngle) * -1;
                    const y = z * Math.sin(planetObj.orbitalInclination);
                    const adjustedZ = z * Math.cos(planetObj.orbitalInclination);
                    planet.position.set(x, y, adjustedZ);
                    
                    planets.push(planetObj);
                    
                    // Removed the orbit line creation - no longer displaying orbit rings
                    // createOrbitLine(planetData.distance * SCALE.DISTANCE, planetObj.eccentricity);
                    
                    // Create moons if the planet has any
                    if (planetData.children && planetData.children.length > 0) {
                        planetData.children.forEach(moonData => {
                            const moon = CelestialBodies.createBody(moonData, scene, textureLoader, planet);
                            
                            // Initial random angle for moon
                            const initialMoonAngle = Math.random() * Math.PI * 2;
                            
                            // Create a moon object with all required properties
                            const moonObj = {
                                object: moon,
                                name: moonData.name,
                                parent: planetData.name,
                                data: moonData,
                                // Essential orbital parameters for moons
                                semimajorAxis: moonData.distance * SCALE.DISTANCE * SCALE.MOON_DISTANCE,
                                eccentricity: moonData.eccentricity || 0.01,
                                orbitalInclination: moonData.inclination || Math.random() * 0.2, // Small random inclination if not specified
                                currentAngle: initialMoonAngle, // Initial angle
                            };
                            
                            // Set initial position for moon
                            const moonDistance = moonObj.semimajorAxis * (1 - moonObj.eccentricity * moonObj.eccentricity) / 
                                               (1 + moonObj.eccentricity * Math.cos(initialMoonAngle));
                            const moonX = moonDistance * Math.cos(initialMoonAngle);
                            const moonZ = moonDistance * Math.sin(initialMoonAngle);
                            const moonY = moonZ * Math.sin(moonObj.orbitalInclination);
                            const moonAdjustedZ = moonZ * Math.cos(moonObj.orbitalInclination);
                            moon.position.set(moonX, moonY, moonAdjustedZ);
                            
                            moons.push(moonObj);
                        });
                    }
                });
            }
            
            // Create asteroid belt
            if (celestialData.asteroidBelt) {
                asteroidBelt = CelestialBodies.createAsteroidBelt(celestialData.asteroidBelt, scene, textureLoader);
                celestialObjects.asteroidBelt = asteroidBelt;
            }
            
            console.log("Solar system initialized successfully");
            return {
                sun,
                planets,
                moons,
                asteroidBelt
            };
        } catch (error) {
            console.error("Error initializing solar system:", error);
            return null;
        }
    }
    
    // Create the solar system (factory function)
    function create(scene) {
        if (!scene) {
            console.error("Scene is required to create the solar system");
            return null;
        }
        
        // Initialize the scene and create celestial bodies
        init(scene);
        
        // Return celestial bodies for access from outside
        return {
            sun,
            planets,
            moons,
            asteroidBelt
        };
    }
    
    // Create orbit line to show planet's orbital path
    function createOrbitLine(radius, eccentricity = 0) {
        try {
            const segments = 128;
            const circleGeometry = new THREE.BufferGeometry();
            const positions = new Float32Array((segments + 1) * 3);
            
            // If we have eccentricity, create an elliptical orbit
            // Otherwise create a circular orbit
            const a = radius; // Semi-major axis
            const b = a * Math.sqrt(1 - eccentricity * eccentricity); // Semi-minor axis
            
            for (let i = 0; i <= segments; i++) {
                const angle = (i / segments) * Math.PI * 2;
                
                // For elliptical orbit
                if (eccentricity > 0) {
                    positions[i * 3] = a * Math.cos(angle); // X coordinate
                    positions[i * 3 + 1] = 0; // Y coordinate (orbit in XZ plane)
                    positions[i * 3 + 2] = b * Math.sin(angle); // Z coordinate
                } else {
                    // For circular orbit
                    positions[i * 3] = Math.cos(angle) * radius;
                    positions[i * 3 + 1] = 0; // y = 0 for all points (flat orbit)
                    positions[i * 3 + 2] = Math.sin(angle) * radius;
                }
            }
            
            circleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            
            const material = new THREE.LineBasicMaterial({
                color: 0x444444,
                transparent: true,
                opacity: 0.3
            });
            
            const orbitLine = new THREE.Line(circleGeometry, material);
            scene.add(orbitLine);
            
            return orbitLine;
        } catch (error) {
            console.error("Error creating orbit line:", error);
            return null;
        }
    }
    
    // Create the sun glow effect
    function createSunGlow(sunObject) {
        try {
            if (!sunObject) {
                console.warn("Cannot create sun glow: Sun object is undefined");
                return null;
            }
            
            // Find the mesh with geometry within the sun's children
            let sunMesh = null;
            let glowRadius = 5; // Default fallback radius
            
            if (sunObject.children && sunObject.children.length > 0) {
                // Find the mesh child
                for (let i = 0; i < sunObject.children.length; i++) {
                    const child = sunObject.children[i];
                    if (child instanceof THREE.Mesh) {
                        sunMesh = child;
                        break;
                    }
                }
            }
            
            // Get radius from the mesh if found
            if (sunMesh && sunMesh.geometry && sunMesh.geometry.parameters) {
                glowRadius = sunMesh.geometry.parameters.radius * 1.2;
            }
            
            // Create a larger sphere for the glow effect
            const glowGeometry = new THREE.SphereGeometry(glowRadius, 32, 32);
            
            // Create a custom shader material for the glow effect
            const glowMaterial = new THREE.ShaderMaterial({
                uniforms: {
                    glowColor: { value: new THREE.Color(0xffff00) },
                    viewVector: { value: new THREE.Vector3(0, 0, 0) }
                },
                vertexShader: `
                    uniform vec3 viewVector;
                    varying float intensity;
                    void main() {
                        vec3 vNormal = normalize(normalMatrix * normal);
                        intensity = pow(1.05 - dot(vNormal, vec3(0, 0, 1)), 4.0);
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    }
                `,
                fragmentShader: `
                    uniform vec3 glowColor;
                    varying float intensity;
                    void main() {
                        vec3 glow = glowColor * intensity;
                        gl_FragColor = vec4(glow, 1.0);
                    }
                `,
                side: THREE.BackSide,
                blending: THREE.AdditiveBlending,
                transparent: true
            });
            
            sunGlow = new THREE.Mesh(glowGeometry, glowMaterial);
            sunObject.add(sunGlow);
            
            return sunGlow;
        } catch (error) {
            console.error("Error creating sun glow:", error);
            return null;
        }
    }
    
    // Update sun glow effect based on camera position
    function updateSunEffects(camera) {
        try {
            if (!sun || !camera) {
                return; // Safety check
            }
            
            // Use the CelestialBodies method to update the glow
            if (typeof CelestialBodies !== 'undefined' && 
                typeof CelestialBodies.updateSunGlow === 'function') {
                CelestialBodies.updateSunGlow(sun, camera);
            }
        } catch (error) {
            console.error("Error updating sun effects:", error);
        }
    }
    
    // Set realistic orbit speeds and calculate initial positions based on current date
    function getInitialPlanetPositions() {
        // Current date for initial planet positions
        const currentDate = new Date();
        
        // Reference: J2000 epoch (January 1, 2000, 12:00 UTC)
        const j2000 = new Date('2000-01-01T12:00:00Z');
        
        // Days since J2000 epoch
        const daysSinceJ2000 = (currentDate.getTime() - j2000.getTime()) / (1000 * 60 * 60 * 24);
        
        // Calculate Mean Longitude for each planet at current date
        // Formula: L = L0 + (days * 360 / orbital_period)
        // Source: Simplified calculations based on NASA JPL data
        
        // Mean Longitude at J2000 epoch (degrees)
        const L0 = {
            mercury: 252.25,
            venus: 181.98,
            earth: 100.47,
            mars: 355.43,
            jupiter: 34.40,
            saturn: 50.08,
            uranus: 314.06,
            neptune: 304.35
        };
        
        // Orbital periods in days
        const orbitalPeriods = {
            mercury: 87.969,
            venus: 224.701,
            earth: 365.256,
            mars: 686.980,
            jupiter: 4332.589,
            saturn: 10759.22,
            uranus: 30688.5,
            neptune: 60182
        };
        
        // Calculate current mean longitude for each planet
        const currentLongitude = {};
        for (const planet in L0) {
            // Calculate degrees moved since J2000
            const degreesMoved = (daysSinceJ2000 * 360 / orbitalPeriods[planet]) % 360;
            // Add to initial longitude and normalize to 0-360
            currentLongitude[planet] = (L0[planet] + degreesMoved) % 360;
            // Convert to radians for use in positioning
            currentLongitude[planet] = currentLongitude[planet] * Math.PI / 180;
        }
        
        console.log("Planet positions calculated for current date:", currentDate.toISOString());
        console.log("Days since J2000:", daysSinceJ2000.toFixed(2));
        
        return currentLongitude;
    }
    
    // Update all celestial body positions and rotations
    function update(deltaTime, totalTime) {
        try {
            // Get the camera from the App module for sun effects
            const camera = typeof App !== 'undefined' ? App.getCamera() : null;
            
            // Update Sun rotation
            if (sun) {
                // Sun rotates approximately once every 27 days
                const sunRotationSpeed = 2 * Math.PI / (27 * 24 * 60 * 60); // radians per second
                sun.rotation.y += sunRotationSpeed * deltaTime;
            }
            
            // Real-time orbital speeds
            // Using actual seconds for real-time simulation
            planets.forEach(planetObj => {
                // Calculate orbital period in seconds
                const orbitalPeriodSeconds = planetObj.data.orbitalPeriod * 24 * 60 * 60;
                
                // Calculate angular velocity in radians per second
                const angularVelocity = (2 * Math.PI) / orbitalPeriodSeconds;
                
                // Update angle based on real time (using deltaTime in seconds)
                planetObj.currentAngle = (planetObj.currentAngle + angularVelocity * deltaTime) % (2 * Math.PI);
                
                // Calculate elliptical orbit coordinates
                const semimajorAxis = planetObj.semimajorAxis;
                const eccentricity = planetObj.eccentricity;
                const distance = semimajorAxis * (1 - eccentricity * eccentricity) / (1 + eccentricity * Math.cos(planetObj.currentAngle));
                
                // Calculate rectangular coordinates
                const x = distance * Math.cos(planetObj.currentAngle);
                const z = distance * Math.sin(planetObj.currentAngle) * -1; // Invert Z for correct orbit direction
                
                // Apply inclination
                const y = z * Math.sin(planetObj.orbitalInclination);
                const adjustedZ = z * Math.cos(planetObj.orbitalInclination);
                
                // Update position
                planetObj.object.position.set(x, y, adjustedZ);
                
                // Update rotation (different for each planet)
                // Calculate rotation speed in radians per second
                const rotationPeriodSeconds = Math.abs(planetObj.data.rotationPeriod) * 24 * 60 * 60;
                const rotationSpeed = (2 * Math.PI) / rotationPeriodSeconds;
                
                // Apply rotation with correct direction
                const rotationDirection = (planetObj.data.rotationPeriod < 0) ? -1 : 1;
                planetObj.object.rotation.y += rotationSpeed * deltaTime * rotationDirection;
            });
            
            // Update moon positions and rotations relative to their planets
            moons.forEach(moonObj => {
                // Get the parent planet
                const parentPlanet = planets.find(p => p.name === moonObj.parent);
                if (!parentPlanet || !parentPlanet.object) return;
                
                // Calculate orbital period in seconds
                const orbitalPeriodSeconds = moonObj.data.orbitalPeriod * 24 * 60 * 60;
                
                // Calculate angular velocity in radians per second
                const angularVelocity = (2 * Math.PI) / orbitalPeriodSeconds;
                
                // Update angle based on real time
                moonObj.currentAngle = (moonObj.currentAngle + angularVelocity * deltaTime) % (2 * Math.PI);
                
                // Calculate distance from planet (elliptical orbit)
                const semimajorAxis = moonObj.semimajorAxis;
                const eccentricity = moonObj.eccentricity || 0;
                const distance = semimajorAxis * (1 - eccentricity * eccentricity) / (1 + eccentricity * Math.cos(moonObj.currentAngle));
                
                // Calculate rectangular coordinates
                const x = distance * Math.cos(moonObj.currentAngle);
                const z = distance * Math.sin(moonObj.currentAngle);
                
                // Apply inclination
                const y = z * Math.sin(moonObj.orbitalInclination);
                const adjustedZ = z * Math.cos(moonObj.orbitalInclination);
                
                // Set position relative to parent
                moonObj.object.position.set(x, y, adjustedZ);
                
                // Update rotation (moons are usually tidally locked)
                // For tidally locked moons, rotation period equals orbital period
                const rotationPeriodSeconds = moonObj.data.orbitalPeriod * 24 * 60 * 60;
                const rotationSpeed = (2 * Math.PI) / rotationPeriodSeconds;
                moonObj.object.rotation.y += rotationSpeed * deltaTime;
            });
            
            // Update asteroid belt - slow rotation
            if (asteroidBelt) {
                // Complete one rotation in approximately 50 years
                const beltRotationSpeed = (2 * Math.PI) / (50 * 365.25 * 24 * 60 * 60);
                asteroidBelt.rotation.y += beltRotationSpeed * deltaTime;
            }
            
            // Update sun glow effect if camera is available
            if (camera) {
                updateSunEffects(camera);
            }
        } catch (error) {
            console.error("Error updating celestial bodies:", error);
        }
    }
    
    // Set orbit speed (0-2)
    function setOrbitSpeed(speed) {
        orbitSpeed = Math.max(0, Math.min(2, speed));
    }
    
    // Get celestial bodies information
    function getCelestialBodies() {
        return [...planets, ...moons].map(body => {
            return {
                object: body.object,
                data: body.data
            };
        });
    }
    
    // Get planets only (for targeting)
    function getPlanets() {
        // Return both planets and moons for targeting
        const targetableBodies = [];
        
        // Process planets
        planets.forEach(planetObj => {
            if (planetObj.object) {
                // Ensure the isPlanet flag is set
                planetObj.object.userData = planetObj.object.userData || {};
                planetObj.object.userData.isPlanet = true;
                planetObj.object.userData.name = planetObj.name || "Unknown Planet";
                
                // Add to targetable bodies
                targetableBodies.push(planetObj.object);
                
                //console.log(`Added planet to targeting: ${planetObj.name}`);
            }
        });
        
        // Process moons
        moons.forEach(moonObj => {
            if (moonObj.object) {
                // Ensure the isPlanet flag is set (for targeting purposes)
                moonObj.object.userData = moonObj.object.userData || {};
                moonObj.object.userData.isPlanet = true;
                moonObj.object.userData.name = moonObj.name || "Unknown Moon";
                moonObj.object.userData.isMoon = true;
                
                // Add to targetable bodies
                targetableBodies.push(moonObj.object);
                
                //console.log(`Added moon to targeting: ${moonObj.name}`);
            }
        });
        
        //console.log(`SolarSystem.getPlanets returning ${targetableBodies.length} targetable bodies`);
        return targetableBodies;
    }
    
    // Get the sun object
    function getSun() {
        return sun;
    }
    
    // Set up lighting for the solar system
    function setupLighting(scene) {
        try {
            // Add ambient light for overall visibility
            const ambientLight = new THREE.AmbientLight(0x404040, 0.5); // Soft ambient light
            scene.add(ambientLight);
            
            // Add point light at the sun's position
            const sunLight = new THREE.PointLight(0xffffff, 2, 0, 1);  // Bright sun light with no distance falloff
            sunLight.position.set(0, 0, 0);  // At the center where the sun is
            
            // Set shadow properties
            sunLight.castShadow = true;
            sunLight.shadow.mapSize.width = 2048;
            sunLight.shadow.mapSize.height = 2048;
            sunLight.shadow.camera.near = 50;
            sunLight.shadow.camera.far = 5000;
            
            // Add the light to the scene
            scene.add(sunLight);
            
            console.log("Solar system lighting setup complete");
            
            return { ambientLight, sunLight };
        } catch (error) {
            console.error("Error setting up lighting:", error);
            return null;
        }
    }
    
    // Exported API
    return {
        init,
        create,
        update,
        updateSunEffects,
        setOrbitSpeed: function(speed) {
            orbitSpeed = speed;
        },
        getCelestialBodies: getCelestialBodies,
        getPlanets: getPlanets,
        getSun: getSun
    };
})(); 