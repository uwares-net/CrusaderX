/**
 * server.mjs - UDP multiplayer server for Crusader X
 * Uses geckos.io for low-latency UDP WebRTC networking over HTTPS
 */

import geckos from '@geckos.io/server';
import https from 'https';
import fs from 'fs';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { iceServers } from '@geckos.io/server';
import cors from 'cors';


global.isConnected = false;
global.playerId = null;
global.syncIntervalId = null;
let channel; 
let networkOptions = {};


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const PORT = process.env.PORT || 6198;
const MAX_PLAYERS = 10; // Maximum number of players per game
const PLAYER_TIMEOUT = 10000; // 10 seconds without updates before considering a player disconnected
const DEBUG = true; // Enable verbose debugging
const DEFAULT_UPDATES_PER_SECOND = 10; // Default to 10 updates per second
const SYNC_INTERVAL = 1000 / DEFAULT_UPDATES_PER_SECOND; // ms between position updates

// Debug logging function
function logDebug(message, data) {
  if (!DEBUG) return;
  
  if (data) {
    console.log(`[Crusader X Server] ${message}`, data);
  } else {
    console.log(`[Crusader X Server] ${message}`);
  }
}

function pointLineDistance(point, lineStart, lineEnd) {
  // Compute the vector from lineStart to lineEnd.
  const AB = {
    x: lineEnd.x - lineStart.x,
    y: lineEnd.y - lineStart.y,
    z: lineEnd.z - lineStart.z
  };
  
  // Compute the vector from lineStart to the point.
  const AP = {
    x: point.x - lineStart.x,
    y: point.y - lineStart.y,
    z: point.z - lineStart.z
  };
  
  const ab2 = AB.x * AB.x + AB.y * AB.y + AB.z * AB.z;
  // Avoid division by zero if the start and end are the same.
  if (ab2 === 0) return Math.sqrt(AP.x * AP.x + AP.y * AP.y + AP.z * AP.z);
  
  // Projection scalar of AP onto AB.
  let t = (AP.x * AB.x + AP.y * AB.y + AP.z * AB.z) / ab2;
  // Clamp t between 0 and 1 to restrict to the segment.
  t = Math.max(0, Math.min(1, t));
  
  // Find the closest point on the segment.
  const closestPoint = {
    x: lineStart.x + AB.x * t,
    y: lineStart.y + AB.y * t,
    z: lineStart.z + AB.z * t
  };
  
  // Return the distance between the point and this closest point.
  const dx = point.x - closestPoint.x;
  const dy = point.y - closestPoint.y;
  const dz = point.z - closestPoint.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}



// Active players (map of channelId -> playerData)
const players = new Map();

// For rendering other players in the scene
let playerModels = {};
let scene = null;

// For storing additional player state on disconnect (for reconnection)
const disconnectedPlayers = new Map(); // Map of previous playerId -> last known state
const DISCONNECTED_PLAYER_TIMEOUT = 60000; // Remove disconnected player data after 1 minute

// Keep track of when players were last seen
const playerLastSeen = new Map();

// Laser buffer for storing laser fire events per shooter
let laserBuffer = {};

// Clear any existing player data on server startup
const clearPlayerData = () => {
  players.clear();
  disconnectedPlayers.clear();
  playerLastSeen.clear();
  logDebug(`Server startup: Cleared all player data.`);
};

clearPlayerData();

// Create express app
const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, '..')));

// HTTPS Options using your Let's Encrypt keys
const httpsOptions = {
  key: fs.readFileSync('/etc/letsencrypt/live/fonearcade.com/privkey.pem'),
  cert: fs.readFileSync('/etc/letsencrypt/live/fonearcade.com/fullchain.pem')
};

// Create HTTPS server with express
const server = https.createServer(httpsOptions, app);

// Create geckos.io server
const io = geckos({
  iceServers: process.env.NODE_ENV === 'production' ? iceServers : []
});

// Attach geckos.io to the HTTPS server
io.addServer(server);

