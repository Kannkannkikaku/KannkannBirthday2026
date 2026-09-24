/* =========================================================
   メッセージカードを流す処理
   ---------------------------------------------------------
   使い方（HTML側）:
     <div class="flow" data-message-flow
          data-src="data/messages.json"   … 読み込むJSON
          data-lanes="3"                  … PCのレーン数
          data-lanes-sp="2"               … スマホのレーン数
          data-per-lane="10"              … PCで1セットに並べる枚数（上限）
          data-per-lane-sp="8"            … スマホで1セットに並べる枚数（上限）
          data-durations="60,70,65"       … 各レーンが1周する秒数
          data-jitter="40"></div>          … 縦ずれの最大px（PC）

   しくみ:
     .lane > .track > .set(A) + .set(B)
     ・カード同士のすき間はランダムだが、1セット内の合計は「枚数 × --gap-avg」に固定
       → .set の幅は常に同じ → .track 全体の50%＝1セット分
     ・CSS の @keyframes で translateX(0 → -50%) を繰り返す（JSでは座標を動かさない）
     ・1周するたびに（animationiteration）先頭のセットAを末尾へ移し、
       次のメッセージで中身を入れ替える。
       ループの瞬間に画面に見えているのはセットBの頭なので、
       B を先頭に回せば見た目は一切変わらず、A（画面外）だけ入れ替わる。
     → 数百件あっても DOM 上のカードは「レーン数 × 2セット × 上限枚数」だけ
   ========================================================= */
