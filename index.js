const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

mongoose.connect('mongodb+srv://hoyin:Lowis19790919@lowislau919.hudf8.mongodb.net/poker?retryWrites=true&w=majority')
  .then(() => console.log('MongoDB已連接'))
  .catch(err => console.log(err));

const rooms = {};

// 檢查牌局是否結束（只剩一個玩家未棄牌）
const checkGameEnd = (room, roomId) => {
  const activePlayers = room.players.filter(player => !player.folded);
  if (activePlayers.length === 1) {
    // 只剩一個玩家未棄牌，該玩家贏得底池
    const winner = activePlayers[0];
    winner.chips += room.pot;
    io.to(roomId).emit('gameUpdate', { ...room, message: `${winner.username} 贏得底池 ${room.pot} 籌碼！` });

    // 延遲 3 秒後開始新牌局
    setTimeout(() => {
      startNewGame(roomId);
    }, 3000);
  }
};

// 開始新牌局
const startNewGame = (roomId) => {
  const room = rooms[roomId];
  if (room) {
    const deck = ['A♠', 'K♠', 'Q♠', 'J♠', '10♠', '9♠', '8♠', '7♠', '6♠', '5♠', '4♠', '3♠', '2♠',
                  'A♥', 'K♥', 'Q♥', 'J♥', '10♥', '9♥', '8♥', '7♥', '6♥', '5♥', '4♥', '3♥', '2♥',
                  'A♣', 'K♣', 'Q♣', 'J♣', '10♣', '9♣', '8♣', '7♣', '6♣', '5♣', '4♣', '3♣', '2♣',
                  'A♦', 'K♦', 'Q♦', 'J♦', '10♦', '9♦', '8♦', '7♦', '6♦', '5♦', '4♦', '3♦', '2♦'];
    deck.sort(() => Math.random() - 0.5);
    room.players.forEach(player => {
      player.hand = [deck.pop(), deck.pop()];
      player.folded = false;
    });
    room.communityCards = [];
    room.pot = 0;
    room.currentPlayer = 0;
    io.to(roomId).emit('roomUpdate', room);
  }
};

io.on('connection', (socket) => {
  socket.on('joinRoom', ({ roomId, username }) => {
    if (!rooms[roomId]) {
      rooms[roomId] = {
        players: [],
        communityCards: [],
        pot: 0,
        currentPlayer: 0
      };
    }
    rooms[roomId].players.push({ id: socket.id, username, chips: 1000, hand: [], folded: false });
    socket.join(roomId);
    io.to(roomId).emit('roomUpdate', rooms[roomId]);
  });

  socket.on('startGame', (roomId) => {
    startNewGame(roomId);
  });

  socket.on('bet', ({ roomId, amount }) => {
    const room = rooms[roomId];
    if (room && room.players[room.currentPlayer].id === socket.id) {
      const player = room.players[room.currentPlayer];
      player.chips -= amount;
      room.pot += amount;
      room.currentPlayer = (room.currentPlayer + 1) % room.players.length;
      io.to(roomId).emit('gameUpdate', room);
      checkGameEnd(room, roomId); // 檢查牌局是否結束
    }
  });

  socket.on('fold', (roomId) => {
    const room = rooms[roomId];
    if (room && room.players[room.currentPlayer].id === socket.id) {
      room.players[room.currentPlayer].folded = true;
      room.currentPlayer = (room.currentPlayer + 1) % room.players.length;
      io.to(roomId).emit('gameUpdate', room);
      checkGameEnd(room, roomId); // 檢查牌局是否結束
    }
  });
});

server.listen(3000, () => console.log('伺服器運行於端口3000'));