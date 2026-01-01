// Global Game State Variables
let grid = [];
let score = 0;
let playerName = localStorage.getItem('2048-player-name') || '';
let playerBestScore = 0;
let globalBestScore = 0;
let globalBestPlayer = "Loading...";
let leaderboardChart;
let comparisonChart;

// API Configuration
const SUPABASE_URL = 'https://jjiksqklsjtbzpejdfjh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Quo24j_dbFu0N-h08QZi6g_53BHCh_u';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let saveScoreTimeout;
let won = false;
let keepPlaying = false;
let touchStartX = 0;
let touchStartY = 0;

// Undo State
let gameHistory = [];
const maxUndos = 9;
let undoCount = maxUndos;

// Merge Powerup State
const maxMerges = 2;
let mergeCount = maxMerges;

document.addEventListener('DOMContentLoaded', () => {
    const gridContainer = document.querySelector('.grid-container');
    const tileContainer = document.querySelector('.tile-container');
    const scoreElement = document.querySelector('.score-container');
    const bestScoreElement = document.querySelector('.best-container');
    const globalBestScoreElement = document.querySelector('.global-best-container');
    const messageContainer = document.querySelector('.game-message');
    const messageText = messageContainer.querySelector('p');
    const restartButton = document.querySelector('.restart-button');
    const undoButton = document.querySelector('.undo-button');
    const mergeButton = document.querySelector('.merge-button');
    const retryButton = document.querySelector('.retry-button');
    const keepPlayingButton = document.querySelector('.keep-playing-button');

    // Modal Elements
    const nameModal = document.getElementById('name-modal');
    const playerNameInput = document.getElementById('player-name-input');
    const startGameBtn = document.getElementById('start-game-btn');

    // Game Constants
    const gridSize = 4;

    // Initialize Game
    function initGame() {
        if (!playerName) {
            nameModal.style.display = 'flex';
            return; // Wait for name
        }

        // Initial Fetch of Global Score
        fetchGlobalScore();
        grid = Array(gridSize).fill().map(() => Array(gridSize).fill(0));
        score = 0;
        won = false;
        keepPlaying = false;

        // Reset Undo and Merge
        undoCount = maxUndos;
        mergeCount = maxMerges;
        gameHistory = [];
        updateUndoButton();
        updateMergeButton();

        clearTiles();
        updateScore();
        updateBestScore();
        hideMessage();

        addRandomTile();
        addRandomTile();
        addRandomTile();
        addRandomTile();
        addRandomTile();
        initLeaderboardChart(); // Initialize leaderboard
        initComparisonChart(); // Initialize comparison
        updateView();
    }

    // Save state for Undo
    function saveState() {
        if (undoCount > 0) {
            const gridCopy = grid.map(row => [...row]);
            gameHistory.push({
                grid: gridCopy,
                score: score,
                won: won,
                keepPlaying: keepPlaying,
                mergeCount: mergeCount // Save merge count too so it reverts
            });
        }
    }

    function undo() {
        if (undoCount > 0 && gameHistory.length > 0) {
            const previousState = gameHistory.pop();
            grid = previousState.grid;
            score = previousState.score;
            won = previousState.won;
            keepPlaying = previousState.keepPlaying;
            mergeCount = previousState.mergeCount !== undefined ? previousState.mergeCount : maxMerges;

            undoCount--;
            updateUndoButton();
            updateMergeButton();
            updateView();
            updateScore();
            hideMessage();
        }
        updateUndoButton();
    }

    function magicMerge() {
        console.log("Magic Merge clicked. Merges left:", mergeCount);
        if (mergeCount <= 0) return;

        let merged = false;

        // Use a clean state tracking to only save once
        let stateSaved = false;

        // Check Horizontal Merges
        for (let r = 0; r < gridSize; r++) {
            for (let c = 0; c < gridSize - 1; c++) {
                if (grid[r][c] !== 0 && grid[r][c] === grid[r][c + 1]) {
                    // Merge!
                    if (!stateSaved) {
                        saveState();
                        stateSaved = true;
                    }
                    merged = true;
                    grid[r][c] *= 2;
                    grid[r][c + 1] = 0;
                    score += grid[r][c]; // Update score for the merge! (Was missing score update?)
                    c++;
                }
            }
        }

        // Check Vertical Merges
        for (let c = 0; c < gridSize; c++) {
            for (let r = 0; r < gridSize - 1; r++) {
                if (grid[r][c] !== 0 && grid[r][c] === grid[r + 1][c]) {
                    if (!stateSaved) {
                        saveState();
                        stateSaved = true;
                    }
                    merged = true;
                    grid[r][c] *= 2;
                    grid[r + 1][c] = 0;
                    score += grid[r][c]; // Update score
                    r++;
                }
            }
        }

        if (merged) {
            mergeCount--;
            updateMergeButton();
            updateView();
            updateScore();
            // Note: NO new tile is added, just pure relief.
            console.log("Magic Merge successful!");
        } else {
            console.log("No merges possible!");
            // Optional: Shake animation or feedback?
            alert("No adjacent tiles to merge!");
        }
    }

    function updateUndoButton() {
        undoButton.textContent = `Undo (${undoCount})`;
        if (undoCount === 0 || gameHistory.length === 0) {
            undoButton.disabled = true;
        } else {
            undoButton.disabled = false;
        }
    }

    function updateMergeButton() {
        if (mergeButton) {
            mergeButton.textContent = `Merge (${mergeCount})`;
            mergeButton.disabled = (mergeCount === 0);
        }
    }

    function clearTiles() {
        tileContainer.innerHTML = '';
    }

    function addRandomTile() {
        const availableCells = [];
        for (let r = 0; r < gridSize; r++) {
            for (let c = 0; c < gridSize; c++) {
                if (grid[r][c] === 0) {
                    availableCells.push({ r, c });
                }
            }
        }

        if (availableCells.length > 0) {
            const randomCell = availableCells[Math.floor(Math.random() * availableCells.length)];
            const value = Math.random() < 0.9 ? 2 : 4;
            grid[randomCell.r][randomCell.c] = value;
        }
    }

    function updateView() {
        clearTiles();

        const tempCell = document.querySelector('.grid-cell');
        const computedStyle = window.getComputedStyle(tempCell);
        const cellW = parseFloat(computedStyle.width);
        const cellH = parseFloat(computedStyle.height);

        const gridCompStyle = window.getComputedStyle(gridContainer);
        const gap = parseFloat(gridCompStyle.gap) || 15;

        for (let r = 0; r < gridSize; r++) {
            for (let c = 0; c < gridSize; c++) {
                const value = grid[r][c];
                if (value !== 0) {
                    const tile = document.createElement('div');
                    tile.classList.add('tile');
                    tile.classList.add(`tile-${value > 2048 ? 'super' : value}`);
                    tile.textContent = value;

                    const x = c * (cellW + gap);
                    const y = r * (cellH + gap);

                    tile.style.transform = `translate(${x}px, ${y}px)`;

                    tileContainer.appendChild(tile);
                }
            }
        }
    }

function updateScore() {
    // 1. Calculate Score
    score = 0;
    for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
            score += grid[r][c];
        }
    }
    scoreElement.textContent = score;

    // 2. Update Visual Best Score Immediately (So it feels fast)
    if (score > playerBestScore) {
        playerBestScore = score;
        updateBestScore();
    }

    updateComparisonChart();

    // 3. Trigger Save
    // We only try to save if we have a registered player
    if (playerName && playerName !== "Guest") {
        if (saveScoreTimeout) clearTimeout(saveScoreTimeout);
        saveScoreTimeout = setTimeout(() => {
            saveGlobalScore(score, playerName);
        }, 2000);
    }
}

    function updateBestScore() {
        bestScoreElement.textContent = playerBestScore;
        globalBestScoreElement.textContent = globalBestScore;
        globalBestScoreElement.title = `Global Best by: ${globalBestPlayer}`;
    }

    // --- API Functions ---

    async function fetchGlobalScore() {
        try {
            // Get High Score and Top 10 together
            const { data: topScores, error } = await supabaseClient
                .from('scores')
                .select('*')
                .order('score', { ascending: false })
                .limit(10);

            if (topScores && topScores.length > 0) {
                // Update Global Best (Top #1)
                globalBestScore = topScores[0].score;
                globalBestPlayer = topScores[0].playerName;

                // Update the Leaderboard Chart
                updateLeaderboardChartData(topScores);

                updateBestScore();
                updateComparisonChart();
            }
        } catch (e) {
            console.error("Supabase Error:", e);
        }
    }

    async function saveGlobalScore(newScore, newName) {
    if (!newName || newName === "Guest") return;

    // 1. Get the password
    const savedPass = localStorage.getItem('2048-player-password');

    try {
        // --- STEP A: CHECK THE DATABASE (The Truth Source) ---
        // Before we save ANYTHING, we check what the database already has.
        const { data: dbData, error: fetchError } = await supabaseClient
            .from('scores')
            .select('score')
            .eq('playerName', newName)
            .single();

        // If the user exists in DB, check their score
        if (dbData) {
            const dbHighScore = dbData.score;
            
            // If the new score is NOT higher than the DB score, STOP.
            if (newScore <= dbHighScore) {
                console.log(`Safety Check: New score (${newScore}) is not higher than DB record (${dbHighScore}). Keeping DB record.`);
                
                // Optional: Sync local best score to match the true DB high score
                if (playerBestScore < dbHighScore) {
                    playerBestScore = dbHighScore;
                    updateBestScore();
                }
                return; 
            }
        }

        // --- STEP B: SAVE (Only happens if we passed the check) ---
        console.log(`New Record! Overwriting DB. Old: ${dbData ? dbData.score : 0} -> New: ${newScore}`);
        
        const { error } = await supabaseClient
            .from('scores')
            .upsert({
                playerName: newName,
                score: newScore,
                password: savedPass 
            }, { onConflict: 'playerName' });

        if (error) {
            console.error("Supabase Save Error:", error.message);
        } else {
            console.log("Database synced successfully.");
            fetchGlobalScore(); // Update the leaderboard
        }
    } catch (e) {
        console.error("Connection Error:", e);
    }
}
    
   function showMessage(wonGame) {
        if (wonGame) {
            messageContainer.classList.add('game-won');
            messageText.textContent = 'You Win!';
        } else {
            messageContainer.classList.add('game-over');
            messageText.textContent = 'Game Over!';
        }
        messageContainer.style.display = 'flex';
    }

    function hideMessage() {
        messageContainer.classList.remove('game-won', 'game-over');
        messageContainer.style.display = 'none';
    }

    // Game Logic
    function slide(row) {
        let arr = row.filter(val => val);
        let missing = gridSize - arr.length;
        let zeros = Array(missing).fill(0);
        return arr.concat(zeros);
    }

    function combine(row) {
        for (let i = 0; i < gridSize - 1; i++) {
            if (row[i] !== 0 && row[i] === row[i + 1]) {
                row[i] *= 2;
                row[i + 1] = 0;

                if (row[i] === 2048 && !won && !keepPlaying) {
                    won = true;
                    setTimeout(() => showMessage(true), 300);
                }
            }
        }
        return row;
    }

    function moveRight() {
        let moved = false;
        let newGrid = JSON.parse(JSON.stringify(grid)); // Deep copy to detect change

        for (let r = 0; r < gridSize; r++) {
            let row = newGrid[r];
            let reversed = row.slice().reverse();
            let slid = slide(reversed);
            let combined = combine(slid);
            let slidAgain = slide(combined);
            newGrid[r] = slidAgain.reverse();
        }

        if (JSON.stringify(grid) !== JSON.stringify(newGrid)) {
            moved = true;
            saveState(); // Save BEFORE updating grid
            grid = newGrid;
        }
        return moved;
    }

    function moveLeft() {
        let moved = false;
        let newGrid = JSON.parse(JSON.stringify(grid));

        for (let r = 0; r < gridSize; r++) {
            let row = newGrid[r];
            let slid = slide(row);
            let combined = combine(slid);
            let slidAgain = slide(combined);
            newGrid[r] = slidAgain;
        }

        if (JSON.stringify(grid) !== JSON.stringify(newGrid)) {
            moved = true;
            saveState();
            grid = newGrid;
        }
        return moved;
    }

    function moveDown() {
        let moved = false;
        let newGrid = JSON.parse(JSON.stringify(grid));

        for (let c = 0; c < gridSize; c++) {
            let col = [newGrid[0][c], newGrid[1][c], newGrid[2][c], newGrid[3][c]];
            let reversed = col.reverse();
            let slid = slide(reversed);
            let combined = combine(slid);
            let slidAgain = slide(combined);
            let newCol = slidAgain.reverse();

            for (let r = 0; r < gridSize; r++) {
                newGrid[r][c] = newCol[r];
            }
        }

        if (JSON.stringify(grid) !== JSON.stringify(newGrid)) {
            moved = true;
            saveState();
            grid = newGrid;
        }
        return moved;
    }

    function moveUp() {
        let moved = false;
        let newGrid = JSON.parse(JSON.stringify(grid));

        for (let c = 0; c < gridSize; c++) {
            let col = [newGrid[0][c], newGrid[1][c], newGrid[2][c], newGrid[3][c]];
            let slid = slide(col);
            let combined = combine(slid);
            let slidAgain = slide(combined);
            let newCol = slidAgain;

            for (let r = 0; r < gridSize; r++) {
                newGrid[r][c] = newCol[r];
            }
        }

        if (JSON.stringify(grid) !== JSON.stringify(newGrid)) {
            moved = true;
            saveState();
            grid = newGrid;
        }
        return moved;
    }

    function isGameOver() {
        for (let r = 0; r < gridSize; r++) {
            for (let c = 0; c < gridSize; c++) {
                if (grid[r][c] === 0) return false;
                if (c < gridSize - 1 && grid[r][c] === grid[r][c + 1]) return false;
                if (r < gridSize - 1 && grid[r][c] === grid[r + 1][c]) return false;
            }
        }
        return true;
    }

    function handleInput(key) {
        if (won && !keepPlaying) return;

        let moved = false;
        switch (key) {
            case 'ArrowUp': moved = moveUp(); break;
            case 'ArrowDown': moved = moveDown(); break;
            case 'ArrowLeft': moved = moveLeft(); break;
            case 'ArrowRight': moved = moveRight(); break;
        }

        if (moved) {
            addRandomTile();
            updateView();
            updateScore();
            updateUndoButton(); // Enable button if it was disabled
            if (isGameOver()) {
                setTimeout(() => showMessage(false), 500);
            }
        }
    }

    // Event Listeners
    document.addEventListener('keydown', (e) => {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            e.preventDefault(); // prevent scrolling
            handleInput(e.key);
        }
    });

    restartButton.addEventListener('click', initGame);
    undoButton.addEventListener('click', undo);
    if (mergeButton) mergeButton.addEventListener('click', magicMerge);
    retryButton.addEventListener('click', initGame);
    keepPlayingButton.addEventListener('click', () => {
        keepPlaying = true;
        hideMessage();
    });

    // Touch support - ONLY on game container to allow page scrolling
    const gameContainer = document.querySelector('.game-container');

    gameContainer.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    }, { passive: true });

    gameContainer.addEventListener('touchmove', (e) => {
        // Prevent scrolling ONLY when touching the game board
        e.preventDefault();
    }, { passive: false });

    gameContainer.addEventListener('touchend', (e) => {
        if (!touchStartX || !touchStartY) return;

        let touchEndX = e.changedTouches[0].clientX;
        let touchEndY = e.changedTouches[0].clientY;

        let diffX = touchEndX - touchStartX;
        let diffY = touchEndY - touchStartY;

        if (Math.abs(diffX) > Math.abs(diffY)) {
            // Horizontal
            if (Math.abs(diffX) > 30) { // threshold
                if (diffX > 0) handleInput('ArrowRight');
                else handleInput('ArrowLeft');
            }
        } else {
            // Vertical
            if (Math.abs(diffY) > 30) {
                if (diffY > 0) handleInput('ArrowDown');
                else handleInput('ArrowUp');
            }
        }

        touchStartX = 0;
        touchStartY = 0;
    }, { passive: true });

    // --- Player Identity & Persistence ---

    // 1. Check if we already have a player
    if (playerName && playerName !== "Guest") {
        nameModal.style.display = 'none';
        showPlayerInfo(playerName);

        // Fetch the saved score from Supabase right now!
        async function syncExistingPlayer() {
            const savedPass = localStorage.getItem('2048-player-password');
            const { data, error } = await supabaseClient
                .from('scores')
                .select('score')
                .eq('playerName', playerName)
                .eq('password', savedPass) // Checks name AND password
                .single();

            if (data) {
                playerBestScore = data.score;
                updateBestScore();
                updateComparisonChart();
            } else {
                // If password doesn't match or user deleted, log them out
                localStorage.removeItem('2048-player-name');
                localStorage.removeItem('2048-player-password');
                location.reload();
            }
            initGame();
        }
        syncExistingPlayer();
    } else {
        // Guest mode logic
        nameModal.style.display = 'none';
        playerName = "Guest";
        showPlayerInfo(playerName);
        initGame();
    }

    function showPlayerInfo(name) {
        document.querySelector('.player-info').style.display = 'flex';
        document.getElementById('player-display').textContent = `Playing as :  ${name}`;

        const changeBtn = document.getElementById('change-player-btn');
        const signinBtn = document.getElementById('signin-btn');

        if (name === "Guest") {
            changeBtn.style.display = 'none';
            signinBtn.style.display = 'inline-block';
        } else {
            changeBtn.style.display = 'inline-block';
            signinBtn.style.display = 'none';
        }
    }

    // 2. Start Game with Validation logic
    let isLoginMode = false; // Default: Register

    // Toggle Mode
    const toggleBtn = document.getElementById('toggle-mode-btn');
    const toggleText = document.getElementById('toggle-text');
    const modalTitle = document.getElementById('modal-title');
    const startBtn = document.getElementById('start-game-btn');
    const signinBtn = document.getElementById('signin-btn');

    if (signinBtn) {
        signinBtn.addEventListener('click', () => {
            nameModal.style.display = 'flex';
            document.getElementById('player-name-input').focus();
            // Switch to Login Mode by default for convenience? Or keep standard?
            // Let's toggle to Login mode if they clicked Sign In
            if (!isLoginMode && toggleBtn) toggleBtn.click();
        });
    }

    if (toggleBtn) {
        toggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            isLoginMode = !isLoginMode;

            // Clear errors
            document.getElementById('name-error').textContent = "";
            document.getElementById('player-name-input').value = "";

            if (isLoginMode) {
                modalTitle.textContent = "Welcome Back!";
                startBtn.textContent = "Resume Game";
                toggleText.textContent = "New player?";
                toggleBtn.textContent = "Register here";
            } else {
                modalTitle.textContent = "Welcome to 2048";
                startBtn.textContent = "Start Game";
                toggleText.textContent = "Returning player?";
                toggleBtn.textContent = "Login here";
            }
        });
    }

    startGameBtn.addEventListener('click', async () => {
        const inputName = playerNameInput.value.trim();
        const inputPass = document.getElementById('player-password-input').value; // Get password
        const errorMsg = document.getElementById('name-error');

        if (!inputName) {
            errorMsg.textContent = "Please enter a name!";
            return;
        }

        try {
            // Check if user exists
            const { data, error } = await supabaseClient
                .from('scores')
                .select('*')
                .eq('playerName', inputName)
                .single();

            if (isLoginMode) {
                // LOGIN LOGIC
                if (!data) {
                    errorMsg.textContent = "User not found!";
                    return;
                }
                if (data.password !== inputPass) {
                    errorMsg.textContent = "Incorrect password!";
                    return;
                }
                playerBestScore = data.score || 0;
            } else {
                // REGISTER LOGIC
                if (data) {
                    errorMsg.textContent = "Name taken! Login if it's you.";
                    return;
                }
                if (inputPass.length < 4) {
                    errorMsg.textContent = "Password must be at least 4 characters.";
                    return;
                }

                const { error: regError } = await supabaseClient
                    .from('scores')
                    .insert([{ playerName: inputName, score: 0, password: inputPass }]);

                if (regError) {
                    errorMsg.textContent = "Registration failed!";
                    return;
                }
                playerBestScore = 0;
            }

            // SUCCESS logic
            playerName = inputName;
            localStorage.setItem('2048-player-name', playerName);
            localStorage.setItem('2048-player-password', inputPass); // Save password for refresh
            nameModal.style.display = 'none';

            showPlayerInfo(playerName);
            initGame();

        } catch (e) {
            console.error("Validation error", e);
            errorMsg.textContent = "Account error. Try again.";
        }
    });

    // 3. Change Player
    const changeBtn = document.getElementById('change-player-btn');
    if (changeBtn) {
        changeBtn.addEventListener('click', () => {
            localStorage.removeItem('2048-player-name');
            localStorage.removeItem('2048-player-password');
            playerName = '';
            document.querySelector('.player-info').style.display = 'none';
            window.location.reload();
        });
    }

    // --- Chart Functions ---

    // 1. Leaderboard Chart (Bottom)
    function initLeaderboardChart() {
        const ctx = document.getElementById('leaderboardChart').getContext('2d');
        if (leaderboardChart) leaderboardChart.destroy();

        leaderboardChart = new Chart(ctx, {
            type: 'bar', // Horizontal bar
            data: {
                labels: [],
                datasets: [{
                    label: 'Score',
                    data: [],
                    backgroundColor: 'rgba(16, 185, 129, 0.7)', // Emerald
                    borderColor: 'rgba(16, 185, 129, 1)',
                    borderWidth: 1,
                    barThickness: 15
                }]
            },
            options: {
                indexAxis: 'y',
                maintainAspectRatio: false,
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: { color: '#ffffff', font: { weight: 'bold' } },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    },
                    y: {
                        ticks: { color: '#ffffff', font: { weight: 'bold', size: 12 } },
                        grid: { display: false }
                    }
                },
                plugins: {
                    legend: { display: false },
                    title: { display: false } // Title in HTML
                },
                animation: { duration: 500 },
                responsive: true
            }
        });
    }

    function updateLeaderboardChartData(leaderboardData) {
        if (!leaderboardChart) return;

        let top10 = leaderboardData.slice(0, 10);

       const namesWithRank = top10.map((item, index) => {
            const rank = index + 1;
            return `${rank}  ${item.playerName}`; 
        });

        const scores = top10.map(item => item.score);

        // Update chart
        leaderboardChart.data.labels = namesWithRank;
        leaderboardChart.data.datasets[0].data = scores;
        leaderboardChart.update();
    }

    // 2. Comparison Chart (Top)
    function initComparisonChart() {
        const ctx = document.getElementById('comparisonChart').getContext('2d');
        if (comparisonChart) comparisonChart.destroy();

        comparisonChart = new Chart(ctx, {
            type: 'bar', // Vertical bar for comparison
            data: {
                labels: ['Current Score', 'Your Best', 'Global Record'],
                datasets: [{
                    label: 'Points',
                    data: [0, 0, 0],
                    backgroundColor: [
                        'rgba(59, 130, 246, 0.8)', // Blue for Current
                        'rgba(139, 92, 246, 0.8)', // Purple for Best
                        'rgba(239, 68, 68, 0.8)'   // Red for Global
                    ],
                    borderColor: [
                        'rgba(59, 130, 246, 1)',
                        'rgba(139, 92, 246, 1)',
                        'rgba(239, 68, 68, 1)'
                    ],
                    borderWidth: 1,
                    barPercentage: 0.6
                }]
            },
            options: {
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { color: '#ffffff', font: { weight: 'bold' } },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    },
                    x: {
                        ticks: { color: '#ffffff', font: { weight: 'bold', size: 14 } },
                        grid: { display: false }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: true }
                },
                animation: { duration: 300 },
                responsive: true
            }
        });
        updateComparisonChart();
    }

    function updateComparisonChart() {
        if (!comparisonChart) return;

        // Use maximums to make sure data is sensible
        const current = score;
        const best = Math.max(score, playerBestScore);
        const global = Math.max(score, globalBestScore);

        comparisonChart.data.datasets[0].data = [current, best, global];
        comparisonChart.update();
    }

    // Handle window resize for positioning
    window.addEventListener('resize', () => {
        updateView();
    });
});



