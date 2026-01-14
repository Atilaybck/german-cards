// random.js

// ✅ Random mod UI
const randomControls = document.getElementById("randomControls");
const randomPagesBtn = document.getElementById("randomPagesBtn");
const randomPagesPopover = document.getElementById("randomPagesPopover");
const randomPagesList = document.getElementById("randomPagesList");
const applyRandomPagesBtn = document.getElementById("applyRandomPages");

// ✅ Rastgele modda seçilen sayfalar
const RANDOM_PAGES_KEY = "randomSelectedPages";

// ✅ Random progress
const RANDOM_PROGRESS_KEY = "randomProgress"; // { sig: "1,2,3", seen: 0, total: 60 }

// ✅ Random "deck" state (flicker fix)
const randomDeck = {
  sig: "",
  selectedPages: [],
  pool: [],
  top: null,
  next: null,
  progressText: "",
  lastKey: "",
};

function getRandomProgress() {
  const obj = JSON.parse(localStorage.getItem(RANDOM_PROGRESS_KEY) || "{}");
  return obj && typeof obj === "object" ? obj : {};
}
function setRandomProgress(obj) {
  localStorage.setItem(RANDOM_PROGRESS_KEY, JSON.stringify(obj || {}));
}
function clearRandomProgress() {
  localStorage.removeItem(RANDOM_PROGRESS_KEY);
}
function getRandomSig(selectedPages) {
  return (selectedPages || []).slice().sort((a, b) => a - b).join(",");
}
function bumpRandomSeen(selectedPages) {
  if (!showRandom) return;

  const sig = getRandomSig(selectedPages);
  const prog = getRandomProgress();

  if (prog.sig !== sig) {
    setRandomProgress({ sig, seen: 0, total: Number(prog.total) || 0 });
    return;
  }

  const total = Number(prog.total) || 0;
  const seen = Number(prog.seen) || 0;
  setRandomProgress({ sig, total, seen: Math.min(seen + 1, total) });
}

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

