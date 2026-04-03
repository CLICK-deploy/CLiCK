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
                    plan: pending.plan,
                }),
            });

            const result = await res.json();

            if (res.ok && result.success) {
                await chrome.storage.local.set({ plan: pending.plan });
                console.log(`[Payment] 결제 성공: ${pending.plan} 플랜 적용`);
                // payment.html 탭에 성공 알림 전송
                if (clickAppTabId !== null) {
                    chrome.tabs.sendMessage(clickAppTabId, { type: "PAYMENT_SUCCESS", plan: pending.plan });
                }
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
        // payment.html 탭에 취소 알림 전송 → UI 복구
        if (clickAppTabId !== null) {
            chrome.tabs.sendMessage(clickAppTabId, { type: "PAYMENT_CANCELLED" });
        }
    }
});

// 콘텐츠 스크립트로부터 메시지를 받기 위한 리스너 추가

// 로그인/회원가입/결제 페이지 공용 탭 ID (메모리 유지)
let clickAppTabId = null;

// CLiCK 전용 탭 하나만 사용 — 이미 열려 있으면 URL만 전환, 없으면 새 탭 생성
function openClickAppTab(url, senderTabIndex) {
    const open = () => chrome.tabs.create({ url, index: senderTabIndex + 1 }, (tab) => {
        clickAppTabId = tab.id;
    });

    if (clickAppTabId === null) {
        open();
        return;
    }

    chrome.tabs.get(clickAppTabId, (tab) => {
        if (chrome.runtime.lastError || !tab) {
            // 탭이 이미 닫혀 있으면 새로 생성
            clickAppTabId = null;
            open();
        } else {
            // 탭이 살아 있으면 URL만 바꾸고 포커스
            chrome.tabs.update(clickAppTabId, { url, active: true });
            chrome.windows.update(tab.windowId, { focused: true });
        }
    });
}

// CLiCK 앱 탭이 닫히면 ID 초기화
chrome.tabs.onRemoved.addListener((tabId) => {
    if (tabId === clickAppTabId) clickAppTabId = null;
});

