# CLiCK Extension Backend API Specification

## 1. 개요

본 문서는 CLiCK Chrome 확장 프로그램의 기능 지원을 위한 백엔드 API의 명세서를 정의합니다. 클라이언트는 본 명세서에 따라 API를 호출하고 응답을 처리합니다.

## 2. 공통 사항

-   Content-Type: 모든 `POST` 요청의 Body는 `application/json` 형식을 사용
-   인증: 현재 별도의 인증 절차는 없으나, 향후 API Key 기반 인증이 추가될 수 있음

---

## 3. API 엔드포인트

### 3.1. 프롬프트 분석 API

사용자가 입력한 프롬프트를 분석하여 개선안을 제안합니다.

-   Endpoint: `/api/analyze-prompt`
-   HTTP Method: `POST`
-   Description\*\*: 전달받은 프롬프트 텍스트를 백엔드의 LLM(OpenAI)을 통해 분석하고, 발견된 문제점(태그), 부분 수정안(패치), 그리고 전체 수정 제안을 포함하는 JSON 객체를 반환합니다.

#### 요청 (Input)

-   Body:
    ```json
    {
        "userID": "string",
        "chatID": "string",
        "prompt": "string"
    }
    ```
-   상세:

    -   `userID`: 사용자가 설정한 사용자의 닉네임입니다.
    -   `chatID`: 사용자의 현재 채팅이 어디인지 보여주는 string입니다. href에 있는 정보로 식별합니다.
    -   `prompt`: 사용자가 ChatGPT 입력창에 작성한 후, 분석하기 버튼을 눌렀을 때 입력창에 있는 string입니다.

-   예시:

    ```json
    {
        "userID": "복지관빨대도둑",
        "chatID": "/c/68e396fc-2590-8324-9f0c-4388bf926421",
        "prompt": "GPT에게 창의적으로 모든 연령대가 이해할 수 있는 이야기를 요약해 줘"
    }
    ```

-   note. 우선 이렇게 적어놨는데, 주제에 대해 조금 더 고민해본다면 여기에서 받는 정보를 좀 더 늘려야 하지 않을까 하는 생각은 드네요. 글자 수 제한은 한 8000자 정도 하면 되지 않을까 싶습니다

#### 응답 (Output)

-   성공 (200 OK):
    ```json
    {
        "tags": ["string"],
        "patches": {
            "tag_name": { "from": "string", "to": "string" }
        },
        "full_suggestion": "string"
    }
    ```
-   상세:

    -   `tags`: 분석된 문제점의 종류를 나타내는 문자열 배열입니다. (예: `"모호성/지시 불명확"`, `"구조/길이 중복"`)
    -   `patches`: 특정 `tag`에 해당하는 부분 수정 제안 목록입니다. `patches` 객체의 키는 `tags` 배열에 포함된 문자열과 일치합니다.
        -   `from`: 원본 텍스트에서 수정이 필요한 부분입니다.
        -   `to`: `from` 부분을 대체할 제안 텍스트입니다.
    -   `full_suggestion`: 백엔드가 프롬프트 전체를 수정한 완전한 제안 텍스트입니다.

-   예시:

    ```json
    {
        "tags": ["모호성/지시 불명확", "문체/스타일 개선"],
        "patches": {
            "모호성/지시 불명확": {
                "from": "요약해 줘",
                "to": "3문장으로 요약해 줘"
            },
            "문체/스타일 개선": {
                "from": "GPT에게 창의적으로 모든 연령대가 이해할 수 있는 이야기를",
                "to": "모든 연령대가 이해할 수 있는 이야기를 GPT에게 창의적으로"
            }
        },
        "full_suggestion": "모든 연령대가 이해할 수 있는 이야기를 GPT에게 창의적으로 요약해 줘"
    }
    ```

-   note. tags에 들어갈 string을 일관된 표현으로 전달해주시면, 프론트에서 표현들을 받아 color를 지정해놓을 생각입니다. 태그들이 오는 순서는 input으로 들어온 string에서의 개선 순서대로 patches의 순서와 동일하게 주시면 될 것 같습니다. c++로 보면 patches는 vector<unordered_map<string, unordered_map<string, string>>>이 될 것 같습니다.

-   실패 (4xx/5xx):
    ```json
    {
        "error": "string"
    }
    ```
-   상세:
    -   `error`: 분석 실패 원인을 설명하는 메시지입니다.

### 3.2. 추천 프롬프트 목록 조회 API

사용자의 현재 채팅 맥락에 따라 맞춤형 추천 프롬프트를 제공합니다.

-   Endpoint: `/api/recommended-prompts`
-   HTTP Method: `POST`
-   Description: 사용자 식별자와 현재 채팅 ID를 전달받습니다. 특정 채팅 ID가 제공되면 해당 채팅의 대화 내용을 기반으로, 채팅 ID가 `null`이면 사용자의 전체 대화 기록을 기반으로 맞춤형 추천 프롬프트를 생성하여 반환합니다.

