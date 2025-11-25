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

const quizBox = document.getElementById("quiz-box");
const questionText = document.getElementById("question-text");
const optionsDiv = document.getElementById("options");
const nextBtn = document.getElementById("next-btn");
const progressDiv = document.getElementById("progress");

const resultBox = document.getElementById("result-box");
const scoreText = document.getElementById("score-text");
const reviewList = document.getElementById("review-list");
const restartBtn = document.getElementById("restart-btn");


// Map internal topic codes → nice readable labels
const TOPIC_LABELS = {
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
      setControlsEnabled(true);
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

    // Optional: highlight timer when low
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

  // Shuffle and slice
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
  if (!quizActive) {
    return;
  }

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
  setControlsEnabled(true);

  if (timeUp) {
    scoreText.textContent = `Time's up! You scored ${score} out of ${quizQuestions.length}.`;
  } else {
    scoreText.textContent = `You scored ${score} out of ${quizQuestions.length}.`;
  }

  reviewList.innerHTML = "";

  // --- NEW: stats objects ---
  const categoryStats = {}; // { "Maths": {correct, total}, ... }
  const topicStats = {};    // { "Fractions": {correct, total}, ... } if q.topic exists
  const subjectCorrectCounts = {}; // track correct answers per subject
  const subjectTotalCounts = {};   // track total questions per subject

  quizQuestions.forEach((q, index) => {
    const chosenIndex = answers[index];
    const userAnswerText =
      chosenIndex != null ? q.options[chosenIndex] : "(no answer)";
    const correctAnswerText = q.options[q.answerIndex];
    const isCorrect = chosenIndex === q.answerIndex;

    // --- Build per-question review item (existing behaviour) ---
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

    // --- NEW: accumulate stats by category ---
    const cat = q.category || "Other";
    if (!categoryStats[cat]) {
      categoryStats[cat] = { correct: 0, total: 0 };
    }
    categoryStats[cat].total += 1;
    if (isCorrect) {
      categoryStats[cat].correct += 1;
    }

    // --- NEW: accumulate stats by topic (if present in JSON) ---
    if (q.topic) {
      const topic = q.topic;
      if (!topicStats[topic]) {
        topicStats[topic] = { correct: 0, total: 0 };
      }
      topicStats[topic].total += 1;
      if (isCorrect) {
        topicStats[topic].correct += 1;
      }
    }

    // --- NEW: accumulate stats by subject ---
    if (!subjectCorrectCounts[q.category]) {
      subjectCorrectCounts[q.category] = 0;
      subjectTotalCounts[q.category] = 0;
    }
    subjectTotalCounts[q.category]++;
    if (isCorrect) {
      subjectCorrectCounts[q.category]++;
    }
  });

  // --- NEW: Summary grouped by subject → topic ---
  const summary = document.createElement("div");
  summary.className = "summary-block";

  // Build nested stats: subject → topic
  const subjectTopicStats = {};

  quizQuestions.forEach((q, index) => {
    const chosenIndex = answers[index];
    const isCorrect = chosenIndex === q.answerIndex;

    // Initialise subject if missing
    if (!subjectTopicStats[q.category]) {
      subjectTopicStats[q.category] = {};
    }

    // Skip if no topic found
    if (!q.topic) return;

    // Initialise topic if missing
    if (!subjectTopicStats[q.category][q.topic]) {
      subjectTopicStats[q.category][q.topic] = { correct: 0, total: 0 };
    }

    // Update stats for topics
    subjectTopicStats[q.category][q.topic].total++;
    if (isCorrect) {
      subjectTopicStats[q.category][q.topic].correct++;
    }

    // Update subject stats
    subjectTotalCounts[q.category]++;
    if (isCorrect) {
      subjectCorrectCounts[q.category]++;
    }
  });

  // Build the HTML for the summary
  let summaryHtml = `<h3>Summary by topic</h3>`;

  Object.keys(subjectTopicStats).forEach(subject => {
    // Calculate subject percentage
    const subjectCorrect = subjectCorrectCounts[subject];
    const subjectTotal = subjectTotalCounts[subject];
    const subjectPercentage = Math.round((subjectCorrect / subjectTotal) * 100);

    // Display subject with percentage
    summaryHtml += `<h4>${subject} (${subjectPercentage}%)</h4>`;
    summaryHtml += `<ul class="summary-list">`;

    const topics = subjectTopicStats[subject];
    Object.keys(topics).forEach(topic => {
      const { correct, total } = topics[topic];
      const percent = Math.round((correct / total) * 100);
      const label = TOPIC_LABELS[topic] || topic; // use nice label for topic names
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

// ------------- Initial load -------------
document.addEventListener("DOMContentLoaded", () => {
  loadAllQuestions();
});

startBtn.onclick = () => {
  setupQuiz();
};
