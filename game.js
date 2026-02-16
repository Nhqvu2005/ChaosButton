/**
 * Button Chaos - Game Logic
 * "Conditional Reaction" Game
 */

const GameState = {
    START: 'START',
    PLAYING: 'PLAYING',
    GAME_OVER: 'GAME_OVER'
};

const Config = {
    INITIAL_LIVES: 3,
    BASE_TIME: 10000, // 10s initially
    MIN_TIME: 2500,   // Minimum 2.5s per turn
    TIME_DECAY: 200,  // -200ms per round
    COLORS: ['red', 'blue', 'green', 'yellow'],
    BUTTON_COUNT_BASE: 4,
    COOKIE_NAME: 'btn_chaos_highscore',
    COOKIE_DAYS: 365
};

class ButtonChaosGame {
    constructor() {
        this.state = GameState.START;
        this.score = 0;
        this.lives = Config.INITIAL_LIVES;
        this.round = 0;
        this.streak = 0;
        this.bestStreak = 0;
        this.timer = null;
        this.timeLeft = 0;
        this.totalTime = 0;
        this.buttons = [];
        this.lastAction = null; // Stores info about the last correct button clicked
        this.currentRule = null; // The function to validate input

        // DOM Elements
        this.screens = {
            start: document.getElementById('startScreen'),
            game: document.getElementById('gameScreen'),
            gameOver: document.getElementById('gameOverScreen')
        };

        this.ui = {
            lives: document.getElementById('livesContainer'),
            timerBar: document.getElementById('timerBar'),
            score: document.getElementById('currentScore'),
            instruction: document.getElementById('instructionText'),
            grid: document.getElementById('buttonGrid'),
            combo: document.getElementById('comboDisplay'),
            finalScore: document.getElementById('finalScore'),
            bestScoreEnd: document.getElementById('bestScoreEnd'),
            bestScoreStart: document.getElementById('bestScoreStart'),
            finalRounds: document.getElementById('finalRounds'),
            newRecordMsg: document.getElementById('newRecordMsg')
        };

        this.init();
    }

    init() {
        this.loadHighScore();

        document.getElementById('startBtn').addEventListener('click', () => this.startGame());
        document.getElementById('restartBtn').addEventListener('click', () => this.startGame());
        document.getElementById('menuBtn').addEventListener('click', () => this.showScreen(GameState.START));

        // Window resize handling if needed
        window.addEventListener('resize', () => { });
    }

    showScreen(state) {
        Object.values(this.screens).forEach(s => s.classList.remove('active'));
        this.state = state;

        switch (state) {
            case GameState.START:
                this.screens.start.classList.add('active');
                this.loadHighScore(); // Refresh high score display
                break;
            case GameState.PLAYING:
                this.screens.game.classList.add('active');
                break;
            case GameState.GAME_OVER:
                this.screens.gameOver.classList.add('active');
                break;
        }
    }

    startGame() {
        this.score = 0;
        this.lives = Config.INITIAL_LIVES;
        this.round = 0;
        this.streak = 0;
        this.lastAction = null; // Reset history
        this.updateUI();
        this.showScreen(GameState.PLAYING);
        this.nextRound();
    }

    nextRound() {
        this.round++;

        // Calculate Time
        let timeForRound = Math.max(Config.MIN_TIME, Config.BASE_TIME - (this.round * Config.TIME_DECAY));
        this.totalTime = timeForRound;
        this.timeLeft = timeForRound;

        this.generateButtons();
        this.generateRule();
        this.startTimer();
    }

    generateButtons() {
        this.ui.grid.innerHTML = '';
        this.buttons = [];
        const count = Config.BUTTON_COUNT_BASE; // Fixed 4 buttons for simplicity initially

        for (let i = 0; i < count; i++) {
            const btnData = {
                id: i,
                color: Config.COLORS[Math.floor(Math.random() * Config.COLORS.length)],
                number: Math.floor(Math.random() * 9) + 1, // 1-9
                position: i + 1 // 1-based index
            };

            this.buttons.push(btnData);

            const btnEl = document.createElement('button');
            btnEl.className = `game-btn btn-${btnData.color}`;
            // btnEl.textContent = btnData.number; // OLD

            // NEW: Number + Position Badge
            btnEl.innerHTML = `
                ${btnData.number}
                <span class="pos-badge">#${btnData.position}</span>
            `;

            btnEl.dataset.id = i;

            // Interaction
            // Note: e.target might be the span, so we use currentTarget or closest
            btnEl.addEventListener('click', (e) => this.handleButtonClick(btnData, e.currentTarget));

            this.ui.grid.appendChild(btnEl);
        }
    }

