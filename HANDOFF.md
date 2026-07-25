# takeslicer — 세션 인수인계

보컬 콤핑용 **배치 슬라이서** 데스크톱 앱. 녹음한 WAV 여러 개를 유저가 정의한 곡 구간(인트로/벌스A/프리코러스/싸비...)마다 잘라서, 파형 있는 것만 이름붙여 폴더별로 뽑아줌. 콤핑 전 "구간 짜르고 이름붙이는 노가다" 제거가 목적. 콤핑 자체는 유저가 FL Studio에서 함.

## 확정 결정
- **플랫폼**: Electron 데스크톱 앱 (웹 X, 플러그인 X). 이유: 순수 JS, node `fs`로 아무 폴더나 직접 쓰기(웹 `showDirectoryPicker` 벽 회피). 유저 스택=JS/Vercel.
- **스택**: electron-vite (react, JS/no-TS) + wavesurfer.js + Web Audio + node `fs` + jszip(옵션)
- **repo 이름**: takeslicer
- **깃헙 연동**: 새 세션에서 진행 예정

## 유저 워크플로 (자동 프레이즈 감지 아님 — 유저가 귀로 구간 정함)
1. 레퍼런스 트랙 로드 → 파형 표시 (wavesurfer)
2. "구성+" 버튼 = wavesurfer region 생성. 구간별 시작~끝 시간 + 이름(인트로/벌스A/싸비...). region 드래그·이름 내장 UI 재사용
3. 녹음 WAV 전부 업로드
4. "정리하기/렌더" → 각 구간 × 각 WAV 슬라이스, 파형(비무음) 있는 것만 export

## 핵심 요구사항 (놓치면 안 됨)
- **0초부터 렌더 (트림 X)**: 출력 wav = 프로젝트 전체 길이 유지. 해당 구간 위치에만 오디오, 나머지 전부 무음(0). FL 드래그 시 0초 스냅 → 원래 타임라인 위치 그대로. 구현=전체길이 버퍼에 구간 밖 샘플 0 마스킹. (Pro Tools "consolidate from bar 1" 개념)
- **폴더 정리 렌더 (주)**: 구간이름 폴더 만들어 그 안에 슬라이스 저장. node `fs.mkdirSync`+`writeFileSync`. zip 다운로드는 옵션.
- **네이밍**: `구간이름NN원본파일이름.wav` (예: `싸비01vocal_main.wav`, `싸비02vocal_harmony.wav`). NN=같은 구간에 파형 있는 파일들 순서(메인·화음·더블링), origname으로 구분.
- **RMS 임계값 슬라이더 필수**: "파형 있음/없음" 자동판정이 숨소리·리버브 꼬리 때문에 빗나감. 임계값·최소길이 노브 노출 안 하면 조용한 테이크 통째 스킵됨. 캘리브레이션 노브 반드시 남길 것.

## MVP 단계 (~1.5시간)
1. 파일 드래그드롭 + 파형 표시 (wavesurfer) — 20분
2. region 생성·이름·시간범위 리스트 (구성+) — 15분
3. 정리하기: 구간×WAV 슬라이스 + 0초 마스킹 + 무음스킵 + 네이밍 — 30분
4. RMS 임계값 슬라이더 — 10분
5. WAV 인코드 + 폴더 렌더(fs) / zip(옵션) — 20분

## 다음 액션
새 세션에서: (1) 깃헙 repo 생성·연동 (2) electron-vite 스캐폴드 (`npm create @quick-start/electron@latest takeslicer -- --template react`, 프롬프트: TypeScript=No, updater=No) (3) Step 1부터.
