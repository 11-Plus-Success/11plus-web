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
let quizActive = false;
let currentMode = "exam"; // "practice" or "exam"

// ------------- DOM references -------------
const categorySelect = document.getElementById("category-select");
const numQuestionsInput = document.getElementById("num-questions");
const timeMinsInput = document.getElementById("time-mins");
const modeSelect = document.getElementById("mode-select");
const startBtn = document.getElementById("start-btn");
const timerSpan = document.getElementById("timer");
const statusMessage = document.getElementById("status-message");

const controlsBox = document.getElementById("controls");
const quizBox = document.getElementById("quiz-box");
const questionText = document.getElementById("question-text");
const optionsDiv = document.getElementById("options");
const nextBtn = document.getElementById("next-btn");
const progressDiv = document.getElementById("progress");

const resultBox = document.getElementById("result-box");
const scoreText = document.getElementById("score-text");
const reviewList = document.getElementById("review-list");
const restartBtn = document.getElementById("restart-btn");

// Auth-related DOM references
const authBox = document.getElementById("auth-box");
const authEmail = document.getElementById("auth-email");
const authPassword = document.getElementById("auth-password");
const authError = document.getElementById("auth-error");
const authStatus = document.getElementById("auth-status");
const loginBtn = document.getElementById("login-btn");
const registerBtn = document.getElementById("register-btn");
const logoutBtn = document.getElementById("logout-btn");

// Firebase auth handle
const auth = firebase.auth();

// Map internal topic codes → nice readable labels
const TOPIC_LABELS = {
  // Maths
  "arithmetic": "Arithmetic",
  "fractions": "Fractions",
  "percentages": "Percentages",
  "decimals": "Decimals",
  "measure-and-time": "Measure & Time",
  "geometry-and-angles": "Geometry & Angles",
  "statistics-and-averages": "Statistics & Averages",
  "money": "Money",

  // English
  "synonyms": "Synonyms",
  "antonyms": "Antonyms",
  "homophones": "Homophones",
  "spelling": "Spelling",
  "punctuation": "Punctuation",
  "grammar": "Grammar",
  "nouns": "Nouns",
  "verbs": "Verbs",
  "adjectives": "Adjectives",
  "adverbs": "Adverbs",
  "conjunctions": "Conjunctions",
  "verb-tenses": "Verb Tenses",
  "word-relations": "Word Relations",
  "word-patterns": "Word Patterns",
  "word-sequences": "Word Sequences",

  // Verbal Reasoning
  "odd-one-out-words": "Odd One Out (Words)",
  "word-analogies": "Word Analogies",
  "word-codes": "Word Codes",
  "compound-words": "Compound Words",

  // NVR
  "odd-one-out-shapes": "Odd One Out (Shapes)",
  "shape-sequences": "Shape Sequences",
  "rotations-and-reflections": "Rotations & Reflections",
  "shape-properties": "Shape Properties",
  "nets-and-3d": "Nets & 3D Shapes"
};

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

function setControlsEnabled(enabled) {
  categorySelect.disabled = !enabled;
  numQuestionsInput.disabled = !enabled;
  timeMinsInput.disabled = !enabled;
  modeSelect.disabled = !enabled;
  startBtn.disabled = !enabled || !questionsLoaded;
}

// ------------- Loading questions from JSON -------------
function loadAllQuestions() {
  statusMessage.textContent = "Loading questions...";
  setControlsEnabled(false);

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

      // Only enable controls if user is signed in
      if (auth.currentUser) {
        setControlsEnabled(true);
      }
    })
    .catch(err => {
      console.error(err);
      statusMessage.textContent =
        "Error loading question files. Please check that the JSON files exist and are valid.";
      setControlsEnabled(false);
    });
}

// ------------- Timer functions -------------
function startTimer(totalSeconds) {
  clearInterval(timerId);
  timeLeft = totalSeconds;
  timerSpan.classList.remove("timer-warning");
  timerSpan.textContent = `Time: ${formatTime(timeLeft)}`;

  timerId = setInterval(() => {
    timeLeft--;

    if (timeLeft <= 30) {
      timerSpan.classList.add("timer-warning");
    }

    if (timeLeft < 0) {
      clearInterval(timerId);
      timerId = null;
      timeLeft = 0;
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

  if (!auth.currentUser) {
    alert("Please sign in before starting the quiz.");
    return;
  }

  const subject = categorySelect.value;
  let numQuestions = Number(numQuestionsInput.value) || 10;
  const timeMins = Number(timeMinsInput.value) || 10;
  const pool = getPoolForSubject(subject);

  currentMode = modeSelect.value; // "practice" or "exam"

  if (!pool || pool.length === 0) {
    alert("No questions available for this subject.");
    return;
  }

  if (numQuestions > pool.length) {
    numQuestions = pool.length;
  }

  const shuffled = shuffle(pool);
  quizQuestions = shuffled.slice(0, numQuestions);

  // Reset state
  currentIndex = 0;
  score = 0;
  answers = [];
  quizActive = true;

  // Lock controls while quiz is running
  setControlsEnabled(false);

  // Show quiz box, hide result box
  quizBox.style.display = "block";
  resultBox.style.display = "none";

  statusMessage.textContent = "";

  showQuestion();

  if (currentMode === "exam") {
    startTimer(timeMins * 60);
  } else {
    // Practice mode: no timer
    stopTimer();
    timerSpan.classList.remove("timer-warning");
    timerSpan.textContent = "Practice mode: no time limit";
  }
}

// ------------- Rendering questions -------------
let selectedOption = null;

function showQuestion() {
  const q = quizQuestions[currentIndex];
  if (!q) return;

  selectedOption = null;
  nextBtn.disabled = true; // require a choice before moving on

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
      nextBtn.disabled = false;
    };
    optionsDiv.appendChild(btn);
  });

  progressDiv.textContent = `Question ${currentIndex + 1} of ${quizQuestions.length}`;
}

