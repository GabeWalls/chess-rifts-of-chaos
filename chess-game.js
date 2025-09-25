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
    }

    handleGameMove(row, col) {
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
        const piece = this.board[fromRow][fromCol];
        const capturedPiece = this.board[toRow][toCol];
        
        // Handle capture
        if (capturedPiece) {
            this.capturedPieces[capturedPiece.color].push(capturedPiece);
            this.updateCapturedPieces();
        }
        
        // Move piece
        this.board[toRow][toCol] = piece;
        this.board[fromRow][fromCol] = null;
        piece.hasMoved = true;
        
        // Check for rift activation
        if (this.isRift(toRow, toCol) && !this.riftActivatedThisTurn) {
            this.activateRift(toRow, toCol);
            this.riftActivatedThisTurn = true;
        }
        
        this.renderBoard();
        this.switchPlayer();
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
    }

    rollDice() {
        const roll = Math.floor(Math.random() * 20) + 1;
        document.getElementById('dice-result').textContent = roll;
        
        const effect = this.getRiftEffect(roll);
        document.getElementById('rift-effect-title').textContent = effect.name;
        document.getElementById('rift-effect-description').textContent = effect.description;
        
        // Apply the effect
        this.applyRiftEffect(effect, roll);
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
        // This is a simplified implementation - in a full game, each effect would have detailed logic
        if (effect.type === 'field') {
            // Add or remove field effect
            const effectIndex = this.activeFieldEffects.indexOf(effect.name.toLowerCase().replace(/[^a-z]/g, '_'));
            if (effectIndex > -1) {
                this.activeFieldEffects.splice(effectIndex, 1);
            } else {
                this.activeFieldEffects.push(effect.name.toLowerCase().replace(/[^a-z]/g, '_'));
            }
            this.updateFieldEffects();
        }
        
        // For now, just close the modal after a short delay
        setTimeout(() => {
            this.closeModal();
        }, 2000);
    }

    closeModal() {
        document.getElementById('rift-effects-modal').style.display = 'none';
    }

    switchPlayer() {
        this.currentPlayer = this.currentPlayer === 'white' ? 'black' : 'white';
        this.riftActivatedThisTurn = false;
        this.updateUI();
        
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
        document.getElementById('victory-message').textContent = `${winner.charAt(0).toUpperCase() + winner.slice(1)} wins!`;
        document.getElementById('victory-modal').style.display = 'flex';
    }

    updateUI() {
        document.getElementById('current-player').textContent = this.currentPlayer.charAt(0).toUpperCase() + this.currentPlayer.slice(1);
        document.getElementById('game-phase').textContent = this.gamePhase === 'setup' ? 'Setup - Place Rifts' : 'Playing';
        
        document.getElementById('setup-controls').style.display = this.gamePhase === 'setup' ? 'block' : 'none';
        document.getElementById('game-controls-panel').style.display = this.gamePhase === 'playing' ? 'block' : 'none';
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
        effectsList.innerHTML = this.activeFieldEffects.map(effect => 
            `<div class="effect-item">${effect.replace(/_/g, ' ')}</div>`
        ).join('');
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
        this.initializeBoard();
        this.renderBoard();
        this.updateUI();
        this.updateCapturedPieces();
        this.updateFieldEffects();
        this.clearHighlights();
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new ChessGame();
});