const MessageFlow = (() => {
  'use strict';

  const COLORS = ['pink', 'blue', 'purple'];
  const mqPc = window.matchMedia('(min-width: 768px)');
  const mqReduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  // カード要素 → メッセージデータ（モーダル表示用）
  const cardData = new WeakMap();

  /* ---------- データ読み込み ---------- */
  // Googleスプレッドシートの「掲載用」シートを「ウェブに公開」した CSV の URL。
  // 設定すると、スプレッドシートでチェックを入れるだけでサイトに反映される（数分の遅れあり）。
  // 空欄のとき・読み込みに失敗したときは data/messages.json を表示する。
  const SHEET_CSV_URL =
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ0SyaftCDA7AcyWKP4jvP1vMd_7V3jKsxBO_ADEYpH787EG9fHVDkHcQOdN37VrxscdVpFPdNJJY5z/pub?gid=0&single=true&output=csv';

  const cache = new Map();

  // 形をそろえ、本文が空のものは除外
  function normalize(data) {
    if (!Array.isArray(data)) throw new Error('メッセージデータが配列ではありません');
    return data
      .map((m, i) => ({
        id: m && m.id != null ? m.id : i + 1,
        name: String((m && m.name) || '').trim(),
        message: String((m && m.message) || '').replace(/\r\n?/g, '\n').trim(),
      }))
      .filter((m) => m.message !== '');
  }

  function fetchJson(src) {
    return fetch(src, { cache: 'no-cache' }).then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    });
  }

  // 公開CSVを読み込み、js/csv.js でメッセージ配列に変換
  // （「掲載」列が含まれていれば、チェック済みの行だけになる）
  function fetchSheet(url) {
    if (!window.CsvToJson) return Promise.reject(new Error('js/csv.js が読み込まれていません'));
    return fetch(url, { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((text) => {
        // 見出し行だけ（まだ掲載するものがない）なら 0 件
        if (window.CsvToJson.parseCsv(text).length < 2) return [];
        return window.CsvToJson.convert(text);
      });
  }

  function loadMessages(src) {
    const key = SHEET_CSV_URL || src;
    if (!cache.has(key)) {
      const p = SHEET_CSV_URL
        ? fetchSheet(SHEET_CSV_URL).catch((err) => {
            console.warn('スプレッドシートを読み込めなかったため messages.json を表示します', err);
            return fetchJson(src);
          })
        : fetchJson(src);
      cache.set(key, p.then(normalize));
    }
    return cache.get(key);
  }

  /* ---------- 小道具 ---------- */
  // 配列をシャッフル（フィッシャー–イェーツ法。元の配列は変更しない）
  function shuffle(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const rand = (min, max) => min + Math.random() * (max - min);

  /**
   * カード同士のすき間を n 個ランダムに作る（整数px）
   * ・1つ1つは平均の 0.2〜2.8 倍くらいでばらつく
   * ・合計は必ず「n × 平均」ぴったり → セットの幅が毎回同じになり、ループが途切れない
   */
  function randomGaps(n, avg) {
    const min = Math.round(avg * 0.2);
    const total = Math.round(n * avg);
    const raw = Array.from({ length: n }, () => rand(min, avg * 2.8));
    // 最小値は保ったまま、合計が total になるよう伸び縮みさせる
    const extra = raw.reduce((s, g) => s + (g - min), 0) || 1;
    const gaps = raw.map((g) => Math.round(min + ((g - min) * (total - n * min)) / extra));
    // 四捨五入で生じた誤差を、いちばん広いすき間で調整
    const diff = total - gaps.reduce((s, g) => s + g, 0);
    const widest = gaps.indexOf(Math.max(...gaps));
    gaps[widest] += diff;
    return gaps;
  }

  /* ---------- カード生成 ---------- */
  // 本文・名前は textContent で入れる（innerHTML は使わない＝XSS対策）
  function createCard(msg) {
    const card = document.createElement('article');
    card.className = `card card--${COLORS[msg.color % COLORS.length]}`;

    const text = document.createElement('p');
    text.className = 'card__text';
    text.textContent = msg.message;
    card.appendChild(text);

    if (msg.name) {
      const name = document.createElement('p');
      name.className = 'card__name';
      name.textContent = msg.name;
      card.appendChild(name);
    }
    return card;
  }

  // クリック/タップ/Enter でモーダルが開くカード
  function createInteractiveCard(msg) {
    const card = createCard(msg);
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-haspopup', 'dialog');
    card.dataset.messageCard = '';
    cardData.set(card, msg);
    return card;
  }

  /* ---------- 1本のレーン ---------- */
  class Lane {
    /**
     * @param {Array} queue    このレーンが担当するメッセージ
     * @param {Object} opts    perLane, duration, jitter, gapAvg, reduced
     */
    constructor(queue, opts) {
      this.queue = queue;
      this.cursor = 0;
      this.opts = opts;

      this.el = document.createElement('div');
      this.el.className = 'lane';
      this.track = document.createElement('div');
      this.track.className = 'track';
      this.el.appendChild(this.track);

      if (opts.reduced) {
        // 動きを減らす設定：自動で流さず、全件を1列に並べて横スクロールで読む
        this.track.appendChild(this.buildSet(queue));
        return;
      }

      this.track.style.setProperty('--dur', `${opts.duration}s`);
      this.track.append(this.buildSet(this.nextBatch()), this.buildSet(this.nextBatch()));

      // 1周ごとにセットを入れ替える
      this.track.addEventListener('animationiteration', (e) => {
        if (e.target === this.track) this.rotate();
      });
    }

    // 次に並べる perLane 件を取り出す（足りなければ先頭に戻って繰り返す）
    nextBatch() {
      const out = [];
      for (let i = 0; i < this.opts.perLane; i++) {
        if (this.cursor >= this.queue.length) {
          // 全件を一巡したら先頭へ。件数が多ければ並べ替えて変化をつける
          this.cursor = 0;
          if (this.queue.length > this.opts.perLane * 2) this.queue = shuffle(this.queue);
        }
        out.push(this.queue[this.cursor]);
        this.cursor++;
      }
      return out;
    }

    buildSet(items) {
      const set = document.createElement('div');
      set.className = 'set';
      this.fillSet(set, items);
      return set;
    }

    // セットの中身を作り直す。カードごとに縦位置と右側のすき間をランダムにする
    fillSet(set, items) {
      const frag = document.createDocumentFragment();
      const { jitter, reduced, gapAvg } = this.opts;
      const gaps = reduced ? null : randomGaps(items.length, gapAvg);
      items.forEach((msg, i) => {
        const slot = document.createElement('div');
        slot.className = 'slot';
        const card = createInteractiveCard(msg);
        if (!reduced) {
          slot.style.setProperty('--gap', `${gaps[i]}px`);
          card.style.setProperty('--dy', `${rand(-jitter, jitter).toFixed(0)}px`);
        }
        slot.appendChild(card);
        frag.appendChild(slot);
      });
      set.replaceChildren(frag);
    }

    // ループの瞬間：画面に見えているセットB（2番目）を先頭へ回し、
    // 画面外へ出たセットAを新しいメッセージで作り直す
    rotate() {
      const first = this.track.firstElementChild;
      this.track.appendChild(first);
      this.fillSet(first, this.nextBatch());
    }
  }

  /* ---------- 流れるエリア全体 ---------- */
  async function mount(container) {
    const ds = container.dataset;
    const nums = (v, def) => (v ? v.split(',').map(Number).filter((n) => n > 0) : def);
    const opts = {
      src: ds.src || 'data/messages.json',
      lanes: Number(ds.lanes) || 3,
      lanesSp: Number(ds.lanesSp) || 2,
      perLane: Number(ds.perLane) || 10,
      perLaneSp: Number(ds.perLaneSp) || 8,
      durations: nums(ds.durations, [60, 70, 65]),
      jitter: Number(ds.jitter) || 40,
    };

    const setStatus = (text) => {
      const p = document.createElement('p');
      p.className = 'flow__status';
      p.textContent = text;
      container.replaceChildren(p);
    };

    setStatus('メッセージを読み込み中…');

    let messages;
    try {
      messages = await loadMessages(opts.src);
    } catch (err) {
      console.error(err);
      setStatus('メッセージを読み込めませんでした。時間をおいて再読み込みしてください。');
      return null;
    }
    if (messages.length === 0) {
      setStatus('メッセージは準備中です。');
      return null;
    }

    // 読み込むたびにシャッフルし、色（ピンク→水色→紫）を順番に割り当てる
    const list = shuffle(messages).map((m, i) => ({ ...m, color: i % COLORS.length }));

    const render = () => {
      const isPc = mqPc.matches;
      const laneCount = Math.min(isPc ? opts.lanes : opts.lanesSp, list.length);
      const perLane = isPc ? opts.perLane : opts.perLaneSp;
      // スマホはレーン間が狭いので縦ずれを控えめに
      const jitter = isPc ? opts.jitter : Math.round(opts.jitter * 0.6);
      // カード同士の平均のすき間（css の --gap-avg。PC・スマホ・トップの縮小版で異なる）
      const gapAvg = parseFloat(getComputedStyle(container).getPropertyValue('--gap-avg')) || 40;

      // 各レーンへ均等に振り分け
      // レーン数と色数が同じ（3）だと1レーンが1色になってしまうため、
      // 色はレーンの中での順番とレーン番号から決め直す
      const buckets = Array.from({ length: laneCount }, () => []);
      list.forEach((m, i) => {
        const lane = i % laneCount;
        const pos = buckets[lane].length;
        buckets[lane].push({ ...m, color: (pos + lane) % COLORS.length });
      });

      const frag = document.createDocumentFragment();
      buckets.forEach((queue, i) => {
        const lane = new Lane(queue, {
          perLane,
          duration: opts.durations[i % opts.durations.length],
          jitter,
          gapAvg,
          reduced: mqReduced.matches,
        });
        frag.appendChild(lane.el);
      });
      container.replaceChildren(frag);
    };

    render();
    // PC⇔スマホの切り替えや、動きを減らす設定の変更時に作り直す
    mqPc.addEventListener('change', render);
    mqReduced.addEventListener('change', render);

    return { messages: list };
  }

  /* ---------- 一覧（グリッド）表示 ---------- */
  function renderGrid(grid, messages) {
    const frag = document.createDocumentFragment();
    messages.forEach((m) => frag.appendChild(createInteractiveCard(m)));
    grid.replaceChildren(frag);
  }

  function initGridToggle(btn, flow, controller) {
    const grid = document.getElementById(btn.getAttribute('aria-controls'));
    if (!grid || !controller) {
      btn.hidden = true;
      return;
    }
    let built = false;

    btn.addEventListener('click', () => {
      const toGrid = grid.hidden;
      if (toGrid && !built) {
        renderGrid(grid, controller.messages);
        built = true;
      }
      grid.hidden = !toGrid;
      flow.hidden = toGrid;
      btn.setAttribute('aria-pressed', String(toGrid));
      btn.textContent = toGrid ? '流れる表示に戻る' : '一覧で読む';
      window.scrollTo({ top: 0 });
    });
  }

  /* ---------- モーダル ---------- */
  let modal = null;

  function getModal() {
    if (modal) return modal;

    const dialog = document.createElement('dialog');
    dialog.className = 'modal';
    dialog.setAttribute('aria-label', 'お祝いメッセージ');

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'modal__close';
    closeBtn.setAttribute('aria-label', '閉じる');
    closeBtn.textContent = '×';
    // 閉じたら流れを再開
    const close = () => {
      if (dialog.open) dialog.close();
      document.body.classList.remove('is-paused');
    };
    closeBtn.addEventListener('click', close);

    // 背景（カードの外側）をクリックしたら閉じる
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) close();
    });
    // Escキーで閉じたときも close イベントで再開
    dialog.addEventListener('close', close);

    dialog.appendChild(closeBtn);
    document.body.appendChild(dialog);
    modal = { dialog, closeBtn };
    return modal;
  }

  function openModal(msg) {
    const { dialog, closeBtn } = getModal();
    const card = createCard(msg);
    card.classList.add('modal__card');
    dialog.replaceChildren(closeBtn, card);

    // 表示中は全レーン停止
    document.body.classList.add('is-paused');
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
    closeBtn.focus();
  }

  // カードのクリック・キー操作は document でまとめて受け取る（イベント委譲）
  function initCardEvents() {
    document.addEventListener('click', (e) => {
      const card = e.target.closest('[data-message-card]');
      if (card && cardData.has(card)) openModal(cardData.get(card));
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const card = e.target.closest && e.target.closest('[data-message-card]');
      if (card && cardData.has(card)) {
        e.preventDefault();
        openModal(cardData.get(card));
      }
    });
  }

  /* ---------- 起動 ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    initCardEvents();
    document.querySelectorAll('[data-message-flow]').forEach(async (flow) => {
      const controller = await mount(flow);
      const btn = document.querySelector(`[data-grid-toggle="${flow.id}"]`);
      if (btn) initGridToggle(btn, flow, controller);
    });
  });

  return { mount, loadMessages };
})();
