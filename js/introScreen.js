/**
 * introScreen.js - Initial loading screen with ship customization
 * Handles user ship color selection and nickname entry before game start
 * Designed to be responsive for both mobile and desktop.
 */

const IntroScreen = (function() {
  'use strict';

  // DOM elements
  let introContainer = null;
  let shipContainer = null;
  let colorPicker = null;
  let nicknameInput = null;
  let engageButton = null;

  // 3D elements
  let scene = null;
  let camera = null;
  let renderer = null;
  let shipModel = null;
  let animationFrameId = null; // To control animation loop

  // Ship customization data
  let selectedColor = 0xFF0000; // Default red
  let nickname = "";
  const COLORS = [
      { name: 'red', hex: 0xFF0000 },
      { name: 'green', hex: 0x00FF00 },
      { name: 'blue', hex: 0x0000FF },
      { name: 'pink', hex: 0xFF69B4 },
      { name: 'yellow', hex: 0xFFFF00 },
      { name: 'purple', hex: 0x800080 }
  ];
  const MAX_NAME_LENGTH = 12;
  const DESKTOP_BREAKPOINT = 768; // Width in pixels to consider "desktop" for scaling

  /**
   * Initialize the intro screen
   */
  function init() {
      console.log("IntroScreen initializing...");
      preloadGameAssets();

      if (shouldBypassIntro()) {
          console.log("Bypassing intro screen via URL parameters.");
          return;
      }

      console.log("Creating intro screen UI...");
      createIntroScreen();
      setup3DScene(); // Setup scene structure

      // *** Crucial: Call resize *after* initial setup and DOM insertion ***
      // This ensures the renderer/camera use the actual calculated container size
      onWindowResize();

      loadShipModel();
      createColorPicker();
      createNicknameField();
      createEngageButton();
      startAnimation(); // Start the animation loop

      window.addEventListener('resize', onWindowResize);

      if (introContainer) {
          introContainer.style.display = 'flex'; // Make it visible
      }
      console.log("IntroScreen initialization complete.");
  }

  /**
   * Preload game assets while intro screen is showing
   */
  function preloadGameAssets() {
    try {
        console.log("Preloading game assets...");

        // Preload cockpit image
        const cockpitPreloader = new Image();
        cockpitPreloader.src = 'images/cockpit.png';
        cockpitPreloader.onload = () => console.log("Cockpit image preloaded.");
        cockpitPreloader.onerror = () => console.error("Failed to preload cockpit image.");

        // Preload background music
        let music = document.getElementById('background-music');
        if (!music) {
            console.log("Creating background music element.");
            music = document.createElement('audio');
            music.id = 'background-music';
            music.src = 'music/aldebaran.mp3';
            music.loop = true;
            music.volume = 0.3;
            document.body.appendChild(music);
        }
        music.load();
        console.log("Background music loading initiated.");

        // Preload ship model (best effort)
        if (typeof THREE !== 'undefined' && typeof THREE.GLTFLoader === 'function') {
            const loader = new THREE.GLTFLoader();
            loader.load('models/spaceShip1.glb',
                () => console.log("Player ship model preloaded successfully."),
                undefined,
                (error) => console.warn("Failed to preload ship model (will load later):", error)
            );
        } else {
            console.warn("THREE.GLTFLoader not available for preloading models at this stage.");
        }

        // Preload skybox images
        const skyboxImages = [
            'images/skybox/Starfield_right1.png',  // px
            'images/skybox/Starfield_left2.png',   // nx
            'images/skybox/Starfield_top3.png',    // py
            'images/skybox/Starfield_bottom4.png', // ny
            'images/skybox/Starfield_front5.png',  // pz
            'images/skybox/Starfield_back6.png'    // nz
        ];

        skyboxImages.forEach((src) => {
            const img = new Image();
            img.src = src;
            img.onload = () => console.log(`Skybox image ${src} preloaded.`);
            img.onerror = () => console.error(`Failed to preload skybox image ${src}.`);
        });
    } catch (error) {
        console.error("Error during asset preloading:", error);
    }
}


  /**
   * Create the intro screen container and structure with responsive styling
   */
  function createIntroScreen() {
      introContainer = document.createElement('div');
      introContainer.id = 'intro-screen';
      Object.assign(introContainer.style, {
          position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
          display: 'none', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.9)', zIndex: '9999',
          fontFamily: '"Orbitron", sans-serif', color: '#0af',
          textShadow: '0 0 10px rgba(0, 170, 255, 0.7)',
          overflowY: 'auto', padding: 'max(15px, 3vh) max(15px, 3vw)',
          position: 'fixed' // Ensuring the container is fixed for absolute positioning of children
      });

      const title = document.createElement('h1');
      title.textContent = 'CRUSADER X';
      Object.assign(title.style, {
          fontSize: 'clamp(28px, 8vw, 60px)', marginBottom: 'clamp(15px, 4vh, 30px)',
          letterSpacing: 'clamp(2px, 0.5vw, 5px)', textAlign: 'center', textTransform: 'uppercase'
      });
      introContainer.appendChild(title);

      shipContainer = document.createElement('div');
      shipContainer.id = 'ship-container';
      Object.assign(shipContainer.style, {
          width: 'clamp(280px, 80vw, 600px)', maxWidth: '100%',
          aspectRatio: '3 / 2', marginBottom: 'clamp(15px, 4vh, 30px)',
          position: 'relative',
          // *** CHANGE: Set background to solid black ***
          backgroundColor: '#000000',
          borderRadius: '8px',
          overflow: 'hidden' // Hide anything spilling out of the container (like initial render glitches)
      });
      introContainer.appendChild(shipContainer);

      document.body.appendChild(introContainer);

      // Add the "source code" link in the bottom-right corner of the intro screen.
      addSourceCodeLink();
  }

  /**
   * Add a "source code" link at the bottom right of the intro screen.
   */
  function addSourceCodeLink() {
    const sourceLink = document.createElement('a');
    sourceLink.href = 'https://crusaderx.fonearcade.com/source.zip';
    sourceLink.textContent = 'source code';
    sourceLink.target = '_blank'; // Open link in a new tab
    Object.assign(sourceLink.style, {
        position: 'absolute',
        bottom: '10px',
        left: '10px', // Moved to the left-hand side
        fontSize: '10px',
        color: '#0af',
        textDecoration: 'none',
        zIndex: '10000'
    });
    introContainer.appendChild(sourceLink);
}

  /**
   * Set up the 3D scene, adjusting to the container size
   */
  function setup3DScene() {
    if (!shipContainer) {
        console.error("Ship container not found for 3D scene setup.");
        return;
    }

    // Initial dimensions might be 0 here if called too early relative to CSS calc
    // onWindowResize called after this in init() will fix it.
    const initialWidth = shipContainer.clientWidth || 300; // Use fallback if 0
    const initialHeight = shipContainer.clientHeight || 200; // Use fallback if 0

    scene = new THREE.Scene();
    scene.background = null; // Keep canvas transparent

    camera = new THREE.PerspectiveCamera(50, initialWidth / initialHeight, 0.1, 1000);
    camera.position.z = 8; // Keep camera position the same for now

    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(initialWidth, initialHeight); // Set initial size
    renderer.outputEncoding = THREE.sRGBEncoding; // Good for color accuracy

    // *** ADJUSTED LIGHTING ***

    // 1. Ambient Light: Slightly reduce its intensity or make it a bit darker
    scene.add(new THREE.AmbientLight(0x555555, 0.9)); // Slightly darker gray, slightly less intense

    // 2. Directional Light: Significantly reduce intensity.
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.7); // Reduced intensity
    directionalLight.position.set(5, 10, 7.5); // Keep position
    scene.add(directionalLight);

    // 3. Point Light: Reduce intensity.
    const pointLight = new THREE.PointLight(0x00aaff, 0.5, 50); // Reduced intensity
    pointLight.position.set(-5, -3, 5); // Keep position
    scene.add(pointLight);

    // *** END ADJUSTED LIGHTING ***

    shipContainer.appendChild(renderer.domElement);
    console.log(`3D scene structure set up.`);
  }

  /**
   * Load the ship model using GLTFLoader
   */
  function loadShipModel() {
      const loadingText = document.createElement('div');
      loadingText.textContent = 'LOADING SHIP...';
      Object.assign(loadingText.style, {
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)', color: '#0af',
          fontSize: 'clamp(14px, 3vw, 18px)', zIndex: '1'
      });
      if (shipContainer) {
          shipContainer.appendChild(loadingText);
      }

      ensureGLTFLoader().then(() => {
          const loader = new THREE.GLTFLoader();
          loader.load(
              'models/spaceShip1.glb',
              (gltf) => { // Success
                  if (loadingText.parentNode) loadingText.parentNode.removeChild(loadingText);
                  shipModel = gltf.scene;
                  console.log("Ship model loaded successfully.");

                  // *** CHANGE: Responsive Scaling ***
                  const box = new THREE.Box3().setFromObject(shipModel);
                  const center = box.getCenter(new THREE.Vector3());
                  const size = box.getSize(new THREE.Vector3());
                  const maxDim = Math.max(size.x, size.y, size.z);

                  // Determine scale factor based on container width
                  const containerWidth = shipContainer.clientWidth;
                  const baseFitFactor = 8.0; // Base factor for smaller screens
                  const desktopFitFactor = 28.5; // Larger factor for desktops

                  const fitFactor = containerWidth >= DESKTOP_BREAKPOINT ? desktopFitFactor : baseFitFactor;
                  const scale = fitFactor / maxDim;
                  console.log(`Container width: ${containerWidth}, Using fitFactor: ${fitFactor}, Scale: ${scale.toFixed(2)}`);

                  shipModel.scale.set(scale, scale, scale);
                  shipModel.position.sub(center.multiplyScalar(scale)); // Center model

                  updateShipColor(selectedColor, true); // Apply initial color
                  scene.add(shipModel);
                  onWindowResize(); 

                  // *** Force a render call AFTER adding the model ***
                  if (renderer && scene && camera) {
                      renderer.render(scene, camera);
                      console.log("Initial render performed after model load.");
                  }
              },
              (xhr) => { // Progress
                  const percent = Math.floor((xhr.loaded / xhr.total) * 100);
                  loadingText.textContent = `LOADING SHIP... ${percent}%`;
              },
              (error) => { // Error
                  console.error("Error loading ship model:", error);
                  if (loadingText) {
                      loadingText.textContent = 'LOAD ERROR';
                      loadingText.style.color = 'red';
                  }
              }
          );
      }).catch(error => {
          console.error("GLTFLoader setup failed:", error);
          if (loadingText) {
              loadingText.textContent = 'LOADER ERROR';
              loadingText.style.color = 'red';
          }
      });
  }

  // Helper to ensure THREE.GLTFLoader is available (unchanged)
  function ensureGLTFLoader() {
      return new Promise((resolve, reject) => {
          if (typeof THREE !== 'undefined' && typeof THREE.GLTFLoader === 'function') {
              resolve(); return;
          }
          console.log("THREE.GLTFLoader not found, attempting to load...");
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/three@0.138.3/examples/js/loaders/GLTFLoader.js';
          script.async = true;
          script.onload = () => {
              if (typeof THREE !== 'undefined' && typeof THREE.GLTFLoader === 'function') {
                  console.log("GLTFLoader loaded successfully."); resolve();
              } else { reject(new Error("GLTFLoader script loaded but THREE.GLTFLoader is still not defined.")); }
          };
          script.onerror = (err) => { console.error("Failed to load GLTFLoader script:", err); reject(new Error("Failed to load GLTFLoader script.")); };
          document.head.appendChild(script);
      });
  }

  /**
   * Create the color picker elements (unchanged)
   */
  function createColorPicker() {
      const label = document.createElement('div');
      label.textContent = 'SELECT SHIP COLOR';
      Object.assign(label.style, {
          marginBottom: '10px', textAlign: 'center', fontSize: 'clamp(16px, 3.5vw, 20px)'
      });

      colorPicker = document.createElement('div');
      colorPicker.id = 'color-picker';
      Object.assign(colorPicker.style, {
          display: 'flex', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap',
          gap: 'clamp(8px, 2vw, 15px)', marginBottom: 'clamp(20px, 5vh, 35px)'
      });

      COLORS.forEach(color => {
          const colorOption = document.createElement('div');
          colorOption.classList.add('color-option');
          colorOption.dataset.color = color.hex;
          colorOption.dataset.colorName = color.name;
          Object.assign(colorOption.style, {
              width: 'clamp(30px, 8vw, 45px)', height: 'clamp(30px, 8vw, 45px)',
              backgroundColor: `#${color.hex.toString(16).padStart(6, '0')}`,
              borderRadius: '50%', cursor: 'pointer', border: '3px solid transparent',
              transition: 'transform 0.2s ease-out, border-color 0.2s ease-out',
              boxShadow: '0 2px 5px rgba(0,0,0,0.3)'
          });

          if (color.hex === selectedColor) {
              colorOption.style.borderColor = '#0af';
              colorOption.style.transform = 'scale(1.15)';
          }

          colorOption.addEventListener('click', () => {
              selectedColor = color.hex;
              updateShipColor(selectedColor);
              document.querySelectorAll('.color-option').forEach(option => {
                  option.style.borderColor = 'transparent';
                  option.style.transform = 'scale(1)';
              });
              colorOption.style.borderColor = '#0af';
              colorOption.style.transform = 'scale(1.15)';
          });
          colorPicker.appendChild(colorOption);
      });

      introContainer.insertBefore(label, shipContainer.nextSibling);
      introContainer.insertBefore(colorPicker, label.nextSibling);
  }

  /**
   * Create the nickname input field (unchanged)
   */
  function createNicknameField() {
      const label = document.createElement('div');
      label.textContent = 'ENTER CALLSIGN';
      Object.assign(label.style, { marginBottom: '10px', textAlign: 'center', fontSize: 'clamp(16px, 3.5vw, 20px)' });

      const inputContainer = document.createElement('div');
      Object.assign(inputContainer.style, { marginBottom: 'clamp(20px, 5vh, 35px)', position: 'relative', width: 'clamp(250px, 70vw, 350px)', maxWidth: '90%' });

      nicknameInput = document.createElement('input');
      nicknameInput.type = 'text';
      nicknameInput.maxLength = MAX_NAME_LENGTH;
      nicknameInput.placeholder = `Pilot Name (Max ${MAX_NAME_LENGTH})`;
      Object.assign(nicknameInput.style, {
          padding: 'clamp(10px, 2vh, 15px) 15px', width: '100%', boxSizing: 'border-box',
          backgroundColor: 'rgba(0, 30, 60, 0.7)', border: '2px solid #0af', borderRadius: '5px',
          color: '#fff', fontSize: 'clamp(14px, 3.5vw, 18px)', textAlign: 'center', outline: 'none',
          transition: 'border-color 0.3s, box-shadow 0.3s'
      });

      nicknameInput.addEventListener('focus', () => { nicknameInput.style.borderColor = '#0ef'; nicknameInput.style.boxShadow = '0 0 10px rgba(0, 170, 255, 0.5)'; });
      nicknameInput.addEventListener('blur', () => { nicknameInput.style.borderColor = '#0af'; nicknameInput.style.boxShadow = 'none'; });
      nicknameInput.addEventListener('input', () => {
          let currentVal = nicknameInput.value;
          let sanitizedVal = currentVal.replace(/[^\w\s\-]/g, '');
          sanitizedVal = sanitizedVal.trimStart().substring(0, MAX_NAME_LENGTH);
          if (nicknameInput.value !== sanitizedVal) nicknameInput.value = sanitizedVal;
          nickname = sanitizedVal.trim();
          if (nicknameInput.style.borderColor === 'red') { nicknameInput.style.borderColor = '#0ef'; nicknameInput.classList.remove('shake-error'); }
      });

      introContainer.appendChild(label);
      inputContainer.appendChild(nicknameInput);
      introContainer.appendChild(inputContainer);
  }

  /**
   * Create the engage button (unchanged)
   */
  function createEngageButton() {
      engageButton = document.createElement('button');
      engageButton.textContent = 'ENGAGE';
      Object.assign(engageButton.style, {
          padding: 'clamp(12px, 2.5vh, 18px) clamp(30px, 6vw, 50px)', fontSize: 'clamp(16px, 4vw, 22px)',
          backgroundColor: '#0af', color: '#001', border: 'none', borderRadius: '6px', cursor: 'pointer',
          fontFamily: '"Orbitron", sans-serif', fontWeight: 'bold', letterSpacing: '2px', textTransform: 'uppercase',
          transition: 'background-color 0.3s, transform 0.2s, box-shadow 0.3s',
          boxShadow: '0 0 15px rgba(0, 170, 255, 0.4)', marginTop: '10px'
      });

      const engageHoverFocus = () => { engageButton.style.backgroundColor = '#0ef'; engageButton.style.transform = 'scale(1.05)'; engageButton.style.boxShadow = '0 0 25px rgba(0, 200, 255, 0.7)'; };
      const engageMouseOutBlur = () => { engageButton.style.backgroundColor = '#0af'; engageButton.style.transform = 'scale(1)'; engageButton.style.boxShadow = '0 0 15px rgba(0, 170, 255, 0.4)'; };

      engageButton.addEventListener('mouseover', engageHoverFocus);
      engageButton.addEventListener('focus', engageHoverFocus);
      engageButton.addEventListener('mouseout', engageMouseOutBlur);
      engageButton.addEventListener('blur', engageMouseOutBlur);
      engageButton.addEventListener('click', onEngageClick);

      introContainer.appendChild(engageButton);
  }

  /**
   * Handle engage button click (unchanged)
   */
  function onEngageClick() {
      nickname = nicknameInput.value.trim();
      if (!nickname) {
          console.warn("Nickname is empty.");
          nicknameInput.style.borderColor = 'red';
          nicknameInput.classList.add('shake-error');
          setTimeout(() => { nicknameInput.classList.remove('shake-error'); }, 500);
          return;
      }

      engageButton.disabled = true;
      engageButton.style.opacity = '0.7';
      engageButton.textContent = 'ENGAGING...';
      console.log(`Engaging with Nickname: ${nickname}, Color: #${selectedColor.toString(16)}`);

      introContainer.style.transition = 'opacity 0.7s ease-out';
      introContainer.style.opacity = '0';

      const colorIndex = COLORS.findIndex(color => color.hex === selectedColor);
      window.playerData = { nickname: nickname, colorIndex: colorIndex >= 0 ? colorIndex : 0, colorHex: selectedColor };
      console.log("Player data set:", window.playerData);

      setTimeout(() => {
          stopAnimation();
          window.removeEventListener('resize', onWindowResize);
          if (renderer) {
              renderer.dispose();
              if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
              renderer = null; scene = null; camera = null; shipModel = null;
          }
          if (introContainer && introContainer.parentNode) {
              introContainer.parentNode.removeChild(introContainer);
              introContainer = null;
          }
          const event = new CustomEvent('introComplete', { detail: window.playerData });
          document.dispatchEvent(event);
          console.log("introComplete event dispatched.");
      }, 700);
  }

  /**
   * Update the ship model color (unchanged)
   */
  function updateShipColor(color, isInitial = false) {
      if (!shipModel) return;
      const newColor = new THREE.Color(color);
      shipModel.traverse((child) => {
          if (child.isMesh && child.material) {
              if (Array.isArray(child.material)) {
                  child.material.forEach(mat => { if (mat.color) mat.color.set(newColor); });
              } else if (child.material.color) {
                  child.material.color.set(newColor);
              }
              if (isInitial && !child.userData.originalMaterial) child.userData.originalMaterial = child.material.clone();
          }
      });
  }

  /**
   * Start/Stop/Run Animation loop (unchanged)
   */
  function startAnimation() { if (!animationFrameId) animate(); }
  function stopAnimation() { if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null; console.log("Animation loop stopped."); } }
  function animate() {
      animationFrameId = requestAnimationFrame(animate);
      if (shipModel) {
          const time = Date.now() * 0.0005;
          shipModel.rotation.y = time;
          shipModel.rotation.x = Math.sin(time * 0.7) * 0.15;
          shipModel.rotation.z = Math.cos(time * 0.5) * 0.1;
      }
      if (renderer && scene && camera) renderer.render(scene, camera);
  }

  /**
   * Handle window resize - update camera and renderer based on ship container size (unchanged from previous responsive version)
   */
  function onWindowResize() {
      if (!introContainer || !shipContainer || !camera || !renderer) return;

      const containerWidth = shipContainer.clientWidth;
      const containerHeight = shipContainer.clientHeight;

      if (containerWidth === 0 || containerHeight === 0) {
          console.warn("onWindowResize: Container dimensions are zero. Retrying shortly...");
          return;
      }

      camera.aspect = containerWidth / containerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(containerWidth, containerHeight);
      renderer.setPixelRatio(window.devicePixelRatio);
      console.log(`Resized 3D view to: ${containerWidth}x${containerHeight}`);

      // *** CHANGE: Re-apply scaling on resize if model exists ***
      if (shipModel) {
          const box = new THREE.Box3().setFromObject(shipModel);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);

          if (maxDim > 0) {
              const baseFitFactor = 7.0;
              const desktopFitFactor = 9.5;
              const fitFactor = containerWidth >= DESKTOP_BREAKPOINT ? desktopFitFactor : baseFitFactor;
              const scale = fitFactor / maxDim;

              console.log(`Resizing - Container width: ${containerWidth}, Using fitFactor: ${fitFactor}, New Scale: ${scale.toFixed(2)}`);

              // Store current rotation before scaling/positioning
              const currentRotation = shipModel.rotation.clone();

              shipModel.scale.set(scale, scale, scale);
              shipModel.position.set(0,0,0).sub(center.multiplyScalar(scale));
              shipModel.rotation.copy(currentRotation);
          }
      }
  }

  /**
   * Get the current player data (unchanged)
   */
  function getPlayerData() {
      const colorIndex = COLORS.findIndex(color => color.hex === selectedColor);
      return { nickname: nickname, colorIndex: colorIndex >= 0 ? colorIndex : 0, colorHex: selectedColor };
  }

  // --- URL Parameter Handling ---

  function getClosestColor(targetHex) {
    const targetRGB = {
      r: (targetHex >> 16) & 0xff,
      g: (targetHex >> 8) & 0xff,
      b: targetHex & 0xff
    };
    let closest = COLORS[0];
    let minDiff = Infinity;
    COLORS.forEach(color => {
      const r = (color.hex >> 16) & 0xff;
      const g = (color.hex >> 8) & 0xff;
      const b = color.hex & 0xff;
      const diff = Math.sqrt(
          Math.pow(r - targetRGB.r, 2) +
          Math.pow(g - targetRGB.g, 2) +
          Math.pow(b - targetRGB.b, 2)
      );
      if (diff < minDiff) {
        minDiff = diff;
        closest = color;
      }
    });
    return closest.hex;
  }

  function shouldBypassIntro() {
    try {
        const params = new URLSearchParams(window.location.search);
        if (params.get('portal') === 'true' && params.has('username')) {
            console.log("Portal parameters detected.");

            let username = params.get('username').trim();
            username = username.replace(/[^\w\s\-]/g, '').substring(0, MAX_NAME_LENGTH);
            if (!username) {
                console.warn("Username from URL is invalid after sanitization, using default.");
                username = `Pilot_${Math.floor(Math.random() * 900 + 100)}`;
            }

            let urlColor = params.get('color');
            let finalSelectedColor;
            if (urlColor) {
                urlColor = urlColor.replace(/^#/, '');
                const parsedColor = parseInt(urlColor, 16);
                if (!isNaN(parsedColor)) {
                    const exactMatch = COLORS.find(c => c.hex === parsedColor);
                    if (exactMatch) {
                        finalSelectedColor = exactMatch.hex;
                    } else {
                        finalSelectedColor = getClosestColor(parsedColor);
                        console.log(`Color #${urlColor} not exact match, using closest: #${finalSelectedColor.toString(16)}`);
                    }
                } else {
                    console.warn(`Invalid color parameter '${params.get('color')}', choosing random.`);
                    finalSelectedColor = COLORS[Math.floor(Math.random() * COLORS.length)].hex;
                }
            } else {
                console.log("No color parameter provided, choosing random.");
                finalSelectedColor = COLORS[Math.floor(Math.random() * COLORS.length)].hex;
            }

            let initialSpeed = 0;
            const speedParam = params.get('speed');
             if (speedParam) {
                const parsedSpeed = parseInt(speedParam.split('.')[0], 10);
                 if (!isNaN(parsedSpeed) && parsedSpeed >= 0 && parsedSpeed < 500000) {
                    initialSpeed = parsedSpeed;
                    console.log(`Initial speed set from URL: ${initialSpeed}`);
                 } else {
                    console.warn(`Invalid or out-of-range speed parameter '${speedParam}', using default 0.`);
                 }
            }

            const colorIndex = COLORS.findIndex(c => c.hex === finalSelectedColor);
            window.playerData = {
                nickname: username,
                colorIndex: colorIndex >= 0 ? colorIndex : 0,
                colorHex: finalSelectedColor
            };
            console.log("Bypass player data set:", window.playerData);

            setTimeout(() => {
                if (typeof ShipController !== 'undefined' && typeof ShipController.setInitialVelocity === 'function') {
                    ShipController.setInitialVelocity(initialSpeed);
                    console.log("Initial velocity set via ShipController.");
                } else {
                    console.warn("ShipController or setInitialVelocity not available to set speed from URL.");
                    window.initialPlayerData = { ...window.playerData, initialSpeed: initialSpeed };
                }
            }, 100);

            setTimeout(() => {
                const event = new CustomEvent('introComplete', { detail: window.playerData });
                document.dispatchEvent(event);
                console.log("introComplete event dispatched (from bypass).");
            }, 50);

            return true;
        }
    } catch (e) {
      console.error("Error processing URL parameters:", e);
    }
    return false;
  }

  // --- Add necessary CSS for animations ---
  function addStyles() {
    const styleId = 'intro-screen-styles';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-6px); }
        20%, 40%, 60%, 80% { transform: translateX(6px); }
      }

      .shake-error {
        animation: shake 0.5s ease-in-out;
      }

      /* Ensure Orbitron font is loaded */
      @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&display=swap');

      #intro-screen ::placeholder {
          color: rgba(255, 255, 255, 0.5);
          opacity: 1;
      }
      #intro-screen :-ms-input-placeholder {
         color: rgba(255, 255, 255, 0.5);
      }
      #intro-screen ::-ms-input-placeholder {
         color: rgba(255, 255, 255, 0.5);
      }
    `;
    document.head.appendChild(style);
  }

  // Initialize styles immediately
  addStyles();

  // --- Public API ---
  return {
    init: init,
    getPlayerData: getPlayerData,
    COLORS: COLORS
  };

})();

// --- Initialization Trigger ---
let introScreenInitialized = false;
function initializeIntroScreen() {
    if (!introScreenInitialized) {
        introScreenInitialized = true;
        setTimeout(() => {
            IntroScreen.init();
        }, 50);
    }
}

if (typeof module === 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeIntroScreen);
    } else {
        initializeIntroScreen();
    }
} else {
    console.log("IntroScreen loaded in a module environment. Manual initialization might be required.");
    // export default IntroScreen;
}
