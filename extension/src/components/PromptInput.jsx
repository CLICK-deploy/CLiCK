import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import PromptAnalysis from './PromptAnalysis';
import Sidebar from './Sidebar';

function getTextareaValue(textarea) {
    if (!textarea) return '';
    return textarea.value || textarea.textContent || textarea.innerText || '';
}

export default function PromptInput() {
    const [isPanelVisible, setPanelVisible] = useState(false);
    const [analysis, setAnalysis] = useState(null);
    const [loading, setLoading] = useState(false);
    const [textarea, setTextarea] = useState(null);
    const [liveText, setLiveText] = useState('');
    const [panelSize, setPanelSize] = useState({});

    // 패널을 DOM의 별도 위치에 렌더링하기 위한 로직
    const renderPanel = () => {
        const panelRoot = document.getElementById('click-prompt-tools-container');
        if (!panelRoot) return null;

        return ReactDOM.createPortal(
            <div className="click-prompt-tools-container">
                {/* 분석 패널 */}
                {isPanelVisible && (
                <div style={{ position: 'relative', zIndex: 100, width: '100%' }}>
                    <PromptAnalysis
                        source={liveText}
                        result={analysis ? analysis.result : { tags: [], patches: {}, full_suggestion: liveText }}
                        onClose={() => setPanelVisible(false)}
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

    // textarea를 찾고, 패널이 열려 있으면 실시간 값 반영
    useEffect(() => {
        const interval = setInterval(() => {
            const ta = document.querySelector('#prompt-textarea');
            if (ta) {
                setTextarea(ta);
                if (isPanelVisible) setLiveText(getTextareaValue(ta));
                setPanelSize({
                    width: '100%',
                    minHeight: ta.offsetHeight ? ta.offsetHeight + 'px' : undefined,
                });
                clearInterval(interval);
            }
        }, 100);
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
        const events = ['input', 'change', 'keyup', 'paste', 'cut', 'compositionend', 'blur'];
        events.forEach(ev => textarea.addEventListener(ev, handler));
        handler();
        // 폴링 백업(100ms)
        const poll = setInterval(() => {
            const val = getTextareaValue(textarea);
            if (val !== prev) {
                setLiveText(val);
                prev = val;
            }
        }, 100);
        return () => {
            events.forEach(ev => textarea.removeEventListener(ev, handler));
            clearInterval(poll);
        };
    }, [isPanelVisible, textarea]);

    // 패널 크기/높이 입력창과 동기화
    useEffect(() => {
        if (!isPanelVisible || !textarea) return;
        function syncPanelSize() {
            if (!textarea) return;
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

    // 분석하기 버튼 클릭 시
    const handleAnalyze = async () => {
    if (!textarea) return;
    setLoading(true);
    try {

        console.log('loading...');  
        await new Promise(resolve => setTimeout(resolve, 3000));
        console.log('loading complete');


        // 실제 응답 형식에 맞는 예제 데이터
        const response = {
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
            // 원본 텍스트를 저장 (패치 적용을 위해)
            original_text: "아 치킨먹고싶다~ 안되나?",
            // 전체 수정 제안
            full_suggestion: "아 치킨 먹고 싶다~ 안 되는 이유를 3가지 이유로 설명해줘"
        };
        setAnalysis({ source: getTextareaValue(textarea), result: response });
        } catch (err) {
            console.error('분석 실패:', err);
            alert('분석에 실패했습니다. 백엔드 서버를 확인해주세요.');
        } finally {
            setLoading(false);
        }
    };

    // handleApplyAll 함수 수정
    const handleApplyAll = (text) => {
        if (textarea) {
            // 텍스트 적용
            textarea.innerText = text;
            // 이벤트 발생 - ChatGPT UI 업데이트를 위해
            textarea.dispatchEvent(new Event("change", { bubbles: true }));
            textarea.focus(); // 포커스 이동
        }
        // 패널 상태 초기화 및 닫기
        setAnalysis(null); // 분석 결과 초기화
        setPanelVisible(false); // 패널 닫기
        setLiveText(''); // 실시간 텍스트 초기화

    };

    return (
        <>
            {/* 분석 패널 열기 버튼 (이제 마이크 옆에 표시됨) */}
            <button
                type="button"
                className="click-analyze-button"
                title="프롬프트 분석"
                onClick={() => setPanelVisible(v => !v)}
            >
                <h3>
                    <svg xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 5370 5370"
                        fill="currentColor">
                    <g transform="translate(0,5370) scale(0.1,-0.1)">
                        <path d="M40060 53693 c-127 -7 -385 -36 -525 -59 -868 -142 -1565 -464 -2315
                        -1069 -293 -237 -532 -453 -980 -887 -151 -146 -8274 -8267 -18051 -18045
                        -15365 -15367 -17784 -17791 -17842 -17873 -165 -236 -262 -468 -324 -770 -16
                        -80 -17 -474 -20 -6655 -3 -4535 0 -6601 7 -6669 47 -450 243 -848 568 -1157
                        262 -249 576 -407 962 -486 80 -16 477 -17 6650 -21 4741 -2 6596 0 6675 8
                        308 31 590 133 855 310 l125 84 17555 17549 c9655 9652 17758 17755 18005
                        18006 846 860 1188 1251 1505 1726 545 816 812 1757 787 2775 -22 902 -256
                        1705 -704 2419 -270 430 -621 854 -1225 1481 -342 355 -7438 7444 -7628 7620
                        -582 541 -971 845 -1405 1099 -603 352 -1296 557 -2065 611 -132 9 -476 11
                        -610 3z m584 -3727 c60 -14 138 -39 172 -55 152 -71 372 -244 744 -584 201
                        -184 7254 -7230 7589 -7582 448 -469 661 -728 755 -913 63 -123 103 -359 93
                        -547 -6 -127 -38 -294 -72 -378 -62 -155 -239 -385 -588 -767 -83 -91 -2140
                        -2155 -4571 -4588 l-4421 -4422 -5107 5107 -5108 5108 4133 4133 c4089 4091
                        4681 4679 4992 4960 281 254 502 421 627 476 201 87 516 108 762 52z m-14821
                        -34358 l-11908 -11908 -5107 0 -5108 0 0 5107 0 5108 11907 11907 11908 11908
                        5107 -5107 5108 -5108 -11907 -11907z"/>
                    </g>
                    </svg>
                </h3>
            </button>
            
            {/* isPanelVisible이 true일 때만 Portal을 통해 패널을 렌더링 */}
            {isPanelVisible && renderPanel()}
        </>
    );
}