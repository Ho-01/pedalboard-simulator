# 용어와 배치·연결·회로 데이터 구조

상태: 제안. 2026-10-08 사용자 리뷰에 따라 그리드 바탕과 페달보드 프레임을 구분한다.

## 1. 용어

| 한국어 | 코드 용어 | 의미 |
| --- | --- | --- |
| 작업 공간 | `Workspace` | 그리드, 화면 이동·확대와 객체 배치를 제공하는 전체 공간 |
| 페달보드 프레임 | `PedalboardFrame` | 실제 보드 프레임에 해당하는 배치 객체. 이동·크기·회전과 소속 페달을 갖는다. |
| 페달 | `PedalInstance` | BD-2 같은 장치 하나. 위치, 모델, 노브, ON/OFF, 입출력 port를 갖는다. |
| 패치 케이블 | `PatchCable` | 페달의 OUTPUT과 다른 페달의 INPUT 등 장치 port 사이의 실제 연결 |
| 페달 내부 회로 | `CircuitDocument` | 저항·커패시터·반도체 등 부품과 pin·전기적 net의 연결 |
| 회로 배선 | `CircuitNet` | 내부에서 여러 부품 pin이 같은 전압 노드로 연결된 정보 |
| 회로도 배치 | `SchematicLayout` | 회로 기호·선의 화면 좌표. 전기적 net과 별도로 저장 |
| 측정 지점 | `Probe` | 지정 노드의 전압 또는 부품의 전류를 기록하는 관찰 대상 |

`board`는 그리드의 이름으로 사용하지 않는다. 페달보드 프레임과 페달 내부 PCB도 혼동하지 않는다.

## 2. 서로 다른 세 관계

| 관계 | 무엇이 바뀌나 | 무엇으로 관리하나 |
| --- | --- | --- |
| 공간 배치·프레임 소속 | 화면 위치와 함께 이동하는 객체 | Workspace의 placement 및 frame transform |
| 페달 간 전기적 연결 | 어떤 장치 port가 연결되는지 | PatchCable 목록 및 외부 회로 조립기 |
| 내부 부품·배선 | 저항값, 반도체, pin 연결과 회로 동작 | CircuitDocument 및 netlist 생성기 |

프레임이나 페달을 움직여도 전기적 연결은 유지한다. 케이블의 보이는 경로만 port의 새 위치에 맞춰 바뀐다. 페달이 오른쪽에 있다는 이유로 신호가 다음 페달로 넘어가지 않는다.

## 3. Workspace 데이터 초안

| 데이터 | 핵심 필드 |
| --- | --- |
| Workspace | `schemaVersion`, `id`, `unit: mm`, `viewport`, `frames`, `pedals`, `cables` |
| Frame | `id`, `modelId`, `worldPose`, `sizeMm` |
| Pedal | `id`, `pedalModelId`, `circuitRevision`, `placement`, `controls`, `bypassState`, `ports` |
| Placement | `frameId: null 또는 frame ID`, `localPose` |
| Cable | `id`, `fromPort`, `toPort`, `cableModelId`, `layoutPoints` |

프레임 밖 페달의 localPose는 작업 공간 좌표로 해석한다. 프레임에 올리면 프레임 좌표로 변환한다. world 위치는 부모 프레임의 이동·회전을 적용해 계산한다. 소속 변경 때 같은 world 위치를 보존하고, 프레임 이동 때 자식 페달의 상대 위치를 보존한다.

Workspace의 viewport 크기는 실제 프레임 크기가 아니다. 처음에는 고정 표시 영역으로 시작하더라도 세계 좌표와 화면 픽셀을 분리해 향후 확대·이동·큰 작업 공간을 지원한다.

## 4. CircuitDocument 데이터 초안

| 데이터 | 핵심 필드 |
| --- | --- |
| 문서 | `schemaVersion`, `id`, `revision`, `components`, `nets`, `ports`, `controls`, `probes` |
| 부품 | `id`, `refdes`, `kind`, `pins`, `parameters`, `modelRef`, `sourceRef`, `confidence` |
| 부품 모델 | `id`, `version`, `contentHash`, `modelType`, `parameters 또는 subcircuit`, `pinOrder`, `provenance` |
| Net | `id`, 연결된 `componentId.pinId` 목록. 기준 GND를 명시한다. |
| Control binding | UI 값과 물리 파라미터의 변환, 가변저항 gang 목록과 taper |
| Probe | node pair의 차동 전압 또는 branch 전류, 단위, 기록 해상도 |

stock BD-2와 사용자 커스텀 회로는 같은 형식이다. stock을 수정하면 별도 custom revision을 만들어 원본과 변경 목록을 보존한다. 여러 페달은 같은 정의를 참조하되 독립된 부품 ID namespace와 시뮬레이션 상태를 갖는다.

## 5. 연결과 확장 원칙

페달 간 연결은 port의 신호선과 반환 경로를 조립된 netlist에 연결한다. 장치의 입출력 임피던스와 다음 장치의 부하를 함께 계산한다. 프레임에 올렸다는 이유로 접지·전원·오디오 연결을 만들지 않는다.

처음에는 한 페달의 입력 source와 출력 load를 가진 testbench만 지원한다. 프레임 배치·여러 페달 연결 UI·부품 추가·회로 배선 편집·내부 probe UI는 후속 plan으로 구현한다. 대신 첫 CircuitDocument에는 안정적인 부품 ID, port, 노브 binding, probe 및 revision을 포함한다.

후속 케이블 모델은 길이에 따른 저항·용량, 전원 모델은 별도 공급·공유 전원을 확장할 수 있다. 해당 데이터가 없을 때는 어떤 이상 모델을 사용했는지 testbench에 명시한다. 내부 feedback은 회로 solver가 계산하며, 외부 feedback 연결의 지원 범위는 별도 plan에서 정의한다.