// ✅ Random sayfa seçim UI (popover)
function buildRandomPagesUI() {
  if (!randomPagesList) return;
  randomPagesList.innerHTML = "";

  const selected = new Set(
    Array.isArray(getLS(RANDOM_PAGES_KEY))
      ? getLS(RANDOM_PAGES_KEY).map(Number)
      : []
  );

  for (let i = 1; i <= totalPages; i++) {
    const row = document.createElement("label");
    row.className = "page-row";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = String(i);
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

/** ✅ pool içinden bir kart seç (top/next çakışmasın) */
function pickFromPool(pool, avoidKey = "") {
  if (!pool || pool.length === 0) return null;
  if (pool.length === 1) return pool[0];

  let tries = 0;
  while (tries < 20) {
    const w = pool[Math.floor(Math.random() * pool.length)];
    const k = keyOf(w.page, w.de);
    if (!avoidKey || k !== avoidKey) return w;
    tries++;
  }
  // fallback
  return pool[Math.floor(Math.random() * pool.length)];
}

/** ✅ random deck'i hazırla / yenile */
function prepareRandomDeck(words, selectedPages) {
  const hidden = getLS("hiddenWords");
  const unlearn = getLS("unlearnedWords");

  const pool = (words || []).filter((w) => {
    const k = keyOf(w.page, w.de);
    return !hidden.includes(k) && !unlearn.includes(k);
  });

  const sig = getRandomSig(selectedPages);

  const prog = getRandomProgress();
  const progSig = prog.sig || "";
  const progSeen = Number(prog.seen) || 0;

  if (progSig !== sig) {
    setRandomProgress({ sig, seen: 0, total: pool.length });
  } else if (!Number.isFinite(Number(prog.total)) || Number(prog.total) === 0) {
    setRandomProgress({ sig, seen: progSeen, total: pool.length });
  }

  const prog2 = getRandomProgress();
  const total = Number(prog2.total) || pool.length;
  const seen = Math.min(Number(prog2.seen) || 0, total);
  const progressText = `${Math.min(seen + 1, total)}/${total}`;

  randomDeck.sig = sig;
  randomDeck.selectedPages = selectedPages.slice();
  randomDeck.pool = pool;
  randomDeck.progressText = progressText;

  if (pool.length === 0) {
    randomDeck.top = null;
    randomDeck.next = null;
    randomDeck.lastKey = "";
    return;
  }

  const top = pickFromPool(pool, "");
  const topKey = keyOf(top.page, top.de);
  const next = pickFromPool(pool, topKey);
  const nextKey = next ? keyOf(next.page, next.de) : "";

  randomDeck.top = top;
  randomDeck.next = next || top;
  randomDeck.lastKey = nextKey || topKey;
}

/** ✅ top -> next, next -> yeni next (DOM'u bir kere değiştirir) */
function advanceRandomDeck() {
  if (!showRandom) return;

  // DOM animasyon bitince yenilemek için küçük timeout
  setTimeout(() => {
    // ✅ pool bitti mi? (swipe ile pool azalıyor)
    if (!randomDeck.pool || randomDeck.pool.length === 0) {
      randomDeck.top = null;
      randomDeck.next = null;
      renderRandomFromDeck();
      return;
    }

    // seen ilerlediği için progress text'i güncelle
    const selectedPages = randomDeck.selectedPages || [];
    const prog2 = getRandomProgress();
    const total = Number(prog2.total) || (randomDeck.pool || []).length;
    const seen = Math.min(Number(prog2.seen) || 0, total);
    randomDeck.progressText = `${Math.min(seen + 1, total)}/${total}`;

    // top'u next yap
    randomDeck.top = randomDeck.next || randomDeck.top;

    // yeni next seç (top ile çakışmasın)
    const topKey = randomDeck.top
      ? keyOf(randomDeck.top.page, randomDeck.top.de)
      : "";
    randomDeck.next = pickFromPool(randomDeck.pool, topKey) || randomDeck.top;

    renderRandomFromDeck();
  }, 0);
}

/** ✅ deck'ten render: flicker yok */
function renderRandomFromDeck() {
  container.innerHTML = "";
  container.classList.add("random-mode");
  container.classList.remove("swiping-stack");

  if (!randomDeck.top) {
    container.innerHTML =
      "<p style='text-align:center;font-weight:800;opacity:.9'>Tebrikler! Seçtiğin sayfalardaki tüm kartları gördün ✅</p>";
    return;
  }

  const topCard = makeCard(randomDeck.top, {
    selectedPages: randomDeck.selectedPages,
    progressText: randomDeck.progressText,
  });
  topCard.classList.add("card-top");

  const nextCard = makeCard(randomDeck.next || randomDeck.top, {
    selectedPages: randomDeck.selectedPages,
    progressText: randomDeck.progressText,
  });
  nextCard.classList.add("card-next");
  nextCard.style.pointerEvents = "none";

  container.append(nextCard, topCard);
}

/** ✅ Random modda swipe davranışı + swipe başlayınca seslendir */
function attachSwipeHandlers(card, key, selectedPages) {
  let startX = 0;
  let startY = 0;
  let dx = 0;
  let dy = 0;
  let dragging = false;

  let spokeOnSwipe = false; // ✅ eklendi

  const THRESHOLD = 80; // px

  function onStart(e) {
    if (!showRandom) return;

    spokeOnSwipe = false;

    const t = e.touches ? e.touches[0] : e;
    startX = t.clientX;
    startY = t.clientY;
    dx = 0;
    dy = 0;
    dragging = true;

    container.classList.add("swiping-stack");
    card.classList.add("swiping");
  }

  function onMove(e) {
    if (!dragging || !showRandom) return;

    const t = e.touches ? e.touches[0] : e;
    dx = t.clientX - startX;
    dy = t.clientY - startY;

    // ✅ ilk yatay swipe anında 1 kere konuş
    if (!spokeOnSwipe && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
      const deText = card.querySelector(".front")?.textContent?.trim() || "";
      speak(deText);
      spokeOnSwipe = true;
    }

    if (Math.abs(dx) > Math.abs(dy)) e.preventDefault();

    const rot = dx / 20;
    card.style.transform = `translateX(${dx}px) rotate(${rot}deg)`;
  }

  function finish(direction) {
    dragging = false;
    card.classList.remove("swiping");
    card.style.transform = "";

    const nextCard = container.querySelector(".card.card-next");
    if (nextCard) nextCard.classList.add("reveal");

    if (direction === "right") {
      markLearned(key);
      card.classList.add("fly-right");
    } else {
      markUnlearned(key);
      card.classList.add("fly-left");
    }

    // ✅ FIX: aynı kelime tekrar seçilmesin diye pool'dan çıkar
    randomDeck.pool = (randomDeck.pool || []).filter(
      (w) => keyOf(w.page, w.de) !== key
    );
    if (
      randomDeck.next &&
      keyOf(randomDeck.next.page, randomDeck.next.de) === key
    ) {
      randomDeck.next = null;
    }

    bumpRandomSeen(selectedPages);

    // ✅ kritik: renderRandom() yok -> flicker yok
    setTimeout(() => {
      if (showRandom) advanceRandomDeck();
    }, 260);
  }

  function onEnd() {
    if (!dragging || !showRandom) return;

    dragging = false;
    card.classList.remove("swiping");
    container.classList.remove("swiping-stack");

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

function renderRandom() {
  showRandom = true;
  showUnlearned = false;
  showQuiz = false; // ✅ eklendi (tutarlılık)

  // ✅ quiz UI kapat (Sorular → Rastgele geçişinde 2 buton bug fix)
  const quizControlsEl = document.getElementById("quizControls");
  const quizFilesPopoverEl = document.getElementById("quizFilesPopover");
  if (quizControlsEl) quizControlsEl.hidden = true;
  if (quizFilesPopoverEl) quizFilesPopoverEl.hidden = true;

  if (paginationSection) paginationSection.style.display = "none";

  if (randomControls) randomControls.hidden = false;
  if (randomPagesPopover) randomPagesPopover.hidden = true;

  container.innerHTML = "";
  container.classList.add("random-mode");
  container.classList.remove("swiping-stack");

  const selectedPages = getSelectedRandomPages();

  if (selectedPages.length === 0) {
    container.innerHTML =
      "<p style='text-align:center;font-weight:700;opacity:.85'>Sayfa seç (Dosyalar butonundan).</p>";

    pageButtons.forEach(({ btn }) => btn.classList.toggle("active", false));
    unlearnBtn.classList.toggle("active", false);
    randomBtn.classList.toggle("active", true);
    if (quizBtn) quizBtn.classList.toggle("active", false);
    return;
  }

  fetchPages(selectedPages).then((words) => {
    prepareRandomDeck(words, selectedPages);

    if (!randomDeck.pool || randomDeck.pool.length === 0) {
      container.innerHTML =
        "<p style='text-align:center;font-weight:800;opacity:.9'>Tebrikler! Seçtiğin sayfalardaki tüm kartları gördün ✅</p>";
      return;
    }

    renderRandomFromDeck();

    pageButtons.forEach(({ btn }) => btn.classList.toggle("active", false));
    unlearnBtn.classList.toggle("active", false);
    randomBtn.classList.toggle("active", true);
    if (quizBtn) quizBtn.classList.toggle("active", false);
  });
}

// ✅ Random mod: dosyalar butonu
if (
  randomPagesBtn &&
  randomPagesPopover &&
  randomPagesList &&
  applyRandomPagesBtn
) {
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

    setSelectedRandomPages(checked);
    clearRandomProgress();

    // deck reset (seçim değişince)
    randomDeck.sig = "";
    randomDeck.selectedPages = [];
    randomDeck.pool = [];
    randomDeck.top = null;
    randomDeck.next = null;
    randomDeck.progressText = "";
    randomDeck.lastKey = "";

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

// Global hook for reset
window.resetRandomDeck = () => {
  randomDeck.sig = "";
  randomDeck.selectedPages = [];
  randomDeck.pool = [];
  randomDeck.top = null;
  randomDeck.next = null;
  randomDeck.progressText = "";
  randomDeck.lastKey = "";
};

// expose for landing.js makeCard()
window.renderRandom = renderRandom;
window.bumpRandomSeen = bumpRandomSeen;
window.advanceRandomDeck = advanceRandomDeck;
window.attachSwipeHandlers = attachSwipeHandlers;
window.clearRandomProgress = clearRandomProgress;
