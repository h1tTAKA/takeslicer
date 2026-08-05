<div align="center">

<img src="assets/banner.png" alt="takeSlicer" width="100%" />

<br/>

**ボーカルコンプ前の面倒な下準備を自動化 — テイクをスライスし、名前を付け、整理します。**

[![Electron](https://img.shields.io/badge/Electron-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/electron--vite-646CFF?logo=vite&logoColor=white)](https://electron-vite.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-3be38b.svg)](LICENSE)
![Platform](https://img.shields.io/badge/platform-macOS%20·%20Windows%20·%20Linux-2a2f3a)

<br/>

[English](README.md) · [한국어](README.ko.md) · **日本語**

</div>

---

## これは何？

レコーディングが終わると、散らかったボーカルテイクの山が残ります — 複数トラック、ダブリング、ハモリ、タイムラインのあちこちに散らばったテイク。コンプを始める前に、各セクションを切り出し、名前を付け、**手作業で**整理しなければなりません。

**takeSlicer がそのカット・命名・フォルダ整理を自動で**行います — だから DAW（FL Studio など）ですぐにコンプ作業へ進めます。コンプ自体は DAW で行い、takeSlicer はその周りの雑務だけを取り除きます。

<div align="center">
<img src="assets/screenshot.png" alt="takeSlicer UI" width="88%" />
</div>

## ✨ 機能

- 🎚 **セクション単位のスライス** — 曲のセクションを時間で定義すると、すべてのテイクがそれに合わせて切られます。
- 🔇 **無音検知** — あるテイクで音のないセクションは自動でスキップ（しきい値 / 最小長 / テール調整）。
- 🎯 **0秒レンダー** — 各スライスを `0:00` から所定位置にマスクしてレンダー → DAW タイムラインの正しい位置にそのままスナップ。
- 🌊 **DAW 風波形** — スタックしたトラックレーン、セクションオーバーレイ、スペースバー再生、`⌘`+スクロールズーム、どの倍率でも鮮明（windowed レンダー）。
- 👁 **分割プレビュー** — トラックを展開すると、セクションごとにどう切られるか確認できます。
- 📁 **整理された出力** — セクション別フォルダ、一貫した命名、オプションの `.zip`。

## 🛠 使い方

1. **セクション定義** — 曲のセクション（イントロ、ヴァースA、プリコーラス、コーラス…）を開始/終了時間で入力。自分の曲のタイミングは分かっているのでリファレンストラック不要。
2. **テイクをアップロード** — 曲の録音 WAV ファイルをすべてドロップ。
3. **確認** — 各テイクの波形にセクション境界を重ねて表示し、セクションが合っているか、どのトラックに音があるかを確認。
4. **レンダー** — *セクション × テイク* ごとに、実際に音があるトラックだけを切り出してセクション別フォルダへ保存。

### 出力

```
Chorus/
  Chorus01vocal_main.wav
  Chorus02vocal_harmony.wav
Verse_A/
  Verse_A01vocal_main.wav
  …
```

- **命名**: `{セクション}{NN}{元ファイル名}.wav` — 元ファイル名がダブリング/ハモリを区別します。
- **0秒からレンダー** — 各スライスが曲の開始点を保持 → DAW にドラッグすると正しいタイムライン位置にスナップ。クリップは `0:00` からセクションの音が終わる地点 + 短いテールまで。
- **無音トラックはスキップ** — セクションごとに RMS しきい値 + ブレス/リバーブテール用のノブ。

## ⚙️ 技術スタック

**Electron** (main / renderer / preload) · **React** + **TypeScript** · **electron-vite** · **Web Audio API**（ネイティブレートデコード、オフラインレンダー）· **Canvas 2D**（windowed 波形）· **JSZip**。

## 🚀 開発

```bash
npm install      # 依存関係のインストール
npm run dev      # HMR でアプリ起動
npm run typecheck
```

### ビルド

```bash
npm run build:mac     # macOS
npm run build:win     # Windows
npm run build:linux   # Linux
```

## 📄 ライセンス

[MIT](LICENSE)

<div align="center">
<sub>コンプ作業を始める前に、散らかった録音トラックの整理でヘトヘトになりがちなプロデューサーのために作られました。</sub>
</div>
