/**
 * app.js - Main application entry point
 * Initializes and manages the 3D scene, camera, and renderer
 */

// Define global constants
const ENEMY_SHIP_SPEED = 5; // Speed in units per second (5 units = 500Mm/s at scale 100 units = 1 AU)
const MIN_SAFE_DISTANCE = typeof SCALE_CONST !== 'undefined' ? SCALE_CONST.MIN_SAFE_DISTANCE : 0.67;

const App = (function () {
    'use strict';

    // Three.js components
    let scene, camera, renderer;
    let clock;
    let controls; // PointerLockControls for camera

    // Game objects
    let solarSystem;
    let starField;
    let sun;

    // Global variables for the application
    let controlsUI;
    let lastHudCheckTime = 0;
    let localPlayerHealth = 100; // Track local player health
    let isGameOver = false; // Track game over state

    // Global variables
    let shipModel = null; // Reference to the ship model object

    let isCollidingWithPlanet = false;
    const playerCollisionRadius = 0.08; 
    const collisionBuffer = 0.03;       
    const reusablePlanetBox = new THREE.Box3(); // Reuse Box3 for planets/moons
    const reusableBodyPosition = new THREE.Vector3(); // Reuse Vector3
    const reusablePlayerSphere = new THREE.Sphere(); // Reuse Sphere for player

    // Check if required modules are loadeda
    function checkDependencies() {
        const requiredModules = {
            'THREE': typeof THREE !== 'undefined',
            'PointerLockControls': typeof PointerLockControls !== 'undefined',
            'UIController': typeof UIController !== 'undefined',
            'SolarSystem': typeof SolarSystem !== 'undefined',
            'ShipController': typeof ShipController !== 'undefined',
            'EventHandlers': typeof EventHandlers !== 'undefined'
        };

        let allModulesLoaded = true;

        Object.entries(requiredModules).forEach(([name, loaded]) => {
            if (!loaded) {
                console.error(`Required module ${name} is not loaded`);
                allModulesLoaded = false;
            }
        });

        return allModulesLoaded;
    }



    function animateHelpPrompt() {
        if (document.getElementById('help-prompt-overlay')) return; // Already exists

        const overlay = document.createElement('div');
        overlay.id = 'help-prompt-overlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '75%'; // Position lower on the screen
        overlay.style.left = '50%';
        overlay.style.transform = 'translate(-50%, -50%)';
        overlay.style.zIndex = '20000'; // High z-index
        overlay.style.pointerEvents = 'none'; // Don't intercept clicks

        const helpTextElement = document.createElement('div');
        helpTextElement.id = 'help-prompt-text';
        helpTextElement.style.fontFamily = '"Orbitron", sans-serif'; // Use Orbitron like title/game over
        helpTextElement.style.fontSize = '36px'; // Slightly smaller than GAME OVER
        helpTextElement.style.color = '#00ffff'; // Cyan color like HUD elements
        helpTextElement.style.textShadow = '0 0 8px rgba(0, 255, 255, 0.7)';
        helpTextElement.style.textAlign = 'center';
        helpTextElement.style.opacity = '0'; // Start invisible
        helpTextElement.style.transition = 'opacity 0.5s ease-in';

        overlay.appendChild(helpTextElement);
        document.body.appendChild(overlay);

        const textToAnimate = "PRESS 'H' FOR HELP";
        let charIndex = 0;
        let revealInterval;
        let blinkInterval;
        let flashInterval;
        let timeoutHandle;

        // Function to reveal text char by char
        function revealText() {
            if (charIndex < textToAnimate.length) {
                helpTextElement.textContent = textToAnimate.substring(0, charIndex + 1) + '_';
                charIndex++;
            } else {
                clearInterval(revealInterval);
                helpTextElement.textContent = textToAnimate; // Remove underscore
                // Start flashing after reveal
                startFlashing();
                // Set timeout to remove the prompt
                timeoutHandle = setTimeout(removeHelpPrompt, 4000); // Flash for 4 seconds
            }
        }

        // Function to start flashing
        function startFlashing() {
            let visible = true;
            flashInterval = setInterval(() => {
                visible = !visible;
                helpTextElement.style.opacity = visible ? '1' : '0.5';
            }, 500); // Flash every 500ms
        }

        // Function to remove the prompt
        function removeHelpPrompt() {
            clearInterval(flashInterval); // Stop flashing
            clearTimeout(timeoutHandle); // Clear removal timeout just in case
            if (overlay && overlay.parentNode) {
                overlay.style.opacity = '0'; // Fade out
                setTimeout(() => {
                    if (overlay.parentNode) {
                        overlay.parentNode.removeChild(overlay);
                    }
                }, 500); // Remove after fade out
            }
        }

        // Fade in the container first
        setTimeout(() => {
            helpTextElement.style.opacity = '1';
            // Start revealing text after fade-in
            revealInterval = setInterval(revealText, 100); // Adjust speed as needed
        }, 100); // Small delay for fade-in
    }

    // Initialize the application
    function init() {
        try {
            console.log("Initializing Crusader X application...");

            // Preload critical assets while intro screen is showing
            preloadAssets();

            // If IntroScreen is available, wait for it to complete before initializing the game
            if (typeof IntroScreen !== 'undefined') {
                // Check if already completed
                if (window.playerData) {
                    console.log("Intro screen already completed, continuing initialization with player data:", window.playerData);
                    initializeAfterIntro();
                } else {
                    console.log("Waiting for intro screen completion...");
                    // Listen for intro completion event
                    document.addEventListener('introComplete', (event) => {
                        console.log("Intro screen completed with player data:", event.detail);
                        window.playerData = event.detail;
                        initializeAfterIntro();
                    });
                    return; // Exit init and wait for the event
                }
            } else {
                console.warn("IntroScreen module not found, continuing without player customization");
                // Set default player data
                window.playerData = {
                    nickname: "Unknown",
                    colorIndex: 0,
                    colorHex: 0xFF0000 // Red
                };
                initializeAfterIntro();
            }

        } catch (error) {
            console.error("Error initializing application:", error);
            // Try to show error to user
            const loadingScreen = document.getElementById('loading-screen');
            if (loadingScreen) {
                const loadingContent = loadingScreen.querySelector('.loading-content');
                if (loadingContent) {
                    loadingContent.innerHTML = `
                            <h1>Error</h1>
                            <p>Failed to initialize application: ${error.message}</p>
                        `;
                }
            }
            throw error; // Re-throw to prevent partial initialization
        }
    }
    function positionShipNearEarth() {
        try {
            // Get the list of planets from the solar system.
            const planets = SolarSystem.getPlanets();
            if (!planets || planets.length === 0) {
                console.warn("Could not find planets to position ship near Earth");
                return false;
            }

            // Find Earth in the list (case-insensitive check).
            const earth = planets.find(planet =>
                planet.userData &&
                planet.userData.name &&
                planet.userData.name.toLowerCase() === "earth"
            );

            if (!earth) {
                console.warn("Could not find Earth in the planet list");
                return false;
            }

            console.log("Found Earth at position:", earth.position);

            // Get the camera rig (player ship) to reposition.
            const cameraRig = controls.getObject();

            // Clone Earth's current position.
            const earthPos = earth.position.clone();

            // Define minimum and maximum horizontal offset distances (in world units).
            const minDistance = 5;
            const maxDistance = 10;
            const offsetDistance = minDistance + Math.random() * (maxDistance - minDistance);

            // Generate a random angle (0 to 2π) for horizontal offset.
            const offsetAngle = Math.random() * Math.PI * 2;

            // Define a random vertical offset range (to elevate the ship above Earth’s orbital plane).
            const minY = 2;
            const maxY = 5;
            const offsetY = minY + Math.random() * (maxY - minY);

            // Apply random offsets:
            earthPos.x += Math.cos(offsetAngle) * offsetDistance;
            earthPos.z += Math.sin(offsetAngle) * offsetDistance;
            earthPos.y += offsetY;

            // Set the camera rig's position.
            cameraRig.position.copy(earthPos);
            console.log("Positioned ship near Earth at:", cameraRig.position);
            return true;
        } catch (error) {
            console.error("Error positioning ship near Earth:", error);
            return false;
        }
    }

    /**
     * Initialize the game after the intro screen is complete
     */
    function initializeAfterIntro() {
        try {
            // Check dependencies first
            checkDependencies();

            // Create scene
            scene = new THREE.Scene();
            scene.background = new THREE.Color(0x000000);

            // Create camera 
            camera = new THREE.PerspectiveCamera(
                75,
                window.innerWidth / window.innerHeight,
                0.1,
                50000
            );

            // Create renderer
            renderer = new THREE.WebGLRenderer({ antialias: true });
            renderer.setSize(window.innerWidth, window.innerHeight);
            renderer.setPixelRatio(window.devicePixelRatio);

            // Initialize clock for animation
            clock = new THREE.Clock();

            // Initialize UI first
            const container = document.getElementById('container');
            if (!container) {
                throw new Error("No container element found with ID 'container'");
            }

            // Initialize UI Controller with renderer and camera
            if (!UIController.init(renderer, camera)) {
                throw new Error("Failed to initialize UI controller - container element not found");
            }

            window.camera = camera;
            MobileControls.init();

            // Add renderer to container
            container.appendChild(renderer.domElement);

            // Initialize PointerLockControls
            controls = new PointerLockControls(camera, renderer.domElement);

            controls.lookSpeed = 0.1; // Reduced for more precise control
            controls.movementSpeed = 0; // We handle movement separately

            // Add the camera rig to the scene
            scene.add(controls.getObject());

            if (!MobileControls.isMobile) {
                renderer.domElement.addEventListener('click', function () {
                    if (!document.pointerLockElement) {
                        controls.lock();
                        console.log("Requesting pointer lock on click");
                    }
                });
            }

            // Listen for pointer lock events
            controls.addEventListener('lock', function () {
                console.log("Pointer lock acquired - Controls active");
            });

            controls.addEventListener('unlock', function () {
                console.log("Pointer lock released - Controls inactive");
            });

            // Make sure the container can receive focus to maintain pointer lock
            container.setAttribute('tabindex', '0');
            container.focus();

            // Initialize event handlers
            if (!EventHandlers.init(scene, camera, renderer)) {
                throw new Error("Failed to initialize event handlers");
            }

            // Handle pointer lock change at the document level - CRITICAL for mouse control
            document.addEventListener('pointerlockchange', onPointerLockChange, false);
            document.addEventListener('mozpointerlockchange', onPointerLockChange, false);
            document.addEventListener('webkitpointerlockchange', onPointerLockChange, false);

            // Handle window resize
            window.addEventListener('resize', onWindowResize, false);

            // Skybox initialization
            Skybox.init(scene, 'images/skybox/');
            // Initialize solar system
            if (typeof SolarSystem !== 'undefined' && SolarSystem) {
                solarSystem = SolarSystem.init(scene);
            } else {
                console.warn("SolarSystem not available - no planets or celestial bodies will be shown");
            }

            // Add lasers to the scene (but they'll actually be attached to the camera)
            if (typeof LaserSystem !== 'undefined' && LaserSystem) {
                LaserSystem.init(scene, camera);
            } else {
                console.warn("LaserSystem not available");
            }

            // Initialize HUDs early, before starting the animation loop
            initializeHUDs(camera, renderer, scene);

            // Initialize multiplayer networking if available
            if (typeof NetworkController !== 'undefined' && NetworkController) {
                console.log("Initializing multiplayer networking...");

                // Make sure global Controls reference is set
                if (typeof Controls === 'undefined' || !Controls) {
                    // Define global Controls reference if it doesn't exist
                    window.Controls = controls;
                    console.log("Created global Controls reference for NetworkController");
                }

                // Create a reconnection message element if it doesn't exist
                if (!document.getElementById('reconnect-message')) {
                    const reconnectMsg = document.createElement('div');
                    reconnectMsg.id = 'reconnect-message';
                    reconnectMsg.style.position = 'absolute';
                    reconnectMsg.style.top = '20px';
                    reconnectMsg.style.left = '50%';
                    reconnectMsg.style.transform = 'translateX(-50%)';
                    reconnectMsg.style.backgroundColor = 'rgba(200, 0, 0, 0.7)';
                    reconnectMsg.style.color = 'white';
                    reconnectMsg.style.padding = '10px 20px';
                    reconnectMsg.style.borderRadius = '5px';
                    reconnectMsg.style.fontFamily = 'Arial, sans-serif';
                    reconnectMsg.style.fontSize = '14px';
                    reconnectMsg.style.zIndex = '1000';
                    reconnectMsg.style.display = 'none';
                    reconnectMsg.textContent = 'Disconnected from server. Attempting to reconnect...';
                    document.body.appendChild(reconnectMsg);
                }

                NetworkController.init({
                    serverUrl: 'https://fonearcade.com',
                    port: 6198,
                    scene: scene,
                    controls: controls, // Pass the controls object directly
                    updatesPerSecond: 10, // Set to 10 updates per second
                    playerData: window.playerData, // Pass the player data from the intro screen
                    onConnect: function (data) {
                        console.log("Connected to multiplayer server with ID:", data.id);
                        UIController.showNotification("Connected to multiplayer server");

                        // Include player's nickname in the connection notification
                        if (window.playerData && window.playerData.nickname) {
                            UIController.showNotification(`Connected as ${window.playerData.nickname}`);
                        }

                        // Clear any reconnection message that might be showing
                        const reconnectMsg = document.getElementById('reconnect-message');
                        if (reconnectMsg) {
                            reconnectMsg.style.display = 'none';
                        }
                    },
                    onDisconnect: function (error) {
                        console.log("Disconnected from multiplayer server");
                        UIController.showNotification("Disconnected - Attempting to reconnect...");
                        showReconnectionMessage();
                    },
                    onPlayerJoined: function (data) {
                        const playerName = data.nickname || "Unknown Player"; // Never show ID
                        console.log("Player joined:", playerName);
                        UIController.showNotification(`${playerName} joined`);
                    },
                    onPlayerLeft: function (data) {
                        const playerName = data.nickname || "Unknown Player"; // Never show ID
                        console.log("Player left:", playerName);
                        UIController.showNotification(`${playerName} left`);
                    },
                    onPlayerUpdate: function (data) {
                        // Handle updates without exposing IDs
                    }
                });

                // Add a UI option to adjust the network update rate if desired
                if (typeof UIController !== 'undefined' && UIController.addSettingsOption) {
                    UIController.addSettingsOption({
                        id: 'network-update-rate',
                        label: 'Network Update Rate',
                        type: 'slider',
                        min: 1,
                        max: 30,
                        value: 10,
                        step: 1,
                        onChange: function (value) {
                            if (NetworkController.setUpdateRate) {
                                NetworkController.setUpdateRate(parseInt(value));
                                UIController.showNotification(`Network update rate set to ${value} per second`);
                            }
                        }
                    });
                }
            } else {
                console.warn("NetworkController not available, multiplayer disabled");
            }

            // Get Earth's actual current position for proper ship positioning


            // Try to position the ship near Earth, but don't cause problems if it fails
            // Try to position the ship near Earth, but don't cause problems if it fails
            const positionSuccess = positionShipNearEarth(); // <-- Store the boolean result
            const cameraRig = controls.getObject(); // Get the camera rig (player)
            if (!positionSuccess) {
                // Fallback positioning if positionShipNearEarth failed
                cameraRig.position.set(100, 10, 0); // Use a default position
                console.log("Using fallback position near Earth's orbit:", cameraRig.position.clone());
            }


            // Define placement parameters for the station
            const platformDistance = 2; // How far in front to place it
            const platformDrop = 0;      // How far below eye level to place it

            // Get the actual spawn position AFTER potential positioning
            const spawnPosition = cameraRig.position.clone();
            console.log("Actual spawn position for platform:", spawnPosition);

            // Get the initial forward direction of the camera
            const forwardDirection = new THREE.Vector3();
            camera.getWorldDirection(forwardDirection); // Gets the direction the camera is looking
            console.log("Initial forward direction:", forwardDirection);

            // Global variable to hold the loaded space station model
            let loadedSpaceStation;

            function addSpaceStation() {
                const loader = new THREE.GLTFLoader();
                loader.load(
                    'models/spaceStation1.glb',
                    function (gltf) {
                        loadedSpaceStation = gltf.scene;
                        loadedSpaceStation.name = 'SpaceStation';
                        // Set scale to 0.1 for x, y, and z
                        loadedSpaceStation.scale.set(0.7, 0.7, 0.7);

                        // Position the model relative to the spawn position and forward direction
                        loadedSpaceStation.position.copy(spawnPosition)
                            .addScaledVector(forwardDirection, platformDistance)
                            .add(new THREE.Vector3(0, -platformDrop, 0)); // Move down slightly

                        scene.add(loadedSpaceStation);
                    },
                    undefined,
                    function (error) {
                        console.error("Error loading space station model:", error);
                    }
                );
            }

            // Call the function to add the space station
            //addSpaceStation();

            // --- START: Corrected Platform and Text Creation ---

            // --- Welcome Text ---
            const canvas = document.createElement('canvas');
            const canvasWidth = 512;
            const canvasHeight = 128; // Adjusted height might be better for a single line
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
            const ctx = canvas.getContext('2d');

            // Set font and style for the text
            ctx.font = 'Bold 80px Arial'; // Adjusted size
            ctx.fillStyle = '#FFFF00';     // Bright yellow
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('WELCOME!', canvasWidth / 2, canvasHeight / 2);

            // Create a texture from the canvas
            const textTexture = new THREE.CanvasTexture(canvas);
            textTexture.needsUpdate = true; // Important only if canvas changes later

            // Create a plane for the text – adjust size relative to the new platform
            const textSize = { width: 4, height: 1 }; // Smaller than the platform
            const textPlaneGeometry = new THREE.PlaneGeometry(textSize.width, textSize.height);
            const textMaterial = new THREE.MeshBasicMaterial({
                map: textTexture,
                transparent: true,
                side: THREE.DoubleSide // Render both sides so it's visible from behind too
            });
            const textPlane = new THREE.Mesh(textPlaneGeometry, textMaterial);
            textPlane.name = "WelcomeText"; // Name for debugging

            // Position the text plane clearly above the platform's top surface.
            // If the space station has loaded, use its position; otherwise, fall back to spawnPosition.
            if (loadedSpaceStation) {
                textPlane.position.copy(loadedSpaceStation.position);
            } else {
                textPlane.position.copy(spawnPosition);
            }
            textPlane.position.y += 5; // Raise the text above the platform

            // Make the text face the player's spawn point (approximately)
            textPlane.lookAt(spawnPosition); // Point the text towards where the player started

            scene.add(textPlane);
            console.log("Text Plane positioned at:", textPlane.position.clone());

            function loadEnemySpaceship() {
                try {
                    console.log("Loading enemy spaceship model...");

                    // Save player position for reference
                    const playerPos = controls.getObject().position.clone();
                    console.log("Player position for reference:", playerPos);

                    // Check if GLTFLoader is available, if not, add it
                    if (typeof THREE.GLTFLoader === 'undefined') {
                        console.log("GLTFLoader not found, creating it...");
                        // Create script element to load GLTFLoader
                        const gltfLoaderScript = document.createElement('script');
                        gltfLoaderScript.src = 'https://cdn.jsdelivr.net/npm/three@0.132.2/examples/js/loaders/GLTFLoader.js';
                        gltfLoaderScript.onload = () => {
                            console.log("GLTFLoader loaded, now loading model...");
                        };
                        gltfLoaderScript.onerror = (error) => {
                            console.error("Error loading GLTFLoader:", error);
                        };
                        document.head.appendChild(gltfLoaderScript);
                    }

                } catch (error) {
                    console.error("Error in loadEnemySpaceship:", error);
                }
            }

            // Load the enemy spaceship
            loadEnemySpaceship();

            // Add spaceship model to the camera - do this BEFORE initializing the LaserSystem
            const ship = addSpaceshipModel(camera);
            shipModel = ship; // Store in global variable

            // Add cockpit overlay
            addCockpitOverlay();

            const params = new URLSearchParams(window.location.search);
            let speedParam = params.get('speed');
            let initialSpeed = 0; // default value
            let parsedSpeed = 0;
            if (speedParam) {
                // Remove decimals by splitting on the decimal point
                speedParam = speedParam.split('.')[0];
                parsedSpeed = parseInt(speedParam, 10);
                if (!isNaN(parsedSpeed) && parsedSpeed >= 0 && parsedSpeed < ShipController.MAX_VELOCITY) {
                    initialSpeed = parsedSpeed;
                }
            }
            ShipController.init(controls, parsedSpeed);

            // Initialize background music
            const backgroundMusic = document.getElementById('background-music');
            if (backgroundMusic) {
                backgroundMusic.volume = 0.3; // Set a reasonable volume
                // Try to play the music when user interacts
                document.addEventListener('click', () => {
                    try {
                        backgroundMusic.play().catch(error => {
                            console.log("Music playback prevented by browser:", error);
                        });
                    } catch (error) {
                        console.error("Error playing background music:", error);
                    }
                }, { once: true });
            } else {
                console.warn("Background music element not found - creating one");
                const newBackgroundMusic = initBackgroundMusic();
                if (newBackgroundMusic) {
                    document.addEventListener('click', () => {
                        try {
                            newBackgroundMusic.play().catch(error => {
                                console.log("Music playback prevented by browser:", error);
                            });
                        } catch (error) {
                            console.error("Error playing background music:", error);
                        }
                    }, { once: true });
                }
            }

            // Make sure UI elements are properly set up
            controlsUI = createControlsUI();

            if (!MobileControls.isMobile) {
                // Delay the prompt slightly after initialization seems complete
                setTimeout(animateHelpPrompt, 1500);
            }
            // Start the animation loop
            animate();

            console.log("Crusader X initialization complete");
        } catch (error) {
            console.error("Error initializing application:", error);
            // Try to show error to user
            const loadingScreen = document.getElementById('loading-screen');
            if (loadingScreen) {
                const loadingContent = loadingScreen.querySelector('.loading-content');
                if (loadingContent) {
                    loadingContent.innerHTML = `
                            <h1>Error</h1>
                            <p>Failed to initialize application: ${error.message}</p>
                        `;
                }
            }
            throw error; // Re-throw to prevent partial initialization
        }
    }

    // Handle pointer lock change at the document level
    document.addEventListener('pointerlockchange', onPointerLockChange, false);
    document.addEventListener('mozpointerlockchange', onPointerLockChange, false);
    document.addEventListener('webkitpointerlockchange', onPointerLockChange, false);

    // Handle pointer lock change
    function onPointerLockChange() {
        const isLocked = document.pointerLockElement === renderer.domElement ||
            document.mozPointerLockElement === renderer.domElement ||
            document.webkitPointerLockElement === renderer.domElement;

        // Update UI controller with pointer lock status
        if (typeof UIController !== 'undefined' && typeof UIController.updatePointerLockStatus === 'function') {
            UIController.updatePointerLockStatus(isLocked);
        }

        if (isLocked) {
            console.log("Pointer locked");

            // Try to force focus to remain on the canvas/container
            const container = document.getElementById('container');
            if (container) {
                container.focus();
            }

            // Show virtual cursor
            if (controlsUI && controlsUI.cursor) {
                controlsUI.cursor.style.opacity = '1';
            }

            // Highlight crosshair briefly to show activation
            if (controlsUI && controlsUI.center) {
                // Highlight the crosshair components
                const elements = controlsUI.center.querySelectorAll('div');
                elements.forEach(element => {
                    // Store original background color if not already stored
                    if (!element.dataset.originalColor) {
                        element.dataset.originalColor = element.style.backgroundColor;
                    }

                    // Brighten the element
                    element.style.backgroundColor = '#00FF00'; // Bright green
                    element.style.boxShadow = '0 0 5px #00FF00'; // Add glow effect
                });

                // Reset after a delay
                setTimeout(() => {
                    if (controlsUI && controlsUI.center) {
                        const elements = controlsUI.center.querySelectorAll('div');
                        elements.forEach(element => {
                            element.style.backgroundColor = element.dataset.originalColor || '#0f0';
                            element.style.boxShadow = 'none';
                        });
                    }
                }, 800);
            }

        } else {
            console.log("Pointer unlocked - Flight controls inactive");

            // Hide virtual cursor
            if (controlsUI && controlsUI.cursor) {
                controlsUI.cursor.style.opacity = '0';
            }
        }
    }

    // Handle window resize
    function onWindowResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    // Get the current forward direction for movement
    function getForwardVector() {
        const direction = new THREE.Vector3(0, 0, -1);
        direction.applyQuaternion(camera.quaternion);
        return direction;
    }

    // Get the current up vector
    function getUpVector() {
        const direction = new THREE.Vector3(0, 1, 0);
        direction.applyQuaternion(camera.quaternion);
        return direction;
    }

    // Get the current right vector
    function getRightVector() {
        const direction = new THREE.Vector3(1, 0, 0);
        direction.applyQuaternion(camera.quaternion);
        return direction;
    }

    function createControlsUI() {
        // Create a container for the control indicators
        const controlsUI = document.createElement('div');
        controlsUI.id = 'controls-ui';
        controlsUI.style.position = 'absolute';
        controlsUI.style.width = '100%';
        controlsUI.style.height = '100%';
        controlsUI.style.pointerEvents = 'none'; // Don't interfere with mouse events
        controlsUI.style.zIndex = '1000';

        // Create the center crosshair (replacing the circle indicator)
        const centerIndicator = document.createElement('div');
        centerIndicator.id = 'center-indicator';
        centerIndicator.style.position = 'absolute';
        centerIndicator.style.left = '50%';
        centerIndicator.style.top = '50%';
        centerIndicator.style.transform = 'translate(-50%, -50%)';
        centerIndicator.style.color = '#0f0'; // Bright green
        centerIndicator.style.zIndex = '1001'; // Ensure it's above other elements

        // Make a proper crosshair with horizontal and vertical lines
        // Horizontal line
        const horizontalLine = document.createElement('div');
        horizontalLine.style.position = 'absolute';
        horizontalLine.style.width = '16px';
        horizontalLine.style.height = '2px';
        horizontalLine.style.backgroundColor = '#0f0'; // Bright green
        horizontalLine.style.top = '50%';
        horizontalLine.style.left = '50%';
        horizontalLine.style.transform = 'translate(-50%, -50%)';
        centerIndicator.appendChild(horizontalLine);

        // Vertical line
        const verticalLine = document.createElement('div');
        verticalLine.style.position = 'absolute';
        verticalLine.style.width = '2px';
        verticalLine.style.height = '16px';
        verticalLine.style.backgroundColor = '#0f0'; // Bright green
        verticalLine.style.top = '50%';
        verticalLine.style.left = '50%';
        verticalLine.style.transform = 'translate(-50%, -50%)';
        centerIndicator.appendChild(verticalLine);

        // Add small dot in center
        const centerDot = document.createElement('div');
        centerDot.style.position = 'absolute';
        centerDot.style.width = '3px';
        centerDot.style.height = '3px';
        centerDot.style.backgroundColor = '#0f0'; // Bright green
        centerDot.style.borderRadius = '50%'; // Make it circular
        centerDot.style.top = '50%';
        centerDot.style.left = '50%';
        centerDot.style.transform = 'translate(-50%, -50%)';
        centerIndicator.appendChild(centerDot);

        controlsUI.appendChild(centerIndicator);

        // Create the virtual cursor indicator
        const virtualCursor = document.createElement('div');
        virtualCursor.id = 'virtual-cursor';
        virtualCursor.style.position = 'absolute';
        virtualCursor.style.width = '6px';
        virtualCursor.style.height = '6px';
        virtualCursor.style.border = '1px solid white';
        virtualCursor.style.backgroundColor = 'rgba(255, 100, 100, 0.7)';
        virtualCursor.style.borderRadius = '50%';
        virtualCursor.style.transform = 'translate(-50%, -50%)';
        virtualCursor.style.left = '50%';
        virtualCursor.style.top = '50%';
        virtualCursor.style.transition = 'opacity 0.3s ease';
        virtualCursor.style.opacity = '0'; // Hidden by default, shown when pointer is locked
        controlsUI.appendChild(virtualCursor);

        // Create deadzone indicator (subtle circle showing deadzone area)
        const deadzoneIndicator = document.createElement('div');
        deadzoneIndicator.id = 'deadzone-indicator';
        deadzoneIndicator.style.position = 'absolute';
        deadzoneIndicator.style.width = '20px'; // Will be updated based on actual deadzone
        deadzoneIndicator.style.height = '20px';
        deadzoneIndicator.style.border = '1px dashed rgba(200, 200, 200, 0.2)';
        deadzoneIndicator.style.borderRadius = '50%';
        deadzoneIndicator.style.transform = 'translate(-50%, -50%)';
        deadzoneIndicator.style.left = '50%';
        deadzoneIndicator.style.top = '50%';
        controlsUI.appendChild(deadzoneIndicator);

        // Add to container
        document.body.appendChild(controlsUI);

        return {
            container: controlsUI,
            center: centerIndicator,
            cursor: virtualCursor,
            deadzone: deadzoneIndicator
        };
    }

    function updateControlsUI() {
        if (!controls || !controlsUI) return;

        // Get current virtual mouse position
        const mousePos = controls.getVirtualMousePosition();
        if (!mousePos) return;

        // Only show the virtual cursor when pointer is locked
        if (document.pointerLockElement) {
            controlsUI.cursor.style.opacity = '1';

            // Update virtual cursor position
            controlsUI.cursor.style.left = `${mousePos.x}px`;
            controlsUI.cursor.style.top = `${mousePos.y}px`;

            // Update size of deadzone indicator
            const deadzone = controls.DEADZONE || 5;
            controlsUI.deadzone.style.width = `${deadzone * 2}px`;
            controlsUI.deadzone.style.height = `${deadzone * 2}px`;

            // Highlight cursor red if outside deadzone (active control)
            if (Math.abs(mousePos.offsetX) > deadzone || Math.abs(mousePos.offsetY) > deadzone) {
                controlsUI.cursor.style.backgroundColor = 'rgba(255, 50, 50, 0.7)';
            } else {
                controlsUI.cursor.style.backgroundColor = 'rgba(200, 200, 200, 0.5)';
            }
        } else {
            controlsUI.cursor.style.opacity = '0';
        }
    }

    window.debugControls = function () {
        if (!controls) return "Controls not initialized";

        // Get current state
        const mousePos = controls.getVirtualMousePosition();
        const rates = controls.getRotationRates();

        return {
            mouseOffset: mousePos ? {
                x: mousePos.offsetX.toFixed(1),
                y: mousePos.offsetY.toFixed(1)
            } : "Not available",
            rotationRates: rates ? {
                yaw: rates.yaw.toFixed(4),
                pitch: rates.pitch.toFixed(4)
            } : "Not available",
            deadzone: controls.DEADZONE || "Not set",
            sensitivity: controls.MOUSE_SENSITIVITY || "Not set"
        };
    };

    // Allow setting the mouse sensitivity
    window.setSensitivity = function (value) {
        if (!controls) return "Controls not initialized";
        if (typeof value !== 'number' || value <= 0)
            return "Sensitivity must be a positive number";

        controls.MOUSE_SENSITIVITY = value;
        return `Sensitivity set to ${value}`;
    };

    // Allow setting the deadzone
    window.setDeadzone = function (pixels) {
        if (!controls) return "Controls not initialized";
        if (typeof pixels !== 'number' || pixels < 0)
            return "Deadzone must be a non-negative number";

        controls.DEADZONE = pixels;
        return `Deadzone set to ${pixels} pixels`;
    };

    /**
     * Animation loop
     */

    /**
     * Handles the player respawn sequence.
     */
    function handleRespawn() {
        console.log("Handling respawn...");
        NetworkController.sendRespawnRequest();
        localPlayerHealth = 100; // it should be done anyways       
        // Reset ship controller state (velocity, etc.)
        if (typeof ShipController !== 'undefined' && ShipController.resetState) {
            ShipController.resetState();
        }

        // Reposition the ship near Earth
        const positionedNearEarth = positionShipNearEarth();
        if (!positionedNearEarth) {
            // Fallback to the previous method if we couldn't find Earth
            const cameraRig = controls.getObject();
            cameraRig.position.set(100, 10, 0);
            console.log("Using fallback position near Earth's orbit:", cameraRig.position);
        }




        // **Reinitialize the player's ship model if missing**
        if (!window.shipModel) {
            window.shipModel = addSpaceshipModel(camera);
            console.log("Reattached ship model after respawn");
        }

        // Re-enable controls
        if (controls) {
            controls.enabled = true;
            if (!document.pointerLockElement) {
                controls.lock();
            }
        }


        // Update HUD health and show cockpit elements
        //CombatHUD.updateHealth(100);

        console.log("Respawn sequence complete.");
    }

    function finalizeRespawn() {
        isGameOver = false;
    }

    function animate() {
        try {
            // Request next frame
            requestAnimationFrame(animate);

            // Calculate delta time
            const delta = clock.getDelta();
            const elapsedTime = clock.getElapsedTime();

            // Check HUD elements visibility once every 3 seconds
            const now = Date.now();

            // Check for game over state first
            if (isGameOver) {
                renderer.render(scene, camera); // Keep rendering scene, overlay is on top
                console.log("Game Over. Rendering game over screen.");
                return; // Skip main game updates if game over
            }

            // Check local player health (needs to be updated from network data)
            // TEMPORARY: Simulate health decrease for testing
            // if (Math.random() < 0.001) localPlayerHealth -= 10;

            // Check if local player died
            if (localPlayerHealth <= 0 && !isGameOver) {
                console.log("Local player health reached zero. Triggering Game Over.");
                isGameOver = true;

                let killSound = new Audio('soundfx/kill.mp3');
                killSound.volume = 0.85;
                killSound.play().catch(err => console.warn("Kill sound failed:", err));
                if (typeof ShipController !== 'undefined' && ShipController.resetState) {
                    ShipController.resetState();
                }
                if (controls) controls.enabled = false;
                // Exit pointer lock so key events are delivered.
                //if (document.exitPointerLock) {
                //document.exitPointerLock();
                //}
                console.log("DEBUG: Type of handleRespawn before passing:", typeof handleRespawn); // <-- ADD THIS
                console.log("Calling UIController.showGameOverScreen with callback:", handleRespawn);
                if (typeof UIController !== 'undefined' && UIController.showGameOverScreen) {
                    UIController.showGameOverScreen(handleRespawn);
                }
            }



            // Update camera controls with delta time
            if (controls && typeof controls.update === 'function') {
                controls.update(delta);
            }

            // Update ship controller if available
            if (typeof ShipController !== 'undefined' && ShipController.update) {
                ShipController.update(delta);
            }

            // Update laser system if available
            if (typeof LaserSystem !== 'undefined' && LaserSystem.update) {
                LaserSystem.update(delta);
            }

            // Get the camera rig and force update its matrix world
            if (controls && typeof controls.getObject === 'function') {
                const cameraRig = controls.getObject();
                cameraRig.updateMatrix();
                cameraRig.updateMatrixWorld(true);
            }

            // Update solar system dynamics if available
            if (typeof SolarSystem !== 'undefined' && SolarSystem.update) {
                const totalTime = clock.getElapsedTime();
                SolarSystem.update(delta, totalTime);
            }


            let playerObject = null;
            if (controls && typeof controls.getObject === 'function') {
                playerObject = controls.getObject();
            }

            if (playerObject && typeof SolarSystem !== 'undefined' && SolarSystem.getPlanets) {

                // Update player's simplified representation (Sphere)
                playerObject.getWorldPosition(reusablePlayerSphere.center); // Get current world position
                reusablePlayerSphere.radius = playerCollisionRadius;
    
                const celestialBodies = SolarSystem.getPlanets(); // Gets planets AND moons
    
                let collisionDetectedThisFrame = false;
    
                if (celestialBodies && celestialBodies.length > 0) {
                    for (const body of celestialBodies) {
                        // Basic sanity checks: ensure body exists, is visible, and has userData
                        if (!body || !body.visible || !body.userData) continue;
    
                        // --- Broad Phase: Distance Check using userData ---
                        body.getWorldPosition(reusableBodyPosition); // Get body's current world position
    
                        // Get radius directly from pre-defined scaled_diameter in userData
                        let bodyRadius = 0.5; // Default fallback radius
                        if (typeof body.userData.scaled_diameter === 'number') {
                            bodyRadius = body.userData.scaled_diameter / 2;
                        } else {
                         if (Math.random() < 0.001) { console.warn(`Missing scaled_diameter for ${body.userData.name}`); }
                        }
    
                        // Use squared distance for efficiency (avoids sqrt)
                        const collisionThreshold = reusablePlayerSphere.radius + bodyRadius + collisionBuffer;
                        const distanceSq = reusablePlayerSphere.center.distanceToSquared(reusableBodyPosition);
    
                        // --- Narrow Phase: Box Intersection (Only if close enough) ---
                        if (distanceSq <= collisionThreshold * collisionThreshold) {
    
                            // Perform the more detailed Box3 check using the reusable box
                            reusablePlanetBox.setFromObject(body); // Calculate precise AABB
    
                            // Check intersection between player Sphere and body Box3
                            if (reusablePlayerSphere.intersectsBox(reusablePlanetBox)) {
                                collisionDetectedThisFrame = true;
                                const bodyName = body.userData.name || "Unknown Body";
                                 console.log(`Collision detected with: ${bodyName}`); // Log the collision
    
                                if (!isCollidingWithPlanet) {
                                    isCollidingWithPlanet = true; // Set flag
                                } // End if (!isCollidingWithPlanet)
    
                                // Collision found and handled, stop checking other bodies this frame
                                break;
    
                            } // End if (intersectsBox)
                        } // End if (distance check passed)
                    } // End for loop (celestialBodies)
                } // End if (celestialBodies exist)
    
                // Reset the collision flag if no collision was detected *in this frame*
                if (!collisionDetectedThisFrame) {
                    isCollidingWithPlanet = false;
                }
            }
            // Update sun glow effect if sun exists
            if (sun && typeof CelestialBodies !== 'undefined' && typeof CelestialBodies.updateSunGlow === 'function') {
                CelestialBodies.updateSunGlow(sun, camera);
            }

            if (typeof updateControlsUI === 'function') {
                updateControlsUI();
            }

            // Update UI controller if available
            if (typeof UIController !== 'undefined' && UIController.update) {
                UIController.update(delta);
            }

            if (!MobileControls.isMobile) {
                if (typeof ShipController !== 'undefined' && typeof animateCockpitGForces === 'function') {
                    animateCockpitGForces(
                        ShipController.getMovementState(),
                        ShipController.getCurrentVelocity() // Use getCurrentVelocity which is in units/s
                    );
                }
            }

            if (typeof LaserSystem !== 'undefined' && LaserSystem.isFiring) {
                LaserSystem.fireLasers();
            }

            // Update camera projection matrix
            if (camera) {
                camera.updateProjectionMatrix();
            }

            // Safely update ExplorationHUD if it exists and is initialized
            if (typeof ExplorationHUD !== 'undefined') {
                // Check if update method exists
                if (typeof ExplorationHUD.update === 'function') {
                    try {
                        ExplorationHUD.update(delta);
                    } catch (error) {
                        console.error("Error updating ExplorationHUD:", error);

                        // If we get an error about hudContainer being null, try to reinitialize
                        if ((error.message && error.message.includes("hudContainer is null")) ||
                            error.message.includes("Cannot read properties of null")) {
                            console.log("Attempting to reinitialize ExplorationHUD...");
                            if (camera && renderer && scene) {
                                ExplorationHUD.init({ camera, renderer, scene });
                                ExplorationHUD.show();
                            } else {
                                console.error("Cannot reinitialize ExplorationHUD - missing camera, renderer, or scene");
                            }
                        }
                    }
                } else {
                    console.warn("ExplorationHUD.update is not a function");
                }
            }

            // Safely update CombatHUD if it exists and is initialized
            if (typeof CombatHUD !== 'undefined') {
                // Check if update method exists
                if (typeof CombatHUD.update === 'function') {
                    try {
                        CombatHUD.update(delta);
                    } catch (error) {
                        console.error("Error updating CombatHUD:", error);

                        // If we get an error about hudContainer being null, try to reinitialize
                        if ((error.message && error.message.includes("hudContainer is null")) ||
                            error.message.includes("Cannot read properties of null")) {
                            console.log("Attempting to reinitialize CombatHUD...");
                            if (camera && renderer && scene) {
                                CombatHUD.init({ camera, renderer, scene });
                                // Don't show by default, only in combat mode
                            } else {
                                console.error("Cannot reinitialize CombatHUD - missing camera, renderer, or scene");
                            }
                        }
                    }
                } else {
                    console.warn("CombatHUD.update is not a function");
                }
            }

            if (isCollidingWithPlanet) {
                console.log("Colliding with planet");
            }

            MobileControls.updateMobileControls(delta);

            if (renderer && scene && camera) {
                renderer.render(scene, camera);
            }
        } catch (error) {
            console.error("Error in animation loop:", error);
        }
    }

    // Add global debug function for console logs
    window.debugApp = function () {
        return {
            isInitialized: !!scene && !!camera && !!renderer,
            isPointerLocked: document.pointerLockElement === renderer?.domElement,
            Controls: controls ? {
                sensitivity: controls.MOUSE_SENSITIVITY,
                deadzone: controls.DEADZONE,
                mousePosition: controls.getVirtualMousePosition ? controls.getVirtualMousePosition() : "Not available",
                rotationRates: controls.getRotationRates ? controls.getRotationRates() : "Not available"
            } : "Not initialized",
            shipController: {
                velocity: ShipController.getVelocity(),
                currentVelocity: ShipController.getCurrentVelocity(),
                movementState: ShipController.getMovementState()
            },
            laserSystem: {
                isFiring: LaserSystem?.isFiring,
                fireLaser: function () {
                    if (LaserSystem && typeof LaserSystem.fireLasers === 'function') {
                        console.log("Manually firing lasers from debug console");
                        LaserSystem.fireLasers();
                        return "Firing lasers";
                    }
                    return "LaserSystem not available";
                }
            }
        };
    };

    // Add missing logDebugCommands function
    function logDebugCommands() {
        console.log("%c Crusader X Debug Commands:", "font-weight: bold; font-size: 16px; color: #00AAFF");
        console.log("%c - debugApp(): Show current app state", "color: #00AAFF");
        console.log("%c - debugControls(): Show control state", "color: #00AAFF");
        console.log("%c - setSensitivity(value): Set mouse sensitivity", "color: #00AAFF");
        console.log("%c - setDeadzone(pixels): Set deadzone size", "color: #00AAFF");
        console.log("%c - testRotate(x, y): Directly rotate camera (x=yaw, y=pitch)", "color: #00AAFF");
        console.log("%c - debugMouseMove(x, y): Simulate mouse movement", "color: #00AAFF");
        console.log("%c - setRotationRates(yaw, pitch): Set rotation rates", "color: #00AAFF");
        console.log("%c - checkRotations(): Check Euler angles and rotation order", "color: #00AAFF");
    }

    function addSpaceshipModel(camera) {
        // Create a group that will represent the player's ship.
        const shipGroup = new THREE.Group();
        shipGroup.name = "PlayerShipGroup";

        // Load the GLB model (replace 'models/enemyShip.glb' with your model path)
        const loader = new THREE.GLTFLoader();
        loader.load(
            'models/spaceShip1.glb',
            (gltf) => {
                const model = gltf.scene;
                model.name = "PlayerShipModel";

                // Scale the model as needed (adjust the scale values per your model)
                model.scale.set(0.009, 0.009, 0.009);

                // Check if the model already contains laser emitter nodes.
                // If not, add them programmatically at the desired local positions.
                let leftEmitter = model.getObjectByName("LeftLaserEmitter");
                if (!leftEmitter) {
                    leftEmitter = new THREE.Object3D();
                    leftEmitter.name = "LeftLaserEmitter";
                    // Set local position for the left emitter (adjust these values as needed)
                    leftEmitter.position.set(3.1, -0.5, 0);
                    model.add(leftEmitter);
                }
                let rightEmitter = model.getObjectByName("RightLaserEmitter");
                if (!rightEmitter) {
                    rightEmitter = new THREE.Object3D();
                    rightEmitter.name = "RightLaserEmitter";
                    // Set local position for the right emitter (adjust these values as needed)
                    rightEmitter.position.set(-3.1, -0.5, 0);
                    model.add(rightEmitter);
                }

                model.traverse((child) => {
                    if (child.isMesh) {
                        child.material = new THREE.MeshBasicMaterial({
                            color: 0xff0000, // bright red for debugging
                            wireframe: false, // set to true if you want wireframe view
                        });
                    }
                });

                // Add the loaded model to the ship group.
                shipGroup.add(model);

                // Optionally adjust the ship group's position relative to the camera if needed.
                // For a cockpit view you might want the model to be slightly behind the camera's origin.
                shipGroup.position.set(0, 0, -0.036);

                // Now, attach the ship group to the camera so it moves with you.
                camera.add(shipGroup);

                // Save a global reference for the LaserSystem.
                window.shipModel = shipGroup;
                console.log("Ship model loaded and attached to camera");
            },
            undefined,
            (errorEvent) => {
                console.error("Error loading ship model:", errorEvent);
                if (errorEvent && errorEvent.target) {
                    console.error("Status:", errorEvent.target.status);
                    console.error("Response Text:", errorEvent.target.responseText);
                }
                // Optionally create a fallback ship model here.
            }
        );

        return shipGroup;
    }

    // Add cockpit overlay to the display
    function addCockpitOverlay() {
        try {
            // Create cockpit overlay container
            const cockpitContainer = document.createElement('div');
            cockpitContainer.id = 'cockpit-overlay';
            cockpitContainer.style.position = 'fixed';
            cockpitContainer.style.top = '0';
            cockpitContainer.style.left = '0';
            cockpitContainer.style.width = '100%';
            cockpitContainer.style.height = '100%';
            cockpitContainer.style.pointerEvents = 'none'; // Allow clicks to pass through
            cockpitContainer.style.zIndex = '10'; // Above scene but below UI

            // Create the cockpit image
            const cockpitImage = document.createElement('img');
            cockpitImage.id = 'cockpit-image';
            cockpitImage.src = 'images/cockpit.png';
            cockpitImage.style.objectFit = 'cover';
            cockpitImage.style.position = 'absolute';

            if (MobileControls.isMobile) {
                // On mobile: fill the viewport exactly without extra transforms.
                cockpitImage.style.width = '100%';
                cockpitImage.style.height = '100%';
                cockpitImage.style.top = '0';
                cockpitImage.style.left = '0';
                cockpitImage.style.transform = 'none';
                cockpitImage.style.transition = 'none';
            } else {
                // Desktop default: slightly oversized and centered.
                cockpitImage.style.width = '105%';
                cockpitImage.style.height = '105%';
                cockpitImage.style.top = '50%';
                cockpitImage.style.left = '50%';
                cockpitImage.style.transform = 'translate(-50%, -50%)';
                cockpitImage.style.transition = 'width 0.3s ease-out, height 0.3s ease-out';
            }

            // Ensure the image always covers the viewport.
            cockpitImage.style.minWidth = '100vw';
            cockpitImage.style.minHeight = '100vh';

            cockpitContainer.appendChild(cockpitImage);
            document.body.appendChild(cockpitContainer);

            console.log("Cockpit overlay added");
        } catch (error) {
            console.error("Error adding cockpit overlay:", error);
        }
    }


    /**
     * Animate the cockpit to simulate G-forces during acceleration and deceleration
     * @param {Object} movementState - The current movement state (forward/backward)
     * @param {Number} currentVelocity - The current velocity
     */
    function animateCockpitGForces(movementState, currentVelocity) {
        try {
            const cockpitImage = document.getElementById('cockpit-image');
            if (!cockpitImage) return;

            // Default state (no acceleration/deceleration)
            const defaultSize = '105%';
            // Acceleration (pulled in effect)
            const accelerationSize = '100%';
            // Deceleration (pushed out effect)
            const decelerationSize = '110%';

            // Calculate animation speed based on velocity
            // Faster at high speeds, slower at low speeds
            const transitionDuration = Math.max(0.1, Math.min(0.5, 0.5 - (currentVelocity / 200000)));
            cockpitImage.style.transition = `width ${transitionDuration}s ease-out, height ${transitionDuration}s ease-out`;

            if (movementState.forward) {
                // Acceleration - pulled in effect (looking forward)
                cockpitImage.style.width = accelerationSize;
                cockpitImage.style.height = accelerationSize;
            } else if (movementState.backward) {
                // Deceleration - pushed out effect (pressed back)
                cockpitImage.style.width = decelerationSize;
                cockpitImage.style.height = decelerationSize;
            } else {
                // No thrust - return to default
                cockpitImage.style.width = defaultSize;
                cockpitImage.style.height = defaultSize;
            }
        } catch (error) {
            console.error("Error animating cockpit G-forces:", error);
        }
    }



    // Export the public API for the App module
    return {
        init: init,
        getLocalPlayerHealth: function () { return localPlayerHealth; },
        setLocalPlayerHealth: function (newHealth) { localPlayerHealth = newHealth; },
        finalizeRespawn() { isGameOver = false; },
        getCamera: function () {
            return camera;
        },
        getControls: function () {
            return controls;
        },
        getScene: function () {
            // Return the scene object for use by other modules
            return scene;
        },
        getRenderer: function () {
            // Return the scene object for use by other modules
            return renderer;
        },
        debugPointerLock: function () {
            console.log("Pointer lock status:",
                document.pointerLockElement === renderer.domElement ? "Locked" : "Unlocked");

            if (controls) {
                console.log("Controls object exists");
                if (typeof controls.getDirection === 'function') {
                    const direction = controls.getDirection().clone();
                    console.log("Looking direction:", direction);
                }
            } else {
                console.log("Controls object is missing!");
            }
        }
    };
})();

