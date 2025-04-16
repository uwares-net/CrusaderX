/**
 * networkController.js - Manages multiplayer networking using geckos.io UDP
 * Handles player connections, state synchronization, and multiplayer events
 */

const NetworkController = (function() {
    'use strict';
  
    // Private variables
    let channel = null;
    let isConnected = false;
    let playerId = null;
    let players = {};
    let onPlayerUpdateCallback = null;
    let onPlayerJoinedCallback = null;
    let onPlayerLeftCallback = null;
    let controlsReference = null; // Store local reference to controls
    let reconnectTimer = null; // Timer for reconnection attempts
    let reconnectAttempts = 0;
    const MAX_RECONNECT_DELAY = 30000; // Maximum backoff delay: 30 seconds
    let lastConnectionOptions = null; // Store the last connection options for reconnecting
    let isReconnecting = false; // Flag to track if we're in reconnection mode
  
    // Configuration
    const DEFAULT_SERVER_URL = 'http://fonearcade.com:6198';
    const DEFAULT_UPDATES_PER_SECOND = 10; // Default to 10 updates per second
    let updatesPerSecond = DEFAULT_UPDATES_PER_SECOND;
    let syncIntervalId = null;
    
    // Debugging
    const DEBUG = false; // Enable verbose debugging
  
    // For rendering other players in the scene
    let enemyShips = {};
    let scene = null;

    // For makeing sure we are not using the first player update
    let ignoreFirstPlayerUpdate = true;
    let localPlayerPrevHealth = 100; 
    /**
     * Debug logging function
     * @param {string} message - Message to log
     * @param {Object} data - Optional data to log
     * @private
     */
    function logDebug(message, data) {
      if (!DEBUG) return;
      if (data) {
        console.log(`[NetworkController] ${message}`, data);
      } else {
        console.log(`[NetworkController] ${message}`);
      }
    }
  
    function sendLaserFire(laserData) {
        if (isConnected && channel) {
            channel.emit('laserFire', laserData);
        }
    }
    
    /**
     * Initialize the network controller
     * @param {Object} options - Configuration options
     * @param {string} options.serverUrl - Server URL to connect to
     * @param {Function} options.onConnect - Callback when connected
     * @param {Function} options.onDisconnect - Callback when disconnected
     * @param {Function} options.onPlayerUpdate - Callback when other players update
     * @param {Function} options.onPlayerJoined - Callback when a new player joins
     * @param {Function} options.onPlayerLeft - Callback when a player leaves
     * @param {THREE.Scene} options.scene - Three.js scene for rendering player models
     * @param {Object} options.controls - Controls object for player position and rotation
     * @param {number} options.updatesPerSecond - Number of position updates to send per second (default: 10)
     * @returns {boolean} Success status
     */
    function init(options = {}) {
      try {
        const serverUrl = options.serverUrl || DEFAULT_SERVER_URL;
        updatesPerSecond = (options.updatesPerSecond && typeof options.updatesPerSecond === 'number')
          ? Math.max(1, Math.min(60, options.updatesPerSecond))
          : DEFAULT_UPDATES_PER_SECOND;
        logDebug(`Update rate set to ${updatesPerSecond} updates per second`);
  
        console.log(`Initializing NetworkController, connecting to: ${serverUrl} on port ${options.port || 'default'}`);
  
        // Save callbacks and scene
        onPlayerUpdateCallback = options.onPlayerUpdate;
        onPlayerJoinedCallback = options.onPlayerJoined;
        onPlayerLeftCallback = options.onPlayerLeft;
        scene = options.scene;
  
        if (options.playerData) {
          logDebug('Player data:', options.playerData);
        }
  
        // Set controlsReference from multiple possible sources
        if (options.controls) {
          controlsReference = options.controls;
        } else if (typeof Controls !== 'undefined') {
          controlsReference = Controls;
        } else if (typeof window.App !== 'undefined' && typeof window.App.getControls === 'function') {
          controlsReference = window.App.getControls();
        }
        logDebug('Controls reference:', controlsReference);
  
        // Save options for reconnection
        lastConnectionOptions = options;
  
        // Ensure geckos.io client is loaded, then connect
        ensureGeckosLoaded(options, serverUrl);
        return true;
      } catch (error) {
        console.error('Error initializing NetworkController:', error);
        if (options.onDisconnect) options.onDisconnect(error);
        return false;
      }
    }
  
    /**
     * Ensure geckos.io is loaded and then connect
     * @param {Object} options - Configuration options
     * @param {string} serverUrl - Server URL to connect to
     */
    function ensureGeckosLoaded(options, serverUrl) {
      if (typeof geckos === 'function') {
        console.log('Geckos.io client already loaded, connecting...');
        connectToServer(options, serverUrl);
        return;
      }
      console.log('Attempting to load geckos.io client dynamically...');
      const scriptElem = document.createElement('script');
      scriptElem.src = 'https://cdn.jsdelivr.net/npm/@geckos.io/client@3.0.1/lib/index.min.js';
      scriptElem.onload = function() {
        console.log('Geckos.io client loaded dynamically');
        if (typeof geckos === 'function') {
          window.geckosLoaded = true;
          connectToServer(options, serverUrl);
        } else {
          console.error('Geckos.io client script loaded but geckos function not defined');
          if (options.onDisconnect) options.onDisconnect(new Error('Failed to load geckos.io client'));
        }
      };
      scriptElem.onerror = function(err) {
        console.error('Failed to load geckos.io client script:', err);
        if (options.onDisconnect) options.onDisconnect(new Error('Failed to load geckos.io client script'));
      };
      document.head.appendChild(scriptElem);
    }
  
    /**
     * Connect to the server once geckos is loaded
     * @param {Object} options - Configuration options
     * @param {string} serverUrl - Server URL to connect to
     */
    function connectToServer(options, serverUrl) {
      if (typeof geckos !== 'function') {
        console.error('Geckos.io client not available for connection');
        if (options.onDisconnect) options.onDisconnect(new Error('Geckos.io client not available'));
        return;
      }
      try {
        const config = {
          url: serverUrl,
          port: options.port
        };
        channel = geckos(config);
        setupEventHandlers(options);
        reconnectAttempts = 0; // reset reconnection attempts on successful connection
        console.log('NetworkController connected to server');
      } catch (error) {
        console.error('Error connecting to server:', error);
        if (options.onDisconnect) options.onDisconnect(error);
        startReconnectionTimer(options);
      }
    }
  
    /**
     * Set up event handlers for the geckos.io channel
     * @param {Object} options - Configuration options with callbacks
     * @private
     */
    function setupEventHandlers(options) {
      if (!channel) return;
      
      channel.on('laserFires', (laserEvents) => {
        // Log receipt for debugging
        // console.log('Received laser fire events:', laserEvents);
    
        // Get the current client's player ID.
        // Ensure getPlayerId() is accessible/imported correctly in your client code.
        const myPlayerId = getPlayerId();
    
        // Check if we actually got an array of events
        if (laserEvents && Array.isArray(laserEvents)) {
          // Process each event in the received array
          laserEvents.forEach(eventData => {
            // --- FILTERING LOGIC ---
            // Check if the event object has a shooterId AND if it matches this client's ID
            if (eventData.shooterId && eventData.shooterId === myPlayerId) {
              // It's our own laser event, ignore it (do not render)
              // console.log("Ignoring own laser fire event from server."); // Optional: uncomment for debugging
              return; // Skip the rest of the code for this specific event
            }
    
            // --- RENDER LOGIC (Only runs if the filter above didn't 'return') ---
            // If we reach here, the laser is from *another* player.
            // console.log(`Rendering remote laser from shooter: ${eventData.shooterId}`); // Optional: uncomment for debugging
            LaserSystem.renderRemoteLaser(eventData);
    
          }); // End of forEach loop
    
        } else {
          // Log a warning if the data isn't what we expect
          console.warn("Received unexpected data type or empty data for 'laserFires':", laserEvents);
        }
      }); // End of channel.on('laserFires', ...)
      
      channel.onConnect(error => {
        if (error) {
          logDebug('Error on connect:', error);
          if (options.onDisconnect) options.onDisconnect(error);
          startReconnectionTimer(options);
          return;
        }
        isConnected = true;
        playerId = channel.id;
        isReconnecting = false;
        logDebug(`Connected with ID: ${playerId}`);
        startSyncInterval();
        if (options.onConnect) options.onConnect({ id: playerId });
      });
      
      channel.onDisconnect(() => {
        isConnected = false;
        stopSyncInterval();
        logDebug('Disconnected from server');
        if (options.onDisconnect) options.onDisconnect();
        startReconnectionTimer(options);
        removeAllPlayerModels();
      });
      
      channel.on('playerJoined', data => {
        logDebug('Player joined:', data);
        players[data.id] = data;
        if (scene) {
          createPlayerModel(data.id, data.position, data.playerData);
        }
        if (onPlayerJoinedCallback) onPlayerJoinedCallback(data);
      });
      
      channel.on('playerLeft', data => {
        logDebug('Player left:', data.id);
        removePlayerModel(data.id);
        delete players[data.id];
        if (onPlayerLeftCallback) onPlayerLeftCallback(data);
      });
      
      // Place this variable at the top of your networkController.js module (outside any function)

      channel.on('playerUpdate', (allPlayersData) => {
        // Ignore the very first update because it may not have complete player data.
        if (ignoreFirstPlayerUpdate) {
          ignoreFirstPlayerUpdate = false;
          console.log("Ignoring first player update event.");
          return;
        }
        
        logDebug('Received player update:', allPlayersData);
        
        // Update local player's UI before replacing players,
        // so we can compare with the previous health.
        const newLocalData = allPlayersData[playerId];
        if (newLocalData) {
          App.setLocalPlayerHealth(newLocalData.health);
          logDebug(`myData.health: ${newLocalData.health}`);
          
          if (typeof newLocalData.health === 'number') {
            if (typeof CombatHUD !== 'undefined' && typeof CombatHUD.updateHealth === 'function') {
              CombatHUD.updateHealth(newLocalData.health);
              if (newLocalData.health < localPlayerPrevHealth && newLocalData.health > 0) {
                if (typeof UIController !== 'undefined' && typeof UIController.flashDamageIndicator === 'function') {
                  let impactSound = new Audio(Math.random() < 0.5 ? 'soundfx/impact1.mp3' : 'soundfx/impact2.mp3');
                  impactSound.volume = 0.85;
                  impactSound.play().catch(err => console.warn("Impact sound failed:", err));
                  UIController.flashDamageIndicator();
                  logDebug('Triggered cockpit flash indicator.');
                } else {
                  logDebug('UIController.flashDamageIndicator not available.');
                }
              } else if (newLocalData.health > localPlayerPrevHealth) {
                logDebug('More likely respawn situation.');
                App.finalizeRespawn();
              }
            }
            // Also update local player's nickname (if needed) and kills count.
            // (You might not need to update nickname every time if it is static.)
            localPlayerPrevHealth = newLocalData.health;
          }
        }
        
        // Now assign the complete state from the server to our players object.
        players = allPlayersData;
        
        // Process remote players (ignoring the local player since it’s already updated)
        Object.keys(players).forEach(id => {
          if (id !== playerId) {
            const remoteData = players[id];
            if (scene && enemyShips[id]) {
              enemyShips[id].updateState(remoteData);
            }
            if (onPlayerUpdateCallback) {
              onPlayerUpdateCallback(id, remoteData);
            }
          }
        });
        
        // Update the kills table overlay (if instantiated)
        if (window.killsTableInstance) {
          // Convert players object into an array with id, nickname, and kills.
          const playersArray = Object.keys(players).map(id => ({
            id: id,
            nickname: players[id].nickname || id,
            kills: players[id].kills || 0
          }));
          window.killsTableInstance.updateTable(playersArray);
        }
      });
      

      // Handle server messages (like assigning initial state)
      channel.on('serverMessage', data => {
        // Implementation of serverMessage handling
      });

      // Existing 'initialPlayers' handler (if any)
      // Make sure initialPlayers also sets the kills data if available
      channel.on('initialPlayers', initialPlayersData => {
        logDebug('Received initial players data:', initialPlayersData);
        players = {}; // Reset local player list
        removeAllPlayerModels(); // Clear existing models
        Object.keys(initialPlayersData).forEach(id => {
          if (id !== playerId) { // Don't create a model for the local player
            players[id] = initialPlayersData[id];
            // Make sure kills are initialized here too
            players[id].kills = initialPlayersData[id].kills || 0;
            if (scene) {
              createPlayerModel(id, initialPlayersData[id].position, initialPlayersData[id].playerData);
            }
          } else {
            // Store local player's initial data, including kills
            players[id] = initialPlayersData[id];
            players[id].kills = initialPlayersData[id].kills || 0;
          }
        });
        // Also update the kills table after receiving initial players
        if (window.killsTableInstance) {
          const playersArray = Object.keys(players).map(id => ({
            id: id,
            nickname: players[id].nickname || id,
            kills: players[id].kills || 0
          }));
          window.killsTableInstance.updateTable(playersArray);
        }
        if (onPlayerUpdateCallback) onPlayerUpdateCallback(players);
      });
    }
  
    /**
     * Start the interval for sending position updates
     * @private
     */
    function startSyncInterval() {
      if (syncIntervalId) return;
      const intervalMs = 1000 / updatesPerSecond;
      logDebug(`Starting sync interval: ${intervalMs}ms`);
      syncIntervalId = setInterval(() => {
        if (isConnected && typeof Controls !== 'undefined') {
          sendPlayerUpdate();
        }
      }, intervalMs);
    }
  
    /**
     * Stop the interval for sending position updates
     * @private
     */
    function stopSyncInterval() {
      if (syncIntervalId) {
        clearInterval(syncIntervalId);
        syncIntervalId = null;
      }
    }
  
    /**
     * Send player position and state update to the server
     * @private
     */
    function sendPlayerUpdate() {
      if (!isConnected || !channel) return;
      try {
        const position = getPlayerPosition();
        const rotation = getPlayerRotation();
        const velocity = getPlayerVelocity();
        const playerData = window.playerData || {};
        const nickname = playerData.nickname || "Unknown";
        const colorIndex = playerData.colorIndex ?? Math.floor(Math.random() * 6);
        const rotationQuat = getPlayerRotationQuaternion();
        const updateData = {
          id: playerId,
          position: position,
          rotation: rotationQuat,
          velocity: velocity,
          nickname: nickname,
          colorIndex: colorIndex
        };
        channel.emit('playerUpdate', updateData);
      } catch (error) {
        logDebug('Error sending update:', error);
      }
    }
  
    /**
     * Get the player's current position.
     * @returns {Object} {x, y, z}
     * @private
     */
    function getPlayerPosition() {
      try {
        if (controlsReference && typeof controlsReference.getObject === 'function') {
          const obj = controlsReference.getObject();
          if (obj && obj.position) {
            return { x: obj.position.x, y: obj.position.y, z: obj.position.z };
          }
        } else if (controlsReference && controlsReference.position) {
          return { x: controlsReference.position.x, y: controlsReference.position.y, z: controlsReference.position.z };
        }
        if (typeof Controls !== 'undefined' && Controls.getObject) {
          const obj = Controls.getObject();
          if (obj && obj.position) {
            return { x: obj.position.x, y: obj.position.y, z: obj.position.z };
          }
        }
      } catch (error) {
        logDebug('Error getting position:', error);
      }
      return { x: 0, y: 0, z: 0 };
    }
  
    /**
     * Get the player's current rotation as a quaternion.
     * @returns {Object} {x, y, z, w}
     * @private
     */
    function getPlayerRotationQuaternion() {
      try {
        if (controlsReference && typeof controlsReference.getObject === 'function') {
          const worldQuat = new THREE.Quaternion();
          controlsReference.camera.getWorldQuaternion(worldQuat);
          return { x: worldQuat.x, y: worldQuat.y, z: worldQuat.z, w: worldQuat.w };
        }
      } catch (error) {
        logDebug('Error getting rotation quaternion:', error);
      }
      return { x: 0, y: 0, z: 0, w: 1 };
    }
  
    /**
     * Get the player's current rotation as Euler angles.
     * @returns {Object} {x, y, z}
     * @private
     */
    function getPlayerRotation() {
      try {
        if (controlsReference && typeof controlsReference.getObject === 'function') {
          const obj = controlsReference.getObject();
          if (obj && obj.rotation) {
            return { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z };
          }
        } else if (controlsReference && controlsReference.rotation) {
          return { x: controlsReference.rotation.x, y: controlsReference.rotation.y, z: controlsReference.rotation.z };
        }
        if (typeof Controls !== 'undefined' && Controls.getObject) {
          const obj = Controls.getObject();
          if (obj && obj.rotation) {
            return { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z };
          }
        }
      } catch (error) {
        logDebug('Error getting rotation:', error);
      }
      return { x: 0, y: 0, z: 0 };
    }
  
    /**
     * Get the player's current velocity.
     * @returns {number}
     * @private
     */
    function getPlayerVelocity() {
      if (typeof ShipController !== 'undefined' && ShipController.getVelocity) {
        return ShipController.getVelocity();
      }
      return 0;
    }
  
    /**
     * Create a 3D model for a remote player.
     * @param {string} playerId
     * @param {Object} position
     * @param {Object} playerData
     * @private
     */
    function createPlayerModel(playerId, position, playerData = {}) {
      if (playerId === getPlayerId()) return;
      if (enemyShips[playerId]) return;
      if (scene) {
        const colorIndex = playerData.colorIndex ?? Math.floor(Math.random() * 6);
        const nickname = playerData.nickname || playerId.substr(0, 6);
        enemyShips[playerId] = new EnemyShip(
          playerId,
          scene,
          position,
          { x: 0, y: 0, z: 0 },
          { nickname, colorIndex }
        );
      }
    }
  
    /**
     * Update a player model's position and rotation.
     * Applies a correction quaternion to flip the model 180° about Y.
     * @param {string} playerId
     * @param {Object} position
     * @param {Object} rotation - Either Euler or quaternion data
     * @private
     */
    function updatePlayerModelPosition(playerId, position, rotation) {
      if (playerId === getPlayerId()) return;
      if (enemyShips[playerId]) {
        enemyShips[playerId].updatePosition(position);
        if (rotation && rotation.w !== undefined) {
          if (enemyShips[playerId].mesh) {
            const incomingQuat = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
            const correctionQuat = new THREE.Quaternion();
            correctionQuat.setFromEuler(new THREE.Euler(0, Math.PI, 0));
            incomingQuat.multiply(correctionQuat);
            enemyShips[playerId].mesh.quaternion.copy(incomingQuat);
          } else {
            console.warn(`EnemyShip ${playerId} mesh not loaded yet; skipping quaternion update.`);
          }
        } else if (rotation) {
          enemyShips[playerId].updateRotation(rotation);
        }
      }
    }
  
    /**
     * Remove a player model from the scene.
     * @param {string} playerId
     * @private
     */
    function removePlayerModel(playerId) {
      if (enemyShips[playerId]) {
        enemyShips[playerId].remove();
        delete enemyShips[playerId];
        console.log(`Removed model for player ${playerId}`);
      }
    }
  
    /**
     * Remove all player models.
     * @private
     */
    function removeAllPlayerModels() {
      Object.keys(enemyShips).forEach(playerId => removePlayerModel(playerId));
      enemyShips = {};
    }
  
    /**
     * Start the reconnection timer with exponential backoff.
     * @param {Object} options
     * @private
     */
    function startReconnectionTimer(options) {
      stopReconnectionTimer();
      lastConnectionOptions = options;
      isReconnecting = true;
      reconnectAttempts = 0;
      logDebug('Starting reconnection attempts with exponential backoff');
      
      function tryReconnect() {
        if (isConnected) {
          logDebug('Connection reestablished, stopping reconnection timer');
          stopReconnectionTimer();
          return;
        }
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY);
        logDebug(`Reconnection attempt ${reconnectAttempts + 1} in ${delay}ms`);
        reconnectTimer = setTimeout(() => {
          try {
            const config = {
              url: options.serverUrl || DEFAULT_SERVER_URL,
              port: options.port
            };
            channel = geckos(config);
            setupEventHandlers(options);
            reconnectAttempts++;
            // Schedule next reconnection attempt if not connected yet
            tryReconnect();
          } catch (error) {
            logDebug('Error during reconnection attempt:', error);
            reconnectAttempts++;
            tryReconnect();
          }
        }, delay);
      }
      tryReconnect();
    }
  
    /**
     * Stop the reconnection timer.
     * @private
     */
    function stopReconnectionTimer() {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
        logDebug('Reconnection timer stopped');
      }
      isReconnecting = false;
    }
  
    /**
     * Disconnect from the server.
     * @param {boolean} attemptReconnect - Whether to attempt reconnection
     */
    function disconnect(attemptReconnect = true) {
      if (channel) {
        stopSyncInterval();
        channel.close();
        isConnected = false;
        removeAllPlayerModels();
        logDebug('Disconnected from server');
        if (attemptReconnect && lastConnectionOptions) {
          startReconnectionTimer(lastConnectionOptions);
        }
      }
    }
  
    /**
     * Get the list of connected players.
     * @returns {Object}
     */
    function getPlayers() {
      return { ...players };
    }
  
    /**
     * Get the current player's ID.
     * @returns {string|null}
     */
    function getPlayerId() {
      return playerId;
    }
  
    /**
     * Check if connected to the server.
     * @returns {boolean}
     */
    function isConnectedToServer() {
      return isConnected;
    }
  
    /**
     * Set the update rate (updates per second).
     * @param {number} ups
     * @returns {boolean}
     */
    function setUpdateRate(ups) {
      if (typeof ups !== 'number' || ups < 1 || ups > 60) {
        logDebug(`Invalid update rate: ${ups}, must be between 1 and 60`);
        return false;
      }
      updatesPerSecond = ups;
      logDebug(`Update rate changed to ${updatesPerSecond} updates per second`);
      if (syncIntervalId) {
        stopSyncInterval();
        startSyncInterval();
      }
      return true;
    }
  
    /**
     * Sends a respawn request to the server with new position/rotation.
     */
    function sendRespawnRequest() {
      if (!isConnected || !channel || !playerId) {
        logDebug('Cannot send respawn request: Not connected or no player ID.');
        return;
      }

      try {
        // Get new spawn position/rotation using App.positionShipNearEarth
        // IMPORTANT: Ensure App.positionShipNearEarth is accessible and returns { position, rotation }
        let spawnData = null;
        if (typeof App !== 'undefined' && typeof App.positionShipNearEarth === 'function') {
          spawnData = App.positionShipNearEarth();
        } else {
          logDebug('App.positionShipNearEarth function not found. Cannot get spawn location.');
          // Fallback or error handling needed here?
          // For now, let's attempt respawn at origin if function missing
          spawnData = {
             position: { x: 0, y: 0, z: 110 }, // Default near Earth
             rotation: { x: 0, y: 0, z: 0, w: 1 } // Default rotation (Quaternion)
          };
        }

        if (!spawnData || !spawnData.position || !spawnData.rotation) {
          logDebug('Failed to get valid spawn data from positionShipNearEarth.');
          return;
        }

        logDebug('Sending respawn request with data:', spawnData);

        // Get current player nickname and color to send along
        const currentPlayerData = window.playerData || { nickname: "Unknown", colorIndex: 0 };

        // Send the update with the isRespawning flag
        channel.emit('playerUpdate', {
          id: playerId, // Ensure ID is sent, though server uses channel context
          position: spawnData.position,
          rotation: spawnData.rotation, // Assuming it returns Quaternion
          velocity: 0, // Reset velocity on respawn
          nickname: currentPlayerData.nickname,
          colorIndex: currentPlayerData.colorIndex,
          isRespawning: true, // The crucial flag
          timestamp: Date.now()
        });

      } catch (error) {
        logDebug('Error sending respawn request:', error);
      }
    }
  
    // Public API
    return {
      init,
      disconnect,
      getPlayers,
      getPlayerId,
      isConnected: isConnectedToServer,
      getEnemyShips: () => enemyShips,
      sendPlayerUpdate,
      sendLaserFire, 
      setUpdateRate,
      getUpdateRate: () => updatesPerSecond,
      startReconnecting: () => {
        if (lastConnectionOptions) {
          startReconnectionTimer(lastConnectionOptions);
          return true;
        }
        return false;
      },
      stopReconnecting: () => {
        stopReconnectionTimer();
        isReconnecting = false;
      },
      isAttemptingReconnection: () => isReconnecting,
      sendRespawnRequest
    };
  })();
  
  // Make NetworkController available globally
  window.NetworkController = NetworkController;
  