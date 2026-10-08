# BD-2 부품 시험 모델

이 디렉토리의 모델은 **제조사 제공 SPICE 모델이 아니다**. 원본 회로도의 부품 종류를 유지하고 데이터시트 목표와 공개된 정격 범위에서 시험 파라미터를 구성했다. 회로 토폴로지 계산, native/WASM 수치 일치, 실제 BD-2 음색 일치는 서로 다른 검증이다. 현재 실물 음색은 미검증이다.

## 파라미터 근거와 미확인값

| 모델 | 사용 근거 | 미확인 / 시험 가정 |
|---|---|---|
| 2SK184 GR | Toshiba 데이터시트 GR Idss 2.6–6.5 mA 범위, Voff 범위, gm 및 Ciss/Crss. 시험점 Idss 4.5 mA, VTO −0.6 V, BETA 0.0125 | 해당 페달 실물의 Idss/Vp, lambda, 접합 C의 실제 바이어스 곡선, RD/RS. C값은 정격 조건에서의 근사 |
| 2SK118 Y | Toshiba 데이터시트 Y Idss 1.2–3 mA 범위. 시험점 Idss 2.1 mA, VTO −2.8 V | 실제 소자의 Vp/Idss 및 게이트 누설, Ron, 온도 특성. BETA는 Idss/Vp² |
| 2SC2458/2459 GR, 2SA1049 GR | 회로도 종류 및 GR hFE 범위에 놓인 BF=300 시험값 | IS, VAF, IKF, 저항, CJE, CJC, TF, TR은 실물에 fitting하지 않은 가정. NPN/PNP 모델을 제조사 모델로 부르면 안 됨 |
| 1SS133 | ROHM의 Vf/Ct/trr 자료를 참고한 시험 diode | IS/N/RS/CJO/TT의 다중 조건 fitting과 온도 검증 미수행 |
| S5688G, RD5.6EB-3, LN28RP | 회로도 부품명, 제너 nominal 5.6 V, 빨간 LED 및 역극성 보호 역할 | I-V/C-V 및 실제 LED/제너 동작점 미측정. nominal 기능 시험 모델 |
| M5218AL | Mitsubishi 데이터시트의 Aol 110 dB, GBW 7 MHz, SR 3 V/µs, Rin 5 MΩ, Ib 500 nA, offset 0.5 mV를 목표로 한 매크로모델 | 원 데이터의 ±15 V 조건에서 BD-2 단전원 약 8 V로 외삽. 출력 swing/current 제한, common-mode, noise, recovery/temperature 미검증 |

JFET에는 ngspice 접합 전계 효과 소자 방정식을 사용한다. M5218AL 내부는 데이터시트 목표에 맞춘 전류/전압원 및 RC 매크로모델이다. 페달 전체를 WaveShaper, 임의 EQ, 녹음된 출력으로 대체하지 않는다.

## 포텐셔미터

Gain: 250 kΩ + 250 kΩ dual gang A; Level: 100 kΩ A; Tone: 10 kΩ B. 각 gang은 두 저항과 실제 와이퍼 핀으로 전개한다. 회로도처럼 와이퍼와 단자가 묶인 gain gang은 한 구간만 전기적으로 남는다. A 커브의 중간점은 **15% 시험 가정**이며 원 ALPS 부품의 실측 커브는 아니다. 단자 끝의 0 Ω은 수치 특이점을 피하는 0.01 Ω 접촉 저항으로 근사한다.

## 출처

- [Mitsubishi M5218AL 원 제조사 데이터시트 사본](https://datasheet4u.com/pdf-down/M/5/2/M5218AL_MitsubishiElectricSemiconductor.pdf)
- [Toshiba 2SK184 원 제조사 데이터시트 사본](https://www.alldatasheet.com/html-pdf/213180/TOSHIBA/2SK184/293/1/2SK184.html)
- [Toshiba 2SK118 원 제조사 데이터시트 사본](https://electrohubec.com/uploads/datasheets/d_21102024814037.pdf)
- [ROHM 1SS133 원 제조사 데이터시트 사본](https://mm.digikey.com/Volume0/opasdata/d220001/medias/docus/9/1ss133.pdf)

다음 승격 조건: 제조사/추출 모델 확보 → DC 및 C-V/I-V fitting → 불확실성 sweep → 해당 회로 revision의 실물 캡처 비교. 측정 없이 confidence를 measured/verified로 올리지 않는다.
