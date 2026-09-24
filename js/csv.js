/* =========================================================
   CSV → メッセージ配列 変換ライブラリ
   ---------------------------------------------------------
   ・サイト本体（js/messages.js）… Googleスプレッドシートの公開CSVを読むときに使用
   ・scripts/csv_to_json.html   … ブラウザ版の変換ツール
   ・scripts/csv_to_json.js     … Node.js 版の変換スクリプト
   から共通で使う。ブラウザでは window.CsvToJson として使える。

   ・列名を指定しない場合は、見出しに「ハンドル／名前／name」を含む列を名前、
     「メッセージ／message」を含む列を本文として自動で選ぶ
   ・「掲載」列があれば、そこにチェック（TRUE / ○ / OK など）が入った行だけを出力
   ・セル内の改行、"" でエスケープされたダブルクォート、絵文字に対応
   ========================================================= */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.CsvToJson = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /**
   * CSV文字列を2次元配列にする（RFC 4180 準拠）
   * ・"..." で囲まれたセルの中の , と改行はセルの一部として扱う
   * ・"" は " 1文字として扱う
   */
  function parseCsv(text) {
    const src = String(text).replace(/^﻿/, ''); // 先頭のBOMを除去
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;
    let i = 0;

    while (i < src.length) {
      const c = src[i];

      if (inQuotes) {
        if (c === '"') {
          if (src[i + 1] === '"') {
            field += '"'; // "" → "
            i += 2;
          } else {
            inQuotes = false; // 囲みの終わり
            i++;
          }
        } else {
          field += c; // 改行や絵文字もそのまま
          i++;
        }
        continue;
      }

      if (c === '"') {
        inQuotes = true;
        i++;
      } else if (c === ',') {
        row.push(field);
        field = '';
        i++;
      } else if (c === '\r' || c === '\n') {
        // 行の終わり（\r\n / \n / \r のどれでもOK）
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
        i += c === '\r' && src[i + 1] === '\n' ? 2 : 1;
      } else {
        field += c;
        i++;
      }
    }

    // 最終行（末尾に改行がない場合）
    if (field !== '' || row.length > 0) {
      row.push(field);
      rows.push(row);
    }
    // 完全な空行は除外
    return rows.filter((r) => r.some((v) => v.trim() !== ''));
  }

  // 見出しから列番号を探す（完全一致を優先し、なければ候補語を含む列）
  function findColumn(header, wanted, candidates) {
    if (wanted) {
      const idx = header.findIndex((h) => h.trim() === wanted.trim());
      if (idx === -1) throw new Error(`列「${wanted}」が見つかりません。見出し: ${header.join(' / ')}`);
      return idx;
    }
    const lower = header.map((h) => h.toLowerCase());
    for (const word of candidates) {
      const idx = lower.findIndex((h) => h.includes(word.toLowerCase()));
      if (idx !== -1) return idx;
    }
    return -1;
  }

  // ハンドル名を「@xxxx」の形にそろえる
  function normalizeName(raw) {
    let name = String(raw || '').trim().replace(/^＠/, '@');
    if (name && !name.startsWith('@')) name = '@' + name;
    return name;
  }

  // 掲載チェック列の既定の列名（スプレッドシートに自分で追加する列）
  const DEFAULT_APPROVE_COL = '掲載';

  // 「掲載してよい」とみなす値（チェックボックスの TRUE や ○ など）
  const APPROVED_VALUES = ['true', '○', '〇', '◯', 'ok', '済', 'はい', 'yes', 'y', '1', '✓', '✔'];

  function isApproved(value) {
    return APPROVED_VALUES.includes(String(value || '').trim().toLowerCase());
  }

  /**
   * CSV文字列 → messages.json 用の配列と集計
   * @param {string} csvText
   * @param {{nameCol?: string, messageCol?: string, approveCol?: string}} opts
   *   nameCol / messageCol … 列名（省略時は自動判定）
   *   approveCol           … 掲載チェック列の列名（省略時は「掲載」）。
   *                          この列があれば、チェック済みの行だけを出力する
   * @returns {{messages: Array, total: number, skippedEmpty: number,
   *            skippedUnapproved: number, approveColFound: boolean}}
   */
  function convertDetailed(csvText, opts = {}) {
    const rows = parseCsv(csvText);
    if (rows.length < 2) throw new Error('CSVにデータ行がありません（1行目は見出しとして扱います）');

    const header = rows[0];
    const nameIdx = findColumn(header, opts.nameCol, ['ハンドル', 'アカウント', '名前', 'お名前', 'name']);
    const msgIdx = findColumn(header, opts.messageCol, ['メッセージ', 'message', '本文']);
    if (msgIdx === -1) {
      throw new Error(`本文の列が見つかりません。--message-col で列名を指定してください。見出し: ${header.join(' / ')}`);
    }

    // 掲載チェック列（見出しが完全一致する列）。列名を明示したのに無ければエラー
    const approveName = (opts.approveCol || DEFAULT_APPROVE_COL).trim();
    const approveIdx = header.findIndex((h) => h.trim() === approveName);
    if (opts.approveCol && approveIdx === -1) {
      throw new Error(`掲載チェック列「${approveName}」が見つかりません。見出し: ${header.join(' / ')}`);
    }

    const result = {
      messages: [],
      total: rows.length - 1,
      skippedEmpty: 0,
      skippedUnapproved: 0,
      approveColFound: approveIdx !== -1,
    };

    rows.slice(1).forEach((r) => {
      if (approveIdx !== -1 && !isApproved(r[approveIdx])) {
        result.skippedUnapproved++; // 未チェック（未確認・掲載NG）は出力しない
        return;
      }
      const message = String(r[msgIdx] || '')
        .replace(/\r\n?/g, '\n') // 改行コードを \n にそろえる
        .trim();
      if (!message) {
        result.skippedEmpty++; // 本文が空の行は除外
        return;
      }
      result.messages.push({
        id: result.messages.length + 1,
        name: nameIdx === -1 ? '' : normalizeName(r[nameIdx]),
        message,
      });
    });
    return result;
  }

  // CSV文字列 → messages.json 用の配列だけを返す
  function convert(csvText, opts = {}) {
    return convertDetailed(csvText, opts).messages;
  }

  // 整形済みJSON文字列（絵文字はエスケープせずそのまま出力される）
  function toJson(list) {
    return JSON.stringify(list, null, 2) + '\n';
  }

  return { parseCsv, convert, convertDetailed, toJson };
});
