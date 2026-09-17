// TARGET TRACKER V3
// Core rule:
// 1. ONE identical ball appears first.
// 2. The player watches it.
// 3. Several IDENTICAL balls appear CLOSE to it.
// 4. All balls move for AT LEAST 5 seconds.
// 5. Balls cross and pass close to one another.
// 6. No target marker remains after the introduction.
// 7. The player taps the ball that was the FIRST ball.
//
// The target is tracked internally by ID only. It is never selected
// because of color, shape, size, or a permanent visual marker.

const welcomeScreen = document.getElementById("welcomeScreen");
const gameScreen = document.getElementById("gameScreen");
const resultScreen = document.getElementById("resultScreen");
const pauseOverlay = document.getElementById("pauseOverlay");

const startBtn = document.getElementById("startBtn");
const gentleBtn = document.getElementById("gentleBtn");
const practiceBtn = document.getElementById("practiceBtn");
const soundBtn = document.getElementById("soundBtn");
const pauseBtn = document.getElementById("pauseBtn");
const continueBtn = document.getElementById("continueBtn");
const restartBtn = document.getElementById("restartBtn");
const exitBtn = document.getElementById("exitBtn");
const nextBtn = document.getElementById("nextBtn");
const homeBtn = document.getElementById("homeBtn");

const gameArea = document.getElementById("gameArea");
const message = document.getElementById("message");
const phaseText = document.getElementById("phaseText");
const progressBar = document.getElementById("progressBar");
const levelText = document.getElementById("levelText");
const scoreText = document.getElementById("scoreText");

const resultIcon = document.getElementById("resultIcon");
const resultTitle = document.getElementById("resultTitle");
const resultMessage = document.getElementById("resultMessage");
const finalScore = document.getElementById("finalScore");

const LEVELS = [
  { extras: 3, speed: 58, moveTime: 6000, size: 60, intro: 2200, close: 95 },
  { extras: 4, speed: 66, moveTime: 6500, size: 60, intro: 2100, close: 90 },
  { extras: 5, speed: 74, moveTime: 7000, size: 60, intro: 2000, close: 85 },
  { extras: 6, speed: 84, moveTime: 8000, size:60, intro: 1900, close: 80 },
  { extras: 8, speed: 96, moveTime: 9000, size:60, intro: 1800, close: 75 }
];

let level = 1;
let score = 0;
let roundCorrect = 0;
let roundAttempts = 0;
let gentleMode = true;
let soundOn = true;

let balls = [];
let targetId = null;
let nextBallId = 1;

let phase = "idle";
let phaseTimer = null;
let animationFrame = null;
let movementStart = 0;
let paused = false;
let pauseStarted = 0;
let elapsedBeforePause = 0;

function showScreen(screen) {
  [welcomeScreen, gameScreen, resultScreen].forEach(s => s.classList.remove("active"));
  screen.classList.add("active");
}

