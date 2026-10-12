/* The subjects on the home screen, in order. A subject shows as "coming soon" until it has a book.
 *
 * To add a book: make js/data/<subject id>/yearN.js that calls addBook("<subject id>", N, {...})
 * (copy js/data/english/year1.js), then add it to index.html (a <script> line) and to SHELL in sw.js.
 *
 * Settings a subject can have (all optional except id and name):
 *   icon      big letter or emoji on its home tile; hue = tile colour (0–360)
 *   title     heading on the subject's page (default: name)
 *   lang      language the words are read aloud in ("zh-CN", "en-GB", "ar", "ms-MY" ...)
 *   voice     language name for the "no voice" tip
 *   dir       "rtl" for Jawi and Arabic words
 *   font      CSS font for the words
 *   fields    order of the parts in each word list entry
 *   helper    name of the "how to say it" line (pinyin, rumi ...), or null
 *   meaning   language of the meaning line
 *   unit      what the book calls a chapter
 *   boxes     true to draw each character in a 田字格 box (Chinese)
 *   letters   true to add the "missing letter" quiz (languages written in ABC)
 *   local     the UI words in the subject's own language, shown next to the English
 *   cheer     what the quiz says when the child gets it right
 */
window.BOOKS = {};
function addBook(subject, year, book) {
  (window.BOOKS[subject] = window.BOOKS[subject] || {})[year] = book;
}

window.SUBJECTS = [
  {
    id: "chinese", name: "Chinese", sub: "Bahasa Cina · 华文", icon: "华", hue: 4, title: "学华文",
    lang: "zh-CN", voice: "Chinese (Mandarin)", font: "var(--font-zh)", boxes: true,
    fields: ["term", "helper", "meaning", "pic", "sent"], helper: "Pinyin", meaning: "English",
    credit: 'Words, pinyin and sentences from the free <a href="https://multilingual-malaysian.github.io/SRJKC_resources/" target="_blank" rel="noopener">SRJKC Resources pinyin editions (Years 1–6)</a>.',
    local: {
      cards: "闪卡", quiz: "测验", year: "年级", chapters: "单元",
      meaning: "看字选意思", helper: "看字选拼音", picture: "看图选字", listen: "听音选字", blank: "选词填空", poem: "古诗接龙",
      askMeaning: "这是什么意思？", askHelper: "选出正确的拼音", askPicture: "这是什么？", askListen: "听一听", askBlank: "选词填空", askPoem: "下一句是什么？",
      quizTitle: "测验"
    },
    cheer: { right: ["太棒了！Great job!", "对了！Correct!", "真聪明！So clever!", "好极了！Excellent!"], full: "满分！Full marks!", good: "做得好！Well done!", more: "加油！Keep trying!", allKnown: "太棒了！" }
  },
  {
    id: "english", name: "English", sub: "Bahasa Inggeris", icon: "Aa", hue: 212,
    lang: "en-GB", voice: "English", letters: true, unit: "Unit",
    fields: ["term", "meaning", "pic", "sent"], helper: null, meaning: "Bahasa Melayu",
    credit: "Words and sentences from <i>Super Minds 1</i> (Cambridge University Press), the Year 1 English textbook. Meanings in Bahasa Melayu."
  },
  { id: "science", name: "Science", sub: "Sains", icon: "🔬", hue: 140 },
  { id: "jawi", name: "Jawi", sub: "Tulisan Jawi", icon: "ج", hue: 28, dir: "rtl" },
  { id: "arabic", name: "Bahasa Arab", sub: "Arabic", icon: "ع", hue: 45, lang: "ar", dir: "rtl" },
  { id: "aqidah", name: "Aqidah", sub: "Akidah", icon: "🌙", hue: 250 },
  { id: "adab", name: "Adab", sub: "Akhlak", icon: "🤝", hue: 330 },
  { id: "ibadah", name: "Ibadah", sub: "Ibadat", icon: "🤲", hue: 175 },
  { id: "sirah", name: "Sirah", sub: "Sirah Nabawiyah", icon: "📜", hue: 35 },
  { id: "quran", name: "Al-Quran", sub: "Tilawah & hafazan", icon: "📖", hue: 155 },
  { id: "islam", name: "Agama Islam", sub: "Pendidikan Islam", icon: "🕌", hue: 190 },
  { id: "sejarah", name: "Sejarah", sub: "History", icon: "🏛️", hue: 15 }
];
