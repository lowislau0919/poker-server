const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// 連接MongoDB
mongoose.connect('mongodb+srv://hoyin:Lowis19790919@lowislau919.hudf8.mongodb.net/poker?retryWrites=true&w=majority')
  .then(() => console.log('MongoDB已連接'))
  .catch(err => console.error('MongoDB連接失敗:', err));

// 玩家模型
const PlayerSchema = new mongoose.Schema({ username: String, chips: Number });
const Player = mongoose.model('Player', PlayerSchema);

// 撲克牌邏輯
const suits = ['♠', '♣', '♦', '♥'];
const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const deck = suits.flatMap(suit => ranks.map(rank => rank + suit));

function shuffleDeck() {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// 房間管理
const rooms = new Map();

io.on('connection', (socket) => {
  console.log('玩家連接:', socket.id);

  socket.on('joinRoom', async ({ roomId, username }) => {
    socket.join(roomId);
    let player = await Player.findOne({ username });
    if (!player) {
      player = new Player({ username, chips: 1000 });
      await player.save();
    }

    if (!rooms.has(roomId)) {
      rooms.set(roomId, { players: [], deck: shuffleDeck(), communityCards: [], pot: 0, currentPlayer: 0 });
    }
    const room = rooms.get(roomId);
    room.players.push({ id: socket.id, username, hand: room.deck.splice(0, 2), chips: player.chips });
    io.to(roomId).emit('roomUpdate', room);
  });

  socket.on('startGame', (roomId) => {
    const room = rooms.get(roomId);
    room.communityCards = room.deck.splice(0, 5);
    io.to(roomId).emit('gameUpdate', room);
  });

  socket.on('bet', async ({ roomId, amount }) => {
    const room = rooms.get(roomId);
    const player = room.players.find(p => p.id === socket.id);
    if (player.chips >= amount) {
      player.chips -= amount;
      room.pot += amount;
      room.currentPlayer = (room.currentPlayer + 1) % room.players.length;
      await Player.updateOne({ username: player.username }, { chips: player.chips });
      io.to(roomId).emit('gameUpdate', room);
    }
  });

  socket.on('fold', (roomId) => {
    const room = rooms.get(roomId);
    room.players = room.players.filter(p => p.id !== socket.id);
    room.currentPlayer = room.currentPlayer % room.players.length;
    io.to(roomId).emit('gameUpdate', room);
  });

  socket.on('disconnect', () => {
    rooms.forEach((room, roomId) => {
      room.players = room.players.filter(p => p.id !== socket.id);
      if (room.players.length === 0) rooms.delete(roomId);
      else io.to(roomId).emit('roomUpdate', room);
    });
  });
});

server.listen(3000, () => console.log('伺服器運行於端口3000'));