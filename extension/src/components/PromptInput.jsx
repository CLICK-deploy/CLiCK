// TODO: 패널 색깔 맞추기 
import { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import PromptAnalysis from './PromptAnalysis';
import Panelopen from '../../images/panelopen.svg?react';

function getTextareaValue(textarea) {
    if (!textarea) return '';
    return (textarea.innerText || '').replace(/\n{2,}/g, '\n');
}

export default function PromptInput() {
    const [isPanelVisible, setPanelVisible] = useState(false);
    const [analysis, setAnalysis] = useState(null);
    const [loading, setLoading] = useState(false);
    const [textarea, setTextarea] = useState(null);
    const [liveText, setLiveText] = useState('');
    const [panelSize, setPanelSize] = useState({});
    const [sessionExpiredMsg, setSessionExpiredMsg] = useState(false);

    // 세션 만료 감지
    useEffect(() => {
        const handler = (message) => {
            if (message.type === 'SESSION_EXPIRED') {
                setPanelVisible(false);
                setAnalysis(null);
                setSessionExpiredMsg(true);
            }
        };
        chrome.runtime.onMessage.addListener(handler);
        return () => chrome.runtime.onMessage.removeListener(handler);
    }, []);

    // 현재 채팅방 ID 찾기
    const findCurrentChatId = () => {
        const historyContainer = document.querySelector('#history');
        if (!historyContainer) return null;

        const activeElement = historyContainer.querySelector('a[data-active]');
        return activeElement ? activeElement.getAttribute('href') : null;
    };

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

    // 테스트용 분석 결과 생성
    const getTestAnalysisResult = () => {
        return {
            tags: [
                "오타/맞춤법",
                "모호/지시 불명확",
            ],
            patches: {
                "오타/맞춤법": [
                    {
                        from: "치킨먹고싶다~",
                        to: "치킨 먹고 싶다~"
                    }
                ],
                "모호/지시 불명확": [
                    {
                        from: "안되나?",
                        to: "안 되는 이유를 3가지 이유로 설명해줘"
                    }
                ],
            },
            original_text: "아 치킨먹고싶다~ 안되나?",
            full_suggestion: "아 치킨 먹고 싶다~ 안 되는 이유를 3가지 이유로 설명해줘"
        };
    };

    // 패널을 DOM의 별도 위치에 렌더링하기 위한 로직
    const renderPanel = () => {
        const panelRoot = document.getElementById('click-prompt-tools-container');
        if (!panelRoot) return null;

        return ReactDOM.createPortal(
            <div className="click-prompt-tools-container">
                {/* 분석 패널 */}
                {isPanelVisible && (
                // TODO: css style 분리
                <div style={{ position: 'relative', zIndex: 100, width: '100%' }}>
                    <PromptAnalysis
                        source={analysis?.source || liveText}
                        result={analysis ? analysis.result : { tags: [], patches: {}, full_suggestion: liveText }}
                        /* X 버튼 누르면 분석 결과 지우기 */
                        onClose={() => {
                            setPanelVisible(false);
                            setAnalysis(null);
                        }}
                        onApplyAll={handleApplyAll}
                        panelStyle={panelSize}
                        onAnalyze={handleAnalyze} 
                        loading={loading}        
                    />
                </div>
                )}
            </div>,
            panelRoot
        );
    };

    // TODO: 아래 두 개 하나로 합치기

    // textarea를 찾고, 패널이 열려 있으면 실시간 값 반영
    useEffect(() => {
        function getLiveTextValue() {
            const textarea = document.querySelector('#prompt-textarea');
            if (!textarea) return;
            
            setTextarea(textarea);
            if (isPanelVisible) setLiveText(getTextareaValue(textarea));
            setPanelSize({
                width: '100%',
                minHeight: textarea.offsetHeight ? textarea.offsetHeight + 'px' : undefined,
            });
            clearInterval(interval);
        }

        const interval = setInterval(getLiveTextValue, 300);
        return () => clearInterval(interval);
    }, []);

    // 패널이 열려 있으면 입력값을 실시간 반영 (이벤트+폴링)
    useEffect(() => {
        if (!isPanelVisible || !textarea) return;
        let prev = getTextareaValue(textarea);
        const handler = () => {
            const val = getTextareaValue(textarea);
            setLiveText(val);
            prev = val;
        };
        const events = ['input', 'change', 'keyup', 'keydown','paste', 'cut', 'compositionend', 'blur'];
        events.forEach(ev => textarea.addEventListener(ev, handler));
        handler();
        // 폴링 백업(300ms)
        const poll = setInterval(() => {
            const val = getTextareaValue(textarea);
            if (val !== prev) {
                setLiveText(val);
                prev = val;
            }
        }, 300);
        return () => {
            events.forEach(ev => textarea.removeEventListener(ev, handler));
            clearInterval(poll);
        };
    }, [isPanelVisible, textarea]);

    // 패널 크기/높이 입력창과 동기화
    useEffect(() => {
        if (!isPanelVisible) return;
        function syncPanelSize() {
            const taRect = textarea.getBoundingClientRect();
            setPanelSize({
                width: '100%',
                minHeight: taRect.height ? taRect.height + 'px' : undefined,
            });
        }
        syncPanelSize();
        window.addEventListener('resize', syncPanelSize);
        return () => window.removeEventListener('resize', syncPanelSize);
    }, [isPanelVisible, textarea]);

    // ChatGPT 전송 감지 → trace_input 자동 전송
    useEffect(() => {
        if (!textarea) return;

        let lastSendButton = null;

        const sendTrace = () => {
            const prompt = getTextareaValue(textarea);
            const chatID = findCurrentChatId();
            // 새 채팅(chatID 없음)이거나 빈 입력이면 skip
            if (!prompt || !chatID) return;
            chrome.runtime.sendMessage({ type: "TRACE_INPUT", chatID, prompt });
        };

        // Enter 키로 전송할 때 (Shift+Enter는 줄바꿈이므로 제외)
        const handleKeydown = (e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
                sendTrace();
            }
        };
        textarea.addEventListener('keydown', handleKeydown, true);

        // 전송 버튼 클릭 감지 (ChatGPT가 버튼을 동적으로 교체하므로 MutationObserver 사용)
        const attachSendButton = () => {
            const btn = document.querySelector('button[data-testid="send-button"]');
            if (btn && btn !== lastSendButton) {
                lastSendButton?.removeEventListener('click', sendTrace, true);
                btn.addEventListener('click', sendTrace, true);
                lastSendButton = btn;
            }
        };

        const observer = new MutationObserver(attachSendButton);
        observer.observe(document.body, { childList: true, subtree: true });
        attachSendButton();

        return () => {
            textarea.removeEventListener('keydown', handleKeydown, true);
            observer.disconnect();
            lastSendButton?.removeEventListener('click', sendTrace, true);
        };
    }, [textarea]);

    // 분석하기 버튼 클릭 시
    // TODO: 백엔드 연동
    const handleAnalyze = async () => {
        if (!textarea) return;
        setLoading(true);

        try {
            const currentUserID = await getUserID();
            if (!currentUserID) {
                alert('로그인이 필요합니다.');  // 또는 로그인 페이지로 이동
                chrome.runtime.sendMessage({ type: "OPEN_LOGIN_PAGE" });
                setLoading(false);
                return;
            }

            // 테스트 계정일 때는 테스트 결과 사용
            if (currentUserID === "test") {
                console.log('테스트 계정: 테스트 분석 결과 사용');
                await new Promise(resolve => setTimeout(resolve, 1000)); // 로딩 시뮬레이션
                
                setAnalysis({ 
                    source: "아 치킨먹고싶다~ 안되나?",
                    result: getTestAnalysisResult() 
                });
                setLoading(false);
                return;
            }

            console.log('loading...');  
            const response = await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject('분석 요청 시간이 초과되었습니다. 다시 시도해주세요.'), 60000);
                chrome.runtime.sendMessage(
                    { type: "ANALYZE_PROMPT", chatID: findCurrentChatId(), prompt: getTextareaValue(textarea) }, 
                    (res) => {
                        clearTimeout(timeout);
                        if (chrome.runtime.lastError) { reject(chrome.runtime.lastError.message); return; }
                        if (!res) { reject('응답이 없습니다. 서버 연결을 확인해주세요.'); return; }
                        if (res.error) { reject(res.error); return; }
                        resolve(res);
                    }
                );
            });
            console.log('loading complete');

            const promptText = getTextareaValue(textarea);
            // 태그가 없으면 "perfect" 결과로 정규화
            let finalResult = response;
            if (!response.tags || response.tags.length === 0) {
                finalResult = {
                    tags: ["perfect!"],
                    patches: {
                        "perfect!": [{ from: promptText, to: promptText }]
                    },
                    original_text: promptText,
                    full_suggestion: promptText
                };
            }
            setAnalysis({ source: promptText, result: finalResult });
        } catch (err) {
            setAnalysis({ 
                source: "아 치킨먹고싶다~ 안되나?",
                result: getTestAnalysisResult() 
            });

            console.error('분석 실패, 기본 분석값을 보입니다:', err);
            alert('분석에 실패했습니다. 백엔드 서버를 확인해주세요.');
        } finally {
            setLoading(false);
        }
    };

    // 제출하기
    const handleApplyAll = (text) => {
        if (!textarea) return;
        
        textarea.innerText = text;
        // 이벤트 발생 - ChatGPT UI 업데이트를 위해
        textarea.dispatchEvent(new Event("change", { bubbles: true }));
        textarea.focus(); 
        setAnalysis(null); 
        setPanelVisible(false);
        setLiveText(''); 

    };

    // TODO: CSS 분리
    return (
        <>
            {/* 세션 만료 알림 */}
            {sessionExpiredMsg && (
                <div
                    style={{
                        position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
                        zIndex: 99999, background: '#333', color: '#fff',
                        padding: '12px 20px', borderRadius: '8px',
                        fontSize: '14px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                        display: 'flex', alignItems: 'center', gap: '12px',
                    }}
                >
                    <span>세션이 만료되어 자동 로그아웃되었습니다.</span>
                    <button
                        onClick={() => setSessionExpiredMsg(false)}
                        style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '16px', lineHeight: 1 }}
                    >×</button>
                </div>
            )}
            {/* 분석 패널 열기 버튼 */}
            <button
                type="button"
                className="click-analyze-button"
                title="프롬프트 분석"
                onClick={() => setPanelVisible(v => !v)}
            >
                <h3>
                    <Panelopen fill='currentColor' />
                </h3>
            </button>
            
            {/* isPanelVisible이 true일 때만 Portal을 통해 패널을 렌더링 */}
            {isPanelVisible && renderPanel()}
        </>
    );
}