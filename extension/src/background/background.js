import { API_BASE_URL, TOSS_CLIENT_KEY } from "../config";

chrome.runtime.onInstalled.addListener(() => {
    console.log("CLICK extension installed.");
});

// 토스페이먼츠 결제 리다이렉트 감지 (success / fail)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status !== "loading") return;
    const url = tab.url || changeInfo.url;
    if (!url) return;

    const SUCCESS_URL = `${API_BASE_URL}/api/payment/success`;
    const FAIL_URL    = `${API_BASE_URL}/api/payment/fail`;

    if (url.startsWith(SUCCESS_URL)) {
        const params = new URL(url).searchParams;
        const paymentKey = params.get("paymentKey");
        const orderId    = params.get("orderId");
        const amount     = parseInt(params.get("amount"), 10);

        try {
            const data = await chrome.storage.local.get(["pendingPayment"]);
            const pending = data.pendingPayment;

            if (!pending || pending.orderId !== orderId) {
                console.error("[Payment] pendingPayment 불일치:", orderId);
                return;
            }

            // 백엔드에 결제 확인 요청
            const res = await fetch(`${API_BASE_URL}/api/payment/confirm`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    paymentKey,
                    orderId,
                    amount,
                    userID: pending.userID,
                }),
            });

            const result = await res.json();

            if (res.ok && result.success) {
                await chrome.storage.local.set({ plan: pending.plan });
                console.log(`[Payment] 결제 성공: ${pending.plan} 플랜 적용`);
            } else {
                console.error("[Payment] 결제 확인 실패:", result.error);
            }
        } catch (err) {
            console.error("[Payment] 결제 확인 중 오류:", err);
        } finally {
            await chrome.storage.local.remove(["pendingPayment"]);
            chrome.tabs.remove(tabId);
        }
    }

    if (url.startsWith(FAIL_URL)) {
        console.warn("[Payment] 결제 실패 또는 취소");
        await chrome.storage.local.remove(["pendingPayment"]);
        chrome.tabs.remove(tabId);
    }
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

    // 유저 입력 프롬프트 히스토리 저장
    if (message.type === "TRACE_INPUT") {
        (async () => {
            try {
                const response = await fetch(
                    `${API_BASE_URL}/api/trace_input`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            userID: message.userID,
                            chatID: message.chatID,
                            prompt: message.prompt,
                        }),
                    }
                );
                if (!response.ok) throw new Error(`trace_input failed: ${response.status}`);
                const data = await response.json();
                sendResponse(data);
            } catch (error) {
                console.error("trace_input 요청 실패:", error);
                sendResponse({ error: error.message });
            }
        })();
        return true;
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
            url: chrome.runtime.getURL('html/login.html')
        });
        sendResponse({ success: true });
        return true;
    }

    // 회원가입 페이지 열기 요청
    if (message.type === "OPEN_SIGNUP_PAGE") {
        chrome.tabs.create({
            url: chrome.runtime.getURL('html/signin.html')
        });
        sendResponse({ success: true });
        return true;
    }

    // 결제 페이지 열기 요청
    if (message.type === "OPEN_PAYMENT_PAGE") {
        chrome.tabs.create({
            url: chrome.runtime.getURL('html/payment.html')
        });
        sendResponse({ success: true });
        return true;
    }

    // 플랜 선택 요청
    if (message.type === "SELECT_PLAN") {
        (async () => {
            try {
                await chrome.storage.local.set({ plan: message.plan });
                sendResponse({ success: true });
            } catch (error) {
                console.error("플랜 저장 실패:", error);
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }

    // 유료 플랜 결제 시작 요청 — 서버의 결제 웹페이지를 새 탭으로 열어 TossPayments 처리
    if (message.type === "OPEN_TOSS_PAYMENT") {
        (async () => {
            try {
                await chrome.storage.local.set({
                    pendingPayment: {
                        orderId: message.orderId,
                        plan: message.plan,
                        amount: message.amount,
                        userID: message.userID,
                    },
                });
                const params = new URLSearchParams({
                    userID: message.userID,
                    plan: message.plan,
                    orderId: message.orderId,
                    amount: String(message.amount),
                    clientKey: TOSS_CLIENT_KEY,
                });
                chrome.tabs.create({ url: `${API_BASE_URL}/payment?${params}` });
                sendResponse({ success: true });
            } catch (error) {
                console.error("[Payment] 결제 페이지 열기 실패:", error);
                sendResponse({ success: false, error: error.message });
            }
        })();
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
