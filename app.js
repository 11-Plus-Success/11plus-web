// ------------- State for loaded questions -------------
let mathsQuestions = [];
let englishQuestions = [];
let verbalQuestions = [];
let nvrQuestions = [];

let questionsLoaded = false;

// ------------- Quiz runtime state -------------
let quizQuestions = [];
let currentIndex = 0;
let score = 0;
let answers = [];      // stores selected option index per question
let timerId = null;
let timeLeft = 0;      // seconds

// ------------- DOM references -------------
const categorySelect = document.getElementById("category-select");
const numQuestionsInput = document.getElementById("num-questions");
const timeMinsInput = document.getElementById("time-mins");
const startBtn = document.getElementById("start-btn");
const timerSpan = document.getElementById("timer");
const statusMessage = document.getElementById("status-message");

const quizBox = document.getElementById("quiz-box");
const questionText = document.getElementById("question-text");
const optionsDiv = document.getElementById("options");
const nextBtn = document.getElementById("next-btn");
const progressDiv = document.getElementById("progress");

const resultBox = document.getElementById("result-box");
const scoreText = document.getElementById("score-text");
const reviewList = document.getElementById("review-list");
const restartBtn = document.getElementById("restart-btn");

// ------------- Utility functions -------------
function shuffle(array) {
  const copy = array.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

// ------------- Loading questions from JSON -------------
function loadAllQuestions() {
  statusMessage.textContent = "Loading questions...";
  startBtn.disabled = true;

  return Promise.all([
    fetch("questions/maths.json").then(r => r.json()),
    fetch("questions/english.json").then(r => r.json()),
    fetch("questions/verbal.json").then(r => r.json()),
    fetch("questions/nvr.json").then(r => r.json())
  ])
    .then(([m, e, v, n]) => {
      mathsQuestions = m;
      englishQuestions = e;
      verbalQuestions = v;
      nvrQuestions = n;
      questionsLoaded = true;
      statusMessage.textContent = "Questions loaded. Choose settings and press Start.";
      startBtn.disabled = false;
    })
    .catch(err => {
      console.error(err);
      statusMessage.textContent =
        "Error loading question files. Please check that the JSON files exist and are valid.";
      startBtn.disabled = true;
    });
}

// ------------- Timer functions -------------
function startTimer(totalSeconds) {
  clearInterval(timerId);
  timeLeft = totalSeconds;
  timerSpan.textContent = `Time: ${formatTime(timeLeft)}`;

  timerId = setInterval(() => {
    timeLeft--;
    if (timeLeft < 0) {
      clearInterval(timerId);
      timerId = null;
      timerSpan.textContent = "Time: 00:00";
      showResult(true); // time up
      return;
    }
    timerSpan.textContent = `Time: ${formatTime(timeLeft)}`;
  }, 1000);
}

function stopTimer() {
  clearInterval(timerId);
  timerId = null;
}

// ------------- Quiz setup -------------
function getPoolForSubject(subject) {
  if (subject === "Maths") return mathsQuestions;
  if (subject === "English") return englishQuestions;
  if (subject === "Verbal") return verbalQuestions;
  if (subject === "NVR") return nvrQuestions;
  // all
  return [
    ...mathsQuestions,
    ...englishQuestions,
    ...verbalQuestions,
    ...nvrQuestions
  ];
}

function setupQuiz() {
  if (!questionsLoaded) {
    alert("Questions are still loading. Please wait a moment.");
    return;
  }

  const subject = categorySelect.value;
  let numQuestions = Number(numQuestionsInput.value) || 10;
  const timeMins = Number(timeMinsInput.value) || 10;

  const pool = getPoolForSubject(subject);

  if (!pool || pool.length === 0) {
    alert("No questions available for this subject.");
    return;
  }

  if (numQuestions > pool.length) {
    numQuestions = pool.length;
  }

  // Shuffle and slice
  const shuffled = shuffle(pool);
  quizQuestions = shuffled.slice(0, numQuestions);

  // Reset state
  currentIndex = 0;
  score = 0;
  answers = [];

  // Show quiz box, hide result box
  quizBox.style.display = "block";
  resultBox.style.display = "none";

  statusMessage.textContent = "";

  showQuestion();
  startTimer(timeMins * 60);
}

// ------------- Rendering questions -------------
let selectedOption = null;

function showQuestion() {
  const q = quizQuestions[currentIndex];
  if (!q) return;

  selectedOption = null;

  questionText.textContent = `(${q.category}) ${q.question}`;
  optionsDiv.innerHTML = "";

  q.options.forEach((opt, index) => {
    const btn = document.createElement("button");
    btn.textContent = opt;
    btn.className = "option-btn";
    btn.onclick = () => {
      selectedOption = index;
      document
        .querySelectorAll(".option-btn")
        .forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
    };
    optionsDiv.appendChild(btn);
  });

  progressDiv.textContent = `Question ${currentIndex + 1} of ${quizQuestions.length}`;
}

// ------------- Handling answers -------------
nextBtn.onclick = () => {
  if (timerId === null && timeLeft <= 0) {
    // already timed out and results shown
    return;
  }

  if (selectedOption === null) {
    alert("Please choose an answer.");
    return;
  }

  const q = quizQuestions[currentIndex];
  answers[currentIndex] = selectedOption;

  if (selectedOption === q.answerIndex) {
    score++;
  }

  currentIndex++;
  if (currentIndex < quizQuestions.length) {
    showQuestion();
  } else {
    showResult(false);
  }
};

// ------------- Results & review -------------
function showResult(timeUp) {
  stopTimer();
  quizBox.style.display = "none";
  resultBox.style.display = "block";

  if (timeUp) {
    scoreText.textContent = `Time's up! You scored ${score} out of ${quizQuestions.length}.`;
  } else {
    scoreText.textContent = `You scored ${score} out of ${quizQuestions.length}.`;
  }

  reviewList.innerHTML = "";

  quizQuestions.forEach((q, index) => {
    const chosenIndex = answers[index];
    const userAnswerText =
      chosenIndex != null ? q.options[chosenIndex] : "(no answer)";
    const correctAnswerText = q.options[q.answerIndex];
    const isCorrect = chosenIndex === q.answerIndex;

    const item = document.createElement("div");
    item.className = "review-item";

    const correctnessClass = isCorrect ? "correct" : "incorrect";
    const correctnessText = isCorrect ? "Correct" : "Incorrect";

    item.innerHTML = `
      <div class="review-header">
        <span>Q${index + 1} (${q.category})</span>
        <span class="review-answer ${correctnessClass}">${correctnessText}</span>
      </div>
      <div class="review-question">${q.question}</div>
      <div>✅ Correct answer: <strong>${correctAnswerText}</strong></div>
      <div>🧍 Your answer: <strong>${userAnswerText}</strong></div>
      ${
        q.explanation
          ? `<div class="review-explanation">💡 ${q.explanation}</div>`
          : ""
      }
    `;

    reviewList.appendChild(item);
  });
}

restartBtn.onclick = () => {
  setupQuiz();
};

// ------------- Initial load -------------
document.addEventListener("DOMContentLoaded", () => {
  loadAllQuestions();
});

startBtn.onclick = () => {
  setupQuiz();
};
