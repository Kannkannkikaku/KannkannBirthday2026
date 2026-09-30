/* =========================================================
   トップページのオープニング演出（index.html だけで読み込む）
   ---------------------------------------------------------
   ・見た目と時間配分は css/opening.css
   ・<body> の直後で読み込み、トップページが描かれる前に幕を出す
     （末尾で読み込むと、一瞬トップ画面が見えてから暗転してしまうため）
   ・同じ訪問中（タブを閉じるまで）は1回だけ表示
   ・画面のどこかをタップ／スキップボタン／Escキーで、すぐに終了
   ・動きを減らす設定（prefers-reduced-motion）の人には表示しない
   ========================================================= */
(() => {
  'use strict';

  // 同じ訪問中は1回だけ（ストレージが使えない環境でも動くよう try/catch）
  let seen = false;
  try {
    seen = sessionStorage.getItem('kkOpSeen') === '1';
    sessionStorage.setItem('kkOpSeen', '1');
  } catch (e) { /* 使えない場合は毎回表示 */ }
  if (seen) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const op = document.createElement('div');
  op.id = 'kkOpening';
  op.className = 'op';
  op.setAttribute('aria-hidden', 'true');
  // 中身は固定の文字だけ（外から入ってくるデータは含まない）
  op.innerHTML = `<p class="op-call">まもなく開演です</p><div class="op-beams"></div><div class="op-flash"></div>
    <div class="op-title"><span>KAN KANNA BIRTHDAY 2026</span><strong>菅叶和さん<br>お誕生日企画2026</strong></div>
    <button class="op-skip" type="button">スキップ</button>`;

  // スポットライト：外側から内側へ、左右交互に点灯（ペンライトと同じ6色）
  // [画面の横位置(%), 色]
  const spots = [[12, '#7cc8ff'], [88, '#ff8fb3'], [27, '#ffd84a'], [73, '#ff4d5e'], [41, '#ffffff'], [59, '#3f6dff']];
  const beams = op.querySelector('.op-beams');
  spots.forEach(([x, col], i) => {
    const d = `${1.6 + i * 0.3}s`; // 点灯するまでの時間（0.3秒ずつずらす）
    const a = `${(x - 50) * 0.55}deg`; // 画面中央へ向ける角度
    beams.insertAdjacentHTML('beforeend',
      `<i class="op-beam" style="--x:${x}%;--col:${col};--a:${a};--d:${d}"></i>` +
      `<i class="op-lamp" style="--x:${x}%;--col:${col};--d:${d}"></i>`);
  });

  // すぐに終了（フェードアウトしてから取り除く）
  const skip = () => {
    if (!op.isConnected) return;
    op.classList.add('skip');
    setTimeout(() => op.remove(), 450);
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e) => {
    if (e.key === 'Escape') skip();
  };
  op.addEventListener('click', skip); // スキップボタンも含め、どこをタップしても終了
  document.addEventListener('keydown', onKey);

  document.body.appendChild(op);

  // 最後まで見たら取り除く（フェードアウトは 6.9 秒で終わる）
  setTimeout(() => {
    op.remove();
    document.removeEventListener('keydown', onKey);
  }, 7200);
})();
