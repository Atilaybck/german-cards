// quiz.js

let quizQuestions = [];
let quizOrder = []; // shuffle edilmiş sabit sıra
let quizIndex = 0; // o anki soru index
let quizTop = null;
let quizLocked = false;

let quizTotalCount = 0;

// her soru için seçimi sakla (index -> { picked, correct })
const quizState = {};

/* =========================
   ✅ Quiz mod: Dosya seçimi UI
========================= */
const quizControls = document.getElementById("quizControls");
const quizFilesBtn = document.getElementById("quizFilesBtn");
const quizFilesPopover = document.getElementById("quizFilesPopover");
const quizFilesList = document.getElementById("quizFilesList");
const applyQuizFilesBtn = document.getElementById("applyQuizFiles");

const QUIZ_FILES_KEY = "quizSelectedFiles";

// mevcut questions dosyaları (buraya yenilerini ekleyebilirsin)
const QUIZ_FILES = [
  { id: "questions6", label: "6", path: "data/questions/questions6.json" },
  { id: "questions7", label: "7", path: "data/questions/questions7.json" },
];

function getSelectedQuizFiles() {
  const arr = JSON.parse(localStorage.getItem(QUIZ_FILES_KEY) || "[]");
  const selected = Array.isArray(arr) ? arr : [];

  const allowed = new Set(QUIZ_FILES.map((f) => f.id));
  const cleaned = selected.filter((id) => allowed.has(id));

  return cleaned;
}
function setSelectedQuizFiles(ids) {
  localStorage.setItem(QUIZ_FILES_KEY, JSON.stringify(ids || []));
}

function buildQuizFilesUI() {
  if (!quizFilesList) return;
  quizFilesList.innerHTML = "";

  const selected = new Set(getSelectedQuizFiles());

  QUIZ_FILES.forEach((f) => {
    const row = document.createElement("label");
    row.className = "page-row";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = f.id;
    cb.checked = selected.has(f.id);

    const txt = document.createElement("span");
    txt.textContent = `questions${f.label}.json`;

    row.append(cb, txt);
    quizFilesList.appendChild(row);
  });
}

function openQuizFilesPopover() {
  if (!quizFilesPopover) return;
  buildQuizFilesUI();
  quizFilesPopover.hidden = false;
}
function closeQuizFilesPopover() {
  if (!quizFilesPopover) return;
  quizFilesPopover.hidden = true;
}

/* =========================
   Core helpers
========================= */
function shuffleLocal(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function loadQuestions() {
  const selected = getSelectedQuizFiles();

  // hiç seçilmediyse boş döndür
  if (!selected.length) return Promise.resolve([]);

  const paths = selected
    .map((id) => QUIZ_FILES.find((f) => f.id === id))
    .filter(Boolean)
    .map((f) => f.path);

  return Promise.all(
    paths.map((p) => fetch(p).then((r) => (r.ok ? r.json() : [])))
  )
    .then((lists) => lists.flat())
    .catch(() => []);
}

function answeredCount() {
  return Object.keys(quizState).length;
}

function goNext() {
  if (!quizLocked) return; // ✅ sadece cevapladıysan
  if (quizIndex < quizTotalCount - 1) {
    quizIndex++;
    quizTop = quizOrder[quizIndex] || null;
    quizLocked = !!quizState[quizIndex]; // daha önce görüldüyse kilitli gelsin
    renderQuizCard();
  } else {
    quizTop = null;
    renderQuizCard();
  }
}

function goPrev() {
  if (!quizLocked) return; // ✅ sadece cevapladıysan
  if (quizIndex > 0) {
    quizIndex--;
    quizTop = quizOrder[quizIndex] || null;
    quizLocked = !!quizState[quizIndex]; // önceki soru zaten cevaplı ise kilitli
    renderQuizCard();
  }
}

// mobil swipe
function attachSwipe(el) {
  let sx = 0;
  let sy = 0;
  let tracking = false;

  const TH = 50; // px
  const VLOCK = 80; // dikey scroll güvenliği

  el.addEventListener(
    "touchstart",
    (e) => {
      if (!e.touches || !e.touches[0]) return;
      tracking = true;
      sx = e.touches[0].clientX;
      sy = e.touches[0].clientY;
    },
    { passive: true }
  );

  el.addEventListener(
    "touchend",
    (e) => {
      if (!tracking) return;
      tracking = false;

      const t = (e.changedTouches && e.changedTouches[0]) || null;
      if (!t) return;

      const dx = t.clientX - sx;
      const dy = t.clientY - sy;

      // dikey hareket fazlaysa swipe sayma
      if (Math.abs(dy) > VLOCK) return;

      if (dx <= -TH) {
        // sola swipe => geri
        goPrev();
      } else if (dx >= TH) {
        // sağa swipe => ileri
        goNext();
      }
    },
    { passive: true }
  );
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

  // quiz dosya seçimi UI göster
  if (quizControls) quizControls.hidden = false;
  if (quizFilesPopover) quizFilesPopover.hidden = true;

  if (!quizTop) {
    container.innerHTML = `
      <div class='quiz-finished'>
        <h2>🎉 Tebrikler!</h2>
        <p>Tüm soruları başarıyla tamamladın.</p>
        <button class="action-btn" onclick="renderQuiz()">Yeniden Başla</button>
      </div>`;
    return;
  }

  const wrap = document.createElement("div");
  wrap.className = "quiz-card";

  // swipe dinle (mobil)
  attachSwipe(wrap);

  // Progress Bar (cevaplanan sayısına göre)
  const progressContainer = document.createElement("div");
  progressContainer.className = "quiz-progress-container";
  const progressBar = document.createElement("div");
  progressBar.className = "quiz-progress-bar";
  const percent = quizTotalCount ? (answeredCount() / quizTotalCount) * 100 : 0;
  progressBar.style.width = `${percent}%`;
  progressContainer.appendChild(progressBar);

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

      // state kaydet
      quizState[quizIndex] = { picked, correct };

      // doğruyu yeşil yap
      Array.from(opts.querySelectorAll(".quiz-opt")).forEach((b) => {
        if (String(b.textContent).trim() === correct) b.classList.add("correct");
      });

      // yanlışsa seçtiğini kırmızı yap
      if (picked !== correct) btn.classList.add("wrong");
    };

    opts.appendChild(btn);
  });

  // ✅ daha önce bu soruya dönüldüyse: aynı işaretlemeleri geri bas
  const saved = quizState[quizIndex];
  if (saved) {
    quizLocked = true;
    Array.from(opts.querySelectorAll(".quiz-opt")).forEach((b) => {
      const txt = String(b.textContent).trim();
      if (txt === saved.correct) b.classList.add("correct");
      if (txt === saved.picked && saved.picked !== saved.correct)
        b.classList.add("wrong");
    });
  } else {
    quizLocked = false;
  }

  const footer = document.createElement("div");
  footer.className = "quiz-footer";

  const meta = document.createElement("div");
  meta.className = "quiz-meta";
  meta.textContent = `Soru: ${quizIndex + 1} / ${quizTotalCount}`;

  const next = document.createElement("button");
  next.className = "quiz-next";
  next.textContent = "Sonraki →";
  next.onclick = goNext;

  footer.append(meta, next);

  wrap.append(progressContainer, q, opts, footer);
  container.appendChild(wrap);
}

