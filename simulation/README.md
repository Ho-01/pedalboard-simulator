# 계산 엔진과 검증

- 엔진 원본: [ngspice 47](https://github.com/imr/ngspice/tree/ngspice-47), commit `a80f6e3e95d51534905b1f23410a951802666656`.
- 브라우저 툴체인: Emscripten 4.0.21.
- public/engine/<artifact-hash>에 JS, WASM, 원본 COPYING을 포함한다.
- engine-manifest.json에 실제 배포 경로와 파일 SHA256을 기록한다.
- native build는 npm 런타임 의존성이 아니며 수치 비교를 위한 검증 도구다.

`scripts/build-engine.sh`를 실행하면 pin한 원본/툴체인에서 native와 WASM을 만들고 `scripts/package-engine.py`로 배포 파일을 갱신한다. Linux 빌드 의존성: gcc/g++, make, autoconf, automake, libtool, bison, flex, pkg-config, Python 3, git, cmake. VM의 작은 tmpfs를 피하기 위해 cache 하위 TMPDIR을 사용한다.

XSPICE/OSDI/CIDER/OpenMP/KLU를 사용하지 않는다. XSPICE 없는 구성에서 upstream cktsopt.c의 OPT_ENH_RSHUNT enum이 선언되지 않은 branch만 제거한다. 기기 방정식이나 결과를 바꾸는 패치는 아니다. patch와 configure/link flags를 빌드 스크립트에서 확인할 수 있다.

검증 실행:

```bash
npm ci
npm test
npm run typecheck
NGSPICE_NATIVE=/path/to/native/ngspice npm run simulate:verify
```

첫 계산에 필요한 회로 전사, 부품 모델, 노브 커브는 각각 testbench와 models의 상태를 따른다. 수치 일치와 실제 페달 음색 재현을 구분한다.

클래식 소자 subset은 manifest의 deviceSubset에 기록한다. BSIM/HICUM/HiSIM 등 현대 집적 반도체 모델은 포함하지 않는다. 같은 subset을 native/WASM에 적용하며 기본 R/C/L, 독립/종속/behavioral source, diode, BJT, JFET, 기본 MOS, switch 및 전송선을 지원한다. 향후 다른 모델을 추가할 때 다시 빌드하고 별도 검증한다.

## 2026-10-08 수치 검증

`evidence/numerical.json`에 native/WASM의 부품 단위, DC·AC·transient, 150개 control matrix, time step refinement, 부품 수정 및 전체 8초 ON/OFF 결과가 있다. 전체 데모의 상대 RMS 오차는 OFF 3.71×10⁻⁹, ON 3.34×10⁻⁵로 기준 0.1% 이내다. ON 장시간 비선형 계산의 적응 시간점 수는 두 엔진에서 조금 달라질 수 있으며 같은 균일 PCM 시간축에서 비교한다.

PWL 직렬화는 모든 입력 샘플을 보존하고 한 SPICE continuation에 최대 64개 쌍을 넣는다. 단조 시간점의 구간·breakpoint는 이진 검색하며 중복·역순 시간점은 원본 검색으로 처리한다. `evidence/pwl-regression.json`의 개선 전후 8개 native 시험은 시간·전압값이 bitwise 동일하다.

WASM 메모리는 64 MiB에서 시작해 최대 1 GiB까지 늘어난다. 512 MiB는 8초 ON 결과 저장에 부족했으며 최종 기본 OFF/ON 시험의 heap은 476/571 MiB다. JS와 브라우저 자체 메모리는 추가로 필요하다. 계산 속도와 메모리는 실기기 환경에서 별도 확인해야 한다.
