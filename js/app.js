(function () {
  "use strict";

  // ---------- helpers ----------
  const $ = (sel, root) => (root || document).querySelector(sel);
  const el = (tag, attrs, ...kids) => {
    const n = document.createElement(tag);
    for (const k in attrs || {}) {
      if (k === "class") n.className = attrs[k];
      else if (k === "html") n.innerHTML = attrs[k];
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== false && attrs[k] != null) n.setAttribute(k, attrs[k]);
    }
    for (const kid of kids.flat()) if (kid != null) n.append(kid);
    return n;
  };
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const makeStore = (prefix) => ({
    get(key, fallback) {
      try { const v = localStorage.getItem(prefix + key); return v == null ? fallback : JSON.parse(v); }
      catch (e) { return fallback; }
    },
    set(key, val) { try { localStorage.setItem(prefix + key, JSON.stringify(val)); } catch (e) { /* ignore */ } }
  });
  const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const chars = (s) => Array.from(s);

  // ---------- subjects ----------
  // What a subject in js/subjects.js gets when it doesn't say otherwise.
  const DEFAULTS = {
    lang: "ms-MY", voice: "Malay", dir: "ltr", font: "var(--font-body)",
    fields: ["term", "helper", "meaning", "pic", "sent"], helper: null, meaning: "Meaning", unit: "Chapter",
    boxes: false, letters: false, credit: "", local: {},
    cheer: { right: ["Great job!", "Correct!", "Well done!", "Excellent!"], full: "Full marks!", good: "Well done!", more: "Keep trying!", allKnown: "Great job!" }
  };
  const ALL_YEARS = [1, 2, 3, 4, 5, 6];
  const yearsOf = (id) => Object.keys(BOOKS[id] || {}).map(Number).sort((a, b) => a - b);

  // The open subject and everything loaded for it.
  let S = null, db = null, books = {}, WORDS = [], year = 1, selected = new Set(), known = new Set();
  const book = () => books[year];
  const chapterOf = (n, y) => books[y || year].chapters.find((c) => c.n === n);
  const chapName = (c) => c.zh || c.title;        // Chinese books name chapters zh/en, the others title/sub
  const chapSub = (c) => c.en || c.sub || "";
  const chapTag = (c) => (c.label ? chapName(c) : (S.unit === "Chapter" ? "Ch" : S.unit) + " " + c.n);
  const units = () => S.unit.toLowerCase() + "s";

  function loadSubject(id) {
    const def = SUBJECTS.find((s) => s.id === id);
    S = Object.assign({}, DEFAULTS, def, { title: def.title || def.name, cheer: Object.assign({}, DEFAULTS.cheer, def.cheer) });
    // Chinese keeps the original "lwm:" keys, so progress saved before there were other subjects still loads.
    db = makeStore(id === "chinese" ? "lwm:" : "lwm:" + id + ":");
    books = BOOKS[id];
    WORDS = [];
    yearsOf(id).forEach((y) => books[y].chapters.forEach((c) => c.words.forEach((row) => {
      const w = { year: y, ch: c.n, helper: "", sent: "" };
      S.fields.forEach((f, i) => { if (row[i] != null) w[f] = row[i]; });
      w.id = "y" + y + ":" + c.n + ":" + w.term;
      WORDS.push(w);
    })));
    year = db.get("year", yearsOf(id)[0]);
    if (!books[year]) year = yearsOf(id)[0];
    selected = loadSelected();
    // Older saves used "chapter:word" ids from the Year 1 only version.
    known = new Set(db.get("known", []).map((k) => (k.startsWith("y") ? k : "y1:" + k)));
    pickVoice();

    $("#subject").style.setProperty("--font-term", S.font);
    const L = S.local;
    $("#tab-cards-local").textContent = L.cards || "";
    $("#tab-quiz-local").textContent = L.quiz || "";
    $("#years-label").textContent = "Year" + (L.year ? " " + L.year : "");
    $("#units-label").textContent = S.unit + "s" + (L.chapters ? " " + L.chapters : "");
    Cards.load();
    Quiz.load();
    renderChips();
    Cards.reset();
    Quiz.renderSetup();
  }

  // ---------- speech ----------
  const canSpeak = "speechSynthesis" in window;
  let voice = null;
  function pickVoice() {
    voice = null;
    if (!canSpeak || !S) return;
    const want = S.lang.toLowerCase(), base = want.split("-")[0];
    const lang = (v) => v.lang.toLowerCase().replace("_", "-");
    const voices = speechSynthesis.getVoices();
    voice = voices.find((v) => lang(v) === want) ||
            voices.find((v) => lang(v).startsWith(base) && !/hk|tw/.test(lang(v))) ||
            voices.find((v) => lang(v).startsWith(base)) || null;
  }
  if (canSpeak) speechSynthesis.onvoiceschanged = pickVoice;
  function speak(text) {
    if (!canSpeak) return false;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = S.lang;
      if (voice) u.voice = voice;
      u.rate = 0.8;
      speechSynthesis.speak(u);
      return true;
    } catch (e) { return false; }
  }

  // ---------- sounds ----------
  let audioCtx = null;
  function chime(good) {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const notes = good ? [660, 880] : [300, 220];
      notes.forEach((f, i) => {
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.type = good ? "sine" : "triangle";
        o.frequency.value = f;
        const t = audioCtx.currentTime + i * 0.12;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
        o.connect(g).connect(audioCtx.destination);
        o.start(t); o.stop(t + 0.3);
      });
    } catch (e) { /* sound is optional */ }
  }

  // ---------- showing a word ----------
  function tzgRow(zh, opts) {
    const cs = chars(zh);
    const row = el("div", { class: "tzg-row" + (cs.length > 4 ? " most" : cs.length > 3 ? " many" : "") });
    cs.forEach((c) => row.append(el("div", { class: "tzg" + (opts && opts.small ? " small" : ""), "aria-hidden": "true" }, c)));
    return row;
  }
  function pyRow(zh, py) {
    const syl = py.split(/\s+/);
    const cs = chars(zh);
    const row = el("div", { class: "py-row" + (cs.length > 4 ? " most" : cs.length > 3 ? " many" : "") });
    if (syl.length === cs.length) syl.forEach((s) => row.append(el("span", {}, s)));
    else row.append(el("span", { style: "width:auto" }, py));
    return row;
  }
  // The word itself: 田字格 boxes for Chinese, big letters for everything else.
  function termNode(term) {
    if (S.boxes) return tzgRow(term);
    return el("div", { class: "term-big" + (chars(term).length > 10 ? " long" : ""), lang: S.lang, dir: S.dir }, term);
  }
  function helperNode(w) {
    return S.boxes ? pyRow(w.term, w.helper) : el("div", { class: "helper-front" }, w.helper);
  }
  // Where the word sits in its sentence, as [start, length]. Chinese has no spaces, so any match will do;
  // other languages must match a whole word, ignoring capitals.
  function findTerm(sent, term) {
    if (S.boxes) { const i = sent.indexOf(term); return i < 0 ? null : [i, term.length]; }
    const re = new RegExp("(^|[^\\p{L}])(" + term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")(?!\\p{L})", "iu");
    const m = re.exec(sent);
    return m ? [m.index + m[1].length, m[2].length] : null;
  }
  function sentenceNode(sent, term) {
    const n = el("div", { class: "sentence", lang: S.lang, dir: S.dir });
    const at = findTerm(sent, term);
    if (!at) { n.textContent = sent; return n; }
    const [i, len] = at;
    n.innerHTML = escapeHtml(sent.slice(0, i)) + "<mark>" + escapeHtml(sent.slice(i, i + len)) + "</mark>" + escapeHtml(sent.slice(i + len));
    return n;
  }

  // ---------- year + chapter picker (shared) ----------
  // Older saves kept Year 1's chapters under "chapters".
  const loadSelected = () => new Set(db.get("chapters:" + year, (year === 1 && db.get("chapters", null)) || [book().chapters[0].n]));
  const chipsBox = $("#chips");
  function renderYears() {
    const box = $("#years");
    box.innerHTML = "";
    ALL_YEARS.forEach((y) => {
      const b = books[y];
      box.append(el("button", {
        "aria-pressed": y === year ? "true" : "false", disabled: b ? false : "", title: b ? false : "Coming soon",
        onclick: () => { if (y !== year) { year = y; db.set("year", y); selected = loadSelected(); chaptersChanged(); } }
      }, el("span", { class: "big" }, (b && b.zh) || String(y)), b ? "Year " + y : "soon"));
    });
    $("#subtitle").textContent = "Learn with Mommy · Year " + year + (book().zh ? " " + book().zh : "");
  }
  function renderChips() {
    renderYears();
    chipsBox.innerHTML = "";
    book().chapters.forEach((c) => {
      chipsBox.append(el("button", {
        class: "chip", "aria-pressed": selected.has(c.n) ? "true" : "false",
        title: chapName(c) + (chapSub(c) ? " · " + chapSub(c) : ""),
        onclick: () => { selected.has(c.n) ? selected.delete(c.n) : selected.add(c.n); chaptersChanged(); }
      }, c.label || String(c.n)));
    });
    const picked = [...selected].sort((a, b) => a - b).map((n) => chapterOf(n)).filter(Boolean);
    const box = $("#picked");
    if (!picked.length) box.textContent = "Pick at least one " + S.unit.toLowerCase() + " to start.";
    else if (picked.length === 1) {
      const c = picked[0];
      box.innerHTML = (c.label ? "" : S.unit + " " + c.n + " · ") + "<b>" + escapeHtml(chapName(c)) + "</b>" +
        (chapSub(c) ? " · " + escapeHtml(chapSub(c)) : "") + " (pg. " + escapeHtml(c.pages) + ")";
    }
    else box.textContent = picked.length + " " + units() + " · " + poolWords().length + " words";
  }
  function poolWords() { return WORDS.filter((w) => w.year === year && selected.has(w.ch)); }
  function chaptersChanged() {
    db.set("chapters:" + year, [...selected]);
    renderChips();
    Cards.reset();
    Quiz.renderSetup();
  }
  $("#pick-all").onclick = () => { selected = new Set(book().chapters.map((c) => c.n)); chaptersChanged(); };
  $("#pick-none").onclick = () => { selected = new Set(); chaptersChanged(); };

  // ---------- known words ----------
  const saveKnown = () => db.set("known", [...known]);

  // ---------- FLASHCARDS ----------
  const Cards = (function () {
    const view = $("#view-cards");
    let deck = [], idx = 0, flipped = false;
    let showHelper = true, showPic = true, showMeaning = true, onlyLearning = false;

    function load() {
      showHelper = db.get("showPy", true); showPic = db.get("showPic", true); showMeaning = db.get("showEn", true);
      onlyLearning = false;
    }

    function reset(list) {
      let words = list || poolWords();
      if (!list && onlyLearning) words = words.filter((w) => !known.has(w.id));
      deck = words; idx = 0; flipped = false; render();
    }

    function render() {
      view.innerHTML = "";
      const wrap = el("div", { class: "wrap", style: "gap:14px" });
      const bar = el("div", { class: "deck-bar" },
        el("span", { class: "count" }, deck.length ? (idx + 1) + " / " + deck.length : "0 cards"),
        el("div", { class: "toggles" },
          S.helper ? toggle("opt-py", S.helper + " on front", showHelper, (v) => { showHelper = v; db.set("showPy", v); render(); }) : null,
          toggle("opt-pic", "Picture on front", showPic, (v) => { showPic = v; db.set("showPic", v); render(); }),
          toggle("opt-en", S.meaning + " on front", showMeaning, (v) => { showMeaning = v; db.set("showEn", v); render(); }),
          toggle("opt-learning", "Hide words I know", onlyLearning, (v) => { onlyLearning = v; reset(); })
        )
      );
      wrap.append(bar);

      if (!deck.length) {
        wrap.append(el("div", { class: "panel", style: "text-align:center" },
          el("p", {}, selected.size ? "You know every word in these " + units() + ". " + S.cheer.allKnown : "Pick a " + S.unit.toLowerCase() + " above to see its cards."),
          selected.size ? el("button", { class: "btn primary", onclick: () => { onlyLearning = false; reset(); } }, "Show all cards again") : null));
        view.append(wrap);
        return;
      }

      const w = deck[idx];
      const c = chapterOf(w.ch, w.year);
      const front = el("div", { class: "face front" },
        el("span", { class: "chap-tag" }, chapTag(c)),
        known.has(w.id) ? el("span", { class: "known-tag" }, "✓ I know it") : null,
        showPic ? el("div", { class: "pic", "aria-hidden": "true" }, w.pic) : null,
        showHelper && w.helper ? helperNode(w) : null,
        termNode(w.term),
        showMeaning ? el("div", { class: "en-front" }, w.meaning) : null,
        el("span", { class: "hint" }, "Tap to flip")
      );
      const back = el("div", { class: "face back" },
        el("span", { class: "chap-tag" }, chapTag(c) + (c.label ? "" : " · " + chapName(c))),
        el("div", { class: "pic", "aria-hidden": "true" }, w.pic),
        el("div", { class: "term-mid", lang: S.lang, dir: S.dir }, w.term),
        w.helper ? el("div", { class: "py-big" }, w.helper) : null,
        el("div", { class: "en-big" }, w.meaning),
        w.sent ? sentenceNode(w.sent, w.term) : null,
        el("span", { class: "hint" }, "Tap to flip back")
      );
      const card = el("div", {
        class: "card" + (flipped ? " flipped" : ""), role: "button", tabindex: "0",
        "aria-label": flipped ? [w.term, w.helper, w.meaning].filter(Boolean).join(", ") : ("Card " + w.term + ". Tap to flip."),
        onclick: flip,
        onkeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flip(); } }
      }, front, back);
      addSwipe(card);
      wrap.append(el("div", { class: "card-stage" }, card));

      wrap.append(el("div", { class: "controls" },
        el("button", { class: "btn", onclick: prev, disabled: idx === 0 ? "" : false, "aria-label": "Previous card" }, "← Back"),
        el("button", { class: "btn primary speak", onclick: () => speak(w.term), disabled: canSpeak ? false : "" }, "🔊 Say it"),
        el("button", { class: "btn", onclick: next, "aria-label": "Next card" }, idx === deck.length - 1 ? "Start over ↺" : "Next →")
      ));
      wrap.append(el("div", { class: "row2" },
        el("button", { class: "btn good", onclick: () => mark(w, true) }, known.has(w.id) ? "✓ I know it" : "I know it ✓"),
        el("button", { class: "btn soft", onclick: () => mark(w, false) }, "Practise again ↻")
      ));
      wrap.append(el("div", { class: "row-wrap" },
        el("button", { class: "btn", onclick: () => { deck = shuffle(deck); idx = 0; flipped = false; render(); } }, "🔀 Shuffle"),
        w.sent ? el("button", { class: "btn", onclick: () => speak(w.sent), disabled: canSpeak ? false : "" }, "🔊 Say the sentence") : null
      ));
      if (!canSpeak) wrap.append(el("p", { class: "note" }, "This browser can't read words aloud. Try Chrome or Safari on a phone or tablet."));
      else if (!voice) wrap.append(el("p", { class: "note" }, "Tip: if you hear no " + S.voice + " voice, add " + (/^[aeiou]/i.test(S.voice) ? "an " : "a ") + S.voice + " voice in your device's language or text-to-speech settings."));
      wrap.append(el("p", { class: "note" }, "Keyboard: Space flips · ← → move · S says the word"));
      view.append(wrap);
    }

    function toggle(id, text, on, cb) {
      const input = el("input", { type: "checkbox", id });
      input.checked = on;
      input.onchange = () => cb(input.checked);
      return el("label", { for: id }, input, text);
    }
    function flip() {
      flipped = !flipped;
      const card = $(".card", view);
      if (card) card.classList.toggle("flipped", flipped);
      if (flipped && deck[idx]) speak(deck[idx].term);
    }
    function next() { if (!deck.length) return; idx = (idx + 1) % deck.length; flipped = false; render(); }
    function prev() { if (idx > 0) { idx--; flipped = false; render(); } }
    function mark(w, isKnown) {
      isKnown ? known.add(w.id) : known.delete(w.id);
      saveKnown();
      if (onlyLearning && isKnown) {
        deck.splice(idx, 1);
        if (idx >= deck.length) idx = 0;
        flipped = false; render();
      } else next();
    }
    function addSwipe(node) {
      let x0 = null;
      node.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
      node.addEventListener("touchend", (e) => {
        if (x0 == null) return;
        const dx = e.changedTouches[0].clientX - x0; x0 = null;
        if (Math.abs(dx) > 60) { e.preventDefault(); dx < 0 ? next() : prev(); }
      });
    }
    document.addEventListener("keydown", (e) => {
      if ($("#subject").hidden || view.hidden || e.target.closest("input, select, textarea") || e.metaKey || e.ctrlKey) return;
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === " " && !e.target.closest("button, a, .card")) { e.preventDefault(); flip(); }
      else if ((e.key === "s" || e.key === "S") && deck[idx]) speak(deck[idx].term);
    });

    return { load, reset, render };
  })();

  // ---------- QUIZ ----------
  const Quiz = (function () {
    const view = $("#view-quiz");
    let types = new Set(), length = 10;
    let qs = [], qi = 0, score = 0, answered = false, mistakes = [];

    const hasPoems = () => Object.values(books).some((b) => b.poems && b.poems.length);
    function TYPES() {
      const L = S.local;
      return [
        { id: "meaning", zh: L.meaning, en: "See the word, pick the meaning" },
        S.helper && { id: "helper", zh: L.helper, en: "See the word, pick the " + S.helper.toLowerCase() },
        { id: "picture", zh: L.picture, en: "See the picture, pick the word" },
        { id: "listen", zh: L.listen, en: "Listen, then pick the word", needsSpeech: true },
        S.letters && { id: "letter", en: "Fill in the missing letter" },
        { id: "blank", zh: L.blank, en: "Fill in the missing word" },
        hasPoems() && { id: "poem", zh: L.poem, en: "Pick the next line of the poem" }
      ].filter(Boolean);
    }

    function load() {
      const ids = TYPES().map((t) => t.id);
      const fallback = ["meaning", "helper", "picture", "letter", "blank"].filter((t) => ids.includes(t));
      // "pinyin" is what the helper question was called before there were other subjects.
      types = new Set(db.get("quizTypes", fallback).map((t) => (t === "pinyin" ? "helper" : t)).filter((t) => ids.includes(t)));
      length = db.get("quizLen", 10);
      qs = [];
    }

    function renderSetup() {
      if (view.hidden && qs.length && qi < qs.length) return; // keep a quiz in progress while on the cards tab
      qs = [];
      view.innerHTML = "";
      const pool = poolWords();
      const panel = el("div", { class: "panel" }, el("h2", {}, (S.local.quizTitle ? S.local.quizTitle + " " : "") + "Quiz time"));

      const typeBox = el("div", { class: "types" });
      TYPES().forEach((t) => {
        const id = "qt-" + t.id;
        const input = el("input", { type: "checkbox", id });
        input.checked = types.has(t.id);
        input.disabled = t.needsSpeech && !canSpeak;
        input.onchange = () => { input.checked ? types.add(t.id) : types.delete(t.id); db.set("quizTypes", [...types]); updateStart(); };
        const en = t.en + (t.needsSpeech && !canSpeak ? " (needs sound support)" : "");
        typeBox.append(el("label", { class: "type", for: id }, input,
          el("span", {}, t.zh ? [el("b", { class: "local", lang: S.lang }, t.zh), el("small", {}, en)] : el("b", {}, en))));
      });
      panel.append(el("div", { style: "display:flex;flex-direction:column;gap:8px" }, el("span", { class: "label" }, "Question types"), typeBox));

      const seg = el("div", { class: "seg" });
      [5, 10, 20].forEach((n) => seg.append(el("button", {
        "aria-pressed": length === n ? "true" : "false",
        onclick: () => { length = n; db.set("quizLen", n); renderSetup(); }
      }, n + " questions")));
      panel.append(el("div", { style: "display:flex;flex-direction:column;gap:8px" }, el("span", { class: "label" }, "How many"), seg));

      const startBtn = el("button", { class: "btn primary", id: "quiz-start", onclick: start }, "Start quiz ▶");
      const msg = el("p", { class: "note", id: "quiz-msg" });
      panel.append(startBtn, msg);
      const best = db.get("best", {});
      const key = bestKey();
      if (best[key] != null) panel.append(el("p", { class: "best" }, "Best score for these " + units() + ": " + best[key] + "%"));
      view.append(panel);
      updateStart();

      function updateStart() {
        let problem = "";
        if (!selected.size) problem = "Pick at least one " + S.unit.toLowerCase() + " above.";
        else if (!types.size) problem = "Pick at least one question type.";
        else if (pool.length < 4) problem = "Pick more " + units() + ": a quiz needs at least 4 words.";
        else if (types.size === 1 && types.has("poem") && !poemsInPool().length) problem = (book().poems || []).length
          ? "No poems in these chapters. Year " + year + " poems are in chapter " + book().poems.map((p) => p.ch).join(", ") + "."
          : "There are no poems in Year " + year + ".";
        startBtn.disabled = !!problem;
        msg.textContent = problem;
      }
    }

    const bestKey = () => "y" + year + ":" + [...selected].sort((a, b) => a - b).join(",");
    const poemsInPool = () => (book().poems || []).filter((p) => selected.has(p.ch));
    const allPoemLines = () => Object.values(books).flatMap((b) => (b.poems || []).flatMap((x) => x.lines.map((l) => l[0])));

    // Pick 3 distractor words that look different from the answer on the field being asked.
    function distractors(answer, field, pool, n) {
      const sameLen = (w) => chars(w.term).length === chars(answer.term).length;
      const ok = (w) => w.id !== answer.id && w[field] !== answer[field] && w.meaning !== answer.meaning && w.term !== answer.term;
      let cands = shuffle(pool.filter(ok));
      if (cands.length < n) cands = cands.concat(shuffle(WORDS.filter((w) => w.year === answer.year && ok(w) && !cands.includes(w))));
      const preferred = cands.filter(sameLen), rest = cands.filter((w) => !sameLen(w));
      const out = [];
      for (const w of preferred.concat(rest)) {
        if (out.length >= n) break;
        if (!out.some((o) => o[field] === w[field] || o.meaning === w.meaning)) out.push(w);
      }
      return out;
    }

    // Hide one vowel ("p?n": a, e, i or o?). Year 1 phonics practises the vowel sounds.
    function letterQuestion(word) {
      const spots = [];
      chars(word.term).forEach((c, i) => { if (/[aeiou]/i.test(c)) spots.push(i); });
      if (!spots.length) return null;
      const gap = spots[Math.floor(Math.random() * spots.length)];
      const right = chars(word.term)[gap].toLowerCase();
      const others = shuffle([..."aeiou"].filter((v) => v !== right)).slice(0, 3);
      return {
        type: "letter", word, gap,
        options: shuffle([right, ...others]).map((l) => ({ label: l, right: l === right, term: true })),
        answerText: right, say: word.term
      };
    }

    function makeQuestion(type, word, pool) {
      if (type === "poem") {
        const poems = poemsInPool();
        if (!poems.length) return null;
        const p = poems[Math.floor(Math.random() * poems.length)];
        const i = Math.floor(Math.random() * (p.lines.length - 1));
        const right = p.lines[i + 1][0];
        const others = shuffle([...new Set(allPoemLines())].filter((l) => l !== right && l !== p.lines[i][0] && chars(l).length === chars(right).length)).slice(0, 3);
        if (others.length < 3) return null;
        return {
          type, word: null, poem: p, line: p.lines[i],
          options: shuffle([right, ...others]).map((t) => ({ label: t, right: t === right, term: true })),
          answerText: right, say: p.lines[i][0] + "，" + right
        };
      }
      if (type === "letter") return letterQuestion(word);
      if (type === "blank" && !(word.sent && findTerm(word.sent, word.term))) return null;
      if (type === "helper" && !word.helper) return null;
      const field = type === "meaning" ? "meaning" : type === "helper" ? "helper" : "term";
      const opts = shuffle([word, ...distractors(word, field, pool, 3)]);
      if (opts.length < 4) return null;
      return {
        type, word,
        options: opts.map((w) => ({ label: w[field], right: w.id === word.id, term: field === "term", w })),
        answerText: word[field], say: word.term
      };
    }

    function start() {
      const pool = poolWords();
      const typeList = [...types].filter((t) => !(t === "listen" && !canSpeak));
      const words = shuffle(pool);
      qs = [];
      let guard = 0, wi = 0;
      while (qs.length < length && guard++ < length * 20) {
        const type = typeList[qs.length % typeList.length];
        const word = words[wi % words.length];
        const q = makeQuestion(type, word, pool);
        if (type !== "poem") wi++;
        if (q && !qs.some((o) => o.word && q.word && o.word.id === q.word.id && o.type === q.type)) qs.push(q);
      }
      qs = shuffle(qs);
      qi = 0; score = 0; mistakes = [];
      renderQuestion();
    }

    function renderQuestion() {
      answered = false;
      view.innerHTML = "";
      const q = qs[qi];
      const L = S.local;
      const ask = (en, local) => el("div", { class: "q-ask" }, en + " ", local ? el("span", { class: "zh" }, local) : null);
      const panel = el("div", { class: "panel" });
      panel.append(el("div", { class: "q-meta" },
        el("span", {}, "Question " + (qi + 1) + " of " + qs.length),
        el("span", {}, "⭐ " + score)));
      panel.append(el("div", { class: "progress", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": String(qs.length), "aria-valuenow": String(qi) },
        el("div", { style: "width:" + (qi / qs.length * 100) + "%" })));

      const prompt = el("div", { class: "q-prompt" });
      const w = q.word;
      if (q.type === "meaning") {
        prompt.append(ask("What does this mean?", L.askMeaning), termNode(w.term));
      } else if (q.type === "helper") {
        prompt.append(ask("How do you say it?", L.askHelper), termNode(w.term));
      } else if (q.type === "picture") {
        prompt.append(ask("Which word is this?", L.askPicture),
          el("div", { class: "q-pic", "aria-hidden": "true" }, w.pic), el("div", { class: "q-big-en" }, w.meaning));
      } else if (q.type === "listen") {
        prompt.append(ask("Listen and pick the word.", L.askListen),
          el("button", { class: "listen-btn", "aria-label": "Play the word", onclick: () => speak(w.term) }, "🔊"),
          el("div", { class: "note" }, "Tap the speaker to hear it again"));
        setTimeout(() => speak(w.term), 250);
      } else if (q.type === "letter") {
        const cs = chars(w.term);
        prompt.append(ask("Which letter is missing?"),
          el("div", { class: "q-pic", "aria-hidden": "true" }, w.pic),
          el("div", { class: "term-big", lang: S.lang, dir: S.dir },
            cs.slice(0, q.gap).join(""), el("span", { class: "gap" }, "?"), cs.slice(q.gap + 1).join("")),
          el("div", { class: "q-sentence-en" }, w.meaning),
          el("button", { class: "linkish", "aria-label": "Say the word", onclick: () => speak(w.term) }, "🔊 Hear the word"));
      } else if (q.type === "blank") {
        const [i, len] = findTerm(w.sent, w.term);
        const s = el("div", { class: "q-sentence", lang: S.lang, dir: S.dir });
        s.innerHTML = escapeHtml(w.sent.slice(0, i)) + '<span class="blank">' + (S.boxes ? "？".repeat(chars(w.term).length) : "?") + "</span>" + escapeHtml(w.sent.slice(i + len));
        prompt.append(ask("Fill in the missing word.", L.askBlank), s,
          el("div", { class: "q-sentence-en" }, "Hint: the word means “" + w.meaning + "”"));
      } else if (q.type === "poem") {
        prompt.append(ask("What comes next?", L.askPoem),
          el("div", { class: "q-big-en", lang: S.lang, style: "font-family:var(--font-term);font-weight:500" }, "《" + q.poem.title + "》"),
          el("div", { class: "note" }, q.poem.dynasty + " · " + q.poem.author + " · Chapter " + q.poem.ch),
          el("div", { class: "q-sentence", lang: S.lang }, q.line[0] + "，"),
          el("div", { class: "q-sentence-en" }, q.line[1]));
      }
      panel.append(prompt);

      const opts = el("div", { class: "options" });
      q.options.forEach((o) => {
        const long = o.term && chars(o.label).length > (S.boxes ? 3 : 9);
        const b = el("button", { class: "opt" + (o.term ? " term" + (long ? " long" : "") : ""), lang: o.term ? S.lang : false, dir: o.term ? S.dir : false }, o.label);
        b.onclick = () => choose(o, b, opts, q);
        opts.append(b);
      });
      panel.append(opts);
      panel.append(el("div", { class: "feedback", id: "fb", "aria-live": "polite" }));
      const nextBtn = el("button", { class: "btn primary", id: "q-next", hidden: "", onclick: nextQ }, qi === qs.length - 1 ? "See my score ★" : "Next question →");
      panel.append(nextBtn);
      panel.append(el("button", { class: "linkish", onclick: () => { qs = []; renderSetup(); } }, "Stop quiz"));
      view.append(panel);
    }

    function choose(o, btn, opts, q) {
      if (answered) return;
      answered = true;
      const fb = $("#fb", view);
      [...opts.children].forEach((b, i) => {
        b.disabled = true;
        if (q.options[i].right) b.classList.add("right");
      });
      if (o.right) {
        score++;
        btn.classList.add("pop");
        fb.className = "feedback ok";
        fb.textContent = shuffle(S.cheer.right)[0];
        chime(true);
      } else {
        btn.classList.add("wrong", "shake");
        fb.className = "feedback no";
        fb.innerHTML = q.word
          ? "Not quite. It's <span class=\"term\">" + escapeHtml(q.word.term) + "</span> " + escapeHtml((q.word.helper ? q.word.helper + " " : "") + "= " + q.word.meaning)
          : "Not quite. The next line is <span class=\"term\">" + escapeHtml(q.answerText) + "</span>";
        chime(false);
        mistakes.push(q);
      }
      if (q.say) setTimeout(() => speak(q.say), 350);
      const nb = $("#q-next", view);
      nb.hidden = false;
      nb.focus();
    }

    function nextQ() {
      qi++;
      if (qi < qs.length) renderQuestion();
      else renderResult();
    }

    function renderResult() {
      view.innerHTML = "";
      const pct = Math.round(score / qs.length * 100);
      const starCount = pct >= 90 ? 3 : pct >= 60 ? 2 : pct > 0 ? 1 : 0;
      const best = db.get("best", {});
      const key = bestKey();
      const newBest = best[key] == null || pct > best[key];
      if (newBest) { best[key] = pct; db.set("best", best); }

      const panel = el("div", { class: "panel result" });
      const stars = el("div", { class: "stars", "aria-label": starCount + " out of 3 stars" });
      for (let i = 0; i < 3; i++) stars.append(el("span", { class: i < starCount ? "" : "off" }, "⭐"));
      panel.append(stars,
        el("div", { class: "score" }, score + " / " + qs.length),
        el("h2", {}, pct === 100 ? S.cheer.full : pct >= 60 ? S.cheer.good : S.cheer.more),
        newBest && qs.length ? el("p", { class: "best" }, "New best score for these " + units() + "!") : null);

      const wrongWords = mistakes.filter((q) => q.word).map((q) => q.word);
      if (mistakes.length) {
        const list = el("div", { class: "review" }, el("span", { class: "label" }, "Practise these"));
        mistakes.forEach((q) => {
          if (q.word) {
            list.append(el("div", { class: "review-item" },
              el("span", { class: "term", lang: S.lang, dir: S.dir }, q.word.term),
              el("div", { class: "info" }, el("b", {}, (q.word.helper ? q.word.helper + " · " : "") + q.word.meaning), el("small", {}, chapTag(chapterOf(q.word.ch, q.word.year)))),
              canSpeak ? el("button", { class: "linkish", "aria-label": "Say " + q.word.term, onclick: () => speak(q.word.term) }, "🔊") : null));
          } else {
            list.append(el("div", { class: "review-item" },
              el("div", { class: "info", lang: S.lang, style: "font-family:var(--font-term)" },
                el("b", {}, q.line[0] + "，" + q.answerText),
                el("small", {}, "《" + q.poem.title + "》 " + q.poem.author))));
          }
        });
        panel.append(list);
      }
      panel.append(el("div", { class: "row-wrap", style: "width:100%" },
        el("button", { class: "btn primary", onclick: start }, "Play again ↻"),
        wrongWords.length ? el("button", { class: "btn", onclick: () => { showTab("cards"); Cards.reset(wrongWords); } }, "Practise mistakes as cards") : null,
        el("button", { class: "btn", onclick: () => { qs = []; renderSetup(); } }, "Change settings")
      ));
      view.append(panel);
      qs = [];
    }

    return { load, renderSetup };
  })();

  // ---------- screens: home, and a subject's cards and quiz ----------
  // Addresses: #english/cards, #chinese/quiz ... and no hash for the home screen.
  function renderHome() {
    const box = $("#subjects");
    if (box.childElementCount) return;
    SUBJECTS.forEach((s) => {
      const ys = yearsOf(s.id);
      const status = !ys.length ? "Coming soon"
        : ys.length === 1 ? "Year " + ys[0]
        : ys.every((y, i) => !i || y === ys[i - 1] + 1) ? "Years " + ys[0] + "–" + ys[ys.length - 1]
        : "Years " + ys.join(", ");
      const kids = [
        el("span", { class: "s-icon", dir: s.dir || false, "aria-hidden": "true" }, s.icon),
        el("b", {}, s.name),
        s.sub ? el("small", {}, s.sub) : null,
        el("span", { class: "s-status" }, status)
      ];
      box.append(ys.length
        ? el("a", { class: "subject", href: "#" + s.id + "/cards", style: "--h:" + s.hue, onclick: () => { cameFromHome = true; } }, kids)
        : el("div", { class: "subject soon", style: "--h:" + s.hue, "aria-disabled": "true" }, kids));
    });
  }

  let cameFromHome = false;
  function showHome() {
    if (canSpeak) speechSynthesis.cancel();
    $("#home").hidden = false;
    $("#subject").hidden = true;
    $("#tabs").hidden = true;
    $("#back").hidden = true;
    $("#title").textContent = "Learn with Mommy";
    $("#subtitle").textContent = "Pick a subject · Pilih subjek";
    $("#credit").innerHTML = "";
    document.title = "Learn with Mommy";
    renderHome();
  }

  function openSubject(id, tab) {
    if (!S || S.id !== id) loadSubject(id);
    $("#home").hidden = true;
    $("#subject").hidden = false;
    $("#tabs").hidden = false;
    $("#back").hidden = false;
    $("#title").textContent = S.title;
    $("#credit").innerHTML = S.credit;
    document.title = "Learn with Mommy · " + S.name;
    renderYears();
    $("#tab-test").hidden = S.id !== "chinese";
    showTab(tab);
  }

  function showTab(name) {
    const cards = name !== "quiz";
    $("#view-cards").hidden = !cards;
    $("#view-quiz").hidden = cards;
    $("#tab-cards").setAttribute("aria-selected", cards ? "true" : "false");
    $("#tab-quiz").setAttribute("aria-selected", cards ? "false" : "true");
    try { history.replaceState(null, "", "#" + S.id + "/" + (cards ? "cards" : "quiz")); } catch (e) { /* ignore */ }
  }
  $("#tab-cards").onclick = () => showTab("cards");
  $("#tab-quiz").onclick = () => showTab("quiz");
  // The practice exam is its own page (exam.html); it opens on the year picked here.
  $("#tab-test").onclick = () => { location.href = "exam.html#" + year; };
  $("#back").onclick = () => { if (cameFromHome) history.back(); else location.hash = ""; };

  function route() {
    const h = location.hash.slice(1);
    // Links from before there were subjects (#cards, #quiz) open Chinese.
    const [id, tab] = h === "cards" || h === "quiz" ? ["chinese", h] : h.split("/");
    if (yearsOf(id).length && SUBJECTS.some((s) => s.id === id)) openSubject(id, tab);
    else showHome();
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", route);
  route();

  // ---------- install as an app ----------
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js").catch(() => { /* the site still works online */ });
  }
  const installed = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  if (!installed && location.protocol.startsWith("http")) {
    let installPrompt = null;
    const box = $("#install"), help = $("#install-help");
    const isApple = /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
    box.hidden = false;
    window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installPrompt = e; });
    window.addEventListener("appinstalled", () => { box.hidden = true; });
    $("#install-btn").onclick = async () => {
      if (installPrompt) {
        installPrompt.prompt();
        const choice = await installPrompt.userChoice;
        installPrompt = null;
        if (choice.outcome === "accepted") box.hidden = true;
        return;
      }
      help.textContent = isApple
        ? "On iPhone or iPad: tap the Share button (the square with an arrow ⬆︎), then “Add to Home Screen”."
        : "Open the browser menu (⋮ or ⋯) and choose “Install app” or “Add to Home screen”.";
      help.hidden = false;
    };
  }
})();
