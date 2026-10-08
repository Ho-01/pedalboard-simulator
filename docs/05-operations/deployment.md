# 개발·배포 운영 초안

상태: 제안. 명령과 스크립트는 기반 plan 승인 후 실제 검증한 내용으로 채운다.

| 항목 | 초안 |
| --- | --- |
| 운영 서버 | 현재 연결된 GCP 서버 |
| 신규 주소 | `https://pedal.34-59-139-83.sslip.io` |
| 소스 checkout | `/home/ho/pedalboard-simulator` |
| release 경로 | `/var/www/pedalboard-simulator/releases/<sha>/` |
| 운영 경로 | `/var/www/pedalboard-simulator/current` |
| 제공 방식 | Nginx가 정적 앱과 이후 WASM·회로 모델 자원 제공 |
| 자동 배포 | 초기에는 없음. 특정 SHA를 지정해 수동 실행 |

## 배포 확인 순서

1. GitHub에 올라간 commit과 사용자 승인 범위를 확인한다.
2. 대상 SHA를 checkout하고 설치·타입 검사·빌드를 수행한다.
3. 새 release의 HTML·JS·CSS·버전 정보와 파일 권한을 확인한다.
4. 첫 배포에는 신규 host·TLS 설정을 준비하고 `nginx -t`를 통과시킨다.
5. 새 release를 활성화한다. 이후 배포에는 Nginx 설정을 매번 바꾸지 않는다.
6. 실제 HTTPS 주소에서 확인하고 GitHub SHA·운영 SHA를 report에 적는다.
7. blog·greatkingdom·portfolio·familiar 등 기존 서비스의 응답을 확인한다.

## 복구

이전 release로 `current`를 되돌려 기존 검증본을 다시 제공한다. 첫 release에 문제가 있으면 새 host만 비활성화한다. 실제 복구 명령과 검증 결과는 기반 구현 때 남긴다.

해시가 붙은 이전 JS/CSS 자원은 이전 페이지를 열어 둔 사용자에게 필요할 수 있다. 최소 한 이전 release를 보존하고 활성 root에서 이전 자원도 제공되도록 배포 구현에서 처리한다.

## 인증과 상태 구분

공개 저장소 clone은 GitHub 쓰기 인증 없이 가능하다. GitHub 연결 계정과 API push 권한을 확인했지만 CLI push 인증은 별도로 확인한다. 서버 배포는 운영 파일과 Nginx를 변경할 권한이 필요하다.

문서 commit, GitHub push, 앱 빌드, 운영 배포를 별개 상태로 기록한다. 현재는 운영 배포와 HTTPS 설정을 실행하지 않았다.

## 회로 엔진의 후속 운영 조건

native 회로 참조 테스트와 WASM 컴파일은 운영 VM의 기존 서비스와 분리한다. 생성된 engine·모델의 hash·build 옵션을 기록하고 브라우저에 전달할 정적 자원만 release에 포함한다.

첫 계산 모드는 Worker에서 단일 thread 실행을 검증한다. 후속 shared memory/pthread 구성을 채택하면 해당 사이트의 COOP/COEP, WASM MIME, same-origin 자원 로딩, isolation·browser 호환을 추가 검증한다. 기존 다른 host의 header를 일괄 변경하지 않는다.
