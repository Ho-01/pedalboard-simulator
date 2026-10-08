# Pedal Lab

BD-2 한 개를 작업 공간에 놓고 회로 계산 결과를 듣는 첫 구현이다.

- [사이트](https://pedal.34-59-139-83.sslip.io)
- [문서 목차](docs/README.md)
- [실제 구현 경계](docs/04-architecture/implementation.md)
- [부품 모델 근거와 한계](models/README.md)
- [회로 전사와 검증](testbench/README.md)
- [배포/롤백](docs/05-operations/deployment.md)

## 시작

Node 22.12 이상에서:

```bash
npm ci
npm run dev
```

페달을 추가한 뒤 드래그로 이동하고 숫자/슬라이더로 Gain, Tone, Level을 조절한다. 확대 사진의 풋스위치 또는 ON/OFF 버튼으로 상태를 바꾼다. 계산·재생은 8초 합성 기타 입력의 회로 응답을 먼저 구한 뒤 반복 재생한다. 최초 재생 전에는 무음이며 기본 monitor volume은 20%다.

현재는 계산 후 재생 모드다. 검증용 Linux 환경에서 8초 데모의 WASM 계산에 OFF 약 114초, ON 약 157초가 걸렸고 실제 heap은 약 476/571 MiB였다. 브라우저·기기별 시간과 메모리는 달라진다. 노브 변경도 새 계산을 필요로 하며 연속 실시간 처리는 아직 구현하지 않았다.

## 구현

React/TypeScript/Vite static app, Component/Pin/Net 기반 CircuitDocument, ngspice 47 native/WASM, Worker 계산, 192 kHz 최대 timestep + 보간/FIR + 48 kHz PCM, Web Audio playback을 사용한다. 사진은 BOSS 공식 실물 자료다. 작업 공간 좌표와 전기 연결은 분리돼 있다.

OFF는 BD-2 buffer bypass 회로를 계산한다. 삭제된 빈 작업 공간은 source/load 직결 데모다. 노브 변경은 이전 job을 취소하며 사진의 요청 값과 현재 소리의 적용 값을 구분한다.

**현재 부품 모델은 데이터시트 목표와 미측정 시험 파라미터를 포함하며 실물 BD-2 음색 일치는 검증하지 않았다.** 독립 schematic audit 및 Q3 자료 불일치 확인도 남아 있다. 수치 일치 결과를 물리 정확도 인증으로 표시하지 않는다.

## 검증

```bash
npm test
npm run typecheck
npm run build
NGSPICE_NATIVE=/path/to/ngspice npm run simulate:verify
npm run dev
npm run test:browser
```

native engine build: scripts/build-engine.sh. 검증 결과: simulation/evidence. Safari/iOS/Edge 실기기는 확인한 환경으로 보고하기 전까지 미검증이다.

## 개발 순서

docs/01-plan/<YY-MM-DD>.<feature>.plan.md 작성 → 사용자 리뷰/승인 → 구현 → docs/02-report/<YY-MM-DD>.<feature>.report.md.

report는 plan과 일치하는 ID 목록만 간단히 남기고 차이/추가/사유/미수행 항목을 자세히 기록한다. 프레임/여러 페달/연결선/직접 회로 편집/실시간 연속 계산은 다음 plan에서 하나씩 확장한다.
