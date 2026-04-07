import { useState, useEffect, useRef } from 'react';
import Trailp from '../../images/trailing-pair.svg?react';

const MAX_PROMPTS = 2;

const TEMPLATES = [
    { id: 't1', title: '대화 기반 성격 진단', content: '지금까지의 대화에 따라 내 성격을 진단해줘.' },
    { id: 't6', title: '영어로 번역', content: '방금 내가 작성한 내용을 자연스러운 영어로 번역해줘.' },
];

export default function Sidebar() {
    const [recommendedPrompts, setRecommendedPrompts] = useState([]);
    const [currentPath, setCurrentPath] = useState(window.location.pathname);
    // fetchTrigger가 바뀔 때만 추천을 가져옴 — fetchParamsRef에 chatID와 generate를 먼저 세팅
    const [fetchTrigger, setFetchTrigger] = useState(0);
    const fetchParamsRef = useRef({ chatID: null, generate: false });

    const lastAppliedRecommendationRef = useRef(null); // { id, content }
    const lastSubmitTimeRef = useRef(0);
    // [경우 1] 새 채팅에서 제출 시 저장: URL 변경 감지 후 trace + fetch 처리
    const pendingNewChatTraceRef = useRef(null); // { promptText, usedRecommendedId }

    // URL에서 chatID 추출 헬퍼
    const extractChatId = (path) => {
        const match = path.match(/\/c\/([0-9a-f-]+)/i);
        return match ? `/c/${match[1]}` : null;
    };
    const findCurrentChatId = () => extractChatId(window.location.pathname);

    // trace_input 전송 헬퍼 (await 가능)
    const sendTraceInput = (chatID, promptText, usedRecommendedId) =>
        new Promise((resolve) => {
            chrome.runtime.sendMessage(
                {
                    type: "TRACE_INPUT",
                    chatID: chatID ?? "",
                    prompt: promptText,
                    ...(usedRecommendedId && { recommendedPromptId: usedRecommendedId }),
                },
                resolve
            );
        });

    // trace_output 전송 헬퍼 — io_history 행의 output 컬럼을 채움
    const sendTraceOutput = (chatID, outputText) =>
        new Promise((resolve) => {
            chrome.runtime.sendMessage(
                { type: "TRACE_OUTPUT", chatID: chatID ?? "", output: outputText },
                resolve
            );
        });

    // GPT 응답 완료 감지 → trace_output 전송
    // MutationObserver 대신 300ms 폴링으로 stop 버튼 감지
    // (subtree MutationObserver는 스트리밍 중 수천 번 발화해 메모리 폭증 유발)
    useEffect(() => {
        const getLastAssistantText = () => {
            const sections = document.querySelectorAll('section[data-turn="assistant"]');
            if (!sections.length) return null;
            const last = sections[sections.length - 1];
            const markdown = last.querySelector('div[data-message-author-role="assistant"] .markdown');
            return markdown ? markdown.innerText.trim() : null;
        };

        let wasStreaming = false;
        let capturedChatId = null;
        let captureTimer = null;

        const checkStreaming = () => {
            const stopBtn =
                document.querySelector('button[data-testid="stop-button"]') ??
                document.querySelector('button[aria-label*="Stop"]');
            const isNowStreaming = !!stopBtn;

            if (isNowStreaming && !wasStreaming) {
                // 스트리밍 시작
                wasStreaming = true;
                capturedChatId = findCurrentChatId();
            } else if (!isNowStreaming && wasStreaming) {
                // 스트리밍 완료
                wasStreaming = false;
                clearTimeout(captureTimer);
                captureTimer = setTimeout(() => {
                    const text = getLastAssistantText();
                    if (text) {
                        console.log('[CLiCK] ✅ GPT 응답 캡처 완료');
                        console.log('[CLiCK] chatID:', capturedChatId);
                        console.log('[CLiCK] output (앞 200자):', text.slice(0, 200));
                        const tail = text.slice(-150);
                        sendTraceOutput(capturedChatId, tail).catch(() => {});
                    }
                }, 500);
            }
        };

        const intervalId = setInterval(checkStreaming, 300);

        return () => {
            clearInterval(intervalId);
            clearTimeout(captureTimer);
        };
    }, []);


    // 추천 fetch 명시적 트리거
    // generate=true: LLM 호출 (경우 1, 2), generate=false: DB 캐시만 조회 (경우 3, 4, 초기 마운트)
    const triggerFetch = (chatID, generate) => {
        fetchParamsRef.current = { chatID, generate };
        setFetchTrigger(n => n + 1);
    };

    // 최초 마운트: 현재 채팅방 기준 추천 로드 (DB 캐시만)
    useEffect(() => {
        triggerFetch(findCurrentChatId(), false);
    }, []);

    // 세션 만료 감지
    useEffect(() => {
        const handler = (message) => {
            if (message.type === 'SESSION_EXPIRED') setRecommendedPrompts([]);
        };
        chrome.runtime.onMessage.addListener(handler);
        return () => chrome.runtime.onMessage.removeListener(handler);
    }, []);

    // URL 변경 감지 — [경우 1] [경우 3] [경우 4] 처리
    // pushState/replaceState/popstate 인터셉트로 이벤트 기반 감지 (폴링 제거)
    useEffect(() => {
        const handlePathChange = () => {
            const newPath = window.location.pathname;
            if (newPath === currentPath) return;

            const newChatId = extractChatId(newPath);
            setCurrentPath(newPath);
            setRecommendedPrompts([]);

            if (pendingNewChatTraceRef.current && newChatId) {
                const { promptText, usedRecommendedId } = pendingNewChatTraceRef.current;
                pendingNewChatTraceRef.current = null;
                (async () => {
                    try {
                        await sendTraceInput(newChatId, promptText, usedRecommendedId);
                    } catch (e) {
                        console.error('[Sidebar] [경우1] trace_input 실패:', e);
                    }
                    triggerFetch(newChatId, true);
                })();
            } else {
                pendingNewChatTraceRef.current = null;
                triggerFetch(newChatId, false);
            }
        };

        // ChatGPT는 SPA이므로 history.pushState/replaceState를 직접 인터셉트
        const _pushState = history.pushState.bind(history);
        const _replaceState = history.replaceState.bind(history);

        history.pushState = (...args) => {
            _pushState(...args);
            handlePathChange();
        };
        history.replaceState = (...args) => {
            _replaceState(...args);
            handlePathChange();
        };

        window.addEventListener('popstate', handlePathChange);

        return () => {
            history.pushState = _pushState;
            history.replaceState = _replaceState;
            window.removeEventListener('popstate', handlePathChange);
        };
    }, [currentPath]);

    // 추천 프롬프트 가져오기 — fetchTrigger 변화 시에만 실행
    useEffect(() => {
        if (fetchTrigger === 0) return;

        const fetchPrompts = async () => {
            const { chatID, generate } = fetchParamsRef.current;
            try {
                console.log('[Sidebar] 추천 요청:', chatID ?? '(global)', generate ? '[LLM]' : '[DB캐시]');

                const response = await new Promise((resolve, reject) => {
                    chrome.runtime.sendMessage(
                        { type: "FETCH_RECOMMENDED_PROMPTS", chatID, generate },
                        (res) => {
                            if (chrome.runtime.lastError) { resolve({}); return; }
                            res && res.error ? reject(res.error) : resolve(res ?? {});
                        }
                    );
                });

                console.log('[Sidebar] 백엔드 응답:', response);

                let rawData = [];
                if (Array.isArray(response)) {
                    rawData = response;
                } else if (response && typeof response === 'object') {
                    const key = chatID || 'global';
                    const candidates = response[key] || [];
                    if (Array.isArray(candidates)) {
                        rawData = candidates;
                    } else if (candidates && typeof candidates === 'object' && Object.keys(candidates).length > 0) {
                        rawData = [candidates];
                    }
                }

                const formattedData = rawData.map((item, index) => ({
                    title: item.title || item.subject || `추천 ${index + 1}`,
                    content: item.content || item.body || item.prompt || "",
                    id: item.id ?? `${Date.now()}-${index}`
                }));

                setRecommendedPrompts(prev => [...prev, ...formattedData].slice(-MAX_PROMPTS));
            } catch (error) {
                console.error('[Sidebar] 프롬프트 로딩 에러:', error);
            }
        };

        fetchPrompts();
    }, [fetchTrigger]);

    // 버튼 클릭 및 엔터 키 감지
    useEffect(() => {
        const triggerSubmit = async (promptText) => {
            const now = Date.now();
            if (now - lastSubmitTimeRef.current < 500) return;
            lastSubmitTimeRef.current = now;
            if (!promptText) return;

            const applied = lastAppliedRecommendationRef.current;
            const usedRecommendedId = (applied && applied.content === promptText) ? applied.id : null;
            lastAppliedRecommendationRef.current = null;

            const chatID = findCurrentChatId();

            if (chatID) {
                // [경우 2] 기존 채팅에서 제출 → trace 완료 후 동일 chatID로 추천
                try {
                    await sendTraceInput(chatID, promptText, usedRecommendedId);
                } catch (e) {
                    console.error('[Sidebar] [경우2] trace_input 실패:', e);
                }
                triggerFetch(chatID, true);  // [경우 2] LLM 호출
            } else {
                // [경우 1] 새 채팅에서 제출 → ChatGPT가 URL을 바꿀 때까지 대기
                // URL 변경 감지 시 trace + fetch 실행 (pendingNewChatTraceRef 참조)
                pendingNewChatTraceRef.current = { promptText, usedRecommendedId };
            }
        };

        const handleGlobalClick = (e) => {
            const submitBtn = e.target.closest('#composer-submit-button');
            if (submitBtn && !submitBtn.disabled) {
                const textarea = document.querySelector('#prompt-textarea');
                triggerSubmit(textarea?.innerText.trim() || '');
            }
        };

        const handleKeyDown = (e) => {
            if (e.target.id === 'prompt-textarea' && e.key === 'Enter' && !e.shiftKey) {
                triggerSubmit(e.target.innerText.trim());
            }
        };

        const handleTextareaInput = (e) => {
            if (e.target.id !== 'prompt-textarea') return;
            const applied = lastAppliedRecommendationRef.current;
            if (applied && e.target.innerText.trim() !== applied.content) {
                lastAppliedRecommendationRef.current = null;
            }
        };

        document.addEventListener('click', handleGlobalClick, true);
        document.addEventListener('keydown', handleKeyDown, true);
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