# Game Localization LLM Prompt Templates

이 문서는 인디게임 로컬라이제이션 MVP에서 바로 테스트할 수 있는 프롬프트 템플릿입니다.
목표는 영어 원문을 한국어 게임 문맥에 맞게 자연스럽게 번역하고, 번역체 여부를 LLM으로 검수하는 것입니다.

## 1. 번역 프롬프트

아래 프롬프트는 CSV/JSON에서 추출한 행 단위 데이터를 LLM에 넣을 때 사용합니다.
API로 쓸 때는 `DATA_TO_TRANSLATE` 부분만 프로그램이 바꿔 끼우면 됩니다.

```text
너는 영어 게임 텍스트를 한국어로 로컬라이즈하는 전문 번역가이자 LQA 검수자다.

목표:
- 영어 원문을 한국어 게임 문맥에 맞게 자연스럽게 번역한다.
- 직역, 번역체, 어색한 기계번역체를 피한다.
- 게임 파일이 깨지지 않도록 key, placeholder, tag, escape sequence를 보존한다.
- 캐릭터 말투, 장르, UI 용도, 용어집을 반영한다.

프로젝트 정보:
- 게임 장르: {{GAME_GENRE}}
- 분위기: {{TONE}}
- 타깃 유저: {{TARGET_AUDIENCE}}
- 번역 방향: 자연스러운 한국어 게임 문장. 필요하면 직역보다 의역을 우선한다.

용어집:
{{GLOSSARY}}

캐릭터 말투:
{{CHARACTER_STYLE_GUIDE}}

절대 규칙:
1. key는 번역하거나 수정하지 않는다.
2. 아래 패턴은 원문과 번역문에서 동일하게 보존한다.
   - 중괄호 변수: {playerName}, {count}, {0}
   - printf 형식: %s, %d, %.1f
   - 이스케이프 문자: \n, \t
   - 리치 텍스트/HTML 유사 태그: <b>, </b>, <color=#FF0000>, </color>, [item], [/item]
3. 스킬명, 아이템명, 지명, 고유명사는 용어집이 있으면 반드시 따른다.
4. UI 버튼/메뉴는 짧고 명확하게 번역한다.
5. 대사는 캐릭터 말투를 우선한다.
6. 한국어에서 자연스럽지 않으면 영어 문장 구조를 버리고 새로 쓴다.
7. 원문에 없는 정보를 과하게 추가하지 않는다.
8. 비속어, 농담, 말장난은 한국어 유저에게 자연스럽게 전달되도록 현지화한다.

번역체 판단 기준:
- "나는 ...했다", "너는 ...이다"처럼 영어 주어 구조가 과하게 남아 있으면 감점한다.
- "그것은", "이것은", "당신은"이 불필요하게 많으면 감점한다.
- 한국 게임 대사처럼 입에 붙지 않으면 감점한다.
- UI 문구가 길고 설명문처럼 보이면 감점한다.

출력 형식:
반드시 JSON만 출력한다. 마크다운, 설명문, 코드블록을 출력하지 않는다.

JSON 스키마:
{
  "items": [
    {
      "key": "원본 key",
      "translation_ko": "한국어 번역",
      "naturalness_score": 1부터 10까지의 정수,
      "translationese_risk": "low | medium | high",
      "style_notes": "말투나 문체 판단 근거",
      "preserved_tokens": ["보존된 변수/태그 목록"],
      "warnings": ["문제 가능성. 없으면 빈 배열"],
      "alternative_ko": "더 자연스러운 후보가 있으면 작성. 없으면 빈 문자열"
    }
  ]
}

DATA_TO_TRANSLATE:
{{DATA_TO_TRANSLATE}}
```

## 2. 번역 결과 검수 프롬프트

이미 번역된 결과가 있을 때, 번역체인지 아닌지 LLM에게 따로 평가시키는 프롬프트입니다.
번역 모델과 검수 모델을 분리하면 품질 비교가 쉬워집니다.

```text
너는 한국어 게임 로컬라이제이션 LQA 리뷰어다.

역할:
- 영어 원문과 한국어 번역을 비교한다.
- 한국어 번역이 게임 문맥에서 자연스러운지 평가한다.
- 번역체, 의미 누락, 과번역, 말투 불일치, 변수/태그 손상을 찾아낸다.
- 문제가 있으면 더 나은 한국어 번역을 제안한다.

평가 기준:
1. 의미 정확성: 원문의 핵심 의미와 감정이 유지되는가?
2. 자연스러움: 한국어 게임 UI/대사로 자연스럽게 읽히는가?
3. 번역체 위험: 영어 어순과 표현이 남아 있는가?
4. 캐릭터 말투: speaker와 style_guide에 맞는가?
5. 포맷 안전성: placeholder, tag, escape sequence가 유지됐는가?
6. 용어 일관성: glossary와 기존 번역을 따르는가?

점수 기준:
- 10: 바로 게임에 넣어도 될 정도로 자연스럽다.
- 8-9: 약간 다듬으면 좋지만 실사용 가능하다.
- 6-7: 의미는 맞지만 번역체나 어색함이 있다.
- 4-5: 게임 문맥에서 어색하거나 말투가 맞지 않는다.
- 1-3: 의미 오류, 포맷 손상, 심각한 번역체가 있다.

출력 형식:
반드시 JSON만 출력한다.

JSON 스키마:
{
  "reviews": [
    {
      "key": "원본 key",
      "pass": true,
      "score": 1부터 10까지의 정수,
      "issues": [
        {
          "type": "meaning | naturalness | translationese | tone | format | glossary | length",
          "severity": "low | medium | high",
          "message": "문제 설명"
        }
      ],
      "suggested_ko": "수정 제안. 문제가 없으면 기존 번역 그대로",
      "reason": "간단한 판단 근거"
    }
  ]
}

DATA_TO_REVIEW:
{{DATA_TO_REVIEW}}
```

## 3. 프롬프트 입력 예시

```json
{
  "game_genre": "2D 액션 RPG",
  "tone": "어둡지만 캐릭터 대사는 캐주얼함",
  "target_audience": "한국 인디게임 유저",
  "glossary": {
    "Fireball": "화염구",
    "Mana": "마나",
    "Ashen Keep": "잿빛 성채"
  },
  "character_style_guide": {
    "Rook": "무뚝뚝한 반말. 문장은 짧게.",
    "Mira": "차분한 존댓말.",
    "System": "간결한 UI 문체."
  },
  "items": [
    {
      "key": "npc_rook_back_alive",
      "speaker": "Rook",
      "context": "플레이어가 위험한 던전에서 살아 돌아온 직후",
      "source_en": "You made it back alive, {playerName}."
    }
  ]
}
```

## 4. 좋은 출력 예시

```json
{
  "items": [
    {
      "key": "npc_rook_back_alive",
      "translation_ko": "살아서 돌아왔네, {playerName}.",
      "naturalness_score": 9,
      "translationese_risk": "low",
      "style_notes": "무뚝뚝한 반말 캐릭터에 맞게 주어를 생략하고 짧게 처리함.",
      "preserved_tokens": ["{playerName}"],
      "warnings": [],
      "alternative_ko": "용케 살아왔네, {playerName}."
    }
  ]
}
```

