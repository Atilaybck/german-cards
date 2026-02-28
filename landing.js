// landing.js
const container = document.getElementById("cards");
const resetBtn = document.getElementById("reset");
const unlearnBtn = document.getElementById("unlearnedBtn");
const randomBtn = document.getElementById("randomBtn");
const quizBtn = document.getElementById("quizBtn");
const pageButtonsContainer = document.getElementById("pageButtons");
const paginationSection = document.getElementById("paginationSection");

let currentPage = 1;
let showUnlearned = false;
let showRandom = false;
let showQuiz = false;
const totalPages = 40;

const getLS = (key) => JSON.parse(localStorage.getItem(key) || "[]");
const setLS = (key, val) => localStorage.setItem(key, JSON.stringify(val));

const norm = (s = "") => String(s).trim().replace(/\s+/g, " ");
const keyOf = (page, de) => `${page}_${norm(de)}`;

// ✅ Eski key’leri (varsa) yeniye taşı
(function migrateLS() {
  const legacyKeys = ["unlearned", "unlearnedWord", "unlearnWords"];
  const targetKey = "unlearnedWords";
  const target = getLS(targetKey);

  legacyKeys.forEach((k) => {
    const legacy = JSON.parse(localStorage.getItem(k) || "[]");
    if (Array.isArray(legacy) && legacy.length) {
      legacy.forEach((item) => {
        if (!target.includes(item)) target.push(item);
      });
      localStorage.removeItem(k);
    }
  });

  setLS(targetKey, target);
})();

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// ✅ SESLENDİRME
function speak(text) {
  if (!text) return;
  if (!("speechSynthesis" in window)) return;

  window.speechSynthesis.cancel();

  const u = new SpeechSynthesisUtterance(text);
  u.lang = "de-DE";
  u.rate = 0.95;
  window.speechSynthesis.speak(u);
}

/**
 * ✅ page*.json yoksa patlamasın
 */
function fetchPages(pages) {
  return Promise.all(
    pages.map((p) =>
      fetch(`data/page/page${p}.json`)
        .then((r) => (r.ok ? r.json() : []))
        .then((data) =>
          Array.isArray(data) ? data.map((item) => ({ ...item, page: p })) : []
        )
        .catch(() => [])
    )
  ).then((arrs) => arrs.flat());
}

const pageButtons = [];
for (let i = 1; i <= totalPages; i++) {
  const btn = document.createElement("button");
  btn.textContent = `${i}`;
  btn.className = "pageBtn";
  btn.onclick = () => {
    currentPage = i;
    showUnlearned = false;
    showRandom = false;
    showQuiz = false;
    renderWords();
  };
  pageButtons.push({ page: i, btn });
  pageButtonsContainer.appendChild(btn);
}

/**
 * ✅ Fix: page dosyası yok/bozuk/boşsa completed yapma
 */
function updateStrike() {
  if (showUnlearned || showRandom || showQuiz) return;

  const hidden = getLS("hiddenWords");
  const unlearn = getLS("unlearnedWords");

  pageButtons.forEach(({ page, btn }) => {
    btn.classList.remove("completed");

    fetch(`data/page/page${page}.json`)
      .then((r) => {
        if (!r.ok) return null;
        return r.json();
      })
      .then((data) => {
        if (!Array.isArray(data) || data.length === 0) return;

        const visible = data
          .map((item) => ({ ...item, page }))
          .filter((w) => {
            const key = keyOf(w.page, w.de);
            return !hidden.includes(key) && !unlearn.includes(key);
          });

        if (visible.length === 0) btn.classList.add("completed");
      })
      .catch(() => { });
  });
}

/** ✅ Kartı ezberlendi/ezberlenmemiş olarak işaretle */
function markLearned(key) {
  const hidden = getLS("hiddenWords");
  const unlearn = getLS("unlearnedWords");

  if (!hidden.includes(key)) hidden.push(key);
  setLS("hiddenWords", hidden);

  const idx = unlearn.indexOf(key);
  if (idx !== -1) {
    unlearn.splice(idx, 1);
    setLS("unlearnedWords", unlearn);
  }
}
function markUnlearned(key) {
  const unlearn = getLS("unlearnedWords");
  if (!unlearn.includes(key)) {
    unlearn.push(key);
    setLS("unlearnedWords", unlearn);
  }
}

function addProgressBadge(card, text) {
  if (!text) return;

  const badge = document.createElement("div");
  badge.className = "progress-badge";
  badge.textContent = text;

  badge.style.position = "absolute";
  badge.style.top = "-12px";
  badge.style.left = "50%";
  badge.style.transform = "translateX(-50%)";
  badge.style.padding = "6px 10px";
  badge.style.borderRadius = "999px";
  badge.style.fontSize = "12px";
  badge.style.fontWeight = "800";
  badge.style.background = "rgba(15,23,42,0.92)";
  badge.style.color = "#e2e8f0";
  badge.style.border = "1px solid rgba(255,255,255,0.12)";
  badge.style.boxShadow = "0 10px 15px -3px rgb(0 0 0 / 0.2)";
  badge.style.zIndex = "20";

  card.appendChild(badge);
}

