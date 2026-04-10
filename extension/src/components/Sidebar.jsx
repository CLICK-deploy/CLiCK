import { useState, useEffect, useRef } from 'react';
import Trailp from '../../images/trailing-pair.svg?react';

const MAX_PROMPTS = 2;

const TEMPLATES = [
    { id: 't1', title: '대화 기반 성격 진단', content: '지금까지의 대화에 따라 내 성격을 진단해줘.' },
    { id: 't6', title: '영어로 번역', content: '방금 내가 작성한 내용을 자연스러운 영어로 번역해줘.' },
];

export default function Sidebar() {
    const [recommendedPrompts, setRecommendedPrompts] = useState([]);
    const [displayedTitles, setDisplayedTitles] = useState({}); // { [id]: string } 타이핑 효과용
    const typingTimersRef = useRef({});
    const [currentPath, setCurrentPath] = useState(window.location.pathname);
    // fetchTrigger가 바뀔 때만 추천을 가져옴 — fetchParamsRef에 chatID와 generate를 먼저 세팅
    const [fetchTrigger, setFetchTrigger] = useState(0);
    const fetchParamsRef = useRef({ chatID: null, generate: false });

    const lastAppliedRecommendationRef = useRef(null); // { id, content }
    const lastSubmitTimeRef = useRef(0);
    // [경우 1] 새 채팅에서 제출 시 저장: URL 변경 감지 후 trace + fetch 처리
    const pendingNewChatTraceRef = useRef(null); // { promptText, usedRecommendedId }
    // 마지막으로 캡처한 AI 응답 — recommend 요청 시 이전 턴의 answer로 주입
    const lastCapturedOutputRef = useRef("");

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
            const sections = document.getElementsByTagName('section');
            for (let i = sections.length - 1; i >= 0; i--) {
                if (sections[i].dataset.turn !== 'assistant') continue;
                // 이미지는 .markdown 바깥 형제 요소로 렌더되므로 message 컨테이너 전체를 기준으로 확인
                const msgContainer = sections[i].querySelector('div[data-message-author-role="assistant"]');
                if (!msgContainer) return null;
                const hasImages = !!msgContainer.querySelector('img, figure, picture, video');
                const markdown = msgContainer.querySelector('.markdown');
                if (!markdown) {
                    // 텍스트 없이 이미지만 있는 응답 (e.g. 이미지 검색 결과)
                    return hasImages ? '[이미지 포함 응답]' : null;
                }
                // .markdown 내 이미지 요소를 clone에서 제거 — alt CDN URL이 텍스트에 섞이는 걸 방지
                const clone = markdown.cloneNode(true);
                clone.querySelectorAll('img, figure, picture, video').forEach(el => el.remove());
                const text = clone.innerText.trim();
                // 텍스트가 비었어도 이미지 응답이면 플레이스홀더로 캡처 유지
                return text || (hasImages ? '[이미지 포함 응답]' : null);
            }
            return null;
        };

        let wasStreaming = false;
        let capturedChatId = null;
        let captureTimer = null;
        // stop 버튼이 연속으로 없는 프레임 수를 카운트
        // — 이미지/웹검색 응답은 thinking→searching→responding 단계마다 버튼이 껐다 켜짐
        // — 1프레임(300ms) 사라졌다 돌아오는 false positive를 막기 위해 5프레임(≈1.5s) 요구
        let noStopFrames = 0;
        const STOP_GONE_THRESHOLD = 5;

        const checkStreaming = () => {
            const stopBtn =
                document.querySelector('button[data-testid="stop-button"]') ??
                document.querySelector('button[aria-label*="Stop"]');
            const isNowStreaming = !!stopBtn;

            if (isNowStreaming) {
                noStopFrames = 0;
                if (!wasStreaming) {
                    // 스트리밍 시작 (또는 재개)
                    wasStreaming = true;
                    capturedChatId = findCurrentChatId();
                    clearTimeout(captureTimer); // 이전 단계의 대기 타이머 취소
                }
            } else {
                if (wasStreaming) {
                    noStopFrames++;
                    if (noStopFrames >= STOP_GONE_THRESHOLD) {
                        // STOP_GONE_THRESHOLD 프레임 연속 없음 → 진짜 완료
                        wasStreaming = false;
                        noStopFrames = 0;
                        clearTimeout(captureTimer);
                        captureTimer = setTimeout(async () => {
                            const text = getLastAssistantText();
                            if (text) {
                                console.log('[CLiCK] ✅ GPT 응답 캡처 완료');
                                console.log('[CLiCK] chatID:', capturedChatId);
                                console.log('[CLiCK] output (앞 200자):', text.slice(0, 200));
                                const tail = text.slice(-150);
                                lastCapturedOutputRef.current = tail;
                                try { await sendTraceOutput(capturedChatId, tail); } catch (e) {}
                                triggerFetch(capturedChatId, true);
                            } else {
                                console.warn('[CLiCK] ⚠️ 텍스트 추출 실패 — DOM 셀렉터 확인 필요');
                            }
                        }, 500);
                    }
                }
            }
        };

        const intervalId = setInterval(checkStreaming, 300);

        // 백그라운드 탭에서 스트리밍이 끝났을 때 폴링이 스로틀돼 캡처를 놓칠 수 있음
        // 탭에 돌아오는 순간 wasStreaming 상태를 재확인해 즉시 캡처
        const handleVisibilityChange = () => {
            if (document.visibilityState !== 'visible' || !wasStreaming) return;
            const stopBtn =
                document.querySelector('button[data-testid="stop-button"]') ??
                document.querySelector('button[aria-label*="Stop"]');
            if (!stopBtn) {
                wasStreaming = false;
                noStopFrames = 0;
                clearTimeout(captureTimer);
                captureTimer = setTimeout(async () => {
                    const text = getLastAssistantText();
                    if (text) {
                        console.log('[CLiCK] ✅ GPT 응답 캡처 완료 (탭 복귀 시 감지)');
                        console.log('[CLiCK] chatID:', capturedChatId);
                        const tail = text.slice(-150);
                        lastCapturedOutputRef.current = tail;
                        try { await sendTraceOutput(capturedChatId, tail); } catch (e) {}
                        triggerFetch(capturedChatId, true);
                    }
                }, 300);
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            clearInterval(intervalId);
            clearTimeout(captureTimer);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);


    // 추천 fetch 명시적 트리거
    // generate=true: LLM 호출 (경우 1, 2), generate=false: DB 캐시만 조회 (경우 3, 4, 초기 마운트)
    const triggerFetch = (chatID, generate) => {
        fetchParamsRef.current = { chatID, generate };
        setFetchTrigger(n => n + 1);
    };

    // 최초 마운트: 현재 채팅방 기준 추천 로드
    useEffect(() => {
        triggerFetch(findCurrentChatId(), true);
    }, []);

    // 세션 만료 감지
    useEffect(() => {
        const handler = (message) => {
            if (message.type === 'SESSION_EXPIRED') setRecommendedPrompts([]);
        };
        chrome.runtime.onMessage.addListener(handler);
        return () => chrome.runtime.onMessage.removeListener(handler);
    }, []);

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
                    // recommend는 output 캡처 완료 후 트리거됨
                })();
            } else {
                pendingNewChatTraceRef.current = null;
                triggerFetch(newChatId, true);
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

                setRecommendedPrompts(prev => [...formattedData, ...prev].slice(0, MAX_PROMPTS));
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
                // [경우 2] 기존 채팅에서 제출 → trace 저장만, recommend는 output 완료 후 트리거
                try {
                    await sendTraceInput(chatID, promptText, usedRecommendedId);
                } catch (e) {
                    console.error('[Sidebar] [경우2] trace_input 실패:', e);
                }
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

    // 추천 프롬프트 타이핑 효과 — recommendedPrompts가 바뀔 때 새 항목에 대해 타이머 시작
    useEffect(() => {
        const currentIds = new Set(recommendedPrompts.map(p => p.id));

        // 사라진 프롬프트의 타이머 정리
        Object.keys(typingTimersRef.current).forEach(id => {
            if (!currentIds.has(id)) {
                clearInterval(typingTimersRef.current[id]);
                delete typingTimersRef.current[id];
            }
        });

        // 새 프롬프트에 대해 타이핑 애니메이션 시작
        recommendedPrompts.forEach(p => {
            if (typingTimersRef.current[p.id]) return; // 이미 애니메이션 중
            let charIndex = 0;
            typingTimersRef.current[p.id] = setInterval(() => {
                charIndex++;
                setDisplayedTitles(prev => ({ ...prev, [p.id]: p.title.slice(0, charIndex) }));
                if (charIndex >= p.title.length) {
                    clearInterval(typingTimersRef.current[p.id]);
                    delete typingTimersRef.current[p.id];
                }
            }, 28);
        });
    }, [recommendedPrompts]);

    // 언마운트 시 타이핑 타이머 전체 정리
    useEffect(() => {
        return () => { Object.values(typingTimersRef.current).forEach(clearInterval); };
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
                                {displayedTitles[p.id] ?? ''}
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