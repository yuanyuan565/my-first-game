const CONFIG = Object.freeze({
  rows: 10,
  cols: 10,
  traps: 16,
  startingHp: 3,
  startingCoins: 4,
  scoutCost: 2,
  coinChance: 0.24,
  maxCoinDrop: 3,
});

const refs = {
  board: document.getElementById("board"),
  message: document.getElementById("message"),
  hpDisplay: document.getElementById("hpDisplay"),
  coinsDisplay: document.getElementById("coinsDisplay"),
  roomsLeftDisplay: document.getElementById("roomsLeftDisplay"),
  flagsDisplay: document.getElementById("flagsDisplay"),
  newGameBtn: document.getElementById("newGameBtn"),
  flagModeBtn: document.getElementById("flagModeBtn"),
  scoutBtn: document.getElementById("scoutBtn"),
};

const state = {
  cells: [],
  hp: CONFIG.startingHp,
  coins: CONFIG.startingCoins,
  revealedSafeCount: 0,
  flagCount: 0,
  initialized: false,
  gameOver: false,
  flagMode: false,
  scoutMode: false,
  message: "",
  tone: "neutral",
};

function indexFor(row, col) {
  return row * CONFIG.cols + col;
}

function createEmptyCells() {
  const cells = [];

  for (let row = 0; row < CONFIG.rows; row += 1) {
    for (let col = 0; col < CONFIG.cols; col += 1) {
      cells.push({
        row,
        col,
        trap: false,
        revealed: false,
        flagged: false,
        scouted: false,
        adjacent: 0,
        coinReward: 0,
        lootClaimed: false,
        exploded: false,
      });
    }
  }

  return cells;
}

function getCell(row, col) {
  return state.cells[indexFor(row, col)];
}

function getNeighbors(row, col) {
  const neighbors = [];

  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let colOffset = -1; colOffset <= 1; colOffset += 1) {
      if (rowOffset === 0 && colOffset === 0) {
        continue;
      }

      const nextRow = row + rowOffset;
      const nextCol = col + colOffset;

      if (
        nextRow >= 0 &&
        nextRow < CONFIG.rows &&
        nextCol >= 0 &&
        nextCol < CONFIG.cols
      ) {
        neighbors.push(getCell(nextRow, nextCol));
      }
    }
  }

  return neighbors;
}

function shuffle(list) {
  for (let index = list.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [list[index], list[swapIndex]] = [list[swapIndex], list[index]];
  }
}

function setMessage(text, tone = "neutral") {
  state.message = text;
  state.tone = tone;
}

function initializeDungeon(safeRow, safeCol) {
  const protectedIndexes = new Set([
    indexFor(safeRow, safeCol),
    ...getNeighbors(safeRow, safeCol).map((cell) => indexFor(cell.row, cell.col)),
  ]);

  const trapCandidates = state.cells.filter(
    (cell) => !protectedIndexes.has(indexFor(cell.row, cell.col))
  );

  shuffle(trapCandidates);

  for (let trapIndex = 0; trapIndex < CONFIG.traps; trapIndex += 1) {
    trapCandidates[trapIndex].trap = true;
  }

  state.cells.forEach((cell) => {
    if (!cell.trap && Math.random() < CONFIG.coinChance) {
      cell.coinReward = 1 + Math.floor(Math.random() * CONFIG.maxCoinDrop);
    }
  });

  state.cells.forEach((cell) => {
    if (cell.trap) {
      return;
    }

    cell.adjacent = getNeighbors(cell.row, cell.col).filter(
      (neighbor) => neighbor.trap
    ).length;
  });

  state.initialized = true;
}

function revealSafeArea(startRow, startCol) {
  const queue = [getCell(startRow, startCol)];
  let coinsFound = 0;
  let treasureRoomsFound = 0;

  while (queue.length > 0) {
    const cell = queue.pop();

    if (cell.revealed || cell.flagged || cell.trap) {
      continue;
    }

    cell.revealed = true;
    state.revealedSafeCount += 1;

    if (cell.coinReward > 0 && !cell.lootClaimed) {
      state.coins += cell.coinReward;
      coinsFound += cell.coinReward;
      treasureRoomsFound += 1;
      cell.lootClaimed = true;
    }

    if (cell.adjacent !== 0) {
      continue;
    }

    getNeighbors(cell.row, cell.col).forEach((neighbor) => {
      if (!neighbor.revealed && !neighbor.flagged && !neighbor.trap) {
        queue.push(neighbor);
      }
    });
  }

  return {
    coinsFound,
    treasureRoomsFound,
  };
}

function formatCellLabel(cell) {
  return `${String.fromCharCode(65 + cell.row)}${cell.col + 1}`;
}

function checkForWin() {
  const totalSafeCells = CONFIG.rows * CONFIG.cols - CONFIG.traps;

  if (state.revealedSafeCount !== totalSafeCells) {
    return;
  }

  state.gameOver = true;
  state.flagMode = false;
  state.scoutMode = false;

  state.cells.forEach((cell) => {
    if (cell.trap) {
      cell.revealed = true;
    }
  });

  setMessage(
    `You revealed every safe room and escaped with ${state.coins} coins. Dungeon cleared.`,
    "good"
  );
}

