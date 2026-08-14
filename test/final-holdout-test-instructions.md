# Final Holdout Test Instructions

최종 일반화 검수용이다.

규칙:
- `final-holdout-generalization-suite.csv`는 개발 중 튜닝에 쓰지 않는다.
- 기존 난이도 테스트 문장/키/번역을 재사용하지 않는다.
- 실패 후 수정은 특정 문장 하드코딩이 아니라 일반 규칙으로 한다.

개발 AI 지시문:

```text
최종 홀드아웃 테스트를 실행해라.

입력:
final-holdout-generalization-suite.csv

범위:
- difficulty 1-12 전체
- 추가 difficulty 13 엔진 제어문자 스트레스 테스트

주의:
- 처음 보는 테스트로 취급한다.
- 기존 테스트 문장/키/번역을 재사용하지 마라.
- 특정 key/source_en 하드코딩 금지.

해야 할 것:
1. source_en을 translation_ko로 번역한다.
2. required_preserve 토큰을 코드로 검증한다.
3. CSV 재파싱, 행 수, key 순서를 검사한다.
4. validation_status와 validation_errors를 출력한다.
5. 자연스러움 점수와 번역체 위험도를 출력한다.
6. UTF-8 BOM 포함 CSV로 저장해 Excel에서 깨지지 않게 한다.

통과 기준:
- 포맷 보존 실패 0건
- CSV 재파싱 pass
- key/행 수/순서 유지
- difficulty 1-8 실사용 가능
- difficulty 9-12 평균 자연스러움 8점 이상
- difficulty 13 포맷 보존 100%
```

검수 AI 지시문:

```text
최종 홀드아웃 결과를 검수해라.

검수 기준:
1. 기존 테스트 문장/번역을 베끼지 않았는가
2. placeholder/tag/escape/control sequence가 동일하게 유지됐는가
3. CSV가 UTF-8 BOM 포함으로 Excel에서 깨지지 않는가
4. key 순서와 행 수가 유지됐는가
5. 중의어, 농담, 위협, 공포, 문어체가 자연스러운가
6. 성별 미상 문장을 임의로 성별화하지 않았는가
7. 실패 원인이 일반 규칙으로 수정 가능한가

보고 형식:
- pass/fail
- 실패 key
- 실패 유형
- 원인
- 일반화 가능한 수정 방향
```
