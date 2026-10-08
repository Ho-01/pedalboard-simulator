# 회로 전사와 검증 자료

- `src/circuits/boss-bd2/circuit.json`: 회로의 canonical Component/Pin/Net/Port/Probe 문서. 위치 정보가 없다.
- `bd2-bom.json`: component ID/refdes/값/모델을 원본 위치와 연결한 전사 목록.
- `bd2-node-map.json`: schematic 블록을 읽기 쉬운 node 이름으로 대응시킨 목록.
- `bd2-bias-guesses.json`: native OP bootstrap에서 얻은 **Newton 초기 추정값**. 강제 전압, 정답 파형, 측정 fixture가 아니다.

## 원본

[1995 BOSS BD-2 서비스 노트와 1996 Q9/Q12 정정표 사본](https://stompboxelectronics.com/wp-content/uploads/2023/01/BOSS-BD2_ServiceNotes.pdf)

검토한 PDF SHA256: `7cf6f049d7fb76ec7479a7eccc5253b3bcfbc993a48d092719bab4484ef24589`.
원본 PDF는 배포 파일에 포함하지 않는다.

Q9/Q12는 정정표의 2SA1049 GR을 사용한다. Q3는 부품표의 2SK184 GR과 회로도 NPN 표기가 불일치하는 것으로 읽혔으며, 현재 NPN 회로도 기준의 **시험 전사**다. 이 차이는 실물 PCB 또는 독립 도면 audit으로 확인해야 한다.

## 회로 범위

두 JFET 차동 증폭단과 PNP 출력, Q7 gyrator EQ, diode clipping, tone/level, 입출력 버퍼, JFET bypass switching, discrete latch, 전원/기준 버퍼, LED/제너를 포함한다. R24/R49는 해당 도면에 없는 refdes로 기록하며 임의 부품을 만들지 않는다. C100/C101은 각각 18 nF로 전사했다.

포트에는 1 kΩ source, 1 MΩ load, 9 V 전원 시험 장치를 별도로 붙인다. 이 장치는 기타 픽업/앰프 캐비닛 모델이 아니다.

## 단계별 증거

`npm run simulate:verify`가 native/WASM DC/AC/transient, DC 조절 행렬, timestep refinement, custom R9 경로 및 8초 데모 결과를 `simulation/evidence/numerical.json`에 기록한다. 실제 실행이 성공한 결과만 증거로 커밋한다.

원본의 200 Hz / 5 mVpp square 테스트는 자극 재현 시험으로 사용한다. 스캔된 그림은 machine-readable golden fixture가 아니며, 자체 생성 netlist와 자체 결과를 독립 정답으로 취급하지 않는다.

독립 schematic-to-netlist audit, 측정 부품 모델, 물리 BD-2 캡처 및 A/B 청취는 별도의 후속 검증이다. 두 solver가 일치하는 결과만으로 이 검증을 완료했다고 선언할 수 없다.