function loseGame() {
  state.gameOver = true;
  state.flagMode = false;
  state.scoutMode = false;

  state.cells.forEach((cell) => {
    if (cell.trap) {
      cell.revealed = true;
    }
  });

  setMessage("Your HP hit zero. The dungeon wins this run.", "bad");
}

function revealCell(row, col) {
  const cell = getCell(row, col);

  if (state.gameOver || cell.revealed || cell.flagged) {
    return;
  }

  if (!state.initialized) {
    initializeDungeon(row, col);
  }

  if (cell.trap) {
    cell.revealed = true;
    cell.exploded = true;
    state.hp -= 1;

    if (state.hp <= 0) {
      loseGame();
    } else {
      setMessage(
        `Room ${formatCellLabel(cell)} triggered a trap. You lost 1 HP, but the run continues.`,
        "warn"
      );
    }

    render();
    return;
  }

  const revealResult = revealSafeArea(row, col);

  if (revealResult.coinsFound > 0) {
    setMessage(
      `You found ${revealResult.coinsFound} coins across ${revealResult.treasureRoomsFound} treasure rooms.`,
      "good"
    );
  } else if (cell.adjacent === 0) {
    setMessage(
      "A quiet stretch of rooms opened up. Follow the safe path and keep exploring.",
      "neutral"
    );
  } else {
    setMessage(
      `Room ${formatCellLabel(cell)} is safe. Its number shows how many traps touch it.`,
      "neutral"
    );
  }

  checkForWin();
  render();
}

function toggleFlag(row, col) {
  const cell = getCell(row, col);

  if (state.gameOver || cell.revealed) {
    return;
  }

  cell.flagged = !cell.flagged;
  state.flagCount += cell.flagged ? 1 : -1;

  setMessage(
    cell.flagged
      ? `Placed a flag on room ${formatCellLabel(cell)}.`
      : `Removed the flag from room ${formatCellLabel(cell)}.`,
    "neutral"
  );

  render();
}

function useScout(row, col) {
  const cell = getCell(row, col);

  if (state.gameOver) {
    return;
  }

  if (!state.initialized) {
    state.scoutMode = false;
    setMessage("Scout becomes available after your first move.", "warn");
    render();
    return;
  }

  if (cell.revealed) {
    setMessage("Scout only works on hidden rooms.", "warn");
    render();
    return;
  }

  if (cell.flagged) {
    setMessage("Remove the flag before scouting that room.", "warn");
    render();
    return;
  }

  if (cell.scouted) {
    setMessage("That room has already been scouted.", "warn");
    render();
    return;
  }

  if (state.coins < CONFIG.scoutCost) {
    state.scoutMode = false;
    setMessage("You do not have enough coins to use Scout.", "warn");
    render();
    return;
  }

  state.coins -= CONFIG.scoutCost;
  state.scoutMode = false;
  cell.scouted = true;

  if (cell.trap) {
    setMessage(
      `Scout confirmed that room ${formatCellLabel(cell)} is trapped. Flag it or route around it.`,
      "warn"
    );
  } else if (cell.adjacent === 0) {
    setMessage(
      `Scout confirmed that room ${formatCellLabel(cell)} is safe and opens into a wide empty area.`,
      "good"
    );
  } else {
    setMessage(
      `Scout checked room ${formatCellLabel(cell)}: safe, with ${cell.adjacent} nearby traps.`,
      "good"
    );
  }

  render();
}

function toggleFlagMode() {
  if (state.gameOver) {
    return;
  }

  state.flagMode = !state.flagMode;

  if (state.flagMode) {
    state.scoutMode = false;
    setMessage("Flag Mode is on. Click a hidden room to place or remove a flag.", "neutral");
  } else {
    setMessage("Flag Mode is off. Clicking hidden rooms will reveal them again.", "neutral");
  }

  render();
}

function toggleScoutMode() {
  if (state.gameOver) {
    return;
  }

  if (!state.initialized) {
    setMessage("Scout becomes available after your first move.", "warn");
    render();
    return;
  }

  if (state.coins < CONFIG.scoutCost) {
    setMessage("You do not have enough coins to use Scout.", "warn");
    render();
    return;
  }

  state.scoutMode = !state.scoutMode;

  if (state.scoutMode) {
    state.flagMode = false;
    setMessage("Scout is ready. Click one hidden room to inspect it safely.", "good");
  } else {
    setMessage("Scout cancelled.", "neutral");
  }

  render();
}

function resetGame() {
  state.cells = createEmptyCells();
  state.hp = CONFIG.startingHp;
  state.coins = CONFIG.startingCoins;
  state.revealedSafeCount = 0;
  state.flagCount = 0;
  state.initialized = false;
  state.gameOver = false;
  state.flagMode = false;
  state.scoutMode = false;

  setMessage(
    "Click any room to begin. Your first room and its neighbors are always safe.",
    "neutral"
  );

  render();
}