function makeCard({ de, tr, oku, page }, opts = {}) {
  const key = keyOf(page, de);

  const card = document.createElement("div");
  const inner = document.createElement("div");
  const front = document.createElement("div");
  const back = document.createElement("div");
  const tick = document.createElement("button");
  const xBtn = document.createElement("button");

  card.className = "card";
  inner.className = "inner";
  front.className = "side front";
  back.className = "side back";
  tick.className = "tick";
  xBtn.className = "unlearn";

  front.textContent = norm(de);
  back.innerHTML = `${tr}<br><span>(${oku})</span>`;
  tick.textContent = "✔";
  xBtn.textContent = "✘";

  if (opts.progressText) addProgressBadge(card, opts.progressText);

  tick.onclick = (e) => {
    e.stopPropagation();
    markLearned(key);

    if (showRandom) {
      if (typeof bumpRandomSeen === "function")
        bumpRandomSeen(opts.selectedPages || []);
      if (typeof advanceRandomDeck === "function") advanceRandomDeck();
    } else {
      card.remove();
      updateStrike();
    }
  };

  xBtn.onclick = (e) => {
    e.stopPropagation();
    markUnlearned(key);

    if (showRandom) {
      if (typeof bumpRandomSeen === "function")
        bumpRandomSeen(opts.selectedPages || []);
      if (typeof advanceRandomDeck === "function") advanceRandomDeck();
    } else {
      card.remove();
      updateStrike();
    }
  };

  card.onclick = () => {
    speak(norm(de));
    card.classList.toggle("flipped");
  };

  // ✅ Random modda swipe
  if (typeof attachSwipeHandlers === "function") {
    attachSwipeHandlers(card, key, opts.selectedPages || []);
  }

  inner.append(front, back);
  card.append(xBtn, tick, inner);
  return card;
}

function renderWords() {
  if (paginationSection) paginationSection.style.display = "";

  // random elements handling
  const randomControls = document.getElementById("randomControls");
  const randomPagesPopover = document.getElementById("randomPagesPopover");
  if (randomControls) randomControls.hidden = true;
  if (randomPagesPopover) randomPagesPopover.hidden = true;

  // quiz elements handling
  const quizControls = document.getElementById("quizControls");
  const quizFilesPopover = document.getElementById("quizFilesPopover");
  if (quizControls) quizControls.hidden = true;
  if (quizFilesPopover) quizFilesPopover.hidden = true;

  container.classList.remove("random-mode");
  container.classList.remove("quiz-mode");
  container.classList.remove("swiping-stack");
  container.innerHTML = "";

  const hidden = getLS("hiddenWords");
  const unlearn = getLS("unlearnedWords");

  const pagesToFetch = showUnlearned ? pageButtons.map((p) => p.page) : [currentPage];

  fetchPages(pagesToFetch).then((words) => {
    shuffle(words);

    words.forEach((w) => {
      const key = keyOf(w.page, w.de);

      if (!showUnlearned && (hidden.includes(key) || unlearn.includes(key))) return;
      if (showUnlearned && !unlearn.includes(key)) return;

      container.append(makeCard(w));
    });

    updateStrike();

    pageButtons.forEach(({ btn, page }) =>
      btn.classList.toggle(
        "active",
        !showUnlearned && !showRandom && !showQuiz && page === currentPage
      )
    );
    unlearnBtn.classList.toggle("active", showUnlearned);
    randomBtn.classList.toggle("active", showRandom);
    if (quizBtn) quizBtn.classList.toggle("active", showQuiz);
  });
}

resetBtn.onclick = () => {
  localStorage.removeItem("hiddenWords");
  localStorage.removeItem("unlearnedWords");
  localStorage.removeItem("randomSelectedPages");
  if (typeof clearRandomProgress === "function") clearRandomProgress();

  // quiz storage (varsa)
  localStorage.removeItem("quizSelectedFiles");

  showUnlearned = false;
  showRandom = false;
  showQuiz = false;

  if (typeof window.resetRandomDeck === "function") window.resetRandomDeck();
  if (typeof window.resetQuizDeck === "function") window.resetQuizDeck();

  pageButtons.forEach(({ btn }) => btn.classList.remove("completed"));
  renderWords();
};

unlearnBtn.onclick = () => {
  showUnlearned = !showUnlearned;
  showRandom = false;
  showQuiz = false;
  renderWords();
};

randomBtn.onclick = () => {
  showRandom = true;
  showUnlearned = false;
  showQuiz = false;
  if (typeof renderRandom === "function") renderRandom();
};

if (quizBtn) {
  quizBtn.onclick = () => {
    showQuiz = true;
    showRandom = false;
    showUnlearned = false;
    if (typeof renderQuiz === "function") renderQuiz();
  };
}

renderWords();

// Expose shared utilities and state to global scope
window.getLS = getLS;
window.setLS = setLS;
window.norm = norm;
window.keyOf = keyOf;
window.shuffle = shuffle;
window.speak = speak;
window.fetchPages = fetchPages;
window.markLearned = markLearned;
window.markUnlearned = markUnlearned;
window.makeCard = makeCard;
window.renderWords = renderWords;
window.totalPages = totalPages;
window.pageButtons = pageButtons;
window.container = container;
window.paginationSection = paginationSection;
window.unlearnBtn = unlearnBtn;
window.randomBtn = randomBtn;
window.quizBtn = quizBtn;

Object.defineProperty(window, "showRandom", {
  get: () => showRandom,
  set: (v) => (showRandom = v),
});
Object.defineProperty(window, "showUnlearned", {
  get: () => showUnlearned,
  set: (v) => (showUnlearned = v),
});
Object.defineProperty(window, "currentPage", {
  get: () => currentPage,
  set: (v) => (currentPage = v),
});
Object.defineProperty(window, "showQuiz", {
  get: () => showQuiz,
  set: (v) => (showQuiz = v),
});
