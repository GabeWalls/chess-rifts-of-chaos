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
        this.kingMovedThisTurn = { white: 0, black: 0 }; // Track number of king moves (0, 1, or 2)
        this.kingMovedFirst = false; // Track if king moved first this turn
        this.playerHasMoved = { white: false, black: false }; // Track if each player has moved at least once
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
        this.roomPlayers = []; // Store all players in the room
        
        this.initializeBoard();
        this.setupEventListeners();
        this.renderBoard();
        this.updateUI();
        this.initBetaBanner();
        
        // Click outside board to clear highlights
        document.addEventListener('click', (e) => this.handleOutsideClick(e));
    }

    handleOutsideClick(e) {
        // Check if click is outside the chess board
        const board = document.getElementById('chess-board');
        if (board && !board.contains(e.target)) {
            // Check if click is also not on coordinates
            const isCoordinate = e.target.classList.contains('coord-label') || 
                                 e.target.closest('.board-coordinates');
            if (!isCoordinate) {
                this.clearCoordinateHighlights();
            }
        }
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
        
        // Add sandstorm effect to board if active
        if (this.activeFieldEffects.includes('sandstorm')) {
            boardElement.classList.add('sandstorm-effect');
        } else {
            boardElement.classList.remove('sandstorm-effect');
        }
        
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
                
                // Add frozen class if piece is frozen
                if (piece && (piece.frozen || this.frozenPieces.has(piece))) {
                    square.classList.add('frozen-piece');
                }
                if (piece) {
                    const pieceSymbol = this.getPieceSymbol(piece);
                    square.textContent = pieceSymbol;
                    square.dataset.piece = `${piece.color}-${piece.type}`;
                    
                    // Add conqueror king class if king has double move ability
                    if (piece.type === 'king' && this.kingAbilities[piece.color]?.doubleMove) {
                        square.classList.add('conqueror-king');
                    }
                    
                    // Add fairy fountain class if pawn has fairy fountain ability
                    if (piece.type === 'pawn' && piece.fairyFountain) {
                        square.classList.add('fairy-fountain-pawn');
                    }
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
        // Handle portal rift selection
        if (this.portalMode && this.portalMode.active) {
            this.handlePortalRiftClick(row, col);
            return;
        }
        
        // Handle archer shot target selection
        if (this.archerShotMode && this.archerShotMode.active) {
            this.handleArcherTarget(row, col);
            return;
        }
        
        // Handle Spring of Revival piece placement
        if (this.springOfRevivalMode && this.springOfRevivalMode.active && this.springOfRevivalMode.piece) {
            this.handleSpringOfRevivalPlacement(row, col);
            return;
        }
        
        if (this.gamePhase === 'setup') {
            this.handleRiftPlacement(row, col);
        } else {
            this.handleGameMove(row, col);
        }
    }

    handlePortalRiftClick(row, col) {
        const { fromRow, fromCol } = this.portalMode;
        
        // Check if this is a valid rift target
        const isValidRift = this.rifts.some(rift => 
            rift.row === row && rift.col === col && (rift.row !== fromRow || rift.col !== fromCol)
        );
        
        if (!isValidRift) {
            this.addToGameLog(`Invalid target! Click on a blue highlighted rift.`, 'effect');
            return;
        }
        
        // Execute teleportation
        this.executePortalTeleport(fromRow, fromCol, row, col);
        
        // Cleanup
        this.portalMode = null;
        document.querySelectorAll('.portal-target').forEach(square => {
            square.classList.remove('portal-target');
        });
    }

    executePortalTeleport(fromRow, fromCol, toRow, toCol) {
        const piece = this.board[fromRow][fromCol];
        
        // Remove piece from original location
        this.board[fromRow][fromCol] = null;
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
            this.updateCapturedPieces();
            const coords = String.fromCharCode(65 + toCol) + (8 - toRow);
            this.addToGameLog(`Piece teleported to ${coords}!`, 'effect');
        }, 1000);

        setTimeout(() => {
            this.closeModal();
        }, 2000);
    }

    handleArcherTarget(row, col) {
        const { riftRow, riftCol } = this.archerShotMode;
        const targetPiece = this.board[row][col];
        
        // Validate the target is a piece
        if (!targetPiece) {
            this.addToGameLog(`Invalid target! Must select a piece.`, 'effect');
            return;
        }
        
        // Validate target is within 3 squares in a straight line
        const dr = Math.sign(row - riftRow);
        const dc = Math.sign(col - riftCol);
        const distance = Math.max(Math.abs(row - riftRow), Math.abs(col - riftCol));
        
        if (distance > 3 || (dr === 0 && dc === 0)) {
            this.addToGameLog(`Invalid target! Must be within 3 squares in a straight line.`, 'effect');
            return;
        }
        
        // Execute archer shot
        this.executeArcherShotOnTarget(riftRow, riftCol, row, col);
        
        // Cleanup
        this.archerShotMode = null;
        document.querySelectorAll('.archer-target').forEach(square => {
            square.classList.remove('archer-target');
        });
    }

    executeArcherShotOnTarget(riftRow, riftCol, targetRow, targetCol) {
        const piece = this.board[targetRow][targetCol];
        this.capturedPieces[piece.color].push(piece);
        this.board[targetRow][targetCol] = null;
        this.removePieceWithAnimation(targetRow, targetCol);
        this.addToGameLog(`Archer's Trick Shot removed ${piece.color} ${piece.type}!`, 'effect');
        
        this.updateCapturedPieces();
        this.renderBoard();
        
        setTimeout(() => {
            this.closeModal();
        }, 1500);
    }

    handleSpringOfRevivalPlacement(row, col) {
        const { playerColor, piece } = this.springOfRevivalMode;
        const startRows = playerColor === 'white' ? [6, 7] : [0, 1];
        
        // Validate the target is a valid starting square
        if (!startRows.includes(row)) {
            this.addToGameLog(`Invalid placement! Must place on starting rows.`, 'effect');
            return;
        }
        
        if (this.board[row][col]) {
            this.addToGameLog(`Invalid placement! Square is occupied.`, 'effect');
            return;
        }
        
        // Place the piece
        this.board[row][col] = piece;
        this.renderBoard();
        this.updateCapturedPieces();
        
        const coords = String.fromCharCode(97 + col) + (8 - row);
        this.addToGameLog(`Spring of Revival: ${piece.color} ${piece.type} revived at ${coords}!`, 'effect');
        
        // Cleanup
        this.springOfRevivalMode = null;
        document.querySelectorAll('.revival-target').forEach(square => {
            square.classList.remove('revival-target');
        });
        
        setTimeout(() => {
            this.closeModal();
        }, 1500);
    }

    handleDragonBreathTarget(row, col) {
        const { riftRow, riftCol } = this.dragonBreathMode;
        const targetPiece = this.board[row][col];
        
        // Validate the target is an enemy piece
        if (!targetPiece || targetPiece.color === this.currentPlayer) {
            this.addToGameLog(`Invalid target! Must select an enemy piece.`, 'effect');
            return;
        }
        
        // Calculate direction from rift to target
        const dr = Math.sign(row - riftRow);
        const dc = Math.sign(col - riftCol);
        
        // Validate target is in a straight line
        const isInLine = (dr === 0 || dc === 0 || Math.abs(dr) === Math.abs(dc));
        const distance = Math.max(Math.abs(row - riftRow), Math.abs(col - riftCol));
        
        if (!isInLine || distance > 3) {
            this.addToGameLog(`Invalid target! Must be within 3 squares in a straight line.`, 'effect');
            return;
        }
        
        // Execute dragon breath
        this.executeDragonBreathOnTarget(riftRow, riftCol, dr, dc);
        
        // Cleanup
        this.dragonBreathMode = null;
        document.querySelectorAll('.dragon-target').forEach(square => {
            square.classList.remove('dragon-target');
        });
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
        
        // In multiplayer, sync rifts with other players
        if (this.isMultiplayer && this.socket) {
            this.socket.emit('sync-rifts', {
                roomCode: this.roomCode,
                rifts: this.rifts
            });
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
        
        // In multiplayer, sync rifts with other players
        if (this.isMultiplayer && this.socket) {
            this.socket.emit('sync-rifts', {
                roomCode: this.roomCode,
                rifts: this.rifts
            });
        }
    }

    removeRift(row, col) {
        this.rifts = this.rifts.filter(rift => !(rift.row === row && rift.col === col));
        this.renderBoard();
        this.updateRiftCounter();
        document.getElementById('start-game').disabled = this.rifts.length !== 4;
        
        // In multiplayer, sync rifts with other players
        if (this.isMultiplayer && this.socket) {
            this.socket.emit('sync-rifts', {
                roomCode: this.roomCode,
                rifts: this.rifts
            });
        }
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
                playerName: this.playerName,
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
        
        // Highlight coordinates for this square
        this.highlightCoordinates(row, col);
        
        // Handle Foot Soldier's Gambit second move
        if (this.footSoldierMode && this.footSoldierMode.active) {
            const { pieceRow, pieceCol } = this.footSoldierMode;
            const piece = this.board[pieceRow][pieceCol];
            
            // If clicking on the foot soldier piece, select it and show moves
            if (row === pieceRow && col === pieceCol) {
                this.selectedSquare = [row, col];
                this.clearHighlights();
                this.highlightCoordinates(row, col);
                this.highlightMoves(row, col);
                this.addToGameLog(`Foot Soldier's Gambit: Select where to move ${piece.type}.`, 'effect');
                return;
            }
            
            // If a square is already selected and clicking on a valid move
            if (this.selectedSquare && this.selectedSquare[0] === pieceRow && this.selectedSquare[1] === pieceCol) {
                if (this.isValidMove(pieceRow, pieceCol, row, col)) {
                    this.makeMove(pieceRow, pieceCol, row, col);
                    this.footSoldierMode = null;
                    this.selectedSquare = null;
                    this.clearHighlights();
                    this.clearCoordinateHighlights();
                    this.addToGameLog(`Foot Soldier's Gambit: ${piece.type} completed second move!`, 'effect');
                    // Now switch players after the second move is complete
                    this.switchPlayer();
                    return;
                } else {
                    this.addToGameLog(`Invalid move for Foot Soldier's Gambit!`, 'effect');
                    return;
                }
            }
            
            // If clicking elsewhere, clear selection
            this.selectedSquare = null;
            this.clearHighlights();
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
                this.highlightCoordinates(row, col);
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
            this.highlightCoordinates(row, col);
            this.highlightMoves(row, col);
        }
    }

    isValidMove(fromRow, fromCol, toRow, toCol) {
        const piece = this.board[fromRow][fromCol];
        if (!piece || piece.color !== this.currentPlayer) return false;
        
        // Check if piece is frozen
        if (piece.frozen || this.frozenPieces.has(piece)) return false;
        
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
        
        // Fairy Fountain special movement
        if (piece.fairyFountain) {
            // Forward 2 spaces
            const doubleRow = row + 2 * direction;
            if (this.isInBounds(doubleRow, col) && !this.board[row + direction][col] && !this.board[doubleRow][col]) {
                moves.push([doubleRow, col]);
            }
            
            // Diagonal moves (1 space left/right + 2 forward)
            for (const colOffset of [-1, 1]) {
                const newRow = row + 2 * direction;
                const newCol = col + colOffset;
                if (this.isInBounds(newRow, newCol)) {
                    // Can move to empty square or capture
                    if (!this.board[newRow][newCol] || this.board[newRow][newCol].color !== piece.color) {
                        moves.push([newRow, newCol]);
                    }
                }
            }
            
            return moves;
        }
        
        // Regular pawn movement
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
            if (piece.type === 'king') {
                // Kings cannot move unless in check (simplified - for now just restrict movement)
                return []; // Simplified implementation - in full version would check for check
            }
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
        this.clearCoordinateHighlights();
    }

    highlightCoordinates(row, col) {
        // Clear previous highlights
        this.clearCoordinateHighlights();
        
        // Convert internal row (0-7) to chess notation row (8-1)
        const chessRow = 8 - row;
        
        // Highlight row coordinates (chess notation)
        document.querySelectorAll(`.coord-label[data-row="${row}"]`).forEach(label => {
            label.classList.add('highlighted');
        });
        
        // Highlight column coordinates
        document.querySelectorAll(`.coord-label[data-col="${col}"]`).forEach(label => {
            label.classList.add('highlighted');
        });
    }

    clearCoordinateHighlights() {
        document.querySelectorAll('.coord-label').forEach(label => {
            label.classList.remove('highlighted');
        });
    }

    makeMove(fromRow, fromCol, toRow, toCol) {
        // In multiplayer, only allow moves for the current player's color
        if (this.isMultiplayer && !this.isSpectator) {
            if (this.currentPlayer !== this.playerColor) {
                console.log(`Not your turn! Current: ${this.currentPlayer}, Your color: ${this.playerColor}`);
                return;
            }
        }
        
        const piece = this.board[fromRow][fromCol];
        
        // Conqueror's Tale: If king moved first, only king can move
        if (this.kingMovedFirst && piece.type !== 'king') {
            this.addToGameLog(`King moved first! Only the king can move this turn.`, 'system');
            return;
        }
        
        // Conqueror's Tale: If non-king moved, king cannot move
        if (this.kingMovedThisTurn[this.currentPlayer] > 0 && !this.kingMovedFirst && piece.type === 'king') {
            this.addToGameLog(`Another piece already moved! King cannot move this turn.`, 'system');
            return;
        }
        
        // Conqueror's Tale: King can only move twice
        if (piece.type === 'king' && this.kingAbilities[piece.color]?.doubleMove && this.kingMovedThisTurn[piece.color] >= 2) {
            this.addToGameLog(`King has already moved twice this turn!`, 'system');
            return;
        }
        const capturedPiece = this.board[toRow][toCol];
        
        // Check for king capture first
        if (capturedPiece && capturedPiece.type === 'king') {
            this.capturedPieces[capturedPiece.color].push(capturedPiece);
            this.updateCapturedPieces();
            this.renderBoard();
            this.addToGameLog(`${this.currentPlayer} captured the enemy king!`, 'system');
            
            // In multiplayer, notify server of victory
            if (this.isMultiplayer && this.socket) {
                this.socket.emit('game-ended', {
                    roomCode: this.roomCode,
                    winner: this.currentPlayer,
                    loser: capturedPiece.color,
                    reason: 'king_captured'
                });
            }
            
            this.endGame(this.currentPlayer);
            return;
        }
        
        // Handle capture
        if (capturedPiece) {
            // Remove from frozen pieces if it was frozen
            if (capturedPiece.frozen || this.frozenPieces.has(capturedPiece)) {
                this.frozenPieces.delete(capturedPiece);
                capturedPiece.frozen = false;
            }
            
            this.capturedPieces[capturedPiece.color].push(capturedPiece);
            this.updateCapturedPieces();
            this.addToGameLog(`${this.currentPlayer} captured ${capturedPiece.color}'s ${capturedPiece.type}`, 'move');
        }
        
        // Move piece
        this.board[toRow][toCol] = piece;
        this.board[fromRow][fromCol] = null;
        piece.hasMoved = true;
        
        // Track that this player has made a move
        this.playerHasMoved[this.currentPlayer] = true;
        
        // Track king moves for Conqueror's Tale
        if (piece.type === 'king') {
            this.kingMovedThisTurn[piece.color]++;
            if (this.kingMovedThisTurn[piece.color] === 1) {
                this.kingMovedFirst = true;
            }
        } else {
            // If a non-king piece moves, king cannot move this turn
            if (this.kingMovedThisTurn[this.currentPlayer] === 0) {
                this.kingMovedFirst = false;
            }
        }
        
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
                    activeFieldEffects: this.activeFieldEffects,
                    rifts: this.rifts
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
            
            // Check if king can move again with Conqueror's Tale
            const piece = this.board[toRow][toCol];
            if (piece && piece.type === 'king' && this.kingAbilities[piece.color]?.doubleMove && this.kingMovedThisTurn[piece.color] === 1) {
                // King has moved once and can move again (but only the king)
                this.addToGameLog(`${piece.color} king can move one more time!`, 'system');
                // Don't switch player - allow second king move
            } else if (piece && piece.type === 'king' && this.kingAbilities[piece.color]?.doubleMove && this.kingMovedThisTurn[piece.color] >= 2) {
                // King has moved twice, turn is over
                this.addToGameLog(`${piece.color} king has used both moves!`, 'system');
                this.switchPlayer();
            } else {
                // Regular piece moved or king without ability
                this.switchPlayer();
            }
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
        document.getElementById('rift-effect-title').textContent = 'Rift Effect';
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
                effect: { ...effect, roll: roll, riftRow, riftCol, activatingPiece },
                gameState: {
                    board: this.board,
                    currentPlayer: this.currentPlayer,
                    capturedPieces: this.capturedPieces,
                    activeFieldEffects: this.activeFieldEffects,
                    rifts: this.rifts
                }
            });
        }
        
        // Store current game state for potential reversals
        const previousBoard = JSON.parse(JSON.stringify(this.board));
        const previousCaptured = JSON.parse(JSON.stringify(this.capturedPieces));
        
        try {
            switch (roll) {
                case 1: // Necromancer's Trap
                    this.showNecromancerTrapChoice(riftRow, riftCol, activatingPiece);
                    return; // Don't close modal yet
                case 2: // Archer's Trick Shot
                    this.showArcherTargetSelection(riftRow, riftCol);
                    return; // Don't close modal yet
                case 3: // Sandworm
                    this.applySandworm(riftRow, riftCol);
                    break;
                case 4: // Honorable Sacrifice
                    this.applyHonorableSacrifice(riftRow, riftCol, activatingPiece);
                    break;
                case 5: // Demotion
                    const capturedPawns = this.capturedPieces[activatingPiece.color].filter(p => p.type === 'pawn');
                    // Must have captured pawns AND activating piece must not be a pawn
                    if (capturedPawns.length > 0 && activatingPiece.type !== 'pawn') {
                        this.applyDemotion(riftRow, riftCol, activatingPiece);
                    } else {
                        if (activatingPiece.type === 'pawn') {
                            this.addToGameLog(`Demotion: Pawns cannot be demoted!`, 'effect');
                        } else {
                            this.addToGameLog(`Demotion: No captured pawns available!`, 'effect');
                        }
                        this.switchPlayer();
                    }
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
                    // Check if both players have moved at least once
                    if (this.playerHasMoved.white && this.playerHasMoved.black) {
                        this.applyFieldEffect('sandstorm');
                    } else {
                        this.addToGameLog(`Sandstorm: Both players must move at least once first!`, 'effect');
                        this.switchPlayer();
                    }
                    break;
                case 10: // Dragon's Breath
                    this.showDragonDirectionChoice(riftRow, riftCol);
                    return; // Don't close modal yet
                case 11: // Jack Frost's Mischief
                    this.showJackFrostRoll(riftRow, riftCol);
                    return; // Don't close modal yet
                case 12: // Portal in the Rift
                    this.showPortalChoice(riftRow, riftCol, activatingPiece);
                    return; // Don't close modal yet
                case 13: // Catapult Roulette
                    this.showCatapultRouletteDice();
                    return; // Don't close modal yet
                case 14: // Conqueror's Tale
                    this.applyConquerorTale(activatingPiece.color);
                    break;
                case 15: // Medusa's Gaze
                    this.applyMedusaGaze(riftRow, riftCol);
                    break;
                case 16: // Time Distortion/Stasis
                    this.applyTimeDistortionFieldEffect(riftRow, riftCol);
                    break;
                case 17: // Crossroad Demon's Deal
                    this.showCrossroadDemonChoice(riftRow, riftCol, activatingPiece);
                    return; // Don't close modal yet
                case 18: // Fairy Fountain
                    if (activatingPiece.type === 'pawn') {
                        this.applyFairyFountain(riftRow, riftCol, activatingPiece);
                    } else {
                        this.addToGameLog(`Fairy Fountain: Only pawns can receive this blessing!`, 'effect');
                        this.switchPlayer();
                    }
                    break;
                case 19: // Eerie Fog's Turmoil
                    this.showEerieFogRoll(activatingPiece.color);
                    return; // Don't close modal yet
                case 20: // Spring of Revival
                    // Check if player has any captured pieces of their own color
                    const playerCapturedPieces = this.capturedPieces[activatingPiece.color];
                    if (playerCapturedPieces && playerCapturedPieces.length > 0) {
                        this.showSpringOfRevivalChoice(activatingPiece.color);
                        return; // Don't close modal yet
                    } else {
                        this.addToGameLog(`Spring of Revival: You have no captured pieces to revive!`, 'effect');
                        this.switchPlayer();
                    }
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
            const chatMessage = {
                message,
                player: this.playerName || this.currentPlayer,
                timestamp: new Date().toLocaleTimeString()
            };
            
            // Send chat message to server in multiplayer
            if (this.isMultiplayer && this.socket) {
                this.socket.emit('chat-message', {
                    roomCode: this.roomCode,
                    message: chatMessage
                });
            } else {
                // Single player - add directly
                this.chatMessages.push(chatMessage);
                this.updateChatMessages();
            }
            
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
        optionsDiv.innerHTML = `
            <div class="effect-choices">
                <p style="color: #333; margin-bottom: 10px; text-align: center;">
                    Portal in the Rift! Click on a rift on the board to teleport your piece there.
                </p>
                <button class="effect-choice" onclick="game.cancelPortalSelection()">
                    Close
                </button>
            </div>
        `;
        
        // Enable portal selection mode
        this.portalMode = { active: true, fromRow: riftRow, fromCol: riftCol, piece: activatingPiece };
        
        // Highlight available rifts in blue
        this.highlightPortalRifts(riftRow, riftCol);
        
        this.addToGameLog(`Portal in the Rift activated! Click on a blue highlighted rift to teleport.`, 'effect');
    }

    highlightPortalRifts(excludeRow, excludeCol) {
        this.rifts.forEach(rift => {
            if (rift.row !== excludeRow || rift.col !== excludeCol) {
                const square = document.querySelector(`[data-row="${rift.row}"][data-col="${rift.col}"]`);
                if (square) {
                    square.classList.add('portal-target');
                }
            }
        });
    }

    cancelPortalSelection() {
        this.portalMode = null;
        document.querySelectorAll('.portal-target').forEach(square => {
            square.classList.remove('portal-target');
        });
        this.closeModal();
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

    showArcherTargetSelection(riftRow, riftCol) {
        const optionsDiv = document.getElementById('rift-effect-options');
        optionsDiv.innerHTML = `
            <div class="effect-choices">
                <p style="color: #333; margin-bottom: 10px; text-align: center;">
                    Click on any piece within 3 squares (in any direction) from the rift to target it with Archer's Trick Shot.
                </p>
                <button class="effect-choice" onclick="game.cancelArcherShot()">
                    Cancel (No Valid Targets)
                </button>
            </div>
        `;
        
        // Enable archer shot selection mode
        this.archerShotMode = { active: true, riftRow, riftCol };
        
        // Highlight valid targets
        this.highlightArcherTargets(riftRow, riftCol);
        
        this.addToGameLog(`Archer's Trick Shot activated! Select a target.`, 'effect');
    }

    highlightArcherTargets(riftRow, riftCol) {
        const directions = [
            [-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]
        ];
        
        directions.forEach(([dr, dc]) => {
            for (let distance = 1; distance <= 3; distance++) {
                const targetRow = riftRow + (dr * distance);
                const targetCol = riftCol + (dc * distance);
                
                if (targetRow >= 0 && targetRow < 8 && targetCol >= 0 && targetCol < 8) {
                    const piece = this.board[targetRow][targetCol];
                    if (piece) {
                        const square = document.querySelector(`[data-row="${targetRow}"][data-col="${targetCol}"]`);
                        if (square) {
                            square.classList.add('archer-target');
                        }
                    }
                }
            }
        });
    }

    cancelArcherShot() {
        this.archerShotMode = null;
        document.querySelectorAll('.archer-target').forEach(square => {
            square.classList.remove('archer-target');
        });
        this.closeModal();
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
        let buttonsHtml = '<div class="effect-choices"><p style="color: #333; margin-bottom: 10px;">Choose a direction with enemy pieces:</p>';
        
        let hasValidDirections = false;
        directions.forEach((dir, index) => {
            // Check if this direction has enemy pieces
            const hasEnemyInDirection = this.hasEnemyInDirection(riftRow, riftCol, dir.dr, dir.dc);
            if (hasEnemyInDirection) {
                hasValidDirections = true;
                buttonsHtml += `
                    <button class="effect-choice" onclick="game.executeDragonBreath(${riftRow}, ${riftCol}, ${dir.dr}, ${dir.dc})">
                        ${dir.name}
                    </button>
                `;
            }
        });
        
        if (!hasValidDirections) {
            buttonsHtml += '<p style="color: #666; text-align: center; margin: 20px 0;">No enemy pieces in any direction!</p>';
        }
        
        buttonsHtml += `
            <button class="effect-choice" onclick="game.closeModal()">
                Cancel
            </button>
        </div>`;
        
        optionsDiv.innerHTML = buttonsHtml;
        this.addToGameLog(`Dragon's Breath activated! Choose direction.`, 'effect');
    }

    hasEnemyInDirection(riftRow, riftCol, dr, dc) {
        for (let distance = 1; distance <= 3; distance++) {
            const targetRow = riftRow + (dr * distance);
            const targetCol = riftCol + (dc * distance);
            
            if (targetRow >= 0 && targetRow < 8 && targetCol >= 0 && targetCol < 8) {
                const piece = this.board[targetRow][targetCol];
                if (piece && piece.color !== this.currentPlayer) {
                    return true;
                }
                // If there's a friendly piece blocking, stop checking this direction
                if (piece && piece.color === this.currentPlayer) {
                    break;
                }
            }
        }
        return false;
    }

    executeDragonBreath(riftRow, riftCol, dr, dc) {
        let piecesRemoved = 0;
        
        for (let distance = 1; distance <= 3; distance++) {
            const targetRow = riftRow + (dr * distance);
            const targetCol = riftCol + (dc * distance);
            
            if (targetRow >= 0 && targetRow < 8 && targetCol >= 0 && targetCol < 8) {
                const piece = this.board[targetRow][targetCol];
                
                // Stop at first piece (friendly or enemy)
                if (piece) {
                    if (piece.color !== this.currentPlayer) {
                        this.capturedPieces[piece.color].push(piece);
                        this.board[targetRow][targetCol] = null;
                        this.removePieceWithAnimation(targetRow, targetCol, piecesRemoved * 400);
                        this.addToGameLog(`Dragon's Breath removed ${piece.color} ${piece.type}!`, 'effect');
                        piecesRemoved++;
                    }
                    break; // Stop at first piece in this direction
                }
            }
        }

        this.addToGameLog(`Dragon's Breath fired! ${piecesRemoved} enemy pieces removed.`, 'effect');
        
        this.updateCapturedPieces();
        this.renderBoard();
        
        setTimeout(() => {
            this.closeModal();
        }, 2000);
    }

    executeDragonBreathOnTarget(riftRow, riftCol, dr, dc) {
        let piecesRemoved = 0;
        
        for (let distance = 1; distance <= 3; distance++) {
            const targetRow = riftRow + (dr * distance);
            const targetCol = riftCol + (dc * distance);
            
            if (targetRow >= 0 && targetRow < 8 && targetCol >= 0 && targetCol < 8) {
                if (this.board[targetRow][targetCol] && this.board[targetRow][targetCol].color !== this.currentPlayer) {
                    const piece = this.board[targetRow][targetCol];
                    this.capturedPieces[piece.color].push(piece);
                    this.board[targetRow][targetCol] = null; // Remove piece immediately
                    this.removePieceWithAnimation(targetRow, targetCol, piecesRemoved * 400);
                    this.addToGameLog(`Dragon's Breath removed ${piece.color} ${piece.type}!`, 'effect');
                    piecesRemoved++;
                }
            }
        }

        this.addToGameLog(`Dragon's Breath fired! ${piecesRemoved} enemy pieces removed.`, 'effect');
        
        // Update captured pieces and board
        this.updateCapturedPieces();
        this.renderBoard();
        
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

    initBetaBanner() {
        const banner = document.getElementById('beta-banner');
        const closeBtn = document.getElementById('beta-close');
        
        // Check if banner was previously closed
        const bannerClosed = localStorage.getItem('betaBannerClosed') === 'true';
        if (bannerClosed) {
            banner.classList.add('hidden');
        }
        
        // Add close button event listener
        closeBtn.addEventListener('click', () => {
            banner.classList.add('hidden');
            localStorage.setItem('betaBannerClosed', 'true');
        });
    }

    // Individual Rift Effect Implementations
    showNecromancerTrapChoice(riftRow, riftCol, activatingPiece) {
        const opponentColor = activatingPiece.color === 'white' ? 'black' : 'white';
        const capturedPieces = this.capturedPieces[opponentColor];
        
        if (capturedPieces.length === 0) {
            this.addToGameLog(`Necromancer's Trap: No enemy pieces to resurrect!`, 'effect');
            setTimeout(() => this.closeModal(), 1500);
            return;
        }
        
        const optionsDiv = document.getElementById('rift-effect-options');
        let buttonsHtml = '<div class="effect-choices"><p style="color: #333; margin-bottom: 10px;">Select an enemy piece to resurrect:</p>';
        
        capturedPieces.forEach((piece, index) => {
            buttonsHtml += `
                <button class="effect-choice" onclick="game.resurrectEnemyPiece(${riftRow}, ${riftCol}, '${opponentColor}', ${index})">
                    ${this.getPieceSymbol(piece)} ${piece.color} ${piece.type}
                </button>
            `;
        });
        
        buttonsHtml += '</div>';
        optionsDiv.innerHTML = buttonsHtml;
        
        this.addToGameLog(`Necromancer's Trap activated! Choose an enemy piece to resurrect.`, 'effect');
    }

    resurrectEnemyPiece(riftRow, riftCol, opponentColor, pieceIndex) {
        // Remove activating piece immediately
        const pieceToResurrect = this.capturedPieces[opponentColor].splice(pieceIndex, 1)[0];
        this.removePieceWithAnimation(riftRow, riftCol);
        
        setTimeout(() => {
            this.board[riftRow][riftCol] = pieceToResurrect;
            this.updateCapturedPieces();
            this.renderBoard();
            this.addToGameLog(`Necromancer's Trap: ${pieceToResurrect.color} ${pieceToResurrect.type} resurrected!`, 'effect');
            this.closeModal();
        }, 1500);
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
        const piecesToRemove = [];
        
        for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
            for (let colOffset = -1; colOffset <= 1; colOffset++) {
                const targetRow = riftRow + rowOffset;
                const targetCol = riftCol + colOffset;
                
                if (this.isInBounds(targetRow, targetCol) && this.board[targetRow][targetCol]) {
                    const piece = this.board[targetRow][targetCol];
                    piecesToRemove.push({ row: targetRow, col: targetCol, piece });
                }
            }
        }
        
        // Remove pieces immediately from board state, then animate
        piecesToRemove.forEach(({ row, col, piece }) => {
            this.capturedPieces[piece.color].push(piece);
            this.board[row][col] = null;
            this.removePieceWithAnimation(row, col, delay);
            delay += 200;
        });
        
        this.addToGameLog(`Sandworm devours all nearby pieces!`, 'effect');
    }

    applyHonorableSacrifice(riftRow, riftCol, activatingPiece) {
        // Remove activating piece immediately from board state
        this.board[riftRow][riftCol] = null;
        this.capturedPieces[activatingPiece.color].push(activatingPiece);
        this.removePieceWithAnimation(riftRow, riftCol);
        
        // Remove any enemy piece within 1 square with animation
        const directions = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
        for (const [rowOffset, colOffset] of directions) {
            const targetRow = riftRow + rowOffset;
            const targetCol = riftCol + colOffset;
            
            if (this.isInBounds(targetRow, targetCol) && this.board[targetRow][targetCol]) {
                const piece = this.board[targetRow][targetCol];
                if (piece.color !== this.currentPlayer) {
                    this.capturedPieces[piece.color].push(piece);
                    this.board[targetRow][targetCol] = null;
                    this.removePieceWithAnimation(targetRow, targetCol, 500);
                    this.addToGameLog(`Honorable Sacrifice: Enemy piece removed!`, 'effect');
                    break; // Only remove one piece
                }
            }
        }
    }

    applyDemotion(riftRow, riftCol, activatingPiece) {
        // Remove activating piece immediately from board state
        this.board[riftRow][riftCol] = null;
        this.capturedPieces[activatingPiece.color].push(activatingPiece);
        this.removePieceWithAnimation(riftRow, riftCol);
        
        // Place captured pawn if available and piece was not a pawn
        if (['rook', 'knight', 'bishop', 'queen'].includes(activatingPiece.type)) {
            const capturedPawns = this.capturedPieces[activatingPiece.color].filter(p => p.type === 'pawn');
            if (capturedPawns.length > 0) {
                const pawnIndex = this.capturedPieces[activatingPiece.color].findIndex(p => p.type === 'pawn');
                const pawn = this.capturedPieces[activatingPiece.color].splice(pawnIndex, 1)[0];
                setTimeout(() => {
                    this.board[riftRow][riftCol] = pawn;
                    this.updateCapturedPieces();
                    this.renderBoard();
                    this.addToGameLog(`Demotion: ${activatingPiece.type} demoted to pawn!`, 'effect');
                }, 1500);
            } else {
                this.addToGameLog(`Demotion: No captured pawns to place.`, 'effect');
            }
        } else {
            this.addToGameLog(`Demotion: Pawn cannot be demoted further.`, 'effect');
        }
    }

    applyFootSoldierGambit(activatingPiece, riftRow, riftCol) {
        // Enable foot soldier mode for second move
        this.footSoldierMode = { active: true, pieceRow: riftRow, pieceCol: riftCol };
        
        const optionsDiv = document.getElementById('rift-effect-options');
        optionsDiv.innerHTML = `
            <div class="effect-choices">
                <p style="color: #333; margin-bottom: 10px; text-align: center;">
                    Foot Soldier's Gambit! Your piece must move again immediately.
                </p>
                <button class="effect-choice" onclick="game.closeFootSoldierModal()">
                    Continue (select next move)
                </button>
            </div>
        `;
        
        this.addToGameLog(`Foot Soldier's Gambit: ${activatingPiece.type} must move again!`, 'effect');
    }

    closeFootSoldierModal() {
        document.getElementById('rift-effects-modal').style.display = 'none';
        // DO NOT switch player - they need to move the piece again
        this.addToGameLog(`Click on your ${this.board[this.footSoldierMode.pieceRow][this.footSoldierMode.pieceCol].type} to select it for the second move.`, 'effect');
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

    showCatapultRouletteDice() {
        const optionsDiv = document.getElementById('rift-effect-options');
        optionsDiv.innerHTML = `
            <div class="effect-choices">
                <p style="color: #333; margin-bottom: 10px;">Roll 2D8 to select a random square</p>
                <div style="display: flex; gap: 20px; justify-content: center; margin: 20px 0;">
                    <div style="text-align: center;">
                        <div style="font-size: 3rem; font-weight: bold; color: #667eea;">?</div>
                        <div>Column (A-H)</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 3rem; font-weight: bold; color: #764ba2;">?</div>
                        <div>Row (1-8)</div>
                    </div>
                </div>
                <button class="effect-choice" onclick="game.rollCatapultDice()">
                    Roll Dice
                </button>
            </div>
        `;
        
        this.addToGameLog(`Catapult Roulette activated! Roll 2D8.`, 'effect');
    }

    rollCatapultDice() {
        const col = Math.floor(Math.random() * 8) + 1; // 1-8
        const row = Math.floor(Math.random() * 8) + 1; // 1-8
        
        const colLetter = String.fromCharCode(64 + col); // A-H
        const targetCol = col - 1; // Convert to 0-indexed
        const targetRow = 8 - row; // Convert to 0-indexed (row 1 = index 7)
        
        // Show the roll results
        const optionsDiv = document.getElementById('rift-effect-options');
        optionsDiv.innerHTML = `
            <div class="effect-choices">
                <p style="color: #333; margin-bottom: 10px;">Rolled: ${colLetter}${row}</p>
                <div style="display: flex; gap: 20px; justify-content: center; margin: 20px 0;">
                    <div style="text-align: center;">
                        <div style="font-size: 3rem; font-weight: bold; color: #667eea;">${col}</div>
                        <div>Column (${colLetter})</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 3rem; font-weight: bold; color: #764ba2;">${row}</div>
                        <div>Row</div>
                    </div>
                </div>
            </div>
        `;
        
        this.applyCatapultRoulette(targetRow, targetCol, colLetter, row);
    }

    applyCatapultRoulette(row, col, colLetter, rowNum) {
        // Add red blink animation to target square
        const targetSquare = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        if (targetSquare) {
            targetSquare.classList.add('catapult-hit');
        }
        
        if (this.board[row][col]) {
            const piece = this.board[row][col];
            this.capturedPieces[piece.color].push(piece);
            this.board[row][col] = null;
            this.removePieceWithAnimation(row, col);
            this.addToGameLog(`Catapult Roulette hit ${colLetter}${rowNum} - removed ${piece.color} ${piece.type}!`, 'effect');
        } else {
            this.addToGameLog(`Catapult Roulette hit ${colLetter}${rowNum} - no piece there!`, 'effect');
        }
        
        this.updateCapturedPieces();
        this.renderBoard();
        
        // Remove animation class after animation completes
        setTimeout(() => {
            if (targetSquare) {
                targetSquare.classList.remove('catapult-hit');
            }
            this.closeModal();
        }, 2000);
    }

    applyConquerorTale(playerColor) {
        // Give king double move ability
        this.kingAbilities[playerColor] = { ...this.kingAbilities[playerColor], doubleMove: true };
    }

    applyMedusaGaze(riftRow, riftCol) {
        // Freeze the piece on the rift
        this.frozenPieces.add(`${riftRow}-${riftCol}`);
    }

    applyTimeDistortionFieldEffect(riftRow, riftCol) {
        // Roll for radius
        const radiusRoll = Math.floor(Math.random() * 20) + 1;
        let radius = 1;
        if (radiusRoll >= 9 && radiusRoll <= 14) radius = 2;
        else if (radiusRoll >= 15 && radiusRoll <= 18) radius = 3;
        else if (radiusRoll >= 19) radius = 4;
        
        // Clear any existing field effects first
        this.clearFieldEffects();
        
        // Freeze all pieces within radius
        for (let rowOffset = -radius; rowOffset <= radius; rowOffset++) {
            for (let colOffset = -radius; colOffset <= radius; colOffset++) {
                const targetRow = riftRow + rowOffset;
                const targetCol = riftCol + colOffset;
                
                if (this.isInBounds(targetRow, targetCol) && this.board[targetRow][targetCol]) {
                    const piece = this.board[targetRow][targetCol];
                    if (!piece.frozen) {
                        piece.frozen = true;
                        piece.frozenByFieldEffect = true;
                        this.frozenPieces.add(piece);
                    }
                }
            }
        }
        
        // Set as active field effect
        this.activeFieldEffects.push('time_distortion');
        this.addToGameLog(`Time Distortion: ${radius} radius - pieces frozen!`, 'effect');
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
        // Give pawn enhanced movement abilities
        activatingPiece.fairyFountain = true;
        this.addToGameLog(`Fairy Fountain: ${activatingPiece.color} pawn gains enhanced movement!`, 'effect');
    }

    showSpringOfRevivalChoice(playerColor) {
        const capturedPieces = this.capturedPieces[playerColor];
        
        if (capturedPieces.length === 0) {
            this.addToGameLog(`Spring of Revival: No captured pieces to revive!`, 'effect');
            setTimeout(() => this.closeModal(), 1500);
            return;
        }
        
        const optionsDiv = document.getElementById('rift-effect-options');
        let buttonsHtml = '<div class="effect-choices"><p style="color: #333; margin-bottom: 10px;">Select a piece to revive:</p>';
        
        capturedPieces.forEach((piece, index) => {
            buttonsHtml += `
                <button class="effect-choice" onclick="game.revivePiece('${playerColor}', ${index})">
                    ${this.getPieceSymbol(piece)} ${piece.type}
                </button>
            `;
        });
        
        buttonsHtml += '</div>';
        optionsDiv.innerHTML = buttonsHtml;
        
        this.addToGameLog(`Spring of Revival activated! Choose a piece to revive.`, 'effect');
        this.springOfRevivalMode = { active: true, playerColor };
    }

    revivePiece(playerColor, pieceIndex) {
        const piece = this.capturedPieces[playerColor].splice(pieceIndex, 1)[0];
        
        const optionsDiv = document.getElementById('rift-effect-options');
        optionsDiv.innerHTML = `
            <div class="effect-choices">
                <p style="color: #333; margin-bottom: 10px;">Click on a starting square (row ${playerColor === 'white' ? '1 or 2' : '7 or 8'}) to place ${piece.type}</p>
            </div>
        `;
        
        this.springOfRevivalMode = { active: true, playerColor, piece };
        this.highlightStartingSquares(playerColor);
    }

    highlightStartingSquares(playerColor) {
        const startRows = playerColor === 'white' ? [6, 7] : [0, 1]; // Rows 1-2 for white, 7-8 for black
        
        startRows.forEach(row => {
            for (let col = 0; col < 8; col++) {
                if (!this.board[row][col]) {
                    const square = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
                    if (square) {
                        square.classList.add('revival-target');
                    }
                }
            }
        });
    }

    showJackFrostRoll(riftRow, riftCol) {
        const optionsDiv = document.getElementById('rift-effect-options');
        optionsDiv.innerHTML = `
            <div class="effect-choices">
                <p style="color: #333; margin-bottom: 10px;">Jack Frost's Mischief! Roll D20:</p>
                <p style="color: #666; font-size: 0.9rem;">Odd = nothing happens, Even = piece slides 1 extra square</p>
                <div style="margin: 20px 0;">
                    <div style="font-size: 3rem; font-weight: bold; color: #667eea;">?</div>
                </div>
                <button class="effect-choice" onclick="game.rollJackFrost(${riftRow}, ${riftCol})">
                    Roll D20
                </button>
            </div>
        `;
        
        this.addToGameLog(`Jack Frost's Mischief activated!`, 'effect');
    }

    rollJackFrost(riftRow, riftCol) {
        const finalRoll = Math.floor(Math.random() * 20) + 1;
        
        const optionsDiv = document.getElementById('rift-effect-options');
        optionsDiv.innerHTML = `
            <div class="effect-choices">
                <p style="color: #333; margin-bottom: 10px;">Rolling...</p>
                <div style="margin: 20px 0;">
                    <div id="dice-result" class="dice-roll-number">?</div>
                </div>
                <p style="color: #666;">
                    &nbsp;
                </p>
            </div>
        `;
        
        this.animateDiceRoll('dice-result', finalRoll, () => {
            const resultText = document.querySelector('.effect-choices p:last-child');
            if (resultText) {
                resultText.textContent = finalRoll % 2 === 0 ? 'Even! Piece slides 1 extra square forward' : 'Odd! Nothing happens';
            }
            
            if (finalRoll % 2 === 0) {
                // Apply Jack Frost field effect
                this.applyFieldEffect('jack_frost_mischief');
                this.applyJackFrostSlide(riftRow, riftCol);
            } else {
                this.addToGameLog(`Jack Frost's Mischief: Roll was odd - no effect!`, 'effect');
            }
            
            setTimeout(() => {
                this.closeModal();
            }, 2000);
        });
    }

    animateDiceRoll(elementId, finalNumber, callback) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        let counter = 0;
        const totalFrames = 30; // Number of frames in animation
        
        const animate = () => {
            counter++;
            
            // Calculate delay - starts fast, slows down exponentially
            const progress = counter / totalFrames;
            const delay = 30 + (progress * progress * 200); // Exponential slowdown
            
            // Show random number
            const randomNum = Math.floor(Math.random() * 20) + 1;
            element.textContent = randomNum;
            
            if (counter < totalFrames) {
                setTimeout(animate, delay);
            } else {
                // Show final number
                element.textContent = finalNumber;
                if (callback) {
                    setTimeout(callback, 500);
                }
            }
        };
        
        animate();
    }

    showEerieFogRoll(playerColor) {
        const optionsDiv = document.getElementById('rift-effect-options');
        optionsDiv.innerHTML = `
            <div class="effect-choices">
                <p style="color: #333; margin-bottom: 10px;">Eerie Fog's Turmoil! Roll D20:</p>
                <p style="color: #666; font-size: 0.9rem;">3-20 = play normally, 1-2 = skip next turn</p>
                <div style="margin: 20px 0;">
                    <div style="font-size: 3rem; font-weight: bold; color: #667eea;">?</div>
                </div>
                <button class="effect-choice" onclick="game.rollEerieFog('${playerColor}')">
                    Roll D20
                </button>
            </div>
        `;
        
        this.addToGameLog(`Eerie Fog's Turmoil activated!`, 'effect');
    }

    rollEerieFog(playerColor) {
        const finalRoll = Math.floor(Math.random() * 20) + 1;
        
        const optionsDiv = document.getElementById('rift-effect-options');
        optionsDiv.innerHTML = `
            <div class="effect-choices">
                <p style="color: #333; margin-bottom: 10px;">Rolling...</p>
                <div style="margin: 20px 0;">
                    <div id="eerie-fog-result" class="dice-roll-number">?</div>
                </div>
                <p style="color: #666; font-size: 0.9rem;">
                    &nbsp;
                </p>
            </div>
        `;
        
        this.animateDiceRoll('eerie-fog-result', finalRoll, () => {
            const resultText = document.querySelector('.effect-choices p:last-child');
            if (resultText) {
                resultText.textContent = finalRoll >= 3 ? 'Continue playing normally!' : 'Your next turn will be skipped!';
            }
            
            if (finalRoll >= 3) {
                // Roll 3-20: play normally, no field effect
                this.addToGameLog(`Eerie Fog's Turmoil: Rolled ${finalRoll} - continue playing normally!`, 'effect');
            } else {
                // Roll 1-2: skip next turn
                this.applyFieldEffect('eerie_fog_turmoil');
                this.eerieFogSkipPlayer = playerColor;
                this.addToGameLog(`Eerie Fog's Turmoil: Rolled ${finalRoll} - ${playerColor} will skip next turn!`, 'effect');
            }
            
            setTimeout(() => {
                this.closeModal();
            }, 3000);
        });
    }

    applyJackFrostSlide(riftRow, riftCol) {
        const piece = this.board[riftRow][riftCol];
        if (!piece) return;
        
        // Determine forward direction based on piece color
        const direction = piece.color === 'white' ? -1 : 1;
        const newRow = riftRow + direction;
        
        if (newRow >= 0 && newRow < 8) {
            const targetPiece = this.board[newRow][riftCol];
            
            if (targetPiece) {
                // Collision - freeze both pieces
                piece.frozen = true;
                targetPiece.frozen = true;
                this.frozenPieces.add(piece);
                this.frozenPieces.add(targetPiece);
                this.addToGameLog(`Collision! Both pieces frozen!`, 'effect');
            } else {
                // Slide piece forward
                this.board[newRow][riftCol] = piece;
                this.board[riftRow][riftCol] = null;
                this.addToGameLog(`Piece slid forward one square!`, 'effect');
            }
        } else {
            // Piece slides off the board
            this.capturedPieces[piece.color].push(piece);
            this.board[riftRow][riftCol] = null;
            this.addToGameLog(`Piece slid off the board!`, 'effect');
        }
        
        this.renderBoard();
        this.updateCapturedPieces();
    }

    formatEffectName(effectName) {
        return effectName.replace(/_/g, ' ')
                        .split(' ')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                        .join(' ');
    }

    applyFieldEffect(effectName) {
        // Remove any existing field effects and clear frozen pieces from field effects
        this.clearFieldEffects();
        
        // Add the new field effect
        if (effectName !== 'blank') {
            this.activeFieldEffects.push(effectName);
            this.addToGameLog(`Field effect activated: ${this.formatEffectName(effectName)}`, 'effect');
            
            // Show sandstorm overlay if sandstorm is active
            if (effectName === 'sandstorm') {
                this.showSandstormOverlay();
            }
        } else {
            this.addToGameLog(`Field effect activated: Blank (Pawns may capture sideways)`, 'effect');
        }
    }

    showSandstormOverlay() {
        const overlay = document.getElementById('sandstorm-overlay');
        if (overlay) {
            overlay.classList.add('active');
        }
    }

    hideSandstormOverlay() {
        const overlay = document.getElementById('sandstorm-overlay');
        if (overlay) {
            overlay.classList.remove('active');
        }
    }

    clearFieldEffects() {
        // Hide sandstorm overlay if it was active
        if (this.activeFieldEffects.includes('sandstorm')) {
            this.hideSandstormOverlay();
        }
        
        // Clear frozen pieces that were frozen by field effects (not by Medusa's Gaze)
        this.frozenPieces.forEach(piece => {
            if (piece.frozen && piece.frozenByFieldEffect) {
                piece.frozen = false;
                piece.frozenByFieldEffect = false;
            }
        });
        this.frozenPieces.clear();
        
        // Clear active field effects
        this.activeFieldEffects = [];
    }

    switchPlayer() {
        // Check for Eerie Fog turn skip
        if (this.activeFieldEffects.includes('eerie_fog_turmoil') && this.eerieFogSkipPlayer === this.currentPlayer) {
            this.addToGameLog(`${this.currentPlayer} skips turn due to Eerie Fog's Turmoil!`, 'effect');
            this.clearFieldEffects(); // Clear the field effect after skipping
            this.eerieFogSkipPlayer = null;
        }
        
        this.currentPlayer = this.currentPlayer === 'white' ? 'black' : 'white';
        this.riftActivatedThisTurn = false;
        this.diceRolledThisTurn = false;
        this.kingMovedThisTurn = { white: 0, black: 0 }; // Reset king move tracking
        this.kingMovedFirst = false; // Reset king moved first flag
        this.updateUI();
        this.addToGameLog(`${this.currentPlayer}'s turn`, 'system');
        
        // Check for win conditions
        if (this.isCheckmate(this.currentPlayer)) {
            const winner = this.currentPlayer === 'white' ? 'black' : 'white';
            
            // In multiplayer, notify server of checkmate victory
            if (this.isMultiplayer && this.socket) {
                this.socket.emit('game-ended', {
                    roomCode: this.roomCode,
                    winner: winner,
                    loser: this.currentPlayer,
                    reason: 'checkmate'
                });
            }
            
            this.endGame(winner);
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
            // Show the actual player whose turn it is, not just the local player
            const currentPlayerName = this.getCurrentPlayerName();
            document.getElementById('current-player').textContent = `${playerDisplay} (${currentPlayerName})`;
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
            effectElement.textContent = this.formatEffectName(effect);
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
        document.getElementById('rift-effect-title').textContent = `Field Effect: ${this.formatEffectName(effectName)}`;
        document.getElementById('rift-effect-description').textContent = description;
        document.getElementById('rift-effect-options').innerHTML = '';
        
        // Hide dice roll section for field effect display
        document.querySelector('.dice-roll').style.display = 'none';
        
        document.getElementById('rift-effects-modal').style.display = 'flex';
        
        this.addToGameLog(`Field effect "${effectName.replace(/_/g, ' ')}" viewed: ${description}`, 'effect');
    }

    resign() {
        if (confirm('Are you sure you want to resign?')) {
            const winner = this.currentPlayer === 'white' ? 'black' : 'white';
            
            // In multiplayer, notify server of resignation
            if (this.isMultiplayer && this.socket) {
                this.socket.emit('resign', {
                    roomCode: this.roomCode,
                    playerName: this.playerName,
                    winner: winner,
                    loser: this.currentPlayer
                });
            }
            
            this.endGame(winner);
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
        this.kingMovedThisTurn = { white: 0, black: 0 };
        this.playerHasMoved = { white: false, black: false };
        this.kingMovedFirst = false;
        
        // Reset king abilities (Conqueror's Tale)
        this.kingAbilities = { white: {}, black: {} };
        
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

        this.socket.on('chat-message', (data) => {
            this.handleChatMessage(data);
        });

        this.socket.on('rifts-synced', (data) => {
            this.handleRiftsSynced(data);
        });

        this.socket.on('game-ended', (data) => {
            this.handleGameEnded(data);
        });

        this.socket.on('player-resigned', (data) => {
            this.handlePlayerResigned(data);
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
            console.log(`Game phase updated to: ${this.gamePhase}, Current player: ${this.currentPlayer}, My color: ${this.playerColor}`);
        }
        
        // Check if current player is host and show host controls
        const currentPlayerData = players.find(p => p.name === this.playerName);
        if (currentPlayerData && currentPlayerData.isHost && gamePhase === 'waiting') {
            this.showHostControls();
        }
        
        // Update multiplayer status display
        this.updateMultiplayerStatus(players, spectators);
        
        // Store room players for name lookup
        this.roomPlayers = [...players, ...spectators];
    }

    handleGameStarted(data) {
        const { gameState, currentPlayer, rifts } = data;
        this.board = gameState.board;
        this.currentPlayer = currentPlayer;
        this.gamePhase = 'playing';
        this.rifts = rifts || gameState.rifts; // Use server-synced rifts
        this.renderBoard();
        this.updateUI();
        this.addToGameLog('Game started!', 'system');
        console.log(`Game started! Current player: ${currentPlayer}, My color: ${this.playerColor}, Rifts: ${JSON.stringify(this.rifts)}`);
    }

    handleMoveMade(data) {
        const { move, currentPlayer, gameState } = data;
        this.board = gameState.board;
        this.currentPlayer = currentPlayer;
        this.capturedPieces = gameState.capturedPieces;
        this.activeFieldEffects = gameState.activeFieldEffects;
        this.rifts = gameState.rifts; // Sync rifts
        this.renderBoard();
        this.updateUI();
        this.updateCapturedPieces();
        this.updateFieldEffects();
        this.addToGameLog(`${move.playerName} moved ${move.piece} from ${move.from} to ${move.to}`, 'move');
        console.log(`Move received: ${move.playerName} moved ${move.piece} from ${move.from} to ${move.to}, Current player: ${currentPlayer}`);
    }

    handleRiftEffect(data) {
        const { effect, gameState } = data;
        this.board = gameState.board;
        this.capturedPieces = gameState.capturedPieces;
        this.activeFieldEffects = gameState.activeFieldEffects;
        this.rifts = gameState.rifts; // Sync rifts
        this.renderBoard();
        this.updateUI();
        this.updateCapturedPieces();
        this.updateFieldEffects();
        this.addToGameLog(`Rift effect: ${effect.name}`, 'effect');
    }

    handleChatMessage(data) {
        const { message } = data;
        this.chatMessages.push(message);
        this.updateChatMessages();
    }

    handleRiftsSynced(data) {
        const { rifts } = data;
        this.rifts = rifts;
        this.renderBoard();
        this.updateRiftCounter();
        
        if (this.rifts.length === 4) {
            document.getElementById('start-game').disabled = false;
        }
        
        console.log(`Rifts synced: ${JSON.stringify(this.rifts)}`);
    }

    handleGameEnded(data) {
        const { winner, loser, reason } = data;
        let reasonText = '';
        
        switch(reason) {
            case 'king_captured':
                reasonText = 'King captured';
                break;
            case 'checkmate':
                reasonText = 'Checkmate';
                break;
            default:
                reasonText = reason;
        }
        
        this.addToGameLog(`🎉 ${winner.charAt(0).toUpperCase() + winner.slice(1)} wins by ${reasonText}! 🎉`, 'system');
        this.endGame(winner);
    }

    handlePlayerResigned(data) {
        const { playerName, winner, loser } = data;
        this.addToGameLog(`${playerName} (${loser}) resigned!`, 'system');
        this.addToGameLog(`🎉 ${winner.charAt(0).toUpperCase() + winner.slice(1)} wins by resignation! 🎉`, 'system');
        this.endGame(winner);
    }

    getCurrentPlayerName() {
        if (!this.isMultiplayer || !this.roomPlayers.length) {
            return this.playerName || 'Unknown';
        }
        
        // Find the player whose color matches the current player
        const currentPlayerData = this.roomPlayers.find(player => player.color === this.currentPlayer);
        return currentPlayerData ? currentPlayerData.name : 'Unknown';
    }

    showHostControls() {
        // Add host start game button to room modal
        const roomInfo = document.getElementById('room-info');
        const existingHostControls = document.getElementById('host-controls');
        
        if (!existingHostControls) {
            const hostControls = document.createElement('div');
            hostControls.id = 'host-controls';
            hostControls.innerHTML = `
                <div style="margin-top: 20px; padding: 15px; background: #e8f5e8; border-radius: 8px; border: 2px solid #4caf50;">
                    <h4 style="color: #2e7d32; margin: 0 0 10px 0;">Host Controls</h4>
                    <p style="margin: 0 0 10px 0; color: #2e7d32;">You are the host. Start the game when ready.</p>
                    <button id="host-start-game-btn" class="btn primary" style="background: #4caf50; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">
                        Start Game
                    </button>
                </div>
            `;
            roomInfo.appendChild(hostControls);
            
            // Add event listener for host start game button
            document.getElementById('host-start-game-btn').addEventListener('click', () => {
                this.socket.emit('host-start-game', { roomCode: this.roomCode });
            });
        }
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
let game; // Global game instance
document.addEventListener('DOMContentLoaded', () => {
    game = new ChessGame();
    window.game = game; // Expose globally for onclick handlers
});