#### 요청 (Input)

-   Body:
    ```json
    {
        "userID": "string",
        "chatID": "string | null"
    }
    ```
-   상세:

    -   `userID`: 사용자를 식별하기 위한 고유 값입니다. (예: ChatGPT 유저 닉네임)
    -   `chatID`: 현재 채팅방의 고유 ID입니다. '새 채팅' 화면일 경우 이 값을 `null`로 전송하여, 사용자의 전체 대화 기반 추천을 요청합니다.

-   예시 (특정 채팅):

    ```json
    {
        "userID": "복지관빨대도둑",
        "chatID": "/c/68e396fc-2590-8324-9f0c-4388bf926421"
    }
    ```

-   예시 (새 채팅):
    ```json
    {
        "userID": "복지관빨대도둑",
        "chatID": null
    }
    ```

#### 응답 (Output)

-   성공 (200 OK):
    -   이제 응답은 채팅 ID를 키로, 각 키에 해당하는 추천 프롬프트 배열을 값으로 갖는 **객체** 형식입니다.
    -   '새 채팅'에 대한 추천은 `global` 키에 포함됩니다.
    ```json
    {
        "/c/68e396fc-2590-8324-9f0c-4388bf926421": [
            {
                "id": 1,
                "title": "C++ 포인터 심화 질문",
                "content": "C++에서 스마트 포인터와 일반 포인터의 메모리 관리 방식 차이를 설명해줘."
            }
        ],
        "global": [
            {
                "id": 2,
                "title": "데이터 구조 복습",
                "content": "스택과 큐의 차이점을 초등학생도 이해할 수 있도록 비유를 들어 설명해줘."
            }
        ]
    }
    ```
-   상세:

    -   `[chatId]` (동적 키): 각 채팅방의 고유 ID를 나타내는 키입니다.
    -   `global`: `chatId`가 `null`로 요청되었을 때, 사용자의 전체 대화 기반 추천 목록을 담는 키입니다.
    -   각 키의 값은 다음을 포함하는 프롬프트 객체의 배열입니다.
        -   `id`: 프롬프트의 고유 식별자입니다.
        -   `title`: 사이드바에 표시될 프롬프트의 제목입니다.
        -   `content`: 클릭 시 ChatGPT 입력창에 채워질 프롬프트의 전체 내용입니다.

-   실패 (5xx):
    ```json
    {
        "error": "string"
    }
    ```
-   상세:
    -   `error`: 목록 조회 실패 원인을 설명하는 메시지입니다.


### 3.3. 로그인 API

사용자 인증을 처리하고, 인증 성공 시 사용자 ID를 반환합니다.

-   Endpoint: `/api/login`
-   HTTP Method: `POST`
-   Description: 사용자의 닉네임과 패스워드를 받아 인증을 수행합니다. 인증 성공 시 userID를 반환하며, 클라이언트는 이를 Chrome Storage에 저장하여 이후 모든 API 요청에 사용합니다.

#### 요청 (Input)

-   Body:
    ```json
    {
        "userId": "string",
        "password": "string"
    }
    ```
-   상세:

    -   `userId:`: 사용자가 설정한 닉네임입니다.
    -   `password`: 사용자의 패스워드입니다.

-   예시:

    ```json
    {
        "userId": "복지관빨대도둑",
        "password": "mySecurePassword123"
    }
    ```

#### 응답 (Output)

-   성공 (200 OK):
    ```json
    {
        "userID": "string",
        "message": "Login successful"
    }
    ```
-   상세:

    -   `userID`: 인증된 사용자의 고유 식별자입니다. (예: username 또는 별도 생성된 ID)
    -   `message`: 로그인 성공 메시지입니다. (선택사항)

-   예시:

    ```json
    {
        "userID": "복지관빨대도둑",
        "message": "Login successful"
    }
    ```

-   실패 (401 Unauthorized):
    ```json
    {
        "error": "Invalid credentials"
    }
    ```
-   실패 (500 Internal Server Error):
    ```json
    {
        "error": "Internal server error"
    }
    ```
-   상세:
    -   `error`: 로그인 실패 원인을 설명하는 메시지입니다.
        -   `"Invalid credentials"`: 잘못된 사용자명 또는 패스워드
        -   `"Internal server error"`: 서버 내부 오류

-   note: 
    -   클라이언트는 성공 시 `userID`를 Chrome Storage에 저장합니다.
    -   이후 모든 API 요청(`ANALYZE_PROMPT`, `FETCH_RECOMMENDED_PROMPTS`)에서 이 `userID`를 사용합니다.
    -   로그아웃 시 클라이언트는 Chrome Storage에서 `userID`와 로그인 상태를 삭제합니다.
