// quiz.js

let quizQuestions = [];
let quizPool = [];
let quizTop = null;
let quizLocked = false;

function shuffleLocal(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function loadQuestions() {
  return fetch("data/questions/questions.json")
    .then((r) => (r.ok ? r.json() : []))
    .then((data) => (Array.isArray(data) ? data : []))
    .catch(() => []);
}

function ensureQuizPool() {
  if (!quizPool.length) {
    quizPool = quizQuestions.slice();
    shuffleLocal(quizPool);
  }
  quizTop = quizPool.shift() || null;
  quizLocked = false;
}

function renderQuizCard() {
  container.innerHTML = "";
  container.classList.add("quiz-mode");
  container.classList.remove("random-mode");
  container.classList.remove("swiping-stack");

  // random UI kapat
  const randomControlsEl = document.getElementById("randomControls");
  const randomPopoverEl = document.getElementById("randomPagesPopover");
  if (randomControlsEl) randomControlsEl.hidden = true;
  if (randomPopoverEl) randomPopoverEl.hidden = true;

  if (!quizTop) {
    container.innerHTML =
      "<div class='quiz-finished'>🎉 Tebrikler! Tüm soruları tamamladın.</div>";
    return;
  }

  const wrap = document.createElement("div");
  wrap.className = "quiz-card";

  const q = document.createElement("div");
  q.className = "quiz-q";
  q.textContent = quizTop.q || "Soru";

  const opts = document.createElement("div");
  opts.className = "quiz-options";

  const correct = String(quizTop.answer || "").trim();

  (quizTop.options || []).forEach((optText) => {
    const btn = document.createElement("button");
    btn.className = "quiz-opt";
    btn.type = "button";
    btn.textContent = optText;

    btn.onclick = () => {
      if (quizLocked) return;
      quizLocked = true;

      const picked = String(optText).trim();

      // doğruyu yeşil yap
      Array.from(opts.querySelectorAll(".quiz-opt")).forEach((b) => {
        if (String(b.textContent).trim() === correct) b.classList.add("correct");
      });

      // yanlışsa seçtiğini kırmızı yap
      if (picked !== correct) btn.classList.add("wrong");
    };

    opts.appendChild(btn);
  });

  const footer = document.createElement("div");
  footer.className = "quiz-footer";

  const meta = document.createElement("div");
  meta.className = "quiz-meta";
  meta.textContent = `Kalan: ${quizPool.length + 1}`;

  const next = document.createElement("button");
  next.className = "quiz-next";
  next.textContent = "Sonraki →";
  next.onclick = () => {
    ensureQuizPool();
    renderQuizCard();
  };

  footer.append(meta, next);

  wrap.append(q, opts, footer);
  container.appendChild(wrap);
}

function renderQuiz() {
  showQuiz = true;
  showRandom = false;
  showUnlearned = false;

  if (paginationSection) paginationSection.style.display = "none";

  pageButtons.forEach(({ btn }) => btn.classList.toggle("active", false));
  unlearnBtn.classList.toggle("active", false);
  randomBtn.classList.toggle("active", false);
  quizBtn.classList.toggle("active", true);

  loadQuestions().then((qs) => {
    quizQuestions = qs;
    quizPool = [];
    ensureQuizPool();
    renderQuizCard();
  });
}

// global
window.renderQuiz = renderQuiz;
