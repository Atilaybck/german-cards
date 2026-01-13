// landing.js
const container = document.getElementById("cards");
const resetBtn = document.getElementById("reset");
const unlearnBtn = document.getElementById("unlearnedBtn");
const randomBtn = document.getElementById("randomBtn");
const pageButtonsContainer = document.getElementById("pageButtons");

let currentPage = 1;
let showUnlearned = false;
let showRandom = false;
const totalPages = 23;

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
 * ✅ KRİTİK FIX:
 * Bazı page*.json yoksa fetch fail olur -> Promise.all patlar -> hiç kart basılmaz.
 * Artık her sayfa ayrı try/catch: yoksa [] döner, sistem çalışır.
 */
function fetchPages(pages) {
  return Promise.all(
    pages.map((p) =>
      fetch(`data/page${p}.json`)
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
    renderWords();
  };
  pageButtons.push({ page: i, btn });
  pageButtonsContainer.appendChild(btn);
}

function updateStrike() {
  if (showUnlearned || showRandom) return;

  const hidden = getLS("hiddenWords");
  const unlearn = getLS("unlearnedWords");

  pageButtons.forEach(({ page, btn }) => {
    btn.classList.remove("completed");

    fetchPages([page]).then((words) => {
      const visibleWords = words.filter((w) => {
        const key = keyOf(w.page, w.de);
        return !hidden.includes(key) && !unlearn.includes(key);
      });

      if (visibleWords.length === 0) {
        btn.classList.add("completed");
      }
    });
  });
}

function makeCard({ de, tr, oku, page }) {
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

  tick.onclick = (e) => {
    e.stopPropagation();
    const hidden = getLS("hiddenWords");
    const unlearn = getLS("unlearnedWords");

    if (!hidden.includes(key)) {
      hidden.push(key);
      setLS("hiddenWords", hidden);
    }

    const idx = unlearn.indexOf(key);
    if (idx !== -1) {
      unlearn.splice(idx, 1);
      setLS("unlearnedWords", unlearn);
    }

    if (showRandom) renderRandom();
    else {
      card.remove();
      updateStrike();
    }
  };

  xBtn.onclick = (e) => {
    e.stopPropagation();
    const unlearn = getLS("unlearnedWords");

    if (!unlearn.includes(key)) {
      unlearn.push(key);
      setLS("unlearnedWords", unlearn);
    }

    if (showRandom) renderRandom();
    else {
      card.remove();
      updateStrike();
    }
  };

  card.onclick = () => {
    speak(norm(de));
    card.classList.toggle("flipped");
  };

  inner.append(front, back);
  card.append(xBtn, tick, inner);
  return card;
}

function renderWords() {
  container.classList.remove("random-mode");
  container.innerHTML = "";

  const hidden = getLS("hiddenWords");
  const unlearn = getLS("unlearnedWords");

  const pagesToFetch = showUnlearned
    ? pageButtons.map((p) => p.page)
    : [currentPage];

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
      btn.classList.toggle("active", !showUnlearned && !showRandom && page === currentPage)
    );
    unlearnBtn.classList.toggle("active", showUnlearned);
    randomBtn.classList.toggle("active", showRandom);
  });
}

function renderRandom() {
  showRandom = true;
  showUnlearned = false;

  container.innerHTML = "";
  container.classList.add("random-mode");

  const hidden = getLS("hiddenWords");
  const unlearn = getLS("unlearnedWords");

  const allPages = pageButtons.map((p) => p.page);
  fetchPages(allPages).then((words) => {
    let pool = words.filter((w) => {
      const key = keyOf(w.page, w.de);
      return !hidden.includes(key) && !unlearn.includes(key);
    });
    if (pool.length === 0) pool = words;

    const w = pool[Math.floor(Math.random() * pool.length)];
    if (!w) {
      container.innerHTML = "<p style='text-align:center;opacity:.7'>Kelime bulunamadı.</p>";
      return;
    }

    container.append(makeCard(w));

    pageButtons.forEach(({ btn }) => btn.classList.toggle("active", false));
    unlearnBtn.classList.toggle("active", false);
    randomBtn.classList.toggle("active", true);
  });
}

resetBtn.onclick = () => {
  localStorage.removeItem("hiddenWords");
  localStorage.removeItem("unlearnedWords");
  showUnlearned = false;
  showRandom = false;
  pageButtons.forEach(({ btn }) => btn.classList.remove("completed"));
  renderWords();
};

unlearnBtn.onclick = () => {
  showUnlearned = !showUnlearned; // toggle
  showRandom = false;
  renderWords();
};

randomBtn.onclick = () => {
  renderRandom();
};

renderWords();