function renderQuiz() {
  showQuiz = true;
  showRandom = false;
  showUnlearned = false;

  // ✅ Hemen temizle (Landing'deki kelimeler kalmasın)
  container.innerHTML = "";

  // ✅ FIX: Random UI kapat (Rastgele → Sorular geçişinde 2 Dosyalar bug fix)
  const randomControlsEl = document.getElementById("randomControls");
  const randomPopoverEl = document.getElementById("randomPagesPopover");
  if (randomControlsEl) randomControlsEl.hidden = true;
  if (randomPopoverEl) randomPopoverEl.hidden = true;

  if (paginationSection) paginationSection.style.display = "none";

  pageButtons.forEach(({ btn }) => btn.classList.toggle("active", false));
  unlearnBtn.classList.toggle("active", false);
  randomBtn.classList.toggle("active", false);
  quizBtn.classList.toggle("active", true);

  // quiz dosya seçimi UI
  if (quizControls) {
    quizControls.hidden = false;
    const existingHint = quizControls.querySelector("#quizHint");
    if (existingHint) existingHint.remove();
  }
  if (quizFilesPopover) quizFilesPopover.hidden = true;

  loadQuestions().then((qs) => {
    quizQuestions = Array.isArray(qs) ? qs : [];
    quizTotalCount = quizQuestions.length;

    if (!quizTotalCount) {
      if (!quizControls.querySelector("#quizHint")) {
        quizControls.insertAdjacentHTML('afterbegin',
          "<p id='quizHint' style='text-align:center;font-weight:700;opacity:.85;margin-bottom:10px'>Dosya seç (Dosyalar butonundan).</p>");
      }
      return;
    }

    quizOrder = quizQuestions.slice();
    shuffleLocal(quizOrder);

    quizIndex = 0;
    quizTop = quizOrder[quizIndex] || null;
    quizLocked = false;

    for (const k in quizState) delete quizState[k];

    renderQuizCard();
  });
}

/* =========================
   ✅ Quiz mod: buton eventleri
========================= */
if (quizFilesBtn && quizFilesPopover && quizFilesList && applyQuizFilesBtn) {
  quizFilesBtn.onclick = (e) => {
    e.stopPropagation();
    if (quizFilesPopover.hidden) openQuizFilesPopover();
    else closeQuizFilesPopover();
  };

  applyQuizFilesBtn.onclick = (e) => {
    e.stopPropagation();

    const checked = Array.from(
      quizFilesList.querySelectorAll("input[type='checkbox']:checked")
    ).map((el) => el.value);

    setSelectedQuizFiles(checked);

    closeQuizFilesPopover();
    if (showQuiz) renderQuiz();
  };

  document.addEventListener("click", (e) => {
    if (!showQuiz) return;
    if (quizFilesPopover.hidden) return;

    const inside =
      quizFilesPopover.contains(e.target) || quizFilesBtn.contains(e.target);
    if (!inside) closeQuizFilesPopover();
  });
}

// global
window.renderQuiz = renderQuiz;
