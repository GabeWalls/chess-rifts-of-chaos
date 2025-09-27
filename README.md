# Chess: Rifts of Chaos

A chaotic twist on classic chess where rifts alter the battlefield with magical effects!

## 🎮 Features

- **Classic Chess Mechanics** - Standard chess rules with piece movement
- **Rift Effects** - 21 different magical effects that trigger when pieces land on rifts
- **Multiplayer Support** - Play with friends online in real-time
- **Room System** - Join games with 6-character room codes
- **Spectator Mode** - Watch games with up to 2 spectators
- **Dark Mode** - Toggle between light and dark themes
- **Game Log** - Track all moves and effects
- **Chat System** - Communicate with other players

## 🚀 How to Play

### Local Development

1. Clone the repository
2. Install dependencies: `npm install`
3. Start the server: `npm start`
4. Open `http://localhost:3000` in your browser

### Online Play

Visit the live game at: [https://gabewalls.github.io/chess-rifts-of-chaos/](https://gabewalls.github.io/chess-rifts-of-chaos/)

## 🎯 Game Rules

### Setup
1. Place 4 rifts on rows 3, 4, 5, or 6
2. No two rifts can share the same row or column
3. Players are assigned colors via coin flip

### Gameplay
- Standard chess rules apply
- When a piece lands on a rift, roll a D20
- The corresponding rift effect is triggered
- Effects can be beneficial, harmful, or neutral

### Rift Effects
- **Special Effects**: Trigger once, then expire
- **Field Effects**: Alter gameplay rules globally until replaced
- **Player Choices**: Some effects allow player decisions

## 🌐 Multiplayer

### Creating a Game
1. Click "🎮 Multiplayer"
2. Enter your name
3. Click "Create New Room"
4. Share the room code with friends

### Joining a Game
1. Click "🎮 Multiplayer"
2. Enter your name and room code
3. Click "Join Room"

### Room Capacity
- **2 Players** - Active chess players
- **2 Spectators** - View-only observers
- **Total**: 4 people per room

## 🛠️ Technical Details

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Node.js, Express, Socket.io
- **Real-time**: WebSocket connections for multiplayer
- **Hosting**: GitHub Pages + Custom server

## 📱 Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge

## 🎨 Customization

The game supports:
- Dark/Light mode toggle
- Responsive design for mobile devices
- Customizable rift animations
- Adjustable game log and chat

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🎉 Credits

Created by GabeWalls - A chaotic chess experience for friends to enjoy together!

---

**Note**: For the best multiplayer experience, ensure all players have a stable internet connection.