// Chess: Rifts of Chaos - Main Game Logic
class ChessGame {
    constructor() {
        this.board = [];
        this.currentPlayer = 'white';
        this.gamePhase = 'setup'; // 'setup' or 'playing'
        this.rifts = [];
        this.selectedSquare = null;
        this.capturedPieces = { white: [], black: [] };
        this.activeFieldEffects = [];
        this.kingAbilities = { white: {}, black: {} };
        this.frozenPieces = new Set();
        this.riftActivatedThisTurn = false;
        this.diceRolledThisTurn = false;
        this.gameLog = [];
        this.chatMessages = [];
        this.darkMode = false;
        
        // Multiplayer properties
        this.socket = null;
        this.roomCode = null;
        this.playerName = null;
        this.playerColor = null;
        this.isMultiplayer = false;
        this.isSpectator = false;
        
        this.initializeBoard();
        this.setupEventListeners();
        this.renderBoard();
        this.updateUI();
    }

    initializeBoard() {
        // Initialize empty board
        this.board = Array(8).fill().map(() => Array(8).fill(null));
        
        // Place pieces in standard starting positions
        const pieceOrder = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
        
        // Black pieces (top)
        for (let col = 0; col < 8; col++) {
            this.board[0][col] = { type: pieceOrder[col], color: 'black', hasMoved: false };
            this.board[1][col] = { type: 'pawn', color: 'black', hasMoved: false };
        }
        
        // White pieces (bottom)
        for (let col = 0; col < 8; col++) {
            this.board[6][col] = { type: 'pawn', color: 'white', hasMoved: false };
            this.board[7][col] = { type: pieceOrder[col], color: 'white', hasMoved: false };
        }
    }