    /**
     * RULE ENGINE
     * Generates instructions based on game difficulty and history
     */
    generateRule() {
        let instruction = "";
        let validator = null;

        const isEasy = this.round <= 5;
        const isMedium = this.round > 5 && this.round <= 12;
        const isHard = this.round > 12;

        // Basic conditions
        const targetNumber = this.buttons[Math.floor(Math.random() * this.buttons.length)].number;
        const targetColor = this.buttons[Math.floor(Math.random() * this.buttons.length)].color;
        const targetPos = Math.floor(Math.random() * this.buttons.length) + 1; // 1-based

        // --- LEVEL 1: DIRECT INSTRUCTION (Round 1-5) ---
        if (isEasy || !this.lastAction) {
            const type = Math.random();
            if (type < 0.33) {
                instruction = `Click button <span class="highlight">NUMBER ${targetNumber}</span>`;
                validator = (btn) => btn.number === targetNumber;
            } else if (type < 0.66) {
                instruction = `Click <span class="highlight-${targetColor}">${targetColor.toUpperCase()}</span> button`;
                validator = (btn) => btn.color === targetColor;
            } else {
                instruction = `Click button at <span class="highlight">POSITION ${targetPos}</span>`;
                validator = (btn) => btn.position === targetPos;
            }
        }

        // --- LEVEL 2: CONDITIONAL (Round 6-12) ---
        else if (isMedium) {
            // "If previous was [Condition], click [A], else click [B]"
            // We use known history (this.lastAction) to generate a valid rule

            const prevColor = this.lastAction.color;
            const prevWasRed = prevColor === 'red';
            const prevWasOdd = this.lastAction.number % 2 !== 0;

            const type = Math.random();

            if (type < 0.5) {
                // Color Condition
                instruction = `If previous was <span class="highlight-red">RED</span>, click <span class="highlight-blue">BLUE</span>. Else click <span class="highlight-yellow">YELLOW</span>.`;
                const target = prevWasRed ? 'blue' : 'yellow';
                validator = (btn) => btn.color === target;
            } else {
                // Number Condition
                instruction = `If previous was <span class="highlight">ODD</span>, click <span class="highlight">SMALLEST</span> number. Else click <span class="highlight">LARGEST</span>.`;
                const findMin = (arr) => Math.min(...arr.map(b => b.number));
                const findMax = (arr) => Math.max(...arr.map(b => b.number));
                const targetVal = prevWasOdd ? findMin(this.buttons) : findMax(this.buttons);
                validator = (btn) => btn.number === targetVal;
            }
        }

        // --- LEVEL 3: CHAOS (Round 13+) ---
        else if (isHard) {
            const prevPos = this.lastAction.position;
            // Example: "If previous Position + Current Round is EVEN..."
            const cond = (prevPos + this.round) % 2 === 0;

            instruction = `If (Prev Pos + Round ${this.round}) is <span class="highlight">EVEN</span>, click <span class="highlight-${targetColor}">${targetColor.toUpperCase()}</span>. Else click <span class="highlight">NUMBER ${targetNumber}</span>.`;

            validator = (btn) => cond ? btn.color === targetColor : btn.number === targetNumber;
        }

        // Failsafe if generator produced specific target that doesn't exist (rare in logic above but good practice)
        // In this specific logic, I ensure targets exist by picking props from current buttons.
        // But "Find smallest/largest" always returns a value.

        this.ui.instruction.innerHTML = instruction;
        this.currentRule = validator;
    }

    handleButtonClick(btnData, btnElement) {
        if (this.state !== GameState.PLAYING) return;

        // Check Validity
        let isValid = false;
        try {
            isValid = this.currentRule(btnData);
        } catch (e) {
            console.error("Rule validation error", e);
            isValid = false; // Fail safe
        }

        if (isValid) {
            // SUCCESS
            this.handleSuccess(btnData);
        } else {
            // FAILURE
            this.handleFailure(btnElement);
        }
    }

