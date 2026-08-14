# Anti-Hardcoding Dev Instructions

개발 AI에게 그대로 전달한다.

```text
현재 FAIL 원인은 번역 품질이 아니라 일반화 실패다.
src/localizer.js 또는 테스트 코드에 final-holdout source_en/key 문장 조각을 직접 매칭한 흔적이 있다.

목표:
특정 문장 하드코딩을 제거하고, 일반 규칙 기반 파이프라인으로 바꿔라.

금지:
1. source_en 전체 문자열 매칭 금지
2. source_en 일부 문구 매칭 금지
3. key별 번역문 매핑 금지
4. holdout 전용 if/switch/object map 금지
5. 테스트 통과용 특수 처리 금지

허용:
1. category 기반 규칙
2. speaker 기반 말투 규칙
3. style_guide 기반 프롬프트 구성
4. context 기반 프롬프트 구성
5. required_preserve 기반 토큰 추출/검증
6. 정규식 기반 placeholder/tag/escape/control sequence 추출
7. glossary 기반 용어 적용
8. LLM 호출 또는 LLM mock의 일반 규칙 처리

구현 방향:
1. 번역 생성 로직과 포맷 검증 로직을 분리해라.
2. validatePreservedTokens(source_en, translation_ko, required_preserve)를 일반 함수로 만들어라.
3. extractTokens(text)는 모든 입력에 같은 규칙을 적용해라.
4. translateRow(row)는 key/source_en을 직접 비교하지 말고 row.category, row.speaker, row.context, row.style_guide를 사용해라.
5. LLM API가 없는 로컬 테스트용 mock은 문장별 정답 사전이 아니라 category별/패턴별 일반 mock만 허용한다.

정적 검사 추가:
1. final-holdout-generalization-suite.csv를 읽는다.
2. key 값이 src/**/*.js, tests/**/*.js에 포함되면 fail.
3. source_en에서 길이 8자 이상 문구가 src/**/*.js, tests/**/*.js에 포함되면 fail.
4. final-holdout 전용 파일명을 src 코드가 참조하면 fail.

재테스트:
1. 기존 difficulty 1-12 회귀 테스트
2. final-holdout 39행 재생성
3. 포맷 보존 100%
4. 정적 하드코딩 검사 pass
5. UTF-8 BOM pass
```

