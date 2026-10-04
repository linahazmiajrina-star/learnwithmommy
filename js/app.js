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
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem("lwm:" + key); return v == null ? fallback : JSON.parse(v); }
      catch (e) { return fallback; }
    },
    set(key, val) { try { localStorage.setItem("lwm:" + key, JSON.stringify(val)); } catch (e) { /* ignore */ } }
  };
  const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // ---------- data ----------
  const BOOKS = window.BOOKS;
  const YEARS = Object.keys(BOOKS).map(Number).sort((a, b) => a - b);
  const WORDS = [];
  YEARS.forEach((y) => BOOKS[y].chapters.forEach((c) => c.words.forEach(([zh, py, en, pic, sent]) => {
    WORDS.push({ id: "y" + y + ":" + c.n + ":" + zh, year: y, ch: c.n, zh, py, en, pic, sent });
  })));
  let year = store.get("year", 1);
  if (!BOOKS[year]) year = YEARS[0];
  const book = () => BOOKS[year];
  const chapterOf = (n, y) => BOOKS[y || year].chapters.find((c) => c.n === n);

  // ---------- speech ----------
  let zhVoice = null;
  function pickVoice() {
    if (!("speechSynthesis" in window)) return;
    const voices = speechSynthesis.getVoices();
    zhVoice = voices.find((v) => /zh[-_]CN/i.test(v.lang)) ||
              voices.find((v) => /^zh/i.test(v.lang) && !/HK|TW/i.test(v.lang)) ||
              voices.find((v) => /^zh/i.test(v.lang)) || null;
  }
  if ("speechSynthesis" in window) {
    pickVoice();
    speechSynthesis.onvoiceschanged = pickVoice;
  }
  function speak(text) {
    if (!("speechSynthesis" in window)) return false;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "zh-CN";
      if (zhVoice) u.voice = zhVoice;
      u.rate = 0.8;
      speechSynthesis.speak(u);
      return true;
    } catch (e) { return false; }
  }
  const canSpeak = "speechSynthesis" in window;

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

  // ---------- 田字格 rendering ----------
  function tzgRow(zh, opts) {
    const chars = Array.from(zh);
    const row = el("div", { class: "tzg-row" + (chars.length > 4 ? " most" : chars.length > 3 ? " many" : "") });
    chars.forEach((c) => row.append(el("div", { class: "tzg" + (opts && opts.small ? " small" : ""), "aria-hidden": "true" }, c)));
    return row;
  }
  function pyRow(zh, py) {
    const syl = py.split(/\s+/);
    const chars = Array.from(zh);
    const row = el("div", { class: "py-row" + (chars.length > 4 ? " most" : chars.length > 3 ? " many" : "") });
    if (syl.length === chars.length) syl.forEach((s) => row.append(el("span", {}, s)));
    else row.append(el("span", { style: "width:auto" }, py));
    return row;
  }
  function sentenceNode(sent, word) {
    const i = sent.indexOf(word);
    const n = el("div", { class: "sentence", lang: "zh-CN" });
    if (i < 0) { n.textContent = sent; return n; }
    n.innerHTML = escapeHtml(sent.slice(0, i)) + "<mark>" + escapeHtml(word) + "</mark>" + escapeHtml(sent.slice(i + word.length));
    return n;
  }

  // ---------- year + chapter picker (shared) ----------
  const loadSelected = () => new Set(store.get("chapters:" + year, year === 1 ? store.get("chapters", [1, 2, 3]) : [1]));
  let selected = loadSelected();
  const chipsBox = $("#chips");
  function renderYears() {
    const box = $("#years");
    box.innerHTML = "";
    YEARS.forEach((y) => box.append(el("button", {
      "aria-pressed": y === year ? "true" : "false",
      onclick: () => { if (y !== year) { year = y; store.set("year", y); selected = loadSelected(); chaptersChanged(); } }
    }, el("span", { class: "zh" }, BOOKS[y].zh), " Year " + y)));
    $("#year-label").textContent = "Year " + year + " " + book().zh;
  }
  function renderChips() {
    renderYears();
    chipsBox.innerHTML = "";
    book().chapters.forEach((c) => {
      chipsBox.append(el("button", {
        class: "chip", "aria-pressed": selected.has(c.n) ? "true" : "false",
        title: c.zh + " · " + c.en,
        onclick: () => { selected.has(c.n) ? selected.delete(c.n) : selected.add(c.n); chaptersChanged(); }
      }, String(c.n)));
    });
    const picked = [...selected].sort((a, b) => a - b).map((n) => chapterOf(n)).filter(Boolean);
    const box = $("#picked");
    if (!picked.length) box.textContent = "Pick at least one chapter to start.";
    else if (picked.length === 1) box.innerHTML = "Chapter " + picked[0].n + " · <b>" + picked[0].zh + "</b> · " + picked[0].en + " (pg. " + picked[0].pages + ")";
    else box.textContent = picked.length + " chapters · " + poolWords().length + " words";
  }
  function poolWords() { return WORDS.filter((w) => w.year === year && selected.has(w.ch)); }
  function chaptersChanged() {
    store.set("chapters:" + year, [...selected]);
    renderChips();
    Cards.reset();
    Quiz.renderSetup();
  }
  $("#pick-all").onclick = () => { selected = new Set(book().chapters.map((c) => c.n)); chaptersChanged(); };
  $("#pick-none").onclick = () => { selected = new Set(); chaptersChanged(); };

  // ---------- known words ----------
  // Older saves used "chapter:word" ids from the Year 1 only version.
  const known = new Set(store.get("known", []).map((id) => (id.startsWith("y") ? id : "y1:" + id)));
  const saveKnown = () => store.set("known", [...known]);

  // ---------- FLASHCARDS ----------
  const Cards = (function () {
    const view = $("#view-cards");
    let deck = [], idx = 0, flipped = false;
    let showPy = store.get("showPy", true), showPic = store.get("showPic", true), onlyLearning = false;

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
          toggle("opt-py", "Pinyin on front", showPy, (v) => { showPy = v; store.set("showPy", v); render(); }),
          toggle("opt-pic", "Picture on front", showPic, (v) => { showPic = v; store.set("showPic", v); render(); }),
          toggle("opt-learning", "Hide words I know", onlyLearning, (v) => { onlyLearning = v; reset(); })
        )
      );
      wrap.append(bar);

      if (!deck.length) {
        wrap.append(el("div", { class: "panel", style: "text-align:center" },
          el("p", {}, selected.size ? "You know every word in these chapters. 太棒了！" : "Pick a chapter above to see its cards."),
          selected.size ? el("button", { class: "btn primary", onclick: () => { onlyLearning = false; reset(); } }, "Show all cards again") : null));
        view.append(wrap);
        return;
      }

      const w = deck[idx];
      const front = el("div", { class: "face front" },
        el("span", { class: "chap-tag" }, "Ch " + w.ch),
        known.has(w.id) ? el("span", { class: "known-tag" }, "✓ I know it") : null,
        showPic ? el("div", { class: "pic", "aria-hidden": "true" }, w.pic) : null,
        showPy ? pyRow(w.zh, w.py) : null,
        tzgRow(w.zh),
        el("span", { class: "hint" }, "Tap to flip")
      );
      const back = el("div", { class: "face back" },
        el("span", { class: "chap-tag" }, "Ch " + w.ch + " · " + chapterOf(w.ch, w.year).zh),
        el("div", { class: "pic", "aria-hidden": "true" }, w.pic),
        el("div", { class: "zh-mid", lang: "zh-CN" }, w.zh),
        el("div", { class: "py-big" }, w.py),
        el("div", { class: "en-big" }, w.en),
        w.sent ? sentenceNode(w.sent, w.zh) : null,
        el("span", { class: "hint" }, "Tap to flip back")
      );
      const card = el("div", {
        class: "card" + (flipped ? " flipped" : ""), role: "button", tabindex: "0",
        "aria-label": flipped ? (w.zh + ", " + w.py + ", " + w.en) : ("Card " + w.zh + ". Tap to flip."),
        onclick: flip,
        onkeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flip(); } }
      }, front, back);
      addSwipe(card);
      wrap.append(el("div", { class: "card-stage" }, card));

      wrap.append(el("div", { class: "controls" },
        el("button", { class: "btn", onclick: prev, disabled: idx === 0 ? "" : false, "aria-label": "Previous card" }, "← Back"),
        el("button", { class: "btn primary speak", onclick: () => speakWord(w), disabled: canSpeak ? false : "" }, "🔊 Say it"),
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
      if (!canSpeak) wrap.append(el("p", { class: "note" }, "This browser can't read Chinese aloud. Try Chrome or Safari on a phone or tablet."));
      else if (!zhVoice) wrap.append(el("p", { class: "note" }, "Tip: if you hear no Chinese voice, add a Chinese (Mandarin) voice in your device's language or text-to-speech settings."));
      wrap.append(el("p", { class: "note" }, "Keyboard: Space flips · ← → move · S says the word"));
      view.append(wrap);
    }

    function toggle(id, text, on, cb) {
      const input = el("input", { type: "checkbox", id });
      input.checked = on;
      input.onchange = () => cb(input.checked);
      return el("label", { for: id }, input, text);
    }
    function speakWord(w) { speak(w.zh); }
    function flip() {
      flipped = !flipped;
      const card = $(".card", view);
      if (card) card.classList.toggle("flipped", flipped);
      if (flipped && deck[idx]) speakWord(deck[idx]);
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
      if (view.hidden || e.target.closest("input, select, textarea") || e.metaKey || e.ctrlKey) return;
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === " " && !e.target.closest("button, .card")) { e.preventDefault(); flip(); }
      else if ((e.key === "s" || e.key === "S") && deck[idx]) speakWord(deck[idx]);
    });

    return { reset, render };
  })();

  // ---------- QUIZ ----------
  const Quiz = (function () {
    const view = $("#view-quiz");
    const TYPES = [
      { id: "meaning", zh: "看字选意思", en: "See the word, pick the meaning" },
      { id: "pinyin", zh: "看字选拼音", en: "See the word, pick the pinyin" },
      { id: "picture", zh: "看图选字", en: "See the picture, pick the word" },
      { id: "listen", zh: "听音选字", en: "Listen, then pick the word", needsSpeech: true },
      { id: "blank", zh: "选词填空", en: "Fill in the missing word" },
      { id: "poem", zh: "古诗接龙", en: "Pick the next line of the poem" }
    ];
    let types = new Set(store.get("quizTypes", ["meaning", "pinyin", "picture", "blank"]));
    let length = store.get("quizLen", 10);
    let qs = [], qi = 0, score = 0, answered = false, mistakes = [];

    function renderSetup() {
      if (view.hidden && qs.length && qi < qs.length) return; // keep a quiz in progress while on the cards tab
      qs = [];
      view.innerHTML = "";
      const pool = poolWords();
      const panel = el("div", { class: "panel" }, el("h2", {}, "测验 Quiz time"));

      const typeBox = el("div", { class: "types" });
      TYPES.forEach((t) => {
        const id = "qt-" + t.id;
        const input = el("input", { type: "checkbox", id });
        input.checked = types.has(t.id);
        input.disabled = t.needsSpeech && !canSpeak;
        input.onchange = () => { input.checked ? types.add(t.id) : types.delete(t.id); store.set("quizTypes", [...types]); updateStart(); };
        typeBox.append(el("label", { class: "type", for: id }, input,
          el("span", {}, el("b", { lang: "zh-CN" }, t.zh), el("small", {}, t.en + (t.needsSpeech && !canSpeak ? " (needs sound support)" : "")))));
      });
      panel.append(el("div", { style: "display:flex;flex-direction:column;gap:8px" }, el("span", { class: "label" }, "Question types"), typeBox));

      const seg = el("div", { class: "seg" });
      [5, 10, 20].forEach((n) => seg.append(el("button", {
        "aria-pressed": length === n ? "true" : "false",
        onclick: () => { length = n; store.set("quizLen", n); renderSetup(); }
      }, n + " questions")));
      panel.append(el("div", { style: "display:flex;flex-direction:column;gap:8px" }, el("span", { class: "label" }, "How many"), seg));

      const startBtn = el("button", { class: "btn primary", id: "quiz-start", onclick: start }, "Start quiz ▶");
      const msg = el("p", { class: "note", id: "quiz-msg" });
      panel.append(startBtn, msg);
      const best = store.get("best", {});
      const key = bestKey();
      if (best[key] != null) panel.append(el("p", { class: "best" }, "Best score for these chapters: " + best[key] + "%"));
      view.append(panel);
      updateStart();

      function updateStart() {
        let problem = "";
        if (!selected.size) problem = "Pick at least one chapter above.";
        else if (!types.size) problem = "Pick at least one question type.";
        else if (pool.length < 4) problem = "Pick more chapters: a quiz needs at least 4 words.";
        else if (types.size === 1 && types.has("poem") && !poemsInPool().length) problem = book().poems.length
          ? "No poems in these chapters. Year " + year + " poems are in chapter " + book().poems.map((p) => p.ch).join(", ") + "."
          : "There are no poems in Year " + year + ".";
        startBtn.disabled = !!problem;
        msg.textContent = problem;
      }
    }

    const bestKey = () => "y" + year + ":" + [...selected].sort((a, b) => a - b).join(",");
    const poemsInPool = () => book().poems.filter((p) => selected.has(p.ch));
    const allPoemLines = () => YEARS.flatMap((y) => BOOKS[y].poems.flatMap((x) => x.lines.map((l) => l[0])));

    // Pick 3 distractor words that look different from the answer on the field being asked.
    function distractors(answer, field, pool, n) {
      const sameLen = (w) => Array.from(w.zh).length === Array.from(answer.zh).length;
      const ok = (w) => w.id !== answer.id && w[field] !== answer[field] && w.en !== answer.en && w.zh !== answer.zh;
      let cands = shuffle(pool.filter(ok));
      if (cands.length < n) cands = cands.concat(shuffle(WORDS.filter((w) => w.year === answer.year && ok(w) && !cands.includes(w))));
      const preferred = cands.filter(sameLen), rest = cands.filter((w) => !sameLen(w));
      const out = [];
      for (const w of preferred.concat(rest)) {
        if (out.length >= n) break;
        if (!out.some((o) => o[field] === w[field] || o.en === w.en)) out.push(w);
      }
      return out;
    }

    function makeQuestion(type, word, pool) {
      if (type === "poem") {
        const poems = poemsInPool();
        if (!poems.length) return null;
        const p = poems[Math.floor(Math.random() * poems.length)];
        const i = Math.floor(Math.random() * (p.lines.length - 1));
        const right = p.lines[i + 1][0];
        const others = shuffle([...new Set(allPoemLines())].filter((l) => l !== right && l !== p.lines[i][0] && Array.from(l).length === Array.from(right).length)).slice(0, 3);
        if (others.length < 3) return null;
        return {
          type, word: null, poem: p, line: p.lines[i],
          options: shuffle([right, ...others]).map((t) => ({ label: t, right: t === right, zh: true })),
          answerText: right, say: p.lines[i][0] + "，" + right
        };
      }
      if (type === "blank" && !word.sent) return null;
      const field = type === "meaning" ? "en" : type === "pinyin" ? "py" : "zh";
      const opts = shuffle([word, ...distractors(word, field, pool, 3)]);
      if (opts.length < 4) return null;
      return {
        type, word,
        options: opts.map((w) => ({ label: w[field], right: w.id === word.id, zh: field === "zh", w })),
        answerText: word[field], say: word.zh
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
      const panel = el("div", { class: "panel" });
      panel.append(el("div", { class: "q-meta" },
        el("span", {}, "Question " + (qi + 1) + " of " + qs.length),
        el("span", {}, "⭐ " + score)));
      panel.append(el("div", { class: "progress", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": String(qs.length), "aria-valuenow": String(qi) },
        el("div", { style: "width:" + (qi / qs.length * 100) + "%" })));

      const prompt = el("div", { class: "q-prompt" });
      const w = q.word;
      if (q.type === "meaning") {
        prompt.append(el("div", { class: "q-ask" }, "What does this mean? ", el("span", { class: "zh" }, "这是什么意思？")), tzgRow(w.zh));
      } else if (q.type === "pinyin") {
        prompt.append(el("div", { class: "q-ask" }, "How do you say it? ", el("span", { class: "zh" }, "选出正确的拼音")), tzgRow(w.zh));
      } else if (q.type === "picture") {
        prompt.append(el("div", { class: "q-ask" }, "Which word is this? ", el("span", { class: "zh" }, "这是什么？")),
          el("div", { class: "q-pic", "aria-hidden": "true" }, w.pic), el("div", { class: "q-big-en" }, w.en));
      } else if (q.type === "listen") {
        prompt.append(el("div", { class: "q-ask" }, "Listen and pick the word. ", el("span", { class: "zh" }, "听一听")),
          el("button", { class: "listen-btn", "aria-label": "Play the word", onclick: () => speak(w.zh) }, "🔊"),
          el("div", { class: "note" }, "Tap the speaker to hear it again"));
        setTimeout(() => speak(w.zh), 250);
      } else if (q.type === "blank") {
        const i = w.sent.indexOf(w.zh);
        const s = el("div", { class: "q-sentence", lang: "zh-CN" });
        s.innerHTML = escapeHtml(w.sent.slice(0, i)) + '<span class="blank">' + "？".repeat(Array.from(w.zh).length) + "</span>" + escapeHtml(w.sent.slice(i + w.zh.length));
        prompt.append(el("div", { class: "q-ask" }, "Fill in the missing word. ", el("span", { class: "zh" }, "选词填空")), s,
          el("div", { class: "q-sentence-en" }, "Hint: the word means “" + w.en + "”"));
      } else if (q.type === "poem") {
        prompt.append(el("div", { class: "q-ask" }, "What comes next? ", el("span", { class: "zh" }, "下一句是什么？")),
          el("div", { class: "q-big-en", lang: "zh-CN", style: "font-family:var(--font-zh);font-weight:500" }, "《" + q.poem.title + "》"),
          el("div", { class: "note" }, q.poem.dynasty + " · " + q.poem.author + " · Chapter " + q.poem.ch),
          el("div", { class: "q-sentence", lang: "zh-CN" }, q.line[0] + "，"),
          el("div", { class: "q-sentence-en" }, q.line[1]));
      }
      panel.append(prompt);

      const opts = el("div", { class: "options" });
      q.options.forEach((o) => {
        const b = el("button", { class: "opt" + (o.zh ? " zh" + (Array.from(o.label).length > 3 ? " long" : "") : ""), lang: o.zh ? "zh-CN" : false }, o.label);
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
        fb.textContent = shuffle(["太棒了！Great job!", "对了！Correct!", "真聪明！So clever!", "好极了！Excellent!"])[0];
        chime(true);
      } else {
        btn.classList.add("wrong", "shake");
        fb.className = "feedback no";
        fb.innerHTML = q.word
          ? "Not quite. It's <span class=\"zh\">" + escapeHtml(q.word.zh) + "</span> " + escapeHtml(q.word.py) + " = " + escapeHtml(q.word.en)
          : "Not quite. The next line is <span class=\"zh\">" + escapeHtml(q.answerText) + "</span>";
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
      const best = store.get("best", {});
      const key = bestKey();
      const newBest = best[key] == null || pct > best[key];
      if (newBest) { best[key] = pct; store.set("best", best); }

      const panel = el("div", { class: "panel result" });
      const stars = el("div", { class: "stars", "aria-label": starCount + " out of 3 stars" });
      for (let i = 0; i < 3; i++) stars.append(el("span", { class: i < starCount ? "" : "off" }, "⭐"));
      panel.append(stars,
        el("div", { class: "score" }, score + " / " + qs.length),
        el("h2", {}, pct === 100 ? "满分！Full marks!" : pct >= 60 ? "做得好！Well done!" : "加油！Keep trying!"),
        newBest && qs.length ? el("p", { class: "best" }, "New best score for these chapters!") : null);

      const wrongWords = mistakes.filter((q) => q.word).map((q) => q.word);
      if (mistakes.length) {
        const list = el("div", { class: "review" }, el("span", { class: "label" }, "Practise these"));
        mistakes.forEach((q) => {
          if (q.word) {
            list.append(el("div", { class: "review-item" },
              el("span", { class: "zh", lang: "zh-CN" }, q.word.zh),
              el("div", { class: "info" }, el("b", {}, q.word.py + " · " + q.word.en), el("small", {}, "Chapter " + q.word.ch)),
              canSpeak ? el("button", { class: "linkish", "aria-label": "Say " + q.word.zh, onclick: () => speak(q.word.zh) }, "🔊") : null));
          } else {
            list.append(el("div", { class: "review-item" },
              el("div", { class: "info", lang: "zh-CN", style: "font-family:var(--font-zh)" },
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

    return { renderSetup };
  })();

  // ---------- tabs ----------
  function showTab(name) {
    const cards = name === "cards";
    $("#view-cards").hidden = !cards;
    $("#view-quiz").hidden = cards;
    $("#tab-cards").setAttribute("aria-selected", cards ? "true" : "false");
    $("#tab-quiz").setAttribute("aria-selected", cards ? "false" : "true");
    try { history.replaceState(null, "", "#" + name); } catch (e) { /* ignore */ }
  }
  $("#tab-cards").onclick = () => showTab("cards");
  $("#tab-quiz").onclick = () => showTab("quiz");

  renderChips();
  Cards.reset();
  Quiz.renderSetup();
  showTab(location.hash === "#quiz" ? "quiz" : "cards");
})();
