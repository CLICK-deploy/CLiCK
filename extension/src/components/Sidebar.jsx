import { useState, useEffect } from 'react';
import Trailp from '../../images/trailing-pair.svg?react';

const MAX_PROMPTS = 2;

export default function Sidebar() {
    const [recommendedPrompts, setRecommendedPrompts] = useState([]);
    const [submitCount, setSubmitCount] = useState(0); 

    // 로그인된 사용자 ID 가져오기
    const getUserID = async () => {
        try {
            const response = await new Promise((resolve) => {
                chrome.runtime.sendMessage(
                    { type: "CHECK_LOGIN" }, 
                    resolve
                );
            });
            
            if (response.isLoggedIn && response.userID) {
                return response.userID;
            } else {
                return null;
            }
        } catch (error) {
            console.error('사용자 ID 가져오기 실패:', error);
            return null;
        }
    };

    // 현재 채팅방 ID 찾기 (URL에서 직접 읽기)
    const findCurrentChatId = () => {
        const path = window.location.pathname;
        return path.startsWith('/c/') ? path : null;
    };

    // 백엔드에서 프롬프트 가져옴
    useEffect(() => {
        const fetchPrompts = async () => {
            try {
                const currentUserID = await getUserID();
                console.log('[Sidebar] userID:', currentUserID);
                if (!currentUserID) {
                    console.log('[Sidebar] 로그인되지 않아 추천 프롬프트 요청 생략');
                    return;
                }

                const chatID = findCurrentChatId();
                console.log('[Sidebar] chatID:', chatID);
                if (!chatID) {
                    console.log('[Sidebar] chatID 없음 -> 추천 프롬프트 요청 생략');
                    return;
                }

                // background.js로 요청 위임
                const response = await new Promise((resolve, reject) => {
                    chrome.runtime.sendMessage(
                        { type: "FETCH_RECOMMENDED_PROMPTS", userID: currentUserID, chatID },
                        (res) => res && res.error ? reject(res.error) : resolve(res)
                    );
                });

                console.log('[Sidebar] 백엔드 응답:', response);

                // 응답이 { chatID: { title, content } } 단일 객체이거나 배열일 수 있음
                let rawData = [];
                if (Array.isArray(response)) {
                    rawData = response;
                } else if (response && typeof response === 'object') {
                    const candidates = response[chatID] || response.global || [];
                    if (Array.isArray(candidates)) {
                        rawData = candidates;
                    } else if (candidates && typeof candidates === 'object' && Object.keys(candidates).length > 0) {
                        // 백엔드가 단일 객체 { title, content } 로 반환하는 경우
                        rawData = [candidates];
                    }
                }

                const formattedData = rawData.map((item, index) => ({
                    title: item.title || item.subject || `추천 ${index + 1}`,
                    content: item.content || item.body || item.prompt || "",
                    id: item.id ?? `${Date.now()}-${index}`
                }));

                // 기존 목록에 새 항목 추가 후 MAX_PROMPTS 초과분은 오래된 것부터 제거
                setRecommendedPrompts(prev => [...prev, ...formattedData].slice(-MAX_PROMPTS));
            } catch (error) {
                console.error('[Sidebar] 프롬프트 로딩 에러:', error);
            }
        };

        fetchPrompts();
    }, [submitCount]); 

    // 버튼 클릭 및 엔터 키 감지 
    useEffect(() => {
        const triggerSubmit = async (promptText) => {
            if (!promptText) return;
            console.log("메시지 제출 감지됨! -> 프롬프트 갱신 요청");

            // 현재 입력 내용을 백엔드에 저장 (이후 추천의 근거 데이터)
            try {
                const currentUserID = await getUserID();
                const chatID = findCurrentChatId();
                if (currentUserID && chatID) {
                    chrome.runtime.sendMessage({
                        type: "TRACE_INPUT",
                        userID: currentUserID,
                        chatID,
                        prompt: promptText,
                    });
                }
            } catch (e) {
                console.error('[Sidebar] trace_input 전송 실패:', e);
            }

            setSubmitCount(prev => prev + 1);
        };

        // 클릭 이벤트 핸들러 (이벤트 위임)
        const handleGlobalClick = (e) => {
            const submitBtn = e.target.closest('#composer-submit-button');
            if (submitBtn && !submitBtn.disabled) {
                const textarea = document.querySelector('#prompt-textarea');
                const text = textarea?.innerText.trim() || '';
                triggerSubmit(text);
            }
        };

        // 엔터키 핸들러 — keydown을 사용해야 ChatGPT가 textarea를 비우기 전에 캡처 가능
        const handleKeyDown = (e) => {
            if (e.target.id === 'prompt-textarea' && e.key === 'Enter' && !e.shiftKey) {
                const text = e.target.innerText.trim();
                triggerSubmit(text);
            }
        };

        document.addEventListener('click', handleGlobalClick, true);
        document.addEventListener('keydown', handleKeyDown, true);

        return () => {
            document.removeEventListener('click', handleGlobalClick, true);
            document.removeEventListener('keydown', handleKeyDown, true);
        };
    }, []);

    // prompt를 textarea에 적용하는 함수
    const applyPrompt = (content) => {
        const textarea = document.querySelector('#prompt-textarea');
        if (!textarea) return;
            
        textarea.innerText = content; 
        textarea.dispatchEvent(new Event('input', { bubbles: true })); 
        textarea.focus();
    };

    return (
        <>
            <div className="group/sidebar-expando-section mb-[var(--sidebar-expanded-section-margin-bottom)]">
                <button aria-expanded="true" className="text-token-text-tertiary flex w-full items-center justify-start gap-0.5 px-4 py-1.5">
                    <h2 className="__menu-label" data-no-spacing="true">
                        Recommend Prompt 
                    </h2>
                </button>

            {recommendedPrompts.map(p => (
                <a tabIndex="0" data-fill className="group __menu-item hoverable" draggable="true" data-discover="true" key={p.id} onClick={() => applyPrompt(p.content)}>
                    <div className="flex min-w-0 grow items-center gap-2.5 group-data-no-contents-gap:gap-0">
                        <div className="truncate">
                            <span className="dir-auto">
                                {p.title}
                            </span>
                        </div>
                    </div>

                    <div className="trailing-pair">
                        <div className="trailing highlight text-token-text-tertiary">
                            <button tabIndex="0" data-trailing-button className="__menu-item-trailing-btn" data-testid="history-item-0-options" aria-label="대화 옵션 열기" type="button" aria-haspopup="menu" aria-expanded="false" data-state="closed" title="Unpin">
                                <div>
                                    <Trailp fill='currentColor' />   
                                </div>
                            </button>
                        </div>
                        <div className="trailing text-token-text-tertiary" tabIndex="-1"></div>
                    </div>
                </a>
            ))}
            </div>
        </>
    );
}