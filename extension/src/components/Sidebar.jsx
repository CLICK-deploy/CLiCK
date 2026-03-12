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
                console.warn('로그인되지 않음');
                return null;
            }
        } catch (error) {
            console.error('사용자 ID 가져오기 실패:', error);
            return null;
        }
    };

    // 현재 채팅방 ID 찾기
    const findCurrentChatId = () => {
        const historyContainer = document.querySelector('#history');
        if (!historyContainer) return null;

        const activeElement = historyContainer.querySelector('a[data-active]');
        return activeElement ? activeElement.getAttribute('href') : null;
    };

    // 백엔드에서 프롬프트 가져옴
    useEffect(() => {
        const fetchPrompts = async () => {
            try {
                const currentUserID = await getUserID();
                if (!currentUserID) {
                    console.warn('userID가 올바르지 않습니다.');
                    return;
                }

                const chatID = findCurrentChatId();
                if (!chatID) {
                    return;
                }

                // background.js로 요청 위임
                const response = await new Promise((resolve, reject) => {
                    chrome.runtime.sendMessage(
                        { type: "FETCH_RECOMMENDED_PROMPTS", userID: currentUserID, chatID },
                        (res) => res && res.error ? reject(res.error) : resolve(res)
                    );
                });

                // 응답이 { chatID: [...], global: [...] } 객체이거나 배열일 수 있음
                let rawData = [];
                if (Array.isArray(response)) {
                    rawData = response;
                } else if (response && typeof response === 'object') {
                    const candidates = response[chatID] || response.global || [];
                    rawData = Array.isArray(candidates) ? candidates : [];
                }

                const formattedData = rawData.map((item, index) => ({
                    title: item.title || item.subject || `추천 ${index + 1}`,
                    content: item.content || item.body || item.prompt || "",
                    id: item.id ?? `${Date.now()}-${index}`
                }));

                // 기존 목록에 새 항목 추가 후 MAX_PROMPTS 초과분은 오래된 것부터 제거
                setRecommendedPrompts(prev => [...prev, ...formattedData].slice(-MAX_PROMPTS));
            } catch (error) {
                console.error('프롬프트 로딩 에러:', error);
            }
        };

        fetchPrompts();
    }, [submitCount]); 

    // 버튼 클릭 및 엔터 키 감지 
    useEffect(() => {
        const triggerSubmit = () => {
            const textarea = document.querySelector('#prompt-textarea');
            if (!textarea.innerText) return;

            console.log("메시지 제출 감지됨! -> 프롬프트 갱신 요청");
            setSubmitCount(prev => prev + 1);
        };

        // 클릭 이벤트 핸들러 (이벤트 위임)
        const handleGlobalClick = (e) => {
            const submitBtn = e.target.closest('#composer-submit-button');
            if (submitBtn && !submitBtn.disabled) {
                triggerSubmit();
            }
        };

        // 엔터키 핸들러
        const handleKeyPress = (e) => {
            // textarea에서 Shift 없이 Enter만 눌렀을 때
            if (e.target.id === 'prompt-textarea' && e.key === 'Enter' && !e.shiftKey) {
                triggerSubmit();
            }
        };

        document.addEventListener('click', handleGlobalClick, true);
        document.addEventListener('keypress', handleKeyPress, true);

        return () => {
            document.removeEventListener('click', handleGlobalClick, true);
            document.removeEventListener('keypress', handleKeyPress, true);
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