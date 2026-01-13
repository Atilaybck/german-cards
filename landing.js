// landing.js
const container = document.getElementById("cards");
const resetBtn = document.getElementById("reset");
const unlearnBtn = document.getElementById("unlearnedBtn");
const randomBtn = document.getElementById("randomBtn");
const pageButtonsContainer = document.getElementById("pageButtons");
const paginationSection = document.getElementById("paginationSection");

// ✅ Random mod UI
const randomControls = document.getElementById("randomControls");
const randomPagesBtn = document.getElementById("randomPagesBtn");
const randomPagesPopover = document.getElementById("randomPagesPopover");
const randomPagesList = document.getElementById("randomPagesList");
const applyRandomPagesBtn = document.getElementById("applyRandomPages");

let currentPage = 1;
let showUnlearned = false;
let showRandom = false;
const totalPages = 23;

const getLS = (key) => JSON.parse(localStorage.getItem(key) || "[]");
const setLS = (key, val) => localStorage.setItem(key, JSON.stringify(val));

const norm = (s = "") => String(s).trim().replace(/\s+/g, " ");
const keyOf = (page, de) => `${page}_${norm(de)}`;

// ✅ Rastgele modda seçilen sayfalar
const RANDOM_PAGES_KEY = "randomSelectedPages";

// ✅ ARTIK: hiç seçilmemişse default = BOŞ ([])
function getSelectedRandomPages() {
  const arr = getLS(RANDOM_PAGES_KEY);
  return (Array.isArray(arr) ? arr : [])
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= totalPages);
}

function setSelectedRandomPages(pages) {
  setLS(RANDOM_PAGES_KEY, pages);
}

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
      fetch(`data/page${p}.json`)
        .then((r) => (r.ok ? r.json() : []))
        .then((data) =>
          Array.isArray(data) ? data.map((item) => ({ ...item, page: p })) : []
        )
        .catch(() => [])
    )
  ).then((arrs) => arrs.flat());
}

// ✅ Random sayfa seçim UI (popover)
function buildRandomPagesUI() {
  if (!randomPagesList) return;
  randomPagesList.innerHTML = "";

  const selected = new Set(
    Array.isArray(getLS(RANDOM_PAGES_KEY)) ? getLS(RANDOM_PAGES_KEY).map(Number) : []
  );

  for (let i = 1; i <= totalPages; i++) {
    const row = document.createElement("label");
    row.className = "page-row";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = String(i);

    // ✅ Varsayılan olarak TİKSİZ (seçili varsa onu göster)
    cb.checked = selected.has(i);

    const txt = document.createElement("span");
    txt.textContent = `${i}`;

    row.append(cb, txt);
    randomPagesList.appendChild(row);
  }
}

function openRandomPagesPopover() {
  if (!randomPagesPopover) return;
  buildRandomPagesUI();
  randomPagesPopover.hidden = false;
}

function closeRandomPagesPopover() {
  if (!randomPagesPopover) return;
  randomPagesPopover.hidden = true;
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

/**
 * ✅ Fix: page dosyası yok/bozuk/boşsa completed yapma
 */
function updateStrike() {
  if (showUnlearned || showRandom) return;

  const hidden = getLS("hiddenWords");
  const unlearn = getLS("unlearnedWords");

  pageButtons.forEach(({ page, btn }) => {
    btn.classList.remove("completed");

    fetch(`data/page${page}.json`)
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
      .catch(() => {});
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

/** ✅ Random modda swipe davranışı */
function attachSwipeHandlers(card, key) {
  let startX = 0;
  let startY = 0;
  let dx = 0;
  let dy = 0;
  let dragging = false;

  const THRESHOLD = 80; // px

  function onStart(e) {
    if (!showRandom) return;

    const t = e.touches ? e.touches[0] : e;
    startX = t.clientX;
    startY = t.clientY;
    dx = 0;
    dy = 0;
    dragging = true;

    card.classList.add("swiping");
  }

  function onMove(e) {
    if (!dragging || !showRandom) return;

    const t = e.touches ? e.touches[0] : e;
    dx = t.clientX - startX;
    dy = t.clientY - startY;

    if (Math.abs(dx) > Math.abs(dy)) e.preventDefault();

    const rot = dx / 20;
    card.style.transform = `translateX(${dx}px) rotate(${rot}deg)`;
  }

  function finish(direction) {
    dragging = false;
    card.classList.remove("swiping");
    card.style.transform = "";

    if (direction === "right") {
      markLearned(key);
      card.classList.add("fly-right");
    } else {
      markUnlearned(key);
      card.classList.add("fly-left");
    }

    setTimeout(() => {
      if (showRandom) renderRandom();
    }, 260);
  }

  function onEnd() {
    if (!dragging || !showRandom) return;

    dragging = false;
    card.classList.remove("swiping");

    if (Math.abs(dx) >= THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
      finish(dx > 0 ? "right" : "left");
      return;
    }

    card.style.transition = "transform 0.15s ease";
    card.style.transform = "translateX(0px) rotate(0deg)";
    setTimeout(() => {
      card.style.transition = "";
      card.style.transform = "";
    }, 160);
  }

  card.addEventListener("touchstart", onStart, { passive: true });
  card.addEventListener("touchmove", onMove, { passive: false });
  card.addEventListener("touchend", onEnd);
  card.addEventListener("touchcancel", onEnd);
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
    markLearned(key);

    if (showRandom) renderRandom();
    else {
      card.remove();
      updateStrike();
    }
  };

  xBtn.onclick = (e) => {
    e.stopPropagation();
    markUnlearned(key);

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

  attachSwipeHandlers(card, key);

  inner.append(front, back);
  card.append(xBtn, tick, inner);
  return card;
}

function renderWords() {
  if (paginationSection) paginationSection.style.display = "";

  if (randomControls) randomControls.hidden = true;
  if (randomPagesPopover) randomPagesPopover.hidden = true;

  container.classList.remove("random-mode");
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
        !showUnlearned && !showRandom && page === currentPage
      )
    );
    unlearnBtn.classList.toggle("active", showUnlearned);
    randomBtn.classList.toggle("active", showRandom);
  });
}