    handleSuccess(btnData) {
        this.stopTimer();
        this.streak++;
        if (this.streak > this.bestStreak) this.bestStreak = this.streak;

        // Calculate Score
        // Base score (100) + Time Bonus (0-100) + Streak Bonus
        const timeBonus = Math.floor((this.timeLeft / this.totalTime) * 100);
        const streakBonus = this.streak * 10;
        this.score += (100 + timeBonus + streakBonus);

        // Show Combo
        if (this.streak > 1) {
            this.ui.combo.textContent = `COMBO x${this.streak}!`;
            this.ui.combo.classList.remove('hidden');
            this.ui.combo.style.animation = 'none';
            this.ui.combo.offsetHeight; /* trigger reflow */
            this.ui.combo.style.animation = 'popUp 0.8s forwards';
        }

        // Save History
        this.lastAction = { ...btnData };

        this.updateUI();
        this.nextRound();
    }

    handleFailure(btnElement) {
        // Visual Feedback
        btnElement.classList.add('shake');
        setTimeout(() => btnElement.classList.remove('shake'), 500);

        this.lives--;
        this.streak = 0; // Reset streak

        this.updateUI();

        if (this.lives <= 0) {
            this.gameOver();
        }
    }

    startTimer() {
        if (this.timer) clearInterval(this.timer);

        const tickRate = 50; // Update every 50ms
        const step = (tickRate / this.totalTime) * 100;
        let width = 100;

        this.timer = setInterval(() => {
            this.timeLeft -= tickRate;
            width = (this.timeLeft / this.totalTime) * 100;

            this.ui.timerBar.style.width = `${width}%`;

            // Timer Color States
            this.ui.timerBar.classList.remove('warning', 'critical');
            if (width < 30) this.ui.timerBar.classList.add('critical');
            else if (width < 60) this.ui.timerBar.classList.add('warning');

            if (this.timeLeft <= 0) {
                this.handleTimeout();
            }
        }, tickRate);
    }

    stopTimer() {
        if (this.timer) clearInterval(this.timer);
    }

    handleTimeout() {
        this.stopTimer();
        this.lives--;
        this.streak = 0;
        this.updateUI();

        if (this.lives > 0) {
            // Flash screen red then next round
            document.body.style.backgroundColor = '#330000';
            setTimeout(() => {
                document.body.style.backgroundColor = '';
                this.nextRound(); // Force next round even on timeout to keep game moving
            }, 300);
        } else {
            this.gameOver();
        }
    }

    updateUI() {
        this.ui.score.textContent = this.score;

        // Lives
        const lifeEls = this.ui.lives.children;
        for (let i = 0; i < lifeEls.length; i++) {
            if (i < this.lives) lifeEls[i].classList.add('active');
            else lifeEls[i].classList.remove('active');
        }
    }

    gameOver() {
        this.stopTimer();
        this.state = GameState.GAME_OVER;

        // Check High Score
        const savedHigh = this.getHighScore();
        let isNewRecord = false;
        if (this.score > savedHigh) {
            this.saveHighScore(this.score);
            isNewRecord = true;
        }

        // Update Game Over UI
        this.ui.finalScore.textContent = this.score;
        this.ui.bestScoreEnd.textContent = isNewRecord ? this.score : savedHigh;
        this.ui.finalRounds.textContent = this.round;

        if (isNewRecord) this.ui.newRecordMsg.classList.remove('hidden');
        else this.ui.newRecordMsg.classList.add('hidden');

        this.showScreen(GameState.GAME_OVER);
    }

    // --- COOKIE HELPERS ---

    setCookie(name, value, days) {
        let expires = "";
        if (days) {
            const date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            expires = "; expires=" + date.toUTCString();
        }
        document.cookie = name + "=" + (value || "") + expires + "; path=/";
    }

    getCookie(name) {
        const nameEQ = name + "=";
        const ca = document.cookie.split(';');
        for (let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) == ' ') c = c.substring(1, c.length);
            if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
        }
        return null;
    }

    saveHighScore(score) {
        this.setCookie(Config.COOKIE_NAME, score, Config.COOKIE_DAYS);
    }

    getHighScore() {
        const val = this.getCookie(Config.COOKIE_NAME);
        return val ? parseInt(val) : 0;
    }

    loadHighScore() {
        const high = this.getHighScore();
        this.ui.bestScoreStart.textContent = high;
    }
}

// Start Game Instance
window.addEventListener('DOMContentLoaded', () => {
    new ButtonChaosGame();
});