function getTileGlyph(cell) {
  if (cell.revealed) {
    if (cell.trap) {
      return "!";
    }

    return cell.adjacent === 0 ? "" : String(cell.adjacent);
  }

  if (cell.flagged) {
    return "F";
  }

  if (cell.scouted) {
    if (cell.trap) {
      return "!";
    }

    return cell.adjacent === 0 ? "0" : String(cell.adjacent);
  }

  return "";
}

function getTileLabel(cell) {
  if (cell.revealed && cell.trap) {
    return `Trap room ${formatCellLabel(cell)}.`;
  }

  if (cell.revealed && !cell.trap) {
    if (cell.adjacent === 0) {
      return `Safe empty room ${formatCellLabel(cell)}.`;
    }

    return `Safe room ${formatCellLabel(cell)} with ${cell.adjacent} nearby traps.`;
  }

  if (cell.flagged) {
    return `Flagged hidden room ${formatCellLabel(cell)}.`;
  }

  if (cell.scouted) {
    if (cell.trap) {
      return `Scouted trap room ${formatCellLabel(cell)}.`;
    }

    return `Scouted safe room ${formatCellLabel(cell)} with ${cell.adjacent} nearby traps.`;
  }

  return `Hidden room ${formatCellLabel(cell)}.`;
}

function render() {
  const totalSafeCells = CONFIG.rows * CONFIG.cols - CONFIG.traps;
  refs.board.style.setProperty("--cols", String(CONFIG.cols));
  refs.hpDisplay.textContent = `${Math.max(state.hp, 0)} / ${CONFIG.startingHp}`;
  refs.coinsDisplay.textContent = String(state.coins);
  refs.roomsLeftDisplay.textContent = String(totalSafeCells - state.revealedSafeCount);
  refs.flagsDisplay.textContent = `${state.flagCount} / ${CONFIG.traps}`;
  refs.message.textContent = state.message;
  refs.message.className = `message ${state.tone}`;

  refs.flagModeBtn.classList.toggle("active", state.flagMode);
  refs.flagModeBtn.setAttribute("aria-pressed", String(state.flagMode));
  refs.flagModeBtn.disabled = state.gameOver;

  refs.scoutBtn.classList.toggle("active", state.scoutMode);
  refs.scoutBtn.setAttribute("aria-pressed", String(state.scoutMode));
  refs.scoutBtn.disabled =
    state.gameOver || !state.initialized || (!state.scoutMode && state.coins < CONFIG.scoutCost);

  refs.board.replaceChildren();

  const fragment = document.createDocumentFragment();

  state.cells.forEach((cell) => {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.classList.add("tile");
    tile.dataset.row = String(cell.row);
    tile.dataset.col = String(cell.col);
    tile.setAttribute("role", "gridcell");
    tile.setAttribute("aria-label", getTileLabel(cell));

    if (cell.revealed) {
      tile.classList.add("revealed");
    }

    if (cell.flagged && !cell.revealed) {
      tile.classList.add("flagged");
    }

    if (cell.scouted && !cell.revealed) {
      tile.classList.add(cell.trap ? "scouted-trap" : "scouted-safe");
    }

    if (cell.trap && cell.revealed) {
      tile.classList.add(cell.exploded ? "trap-hit" : "trap-revealed");
    }

    if (cell.revealed && cell.coinReward > 0 && cell.lootClaimed) {
      tile.classList.add("coin-room");
    }

    if ((cell.revealed || cell.scouted) && !cell.trap && cell.adjacent > 0) {
      tile.dataset.danger = String(cell.adjacent);
    }

    if (cell.revealed || state.gameOver) {
      tile.disabled = true;
    }

    const glyph = document.createElement("span");
    glyph.className = "tile-core";
    glyph.textContent = getTileGlyph(cell);
    tile.append(glyph);

    if (cell.revealed && cell.coinReward > 0 && cell.lootClaimed) {
      const loot = document.createElement("span");
      loot.className = "tile-loot";
      loot.textContent = `+${cell.coinReward}`;
      tile.append(loot);
    }

    fragment.append(tile);
  });

  refs.board.append(fragment);
}

refs.board.addEventListener("click", (event) => {
  const tile = event.target.closest(".tile");

  if (!tile) {
    return;
  }

  const row = Number(tile.dataset.row);
  const col = Number(tile.dataset.col);

  if (state.scoutMode) {
    useScout(row, col);
    return;
  }

  if (state.flagMode) {
    toggleFlag(row, col);
    return;
  }

  revealCell(row, col);
});

refs.board.addEventListener("contextmenu", (event) => {
  const tile = event.target.closest(".tile");

  if (!tile) {
    return;
  }

  event.preventDefault();
  toggleFlag(Number(tile.dataset.row), Number(tile.dataset.col));
});

refs.newGameBtn.addEventListener("click", resetGame);
refs.flagModeBtn.addEventListener("click", toggleFlagMode);
refs.scoutBtn.addEventListener("click", toggleScoutMode);

resetGame();