function renderRandom() {
  showRandom = true;
  showUnlearned = false;

  if (paginationSection) paginationSection.style.display = "none";

  if (randomControls) randomControls.hidden = false;
  if (randomPagesPopover) randomPagesPopover.hidden = true;

  container.innerHTML = "";
  container.classList.add("random-mode");

  const hidden = getLS("hiddenWords");
  const unlearn = getLS("unlearnedWords");

  const selectedPages = getSelectedRandomPages();

  // ✅ Seçim yoksa: kart gösterme
  if (selectedPages.length === 0) {
    container.innerHTML =
      "<p style='text-align:center;font-weight:700;opacity:.85'>Dosya seç (Dosyalar butonundan).</p>";

    pageButtons.forEach(({ btn }) => btn.classList.toggle("active", false));
    unlearnBtn.classList.toggle("active", false);
    randomBtn.classList.toggle("active", true);
    return;
  }

  fetchPages(selectedPages).then((words) => {
    if (!words || words.length === 0) {
      container.innerHTML =
        "<p style='text-align:center;opacity:.7'>Kelime bulunamadı.</p>";
      return;
    }

    const pool = words.filter((w) => {
      const key = keyOf(w.page, w.de);
      return !hidden.includes(key) && !unlearn.includes(key);
    });

    if (pool.length === 0) {
      container.innerHTML =
        "<p style='text-align:center;font-weight:700;opacity:.85'>Gösterilecek kartlar bitti.</p>";

      pageButtons.forEach(({ btn }) => btn.classList.toggle("active", false));
      unlearnBtn.classList.toggle("active", false);
      randomBtn.classList.toggle("active", true);
      return;
    }

    const w = pool[Math.floor(Math.random() * pool.length)];
    container.append(makeCard(w));

    pageButtons.forEach(({ btn }) => btn.classList.toggle("active", false));
    unlearnBtn.classList.toggle("active", false);
    randomBtn.classList.toggle("active", true);
  });
}

resetBtn.onclick = () => {
  localStorage.removeItem("hiddenWords");
  localStorage.removeItem("unlearnedWords");
  localStorage.removeItem(RANDOM_PAGES_KEY);
  showUnlearned = false;
  showRandom = false;
  pageButtons.forEach(({ btn }) => btn.classList.remove("completed"));
  renderWords();
};

unlearnBtn.onclick = () => {
  showUnlearned = !showUnlearned;
  showRandom = false;
  renderWords();
};

randomBtn.onclick = () => {
  renderRandom();
};

// ✅ Random mod: dosyalar butonu
if (randomPagesBtn && randomPagesPopover && randomPagesList && applyRandomPagesBtn) {
  randomPagesBtn.onclick = (e) => {
    e.stopPropagation();
    if (randomPagesPopover.hidden) openRandomPagesPopover();
    else closeRandomPagesPopover();
  };

  applyRandomPagesBtn.onclick = (e) => {
    e.stopPropagation();

    const checked = Array.from(
      randomPagesList.querySelectorAll("input[type='checkbox']:checked")
    ).map((el) => Number(el.value));

    setSelectedRandomPages(checked); // ✅ artık boş da kaydediyoruz

    closeRandomPagesPopover();
    if (showRandom) renderRandom();
  };

  document.addEventListener("click", (e) => {
    if (!showRandom) return;
    if (randomPagesPopover.hidden) return;

    const inside =
      randomPagesPopover.contains(e.target) || randomPagesBtn.contains(e.target);
    if (!inside) closeRandomPagesPopover();
  });
}

renderWords();
