<div align="center">

<img src="assets/banner.png" alt="takeSlicer" width="100%" />

<br/>

**보컬 컴핑 전의 번거로운 준비 작업을 자동화 — 테이크를 자르고, 이름 붙이고, 정리합니다.**

[![Electron](https://img.shields.io/badge/Electron-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/electron--vite-646CFF?logo=vite&logoColor=white)](https://electron-vite.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-3be38b.svg)](LICENSE)
![Platform](https://img.shields.io/badge/platform-macOS%20·%20Windows%20·%20Linux-2a2f3a)

<br/>

[English](README.md) · **한국어** · [日本語](README.ja.md)

</div>

---

## 이게 뭔가요?

녹음 세션이 끝나면 정신없이 산란한 보컬 테이크 더미가 남습니다 — 여러 트랙, 더블링, 하모니, 타임라인 여기저기 흩어진 테이크들. 컴핑을 시작하기도 전에 각 구간을 자르고, 이름 붙이고, **손으로** 정리해야 하죠.

**takeSlicer가 그 자르기·네이밍·폴더 정리를 자동으로** 해줍니다 — 그래서 DAW(FL Studio 등)에서 바로 컴핑으로 직행할 수 있어요. 컴핑 자체는 DAW에서 하고, takeSlicer는 그 주변의 노가다만 없애줍니다.

<div align="center">
<img src="assets/screenshot.png" alt="takeSlicer UI" width="88%" />
</div>

## ✨ 기능

- 🎚 **구간 기반 슬라이싱** — 곡 구간을 시간으로 정의하면 모든 테이크가 그에 맞춰 잘립니다.
- 🔇 **무음 인식** — 어떤 테이크에서 소리가 없는 구간은 자동으로 건너뜁니다(임계값 / 최소 길이 / 꼬리 조절).
- 🎯 **0초 렌더** — 각 슬라이스를 `0:00`부터 제자리 마스킹으로 렌더 → DAW 타임라인의 원래 위치에 그대로 스냅됩니다.
- 🌊 **DAW식 파형** — 스택 트랙 레인, 구간 오버레이, 스페이스바 재생, `⌘`+스크롤 줌, 어떤 배율에서도 선명(windowed 렌더).
- 👁 **분리 미리보기** — 트랙을 펼치면 구간별로 어떻게 잘리는지 미리 확인.
- 📁 **정리된 출력** — 구간별 폴더, 일관된 네이밍, 선택적 `.zip`.

## 🛠 동작 방식

1. **구간 정의** — 곡 구간(인트로, 벌스 A, 프리코러스, 코러스…)을 시작/끝 시간으로 입력. 본인 곡 타이밍은 본인이 아니까 레퍼런스 트랙 불필요.
2. **테이크 업로드** — 곡의 녹음 WAV 파일을 전부 드롭.
3. **검증** — 각 테이크 파형에 구간 경계를 겹쳐 보며 구간이 맞는지, 어느 트랙에 소리가 있는지 확인.
4. **렌더** — *구간 × 테이크*마다, 실제로 소리가 있는 트랙만 잘라 구간별 폴더에 저장.

### 출력

```
Chorus/
  Chorus01vocal_main.wav
  Chorus02vocal_harmony.wav
Verse_A/
  Verse_A01vocal_main.wav
  …
```

- **네이밍**: `{구간}{NN}{원본파일명}.wav` — 원본 파일명이 더블링/하모니를 구분해 줍니다.
- **0초부터 렌더** — 각 슬라이스가 곡 시작점을 유지 → DAW에 끌어놓으면 정확한 타임라인 위치에 스냅. 클립은 `0:00`부터 구간 소리가 끝나는 지점 + 짧은 꼬리까지.
- **무음 트랙 스킵** — 구간별로 RMS 임계값 + 숨소리/리버브 꼬리용 노브.

## ⚙️ 기술 스택

**Electron** (main / renderer / preload) · **React** + **TypeScript** · **electron-vite** · **Web Audio API** (원본 레이트 디코드, 오프라인 렌더) · **Canvas 2D** (windowed 파형) · **JSZip**.

## 🚀 개발

```bash
npm install      # 의존성 설치
npm run dev      # HMR로 앱 실행
npm run typecheck
```

### 빌드

```bash
npm run build:mac     # macOS
npm run build:win     # Windows
npm run build:linux   # Linux
```

## 📄 라이선스

[MIT](LICENSE)

<div align="center">
<sub>정신없이 산란해 있는 녹음 트랙들을 정리하느라 컴핑도 하기 전에 지치기 마련인 프로듀서들을 위해 제작되었습니다.</sub>
</div>
