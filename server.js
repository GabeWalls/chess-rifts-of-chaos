const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.static('.'));

// In-memory storage for rooms and games
const rooms = new Map();
const players = new Map();

// Generate random room code
function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Create a new room
function createRoom(roomCode) {
  const room = {
    code: roomCode,
    players: [],
    spectators: [],
    gameState: null,
    currentPlayer: 'white',
    gamePhase: 'waiting', // 'waiting', 'setup', 'playing', 'finished'
    coinFlipResult: null
  };
  rooms.set(roomCode, room);
  return room;
}

// Get or create room
function getRoom(roomCode) {
  if (!rooms.has(roomCode)) {
    return createRoom(roomCode);
  }
  return rooms.get(roomCode);
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join room
  socket.on('join-room', (data) => {
    const { roomCode, playerName } = data;
    console.log(`Player ${playerName} attempting to join room ${roomCode}`);
    
    const room = getRoom(roomCode);
    console.log(`Room ${roomCode} has ${room.players.length} players, ${room.spectators.length} spectators`);
    
    // Check if player is already in this room
    const existingPlayer = Array.from(players.values()).find(p => p.roomCode === roomCode && p.player.id === socket.id);
    if (existingPlayer) {
      console.log(`Player ${playerName} already in room ${roomCode}`);
      return;
    }
    
    // Check if room is full
    if (room.players.length >= 2 && room.spectators.length >= 2) {
      socket.emit('room-full');
      return;
    }

    // Add player to room
    const player = {
      id: socket.id,
      name: playerName,
      color: null,
      role: room.players.length < 2 ? 'player' : 'spectator'
    };

    if (player.role === 'player') {
      room.players.push(player);
      console.log(`Added ${playerName} as player. Room now has ${room.players.length} players`);
    } else {
      room.spectators.push(player);
      console.log(`Added ${playerName} as spectator. Room now has ${room.spectators.length} spectators`);
    }

    players.set(socket.id, { roomCode, player });
    socket.join(roomCode);

    // Assign colors if we have 2 players
    if (room.players.length === 2 && !room.coinFlipResult) {
      // Coin flip to determine colors
      room.coinFlipResult = Math.random() < 0.5;
      room.players[0].color = room.coinFlipResult ? 'white' : 'black';
      room.players[1].color = room.coinFlipResult ? 'black' : 'white';
      room.gamePhase = 'setup';
    }

    // Notify all players in room
    io.to(roomCode).emit('room-updated', {
      players: room.players,
      spectators: room.spectators,
      gamePhase: room.gamePhase,
      coinFlipResult: room.coinFlipResult
    });

    console.log(`Player ${playerName} joined room ${roomCode} as ${player.role}`);
  });

  // Start game (after rift setup)
  socket.on('start-game', (data) => {
    const { roomCode, gameState } = data;
    const room = rooms.get(roomCode);
    
    if (room && room.gamePhase === 'setup') {
      room.gameState = gameState;
      room.gamePhase = 'playing';
      
      io.to(roomCode).emit('game-started', {
        gameState: room.gameState,
        currentPlayer: room.currentPlayer
      });
    }
  });

  // Make move
  socket.on('make-move', (data) => {
    const { roomCode, move } = data;
    const room = rooms.get(roomCode);
    const player = players.get(socket.id);
    
    if (room && player && room.gamePhase === 'playing') {
      // Validate it's the player's turn
      if (player.color === room.currentPlayer) {
        // Update game state
        room.gameState = move.gameState;
        room.currentPlayer = room.currentPlayer === 'white' ? 'black' : 'white';
        
        // Broadcast move to all players in room
        io.to(roomCode).emit('move-made', {
          move: move,
          currentPlayer: room.currentPlayer,
          gameState: room.gameState
        });
      }
    }
  });

  // Handle rift effects
  socket.on('rift-effect', (data) => {
    const { roomCode, effect } = data;
    const room = rooms.get(roomCode);
    
    if (room && room.gamePhase === 'playing') {
      // Broadcast rift effect to all players
      io.to(roomCode).emit('rift-effect-applied', {
        effect: effect,
        gameState: room.gameState
      });
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const playerData = players.get(socket.id);
    if (playerData) {
      const { roomCode, player } = playerData;
      const room = rooms.get(roomCode);
      
      if (room) {
        // Remove player from room
        if (player.role === 'player') {
          room.players = room.players.filter(p => p.id !== socket.id);
        } else {
          room.spectators = room.spectators.filter(p => p.id !== socket.id);
        }
        
        // If no players left, delete room
        if (room.players.length === 0 && room.spectators.length === 0) {
          rooms.delete(roomCode);
        } else {
          // Notify remaining players
          io.to(roomCode).emit('room-updated', {
            players: room.players,
            spectators: room.spectators,
            gamePhase: room.gamePhase,
            coinFlipResult: room.coinFlipResult
          });
        }
      }
      
      players.delete(socket.id);
    }
    
    console.log('User disconnected:', socket.id);
  });
});

// Serve the game
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Chess: Rifts of Chaos server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} to play`);
});
