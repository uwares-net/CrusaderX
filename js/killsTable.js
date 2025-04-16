/**
 * killsTable.js - Manages the kills table overlay display.
 * This overlay appears when the Tab key is held down.
 */
class KillsTable {
  constructor() {
    this.overlay = null;
    this.table = null;
    this.visible = false;
    this.createOverlay();
  }
  
  createOverlay() {
    // Create the overlay container
    this.overlay = document.createElement('div');
    this.overlay.id = 'kills-table-overlay';
    this.overlay.style.position = 'fixed';
    this.overlay.style.top = '0';
    this.overlay.style.left = '0';
    this.overlay.style.width = '100%';
    this.overlay.style.height = '100%';
    this.overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.85)'; // dark translucent background
    this.overlay.style.zIndex = '30000'; // on top of all other UI
    this.overlay.style.display = 'none';
    this.overlay.style.justifyContent = 'center';
    this.overlay.style.alignItems = 'center';
    
    // Create a table element to show player kills
    this.table = document.createElement('table');
    this.table.style.borderCollapse = 'collapse';
    this.table.style.fontFamily = '"Orbitron", sans-serif';
    this.table.style.color = '#0ff';
    this.table.style.fontSize = '24px';
    this.table.style.textAlign = 'left';
    this.table.style.boxShadow = '0 0 20px rgba(0,255,255,0.7)';
    
    // Create table header
    const headerRow = document.createElement('tr');
    
    const thName = document.createElement('th');
    thName.textContent = 'Player';
    thName.style.borderBottom = '2px solid #0ff';
    thName.style.padding = '10px 20px';
    
    const thKills = document.createElement('th');
    thKills.textContent = 'Kills';
    thKills.style.borderBottom = '2px solid #0ff';
    thKills.style.padding = '10px 20px';
    
    headerRow.appendChild(thName);
    headerRow.appendChild(thKills);
    this.table.appendChild(headerRow);
    
    // Add the table to the overlay
    this.overlay.appendChild(this.table);
    document.body.appendChild(this.overlay);
  }
  
  updateTable(playersData) {
    // playersData is an array of objects: { id, nickname, kills }
    // Clear any existing rows (keep header row)
    while (this.table.rows.length > 1) {
      this.table.deleteRow(1);
    }
    // Sort players by kills in descending order
    playersData.sort((a, b) => b.kills - a.kills);
    
    playersData.forEach(player => {
      const row = document.createElement('tr');
      
      const tdName = document.createElement('td');
      tdName.textContent = player.nickname || 'Unknown';
      tdName.style.padding = '10px 20px';
      
      const tdKills = document.createElement('td');
      tdKills.textContent = (player.kills !== undefined) ? player.kills : '0';
      tdKills.style.padding = '10px 20px';
      
      row.appendChild(tdName);
      row.appendChild(tdKills);
      this.table.appendChild(row);
    });
  }
  
  show() {
    this.overlay.style.display = 'flex';
    this.visible = true;
  }
  
  hide() {
    this.overlay.style.display = 'none';
    this.visible = false;
  }
}

window.KillsTable = KillsTable; 