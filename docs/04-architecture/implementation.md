# 첫 구현의 경계

화면의 작업 공간 좌표는 mm 단위 Placement다. grid 간격은 10 mm이지만 배치는 연속 좌표로 자유 이동한다. 선택한 페달은 사진과 조절값을 공유한다. 실제 frame 객체는 아직 없으며 frameId는 null이다. 페달 위치를 바꿔도 회로 값이나 신호 경로는 바뀌지 않는다.

전기 도메인은 CircuitDocument의 Component / Pin / Net / Port / Probe로 구성한다. stock BD-2와 clone한 custom 문서는 같은 검증과 SPICE generator를 거친다. 현재 공개 화면에는 회로 편집기를 넣지 않았다. 이후 frame membership, cable route, electrical connection은 각기 분리된 모델을 추가한다.

ngspice 47 native 및 Emscripten 4.0.21 WASM은 같은 source commit과 compatibility patch를 사용한다. Worker는 매 작업 fresh engine instance를 만들고 PWL 입력을 과도 해석한다. 노브 변경 때 Worker를 종료해 이전 작업의 메시지와 메모리를 회수한다. 결과의 job ID가 현재 요청과 맞아야만 적용한다.

래치의 대칭 OP는 수치적으로 해가 될 수 있지만 선택한 ON/OFF 상태가 아니다. bootstrap 비래치 바이어스를 nodeset 초기값으로 제공하고 전원/기준/래치 결과를 별도 raw로 검사한다. nodeset은 실제 회로에 전압원을 추가하지 않는다. 수렴을 실패한 상태로 우회하는 gminsteps=0 설정은 사용하지 않는다.

최대 timestep 1/192000 s에서 적응 시간축을 계산하고 균일 시간축으로 보간한다. 257-tap Blackman FIR(20 kHz cutoff)로 대역을 제한한 뒤 48 kHz로 decimate한다. 내부 노드에는 DC 전압도 유지한다. 입력/출력 파형은 같은 계산 작업의 실제 전압이며 모니터 볼륨 적용 전 값이다.

AudioContext는 사용자 재생 동작에서 활성화한다. 재생 소스는 하나만 유지하고 pause position / restart / loop를 관리한다. master gain은 기본 20%. 새 결과는 기존 source를 종료한 뒤 15 ms fade-in으로 시작한다. 전체 클립을 정규화하거나 페달 계산값을 바꾸는 limiter는 없다.

화면의 사진/노브는 요청 값을 즉시 표시한다. 현재 재생 설정은 별도 표기하고 새 결과 적용 전에는 대기 상태를 보여준다. OFF는 buffer bypass 회로 결과, 삭제된 빈 작업 공간은 source/load 직결 데모다.

static 서버는 Node API, 데이터베이스, 회로 계산 프로세스를 운영하지 않는다. native 엔진은 개발 검증용이며 서비스 계산은 사용자의 브라우저 Worker에서 실행한다. 배포는 commit별 release + shared content-hash assets/engine + atomic current symlink이며 rollback은 빌드를 다시 하지 않는다.
