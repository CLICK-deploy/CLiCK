import { API_BASE_URL } from "../config";

chrome.runtime.onInstalled.addListener(() => {
    console.log("CLICK extension installed.");
});

// 콘텐츠 스크립트로부터 메시지를 받기 위한 리스너 추가
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // 프롬프트 분석 요청
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

    // 추천 프롬프트 목록 조회 요청
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

    // 로그인 요청 (기존 사용자)
    if (message.type === "LOGIN") {
        (async () => {
            try {
                // 테스트계정
                if (message.userId === "test" && message.password === "tt") {
                    console.log("테스트 계정 로그인 성공");
                    
                    // Chrome Storage에 저장
                    await chrome.storage.local.set({
                        userID: "test",
                        isLoggedIn: true,
                        loginTime: Date.now()
                    });

                    // 모든 ChatGPT 탭에 로그인 성공 메시지 전송
                    chrome.tabs.query({ url: ["https://chatgpt.com/*", "https://chat.openai.com/*"] }, (tabs) => {
                        tabs.forEach(tab => {
                            chrome.tabs.sendMessage(tab.id, { type: "LOGIN_SUCCESS" });
                        });
                    });
                    
                    sendResponse({ success: true, userID: "test" });
                    return;
                }
            
                const response = await fetch(
                    `${API_BASE_URL}/api/login`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({ 
                            userId: message.userId,
                            password: message.password
                        }),
                    }
                );

                if (!response.ok) {
                    throw new Error(
                        `Login failed with status: ${response.status}`
                    );
                }

                const data = await response.json();
                
                // 로그인 성공 시 Chrome Storage에 저장
                await chrome.storage.local.set({
                    userID: data.userID || message.userId,
                    isLoggedIn: true,
                    loginTime: Date.now()
                });

                // 모든 ChatGPT 탭에 로그인 성공 메시지 전송
                chrome.tabs.query({ url: ["https://chatgpt.com/*", "https://chat.openai.com/*"] }, (tabs) => {
                    tabs.forEach(tab => {
                        chrome.tabs.sendMessage(tab.id, { type: "LOGIN_SUCCESS" });
                    });
                });

                sendResponse({ success: true, userID: data.userID || message.userId }); 
            } catch (error) {
                console.error("로그인 API 요청 실패:", error);
                sendResponse({ success: false, error: error.message }); 
            }
        })();

        return true;
    }

    // 회원가입 요청 (신규 사용자)
    if (message.type === "SIGNUP") {
        (async () => {
            try {
                const response = await fetch(
                    `${API_BASE_URL}/api/signup`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({ 
                            userId: message.userId,
                            password: message.password,
                            ageGroup: message.ageGroup,
                            gender: message.gender
                        }),
                    }
                );

                if (!response.ok) {
                    throw new Error(
                        `Signup failed with status: ${response.status}`
                    );
                }

                const data = await response.json();
                
                // 회원가입 성공 시 자동 로그인
                await chrome.storage.local.set({
                    userID: data.userID || message.userId,
                    isLoggedIn: true,
                    loginTime: Date.now()
                });

                // 모든 ChatGPT 탭에 로그인 성공 메시지 전송
                chrome.tabs.query({ url: ["https://chatgpt.com/*", "https://chat.openai.com/*"] }, (tabs) => {
                    tabs.forEach(tab => {
                        chrome.tabs.sendMessage(tab.id, { type: "LOGIN_SUCCESS" });
                    });
                });

                sendResponse({ success: true, userID: data.userID || message.userId }); 
            } catch (error) {
                console.error("회원가입 API 요청 실패:", error);
                sendResponse({ success: false, error: error.message }); 
            }
        })();

        return true;
    }

    // 로그아웃 요청
    if (message.type === "LOGOUT") {
        (async () => {
            try {
                await chrome.storage.local.remove(['userID', 'isLoggedIn', 'loginTime']);
                sendResponse({ success: true }); 
            } catch (error) {
                console.error("로그아웃 실패:", error);
                sendResponse({ success: false, error: error.message }); 
            }
        })();

        return true;
    }

    // 로그인 상태 확인 요청
    if (message.type === "CHECK_LOGIN") {
        (async () => {
            try {
                const data = await chrome.storage.local.get(['userID', 'isLoggedIn']);
                sendResponse({ 
                    isLoggedIn: data.isLoggedIn || false, 
                    userID: data.userID || null 
                }); 
            } catch (error) {
                console.error("로그인 상태 확인 실패:", error);
                sendResponse({ isLoggedIn: false, userID: null }); 
            }
        })();

        return true;
    }

    // 로그인 페이지 열기 요청
    if (message.type === "OPEN_LOGIN_PAGE") {
        chrome.tabs.create({
            url: chrome.runtime.getURL('login.html')
        });
        sendResponse({ success: true });
        return true;
    }

    // 회원가입 페이지 열기 요청
    if (message.type === "OPEN_SIGNUP_PAGE") {
        chrome.tabs.create({
            url: chrome.runtime.getURL('signin.html')
        });
        sendResponse({ success: true });
        return true;
    }

    // 닉네임 중복 확인 요청
    if (message.type === "CHECK_DUPLICATE") {
    (async () => {
        try {

            // 테스트계정
            if (message.userId === "test") {
                console.log("테스트 계정입니다.");
                sendResponse({ available: true });
                return;
            }
            
            const response = await fetch(
                `${API_BASE_URL}/api/check-duplicate`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ 
                        userId: message.userId
                    }),
                }
            );

            if (!response.ok) {
                throw new Error(`Check failed: ${response.status}`);
            }

            const data = await response.json();
            console.log("중복 확인 응답:", data);
            
            sendResponse({ available: data.available }); 
        } catch (error) {
            console.error("중복 확인 실패:", error);
            sendResponse({ available: false, error: error.message }); 
        }
        })();

    return true;
    }
});