// Initialize the app when all resources are loaded
window.addEventListener('load', function () {
    try {
        // Initialize components in proper sequence
        App.init();

        // The HUDs are now initialized in initializeAfterIntro
        // No need to initialize them again here

        // Log some debug commands that can be used in the console
        console.log("DEBUG COMMANDS:");
        console.log(" - testRotate(x, y): Directly rotate camera (x=yaw, y=pitch)");
        console.log(" - debugMouseMove(x, y): Simulate mouse movement");
        console.log(" - setRotationRates(yaw, pitch): Set rotation rates");
        console.log(" - checkRotations(): Check Euler angles and rotation order");
    } catch (error) {
        console.error("Failed to initialize application:", error);
    }
});

/**
 * Initialize background music
 */
function initBackgroundMusic() {
    try {
        // Create background music element
        const backgroundMusic = document.createElement('audio');
        backgroundMusic.src = 'music/aldebaran.mp3';
        backgroundMusic.id = 'background-music';
        backgroundMusic.loop = true;
        backgroundMusic.volume = 0.3; // Start at a reasonable volume
        document.body.appendChild(backgroundMusic);

        console.log("Background music initialized");
        return backgroundMusic;
    } catch (error) {
        console.error("Error initializing background music:", error);
        return null;
    }
}

