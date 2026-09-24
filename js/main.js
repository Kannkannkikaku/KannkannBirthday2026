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

  /* ---------- 起動 ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    initMenu();
    initPetals();
    initNews();
    initCountdown();
  });
})();
