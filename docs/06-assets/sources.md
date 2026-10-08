# 자산 출처 및 생성 정보

현재는 출처 후보와 기준 회로 자료를 조사했다. 이미지·오디오·부품 모델 파일은 아직 저장소에 반영하지 않았다. 회로 자료의 원문은 조사용으로 읽었으며 앱 public 폴더에 재배포하지 않는다.

| 자산 | 원본 또는 제작 방법 | 현재 상태 |
| --- | --- | --- |
| BD-2 실물 상단 사진 | https://static.roland.com/assets/images/products/gallery/bd-2_top_gal.jpg | 공식 제품 페이지에서 원본 URL 확인. 파일 도입 전 출처·사용 조건과 화질·조작부 좌표 확인 예정. |
| BD-2 조작부·크기 | https://www.boss.info/global/products/bd-2/ | LEVEL·TONE·GAIN, 페달 스위치, CHECK 표시와 73×129×59mm 사양 확인. |
| 클린 기타 데모 | 프로젝트에서 독립적으로 작성한 리프의 합성 트랙 | 구현 예정. 생성 코드, 고정 seed, 샘플레이트·길이·peak를 기록할 것. |

## 기준 회로 자료

- 자료: BOSS BD-2 Service Notes, First Edition, Feb. 1995 및 첨부된 1996-12-03 정정표
- 출처: https://stompboxelectronics.com/wp-content/uploads/2023/01/BOSS-BD2_ServiceNotes.pdf
- 작성자는 BOSS/Roland이며 위 URL은 제삼자 제공 사본이다.
- 취득·판독일: 2026-10-08
- PDF: 5 pages, 726844 bytes
- SHA-256: `7cf6f049d7fb76ec7479a7eccc5253b3bcfbc993a48d092719bab4484ef24589`
- 확인 범위: 부품표·회로도·출력 검사·정정표의 시각 확인. 전체 BOM·node map 전사와 모델 검증은 미수행.
- 적용 기준: stock 회로에 정정표를 반영한다. 더 최근 하드웨어와의 동일성은 별도 확인 대상이다.

[Aion FX Sapphire](https://aionfx.com/project/sapphire-amp-overdrive/)와 관련 제작 문서는 참고 자료다. 변경된 클론의 bypass·control·부품을 stock 기준으로 자동 채택하지 않는다.

반도체 모델 registry에는 source URL, 모델·datasheet 버전, hash, pin 순서, 원 부품/rank와의 대응, fit·검증 상태를 기록한다. 실제 모델은 아직 확보·검증하지 않았으며 자료에 없는 수치를 확인된 값처럼 쓰지 않는다.

사진 도입 시 원본 URL, 취득일, 파일 이름, 원본 보존 여부, 화면 표시를 위한 처리, 출처 표기를 기록한다. 앱 코드의 라이선스와 제삼자 사진의 사용 조건을 같은 것으로 취급하지 않는다.

## 참고한 서비스와 기술 문서

- [Pedal Playground](https://pedalplayground.com/): 배치 UI 참고
- [Solder](https://solder.lukevers.com/): 브라우저에서 조절하며 청취하는 경험 참고
- [ngspice 공식 매뉴얼](https://ngspice.sourceforge.io/docs.html): `.op`, `.ac`, `.tran`과 shared API. 2026-10-08 확인 시 release manual은 47.
- [ngspice 모델 안내](https://ngspice.sourceforge.io/modelparams.html): intrinsic device 파라미터와 subcircuit 모델, 호환성
- [ngspice shared library](https://ngspice.sourceforge.io/shared.html): 시뮬레이션 데이터 callback·중지·파라미터 변경·재개
- [wokwi/ngspice-wasm](https://github.com/wokwi/ngspice-wasm): WASM build 참고 후보. 실제 채택·버전·모델 지원은 미검증.
- [Web Audio API 표준](https://webaudio.github.io/web-audio-api/): PCM 재생·AudioWorklet·render quantum
- [Emscripten pthread 문서](https://emscripten.org/docs/porting/pthreads.html): 후속 shared memory/thread build와 배포 조건
- [Vite 정적 배포 문서](https://vite.dev/guide/static-deploy.html): 빌드 산출물 제공

서비스 전체 코드·사진·데모 음원을 자동으로 가져오지 않는다. 실제 사용한 자산의 출처만 구현 report와 이 문서에 남긴다.
