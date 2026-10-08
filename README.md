# Pedalboard Simulator

작업 공간에 실물 페달과 페달보드 프레임을 배치하고, 부품·배선을 기반으로 실제 회로를 계산해 파형과 소리를 확인하는 웹 프로젝트.

저장소: https://github.com/Ho-01/pedalboard-simulator

## 현재 상태

2026-10-08: 문서 초안 작성 및 사용자 검토 요청. 애플리케이션 코드와 배포 설정은 아직 구현하지 않았다.

첫 목표는 **Git 및 원격 서버 배포 기반**, 그다음은 **BOSS BD-2의 회로 검증과 한 기종의 배치·조절·데모 재생**이다. 작은 단위로 계획을 검토하고 구현한다. 이후 프레임 배치, 페달 연결, 회로 편집을 확장한다.

## 먼저 읽을 문서

1. [문서 안내](docs/README.md)
2. [개발 및 리뷰 절차](docs/00-guide/development-workflow.md)
3. [Git·배포 기반 plan](docs/01-plan/26-10-08.repository-and-deployment.plan.md)
4. [BD-2 회로 시뮬레이션 상세 plan](docs/01-plan/26-10-08.bd2-circuit-simulation.plan.md)
5. [BD-2 1차 화면·청취 plan](docs/01-plan/26-10-08.bd2-mvp.plan.md)
6. [용어 및 데이터 구조](docs/04-architecture/domain-model.md)

## 제품의 기준

그리드 바탕은 **작업 공간(Workspace)**이다. 그 위에 놓이는 **페달보드 프레임**, **페달**, **패치 케이블**은 별개의 객체다. 화면 위치와 전기적 연결은 별도로 관리한다.

오디오는 회로의 부품 모델과 연결에서 계산한다. 노브는 실제 가변저항을 바꾸고, 회로 내부의 전압·전류를 파형으로 관찰할 수 있도록 설계한다. 회로가 검증되었다는 상태와 실물 측정으로 음색을 검증했다는 상태는 구분한다.

## 개발 원칙

**plan 작성 → 사용자 검토 및 승인 → 개발 → 검증 → report 작성 → 코드 리뷰**

기능 개발 전에 `docs/01-plan/<YY-MM-DD>.<feature>.plan.md`를 작성한다. 완료 후 같은 날짜·feature 식별자의 report를 `docs/02-report/`에 작성한다. report에서 계획과 일치한 항목은 ID만 나열하고, 달라진 내용과 이유·잔여 작업을 상세히 기록한다.

참고 서비스: [Pedal Playground](https://pedalplayground.com/), [Solder](https://solder.lukevers.com/). 사용자 경험을 참고하며 이 프로젝트의 코드는 독립적으로 작성한다.
