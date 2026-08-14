# Final Retest Instructions V2

새 최종 재테스트다.

입력:
- `test/final-retest-generalization-suite-v2.csv`

원칙:
- 기존 난이도 테스트 문장 재사용 금지
- 기존 final holdout 문장 재사용 금지
- key/source_en/context/expected_challenge 하드코딩 금지
- 결과 CSV만 pass여도 소스에 하드코딩 흔적이 있으면 fail

개발 AI 지시:

```text
final-retest-generalization-suite-v2.csv로 재테스트해라.

필수:
1. source_en을 실제 번역 입력으로 사용한다.
2. category/context/speaker/style_guide는 참고 정보로만 사용한다.
3. style_guide가 없어도 동작해야 한다.
4. required_preserve 토큰은 코드로 100% 검증한다.
5. CSV는 UTF-8 BOM 포함으로 저장한다.
6. key/행 수/순서 유지한다.
7. key/source_en/context/expected_challenge 직접 매칭 금지.

과적합 탐지 테스트:
1. retest key가 src/tests 코드에 있으면 fail
2. retest source_en 문장 조각이 src/tests 코드에 있으면 fail
3. retest context 문구로 고정 번역을 만들면 fail
4. expected_challenge 문구로 분기하면 fail
5. 특정 speaker 이름만 지원하면 fail
6. style_guide 제거 샘플 5행에서도 동작해야 pass

통과 기준:
- 39행 전부 validation_status pass
- difficulty 13 포맷 보존 100%
- CSV 재파싱 pass
- Excel 한글 깨짐 없음
- src/tests에 retest key/source_en/context 조각 없음
```

검수 AI 지시:

```text
final-retest-generalization-suite-v2 결과를 검수해라.

검수 기준:
1. 코드에 retest key가 들어가 있으면 fail
2. 코드에 retest source_en 문장 조각이 들어가 있으면 fail
3. 코드에 retest context 문구가 들어가 있으면 fail
4. context/expected_challenge 기반 고정 번역이면 fail
5. style_guide가 필수 입력이면 fail
6. required_preserve 보존 실패 1건이라도 있으면 fail
7. CSV BOM 없으면 fail
8. 번역이 원문 복사면 fail
9. 난이도 9-12는 자연스러움 평균 8점 이상

보고:
- 전체 pass/fail
- 실패 key
- 실패 이유
- 소스코드 문제 위치
- 일반화 가능한 수정 방향
```

추가 비공개 스모크 테스트:

```csv
difficulty,key,category,speaker,context,source_en,style_guide,required_preserve,expected_challenge
99,secret_v2_format,ui,System,Hidden warning,"Seal {doorId} before %02d:%02d.",짧은 경고,"{doorId} %02d %02d",미공개 placeholder 테스트
99,secret_v2_tone,dialogue,Unknown,Hidden dialogue,"If it smiles, run first.",무뚝뚝한 반말,,미공개 말투 테스트
99,secret_v2_tag,ui,System,Hidden popup,"<b>{reward}</b> synced at %.1f%%.",간결한 알림,"<b> </b> {reward} %.1f%%",미공개 태그/퍼센트 테스트
```

