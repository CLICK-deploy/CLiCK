import { API_BASE_URL } from "../config";

chrome.runtime.onInstalled.addListener(() => {
    console.log("CLICK extension installed.");
});

// 콘텐츠 스크립트로부터 메시지를 받기 위한 리스너 추가
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // 메시지 타입이 'ANALYZE_PROMPT'일 때만 작동
    if (message.type === "ANALYZE_PROMPT") {
        // 비동기 응답을 위해 true를 반환해야 합니다.
        (async () => {
            try {
                const response = await fetch(
                    `${API_BASE_URL}/api/analyze-prompt`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({ 
                            userID: message.userID,
                            chatID: message.chatID,
                            prompt: message.prompt 
                        }),
                    }
                );

                if (!response.ok) {
                    throw new Error(
                        `Server responded with status: ${response.status}`
                    );
                }

                const data = await response.json();
                sendResponse(data); 
            } catch (error) {
                console.error("분석 API 요청 실패:", error);
                sendResponse({ error: error.message }); 
            }
        })();

        return true; // 비동기 sendResponse를 사용하려면 반드시 true를 반환
    }

    // 2. 추천 프롬프트 목록 조회 요청
    if (message.type === "FETCH_RECOMMENDED_PROMPTS") {
        (async () => {
            try {
                const response = await fetch(
                    `${API_BASE_URL}/api/recommended-prompts`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        // Spec에 맞춰 userID, chatID 전송
                        body: JSON.stringify({ 
                            userID: message.userID,
                            chatID: message.chatID 
                        }),
                    }
                );

                if (!response.ok) {
                    throw new Error(
                        `Server responded with status: ${response.status}`
                    );
                }

                const data = await response.json();
                sendResponse(data); 
            } catch (error) {
                console.error("추천 프롬프트 API 요청 실패:", error);
                sendResponse({ error: error.message });
            }
        })();

        return true; // 비동기 응답 대기
    }
});