// -----------------
// Server-side Connection Handling
// -----------------
io.onConnection(channel => {
  const id = channel.id;
  logDebug(`Player connected: ${id}`);

  // Check if this is a player reconnecting
  if (disconnectedPlayers.has(id)) {
    logDebug(`Player ${id} is reconnecting, restoring previous state`);
    const previousState = disconnectedPlayers.get(id);
    disconnectedPlayers.delete(id);
    // Update the timestamp on the restored data
    previousState.timestamp = Date.now();
    players.set(id, previousState);
  } else {
    // Add new player with additional health and kills properties
    players.set(id, {
      id,
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      velocity: 0,
      nickname: "Unknown", // Default nickname
      colorIndex: 0,       // Default color (red)
      health: 100,         // New: starting health at 100
      kills: 0,            // New: initial kill count
      timestamp: Date.now()
    });
  }

  // Update last seen timestamp
  playerLastSeen.set(id, Date.now());

  logDebug(`Current player count: ${players.size}`);

  // Notify all other players of the new/reconnected player
  channel.broadcast.emit('playerJoined', {
    id,
    position: players.get(id).position,
    rotation: players.get(id).rotation,
    velocity: players.get(id).velocity,
    nickname: players.get(id).nickname,
    colorIndex: players.get(id).colorIndex,
    health: players.get(id).health,
    kills: players.get(id).kills
  });

  // Send existing players to the new/reconnected player
  players.forEach((playerData, playerId) => {
    if (playerId !== id) {
      //logDebug(`Sending existing player ${playerId} to player ${id}`);
      channel.emit('playerJoined', playerData);
    }
  });


  // -----------------
  // New: Laser Fire Event Handler
  // -----------------
  channel.on('laserFire', data => {
    if (!data || !data.startPosition || !data.endPosition) {
      logDebug(`Invalid laserFire event data from ${id}`, data);
      return;
    }

    if (data.likelyHit) {
      const hitThreshold = 10;
      let minDistance = Infinity;
      let closestPlayerId = null;

      // Find closest player within threshold
      players.forEach((otherPlayer, otherId) => {
        if (otherId === id || otherPlayer.health <= 0) return;

        const distance = pointLineDistance(otherPlayer.position, data.startPosition, data.endPosition);

        if (distance < hitThreshold && distance < minDistance) {
          minDistance = distance;
          closestPlayerId = otherId;
        }
      });

      // --- Damage logic MOVED INSIDE if(data.likelyHit) ---
      if (closestPlayerId !== null) {
        const targetPlayer = players.get(closestPlayerId);
        if (targetPlayer) {
          logDebug(`Closest player within threshold found: ${closestPlayerId} at distance ${minDistance.toFixed(2)}`);
          const oldHealth = targetPlayer.health;
          const newHealth = Math.max(0, oldHealth - 5);
          targetPlayer.health = newHealth;
          logDebug(`Player ${closestPlayerId} hit by ${id}. Health: ${oldHealth} -> ${newHealth}`);

          if (oldHealth > 0 && newHealth === 0) {
            const shooter = players.get(id);
            if (shooter) {
              shooter.kills = (shooter.kills || 0) + 1;
              logDebug(`Player ${id} registered a kill on ${closestPlayerId}. Total kills: ${shooter.kills}`);
            }
            targetPlayer.kills = 0;
            logDebug(`Player ${closestPlayerId} died. Kills reset to 0.`);
          }
          targetPlayer.recentlyHit = true;
          setTimeout(() => {
            const currentTarget = players.get(closestPlayerId);
            if (currentTarget) currentTarget.recentlyHit = false;
          }, 500);

        } else {
          logDebug(`Error: closestPlayerId ${closestPlayerId} not found in players map after check.`);
        }
      } else {
        // Optional log if no one was close enough
        // logDebug(`No player was close enough to the laser from ${id} within the threshold.`);
      }
      // --- End of damage logic ---

    } // --- End of if(data.likelyHit) ---

    // Buffer laser event for broadcast (happens regardless of hit)
    if (!laserBuffer[id]) {
      laserBuffer[id] = [];
    }
    if (laserBuffer[id].length < 2) {
      const eventDataWithShooterId = { ...data, shooterId: id };
      laserBuffer[id].push(eventDataWithShooterId);
    }
  }); // end channel.on('laserFire')
  
  // Player disconnected
  channel.onDisconnect(() => {
    logDebug(`Player disconnected: ${id}`);
    
    // Save player data for potential reconnect (including health and kills)
    if (players.has(id)) {
      const playerData = players.get(id);
      disconnectedPlayers.set(id, playerData);
      logDebug(`Saved player ${id} data for potential reconnection`);
    }
    
    // Remove from active players
    players.delete(id);
    playerLastSeen.delete(id);
    io.emit('playerLeft', { id });
    logDebug(`Current player count: ${players.size}`);
  });

  // -----------------
  // Client Sends Update
  // -----------------
  channel.on('playerUpdate', (data) => {
    const player = players.get(id);
    if (!player) {
      logDebug(`Received update from unknown or disconnected player: ${id}`);
      return;
    }

    // Update timestamp first
    playerLastSeen.set(id, Date.now());
    player.timestamp = Date.now();

    // Check for respawn flag
    if (data.isRespawning) {
      logDebug(`Player ${id} is respawning.`);
      player.health = 100;
      player.kills = 0;
      // Update position/rotation from the respawn data
      if (data.position) player.position = data.position;
      if (data.rotation) player.rotation = data.rotation;
      player.nickname = data.nickname || player.nickname; // Update nickname on respawn if sent
      player.colorIndex = (typeof data.colorIndex === 'number') ? data.colorIndex : player.colorIndex;
      // Don't need to specifically update velocity as it will come in next non-respawn update
      // We rely on the main broadcast loop to send the updated state
      logDebug(`Player ${id} with nickname ${player.nickname} respawned. Health: ${player.health}, Kills: ${player.kills}, Pos:`, player.position);
    } else {
      // --- Regular Update ---
      // Health and kills are server-authoritative (updated via hit detection).
      // Update client-controlled state: position, rotation, velocity, nickname, colorIndex.

      if (data.position) player.position = data.position;
      if (data.rotation) player.rotation = data.rotation;
      if (data.velocity !== undefined) player.velocity = data.velocity;

      // Update nickname and log if it changes
      if (data.nickname && data.nickname !== player.nickname) {
        logDebug(`Player ${id} changed nickname from "${player.nickname}" to "${data.nickname}"`);
        player.nickname = data.nickname;
      } else if (data.nickname) {
        // Update even if same, ensures consistency if client sends unnecessarily
        player.nickname = data.nickname;
      }

      // Update color index
      if (typeof data.colorIndex === 'number') {
        player.colorIndex = data.colorIndex;
      }
    }
    
    // Optionally broadcast update immediately (might cause jitter)
    // channel.broadcast.emit('playerUpdate', { id, ...data });
    // Instead, rely on the main sync interval broadcast for smoother updates
  });
});