// Function to show reconnection message with counter
function showReconnectionMessage() {
    const reconnectMsg = document.getElementById('reconnect-message');
    if (reconnectMsg) {
        reconnectMsg.textContent = 'Connection lost. Attempting to reconnect...';
        reconnectMsg.style.display = 'block';
    }
}

// Add a function to preload assets during intro screen
function preloadAssets() {
    try {
        console.log("Preloading critical assets...");

        // Preload cockpit image
        const cockpitPreloader = new Image();
        cockpitPreloader.src = 'images/cockpit.png';
        cockpitPreloader.onload = () => console.log("Cockpit image preloaded");
        cockpitPreloader.onerror = (err) => console.error("Error preloading cockpit image:", err);

        // Preload and prepare background music
        const backgroundMusic = document.getElementById('background-music');
        if (backgroundMusic) {
            backgroundMusic.volume = 0.3;
            backgroundMusic.load(); // Start loading the audio file
            console.log("Background music preloading started");
        } else {
            // Create the background music element if it doesn't exist
            const newBackgroundMusic = document.createElement('audio');
            newBackgroundMusic.src = 'music/aldebaran.mp3';
            newBackgroundMusic.id = 'background-music';
            newBackgroundMusic.loop = true;
            newBackgroundMusic.volume = 0.3;
            newBackgroundMusic.load(); // Start loading the audio file
            document.body.appendChild(newBackgroundMusic);
            console.log("Background music element created and preloading started");
        }
    } catch (error) {
        console.error("Error preloading assets:", error);
    }
}

