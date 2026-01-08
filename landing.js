//landing.js
const container  = document.getElementById("cards");
const resetBtn   = document.getElementById("reset");
const unlearnBtn = document.getElementById("unlearnedBtn");
const randomBtn  = document.getElementById("randomBtn");
const pageButtonsContainer = document.getElementById("pageButtons");

let currentPage   = 1;
let showUnlearned = false;
let showRandom    = false;
const totalPages =20;

const getLS = (key) => JSON.parse(localStorage.getItem(key) || "[]");
const setLS = (key, val) => localStorage.setItem(key, JSON.stringify(val));

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// ✅ SESLENDİRME (EKLENDİ)
function speak(text) {
  if (!text) return;
  if (!("speechSynthesis" in window)) return;

  window.speechSynthesis.cancel();

  const u = new SpeechSynthesisUtterance(text);
  u.lang = "de-DE";   // Almanca
  u.rate = 0.95;
  window.speechSynthesis.speak(u);
}

function fetchPages(pages) {
  return Promise.all(
    pages.map((p) =>
      fetch(`data/page${p}.json`).then((r) =>
        r.json().then((data) => data.map((item) => ({ ...item, page: p })))
      )
    )
  ).then((arrs) => arrs.flat());
}

const pageButtons = [];
for (let i = 1; i <= totalPages; i++) {
  const btn = document.createElement("button");
  btn.textContent = `Sayfa ${i}`;
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
    btn.style.textDecoration = "none";
    btn.classList.remove("completed");

    fetchPages([page]).then((words) => {
      const visibleWords = words.filter((w) => {
        const key = `${w.page}_${w.de}`;
        return !hidden.includes(key) && !unlearn.includes(key);
      });

      if (visibleWords.length === 0) {
        btn.style.textDecoration = "line-through";
        btn.classList.add("completed");
      }
    });
  });
}

function makeCard({ de, tr, oku, page }) {
  const key = `${page}_${de}`;

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

  front.textContent = de;
  back.innerHTML = `${tr}<br><span style="font-size:14px;color:#555">(${oku})</span>`;
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

  // ✅ KARTA TIKLAYINCA OKU + FLIP (DEĞİŞTİ)
  card.onclick = () => {
    speak(de);
    card.classList.toggle("flipped");
  };

  inner.append(front, back);
  card.append(xBtn, tick, inner);
  return card;
}

function renderWords() {
  container.innerHTML = "";
  const hidden = getLS("hiddenWords");
  const unlearn = getLS("unlearnedWords");
  const pagesToFetch = showUnlearned ? pageButtons.map((p) => p.page) : [currentPage];

  fetchPages(pagesToFetch).then((words) => {
    shuffle(words);

    words.forEach((w) => {
      const key = `${w.page}_${w.de}`;
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
  container.innerHTML = "";

  const hidden = getLS("hiddenWords");
  const unlearn = getLS("unlearnedWords");

  const allPages = pageButtons.map((p) => p.page);
  fetchPages(allPages).then((words) => {
    let pool = words.filter((w) => {
      const key = `${w.page}_${w.de}`;
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
  pageButtons.forEach(({ btn }) => {
    btn.style.textDecoration = "none";
    btn.classList.remove("completed");
  });
  renderWords();
};

unlearnBtn.onclick = () => {
  showUnlearned = true;
  showRandom = false;
  renderWords();
};

randomBtn.onclick = () => {
  showUnlearned = false;
  renderRandom();
};

renderWords();
