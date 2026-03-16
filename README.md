# CLiCK

ChatGPT 화면에 직접 붙어서 동작하는 Chrome 확장 프로그램입니다.  
사용자의 질문 히스토리를 분석해 **다음 질문을 추천**하고, 입력한 프롬프트를 **AI가 개선**해주는 기능을 제공합니다.

---

## 주요 기능

| 기능 | 설명 |
|------|------|
| 추천 프롬프트 | 이전 대화 히스토리 기반으로 다음 질문을 AI가 추천 |
| 프롬프트 개선 | 입력한 프롬프트를 Gemini가 분석해 더 나은 표현으로 수정 제안 |
| 회원가입 / 로그인 | 닉네임·비밀번호 기반 계정으로 개인화된 추천 제공 |
| 사이드바 UI | ChatGPT 사이드바에 추천 프롬프트를 자연스럽게 통합 |

---

## 기술 스택

- **Framework**: React 18 + Vite
- **Language**: JavaScript (JSX)
- **Build output**: Chrome Extension (Manifest V3)
- **API 통신**: Chrome Extension Message Passing + `fetch`

---

## 프로젝트 구조

```
extension/
├── public/
│   ├── manifest.json       # 확장 프로그램 설정
│   ├── login.html          # 로그인 팝업 페이지
│   └── signin.html         # 회원가입 팝업 페이지
├── src/
│   ├── config.jsx          # API 서버 주소 설정
│   ├── main.jsx            # Content Script 진입점 (ChatGPT 페이지에 주입)
│   ├── background/
│   │   └── background.js   # Service Worker (백엔드 API 중계)
│   └── components/
│       ├── Sidebar.jsx     # 추천 프롬프트 사이드바
│       ├── PromptInput.jsx # 프롬프트 개선 버튼 및 패널
│       ├── Settings.jsx    # 로그인/로그아웃/회원가입 메뉴
│       └── Login.jsx       # 로그인 폼
└── dist/                   # 빌드 결과물 (Chrome에 로드)
```

---

## 시작하기

### 1. 의존성 설치

```bash
cd extension
npm install
```

### 2. API 서버 주소 설정

`src/config.jsx`에서 백엔드 주소를 설정합니다.

```js
export const API_BASE_URL = "http://YOUR_SERVER_IP:8000";
```

### 3. 빌드

```bash
npm run build
```

`dist/` 폴더가 생성됩니다.

### 4. Chrome에 로드

1. Chrome 주소창에 `chrome://extensions` 입력
2. 우측 상단 **개발자 모드** 활성화
3. **압축해제된 확장 프로그램을 로드합니다** 클릭
4. `extension/dist` 폴더 선택

---

## 동작 흐름

```
사용자 질문 입력
    │
    ├─► TRACE_INPUT 전송 → 백엔드 히스토리 저장
    │
    └─► FETCH_RECOMMENDED_PROMPTS 요청
            │
            └─► Gemini API가 히스토리 분석 후 추천 프롬프트 반환
                    │
                    └─► ChatGPT 사이드바에 추천 프롬프트 표시
```

---

## 관련 레포지토리

- 백엔드: [CLiCK-Backend](../CLiCK-Backend)