// New function to initialize the HUDs
function initializeHUDs(camera, renderer, scene) {
    try {
        console.log("Initializing HUDs with parameters:",
            "camera:", camera ? "defined" : "undefined",
            "renderer:", renderer ? "defined" : "undefined",
            "scene:", scene ? "defined" : "undefined");

        if (!camera || !renderer || !scene) {
            throw new Error("Missing required parameters for HUD initialization");
        }

        // Initialize ExplorationHUD if available
        if (typeof ExplorationHUD !== 'undefined' && typeof ExplorationHUD.init === 'function') {
            console.log("Initializing ExplorationHUD...");
            ExplorationHUD.init({
                camera: camera,
                renderer: renderer,
                scene: scene
            });
            console.log("ExplorationHUD initialized successfully");
        } else {
            console.warn("ExplorationHUD module not available");
        }

        // Initialize CombatHUD if available
        if (typeof CombatHUD !== 'undefined' && typeof CombatHUD.init === 'function') {
            console.log("Initializing CombatHUD...");
            CombatHUD.init({
                camera: camera,
                renderer: renderer,
                scene: scene
            });
            console.log("CombatHUD initialized successfully");
        } else {
            console.warn("CombatHUD module not available");
        }

        // Explicitly call show/hide AFTER initialization is complete
        // This ensures we don't try to call these functions from inside init
        try {
            // Initially show the exploration HUD and hide the combat HUD
            if (typeof ExplorationHUD !== 'undefined' && typeof ExplorationHUD.show === 'function') {
                console.log("Calling ExplorationHUD.show() directly");
                ExplorationHUD.show();
                console.log("ExplorationHUD shown");
            }

            if (typeof CombatHUD !== 'undefined' && typeof CombatHUD.hide === 'function') {
                console.log("Calling CombatHUD.hide() directly");
                CombatHUD.hide();
                console.log("CombatHUD hidden");
            }
        } catch (showHideError) {
            console.error("Error showing/hiding HUDs:", showHideError);
        }

        // Log success
        console.log("HUDs initialized successfully");
    } catch (error) {
        console.error("Error initializing HUDs:", error);
        throw error; // Re-throw to prevent partial initialization
    }
} 