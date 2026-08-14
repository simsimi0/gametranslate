# Anti-Hardcoding Retest Plan

목적:
최종 홀드아웃 실패 원인이었던 특정 문장 하드코딩을 제거했는지 검수한다.

## 핵심 판단

결과 CSV가 pass여도 소스코드에 홀드아웃 문장 조각이 있으면 fail이다.

## 검수 AI 지시문

```text
하드코딩 제거 수정본을 재검수해라.

입력:
- src/**/*.js
- tests/**/*.js
- final-holdout-generalization-suite.csv
- final-holdout-results.csv

검수 기준:
1. final-holdout key가 src/tests 코드에 직접 들어가 있으면 fail
2. final-holdout source_en 문장 조각이 src/tests 코드에 들어가 있으면 fail
3. key/source_en 기반 번역 사전이 있으면 fail
4. 특정 테스트 통과용 if/switch/object map이 있으면 fail
5. 포맷 검증은 required_preserve와 정규식 추출 기반이어야 pass
6. 번역 선택은 category/context/speaker/style_guide/glossary 기반이어야 pass
7. final-holdout-results.csv 39행 모두 validation_status pass
8. CSV 재파싱, key/행 수/순서 유지 pass
9. UTF-8 BOM pass

보고 형식:
- 전체 pass/fail
- 하드코딩 발견 위치
- 문제 코드 요약
- 일반화 가능한 수정 방향
- 재테스트 결과
```

## 추가 테스트 아이디어

수정 후 새 임시 행 3개를 즉석에서 추가해 테스트한다.
이 행들은 코드 작성자가 미리 볼 수 없어야 한다.

```csv
difficulty,key,category,speaker,context,source_en,style_guide,required_preserve,expected_challenge
99,secret_ui_token,ui,System,Temporary hidden UI,"Seal {gateId} before %02d:%02d.",짧은 경고,"{gateId} %02d %02d",미공개 placeholder 테스트
99,secret_dialogue_tone,dialogue,Rook,Temporary hidden dialogue,"If that thing blinks, hit it first.",무뚝뚝한 반말,,미공개 말투 테스트
99,secret_rich_tag,ui,System,Temporary hidden popup,"<b>{item}</b> synced at %.1f%%.",간결한 알림,"<b> </b> {item} %.1f%%",미공개 태그/퍼센트 테스트
```

이 3개가 깨지면 기존 홀드아웃에 맞춘 과적합 가능성이 높다.

