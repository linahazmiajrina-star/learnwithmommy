# Learn with Mommy

Flashcards and quizzes for Malaysian primary school subjects. Pick a subject on the home screen, then the year and chapters.

| Subject | Years | Source |
|---|---|---|
| Chinese 华文 | 1–6 | the free pinyin + English editions at [multilingual-malaysian.github.io/SRJKC_resources](https://multilingual-malaysian.github.io/SRJKC_resources/) |
| English | 1 | *Super Minds 1* (Cambridge University Press), the Year 1 textbook: starter + 9 units, 143 words, meanings in Bahasa Melayu |
| Science, Jawi, Bahasa Arab, Aqidah, Adab, Ibadah, Sirah, Al-Quran, Agama Islam, Sejarah | – | coming soon |

**Chinese** (SRJKC Bahasa Cina Tahun 1–6):

| Year | Chapters | Words | Poems |
|---|---|---|---|
| 1 一年级 | 22 | 274 | 9 |
| 2 二年级 | 22 | 296 | 9 |
| 3 三年级 | 20 | 280 | 10 |
| 4 四年级 | 20 | 284 | 9 |
| 5 五年级 | 20 | 283 | 10 |
| 6 六年级 | 20 | 282 | 1 |

- **Cards** – the key words of each chapter. Chinese cards show the word in 田字格 boxes with pinyin; English cards show the word
  in big letters with its Bahasa Melayu meaning. Tap to flip for the meaning and a sentence from the textbook. 🔊 reads it aloud.
  Mark words "I know it" to hide them.
- **Quiz** – 5, 10 or 20 questions from the chapters you pick: meaning, picture → word, listen → word, fill in the blank
  (sentences from the book), plus pinyin and the next line of the Tang poems (古诗) for Chinese, and the missing letter for English.
  Mistakes can be practised again as flashcards.
- **Test 模拟考** (Chinese, `exam.html`) – a practice exam for the units you pick, grouped into sections like a school paper:
拼音, 认字 (listen), 看图, 填空, 量词, 部首, 反义词, 排列句子 (tap the words into order) and 古诗. It gives a score out of 100,
stars, and a list of mistakes to redo. Measure words, radicals and opposites are common lower-primary skills kept in `exam.html`,
not tied to a unit.

Progress (known words, best scores) is saved in the browser only, separately for each subject.

## Play it

Open `index.html` in a browser, or turn on GitHub Pages: **Settings → Pages → Deploy from a branch**, choose this branch and `/ (root)`.

## Install it as an app

The GitHub Pages site can be installed like an app, with its own icon, full screen and working offline:

- **iPhone / iPad:** open the site in Safari, tap Share ⬆︎ → **Add to Home Screen**.
- **Android / Chrome / Edge:** tap **📲 Install as an app** at the bottom of the page, or the browser menu → **Install app**.

`sw.js` keeps a copy of every file on the device. After you push a change, an installed app picks it up
the second time it is opened (the first open downloads it in the background). If you add a new file, list it in `SHELL` in `sw.js`.
The icons in `icons/` are plain PNGs; replace them with the same sizes to change the look.

## Edit the words

- `js/subjects.js` – the subjects on the home screen and how each one looks and sounds.
- `js/data/chinese/yearN.js` – `[Chinese, pinyin, English, picture emoji, example sentence]`.
  Years 2–6 words were picked from each lesson's text; pinyin comes from a dictionary and the English is short and kid-friendly,
  so a few entries may need a small fix.
- `js/data/english/year1.js` – `[English, Bahasa Melayu, picture emoji, example sentence]`.

## Add a new book

1. Make `js/data/<subject>/yearN.js` (copy `js/data/english/year1.js` and change `addBook("english", 1, ...)` to the subject id
   and year, for example `addBook("jawi", 1, ...)`). The subject ids are in `js/subjects.js`.
2. Add a `<script src="js/data/<subject>/yearN.js"></script>` line to `index.html`, next to the others.
3. Add the file to `SHELL` in `sw.js` so it works offline.

The subject's tile on the home screen turns on by itself once it has a book. For a language written right to left
(Jawi, Bahasa Arab), the subject already has `dir: "rtl"`; set `lang` to the language the words should be read aloud in.
