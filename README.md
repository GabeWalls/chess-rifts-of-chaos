# Chess: Rifts of Chaos ♟️

A chaotic twist on classic chess where mysterious rifts alter the battlefield with unpredictable effects!

## How to Play

### Setup Phase
1. **Place Rifts**: Before the game starts, you need to place 4 rifts on the board
   - Rifts can only be placed on rows 3, 4, 5, or 6 (rows 3-6)
   - No two rifts can share the same row or column
   - Click on squares to place rifts, or use the "Generate Random Rifts" button
   - Click on placed rifts to remove them

2. **Start Game**: Once 4 rifts are placed, click "Start Game" to begin

### Gameplay
- Play standard chess rules with one major difference: **rifts**
- When a piece moves onto a rift square, roll a D20 to determine the effect
- Each rift effect can dramatically change the game state
- Rifts are marked with swirling, colorful animations

### Rift Effects
The game includes 21 different rift effects, each triggered by rolling a D20:

#### Special Effects (One-time)
- **Necromancer's Trap** (☆): Remove your piece, place opponent's captured piece on rift
- **Archer's Trick Shot** (☆☆☆☆☆): Remove enemy pieces in 3 directions
- **Sandworm** (☆☆☆): Remove all pieces within 1 square of the rift
- **Dragon's Breath** (☆☆☆☆): Remove any piece up to 3 squares away
- **Portal in the Rift** (☆☆☆☆): Teleport to another rift
- **Spring of Revival** (☆☆☆☆☆): Resurrect a captured piece
- And many more!

#### Field Effects (Ongoing)
- **Famine** (☆☆): Pawns cannot move
- **Sandstorm** (☆☆): Severe movement restrictions
- **Holiday's Rejuvenation** (☆☆☆☆): Enhanced movement abilities
- **Time Distortion** (☆☆☆): Freeze pieces in a radius
- **Eerie Fog's Turmoil** (☆☆): Random turn skipping

### Game Features
- **Beautiful UI**: Modern, responsive design with smooth animations
- **Visual Feedback**: Clear indication of possible moves, captures, and rift effects
- **Captured Pieces Tracker**: See all captured pieces for both players
- **Active Effects Display**: Track ongoing field effects
- **Dice Rolling**: Built-in D20 rolling system for rift effects
- **Game State Management**: Proper turn management and win conditions

### Controls
- **Mouse**: Click to select pieces and make moves
- **Setup**: Click squares to place/remove rifts
- **Game**: Click pieces to select, click destination squares to move
- **Rift Effects**: Roll dice when prompted, follow effect instructions

### Victory Conditions
- Standard chess win: Checkmate your opponent's king
- Special win: If a rift effect removes a king from play, that player immediately loses

## Technical Details

### Files
- `index.html` - Main game interface
- `styles.css` - Styling and animations
- `chess-game.js` - Game logic and rift system
- `README.md` - This file

### Browser Compatibility
- Modern browsers with ES6 support
- Responsive design works on desktop and mobile
- No external dependencies required

### Game Rules Implementation
- Full standard chess movement rules
- All 21 rift effects with proper ratings and descriptions
- Field effect system with proper stacking rules
- Rift placement validation
- Turn-based gameplay with proper state management

## Getting Started
1. Open `index.html` in your web browser
2. Place 4 rifts on the board (rows 3-6, no shared rows/columns)
3. Click "Start Game"
4. Play chess normally, but watch out for those rifts!

Enjoy the chaos! 🎲⚡
