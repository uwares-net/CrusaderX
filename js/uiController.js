/**
 * uiController.js - Manages global UI interactions
 * (We've removed all the purely "exploration HUD" code into explorationHUD.js)
 */

"use strict";

const UIController = (function() {

  // DOM elements cache
  let domElements = {};
  
  // Pointer lock references
  let camera = null;
  let renderer = null;

  // Current game mode
  let currentMode = "EXPLORATION";

  let helpPageOverlay = null; 
  let creditsPageOverlay = null; 

  
  /**
   * Initialize the UI controller
   * @param {THREE.WebGLRenderer} rendererRef - The renderer
   * @param {THREE.Camera} cameraRef - The camera
   * @returns {HTMLElement} The container element or null
   */
  function init(rendererRef, cameraRef) {
    try {
      console.log("Initializing UIController (global UI only)...");

      // Store references
      renderer = rendererRef;
      camera = cameraRef;

      // Grab container
      const container = document.getElementById("container");
      if (!container) {
        console.error("Container not found!");
        return null;
      }
      
      // Cache only the minimal DOM elements needed for global UI
      domElements = {
        hud: document.getElementById("hud"),
        modeIndicator: document.getElementById("mode-indicator"),
        musicToggleButton: document.getElementById("music-toggle"),
        loadingScreen: document.getElementById("loading-screen"),
        modeOverlay: document.getElementById("mode-overlay"),
      };
      createHelpPage();
      createCreditsPage(); 
      // Make sure the HUD is at least visible if needed (though the main HUD logic is in explorationHUD.js)
      if (domElements.hud) {
        domElements.hud.style.display = "block";
        domElements.hud.style.visibility = "visible";
      }

      return container;
    } catch (error) {
      console.error("Error initializing UI Controller:", error);
      return null;
    }
  }
  
  /**
   * Toggle background music
   */
  function toggleMusic() {
    let backgroundMusic = document.getElementById("background-music");
    if (!backgroundMusic) {
      backgroundMusic = new Audio("music/aldebaran.mp3");
      backgroundMusic.loop = true;
      backgroundMusic.volume = 0.5;
      backgroundMusic.id = "background-music";
      document.body.appendChild(backgroundMusic);
    }
    
    const isMusicPlaying = !backgroundMusic.paused;
    if (isMusicPlaying) {
      backgroundMusic.pause();
      if (domElements.musicToggleButton) {
        domElements.musicToggleButton.textContent = "Play Music";
      }
    } else {
      backgroundMusic.play().catch(e => console.error("Error playing music:", e));
      if (domElements.musicToggleButton) {
        domElements.musicToggleButton.textContent = "Pause Music";
      }
    }
  }
  
  /**
   * Update pointer lock status display
   * @param {boolean} isLocked
   */
  function updatePointerLockStatus(isLocked) {
    try {
      if (!domElements.modeIndicator) return;
      // If mode is EXPLORATION vs. COMBAT, change text
      domElements.modeIndicator.textContent = isLocked
        ? (currentMode === "EXPLORATION" ? "Exploration Mode" : "Combat Mode")
        : "Click to Activate Controls";

      // Start music if pointer lock acquired
      if (isLocked) {
        playMusic();
      }
    } catch (error) {
      console.error("Error updating pointer lock status:", error);
    }
  }
  
  /**
   * Play music (called from updatePointerLockStatus)
   */
  function playMusic() {
    try {
      const music = document.getElementById("background-music");
      if (music) {
        music.volume = 0.3;
        music.loop = true;
        const playPromise = music.play();
        if (playPromise !== undefined) {
          playPromise.then(_ => {
            console.log("Music playback started successfully");
          }).catch(err => {
            console.warn("Music playback was prevented:", err);
          });
        }
      } else {
        // create music element if missing
        const backgroundMusic = new Audio("music/aldebaran.mp3");
        backgroundMusic.id = "background-music";
        backgroundMusic.loop = true;
        backgroundMusic.volume = 0.3;
        document.body.appendChild(backgroundMusic);
        backgroundMusic.play().catch(e => console.warn("Auto-play prevented:", e));
      }
    } catch (error) {
      console.error("Error playing music:", error);
    }
  }

  /**
   * Show or hide loading screen
   */
  function showLoadingScreen() {
    if (domElements.loadingScreen) {
      domElements.loadingScreen.style.display = "flex";
    }
  }
  function hideLoadingScreen() {
    if (domElements.loadingScreen) {
      domElements.loadingScreen.style.display = "none";
    }
  }
  
  /**
   * Show a temporary overlay with the current mode
   * @param {string} mode 
   */
  function showModeOverlay(mode) {
    try {
      // Remove any existing overlay
      const existingOverlay = document.getElementById("mode-overlay");
      if (existingOverlay) existingOverlay.remove();

      const overlay = document.createElement("div");
      overlay.id = "mode-overlay";
      overlay.style.position = "fixed";
      overlay.style.top = "50%";
      overlay.style.left = "50%";
      overlay.style.transform = "translate(-50%, -50%)";
      overlay.style.padding = "20px 40px";
      overlay.style.background = "rgba(0,0,0,0.7)";
      overlay.style.color = (mode === "EXPLORATION" ? "#0ff" : "#f88");
      overlay.style.fontSize = "24px";
      overlay.style.borderRadius = "10px";
      overlay.style.zIndex = "2000";
      overlay.style.transition = "opacity 0.5s ease";
      overlay.style.opacity = "0";
      overlay.textContent = `MODE: ${mode}`;
      document.body.appendChild(overlay);

      setTimeout(() => {
        overlay.style.opacity = "1";
      }, 10);

      setTimeout(() => {
        overlay.style.opacity = "0";
        setTimeout(() => { overlay.remove(); }, 500);
      }, 2500);

      console.log(`Mode overlay shown: ${mode}`);
    } catch (error) {
      console.error("Error showing mode overlay:", error);
    }
  }
  
  /**
   * Toggle between exploration and combat modes
   */
  function toggleGameMode() {
    try {
      currentMode = (currentMode === "EXPLORATION") ? "COMBAT" : "EXPLORATION";
      console.log(`Game mode toggled to: ${currentMode}`);

      if (currentMode === "COMBAT") {
        ExplorationHUD.hide();
        CombatHUD.show();
      } else {
        CombatHUD.hide();
        ExplorationHUD.show();
    }

  // Update the modeIndicator here so it reflects the current mode
  if (domElements.modeIndicator) {
    domElements.modeIndicator.textContent = currentMode === "EXPLORATION" ? "Exploration Mode" : "Combat Mode";
  }
      showModeOverlay(currentMode);
    } catch (err) {
      console.error("Error toggling game mode:", err);
    }
  }

  function getHUDmode() {
    return currentMode;
  }
  
  /**
   * Simple setMode if you want it
   */
  function setMode(mode) {
    if (mode !== "EXPLORATION" && mode !== "COMBAT") {
      console.error("Invalid mode:", mode);
      return;
    }
    currentMode = mode;
    console.log("UI Mode changed to:", mode);

    // Optionally update modeIndicator text
    if (domElements.modeIndicator) {
      domElements.modeIndicator.textContent = mode;
    }
    // If you want to always show #hud
    if (domElements.hud) {
      domElements.hud.style.display = "block";
      domElements.hud.style.visibility = "visible";
    }
  }
  
  /**
   * The main update function, though we don't do exploration HUD logic here anymore
   */
  function update(deltaTime) {
    // Possibly update other global UI pieces if needed
  }
  
  /**
   * Display a notification to the user
   * @param {string} message - The message to display
   * @param {number} duration - The duration in milliseconds (default: 3000)
   */
  function showNotification(message, duration = 3000) {
    try {
      // Create notification element if it doesn't exist
      if (typeof message === 'string' && message.includes('id:')) {
        message = message.replace(/id:\s*\w+/g, '').trim();
      }
    
      let notification = document.getElementById('notification');
      
      if (!notification) {
        notification = document.createElement('div');
        notification.id = 'notification';
        notification.style.position = 'fixed';
        notification.style.bottom = '20px';
        notification.style.left = '50%';
        notification.style.transform = 'translateX(-50%)';
        notification.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        notification.style.color = '#fff';
        notification.style.padding = '10px 20px';
        notification.style.borderRadius = '5px';
        notification.style.fontFamily = 'Arial, sans-serif';
        notification.style.zIndex = '1000';
        notification.style.transition = 'opacity 0.5s';
        document.body.appendChild(notification);
      }
      
      // Set message and show notification
      notification.textContent = message;
      notification.style.opacity = '1';
      
      // Hide after duration
      setTimeout(() => {
        notification.style.opacity = '0';
      }, duration);
    } catch (error) {
      console.error("Error showing notification:", error);
    }
  }
  
  /**
   * Creates a temporary red flash effect over the screen.
   */
  function flashDamageIndicator() {
    let flashElement = document.getElementById('damage-flash-overlay');
    if (flashElement) {
      // If already flashing, reset animation/timer (optional)
      return; // Or maybe restart the fade out
    }

    flashElement = document.createElement('div');
    flashElement.id = 'damage-flash-overlay';
    flashElement.style.position = 'fixed';
    flashElement.style.top = '0';
    flashElement.style.left = '0';
    flashElement.style.width = '100%';
    flashElement.style.height = '100%';
    flashElement.style.backgroundColor = 'rgba(255, 0, 0, 0.4)'; // Semi-transparent red
    flashElement.style.zIndex = '1999'; // Below mode overlay, above HUDs
    flashElement.style.pointerEvents = 'none';
    flashElement.style.opacity = '1';
    flashElement.style.transition = 'opacity 0.3s ease-out'; // Fade out transition

    document.body.appendChild(flashElement);

    // Start fade out shortly after adding
    setTimeout(() => {
      if (flashElement) { // Check if element still exists
        flashElement.style.opacity = '0';
      }
    }, 50); // Start fade after 50ms

    // Remove element after transition completes
    setTimeout(() => {
      if (flashElement && flashElement.parentNode) {
        flashElement.parentNode.removeChild(flashElement);
      }
    }, 350); // 50ms delay + 300ms transition = 350ms total
  }
  
  /**
   * Shows the Game Over screen with animations.
   */
  function showGameOverScreen(respawnCallback) {
    console.log("DEBUG: Type of respawnCallback received:", typeof respawnCallback);
  
    if (document.getElementById('game-over-overlay')) return;
    
    console.log("UIController.showGameOverScreen called with respawnCallback:", respawnCallback);
    
    const callback = respawnCallback;
    
    // Create overlay container
    const overlay = document.createElement('div');
    overlay.id = 'game-over-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    overlay.style.zIndex = '25000';
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.5s ease-in';
    
    // Create fixed "GAME OVER" text with a separate blinking underscore.
    const gameOverText = document.createElement('div');
    gameOverText.id = 'game-over-text';
    gameOverText.style.fontFamily = '"Orbitron", sans-serif';
    gameOverText.style.fontSize = '72px'; // Desktop default remains 72px.
    gameOverText.style.color = '#ff0000';
    gameOverText.style.textShadow = '2px 2px 4px black';
    gameOverText.style.marginBottom = '30px';
    const baseText = "GAME OVER";
    gameOverText.innerHTML = baseText + '<span id="blinking-underscore" style="display:inline-block; width:1em;">_</span>';
    
    // Create respawn instruction text.
    const respawnText = document.createElement('div');
    respawnText.id = 'respawn-text';
    respawnText.style.fontFamily = '"Orbitron", sans-serif';
    respawnText.style.fontSize = '24px';
    respawnText.style.color = '#ffffff';
    respawnText.style.textShadow = '1px 1px 2px black';
    respawnText.textContent = 'Press any key to respawn';
    respawnText.style.opacity = '0';
    respawnText.style.transition = 'opacity 0.5s ease-in 1s';
    
    // Mobile-specific adjustments: reduce GAME OVER size and change instruction text.
    if (MobileControls.isMobile) {
      gameOverText.style.fontSize = '48px'; // Smaller for mobile.
      respawnText.textContent = 'Tap the screen to respawn';
    }
    
    overlay.appendChild(gameOverText);
    overlay.appendChild(respawnText);
    document.body.appendChild(overlay);
    
    // Fade in the overlay.
    setTimeout(() => { overlay.style.opacity = '1'; }, 10);
    
    // Common function to handle respawn events.
    function onRespawn(e) {
      console.log("Respawn event detected:", e.type);
      hideGameOverScreen();
      if (typeof callback === 'function') {
        console.log("Calling respawn callback.");
        callback();
      } else {
        console.log("No respawn callback provided.");
      }
    }
    
    // Attach the keydown listener.
    window.addEventListener('keydown', onRespawn, { once: true });
    
    // Also attach a touchstart listener for mobile devices.
    if (MobileControls.isMobile) {
      overlay.addEventListener('touchstart', onRespawn, { once: true });
    }
    
    // Start blinking the underscore after a delay (simulate typing)
    setTimeout(() => {
      const underscoreSpan = document.getElementById('blinking-underscore');
      if (!underscoreSpan) return; // Element not found, exit the callback
      let visible = true;
      const blinkIntervalId = setInterval(() => {
        visible = !visible;
        underscoreSpan.style.visibility = visible ? 'visible' : 'hidden';
        console.log("Blinking underscore, visibility:", visible);
      }, 500);
      overlay.dataset.blinkIntervalId = blinkIntervalId;
      respawnText.style.opacity = '1';
    }, baseText.length * 150 + 100);    
  }
  
  
  
  
  
  function hideGameOverScreen() {
    const overlay = document.getElementById('game-over-overlay');
    if (overlay) {
      if (overlay.dataset.blinkIntervalId) clearInterval(overlay.dataset.blinkIntervalId);
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 0.3s ease-out';
      // Do not call removeEventListener here because the listener was added inline.
      setTimeout(() => {
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
      }, 300);
    }
  }
  
  
  

  /**
   * Handles the key press to respawn.
   */
  function handleRespawnKey() {
      console.log("Respawn key pressed.");
      hideGameOverScreen();
      // Ensure NetworkController and its function are available
      if (typeof NetworkController !== 'undefined' && typeof NetworkController.sendRespawnRequest === 'function') {
          NetworkController.sendRespawnRequest();
          // Optionally re-enable controls if they were disabled
      } else {
          console.error("NetworkController.sendRespawnRequest is not available!");
      }
  }

  /**
   * Creates the help page overlay and content, initially hidden.
   */
    function createHelpPage() {
      if (document.getElementById('help-page-overlay')) return;

      helpPageOverlay = document.createElement('div');
      helpPageOverlay.id = 'help-page-overlay';
      // Basic overlay styles (background, position, z-index, etc.)
      Object.assign(helpPageOverlay.style, {
          position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
          backgroundColor: 'rgba(0, 0, 20, 0.85)', zIndex: '29000', display: 'none',
          justifyContent: 'center', alignItems: 'center', opacity: '0',
          transition: 'opacity 0.3s ease-in-out', fontFamily: 'Arial, sans-serif'
      });

      const helpContent = document.createElement('div');
      helpContent.id = 'help-page-content';
      // Content container styles
      Object.assign(helpContent.style, {
          backgroundColor: 'rgba(10, 20, 40, 0.9)', padding: '30px 40px', borderRadius: '10px',
          border: '1px solid #00ffff', maxWidth: '700px', maxHeight: '80vh', overflowY: 'auto',
          color: '#e0f2ff', boxShadow: '0 0 15px rgba(0, 255, 255, 0.5)'
      });

      // --- Help Page Content - UPDATED LAYOUT using Flexbox ---
      helpContent.innerHTML = `
          <h2 style="text-align: center; color: #00ffff; margin-bottom: 20px; font-family: 'Orbitron', sans-serif; letter-spacing: 2px;">HELP / CONTROLS</h2>
          <p style="text-align: center; margin-bottom: 25px; font-style: italic; line-height: 1.5;">
              Welcome to Crusader X! You can choose to explore the solar system or enjoy a multiplayer dogfight. Change to combat mode for a better multi-player experience.
              If you came here via a portal, the entrance portal is on your left at spawn. The exit portal is on your right. Also, planets/moons are exit portals.  Enjoy!
          </p>

          <div style="display: flex; gap: 30px; flex-wrap: wrap;"> <!-- Main Flex Container for Columns -->

              <!-- Left Column (Mouse & System) -->
              <div style="flex: 1; min-width: 250px;">
                  <div>
                      <h3 style="color: #00ffff; margin-bottom: 10px; border-bottom: 1px solid #00ffff80; padding-bottom: 5px;">MOUSE</h3>
                      <ul style="list-style: none; padding-left: 0;">
                          <li style="margin-bottom: 8px;"><strong style="color: #ffffff; min-width: 80px; display: inline-block;">Look/Aim:</strong> Move Mouse</li>
                          <li style="margin-bottom: 8px;"><strong style="color: #ffffff; min-width: 80px; display: inline-block;">Fire Laser:</strong> Left Click</li>
                      </ul>
                  </div>

                  <div style="margin-top: 25px;"> <!-- Add some space between Mouse and System -->
                      <h3 style="color: #00ffff; margin-bottom: 10px; border-bottom: 1px solid #00ffff80; padding-bottom: 5px;">SYSTEM</h3>
                      <ul style="list-style: none; padding-left: 0;">
                          <li style="margin-bottom: 8px;"><kbd>G</kbd> - Toggle Combat/Exploration Mode</li>
                          <li style="margin-bottom: 8px;"><kbd>M</kbd> - Toggle Background Music</li>
                          <li style="margin-bottom: 8px;"><kbd>Tab</kbd> - Show Kills Table <em style="font-size: 0.8em; color: #aaa;">(Hold)</em></li>
                          <li style="margin-bottom: 8px;"><kbd>H</kbd> - Show This Help <em style="font-size: 0.8em; color: #aaa;">(Hold)</em></li>
                          <li style="margin-bottom: 8px;"><kbd>C</kbd> - Show Credits <em style="font-size: 0.8em; color: #aaa;">(Hold)</em></li>
                          <li style="margin-bottom: 8px;"><kbd>M</kbd> - Toggle Music <em style="font-size: 0.8em; color: #aaa;"></em></li>

                          </ul>
                  </div>
              </div>

              <!-- Right Column (Movement) -->
              <div style="flex: 1; min-width: 250px;">
                  <div>
                      <h3 style="color: #00ffff; margin-bottom: 10px; border-bottom: 1px solid #00ffff80; padding-bottom: 5px;">MOVEMENT</h3>
                      <ul style="list-style: none; padding-left: 0;">
                          <li style="margin-bottom: 8px;"><kbd>W</kbd> - Thrust Forward</li>
                          <li style="margin-bottom: 8px;"><kbd>S</kbd> - Thrust Backward / Decelerate</li>
                          <li style="margin-bottom: 8px;"><kbd>A</kbd> - Roll Left <em style="font-size: 0.8em; color: #aaa;"></em></li>
                          <li style="margin-bottom: 8px;"><kbd>D</kbd> - Roll Right <em style="font-size: 0.8em; color: #aaa;"></em></li>
                          <li style="margin-bottom: 8px;"><kbd>Space</kbd> - Fire Laser <em style="font-size: 0.8em; color: #aaa;">(Combat Mode)</em></li>
                          <!-- V key removed -->
                      </ul>
                  </div>
              </div>

          </div> <!-- End Main Flex Container -->
      `;
      // --- End Help Page Content ---

      helpPageOverlay.appendChild(helpContent);
      document.body.appendChild(helpPageOverlay);
      console.log("Help page overlay created with flex layout.");
  }

/**
 * Shows the help page with a fade-in effect.
 */
function showHelpPage() {
    if (!helpPageOverlay) {
         console.warn("Help page overlay not found, creating...");
         createHelpPage(); // Create if missing
         if (!helpPageOverlay) return; // Still couldn't create
    }
    helpPageOverlay.style.display = 'flex';
    // Use a tiny timeout to allow the display change to register before starting transition
    setTimeout(() => {
        helpPageOverlay.style.opacity = '1';
    }, 10);
     console.log("Showing help page.");
}

/**
 * Hides the help page with a fade-out effect.
 */
function hideHelpPage() {
    if (!helpPageOverlay) return;
    helpPageOverlay.style.opacity = '0';
    // Set display to none only after the transition completes
    setTimeout(() => {
        helpPageOverlay.style.display = 'none';
    }, 300); // Match the transition duration
    console.log("Hiding help page.");
}

function createCreditsPage() {
  if (document.getElementById('credits-page-overlay')) return; // Don't create if exists

  creditsPageOverlay = document.createElement('div');
  creditsPageOverlay.id = 'credits-page-overlay';
  // Style similar to Help/KillsTable overlay
  Object.assign(creditsPageOverlay.style, {
      position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
      backgroundColor: 'rgba(0, 0, 20, 0.85)', zIndex: '28000',
      display: 'none', justifyContent: 'center', alignItems: 'center',
      opacity: '0', transition: 'opacity 0.3s ease-in-out',
      fontFamily: 'Arial, sans-serif' // Default font for the list
  });

  const creditsContent = document.createElement('div');
  creditsContent.id = 'credits-page-content';
  // Style similar to Help content box
  Object.assign(creditsContent.style, {
      backgroundColor: 'rgba(10, 20, 40, 0.9)', padding: '30px 40px', borderRadius: '10px',
      border: '1px solid #00ffff', maxWidth: '600px',
      maxHeight: '80vh', overflowY: 'auto', color: '#e0f2ff',
      boxShadow: '0 0 15px rgba(0, 255, 255, 0.5)', lineHeight: '1.7'
  });

  // --- Credits Page Content - UPDATED STRUCTURE & FLAGS ---
  creditsContent.innerHTML = `
      <h2 style="text-align: center; color: #00ffff; margin-bottom: 30px; font-family: 'Orbitron', sans-serif; letter-spacing: 2px; text-transform: uppercase;">Credits</h2>

      <!-- Contributors Section with Flexbox for alignment -->
      <div style="margin-bottom: 30px;">
          <div style="display: flex; align-items: baseline; margin-bottom: 10px;">
              <span style="color: #ffffff; font-weight: bold; width: 150px; flex-shrink: 0;">Code by:</span>
              <span>AI & Mike</span>
          </div>
          <div style="display: flex; align-items: baseline;">
              <span style="color: #ffffff; font-weight: bold; width: 150px; flex-shrink: 0;">GFX & Sound by:</span>
              <span>AI & Jean</span>
          </div>
          <div style="margin-top: 10px; text-align: left;">
              <span style="color: #ffffff;">Follow us on twitter: <a href="https://x.com/UwaresBlocks" target="_blank" rel="noopener noreferrer" style="color: #00ffff;">https://x.com/UwaresBlocks</a></span>
          </div>
      </div>

      <h3 style="color: #00ffff; margin-top: 30px; margin-bottom: 15px; font-family: 'Orbitron', sans-serif; border-bottom: 1px solid #00ffff80; padding-bottom: 8px; text-transform: uppercase;">Libraries Used & Special Thanks</h3>
      <ul style="list-style: none; padding-left: 5px; font-size: 0.95em;">
          <li style="margin-bottom: 12px;">
              <strong style="color: #ffffff;">three.js</strong><br>
              Copyright © 2010-${new Date().getFullYear()} three.js authors<br>
              <em style="color: #aaa;">Licensed under the MIT License</em>
          </li>
          <li style="margin-bottom: 12px;">
              <strong style="color: #ffffff;">Geckos.io</strong> by Yoann Fleury<br>
              <em style="color: #aaa;">Licensed under the BSD 3-Clause License</em>
          </li>
          <li style="margin-bottom: 12px;">
              <strong style="color: #ffffff;">nipplejs</strong> by Yoann Moine<br>
              <em style="color: #aaa;">Licensed under the MIT License</em>
          </li>
          <li style="margin-bottom: 12px;">
              <strong style="color: #ffffff;">Spacescape (skybox)</strong> by Alex Peterson<br>
              <em style="color: #aaa;">Licensed under the MIT License</em>
          </li>
          <li style="margin-bottom: 12px;">
              <strong style="color: #ffffff;">Planetary Textures</strong><br>
              Provided by <a href="https://www.solarsystemscope.com/textures/" target="_blank" rel="noopener noreferrer">www.solarsystemscope.com</a>
          </li>

      </ul>
  `;
  // --- End Credits Page Content ---

  creditsPageOverlay.appendChild(creditsContent);
  document.body.appendChild(creditsPageOverlay);
  console.log("Credits page overlay created.");
}


/**
* Shows the credits page with a fade-in effect.
*/
function showCreditsPage() {
  if (!creditsPageOverlay) createCreditsPage();
  if (!creditsPageOverlay) return; // Still couldn't create
  creditsPageOverlay.style.display = 'flex';
  setTimeout(() => { creditsPageOverlay.style.opacity = '1'; }, 10);
  console.log("Showing credits page.");
}

/**
* Hides the credits page with a fade-out effect.
*/
function hideCreditsPage() {
  if (!creditsPageOverlay) return;
  creditsPageOverlay.style.opacity = '0';
  setTimeout(() => { creditsPageOverlay.style.display = 'none'; }, 300);
  console.log("Hiding credits page.");
}
  // Return public API
  return {
    init,
    update,
    toggleMusic,
    showLoadingScreen,
    hideLoadingScreen,
    showModeOverlay,
    toggleGameMode,
    setMode,
    updatePointerLockStatus,
    showNotification,
    flashDamageIndicator,
    showGameOverScreen,
    hideGameOverScreen,
    showHelpPage,
    hideHelpPage,
    showCreditsPage,
    hideCreditsPage
  };
})(); 