    setupEventListeners() {
        // Setup controls
        document.getElementById('random-rifts').addEventListener('click', () => this.generateRandomRifts());
        document.getElementById('start-game').addEventListener('click', () => this.startGame());
        document.getElementById('resign-btn').addEventListener('click', () => this.resign());
        
        // Modal controls
        document.getElementById('roll-dice').addEventListener('click', () => this.rollDice());
        document.getElementById('close-modal').addEventListener('click', () => this.closeModal());
        document.getElementById('new-game').addEventListener('click', () => this.newGame());
        
        // Chat controls
        document.getElementById('send-chat').addEventListener('click', () => this.sendChatMessage());
        document.getElementById('chat-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendChatMessage();
            }
        });
        
        // Settings controls
        document.getElementById('settings-btn').addEventListener('click', () => this.toggleSettingsPanel());
        document.getElementById('dark-mode-toggle').addEventListener('click', () => this.toggleDarkMode());
        
        // Multiplayer controls
        document.getElementById('multiplayer-btn').addEventListener('click', () => this.showMultiplayerModal());
        document.getElementById('close-room-modal').addEventListener('click', () => this.closeMultiplayerModal());
        document.getElementById('join-room-btn').addEventListener('click', () => this.joinRoom());
        document.getElementById('create-room-btn').addEventListener('click', () => this.createRoom());
        document.getElementById('leave-room-btn').addEventListener('click', () => this.leaveRoom());
        
        // Load saved settings
        this.loadSettings();
        
        // Close settings panel when clicking outside
        document.addEventListener('click', (e) => {
            const settingsPanel = document.getElementById('settings-panel');
            const settingsBtn = document.getElementById('settings-btn');
            if (!settingsPanel.contains(e.target) && !settingsBtn.contains(e.target)) {
                settingsPanel.classList.remove('show');
            }
        });
    }

    renderBoard() {
        const boardElement = document.getElementById('chess-board');
        boardElement.innerHTML = '';
        
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const square = document.createElement('div');
                square.className = `chess-square ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
                square.dataset.row = row;
                square.dataset.col = col;
                
                // Add rift class if this is a rift square
                if (this.isRift(row, col)) {
                    square.classList.add('rift');
                }
                
                // Add frozen class if piece is frozen
                if (this.frozenPieces.has(`${row}-${col}`)) {
                    square.classList.add('frozen-piece');
                }
                
                // Add piece if present
                const piece = this.board[row][col];
                if (piece) {
                    const pieceSymbol = this.getPieceSymbol(piece);
                    square.textContent = pieceSymbol;
                    square.dataset.piece = `${piece.color}-${piece.type}`;
                }
                
                square.addEventListener('click', () => this.handleSquareClick(row, col));
                boardElement.appendChild(square);
            }
        }
    }

    getPieceSymbol(piece) {
        const symbols = {
            white: { king: '♔', queen: '♕', rook: '♖', bishop: '♗', knight: '♘', pawn: '♙' },
            black: { king: '♚', queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟' }
        };
        return symbols[piece.color][piece.type];
    }

    handleSquareClick(row, col) {
        if (this.gamePhase === 'setup') {
            this.handleRiftPlacement(row, col);
        } else {
            this.handleGameMove(row, col);
        }
    }

    handleRiftPlacement(row, col) {
        // Check if row is valid for rift placement (3, 4, 5, 6)
        if (row < 2 || row > 5) {
            alert('Rifts can only be placed on rows 3, 4, 5, or 6!');
            return;
        }
        
        // Check if rift already exists at this position
        if (this.isRift(row, col)) {
            this.removeRift(row, col);
            return;
        }
        
        // Check if rift would be in same row or column as existing rift
        const conflictingRift = this.rifts.find(rift => rift.row === row || rift.col === col);
        if (conflictingRift) {
            alert('No two rifts can share the same row or column!');
            return;
        }
        
        // Add rift
        this.rifts.push({ row, col });
        this.renderBoard();
        this.updateRiftCounter();
        
        if (this.rifts.length === 4) {
            document.getElementById('start-game').disabled = false;
        }
    }

    generateRandomRifts() {
        const validRows = [2, 3, 4, 5]; // Rows 3, 4, 5, 6 (0-indexed)
        const validCols = [0, 1, 2, 3, 4, 5, 6, 7];
        
        this.rifts = [];
        let attempts = 0;
        const maxAttempts = 100;
        
        while (this.rifts.length < 4 && attempts < maxAttempts) {
            const row = validRows[Math.floor(Math.random() * validRows.length)];
            const col = validCols[Math.floor(Math.random() * validCols.length)];
            
            // Check if this position conflicts with existing rifts
            const conflictingRift = this.rifts.find(rift => rift.row === row || rift.col === col);
            if (!conflictingRift) {
                this.rifts.push({ row, col });
            }
            attempts++;
        }
        
        if (this.rifts.length < 4) {
            alert('Could not generate valid rift placement. Please try again or place manually.');
        }
        
        this.renderBoard();
        this.updateRiftCounter();
        
        if (this.rifts.length === 4) {
            document.getElementById('start-game').disabled = false;
        }
    }

    removeRift(row, col) {
        this.rifts = this.rifts.filter(rift => !(rift.row === row && rift.col === col));
        this.renderBoard();
        this.updateRiftCounter();
        document.getElementById('start-game').disabled = this.rifts.length !== 4;
    }

    isRift(row, col) {
        return this.rifts.some(rift => rift.row === row && rift.col === col);
    }

    updateRiftCounter() {
        document.getElementById('rift-count').textContent = this.rifts.length;
    }

    startGame() {
        this.gamePhase = 'playing';
        this.updateUI();
        this.renderBoard();
        this.addToGameLog('Game started!', 'system');
        this.addToGameLog(`Rifts placed at: ${this.rifts.map(r => String.fromCharCode(97 + r.col) + (8 - r.row)).join(', ')}`, 'system');
        
        // In multiplayer, notify server that game started
        if (this.isMultiplayer && this.socket) {
            this.socket.emit('start-game', {
                roomCode: this.roomCode,
                gameState: {
                    board: this.board,
                    currentPlayer: this.currentPlayer,
                    capturedPieces: this.capturedPieces,
                    activeFieldEffects: this.activeFieldEffects,
                    rifts: this.rifts
                }
            });
        }
    }

    handleGameMove(row, col) {
        // In multiplayer spectator mode, don't allow moves
        if (this.isMultiplayer && this.isSpectator) {
            return;
        }
        
        const square = this.board[row][col];
        const squareElement = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        
        if (this.selectedSquare) {
            const [selectedRow, selectedCol] = this.selectedSquare;
            const selectedPiece = this.board[selectedRow][selectedCol];
            
            if (row === selectedRow && col === selectedCol) {
                // Deselect
                this.selectedSquare = null;
                this.clearHighlights();
                return;
            }
            
            if (square && square.color === this.currentPlayer) {
                // Select different piece of same color
                this.selectedSquare = [row, col];
                this.clearHighlights();
                this.highlightMoves(row, col);
                return;
            }
            
            // Attempt to move
            if (this.isValidMove(selectedRow, selectedCol, row, col)) {
                this.makeMove(selectedRow, selectedCol, row, col);
                this.selectedSquare = null;
                this.clearHighlights();
            }
        } else if (square && square.color === this.currentPlayer) {
            // Select piece
            this.selectedSquare = [row, col];
            this.highlightMoves(row, col);
        }
    }

    isValidMove(fromRow, fromCol, toRow, toCol) {
        const piece = this.board[fromRow][fromCol];
        if (!piece || piece.color !== this.currentPlayer) return false;
        
        // Check if piece is frozen
        if (this.frozenPieces.has(`${fromRow}-${fromCol}`)) return false;
        
        // Basic bounds check
        if (toRow < 0 || toRow > 7 || toCol < 0 || toCol > 7) return false;
        
        // Can't capture own piece
        const targetPiece = this.board[toRow][toCol];
        if (targetPiece && targetPiece.color === this.currentPlayer) return false;
        
        // Check piece-specific movement rules
        return this.getPieceMoves(fromRow, fromCol).some(([r, c]) => r === toRow && c === toCol);
    }

    getPieceMoves(row, col) {
        const piece = this.board[row][col];
        const moves = [];
        
        // Apply field effects that modify movement
        const modifiedMoves = this.applyFieldEffectsToMoves(piece, row, col);
        if (modifiedMoves) {
            return modifiedMoves;
        }
        
        switch (piece.type) {
            case 'pawn':
                return this.getPawnMoves(row, col);
            case 'rook':
                return this.getRookMoves(row, col);
            case 'knight':
                return this.getKnightMoves(row, col);
            case 'bishop':
                return this.getBishopMoves(row, col);
            case 'queen':
                return this.getQueenMoves(row, col);
            case 'king':
                return this.getKingMoves(row, col);
            default:
                return [];
        }
    }

    getPawnMoves(row, col) {
        const piece = this.board[row][col];
        const moves = [];
        const direction = piece.color === 'white' ? -1 : 1;
        const startRow = piece.color === 'white' ? 6 : 1;
        
        // Forward moves
        if (this.isInBounds(row + direction, col) && !this.board[row + direction][col]) {
            moves.push([row + direction, col]);
            
            // Double move from starting position
            if (row === startRow && !this.board[row + 2 * direction][col]) {
                moves.push([row + 2 * direction, col]);
            }
        }
        
        // Capture moves
        for (const colOffset of [-1, 1]) {
            const newRow = row + direction;
            const newCol = col + colOffset;
            if (this.isInBounds(newRow, newCol) && this.board[newRow][newCol] && 
                this.board[newRow][newCol].color !== piece.color) {
                moves.push([newRow, newCol]);
            }
        }
        
        return moves;
    }

    getRookMoves(row, col) {
        return this.getLinearMoves(row, col, [[0, 1], [0, -1], [1, 0], [-1, 0]]);
    }

    getBishopMoves(row, col) {
        return this.getLinearMoves(row, col, [[1, 1], [1, -1], [-1, 1], [-1, -1]]);
    }

    getQueenMoves(row, col) {
        return [...this.getRookMoves(row, col), ...this.getBishopMoves(row, col)];
    }

    getKingMoves(row, col) {
        const moves = [];
        const directions = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
        
        for (const [rowOffset, colOffset] of directions) {
            const newRow = row + rowOffset;
            const newCol = col + colOffset;
            if (this.isInBounds(newRow, newCol)) {
                moves.push([newRow, newCol]);
            }
        }
        
        return moves;
    }

    getKnightMoves(row, col) {
        const moves = [];
        const knightMoves = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
        
        for (const [rowOffset, colOffset] of knightMoves) {
            const newRow = row + rowOffset;
            const newCol = col + colOffset;
            if (this.isInBounds(newRow, newCol)) {
                moves.push([newRow, newCol]);
            }
        }
        
        return moves;
    }

    getLinearMoves(row, col, directions) {
        const moves = [];
        
        for (const [rowOffset, colOffset] of directions) {
            for (let i = 1; i < 8; i++) {
                const newRow = row + rowOffset * i;
                const newCol = col + colOffset * i;
                
                if (!this.isInBounds(newRow, newCol)) break;
                
                if (!this.board[newRow][newCol]) {
                    moves.push([newRow, newCol]);
                } else {
                    if (this.board[newRow][newCol].color !== this.board[row][col].color) {
                        moves.push([newRow, newCol]);
                    }
                    break;
                }
            }
        }
        
        return moves;
    }

    applyFieldEffectsToMoves(piece, row, col) {
        // Check for field effects that modify movement
        if (this.activeFieldEffects.includes('famine') && piece.type === 'pawn') {
            return []; // Pawns cannot move
        }
        
        if (this.activeFieldEffects.includes('sandstorm')) {
            if (piece.type === 'pawn') return []; // Pawns cannot move
            if (piece.type === 'knight') {
                // Knights move only 1 square
                const moves = [];
                const directions = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
                for (const [rowOffset, colOffset] of directions) {
                    const newRow = row + rowOffset;
                    const newCol = col + colOffset;
                    if (this.isInBounds(newRow, newCol)) {
                        moves.push([newRow, newCol]);
                    }
                }
                return moves;
            }
            // Other pieces have max range of 3 squares
            if (['rook', 'bishop', 'queen'].includes(piece.type)) {
                const moves = this.getLinearMoves(row, col, 
                    piece.type === 'rook' ? [[0, 1], [0, -1], [1, 0], [-1, 0]] :
                    piece.type === 'bishop' ? [[1, 1], [1, -1], [-1, 1], [-1, -1]] :
                    [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]]);
                return moves.filter(([r, c]) => Math.abs(r - row) <= 3 && Math.abs(c - col) <= 3);
            }
        }
        
        if (this.activeFieldEffects.includes('holiday_rejuvenation')) {
            if (piece.type === 'pawn') {
                // Pawns may move two spaces forward
                const moves = this.getPawnMoves(row, col);
                const direction = piece.color === 'white' ? -1 : 1;
                const newRow = row + 2 * direction;
                if (this.isInBounds(newRow, col) && !this.board[row + direction][col] && !this.board[newRow][col]) {
                    moves.push([newRow, col]);
                }
                return moves;
            }
            // Other pieces can jump over 1 friendly piece
            if (['rook', 'bishop', 'queen'].includes(piece.type)) {
                // This would require more complex logic to implement jumping
                return null; // Use default moves for now
            }
            if (piece.type === 'knight') {
                // Knights move 3+1 instead of 2+1
                const moves = [];
                const knightMoves = [[-3, -1], [-3, 1], [-1, -3], [-1, 3], [1, -3], [1, 3], [3, -1], [3, 1]];
                for (const [rowOffset, colOffset] of knightMoves) {
                    const newRow = row + rowOffset;
                    const newCol = col + colOffset;
                    if (this.isInBounds(newRow, newCol)) {
                        moves.push([newRow, newCol]);
                    }
                }
                return moves;
            }
        }
        
        return null; // Use default moves
    }

    isInBounds(row, col) {
        return row >= 0 && row < 8 && col >= 0 && col < 8;
    }

    highlightMoves(row, col) {
        const moves = this.getPieceMoves(row, col);
        const squareElement = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        squareElement.classList.add('selected');
        
        moves.forEach(([moveRow, moveCol]) => {
            const moveElement = document.querySelector(`[data-row="${moveRow}"][data-col="${moveCol}"]`);
            if (this.board[moveRow][moveCol]) {
                moveElement.classList.add('capture-move');
            } else {
                moveElement.classList.add('possible-move');
            }
        });
    }

    clearHighlights() {
        document.querySelectorAll('.chess-square').forEach(square => {
            square.classList.remove('selected', 'possible-move', 'capture-move');
        });
    }

    makeMove(fromRow, fromCol, toRow, toCol) {
        // In multiplayer, only allow moves for the current player's color
        if (this.isMultiplayer && !this.isSpectator) {
            if (this.currentPlayer !== this.playerColor) {
                return;
            }
        }
        
        const piece = this.board[fromRow][fromCol];
        const capturedPiece = this.board[toRow][toCol];
        
        // Check for king capture first
        if (capturedPiece && capturedPiece.type === 'king') {
            this.capturedPieces[capturedPiece.color].push(capturedPiece);
            this.updateCapturedPieces();
            this.renderBoard();
            this.addToGameLog(`${this.currentPlayer} captured the enemy king!`, 'system');
            this.endGame(this.currentPlayer);
            return;
        }
        
        // Handle capture
        if (capturedPiece) {
            this.capturedPieces[capturedPiece.color].push(capturedPiece);
            this.updateCapturedPieces();
            this.addToGameLog(`${this.currentPlayer} captured ${capturedPiece.color}'s ${capturedPiece.type}`, 'move');
        }
        
        // Move piece
        this.board[toRow][toCol] = piece;
        this.board[fromRow][fromCol] = null;
        piece.hasMoved = true;
        
        // Log the move
        const fromCoords = String.fromCharCode(97 + fromCol) + (8 - fromRow);
        const toCoords = String.fromCharCode(97 + toCol) + (8 - toRow);
        const moveNotation = capturedPiece ? `${piece.type} x ${toCoords}` : `${piece.type} to ${toCoords}`;
        this.addToGameLog(`${this.currentPlayer} ${moveNotation}`, 'move');
        
        // Store the moving piece and destination for rift effects
        this.lastMovedPiece = { piece, fromRow, fromCol, toRow, toCol };
        
        // In multiplayer, send move to server
        if (this.isMultiplayer && this.socket) {
            const move = {
                fromRow, fromCol, toRow, toCol,
                piece: piece.type,
                from: fromCoords,
                to: toCoords,
                playerName: this.playerName,
                gameState: {
                    board: this.board,
                    currentPlayer: this.currentPlayer,
                    capturedPieces: this.capturedPieces,
                    activeFieldEffects: this.activeFieldEffects
                }
            };
            
            this.socket.emit('make-move', {
                roomCode: this.roomCode,
                move: move
            });
        }
        
        // Check for rift activation
        if (this.isRift(toRow, toCol) && !this.riftActivatedThisTurn) {
            this.activateRift(toRow, toCol);
            this.riftActivatedThisTurn = true;
        } else {
            this.renderBoard();
            this.switchPlayer();
        }
    }

    activateRift(row, col) {
        const squareElement = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        squareElement.classList.add('activated');
        
        // Show rift effects modal
        this.showRiftEffectsModal();
        
        // Remove activation class after animation
        setTimeout(() => {
            squareElement.classList.remove('activated');
        }, 1000);
    }

    showRiftEffectsModal() {
        document.getElementById('rift-effects-modal').style.display = 'flex';
        document.getElementById('dice-result').textContent = '?';
        document.getElementById('rift-effect-description').textContent = 'Roll the dice to determine the rift effect!';
        document.getElementById('rift-effect-options').innerHTML = '';
        
        // Show dice roll section and reset button state
        document.querySelector('.dice-roll').style.display = 'block';
        document.getElementById('roll-dice').disabled = false;
        this.diceRolledThisTurn = false;
    }

    rollDice() {
        // Prevent multiple rolls per turn
        if (this.diceRolledThisTurn) {
            return;
        }
        
        const diceDisplay = document.getElementById('dice-result');
        const diceContainer = document.querySelector('.dice-display');
        const rollButton = document.getElementById('roll-dice');
        
        // Disable roll button and mark as rolled
        rollButton.disabled = true;
        this.diceRolledThisTurn = true;
        
        // Add rolling animation
        diceContainer.classList.add('dice-rolling');
        
        // Show random numbers during animation
        let animationCount = 0;
        const animationInterval = setInterval(() => {
            const randomNum = Math.floor(Math.random() * 20) + 1;
            diceDisplay.textContent = randomNum;
            animationCount++;
            
            if (animationCount >= 10) {
                clearInterval(animationInterval);
                
                // Final result
                const roll = Math.floor(Math.random() * 20) + 1;
                diceDisplay.textContent = roll;
                diceContainer.classList.remove('dice-rolling');
                
                const effect = this.getRiftEffect(roll);
                document.getElementById('rift-effect-title').textContent = effect.name;
                document.getElementById('rift-effect-description').textContent = effect.description;
                
                this.addToGameLog(`D20 rolled: ${roll} - ${effect.name}`, 'effect');
                this.applyRiftEffect(effect, roll);
            }
        }, 150);
    }

    getRiftEffect(roll) {
        const effects = {
            1: { name: "Necromancer's Trap", type: "special", rating: 1, description: "Remove your piece. Place one of your opponent's captured pieces onto the rift." },
            2: { name: "Archer's Trick Shot", type: "special", rating: 5, description: "Choose a direction from the rift; also applies to two adjacent directions. Range: 3 squares per direction. Remove the first piece encountered." },
            3: { name: "Sandworm", type: "special", rating: 3, description: "Remove all pieces within 1 square of the rift, plus the activating piece." },
            4: { name: "Honorable Sacrifice", type: "special", rating: 3, description: "Remove your activating piece and any one piece within 1 square." },
            5: { name: "Demotion", type: "special", rating: 1, description: "Remove your activating piece. If it was a Castle, Knight, Bishop, or Queen, place a captured Pawn of yours on the rift." },
            6: { name: "Foot Soldier's Gambit", type: "special", rating: 4, description: "The activating piece must immediately move again." },
            7: { name: "Famine", type: "field", rating: 2, description: "Pawns cannot move." },
            8: { name: "Holiday's Rejuvenation", type: "field", rating: 4, description: "Pawns may move two spaces forward. Castles, Bishops, Queens can jump over 1 friendly piece. Knights move 3+1 instead of 2+1." },
            9: { name: "Sandstorm", type: "field", rating: 2, description: "Pawns cannot move. Knights move only 1 square. Castles, Bishops, Queens max range: 3 squares. Kings cannot move unless in check." },
            10: { name: "Dragon's Breath", type: "special", rating: 4, description: "Choose a direction; remove any piece up to 3 squares away in a straight line." },
            11: { name: "Jack Frost's Mischief", type: "field", rating: 2, description: "After moving, roll a D20: Odd = nothing happens. Even = piece moves 1 extra square in same direction." },
            12: { name: "Portal in the Rift", type: "special", rating: 4, description: "Move the activating piece to another unactivated rift." },
            13: { name: "Catapult Roulette", type: "special", rating: 3, description: "Roll 2D8 to choose a random square (column A–H, row 1–8). Remove any piece on that square." },
            14: { name: "Conqueror's Tale", type: "special", rating: 5, description: "Your king gains the ability to move twice per turn for the rest of the game." },
            15: { name: "Medusa's Gaze", type: "special", rating: 2, description: "The activating piece is frozen in place and cannot be moved/removed (except by other rifts)." },
            16: { name: "Time Distortion/Stasis", type: "field", rating: 3, description: "All pieces within a radius are frozen (cannot move)." },
            17: { name: "Crossroad Demon's Deal", type: "special", rating: 2, description: "You may decline this effect before rolling. If accepted: remove your activating piece, roll a D20." },
            18: { name: "Fairy Fountain", type: "special", rating: 2, description: "Activating Pawn gains new movement: Forward 2 spaces, plus 1 space left/right." },
            19: { name: "Eerie Fog's Turmoil", type: "field", rating: 2, description: "At the start of your turn, roll a D20: 3–20 = play normally. 1–2 = skip your turn." },
            20: { name: "Spring of Revival", type: "special", rating: 5, description: "Place one of your captured pieces onto a starting square." },
            21: { name: "Blank", type: "field", rating: 3, description: "Pawns may now move sideways to capture." }
        };
        
        return effects[roll] || effects[21]; // Default to blank effect
    }

    applyRiftEffect(effect, roll) {
        const riftRow = this.lastMovedPiece.toRow;
        const riftCol = this.lastMovedPiece.toCol;
        const activatingPiece = this.lastMovedPiece.piece;
        
        // In multiplayer, send rift effect to server
        if (this.isMultiplayer && this.socket) {
            this.socket.emit('rift-effect', {
                roomCode: this.roomCode,
                effect: { ...effect, roll: roll, riftRow, riftCol, activatingPiece }
            });
        }
        
        // Store current game state for potential reversals
        const previousBoard = JSON.parse(JSON.stringify(this.board));
        const previousCaptured = JSON.parse(JSON.stringify(this.capturedPieces));
        
        try {
            switch (roll) {
                case 1: // Necromancer's Trap
                    this.applyNecromancerTrap(riftRow, riftCol, activatingPiece);
                    break;
                case 2: // Archer's Trick Shot
                    this.showArcherDirectionChoice(riftRow, riftCol);
                    return; // Don't close modal yet
                case 3: // Sandworm
                    this.applySandworm(riftRow, riftCol);
                    break;
                case 4: // Honorable Sacrifice
                    this.applyHonorableSacrifice(riftRow, riftCol, activatingPiece);
                    break;
                case 5: // Demotion
                    this.applyDemotion(riftRow, riftCol, activatingPiece);
                    break;
                case 6: // Foot Soldier's Gambit
                    this.applyFootSoldierGambit(activatingPiece, riftRow, riftCol);
                    break;
                case 7: // Famine
                    this.applyFieldEffect('famine');
                    break;
                case 8: // Holiday's Rejuvenation
                    this.applyFieldEffect('holiday_rejuvenation');
                    break;
                case 9: // Sandstorm
                    this.applyFieldEffect('sandstorm');
                    break;
                case 10: // Dragon's Breath
                    this.showDragonDirectionChoice(riftRow, riftCol);
                    return; // Don't close modal yet
                case 11: // Jack Frost's Mischief
                    this.applyFieldEffect('jack_frost_mischief');
                    break;
                case 12: // Portal in the Rift
                    this.showPortalChoice(riftRow, riftCol, activatingPiece);
                    return; // Don't close modal yet
                case 13: // Catapult Roulette
                    this.applyCatapultRoulette();
                    break;
                case 14: // Conqueror's Tale
                    this.applyConquerorTale(activatingPiece.color);
                    break;
                case 15: // Medusa's Gaze
                    this.applyMedusaGaze(riftRow, riftCol);
                    break;
                case 16: // Time Distortion/Stasis
                    this.applyTimeDistortion(riftRow, riftCol);
                    break;
                case 17: // Crossroad Demon's Deal
                    this.showCrossroadDemonChoice(riftRow, riftCol, activatingPiece);
                    return; // Don't close modal yet
                case 18: // Fairy Fountain
                    this.applyFairyFountain(riftRow, riftCol, activatingPiece);
                    break;
                case 19: // Eerie Fog's Turmoil
                    this.applyFieldEffect('eerie_fog_turmoil');
                    break;
                case 20: // Spring of Revival
                    this.applySpringOfRevival(activatingPiece.color);
                    break;
                case 21: // Blank
                    this.applyFieldEffect('blank');
                    break;
                default:
                    this.applyFieldEffect('blank');
                    break;
            }
        } catch (error) {
            console.error('Error applying rift effect:', error);
            // Revert game state if effect fails
            this.board = previousBoard;
            this.capturedPieces = previousCaptured;
        }
        
        this.renderBoard();
        this.updateCapturedPieces();
        this.updateFieldEffects();
        
        // Don't auto-close modal - let player choose when to close
        // this.closeModal() and this.switchPlayer() will be called when player clicks "Close"
    }

    closeModal() {
        document.getElementById('rift-effects-modal').style.display = 'none';
        this.switchPlayer();
    }

    // Game Log and Chat Functions
    addToGameLog(message, type = 'system') {
        const timestamp = new Date().toLocaleTimeString();
        this.gameLog.push({ message, type, timestamp });
        this.updateGameLog();
    }

    updateGameLog() {
        const logContent = document.getElementById('game-log-content');
        logContent.innerHTML = '';
        
        this.gameLog.slice(-20).forEach(entry => {
            const logEntry = document.createElement('div');
            logEntry.className = `log-entry ${entry.type}`;
            logEntry.textContent = `[${entry.timestamp}] ${entry.message}`;
            logContent.appendChild(logEntry);
        });
        
        logContent.scrollTop = logContent.scrollHeight;
    }

    sendChatMessage() {
        const chatInput = document.getElementById('chat-input');
        const message = chatInput.value.trim();
        
        if (message) {
            this.chatMessages.push({
                message,
                player: this.currentPlayer,
                timestamp: new Date().toLocaleTimeString()
            });
            this.updateChatMessages();
            chatInput.value = '';
        }
    }

    updateChatMessages() {
        const chatMessages = document.getElementById('chat-messages');
        chatMessages.innerHTML = '';
        
        this.chatMessages.slice(-10).forEach(msg => {
            const chatMessage = document.createElement('div');
            chatMessage.className = `chat-message ${msg.player === this.currentPlayer ? 'own' : 'opponent'}`;
            chatMessage.textContent = `[${msg.timestamp}] ${msg.player}: ${msg.message}`;
            chatMessages.appendChild(chatMessage);
        });
        
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Enhanced piece removal with animation
    removePieceWithAnimation(row, col, delay = 0) {
        setTimeout(() => {
            const square = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
            if (square && square.firstChild) {
                square.firstChild.classList.add('piece-removing');
                setTimeout(() => {
                    this.board[row][col] = null;
                    this.renderBoard();
                }, 1500);
            } else {
                this.board[row][col] = null;
                this.renderBoard();
            }
        }, delay);
    }

    // Choice-based rift effects
    showCrossroadDemonChoice(riftRow, riftCol, activatingPiece) {
        const optionsDiv = document.getElementById('rift-effect-options');
        optionsDiv.innerHTML = `
            <div class="effect-choices">
                <button class="effect-choice decline" onclick="game.acceptCrossroadDemonDeal(${riftRow}, ${riftCol}, '${activatingPiece.color}', false)">
                    Decline Deal
                </button>
                <button class="effect-choice accept" onclick="game.acceptCrossroadDemonDeal(${riftRow}, ${riftCol}, '${activatingPiece.color}', true)">
                    Accept Deal
                </button>
            </div>
        `;
        this.addToGameLog(`Crossroad Demon's Deal activated! Choose to accept or decline.`, 'effect');
    }

    acceptCrossroadDemonDeal(riftRow, riftCol, color, accepted) {
        if (!accepted) {
            this.addToGameLog(`${color} declined Crossroad Demon's Deal.`, 'effect');
            this.closeModal();
            return;
        }

        // Remove activating piece
        this.removePieceWithAnimation(riftRow, riftCol);
        this.capturedPieces[color].push(this.lastMovedPiece.piece);
        
        // Roll D20 for additional pieces to remove
        const additionalRoll = Math.floor(Math.random() * 20) + 1;
        const piecesToRemove = additionalRoll % 2 === 0 ? 2 : 1;
        
        this.addToGameLog(`Crossroad Demon's Deal accepted! Rolling for additional pieces... (${additionalRoll})`, 'effect');
        
        // Remove additional pieces with animation
        let removed = 0;
        for (let row = 0; row < 8 && removed < piecesToRemove; row++) {
            for (let col = 0; col < 8 && removed < piecesToRemove; col++) {
                if (this.board[row][col] && this.board[row][col].color === this.currentPlayer && 
                    this.board[row][col].type !== 'king') {
                    this.capturedPieces[this.currentPlayer].push(this.board[row][col]);
                    this.removePieceWithAnimation(row, col, removed * 500);
                    removed++;
                }
            }
        }

        // Revive a captured piece
        const capturedNonPawns = this.capturedPieces[this.currentPlayer].filter(p => p.type !== 'pawn');
        if (capturedNonPawns.length > 0) {
            const randomPiece = capturedNonPawns[Math.floor(Math.random() * capturedNonPawns.length)];
            this.board[riftRow][riftCol] = randomPiece;
            this.capturedPieces[this.currentPlayer] = this.capturedPieces[this.currentPlayer].filter(p => p !== randomPiece);
            this.addToGameLog(`${randomPiece.type} revived on rift!`, 'effect');
        }

        setTimeout(() => {
            this.closeModal();
        }, 2000);
    }

    showPortalChoice(riftRow, riftCol, activatingPiece) {
        const availableRifts = this.rifts.filter(rift => 
            rift.row !== riftRow || rift.col !== riftCol
        );
        
        if (availableRifts.length === 0) {
            this.addToGameLog('No other rifts available for teleportation!', 'effect');
            this.closeModal();
            return;
        }

        const optionsDiv = document.getElementById('rift-effect-options');
        let buttonsHtml = '<div class="effect-choices">';
        
        availableRifts.forEach((rift, index) => {
            const coords = String.fromCharCode(97 + rift.col) + (8 - rift.row);
            buttonsHtml += `
                <button class="effect-choice" onclick="game.teleportToRift(${riftRow}, ${riftCol}, ${rift.row}, ${rift.col}, '${activatingPiece.color}')">
                    Teleport to ${coords.toUpperCase()}
                </button>
            `;
        });
        
        buttonsHtml += '</div>';
        optionsDiv.innerHTML = buttonsHtml;
        this.addToGameLog(`Portal in the Rift activated! Choose destination rift.`, 'effect');
    }

    teleportToRift(fromRow, fromCol, toRow, toCol, color) {
        const piece = this.board[fromRow][fromCol];
        
        // Remove piece from original location
        this.removePieceWithAnimation(fromRow, fromCol);
        
        // If destination is occupied, remove that piece
        if (this.board[toRow][toCol]) {
            this.capturedPieces[this.board[toRow][toCol].color].push(this.board[toRow][toCol]);
            this.removePieceWithAnimation(toRow, toCol, 500);
        }
        
        // Place piece at destination
        setTimeout(() => {
            this.board[toRow][toCol] = piece;
            this.renderBoard();
            this.addToGameLog(`Piece teleported to ${String.fromCharCode(97 + toCol)}${8 - toRow}!`, 'effect');
        }, 1000);

        setTimeout(() => {
            this.closeModal();
        }, 2000);
    }

    showArcherDirectionChoice(riftRow, riftCol) {
        const directions = [
            { name: 'North', dr: -1, dc: 0 },
            { name: 'Northeast', dr: -1, dc: 1 },
            { name: 'East', dr: 0, dc: 1 },
            { name: 'Southeast', dr: 1, dc: 1 },
            { name: 'South', dr: 1, dc: 0 },
            { name: 'Southwest', dr: 1, dc: -1 },
            { name: 'West', dr: 0, dc: -1 },
            { name: 'Northwest', dr: -1, dc: -1 }
        ];

        const optionsDiv = document.getElementById('rift-effect-options');
        let buttonsHtml = '<div class="effect-choices">';
        
        directions.forEach((dir, index) => {
            buttonsHtml += `
                <button class="effect-choice" onclick="game.executeArcherShot(${riftRow}, ${riftCol}, ${dir.dr}, ${dir.dc})">
                    ${dir.name}
                </button>
            `;
        });
        
        buttonsHtml += '</div>';
        optionsDiv.innerHTML = buttonsHtml;
        this.addToGameLog(`Archer's Trick Shot activated! Choose direction.`, 'effect');
    }

    executeArcherShot(riftRow, riftCol, dr, dc) {
        const directions = [
            { dr: dr, dc: dc },
            { dr: dr - dc, dc: dr + dc }, // 90 degrees
            { dr: -dr, dc: -dc }, // 180 degrees
            { dr: dc, dc: -dr } // 270 degrees
        ];

        let piecesRemoved = 0;
        
        directions.forEach((dir, index) => {
            for (let distance = 1; distance <= 3; distance++) {
                const targetRow = riftRow + (dir.dr * distance);
                const targetCol = riftCol + (dir.dc * distance);
                
                if (targetRow >= 0 && targetRow < 8 && targetCol >= 0 && targetCol < 8) {
                    if (this.board[targetRow][targetCol]) {
                        this.capturedPieces[this.board[targetRow][targetCol].color].push(this.board[targetRow][targetCol]);
                        this.removePieceWithAnimation(targetRow, targetCol, piecesRemoved * 300);
                        piecesRemoved++;
                        break; // Only remove first piece in each direction
                    }
                }
            }
        });

        this.addToGameLog(`Archer's Trick Shot fired! ${piecesRemoved} pieces removed.`, 'effect');
        
        setTimeout(() => {
            this.closeModal();
        }, 2000);
    }

    showDragonDirectionChoice(riftRow, riftCol) {
        const directions = [
            { name: 'North', dr: -1, dc: 0 },
            { name: 'Northeast', dr: -1, dc: 1 },
            { name: 'East', dr: 0, dc: 1 },
            { name: 'Southeast', dr: 1, dc: 1 },
            { name: 'South', dr: 1, dc: 0 },
            { name: 'Southwest', dr: 1, dc: -1 },
            { name: 'West', dr: 0, dc: -1 },
            { name: 'Northwest', dr: -1, dc: -1 }
        ];

        const optionsDiv = document.getElementById('rift-effect-options');
        let buttonsHtml = '<div class="effect-choices">';
        
        directions.forEach((dir, index) => {
            buttonsHtml += `
                <button class="effect-choice" onclick="game.executeDragonBreath(${riftRow}, ${riftCol}, ${dir.dr}, ${dir.dc})">
                    ${dir.name}
                </button>
            `;
        });
        
        buttonsHtml += '</div>';
        optionsDiv.innerHTML = buttonsHtml;
        this.addToGameLog(`Dragon's Breath activated! Choose direction.`, 'effect');
    }

    executeDragonBreath(riftRow, riftCol, dr, dc) {
        let piecesRemoved = 0;
        
        for (let distance = 1; distance <= 3; distance++) {
            const targetRow = riftRow + (dr * distance);
            const targetCol = riftCol + (dc * distance);
            
            if (targetRow >= 0 && targetRow < 8 && targetCol >= 0 && targetCol < 8) {
                if (this.board[targetRow][targetCol] && this.board[targetRow][targetCol].color !== this.currentPlayer) {
                    this.capturedPieces[this.board[targetRow][targetCol].color].push(this.board[targetRow][targetCol]);
                    this.removePieceWithAnimation(targetRow, targetCol, piecesRemoved * 400);
                    piecesRemoved++;
                }
            }
        }

        this.addToGameLog(`Dragon's Breath fired! ${piecesRemoved} enemy pieces removed.`, 'effect');
        
        setTimeout(() => {
            this.closeModal();
        }, 2000);
    }

    // Settings Functions
    toggleSettingsPanel() {
        const panel = document.getElementById('settings-panel');
        panel.classList.toggle('show');
    }

    toggleDarkMode() {
        this.darkMode = !this.darkMode;
        const body = document.body;
        const toggle = document.getElementById('dark-mode-toggle');
        
        if (this.darkMode) {
            body.classList.add('dark-mode');
            toggle.classList.add('active');
        } else {
            body.classList.remove('dark-mode');
            toggle.classList.remove('active');
        }
        
        this.saveSettings();
    }

    loadSettings() {
        const savedDarkMode = localStorage.getItem('chessRiftsDarkMode');
        if (savedDarkMode === 'true') {
            this.darkMode = true;
            document.body.classList.add('dark-mode');
            document.getElementById('dark-mode-toggle').classList.add('active');
        }
    }

    saveSettings() {
        localStorage.setItem('chessRiftsDarkMode', this.darkMode.toString());
    }

    // Individual Rift Effect Implementations
    applyNecromancerTrap(riftRow, riftCol, activatingPiece) {
        // Remove activating piece with animation
        this.removePieceWithAnimation(riftRow, riftCol);
        
        // Place opponent's captured piece if available
        const opponentColor = activatingPiece.color === 'white' ? 'black' : 'white';
        if (this.capturedPieces[opponentColor].length > 0) {
            const pieceToResurrect = this.capturedPieces[opponentColor].pop();
            setTimeout(() => {
                this.board[riftRow][riftCol] = pieceToResurrect;
                this.renderBoard();
                this.addToGameLog(`Necromancer's Trap: ${pieceToResurrect.type} resurrected!`, 'effect');
            }, 1500);
            this.updateCapturedPieces();
        }
    }

    applyArcherTrickShot(riftRow, riftCol) {
        // This would need UI to select direction - for now, remove pieces in all 8 directions
        const directions = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
        
        directions.forEach(([rowOffset, colOffset]) => {
            for (let i = 1; i <= 3; i++) {
                const targetRow = riftRow + (rowOffset * i);
                const targetCol = riftCol + (colOffset * i);
                
                if (this.isInBounds(targetRow, targetCol) && this.board[targetRow][targetCol]) {
                    const piece = this.board[targetRow][targetCol];
                    if (piece.color !== this.currentPlayer) {
                        this.capturedPieces[piece.color].push(piece);
                        this.board[targetRow][targetCol] = null;
                        break; // Only remove first piece in direction
                    }
                }
            }
        });
    }

    applySandworm(riftRow, riftCol) {
        // Remove all pieces within 1 square of the rift with animation
        let delay = 0;
        for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
            for (let colOffset = -1; colOffset <= 1; colOffset++) {
                const targetRow = riftRow + rowOffset;
                const targetCol = riftCol + colOffset;
                
                if (this.isInBounds(targetRow, targetCol) && this.board[targetRow][targetCol]) {
                    const piece = this.board[targetRow][targetCol];
                    this.capturedPieces[piece.color].push(piece);
                    this.removePieceWithAnimation(targetRow, targetCol, delay);
                    delay += 200;
                }
            }
        }
        this.addToGameLog(`Sandworm devours all nearby pieces!`, 'effect');
    }

    applyHonorableSacrifice(riftRow, riftCol, activatingPiece) {
        // Remove activating piece with animation
        this.removePieceWithAnimation(riftRow, riftCol);
        this.capturedPieces[activatingPiece.color].push(activatingPiece);
        
        // Remove any enemy piece within 1 square with animation
        const directions = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
        for (const [rowOffset, colOffset] of directions) {
            const targetRow = riftRow + rowOffset;
            const targetCol = riftCol + colOffset;
            
            if (this.isInBounds(targetRow, targetCol) && this.board[targetRow][targetCol]) {
                const piece = this.board[targetRow][targetCol];
                if (piece.color !== this.currentPlayer) {
                    this.capturedPieces[piece.color].push(piece);
                    this.removePieceWithAnimation(targetRow, targetCol, 500);
                    this.addToGameLog(`Honorable Sacrifice: Enemy piece removed!`, 'effect');
                    break; // Only remove one piece
                }
            }
        }
    }

    applyDemotion(riftRow, riftCol, activatingPiece) {
        // Remove activating piece with animation
        this.removePieceWithAnimation(riftRow, riftCol);
        this.capturedPieces[activatingPiece.color].push(activatingPiece);
        
        // Place captured pawn if available and piece was not a pawn
        if (['rook', 'knight', 'bishop', 'queen'].includes(activatingPiece.type)) {
            const capturedPawns = this.capturedPieces[activatingPiece.color].filter(p => p.type === 'pawn');
            if (capturedPawns.length > 0) {
                const pawnIndex = this.capturedPieces[activatingPiece.color].findIndex(p => p.type === 'pawn');
                const pawn = this.capturedPieces[activatingPiece.color].splice(pawnIndex, 1)[0];
                setTimeout(() => {
                    this.board[riftRow][riftCol] = pawn;
                    this.renderBoard();
                    this.addToGameLog(`Demotion: ${activatingPiece.type} demoted to pawn!`, 'effect');
                }, 1500);
            }
        } else {
            this.addToGameLog(`Demotion: Pawn cannot be demoted further.`, 'effect');
        }
    }

    applyFootSoldierGambit(activatingPiece, riftRow, riftCol) {
        // Mark piece for extra move
        this.extraMovePiece = { piece: activatingPiece, row: riftRow, col: riftCol };
        // This would require UI interaction to select the second move
    }

    applyDragonBreath(riftRow, riftCol) {
        // Remove pieces in all 4 cardinal directions up to 3 squares
        const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        
        directions.forEach(([rowOffset, colOffset]) => {
            for (let i = 1; i <= 3; i++) {
                const targetRow = riftRow + (rowOffset * i);
                const targetCol = riftCol + (colOffset * i);
                
                if (this.isInBounds(targetRow, targetCol) && this.board[targetRow][targetCol]) {
                    const piece = this.board[targetRow][targetCol];
                    if (piece.color !== this.currentPlayer) {
                        this.capturedPieces[piece.color].push(piece);
                        this.board[targetRow][targetCol] = null;
                        break; // Only remove first piece in direction
                    }
                }
            }
        });
    }

    applyPortalInRift(riftRow, riftCol, activatingPiece) {
        // Find another rift
        const otherRifts = this.rifts.filter(rift => !(rift.row === riftRow && rift.col === riftCol));
        if (otherRifts.length > 0) {
            const targetRift = otherRifts[0];
            
            // If target rift is occupied, remove the piece
            if (this.board[targetRift.row][targetRift.col]) {
                const piece = this.board[targetRift.row][targetRift.col];
                this.capturedPieces[piece.color].push(piece);
            }
            
            // Move piece to target rift
            this.board[targetRift.row][targetRift.col] = activatingPiece;
            this.board[riftRow][riftCol] = null;
        }
    }

    applyCatapultRoulette() {
        // Roll 2D8 for random position
        const col = Math.floor(Math.random() * 8);
        const row = Math.floor(Math.random() * 8);
        
        if (this.board[row][col]) {
            const piece = this.board[row][col];
            this.capturedPieces[piece.color].push(piece);
            this.board[row][col] = null;
        }
    }

    applyConquerorTale(playerColor) {
        // Give king double move ability
        this.kingAbilities[playerColor] = { ...this.kingAbilities[playerColor], doubleMove: true };
    }

    applyMedusaGaze(riftRow, riftCol) {
        // Freeze the piece on the rift
        this.frozenPieces.add(`${riftRow}-${riftCol}`);
    }

    applyTimeDistortion(riftRow, riftCol) {
        // Roll for radius
        const radiusRoll = Math.floor(Math.random() * 20) + 1;
        let radius = 1;
        if (radiusRoll >= 9 && radiusRoll <= 14) radius = 2;
        else if (radiusRoll >= 15 && radiusRoll <= 18) radius = 3;
        else if (radiusRoll >= 19) radius = 4;
        
        // Freeze all pieces within radius
        for (let rowOffset = -radius; rowOffset <= radius; rowOffset++) {
            for (let colOffset = -radius; colOffset <= radius; colOffset++) {
                const targetRow = riftRow + rowOffset;
                const targetCol = riftCol + colOffset;
                
                if (this.isInBounds(targetRow, targetCol) && this.board[targetRow][targetCol]) {
                    this.frozenPieces.add(`${targetRow}-${targetCol}`);
                }
            }
        }
    }

    applyCrossroadDemonDeal(riftRow, riftCol, activatingPiece) {
        // Remove activating piece
        this.board[riftRow][riftCol] = null;
        this.capturedPieces[activatingPiece.color].push(activatingPiece);
        
        // Roll D20 for additional pieces to remove
        const additionalRoll = Math.floor(Math.random() * 20) + 1;
        const piecesToRemove = additionalRoll % 2 === 0 ? 2 : 1;
        
        // Remove additional pieces (simplified - just remove random pieces)
        let removed = 0;
        for (let row = 0; row < 8 && removed < piecesToRemove; row++) {
            for (let col = 0; col < 8 && removed < piecesToRemove; col++) {
                if (this.board[row][col] && this.board[row][col].color === this.currentPlayer && 
                    this.board[row][col].type !== 'king') {
                    this.capturedPieces[this.currentPlayer].push(this.board[row][col]);
                    this.board[row][col] = null;
                    removed++;
                }
            }
        }
        
        // Place opponent's captured piece
        const opponentColor = this.currentPlayer === 'white' ? 'black' : 'white';
        const nonPawnPieces = this.capturedPieces[opponentColor].filter(p => p.type !== 'pawn');
        if (nonPawnPieces.length > 0) {
            const pieceIndex = this.capturedPieces[opponentColor].findIndex(p => p.type !== 'pawn');
            const piece = this.capturedPieces[opponentColor].splice(pieceIndex, 1)[0];
            this.board[riftRow][riftCol] = piece;
        }
    }

    applyFairyFountain(riftRow, riftCol, activatingPiece) {
        // Only affects pawns - give them enhanced movement
        if (activatingPiece.type === 'pawn') {
            activatingPiece.fairyFountain = true;
        }
    }

    applySpringOfRevival(playerColor) {
        // Place captured piece on starting square
        if (this.capturedPieces[playerColor].length > 0) {
            const piece = this.capturedPieces[playerColor].pop();
            const startRow = playerColor === 'white' ? 7 : 0;
            
            // Find an empty starting square
            for (let col = 0; col < 8; col++) {
                if (!this.board[startRow][col]) {
                    this.board[startRow][col] = piece;
                    break;
                }
            }
        }
    }

    applyFieldEffect(effectName) {
        // Remove any existing field effects
        this.activeFieldEffects = [];
        
        // Add the new field effect
        if (effectName !== 'blank') {
            this.activeFieldEffects.push(effectName);
            this.addToGameLog(`Field effect activated: ${effectName.replace(/_/g, ' ')}`, 'effect');
        } else {
            this.addToGameLog(`Field effect activated: Blank (Pawns may capture sideways)`, 'effect');
        }
    }

    switchPlayer() {
        this.currentPlayer = this.currentPlayer === 'white' ? 'black' : 'white';
        this.riftActivatedThisTurn = false;
        this.diceRolledThisTurn = false;
        this.updateUI();
        this.addToGameLog(`${this.currentPlayer}'s turn`, 'system');
        
        // Check for win conditions
        if (this.isCheckmate(this.currentPlayer)) {
            this.endGame(this.currentPlayer === 'white' ? 'black' : 'white');
        }
    }

    isCheckmate(player) {
        // Simplified checkmate detection - in a full implementation, this would be more complex
        return false; // Placeholder
    }

    endGame(winner) {
        this.gamePhase = 'ended';
        const winnerText = winner.charAt(0).toUpperCase() + winner.slice(1);
        document.getElementById('victory-message').textContent = `${winnerText} wins!`;
        document.getElementById('victory-modal').style.display = 'flex';
        this.addToGameLog(`🎉 ${winnerText} wins the game! 🎉`, 'system');
    }

    updateUI() {
        // Update current player display with name in multiplayer
        if (this.isMultiplayer && this.playerName) {
            const playerDisplay = this.currentPlayer.charAt(0).toUpperCase() + this.currentPlayer.slice(1);
            document.getElementById('current-player').textContent = `${playerDisplay} (${this.playerName})`;
        } else {
            document.getElementById('current-player').textContent = this.currentPlayer.charAt(0).toUpperCase() + this.currentPlayer.slice(1);
        }
        
        document.getElementById('game-phase').textContent = this.gamePhase === 'setup' ? 'Setup - Place Rifts' : 'Playing';
        
        document.getElementById('setup-controls').style.display = this.gamePhase === 'setup' ? 'block' : 'none';
        document.getElementById('game-controls-panel').style.display = this.gamePhase === 'playing' ? 'block' : 'none';
        
        // Hide multiplayer button when in multiplayer mode
        const multiplayerBtn = document.getElementById('multiplayer-btn');
        if (this.isMultiplayer) {
            multiplayerBtn.style.display = 'none';
        } else {
            multiplayerBtn.style.display = 'block';
        }
    }

    updateCapturedPieces() {
        const whiteContainer = document.getElementById('captured-white-pieces');
        const blackContainer = document.getElementById('captured-black-pieces');
        
        whiteContainer.innerHTML = this.capturedPieces.white.map(piece => 
            `<span class="captured-piece">${this.getPieceSymbol(piece)}</span>`
        ).join('');
        
        blackContainer.innerHTML = this.capturedPieces.black.map(piece => 
            `<span class="captured-piece">${this.getPieceSymbol(piece)}</span>`
        ).join('');
    }

    updateFieldEffects() {
        const effectsList = document.getElementById('field-effects-list');
        effectsList.innerHTML = '';
        
        this.activeFieldEffects.forEach(effect => {
            const effectElement = document.createElement('div');
            effectElement.className = 'field-effect-item';
            effectElement.textContent = effect.replace(/_/g, ' ');
            effectElement.addEventListener('click', () => this.showFieldEffectDetails(effect));
            effectsList.appendChild(effectElement);
        });
    }

    showFieldEffectDetails(effectName) {
        const effectDescriptions = {
            'famine': 'Pawns cannot move while this effect is active.',
            'holiday_rejuvenation': 'Pawns may advance two spaces forward. Castles, Bishops, and Queens may jump over one friendly piece. Knights move in a "3 + 1" pattern.',
            'sandstorm': 'Pawns cannot move. Knights move only 1 square. Castles, Bishops, Queens max range: 3 squares. Kings cannot move unless in check.',
            'jack_frost_mischief': 'After moving a piece, roll a D20: Odd = no effect. Even = the piece slides 1 extra square forward.',
            'eerie_fog_turmoil': 'At the start of your turn, roll a D20: 3–20 = proceed normally. 1–2 = turn skipped.',
            'blank': 'Pawns may capture sideways.'
        };

        const description = effectDescriptions[effectName] || 'Unknown field effect.';
        
        // Show in modal - DISPLAY ONLY, no rolling allowed
        document.getElementById('rift-effect-title').textContent = `Field Effect: ${effectName.replace(/_/g, ' ')}`;
        document.getElementById('rift-effect-description').textContent = description;
        document.getElementById('rift-effect-options').innerHTML = '';
        
        // Hide dice roll section for field effect display
        document.querySelector('.dice-roll').style.display = 'none';
        
        document.getElementById('rift-effects-modal').style.display = 'flex';
        
        this.addToGameLog(`Field effect "${effectName.replace(/_/g, ' ')}" viewed: ${description}`, 'effect');
    }

    resign() {
        if (confirm('Are you sure you want to resign?')) {
            this.endGame(this.currentPlayer === 'white' ? 'black' : 'white');
        }
    }

    newGame() {
        document.getElementById('victory-modal').style.display = 'none';
        this.gamePhase = 'setup';
        this.rifts = [];
        this.currentPlayer = 'white';
        this.capturedPieces = { white: [], black: [] };
        this.activeFieldEffects = [];
        this.frozenPieces.clear();
        this.riftActivatedThisTurn = false;
        this.diceRolledThisTurn = false;
        this.initializeBoard();
        this.renderBoard();
        this.updateUI();
        this.updateCapturedPieces();
        this.updateFieldEffects();
        this.clearHighlights();
    }

    // Multiplayer functions
    showMultiplayerModal() {
        document.getElementById('room-modal').style.display = 'flex';
    }

    closeMultiplayerModal() {
        document.getElementById('room-modal').style.display = 'none';
    }

    updateMultiplayerStatus(players, spectators) {
        const multiplayerStatus = document.getElementById('multiplayer-status');
        const roomPlayersDisplay = document.getElementById('room-players-display');
        const roomSpectatorsDisplay = document.getElementById('room-spectators-display');
        
        if (this.isMultiplayer) {
            multiplayerStatus.style.display = 'block';
            
            // Update players display
            roomPlayersDisplay.innerHTML = '';
            players.forEach(player => {
                const playerDiv = document.createElement('div');
                playerDiv.className = 'room-player-item';
                playerDiv.textContent = `${player.name} (${player.color || 'waiting...'})`;
                roomPlayersDisplay.appendChild(playerDiv);
            });
            
            // Update spectators display
            roomSpectatorsDisplay.innerHTML = '';
            spectators.forEach(spectator => {
                const spectatorDiv = document.createElement('div');
                spectatorDiv.className = 'room-spectator-item';
                spectatorDiv.textContent = `${spectator.name} (spectator)`;
                roomSpectatorsDisplay.appendChild(spectatorDiv);
            });
        } else {
            multiplayerStatus.style.display = 'none';
        }
    }

    createRoom() {
        const playerName = document.getElementById('player-name-input').value.trim();
        if (!playerName) {
            alert('Please enter your name');
            return;
        }

        this.playerName = playerName;
        this.connectToServer();
        
        // Generate a random room code for display
        const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        document.getElementById('room-code-input').value = roomCode;
        this.joinRoom();
    }

    joinRoom() {
        const roomCode = document.getElementById('room-code-input').value.trim().toUpperCase();
        const playerName = document.getElementById('player-name-input').value.trim();
        
        if (!roomCode || !playerName) {
            alert('Please enter both room code and your name');
            return;
        }

        this.roomCode = roomCode;
        this.playerName = playerName;
        
        if (!this.socket) {
            this.connectToServer();
        } else {
            this.socket.emit('join-room', { roomCode, playerName });
        }
    }

        connectToServer() {
            // Use Railway URL in production, localhost in development
            const serverUrl = window.location.hostname === 'localhost' ? 'http://localhost:3000' : 'https://web-production-4da5.up.railway.app';
            this.socket = io(serverUrl);
        
        this.socket.on('room-updated', (data) => {
            this.updateRoomInfo(data);
        });

        this.socket.on('room-full', () => {
            alert('Room is full!');
        });

        this.socket.on('game-started', (data) => {
            this.handleGameStarted(data);
        });

        this.socket.on('move-made', (data) => {
            this.handleMoveMade(data);
        });

        this.socket.on('rift-effect-applied', (data) => {
            this.handleRiftEffect(data);
        });

        if (this.roomCode && this.playerName) {
            this.socket.emit('join-room', { roomCode: this.roomCode, playerName: this.playerName });
        }
    }

    updateRoomInfo(data) {
        const { players, spectators, gamePhase, coinFlipResult } = data;
        
        // Update room info display
        document.getElementById('current-room-code').textContent = this.roomCode;
        document.getElementById('room-info').style.display = 'block';
        
        // Update players list
        const playersList = document.getElementById('players-list');
        playersList.innerHTML = '';
        players.forEach(player => {
            const playerDiv = document.createElement('div');
            playerDiv.className = 'player-item';
            playerDiv.textContent = `${player.name} (${player.color || 'waiting...'})`;
            playersList.appendChild(playerDiv);
            
            // Set our color if we're this player
            if (player.name === this.playerName) {
                this.playerColor = player.color;
                this.isMultiplayer = true;
                this.isSpectator = false;
            }
        });
        
        // Update spectators list
        const spectatorsList = document.getElementById('spectators-list');
        spectatorsList.innerHTML = '';
        spectators.forEach(spectator => {
            const spectatorDiv = document.createElement('div');
            spectatorDiv.className = 'spectator-item';
            spectatorDiv.textContent = spectator.name;
            spectatorsList.appendChild(spectatorDiv);
            
            // Set spectator mode if we're this spectator
            if (spectator.name === this.playerName) {
                this.isMultiplayer = true;
                this.isSpectator = true;
            }
        });
        
        // Show coin flip result
        if (coinFlipResult !== null) {
            document.getElementById('coin-flip-result').style.display = 'block';
            const coinFlipText = coinFlipResult ? 'White goes first' : 'Black goes first';
            document.getElementById('coin-flip-text').textContent = coinFlipText;
            
            // Auto-close room modal after coin flip and start game phase
            if (gamePhase === 'setup') {
                setTimeout(() => {
                    this.closeMultiplayerModal();
                    this.gamePhase = 'setup';
                    this.updateUI();
                }, 2000); // Close after 2 seconds
            }
        }
        
        // Show leave room button
        document.getElementById('leave-room-btn').style.display = 'block';
        
        // Update game phase
        if (gamePhase === 'setup' && this.isMultiplayer && !this.isSpectator) {
            this.gamePhase = 'setup';
            this.updateUI();
        }
        
        // Update multiplayer status display
        this.updateMultiplayerStatus(players, spectators);
    }

    handleGameStarted(data) {
        const { gameState, currentPlayer } = data;
        this.board = gameState.board;
        this.currentPlayer = currentPlayer;
        this.gamePhase = 'playing';
        this.renderBoard();
        this.updateUI();
        this.addToGameLog('Game started!', 'system');
    }

    handleMoveMade(data) {
        const { move, currentPlayer, gameState } = data;
        this.board = gameState.board;
        this.currentPlayer = currentPlayer;
        this.capturedPieces = gameState.capturedPieces;
        this.activeFieldEffects = gameState.activeFieldEffects;
        this.renderBoard();
        this.updateUI();
        this.updateCapturedPieces();
        this.updateFieldEffects();
        this.addToGameLog(`${move.playerName} moved ${move.piece} from ${move.from} to ${move.to}`, 'move');
    }

    handleRiftEffect(data) {
        const { effect, gameState } = data;
        this.board = gameState.board;
        this.capturedPieces = gameState.capturedPieces;
        this.activeFieldEffects = gameState.activeFieldEffects;
        this.renderBoard();
        this.updateUI();
        this.updateCapturedPieces();
        this.updateFieldEffects();
        this.addToGameLog(`Rift effect: ${effect.name}`, 'effect');
    }

    leaveRoom() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        
        this.roomCode = null;
        this.playerName = null;
        this.playerColor = null;
        this.isMultiplayer = false;
        this.isSpectator = false;
        
        // Hide room modal
        document.getElementById('room-modal').style.display = 'none';
        document.getElementById('room-info').style.display = 'none';
        document.getElementById('leave-room-btn').style.display = 'none';
        document.getElementById('multiplayer-status').style.display = 'none';
        
        // Reset to single player
        this.newGame();
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new ChessGame();
});