function speak(text) {
  if (!soundOn || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.82;
  u.pitch = 1;
  u.volume = 0.8;
  window.speechSynthesis.speak(u);
}

function setMessage(text) {
  message.textContent = text;
}

function setMode(gentle) {
  gentleMode = gentle;
  gentleBtn.classList.toggle("selected", gentle);
  practiceBtn.classList.toggle("selected", !gentle);
}

gentleBtn.addEventListener("click", () => setMode(true));
practiceBtn.addEventListener("click", () => setMode(false));

soundBtn.addEventListener("click", () => {
  soundOn = !soundOn;
  soundBtn.textContent = soundOn ? "🔊 Sound On" : "🔇 Sound Off";
  soundBtn.setAttribute("aria-pressed", String(soundOn));
});

startBtn.addEventListener("click", () => {
  level = 1;
  score = 0;
  roundCorrect = 0;
  roundAttempts = 0;
  scoreText.textContent = score;
  startRound();
});

nextBtn.addEventListener("click", () => startRound());

homeBtn.addEventListener("click", () => {
  stopEverything();
  showScreen(welcomeScreen);
});

exitBtn.addEventListener("click", () => {
  stopEverything();
  showScreen(welcomeScreen);
});

pauseBtn.addEventListener("click", pauseGame);
continueBtn.addEventListener("click", resumeGame);
restartBtn.addEventListener("click", () => {
  resumeGame();
  startRound();
});

function stopEverything() {
  clearTimeout(phaseTimer);
  cancelAnimationFrame(animationFrame);
  animationFrame = null;
  balls = [];
  targetId = null;
  gameArea.innerHTML = "";
  phase = "idle";
  paused = false;
  pauseOverlay.classList.add("hidden");
  progressBar.style.width = "0%";
}

function startRound() {
  stopEverything();
  showScreen(gameScreen);
  levelText.textContent = level;
  scoreText.textContent = score;

  const cfg = LEVELS[level - 1];
  setMessage("Get ready. Watch the ball that appears first.");
  phaseText.textContent = "One ball will appear...";
  speak("Watch the ball that appears first.");

  phase = "intro";
  phaseTimer = setTimeout(createFirstBall, 700);
}

function createFirstBall() {
  if (phase !== "intro") return;

  const cfg = LEVELS[level - 1];
  const { width, height } = gameArea.getBoundingClientRect();

  // Start near the center so distractors can genuinely mix with it.
  const x = width * (0.43 + Math.random() * 0.14);
  const y = height * (0.40 + Math.random() * 0.18);

  const target = createBall({
    x, y,
    angle: randomAngle(),
    speed: cfg.speed * 0.9,
    isTarget: true
  });

  targetId = target.id;
  target.el.classList.add("first-intro");

  setMessage("Watch this ball carefully.");
  phaseText.textContent = "Remember the first ball";
  speak("Watch this ball carefully.");

  phaseTimer = setTimeout(introduceOthers, cfg.intro);
}

function introduceOthers() {
    if (phase !== "intro") return;

    const cfg = LEVELS[level - 1];

    // Remove the temporary marker from the first ball.
    // From this point, every ball is visually identical.
    balls[0].el.classList.remove("first-intro");

    /*
       IMPORTANT:
       Create ALL additional balls immediately.
       There is NO delay between balls.
    */

    const newBalls = [];

    for (let i = 0; i < cfg.extras; i++) {
        const beforeCount = balls.length;

        addDistractorNearTarget(i, cfg);

        if (balls.length > beforeCount) {
            newBalls.push(balls[balls.length - 1]);
        }
    }

    /*
       Make the newly created balls invisible initially.
       They all exist at their different nearby positions.
    */

    newBalls.forEach(ball => {
        ball.el.style.opacity = "0";
    });

    /*
       Wait for the browser to render all balls at their
       starting positions, then animate ALL of them together.
    */

    requestAnimationFrame(() => {

        newBalls.forEach(ball => {

            const animation = ball.el.animate(
                [
                    {
                        opacity: 0,
                        offset: 0
                    },
                    {
                        opacity: 1,
                        offset: 1
                    }
                ],
                {
                    duration: 700,
                    easing: "ease-out",
                    fill: "forwards"
                }
            );

            animation.onfinish = () => {
                ball.el.style.opacity = "1";
            };
        });

        /*
           Movement starts only after the smooth appearance
           animation has completed.
        */

        setTimeout(() => {

            if (phase !== "intro") return;

            phase = "moving";

            movementStart = performance.now();
            elapsedBeforePause = 0;

            setMessage("Keep watching the FIRST ball.");
            phaseText.textContent = "Follow it...";

            speak("Keep watching the first ball.");

            animationFrame = requestAnimationFrame(moveBalls);

        }, 750);
    });
}

function addDistractorNearTarget(index, cfg) {
  const target = balls.find(b => b.id === targetId);
  const { width, height } = gameArea.getBoundingClientRect();

  const angle = randomAngle();
  const radius = Math.min(cfg.close, Math.min(width, height) * 0.17);

  let x = target.x + Math.cos(angle) * (radius * (0.35 + Math.random() * 0.65));
  let y = target.y + Math.sin(angle) * (radius * (0.35 + Math.random() * 0.65));

  // Keep inside safe bounds.
  x = clamp(x, cfg.size / 2 + 5, width - cfg.size / 2 - 5);
  y = clamp(y, cfg.size / 2 + 5, height - cfg.size / 2 - 5);

  // Give balls crossing directions. Some intentionally head toward the
  // target's path so the player must track identity rather than location.
  let direction = angle + Math.PI / 2 + (Math.random() - 0.5) * 1.4;

  if (index % 2 === 0) direction += Math.PI;

  createBall({
    x, y,
    angle: direction,
    speed: cfg.speed * (0.85 + Math.random() * 0.35),
    isTarget: false
  });
}

function createBall({ x, y, angle, speed, isTarget }) {
  const cfg = LEVELS[level - 1];
  const el = document.createElement("div");
  el.className = "ball";
  el.style.setProperty("--ball-size", `${cfg.size}px`);
  el.setAttribute("role", "button");
  el.setAttribute("aria-label", "Ball");

  const ball = {
    id: nextBallId++,
    el,
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    speed,
    isTarget
  };

  el.dataset.ballId = String(ball.id);
  gameArea.appendChild(el);
  balls.push(ball);
  renderBall(ball);

  el.addEventListener("pointerdown", event => {
    event.preventDefault();
    if (phase === "select") chooseBall(ball.id);
  });

  return ball;
}

function moveBalls(now) {
  if (phase !== "moving") return;

  const cfg = LEVELS[level - 1];
  const elapsed = now - movementStart - elapsedBeforePause;
  const progress = Math.min(1, elapsed / cfg.moveTime);

  progressBar.style.width = `${progress * 100}%`;

  const rect = gameArea.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  const r = cfg.size / 2;

  for (const b of balls) {
    b.x += b.vx / 60;
    b.y += b.vy / 60;

    // Soft bouncing at boundaries.
    if (b.x < r) {
      b.x = r;
      b.vx = Math.abs(b.vx);
    }
    if (b.x > width - r) {
      b.x = width - r;
      b.vx = -Math.abs(b.vx);
    }
    if (b.y < r) {
      b.y = r;
      b.vy = Math.abs(b.vy);
    }
    if (b.y > height - r) {
      b.y = height - r;
      b.vy = -Math.abs(b.vy);
    }

    renderBall(b);
  }

  // Gentle separation prevents balls from getting permanently stuck,
  // while still allowing them to pass very close to each other.
  separateBalls(width, height, r);

  if (progress >= 1) {
    stopMovement();
    return;
  }

  animationFrame = requestAnimationFrame(moveBalls);
}

function separateBalls(width, height, r) {
  const minDistance = Math.max(r * 0.62, 24);

  for (let i = 0; i < balls.length; i++) {
    for (let j = i + 1; j < balls.length; j++) {
      const a = balls[i];
      const b = balls[j];
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let d = Math.hypot(dx, dy);

      if (d === 0) {
        dx = 1;
        dy = 0;
        d = 1;
      }

      if (d < minDistance) {
        const push = (minDistance - d) / 2;
        const nx = dx / d;
        const ny = dy / d;

        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;

        // Small direction exchange makes crossing more unpredictable.
        if (Math.random() < 0.025) {
          const tempX = a.vx;
          const tempY = a.vy;
          a.vx = b.vx * 0.96;
          a.vy = b.vy * 0.96;
          b.vx = tempX * 0.96;
          b.vy = tempY * 0.96;
        }

        a.x = clamp(a.x, r, width - r);
        a.y = clamp(a.y, r, height - r);
        b.x = clamp(b.x, r, width - r);
        b.y = clamp(b.y, r, height - r);

        renderBall(a);
        renderBall(b);
      }
    }
  }
}

function stopMovement() {
  cancelAnimationFrame(animationFrame);
  animationFrame = null;
  phase = "select";
  progressBar.style.width = "100%";

  balls.forEach(b => b.el.classList.add("selectable"));

  setMessage("Which ball was FIRST?");
  phaseText.textContent = "Tap the ball you followed.";
  speak("Which ball was first? Tap it.");
}

function chooseBall(id) {
  if (phase !== "select") return;

  roundAttempts++;

  if (id === targetId) {
    roundCorrect++;
    const points = Math.max(10, 100 - (roundAttempts - 1) * 15);
    score += points;
    scoreText.textContent = score;

    const chosen = balls.find(b => b.id === id);
    chosen.el.classList.add("selected-correct");

    resultIcon.textContent = "🌟";
    resultTitle.textContent = "Well done!";
    resultMessage.textContent = "You tracked the first ball.";
    finalScore.textContent = score;
    speak("Well done. You found the first ball.");

    adaptDifficulty(true);
    phase = "result";
    setTimeout(() => showScreen(resultScreen), 650);
  } else {
    const chosen = balls.find(b => b.id === id);
    chosen.el.classList.add("selected-wrong");
    setTimeout(() => chosen.el.classList.remove("selected-wrong"), 300);

    setMessage("Not that one. Look again.");
    phaseText.textContent = "Try another ball.";
    speak("Not that one. Look again.");
  }
}

function adaptDifficulty(correct) {
  // Difficulty changes gradually based on recent performance.
  // No level is skipped.
  if (correct && roundAttempts === 1 && level < LEVELS.length) {
    level++;
  }
}

function pauseGame() {
  if (phase !== "moving" || paused) return;

  paused = true;
  pauseStarted = performance.now();
  cancelAnimationFrame(animationFrame);
  animationFrame = null;
  pauseOverlay.classList.remove("hidden");
  speak("Paused.");
}

function resumeGame() {
  if (!paused) return;

  const now = performance.now();
  elapsedBeforePause += now - pauseStarted;
  paused = false;
  pauseOverlay.classList.add("hidden");

  if (phase === "moving") {
    animationFrame = requestAnimationFrame(moveBalls);
  }
}

function renderBall(b) {
  b.el.style.left = `${b.x}px`;
  b.el.style.top = `${b.y}px`;
}

function randomAngle() {
  return Math.random() * Math.PI * 2;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

window.addEventListener("resize", () => {
  if (!gameArea || balls.length === 0) return;

  const rect = gameArea.getBoundingClientRect();
  const size = LEVELS[level - 1].size;
  const r = size / 2;

  for (const b of balls) {
    b.x = clamp(b.x, r, Math.max(r, rect.width - r));
    b.y = clamp(b.y, r, Math.max(r, rect.height - r));
    renderBall(b);
  }
});
