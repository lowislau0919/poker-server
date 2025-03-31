const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

mongoose.connect('mongodb://localhost/poker', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB已連接'))
  .catch(err => console.log(err));

const rooms = {};

io.on('connection', (socket) => {
  socket.on('joinRoom', ({ roomId, username }) => {
    if (!rooms[roomId]) {
      rooms[roomId] = { players: [], communityCards: [], pot: 0, currentPlayer: 0 };
    }

    // 檢查用戶名是否已經存在於房間中
    const existingPlayer = rooms[roomId].players.find(player => player.username === username);
    if (existingPlayer) {
      socket.emit('error', '用戶名已存在於房間中，請使用其他用戶名');
      return;
    }

    const player = { id: socket.id, username, chips: 1000, hand: [], folded: false };
    rooms[roomId].players.push(player);
    socket.join(roomId);

    io.to(roomId).emit('roomUpdate', rooms[roomId]);
  });

  socket.on('startGame', (roomId) => {
    const room = rooms[roomId];
    if (!room) return;

    // 簡單嘅遊戲開始邏輯（根據你嘅實際代碼調整）
    room.communityCards = [];
    room.pot = 0;
    room.currentPlayer = 0;
    room.players.forEach(player => {
      player.hand = [];
      player.folded = false;
    });

    io.to(roomId).emit('gameUpdate', room);
  });

  socket.on('bet', ({ roomId, amount }) => {
    const room = rooms[roomId];
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    if (player && player.chips >= amount) {
      player.chips -= amount;
      room.pot += amount;
      room.currentPlayer = (room.currentPlayer + 1) % room.players.length;
      io.to(roomId).emit('gameUpdate', room);
    }
  });

  socket.on('fold', (roomId) => {
    const room = rooms[roomId];
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    if (player) {
      player.folded = true;
      room.currentPlayer = (room.currentPlayer + 1) % room.players.length;
      io.to(roomId).emit('gameUpdate', room);
    }
  });

  socket.on('disconnect', () => {
    for (const roomId in rooms) {
      const room = rooms[roomId];
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        room.players.splice(playerIndex, 1);
        if (room.players.length === 0) {
          delete rooms[roomId];
        } else {
          io.to(roomId).emit('roomUpdate', room);
        }
      }
    }
  });
});

server.listen(3000, () => {
  console.log('伺服器運行於端口3000');
});
