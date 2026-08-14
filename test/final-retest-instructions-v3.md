# Final Retest Instructions V3

목표:
v2 과적합 수정 후 다시 일반화 검수한다.

입력:
- `test/final-retest-generalization-suite-v3.csv`

개발 AI 지시:

```text
final-retest-generalization-suite-v3.csv로 재테스트해라.

핵심:
- source_en 특정 단어쌍 매칭 금지
- key/source_en/context/expected_challenge 직접 분기 금지
- style_guide는 optional이어야 한다
- category/context/speaker/style_guide/required_preserve는 LLM 프롬프트 참고 정보로만 써라
- 포맷 검증은 코드로 처리해라

필수 구조:
1. localizer는 CSV 파싱, 토큰 추출, 포맷 검증, CSV 출력만 담당한다.
2. translator는 번역 생성만 담당한다.
3. MockTranslator는 tests 전용이어야 한다.
4. 제품 src 코드에는 v3 key/source_en/context/expected_challenge 조각이 없어야 한다.
5. tests 코드에도 v3 key/source_en/context/expected_challenge 조각이 번역 분기용으로 있으면 안 된다.

통과 기준:
- 39행 전부 validation_status pass
- required_preserve 100% 보존
- difficulty 13 포맷 보존 100%
- CSV 재파싱 pass
- UTF-8 BOM 있음
- style_guide 빈 행도 정상 처리
- src 전체와 tests 전체 정적 검사 pass
```

검수 AI 지시:

```text
final-retest-generalization-suite-v3 결과를 검수해라.

검수 파일:
- test/final-retest-generalization-suite-v3.csv
- final-retest-results-v3.csv
- src 전체
- tests 전체

과적합 fail 조건:
1. v3 key가 src/tests에 직접 들어가 있으면 fail
2. v3 source_en 문장 조각이 src/tests에 들어가 있으면 fail
3. v3 context 문구가 src/tests에 들어가 있으면 fail
4. v3 expected_challenge 문구가 src/tests에 들어가 있으면 fail
5. cast/vote, cast/ward, drive, chest/retires, mirror/room, tide/shore 같은 source_en 단어쌍으로 분기하면 fail
6. 특정 speaker 이름만 지원하고 새 speaker에서 무너지는 구조면 fail
7. style_guide가 없을 때 실패하면 fail

정량 검수:
1. 39행 전부 validation_status pass
2. CSV 재파싱 pass
3. key/행 수/순서 유지
4. UTF-8 BOM 있음
5. required_preserve 100% 보존
6. difficulty 13 엔진 제어문자 보존 100%

보고:
- 전체 pass/fail
- 정량 검증 결과
- 과적합 발견 위치
- 실패 key
- 일반화 가능한 수정 방향
```

비공개 스모크 테스트:

```csv
difficulty,key,category,speaker,context,source_en,style_guide,required_preserve,expected_challenge
99,secret_v3_timer,ui,System,Hidden timer,"Close {valveId} in %02d:%02d.",짧은 경고,"{valveId} %02d %02d",미공개 포맷
99,secret_v3_dialogue,dialogue,Unknown,Hidden dialogue,"If it whispers twice, answer once.",,,미공개 말투
99,secret_v3_tag,ui,System,Hidden popup,"<i>{signal}</i> stabilized at %.2f%%.",간결한 알림,"<i> </i> {signal} %.2f%%",미공개 태그
```

