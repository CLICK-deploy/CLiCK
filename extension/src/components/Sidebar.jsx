import { useState, useEffect } from 'react';
import Trailp from '../../images/trailing-pair.svg?react';

export default function Sidebar() {
    const [recommendedPrompts, setRecommendedPrompts] = useState([]);
    const [submitCount, setSubmitCount] = useState(0); 

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
                // background.js로 요청 위임
                const response = await new Promise((resolve, reject) => {
                    chrome.runtime.sendMessage(
                        { type: "FETCH_RECOMMENDED_PROMPTS", userID: "test", chatID: findCurrentChatId() }, 
                        (res) => res && res.error ? reject(res.error) : resolve(res)
                    );
                });
                
                // 데이터 매핑 (배열 여부 확인)
                const data = Array.isArray(response) ? response : [];
                const formattedData = data.map((item, index) => ({
                    title: item.title || item.subject || `추천 ${index + 1}`,
                    content: item.content || item.body || item.prompt || "",
                    id: item.id || index
                }));

                setRecommendedPrompts(formattedData);
            } catch (error) {
                console.error('프롬프트 로딩 에러:', error);
                
                setRecommendedPrompts([
                    { 
                        title: 'T-분포 개괄', 
                        content: 'T-분포의 정의와 주요 특징을 설명해줘.',
                        id: 'def-1'
                    },
                    { 
                        title: 'F-분포 개괄', 
                        content: 'F-분포의 정의와 주요 두 개의 자유도 비교에 중점을 둬서 설명해줘.',
                        id: 'def-2'
                    },
                ]);
            }
        };

        fetchPrompts();
    }, [submitCount]); 

    // 버튼 클릭 및 엔터 키 감지 
    useEffect(() => {
        const triggerSubmit = () => {
            console.log("메시지 제출 감지됨! -> 프롬프트 갱신 요청");
            // submitCount를 변경하여 위의 fetchPrompts useEffect가 재실행되게 함
            setSubmitCount(prev => prev + 1);
        };

        // 클릭 이벤트 핸들러 (이벤트 위임)
        const handleGlobalClick = () => {
            // 클릭된 요소가 submit 버튼 내부인지 확인
            const submitBtn = e.target.closest('#composer-submit-button');
            
            // 버튼이 눌렸고, 비활성화(disabled) 상태가 아닐 때만 실행
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
            <div tabIndex="0" data-fill className="group __menu-item hoverable" aria-expanded="true" aria-label="섹션 접기" data-no-hover-bg="true" data-no-contents-gap="true">
                <div className="text-token-text-tertiary flex w-full items-center justify-start gap-0.5">
                    <h2 className="__menu-label" data-no-spacing="true"> prompt </h2>
                </div>
            </div>

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
        </>
    );
}