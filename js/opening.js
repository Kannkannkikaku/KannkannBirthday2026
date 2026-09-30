/* =========================================================
   トップページのオープニング演出（index.html だけで読み込む）
   ---------------------------------------------------------
   ・見た目と時間配分は css/opening.css
   ・<body> の直後で読み込み、トップページが描かれる前に幕を出す
     （末尾で読み込むと、一瞬トップ画面が見えてから暗転してしまうため）
   ・同じ訪問中（タブを閉じるまで）は自動では1回だけ表示
   ・「オープニングをもう一度見る」ボタン（data-opening-replay）で何度でも再生
   ・画面のどこかをタップ／スキップボタン／Escキーで、すぐに終了
   ・動きを減らす設定（prefers-reduced-motion）の人には表示しない
   ========================================================= */
(() => {
  'use strict';

  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // スポットライト：外側から内側へ、左右交互に点灯（ペンライトと同じ6色）
  // [画面の横位置(%), 色]
  const SPOTS = [[12, '#7cc8ff'], [88, '#ff8fb3'], [27, '#ffd84a'], [73, '#ff4d5e'], [41, '#ffffff'], [59, '#3f6dff']];

  // 一番端のライトを内側へ傾ける角度（度）。内側のライトほど傾きは小さくなる
  const EDGE_TILT_DEG = 20;

  let removeTimer = null;
  let onKey = null;

  // 表示中の幕を取り除く
  function removeOpening() {
    clearTimeout(removeTimer);
    if (onKey) document.removeEventListener('keydown', onKey);
    onKey = null;
    const old = document.getElementById('kkOpening');
    if (old) old.remove();
  }

  // オープニングを最初から再生する
  function playOpening() {
    if (reducedMotion()) return;
    removeOpening();

    const op = document.createElement('div');
    op.id = 'kkOpening';
    op.className = 'op';
    op.setAttribute('aria-hidden', 'true');
    // 中身は固定の文字だけ（外から入ってくるデータは含まない）
    op.innerHTML = `<p class="op-call">まもなく開演です</p><div class="op-beams"></div><div class="op-flash"></div>
      <div class="op-title"><span>KAN KANNA BIRTHDAY 2026</span><strong>菅叶和さん<br>お誕生日企画2026</strong></div>
      <button class="op-skip" type="button">スキップ</button>`;

    const beams = op.querySelector('.op-beams');
    // 「＼＼｜／／」のように、外側ほど内側へ傾け、光の先は下で横に広がるようにする。
    // 6本とも画面の横中央のずっと下の一点へ向け、その深さは「一番端のライトがちょうど
    // EDGE_TILT_DEG 度になる」ように決める（画面の大きさに関係なく同じ角度になる）
    const edgeOffset = Math.max(...SPOTS.map(([x]) => Math.abs(50 - x))); // 中央から一番端のライトまで（%）
    const edgeTan = Math.tan((EDGE_TILT_DEG * Math.PI) / 180);
    SPOTS.forEach(([x, col], i) => {
      const d = `${1.6 + i * 0.3}s`; // 点灯するまでの時間（0.3秒ずつずらす）
      // 中央からの距離に比例して傾ける（端＝EDGE_TILT_DEG、中央に近いほど小さい）。
      // CSS の rotate はプラスで時計回り（先端が左へ）なので、右へ向けるときはマイナス
      const tilt = (Math.atan(((50 - x) / edgeOffset) * edgeTan) * 180) / Math.PI;
      const a = `${-tilt}deg`;
      beams.insertAdjacentHTML('beforeend',
        `<i class="op-beam" style="--x:${x}%;--col:${col};--a:${a};--d:${d}"></i>` +
        `<i class="op-lamp" style="--x:${x}%;--col:${col};--d:${d}"></i>`);
    });

    // すぐに終了（フェードアウトしてから取り除く）
    const skip = () => {
      if (!op.isConnected || op.classList.contains('skip')) return;
      op.classList.add('skip');
      clearTimeout(removeTimer);
      removeTimer = setTimeout(removeOpening, 450);
    };
    onKey = (e) => {
      if (e.key === 'Escape') skip();
    };
    op.addEventListener('click', skip); // スキップボタンも含め、どこをタップしても終了
    document.addEventListener('keydown', onKey);

    document.body.appendChild(op);

    // 最後まで見たら取り除く（フェードアウトは 6.9 秒で終わる）
    removeTimer = setTimeout(removeOpening, 7200);
  }

  // 「もう一度見る」ボタン（ボタンはこのファイルより後に出てくるので、document で受け取る）
  document.addEventListener('click', (e) => {
    if (e.target.closest && e.target.closest('[data-opening-replay]')) playOpening();
  });

  // 同じ訪問中は、自動では1回だけ（ストレージが使えない環境でも動くよう try/catch）
  let seen = false;
  try {
    seen = sessionStorage.getItem('kkOpSeen') === '1';
    sessionStorage.setItem('kkOpSeen', '1');
  } catch (e) { /* 使えない場合は毎回表示 */ }
  if (!seen) playOpening();
})();
