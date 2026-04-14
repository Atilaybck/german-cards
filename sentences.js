// sentences.js

const sentencesControls = document.getElementById("sentencesControls");
const sentencesPagesBtn = document.getElementById("sentencesPagesBtn");
const sentencesPagesPopover = document.getElementById("sentencesPagesPopover");
const sentencesPagesList = document.getElementById("sentencesPagesList");
const applySentencesPagesBtn = document.getElementById("applySentencesPages");

const SENTENCES_KEY = "sentenceSelectedPages";
const SENTENCE_HIDDEN_KEY = "hiddenSentences";
const SENTENCE_UNLEARNED_KEY = "unlearnedSentences";
const SENTENCE_PROGRESS_KEY = "sentenceProgress";

const totalSentencePages = 25;

const sentencesDeck = {
  sig: "",
  selectedPages: [],
  pool: [],
  top: null,
  next: null,
  progressText: "",
};

function sentenceKeyOf(page, de) {
  return `${page}_${norm(de)}`;
}

function getSentenceHidden() {
  return getLS(SENTENCE_HIDDEN_KEY);
}

function setSentenceHidden(val) {
  setLS(SENTENCE_HIDDEN_KEY, val);
}

function getSentenceUnlearned() {
  return getLS(SENTENCE_UNLEARNED_KEY);
}

function setSentenceUnlearned(val) {
  setLS(SENTENCE_UNLEARNED_KEY, val);
}

function getSentenceProgress() {
  const obj = JSON.parse(localStorage.getItem(SENTENCE_PROGRESS_KEY) || "{}");
  return obj && typeof obj === "object" ? obj : {};
}

function setSentenceProgress(obj) {
  localStorage.setItem(SENTENCE_PROGRESS_KEY, JSON.stringify(obj || {}));
}

function clearSentenceProgress() {
  localStorage.removeItem(SENTENCE_PROGRESS_KEY);
}

function getSentenceSig(selectedPages) {
  return (selectedPages || []).slice().sort((a, b) => a - b).join(",");
}

function bumpSentenceSeen(selectedPages) {
  if (!showSentences) return;

  const sig = getSentenceSig(selectedPages);
  const prog = getSentenceProgress();

  if (prog.sig !== sig) {
    setSentenceProgress({ sig, seen: 0, total: Number(prog.total) || 0 });
    return;
  }

  const total = Number(prog.total) || 0;
  const seen = Number(prog.seen) || 0;

  setSentenceProgress({
    sig,
    total,
    seen: Math.min(seen + 1, total),
  });
}

function markSentenceLearned(key) {
  const hidden = getSentenceHidden();
  const unlearned = getSentenceUnlearned();

  if (!hidden.includes(key)) hidden.push(key);
  setSentenceHidden(hidden);

  const idx = unlearned.indexOf(key);
  if (idx !== -1) {
    unlearned.splice(idx, 1);
    setSentenceUnlearned(unlearned);
  }
}

function markSentenceUnlearned(key) {
  const unlearned = getSentenceUnlearned();
  if (!unlearned.includes(key)) {
    unlearned.push(key);
    setSentenceUnlearned(unlearned);
  }
}

function getSelectedSentencePages() {
  const arr = getLS(SENTENCES_KEY);
  return (Array.isArray(arr) ? arr : [])
    .map(Number)
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= totalSentencePages);
}

function setSelectedSentencePages(pages) {
  setLS(SENTENCES_KEY, pages);
}

function fetchSentencePages(pages) {
  return Promise.all(
    pages.map((p) =>
      fetch(`data/sentences/page${p}.json`)
        .then((r) => (r.ok ? r.json() : []))
        .then((data) =>
          Array.isArray(data) ? data.map((item) => ({ ...item, page: p })) : []
        )
        .catch(() => [])
    )
  ).then((arrs) => arrs.flat());
}

