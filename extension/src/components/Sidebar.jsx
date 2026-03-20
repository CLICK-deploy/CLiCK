import { useState, useEffect, useRef } from 'react';
import Trailp from '../../images/trailing-pair.svg?react';

const MAX_PROMPTS = 2;

const TEMPLATES = [
    { id: 't1', title: '대화 기반 성격 진단', content: '지금까지의 대화에 따라 내 성격을 진단해줘.' },
    { id: 't6', title: '영어로 번역', content: '방금 내가 작성한 내용을 자연스러운 영어로 번역해줘.' },
];

export default function Sidebar() {
    const [recommendedPrompts, setRecommendedPrompts] = useState([]);
    const [submitCount, setSubmitCount] = useState(0);
    // 추천 프롬프트 클릭 후 수정 없이 제출했는지 추적
    const lastAppliedRecommendationRef = useRef(null); // { id, content }

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
    // 일반 채팅: /c/{id}
    // 프로젝트 채팅: /g/{gpt-id}/c/{id}
    const findCurrentChatId = () => {
        const path = window.location.pathname;
        const match = path.match(/\/c\/([0-9a-f-]+)/i);
        return match ? `/c/${match[1]}` : null;
    };

    // 백엔드에서 프롬프트 가져옴
    useEffect(() => {
        const fetchPrompts = async () => {
            try {
                const chatID = findCurrentChatId();
                console.log('[Sidebar] chatID:', chatID);
                if (!chatID) {
                    console.log('[Sidebar] chatID 없음 -> 추천 프롬프트 요청 생략');
                    return;
                }

                // background.js로 요청 위임
                const response = await new Promise((resolve, reject) => {
                    chrome.runtime.sendMessage(
                        { type: "FETCH_RECOMMENDED_PROMPTS", chatID },
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

            // 추천 프롬프트가 수정 없이 그대로 제출됐는지 확인
            const applied = lastAppliedRecommendationRef.current;
            const usedRecommendedId = (applied && applied.content === promptText)
                ? applied.id
                : null;
            // 제출 후 초기화
            lastAppliedRecommendationRef.current = null;

            // 현재 입력 내용을 백엔드에 저장 (이후 추천의 근거 데이터)
            try {
                const chatID = findCurrentChatId();
                if (chatID) {
                    chrome.runtime.sendMessage({
                        type: "TRACE_INPUT",
                        chatID,
                        prompt: promptText,
                        ...(usedRecommendedId && { recommendedPromptId: usedRecommendedId }),
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

        // textarea 직접 수정 시 추천 프롬프트 추적 초기화
        const handleTextareaInput = (e) => {
            if (e.target.id !== 'prompt-textarea') return;
            const applied = lastAppliedRecommendationRef.current;
            if (applied && e.target.innerText.trim() !== applied.content) {
                lastAppliedRecommendationRef.current = null;
            }
        };
        document.addEventListener('input', handleTextareaInput, true);

        return () => {
            document.removeEventListener('click', handleGlobalClick, true);
            document.removeEventListener('keydown', handleKeyDown, true);
            document.removeEventListener('input', handleTextareaInput, true);
        };
    }, []);

    // prompt를 textarea에 적용하는 함수
    const applyPrompt = (content, recommendedId = null) => {
        const textarea = document.querySelector('#prompt-textarea');
        if (!textarea) return;

        textarea.innerText = content;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.focus();

        // 추천 프롬프트 클릭 시 id 기록, 일반 사용 시 클리어
        lastAppliedRecommendationRef.current = recommendedId ? { id: recommendedId, content } : null;
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
                <a tabIndex="0" data-fill className="group __menu-item hoverable" draggable="true" data-discover="true" key={p.id} onClick={() => applyPrompt(p.content, p.id)}>
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

            <div className="group/sidebar-expando-section mb-[var(--sidebar-expanded-section-margin-bottom)]">
                <button aria-expanded="true" className="text-token-text-tertiary flex w-full items-center justify-start gap-0.5 px-4 py-1.5">
                    <h2 className="__menu-label" data-no-spacing="true">
                        Templates
                    </h2>
                </button>

            {TEMPLATES.map(p => (
                <a tabIndex="0" data-fill className="group __menu-item hoverable" draggable="false" data-discover="true" key={p.id} onClick={() => applyPrompt(p.content)}>
                    <div className="flex min-w-0 grow items-center gap-2.5 group-data-no-contents-gap:gap-0">
                        <div className="truncate">
                            <span className="dir-auto">
                                {p.title}
                            </span>
                        </div>
                    </div>
                </a>
            ))}
            </div>
        </>
    );
}