/* =========================================================
   メッセージページの背景「ペンライトの海」（pages/message/index.html だけで読み込む）
   ---------------------------------------------------------
   ・.live-bg の中にペンライトを約260本並べる。見た目は css/live-bg.css
   ・画面の下ほど手前（大きく）、上ほど奥（小さく）
   ・揺れのリズムはほぼ揃える（周期 0.85〜0.95秒、ずれ 0〜0.35秒）
   ========================================================= */
(() => {
  'use strict';

  const PEN_COUNT = 260;
  // 色は css/live-bg.css の CSS 変数を使う
  const PEN_COLORS = ['red', 'white', 'yellow', 'blue', 'sky', 'pink'].map((c) => `var(--pen-${c})`);

  const rand = (min, max) => min + Math.random() * (max - min);
  const pick = (list) => list[Math.floor(Math.random() * list.length)];

  function initLiveBg() {
    const bg = document.getElementById('live-bg');
    if (!bg) return;

    const frag = document.createDocumentFragment();
    for (let i = 0; i < PEN_COUNT; i++) {
      // y：0＝奥（画面の38%の高さ）〜 1＝手前（画面の下端）。手前ほど少し多めに
      const y = Math.pow(Math.random(), 0.8);
      const w = 1.5 + y * 4.5; // 太さ：奥 1.5px 〜 手前 6px
      const pen = document.createElement('i');
      pen.className = 'pen';
      pen.style.cssText =
        `top:${38 + y * 62}%;left:${rand(-2, 100)}%;` +
        `--w:${w}px;--h:${w * 4.5}px;--pc:${pick(PEN_COLORS)};` +
        `--t:${rand(0.85, 0.95)}s;--delay:-${rand(0, 0.35)}s`;
      frag.appendChild(pen);
    }
    bg.appendChild(frag);
  }

  document.addEventListener('DOMContentLoaded', initLiveBg);
})();