// 토큰 자동 갱신 헬퍼
async function refreshAccessToken() {
    const storage = await chrome.storage.local.get(['refresh_token']);
    const refreshToken = storage.refresh_token;
    if (!refreshToken) throw new Error('리프레시 토큰이 없습니다.');

    const res = await fetch(`${API_BASE_URL}/api/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) throw new Error('리프레시 토큰이 만료되었습니다. 다시 로그인해주세요.');

    const data = await res.json();
    await chrome.storage.local.set({ access_token: data.access_token });
    return data.access_token;
}

// JWT의 만료 시각(ms) 추출
function getTokenExpiry(token) {
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (!payload.exp) return Infinity; // exp 필드 없으면 만료 없음으로 간주
        return payload.exp * 1000;
    } catch {
        // 파싱 실패 시 Infinity 반환 → 프리엠프티브 갱신 미발생, 401 발생 시 갱신 처리
        return Infinity;
    }
}

// 세션 만료 처리 — 스토리지 초기화 후 모든 탭에 SESSION_EXPIRED 브로드캐스트
async function handleSessionExpired() {
    await chrome.storage.local.remove(['userID', 'access_token', 'refresh_token', 'isLoggedIn', 'loginTime']);
    chrome.tabs.query({ url: ['https://chatgpt.com/*', 'https://chat.openai.com/*'] }, (tabs) => {
        tabs.forEach(tab => chrome.tabs.sendMessage(tab.id, { type: 'SESSION_EXPIRED' }));
    });
}

// Authorization 헤더를 포함한 fetch — 만료 5분 전 미리 갱신, 401 시 1회 재시도
async function fetchWithAuth(url, options = {}) {
    const storage = await chrome.storage.local.get(['access_token']);
    let token = storage.access_token;
    if (!token) throw new Error('로그인이 필요합니다.');

    // 토큰이 5분 이내로 남았으면 요청 전에 미리 갱신 (실패해도 기존 토큰으로 계속 시도)
    if (getTokenExpiry(token) - Date.now() < 5 * 60 * 1000) {
        try {
            token = await refreshAccessToken();
        } catch (e) {
            console.warn('[fetchWithAuth] 선제적 토큰 갱신 실패, 기존 토큰으로 진행:', e.message);
        }
    }

    const makeRequest = (t) => fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
            Authorization: `Bearer ${t}`,
        },
    });

    let response = await makeRequest(token);
    if (response.status === 401) {
        // 만료 체크를 통과했어도 실패하면 갱신 재시도, 그것도 실패하면 세션 만료 처리
        try {
            token = await refreshAccessToken();
            response = await makeRequest(token);
        } catch (e) {
            await handleSessionExpired();
            const err = new Error('SESSION_EXPIRED');
            err.isSessionExpired = true;
            throw err;
        }
    }
    return response;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // 프롬프트 분석 요청
    if (message.type === "ANALYZE_PROMPT") {
        // 비동기 응답을 위해 true를 반환해야 합니다.
        (async () => {
            try {
                const response = await fetchWithAuth(
                    `${API_BASE_URL}/api/analyze-prompt`,
                    {
                        method: "POST",
                        body: JSON.stringify({ 
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
                // 토큰 없으면 (테스트 계정 or 미로그인) 조용히 스킵
                const { access_token } = await chrome.storage.local.get(['access_token']);
                if (!access_token) { sendResponse({ skipped: true }); return; }

                const traceBody = {
                    chatID: message.chatID,
                    prompt: message.prompt,
                };
                if (message.recommendedPromptId != null) {
                    traceBody.recommendedPromptId = message.recommendedPromptId;
                }
                const response = await fetchWithAuth(
                    `${API_BASE_URL}/api/trace_input`,
                    {
                        method: "POST",
                        body: JSON.stringify(traceBody),
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

    // GPT 출력 기록
    if (message.type === "TRACE_OUTPUT") {
        (async () => {
            try {
                const { access_token } = await chrome.storage.local.get(['access_token']);
                if (!access_token) { sendResponse({ skipped: true }); return; }

                const response = await fetchWithAuth(
                    `${API_BASE_URL}/api/trace_output`,
                    {
                        method: "POST",
                        body: JSON.stringify({
                            chatID: message.chatID,
                            output: message.output,
                        }),
                    }
                );
                if (!response.ok) throw new Error(`trace_output failed: ${response.status}`);
                const data = await response.json();
                sendResponse(data);
            } catch (error) {
                console.error("trace_output 요청 실패:", error);
                sendResponse({ error: error.message });
            }
        })();
        return true;
    }

    // 추천 프롬프트 목록 조회 요청
    if (message.type === "FETCH_RECOMMENDED_PROMPTS") {
        (async () => {
            try {
                // 토큰 없으면 (테스트 계정 or 미로그인) 조용히 스킵
                const { access_token } = await chrome.storage.local.get(['access_token']);
                if (!access_token) { sendResponse({}); return; }

                const response = await fetchWithAuth(
                    `${API_BASE_URL}/api/recommended-prompts`,
                    {
                        method: "POST",
                        body: JSON.stringify({ 
                            chatID: message.chatID,
                            generate: message.generate !== false,  // 명시적으로 false일 때만 DB 조회
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
                    
                    // 기존 토큰 제거 후 테스트 계정 상태 저장 (stale 토큰이 남지 않도록)
                    await chrome.storage.local.remove(['access_token', 'refresh_token']);
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
                
                // 디버그: 백엔드 로그인 응답 확인
                console.log("[LOGIN] 백엔드 응답 키:", Object.keys(data));
                console.log("[LOGIN] access_token 존재:", !!data.access_token);
                console.log("[LOGIN] refresh_token 존재:", !!data.refresh_token);

                // 로그인 성공 시 Chrome Storage에 저장 (토큰 포함)
                const storageData = {
                    userID: data.userID || message.userId,
                    access_token: data.access_token,
                    isLoggedIn: true,
                    loginTime: Date.now()
                };
                // refresh_token이 실제로 있을 때만 저장 (undefined로 덮어쓰기 방지)
                if (data.refresh_token) {
                    storageData.refresh_token = data.refresh_token;
                } else {
                    console.warn("[LOGIN] 백엔드가 refresh_token을 반환하지 않았습니다.");
                    // 이전 세션의 만료된 refresh_token 제거
                    await chrome.storage.local.remove('refresh_token');
                }
                await chrome.storage.local.set(storageData);

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
                
                // 회원가입 성공 시 자동 로그인 (토큰 포함)
                await chrome.storage.local.set({
                    userID: data.userID || message.userId,
                    access_token: data.access_token,
                    refresh_token: data.refresh_token,
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
                await chrome.storage.local.remove(['userID', 'access_token', 'refresh_token', 'isLoggedIn', 'loginTime']);
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
                const data = await chrome.storage.local.get(['userID', 'isLoggedIn', 'access_token']);
                sendResponse({ 
                    isLoggedIn: data.isLoggedIn || false, 
                    userID: data.userID || null,
                    access_token: data.access_token || null,
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
        openClickAppTab(chrome.runtime.getURL('html/login.html'), sender.tab?.index ?? 0);
        sendResponse({ success: true });
        return true;
    }

    // 회원가입 페이지 열기 요청
    if (message.type === "OPEN_SIGNUP_PAGE") {
        openClickAppTab(chrome.runtime.getURL('html/signin.html'), sender.tab?.index ?? 0);
        sendResponse({ success: true });
        return true;
    }

    // 결제 페이지 열기 요청
    if (message.type === "OPEN_PAYMENT_PAGE") {
        openClickAppTab(chrome.runtime.getURL('html/payment.html'), sender.tab?.index ?? 0);
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
                const paymentUrl = `${API_BASE_URL}/payment?${params}`;
                // 이미 열린 결제 탭이 있으면 URL 업데이트, 없으면 새 탭
                chrome.tabs.query({ url: `${API_BASE_URL}/payment*` }, (tabs) => {
                    if (tabs.length > 0) {
                        chrome.tabs.update(tabs[0].id, { url: paymentUrl, active: true });
                        chrome.windows.update(tabs[0].windowId, { focused: true });
                    } else {
                        chrome.tabs.create({
                            url: paymentUrl,
                            index: (sender.tab?.index ?? 0) + 1,
                        });
                    }
                });
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

    // 구독 취소
    if (message.type === "CANCEL_SUBSCRIPTION") {
        (async () => {
            try {
                const response = await fetchWithAuth(`${API_BASE_URL}/api/payment/cancel`, { method: "POST" });
                if (!response.ok) throw new Error(`Status: ${response.status}`);
                await chrome.storage.local.set({ plan: "free" });
                sendResponse({ success: true });
            } catch (error) {
                console.error("구독 취소 실패:", error);
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }

    // 사용자 구독/크레딧 정보 조회
    if (message.type === "GET_USER_INFO") {
        (async () => {
            try {
                const response = await fetchWithAuth(`${API_BASE_URL}/api/user/info`);
                if (!response.ok) throw new Error(`Status: ${response.status}`);
                const data = await response.json();
                sendResponse(data);
            } catch (error) {
                console.error("사용자 정보 조회 실패:", error);
                sendResponse({ error: error.message });
            }
        })();
        return true;
    }

    // 만족도 조사 제출
    if (message.type === "SUBMIT_SURVEY") {
        (async () => {
            try {
                const { access_token, userID } = await chrome.storage.local.get(['access_token', 'userID']);
                if (!access_token) { sendResponse({ skipped: true }); return; }

                const response = await fetchWithAuth(
                    `${API_BASE_URL}/api/survey`,
                    {
                        method: "POST",
                        body: JSON.stringify({
                            rating: message.rating,
                        }),
                    }
                );
                if (!response.ok) {
                    sendResponse({ success: false, error: `Survey failed: ${response.status}` });
                    return;
                }
                const data = await response.json();
                sendResponse({ success: true, data });
            } catch (error) {
                console.error("만족도 제출 실패:", error);
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }
});
