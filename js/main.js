/* =========================================================
   共通処理
   ・ハンバーガーメニュー
   ・花びらの生成
   ・お知らせ欄の描画（トップページ）
   ・誕生日カウントダウン（トップページ）
   ========================================================= */
(() => {
  'use strict';

  /* ---------- 設定 ---------- */

  // 誕生日（年・月・日）。日付はすべて日本時間で判定する
  //   〜誕生日の前日         … カウントダウン
  //   誕生日〜HB_UNTIL_DAY日 … Happy Birthday!（駅広告の掲出期間）
  //   それ以降               … お礼のメッセージ
  const BIRTHDAY = { year: 2026, month: 11, day: 19 };
  const HB_UNTIL_DAY = 22; // Happy Birthday! を表示する最後の日（誕生日と同じ月）
  const THANKS_TEXT = 'たくさんのお祝い\nありがとうございました！'; // \n の位置で改行

  // お知らせ（新しいものを上に書く）。text はそのまま文字として表示される
  // date の日（日本時間 0:00）になるまでは表示されないので、先の予定も書いておける
  const NEWS = [
    { date: '2026.11.16', text: '本日から掲出開始！' },
    { date: '2026.09.24', text: '企画サイトを公開しました！' },
    { date: '2026.09.24', text: 'お祝いメッセージを募集中です。' },
  ];

  // 花びらの数（スマホは少なめ）
  const PETAL_COUNT_PC = 12;
  const PETAL_COUNT_SP = 6;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- ハンバーガーメニュー ---------- */
  function initMenu() {
    const btn = document.querySelector('.menu-btn');
    const menu = document.getElementById('site-menu');
    const overlay = document.querySelector('.menu-overlay');
    if (!btn || !menu) return;

    const setOpen = (open) => {
      btn.setAttribute('aria-expanded', String(open));
      btn.setAttribute('aria-label', open ? 'メニューを閉じる' : 'メニューを開く');
      menu.classList.toggle('is-open', open);
      if (overlay) overlay.classList.toggle('is-open', open);
      if (open) {
        const first = menu.querySelector('a');
        if (first) first.focus();
      }
    };

    btn.addEventListener('click', () => {
      setOpen(btn.getAttribute('aria-expanded') !== 'true');
    });
    if (overlay) overlay.addEventListener('click', () => setOpen(false));
    menu.addEventListener('click', (e) => {
      if (e.target.closest('a')) setOpen(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menu.classList.contains('is-open')) {
        setOpen(false);
        btn.focus();
      }
    });
  }

  /* ---------- 花びら ---------- */
  function initPetals() {
    const layer = document.querySelector('.deco');
    if (!layer || reducedMotion) return;

    const count = window.innerWidth < 768 ? PETAL_COUNT_SP : PETAL_COUNT_PC;
    const frag = document.createDocumentFragment();
    const rand = (min, max) => min + Math.random() * (max - min);

    for (let i = 0; i < count; i++) {
      const petal = document.createElement('span');
      petal.className = 'petal';
      // 位置・大きさ・速さ・揺れ幅をばらつかせる
      petal.style.setProperty('--x', `${rand(0, 100).toFixed(1)}%`);
      petal.style.setProperty('--size', `${rand(10, 18).toFixed(0)}px`);
      petal.style.setProperty('--dur', `${rand(14, 24).toFixed(1)}s`);
      petal.style.setProperty('--delay', `${(-rand(0, 24)).toFixed(1)}s`);
      petal.style.setProperty('--sway', `${rand(-60, 60).toFixed(0)}px`);
      frag.appendChild(petal);
    }
    layer.appendChild(frag);
  }

  /* ---------- お知らせ ---------- */
  function initNews() {
    const list = document.getElementById('news-list');
    if (!list) return;

    const now = nowInJst().getTime();
    NEWS.forEach((item) => {
      // 日付（日本時間 0:00）になるまでは出さない
      const [y, m, d] = item.date.split('.').map(Number);
      if (now < Date.UTC(y, m - 1, d)) return;

      const li = document.createElement('li');
      const time = document.createElement('time');
      time.dateTime = item.date.replace(/\./g, '-');
      time.textContent = item.date;
      const text = document.createElement('span');
      text.textContent = item.text;
      li.append(time, text);
      list.appendChild(li);
    });
  }

  /* ---------- カウントダウン ---------- */
  const JST_OFFSET = 9 * 60 * 60 * 1000;

  // 表示確認用：URL に ?preview-date=2026-11-19 （時刻付きなら 2026-11-18T23:59:50）を付けると、
  // その日時（日本時間）から時計が進んでいるものとして表示する
  const previewOffset = (() => {
    const q = new URLSearchParams(location.search).get('preview-date');
    const m = q && q.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
    if (!m) return 0;
    const [, y, mo, d, h = '12', mi = '0', s = '0'] = m;
    return Date.UTC(+y, +mo - 1, +d, +h, +mi, +s) - (Date.now() + JST_OFFSET);
  })();

  // 「日本時間の今」を UTC の値として持つ Date を返す（getUTC〇〇 で日本時間が取れる）
  function nowInJst() {
    return new Date(Date.now() + JST_OFFSET + previewOffset);
  }

  function initCountdown() {
    const root = document.getElementById('countdown');
    if (!root) return;

    const label = root.querySelector('.countdown__label');
    const nums = root.querySelector('.countdown__nums');
    const hb = root.querySelector('.countdown__hb');
    const thanks = root.querySelector('.countdown__thanks');
    const el = {
      d: root.querySelector('[data-unit="d"]'),
      h: root.querySelector('[data-unit="h"]'),
      m: root.querySelector('[data-unit="m"]'),
      s: root.querySelector('[data-unit="s"]'),
    };
    const mm = String(BIRTHDAY.month).padStart(2, '0');
    const dd = String(BIRTHDAY.day).padStart(2, '0');
    const pad = (n) => String(n).padStart(2, '0');

    // 誕生日 0:00 と、お礼に切り替わる日（HB_UNTIL_DAY の翌日）0:00（どちらも日本時間）
    const birthdayStart = Date.UTC(BIRTHDAY.year, BIRTHDAY.month - 1, BIRTHDAY.day);
    const thanksStart = Date.UTC(BIRTHDAY.year, BIRTHDAY.month - 1, HB_UNTIL_DAY + 1);

    // 表示の切り替え（label / nums / hb / thanks のどれを出すか）
    const show = (part, labelText) => {
      label.hidden = !labelText;
      label.textContent = labelText || '';
      nums.hidden = part !== 'nums';
      hb.hidden = part !== 'hb';
      thanks.hidden = part !== 'thanks';
    };
    thanks.textContent = THANKS_TEXT;

    const tick = () => {
      const now = nowInJst().getTime();

      if (now >= thanksStart) {
        // 駅広告の掲出期間が終わったらお礼
        show('thanks', '');
        return;
      }
      if (now >= birthdayStart) {
        // 誕生日当日〜掲出最終日は Happy Birthday!
        const isToday = now < birthdayStart + 86400000;
        show('hb', isToday ? `今日は誕生日（${mm}/${dd}）！` : `【誕生日：${mm}/${dd}】`);
        return;
      }

      const diff = Math.floor((birthdayStart - now) / 1000);
      show('nums', `【誕生日：${mm}/${dd}】まで`);
      el.d.textContent = Math.floor(diff / 86400);
      el.h.textContent = pad(Math.floor((diff % 86400) / 3600));
      el.m.textContent = pad(Math.floor((diff % 3600) / 60));
      el.s.textContent = pad(diff % 60);
    };

    tick();
    setInterval(tick, 1000);
  }

  /* ---------- 駅広告スライドショー（トップページ） ----------
     ・一定時間ごとに次の駅広告へ。最後の次は最初に戻る（無限ループ）
     ・左右のタップ領域・スワイプ・ドットで移動
     ・無限ループのため、先頭に「最後の複製」、末尾に「最初の複製」を置き、
       複製まで動いたら、アニメーションなしで本物の位置へ瞬間移動する */
  const CAROUSEL_INTERVAL = 5000; // 自動で切り替わる間隔（ミリ秒）

  function initCarousel() {
    const root = document.querySelector('.carousel');
    if (!root) return;
    const track = root.querySelector('.carousel__track');
    const prevBtn = root.querySelector('.carousel__nav--prev');
    const nextBtn = root.querySelector('.carousel__nav--next');
    const dotsBox = root.querySelector('.carousel__dots');
    const slides = Array.from(track.children);
    const n = slides.length;
    if (n < 2) {
      prevBtn.hidden = true;
      nextBtn.hidden = true;
      return;
    }

    // 両端に複製を置く（読み上げ対象からは外す）
    const makeClone = (slide) => {
      const clone = slide.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      clone.querySelectorAll('img').forEach((img) => { img.alt = ''; });
      return clone;
    };
    track.prepend(makeClone(slides[n - 1]));
    track.append(makeClone(slides[0]));

    // 位置は 0〜n+1（0 と n+1 が複製）。本物の1枚目は 1
    let pos = 1;
    let moving = false;
    let settleTimer = null;

    const setPos = (p, animate) => {
      track.classList.toggle('is-jumping', !animate);
      track.style.setProperty('--index', String(p));
      pos = p;
      if (!animate) {
        void track.offsetWidth; // 瞬間移動を確定させてから transition を戻す
        track.classList.remove('is-jumping');
      }
    };

    // ドット
    const dots = slides.map((slide, i) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.setAttribute('aria-label', `${i + 1}枚目：${slide.getAttribute('aria-label') || ''}`);
      dot.addEventListener('click', () => { goTo(i + 1); restartAuto(); });
      dotsBox.appendChild(dot);
      return dot;
    });
    const updateDots = () => {
      const current = (pos - 1 + n) % n;
      dots.forEach((d, i) => d.setAttribute('aria-current', String(i === current)));
    };

    // 動き終わったら、複製の位置にいれば本物の位置へ瞬間移動
    const settle = () => {
      clearTimeout(settleTimer);
      if (pos === 0) setPos(n, false);
      if (pos === n + 1) setPos(1, false);
      moving = false;
    };
    track.addEventListener('transitionend', (e) => {
      if (e.target === track) settle();
    });

    function goTo(p) {
      if (moving || p === pos) return;
      moving = true;
      setPos(p, !reducedMotion);
      updateDots();
      if (reducedMotion) settle();
      // transitionend が来なかった場合（タブが裏にある等）の保険
      else settleTimer = setTimeout(settle, 800);
    }
    const next = () => goTo(pos + 1);
    const prev = () => goTo(pos - 1);

    // 自動切り替え（動きを減らす設定の人には行わない）
    let autoTimer = null;
    let hovering = false;
    const stopAuto = () => { clearInterval(autoTimer); autoTimer = null; };
    const startAuto = () => {
      if (reducedMotion || hovering || document.hidden || autoTimer) return;
      autoTimer = setInterval(next, CAROUSEL_INTERVAL);
    };
    function restartAuto() { stopAuto(); startAuto(); }

    // 左右タップ
    let justSwiped = false;
    prevBtn.addEventListener('click', () => { if (!justSwiped) { prev(); restartAuto(); } });
    nextBtn.addEventListener('click', () => { if (!justSwiped) { next(); restartAuto(); } });

    // スワイプ（横に40px以上動かしたら移動）
    let startX = 0;
    let startY = 0;
    const viewport = root.querySelector('.carousel__viewport');
    viewport.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });
    viewport.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) next(); else prev();
        restartAuto();
        justSwiped = true; // スワイプ直後のタップ判定を無視
        setTimeout(() => { justSwiped = false; }, 400);
      }
    }, { passive: true });

    // マウスを乗せている間・キーボード操作中・別タブを見ている間は止める
    root.addEventListener('mouseenter', () => { hovering = true; stopAuto(); });
    root.addEventListener('mouseleave', () => { hovering = false; startAuto(); });
    root.addEventListener('focusin', () => { hovering = true; stopAuto(); });
    root.addEventListener('focusout', () => { hovering = false; startAuto(); });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stopAuto(); else startAuto();
    });

    setPos(1, false);
    updateDots();
    startAuto();
  }

  /* ---------- 画像の拡大表示（インフォメーションのマップなど） ----------
     ・<a href="画像" data-lightbox> を押すと、ページの上に画像を大きく表示する
     ・表示中の画像をタップすると、その場所を中心に拡大。もう一度タップで元に戻る
     ・×ボタン・背景のタップ・Escキーで閉じる */
  function initLightbox() {
    const links = document.querySelectorAll('a[data-lightbox]');
    if (!links.length) return;

    const dialog = document.createElement('dialog');
    dialog.className = 'lightbox';
    dialog.setAttribute('aria-label', '画像の拡大表示');

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'lightbox__close';
    closeBtn.setAttribute('aria-label', '閉じる');
    closeBtn.textContent = '×';

    const scroller = document.createElement('div');
    scroller.className = 'lightbox__scroller';
    const img = document.createElement('img');
    img.className = 'lightbox__img';
    img.alt = '';
    scroller.appendChild(img);

    const hint = document.createElement('p');
    hint.className = 'lightbox__hint';

    dialog.append(closeBtn, scroller, hint);
    document.body.appendChild(dialog);

    let zoomed = false;
    const setZoom = (on, clientX, clientY) => {
      zoomed = on;
      hint.textContent = on ? 'もう一度タップすると元の大きさに戻ります' : '画像をタップすると拡大できます';
      if (!on) {
        dialog.classList.remove('is-zoomed');
        img.style.width = '';
        return;
      }
      // 拡大する前に、画面に合わせた大きさとタップした位置の割合を測っておく
      const r = img.getBoundingClientRect();
      const rx = (clientX - r.left) / r.width;
      const ry = (clientY - r.top) / r.height;
      // 画面に合わせた大きさの2.5倍か、画像の元の大きさの、大きいほうまで拡大
      const width = Math.max(img.naturalWidth || 0, r.width * 2.5);
      dialog.classList.add('is-zoomed');
      img.style.width = `${Math.round(width)}px`;
      // タップした位置が画面の中央に来るようにスクロール
      const nr = img.getBoundingClientRect();
      scroller.scrollLeft = rx * nr.width - scroller.clientWidth / 2;
      scroller.scrollTop = ry * nr.height - scroller.clientHeight / 2;
    };

    const close = () => {
      if (dialog.open) dialog.close();
    };
    dialog.addEventListener('close', () => {
      document.documentElement.classList.remove('is-lightbox-open');
      setZoom(false);
    });
    closeBtn.addEventListener('click', close);

    // 画像をタップ：拡大／元に戻す。画像の外（暗い背景）をタップ：閉じる
    // （拡大中に指でなぞって動かしたときは、タップとして扱わない）
    let downX = 0;
    let downY = 0;
    scroller.addEventListener('pointerdown', (e) => {
      downX = e.clientX;
      downY = e.clientY;
    });
    scroller.addEventListener('click', (e) => {
      if (Math.abs(e.clientX - downX) > 8 || Math.abs(e.clientY - downY) > 8) return;
      if (e.target === img) setZoom(!zoomed, e.clientX, e.clientY);
      else if (!zoomed) close();
    });

    links.forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const thumb = link.querySelector('img');
        img.src = link.href;
        img.alt = thumb ? thumb.alt : '';
        setZoom(false);
        document.documentElement.classList.add('is-lightbox-open'); // 後ろのページをスクロールさせない
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else window.open(link.href, '_blank');
      });
    });
  }

  /* ---------- 起動 ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    initLightbox();
    initCarousel();
    initMenu();
    initPetals();
    initNews();
    initCountdown();
  });
})();