function addSentenceProgressBadge(card, text) {
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

function makeSentenceCard({ de, tr, oku, page }, opts = {}) {
  const key = sentenceKeyOf(page, de);

  const card = document.createElement("div");
  const inner = document.createElement("div");
  const front = document.createElement("div");
  const back = document.createElement("div");
  const tick = document.createElement("button");
  const xBtn = document.createElement("button");

  card.className = "card sentence-card";
  inner.className = "inner";
  front.className = "side front";
  back.className = "side back";
  tick.className = "tick";
  xBtn.className = "unlearn";

  front.textContent = norm(de);
  back.innerHTML = `${tr}<br><span>(${oku || ""})</span>`;
  tick.textContent = "✔";
  xBtn.textContent = "✘";

  if (opts.progressText) {
    addSentenceProgressBadge(card, opts.progressText);
  }

  tick.onclick = (e) => {
    e.stopPropagation();
    markSentenceLearned(key);
    bumpSentenceSeen(opts.selectedPages || []);
    card.classList.add("fly-right");

    setTimeout(() => {
      if (showSentences) advanceSentencesDeck();
    }, 260);
  };

  xBtn.onclick = (e) => {
    e.stopPropagation();
    markSentenceUnlearned(key);
    card.classList.add("fly-left");

    setTimeout(() => {
      if (showSentences) advanceSentencesDeck();
    }, 260);
  };

  card.onclick = () => {
    speak(norm(de));
    card.classList.toggle("flipped");
  };

  inner.append(front, back);
  card.append(xBtn, tick, inner);

  return card;
}

function buildSentencesPagesUI() {
  if (!sentencesPagesList) return;

  sentencesPagesList.innerHTML = "";
  const selected = new Set(getSelectedSentencePages());

  for (let i = 1; i <= totalSentencePages; i++) {
    const row = document.createElement("label");
    row.className = "page-row";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = String(i);
    cb.checked = selected.has(i);

    const txt = document.createElement("span");
    txt.textContent = `${i}`;

    row.append(cb, txt);
    sentencesPagesList.appendChild(row);
  }
}

function openSentencesPagesPopover() {
  buildSentencesPagesUI();
  if (sentencesPagesPopover) sentencesPagesPopover.hidden = false;
}

function closeSentencesPagesPopover() {
  if (sentencesPagesPopover) sentencesPagesPopover.hidden = true;
}

function pickSentenceFromPool(pool, avoidKey = "") {
  if (!pool || pool.length === 0) return null;
  if (pool.length === 1) return pool[0];

  let tries = 0;
  while (tries < 20) {
    const w = pool[Math.floor(Math.random() * pool.length)];
    const k = sentenceKeyOf(w.page, w.de);
    if (!avoidKey || k !== avoidKey) return w;
    tries++;
  }

  return pool[Math.floor(Math.random() * pool.length)];
}

function prepareSentencesDeck(list, selectedPages) {
  const hidden = getSentenceHidden();

  const pool = (Array.isArray(list) ? list : []).filter((item) => {
    const key = sentenceKeyOf(item.page, item.de);
    return !hidden.includes(key);
  });

  const sig = getSentenceSig(selectedPages);
  const prog = getSentenceProgress();
  const progSig = prog.sig || "";
  const progSeen = Number(prog.seen) || 0;

  if (progSig !== sig) {
    setSentenceProgress({ sig, seen: 0, total: pool.length });
  } else if (
    !Number.isFinite(Number(prog.total)) ||
    Number(prog.total) === 0
  ) {
    setSentenceProgress({ sig, seen: progSeen, total: pool.length });
  }

  const prog2 = getSentenceProgress();
  const total = Number(prog2.total) || pool.length;
  const seen = Math.min(Number(prog2.seen) || 0, total);

  sentencesDeck.progressText = `${Math.min(seen + 1, total)}/${total}`;
  sentencesDeck.sig = sig;
  sentencesDeck.selectedPages = selectedPages.slice();
  sentencesDeck.pool = pool;

  if (pool.length === 0) {
    sentencesDeck.top = null;
    sentencesDeck.next = null;
    return;
  }

  const top = pickSentenceFromPool(pool, "");
  const topKey = sentenceKeyOf(top.page, top.de);
  const next = pickSentenceFromPool(pool, topKey);

  sentencesDeck.top = top;
  sentencesDeck.next = next || top;
}

function renderSentencesFromDeck() {
  container.innerHTML = "";
  container.classList.add("random-mode");
  container.classList.add("sentences-mode");
  container.classList.remove("quiz-mode");
  container.classList.remove("swiping-stack");

  if (!sentencesDeck.top) {
    container.innerHTML =
      "<p style='text-align:center;font-weight:800;opacity:.9'>Seçtiğin cümleler bitti ✅</p>";
    return;
  }

  const topCard = makeSentenceCard(sentencesDeck.top, {
    selectedPages: sentencesDeck.selectedPages,
    progressText: sentencesDeck.progressText,
  });
  topCard.classList.add("card-top");

  const nextCard = makeSentenceCard(sentencesDeck.next || sentencesDeck.top, {
    selectedPages: sentencesDeck.selectedPages,
    progressText: sentencesDeck.progressText,
  });
  nextCard.classList.add("card-next");
  nextCard.style.pointerEvents = "none";

  container.append(nextCard, topCard);
}

function advanceSentencesDeck() {
  if (!showSentences) return;

  setTimeout(() => {
    if (!sentencesDeck.pool || sentencesDeck.pool.length === 0) {
      sentencesDeck.top = null;
      sentencesDeck.next = null;
      renderSentencesFromDeck();
      return;
    }

    const prog2 = getSentenceProgress();
    const total = Number(prog2.total) || (sentencesDeck.pool || []).length;
    const seen = Math.min(Number(prog2.seen) || 0, total);
    sentencesDeck.progressText = `${Math.min(seen + 1, total)}/${total}`;

    const currentKey = sentencesDeck.top
      ? sentenceKeyOf(sentencesDeck.top.page, sentencesDeck.top.de)
      : "";

    sentencesDeck.pool = (sentencesDeck.pool || []).filter(
      (item) => sentenceKeyOf(item.page, item.de) !== currentKey
    );

    if (!sentencesDeck.pool.length) {
      sentencesDeck.top = null;
      sentencesDeck.next = null;
      renderSentencesFromDeck();
      return;
    }

    sentencesDeck.top = sentencesDeck.next || sentencesDeck.pool[0];

    const topKey = sentencesDeck.top
      ? sentenceKeyOf(sentencesDeck.top.page, sentencesDeck.top.de)
      : "";

    sentencesDeck.next =
      pickSentenceFromPool(sentencesDeck.pool, topKey) || sentencesDeck.top;

    renderSentencesFromDeck();
  }, 0);
}

function attachSentenceSwipeHandlers(card) {
  let startX = 0;
  let startY = 0;
  let dx = 0;
  let dy = 0;
  let dragging = false;
  let spokeOnSwipe = false;

  const THRESHOLD = 80;

  function onStart(e) {
    if (!showSentences) return;

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
    if (!dragging || !showSentences) return;

    const t = e.touches ? e.touches[0] : e;
    dx = t.clientX - startX;
    dy = t.clientY - startY;

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

    const currentItem = sentencesDeck.top;
    const key = currentItem
      ? sentenceKeyOf(currentItem.page, currentItem.de)
      : "";

    if (direction === "right") {
      markSentenceLearned(key);
      bumpSentenceSeen(sentencesDeck.selectedPages || []);
      card.classList.add("fly-right");
    } else {
      markSentenceUnlearned(key);
      card.classList.add("fly-left");
    }

    setTimeout(() => {
      if (showSentences) advanceSentencesDeck();
    }, 260);
  }

  function onEnd() {
    if (!dragging || !showSentences) return;

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

function renderSentences() {
  showSentences = true;
  showRandom = false;
  showQuiz = false;
  showUnlearned = false;

  if (typeof hideAllModeControls === "function") {
    hideAllModeControls();
  }

  if (paginationSection) paginationSection.style.display = "none";

  if (sentencesControls) sentencesControls.hidden = false;
  if (sentencesPagesPopover) sentencesPagesPopover.hidden = true;

  const oldHint = sentencesControls?.querySelector("#sentencesHint");
  if (oldHint) oldHint.remove();

  container.innerHTML = "";
  container.classList.add("random-mode");
  container.classList.add("sentences-mode");
  container.classList.remove("quiz-mode");
  container.classList.remove("swiping-stack");

  const pages = getSelectedSentencePages();

  if (!pages.length) {
    if (sentencesControls) {
      sentencesControls.insertAdjacentHTML(
        "afterbegin",
        "<p id='sentencesHint' style='text-align:center;font-weight:700;opacity:.85;margin-bottom:10px'>Cümle sayfası seç</p>"
      );
    }

    container.innerHTML = "";
    if (typeof updateActiveButtons === "function") updateActiveButtons();
    return;
  }

  fetchSentencePages(pages).then((list) => {
    shuffle(list);
    prepareSentencesDeck(list, pages);
    renderSentencesFromDeck();

    const topCard = container.querySelector(".card.card-top");
    if (topCard) attachSentenceSwipeHandlers(topCard);

    if (typeof updateActiveButtons === "function") updateActiveButtons();
  });
}

const originalRenderSentencesFromDeck = renderSentencesFromDeck;
renderSentencesFromDeck = function () {
  originalRenderSentencesFromDeck();

  const topCard = container.querySelector(".card.card-top");
  if (topCard) attachSentenceSwipeHandlers(topCard);
};

if (
  sentencesPagesBtn &&
  sentencesPagesPopover &&
  sentencesPagesList &&
  applySentencesPagesBtn
) {
  sentencesPagesBtn.onclick = (e) => {
    e.stopPropagation();

    if (sentencesPagesPopover.hidden) {
      openSentencesPagesPopover();
    } else {
      closeSentencesPagesPopover();
    }
  };

  applySentencesPagesBtn.onclick = (e) => {
    e.stopPropagation();

    const checked = Array.from(
      sentencesPagesList.querySelectorAll("input[type='checkbox']:checked")
    ).map((el) => Number(el.value));

    setSelectedSentencePages(checked);
    clearSentenceProgress();
    closeSentencesPagesPopover();

    if (showSentences) renderSentences();
  };

  document.addEventListener("click", (e) => {
    if (!showSentences) return;
    if (sentencesPagesPopover.hidden) return;

    const inside =
      sentencesPagesPopover.contains(e.target) ||
      sentencesPagesBtn.contains(e.target);

    if (!inside) closeSentencesPagesPopover();
  });
}

window.renderSentences = renderSentences;
window.clearSentenceProgress = clearSentenceProgress;