#!/usr/bin/env node
/* =========================================================
   Googleフォームの回答CSV → data/messages.json 変換スクリプト（Node.js 版）
   ---------------------------------------------------------
   使い方（Node.js 14 以上。追加インストール不要）:
     node scripts/csv_to_json.js 回答.csv
     node scripts/csv_to_json.js 回答.csv data/messages.json
     node scripts/csv_to_json.js 回答.csv --name-col "Xのハンドル名" --message-col "メッセージ"
     node scripts/csv_to_json.js 回答.csv --approve-col "掲載"   … 掲載チェック列の名前を変えた場合

   変換の中身は js/csv.js（サイト本体・ブラウザ版ツールと共通）
   ファイルは UTF-8 で読み込みます（Googleスプレッドシートの書き出しはUTF-8）
   ========================================================= */
'use strict';

const fs = require('fs');
const path = require('path');
const { convertDetailed, toJson } = require('../js/csv.js');

const args = process.argv.slice(2);
const opts = {};
const files = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--name-col') opts.nameCol = args[++i];
  else if (args[i] === '--message-col') opts.messageCol = args[++i];
  else if (args[i] === '--approve-col') opts.approveCol = args[++i];
  else if (args[i] === '-h' || args[i] === '--help') opts.help = true;
  else files.push(args[i]);
}

if (opts.help || files.length === 0) {
  console.log('使い方: node scripts/csv_to_json.js <入力.csv> [出力.json] [--name-col 列名] [--message-col 列名] [--approve-col 列名]');
  process.exit(opts.help ? 0 : 1);
}

const input = files[0];
const output = files[1] || path.join(__dirname, '..', 'data', 'messages.json');

try {
  const r = convertDetailed(fs.readFileSync(input, 'utf8'), opts);
  fs.writeFileSync(output, toJson(r.messages), 'utf8');
  console.log(`${r.messages.length} 件を書き出しました → ${output}`);
  console.log(`（回答 ${r.total} 件 / 未チェック ${r.skippedUnapproved} 件 / 本文なし ${r.skippedEmpty} 件）`);
  if (!r.approveColFound) {
    console.warn('⚠ 「掲載」列が見つからないため、全件を出力しました。確認してから載せる場合は「掲載」列を追加してください。');
  }
} catch (err) {
  console.error('エラー:', err.message);
  process.exit(1);
}