// -----------------
// Periodically clean up disconnected players and inactive players
// -----------------
setInterval(() => {
  const now = Date.now();
  
  // Clean up disconnected players that haven't reconnected
  disconnectedPlayers.forEach((playerData, id) => {
    const disconnectTime = playerData.timestamp;
    if (now - disconnectTime > DISCONNECTED_PLAYER_TIMEOUT) {
      logDebug(`Removing stored data for disconnected player ${id} (timeout)`);
      disconnectedPlayers.delete(id);
    }
  });
  
  // Check for inactive players
  playerLastSeen.forEach((lastSeen, id) => {
    if (now - lastSeen > PLAYER_TIMEOUT) {
      logDebug(`Player timed out: ${id}`);
      
      if (players.has(id)) {
        const playerData = players.get(id);
        disconnectedPlayers.set(id, playerData);
        logDebug(`Saved player ${id} data after timeout for potential reconnection`);
      }
      
      players.delete(id);
      playerLastSeen.delete(id);
      io.emit('playerLeft', { id });
      logDebug(`Current player count: ${players.size}`);
    }
  });
}, 5000); // Check every 5 seconds

// -----------------
// Laser Buffer Broadcast
// -----------------
// Every 0.1 seconds, broadcast all buffered laser events to all clients and then clear the buffer.
// -----------------
// Laser Buffer Broadcast (Modified Logic)
// -----------------
// Every 0.1 seconds, broadcast buffered laser events, excluding the original shooter.
// -----------------
// Laser Buffer Broadcast (Revised Logic - Iterate and Skip Sender)
// -----------------
// Every 0.1 seconds, broadcast buffered laser events, excluding the original shooter.
// -----------------
// Laser Buffer Broadcast (Revised Logic - Iterate and Skip Sender - ENHANCED LOGGING)
// -----------------
// Every 0.1 seconds, broadcast buffered laser events, excluding the original shooter.
// -----------------
// Laser Buffer Broadcast (Original - Broadcast All)
// -----------------
// Every 0.1 seconds, broadcast all buffered laser events to all clients and then clear the buffer.
setInterval(() => {
  const allLaserEvents = [];
  // Iterate through shooters in the buffer
  for (const shooterId in laserBuffer) {
    if (laserBuffer.hasOwnProperty(shooterId)) {
      // Add all events from this shooter to the main list
      // Note: Thanks to the change above, each event object now contains 'shooterId'
      allLaserEvents.push(...laserBuffer[shooterId]);
    }
  }

  // Only emit if there are actually events
  if (allLaserEvents.length > 0) {
    //logDebug(`[Laser Interval] Broadcasting ${allLaserEvents.length} total laser events to ALL clients.`);
    // Use io.emit to send the single aggregated array to everyone
    io.emit('laserFires', allLaserEvents);
  } else {
    // logDebug("[Laser Interval] No buffered laser events to broadcast."); // Optional: uncomment if needed
  }

  // Clear the entire buffer for the next interval
  laserBuffer = {};
}, 100);

// -----------------
// Periodically broadcast full player state
// -----------------
setInterval(() => {
  const allPlayersData = {};
  players.forEach((playerData, playerId) => {
    // Ensure we only send necessary data
    allPlayersData[playerId] = {
      id: playerData.id,
      position: playerData.position,
      rotation: playerData.rotation, // Assuming rotation is stored
      velocity: playerData.velocity, // Assuming velocity is stored
      nickname: playerData.nickname,
      colorIndex: playerData.colorIndex,
      health: playerData.health,     // Include health
      kills: playerData.kills        // Include kills
      // Add any other state needed by clients
    };
  });

  // Only broadcast if there are players
  if (Object.keys(allPlayersData).length > 0) {
    // logDebug("[State Sync Interval] Broadcasting full state for all players:", allPlayersData); // Optional verbose log
    io.emit('playerUpdate', allPlayersData);
  }
}, SYNC_INTERVAL); // Use the defined SYNC_INTERVAL

// Start the HTTPS server
server.listen(PORT, '0.0.0.0', () => {
  logDebug(`Crusader X UDP server (HTTPS) listening on port ${PORT}`);
  logDebug(`Game client available at https://localhost:${PORT}`);
});