// ------------- Handling answers -------------
nextBtn.onclick = () => {
  if (!quizActive) return;

  if (currentMode === "exam" && timerId === null && timeLeft <= 0) {
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
  quizActive = false;

  quizBox.style.display = "none";
  resultBox.style.display = "block";

  // Re-enable controls for a fresh quiz
  if (auth.currentUser) {
    setControlsEnabled(true);
  }

  if (timeUp) {
    scoreText.textContent = `Time's up! You scored ${score} out of ${quizQuestions.length}.`;
  } else {
    scoreText.textContent = `You scored ${score} out of ${quizQuestions.length}.`;
  }

  reviewList.innerHTML = "";

  // Stats per subject and topic
  const subjectTopicStats = {};   // { "Maths": { "fractions": {correct,total}, ... }, ... }
  const subjectCorrectCounts = {}; // { "Maths": 5, ... }
  const subjectTotalCounts = {};   // { "Maths": 7, ... }

  quizQuestions.forEach((q, index) => {
    const chosenIndex = answers[index];
    const userAnswerText =
      chosenIndex != null ? q.options[chosenIndex] : "(no answer)";
    const correctAnswerText = q.options[q.answerIndex];
    const isCorrect = chosenIndex === q.answerIndex;

    // Per-question review UI
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

    const subject = q.category || "Other";

    // Init subject stats if needed
    if (!subjectTopicStats[subject]) {
      subjectTopicStats[subject] = {};
      subjectCorrectCounts[subject] = 0;
      subjectTotalCounts[subject] = 0;
    }

    // Update subject totals
    subjectTotalCounts[subject]++;
    if (isCorrect) {
      subjectCorrectCounts[subject]++;
    }

    // Update topic stats (if topic exists)
    if (q.topic) {
      const topic = q.topic;
      if (!subjectTopicStats[subject][topic]) {
        subjectTopicStats[subject][topic] = { correct: 0, total: 0 };
      }
      subjectTopicStats[subject][topic].total++;
      if (isCorrect) {
        subjectTopicStats[subject][topic].correct++;
      }
    }
  });

  // Build summary HTML
  const summary = document.createElement("div");
  summary.className = "summary-block";

  let summaryHtml = `<h3>Summary by topic</h3>`;

  Object.keys(subjectTopicStats).forEach(subject => {
    const subjectCorrect = subjectCorrectCounts[subject] || 0;
    const subjectTotal = subjectTotalCounts[subject] || 0;
    const subjectPercentage =
      subjectTotal > 0 ? Math.round((subjectCorrect / subjectTotal) * 100) : 0;

    summaryHtml += `<h4>${subject} (${subjectPercentage}%)</h4>`;
    summaryHtml += `<ul class="summary-list">`;

    const topics = subjectTopicStats[subject];
    Object.keys(topics).forEach(topic => {
      const { correct, total } = topics[topic];
      const percent = total > 0 ? Math.round((correct / total) * 100) : 0;
      const label = TOPIC_LABELS[topic] || topic;
      summaryHtml += `<li><strong>${label}</strong>: ${correct}/${total} correct (${percent}%)</li>`;
    });

    summaryHtml += `</ul>`;
  });

  summary.innerHTML = summaryHtml;
  reviewList.appendChild(summary);
}

restartBtn.onclick = () => {
  setupQuiz();
};

// ------------- Auth handlers -------------
loginBtn.onclick = () => {
  authError.textContent = "";
  auth
    .signInWithEmailAndPassword(authEmail.value, authPassword.value)
    .catch(err => {
      authError.textContent = err.message;
    });
};

registerBtn.onclick = () => {
  authError.textContent = "";
  auth
    .createUserWithEmailAndPassword(authEmail.value, authPassword.value)
    .catch(err => {
      authError.textContent = err.message;
    });
};

logoutBtn.onclick = () => {
  auth.signOut();
};

// React to auth state changes
auth.onAuthStateChanged(user => {
  if (user) {
    authStatus.textContent = `Signed in as ${user.email}`;
    authError.textContent = "";
    logoutBtn.style.display = "inline-block";
    loginBtn.style.display = "inline-block"; // you can also hide login/register if you prefer
    registerBtn.style.display = "inline-block";

    // Show controls box
    controlsBox.style.display = "flex";

    // Enable controls only if questions are loaded
    if (questionsLoaded) {
      setControlsEnabled(true);
    } else {
      setControlsEnabled(false);
    }
  } else {
    authStatus.textContent = "Not signed in. Please sign in to start practising.";
    logoutBtn.style.display = "none";
    // You might want to keep login/register visible
    loginBtn.style.display = "inline-block";
    registerBtn.style.display = "inline-block";

    // Hide quiz UI
    controlsBox.style.display = "none";
    quizBox.style.display = "none";
    resultBox.style.display = "none";
    setControlsEnabled(false);
  }
});

// ------------- Initial load -------------
document.addEventListener("DOMContentLoaded", () => {
  loadAllQuestions();
});

startBtn.onclick = () => {
  setupQuiz();
};
