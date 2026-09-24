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

  // 誕生日（月・日）。日本時間の0:00〜23:59を「当日」とみなす
  const BIRTHDAY = { month: 11, day: 19 };

  // お知らせ（新しいものを上に書く）。text はそのまま文字として表示される
  const NEWS = [
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

    NEWS.forEach((item) => {
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

  // 「日本時間の今」を UTC の値として持つ Date を返す（getUTC〇〇 で日本時間が取れる）
  function nowInJst() {
    return new Date(Date.now() + JST_OFFSET);
  }

  function initCountdown() {
    const root = document.getElementById('countdown');
    if (!root) return;

    const label = root.querySelector('.countdown__label');
    const nums = root.querySelector('.countdown__nums');
    const hb = root.querySelector('.countdown__hb');
    const el = {
      d: root.querySelector('[data-unit="d"]'),
      h: root.querySelector('[data-unit="h"]'),
      m: root.querySelector('[data-unit="m"]'),
      s: root.querySelector('[data-unit="s"]'),
    };
    const mm = String(BIRTHDAY.month).padStart(2, '0');
    const dd = String(BIRTHDAY.day).padStart(2, '0');
    const pad = (n) => String(n).padStart(2, '0');

    const tick = () => {
      const jst = nowInJst();
      const y = jst.getUTCFullYear();
      const isToday = jst.getUTCMonth() + 1 === BIRTHDAY.month && jst.getUTCDate() === BIRTHDAY.day;

      if (isToday) {
        // 当日は Happy Birthday! に切り替え
        label.textContent = `今日は誕生日（${mm}/${dd}）！`;
        nums.hidden = true;
        hb.hidden = false;
        return;
      }

      // 次の誕生日（日本時間 0:00）。今年の分が過ぎていたら来年
      let target = Date.UTC(y, BIRTHDAY.month - 1, BIRTHDAY.day);
      if (target <= jst.getTime()) target = Date.UTC(y + 1, BIRTHDAY.month - 1, BIRTHDAY.day);

      const diff = Math.max(0, Math.floor((target - jst.getTime()) / 1000));
      label.textContent = `【誕生日：${mm}/${dd}】まで`;
      nums.hidden = false;
      hb.hidden = true;
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

  /* ---------- 起動 ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    initCarousel();
    initMenu();
    initPetals();
    initNews();
    initCountdown();
  });
})();
