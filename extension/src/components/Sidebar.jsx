import { useState, useEffect } from 'react';
import Trailp from '../../images/trailing-pair.svg?react';

export default function Sidebar() {
    // TODO: 백엔드 연동 필요
    // 추천 프롬프트 목록 
    const [recommendedPrompts] = useState([
        { 
            title: 'T-분포 개괄', 
            content: 'T-분포의 정의와 주요 특징을 설명해줘.',
        },
        { 
            title: 'F-분포 개괄', 
            content: 'F-분포의 정의와 주요 두 개의 자유도 비교에 중점을 둬서 설명해줘.',
        },
    ]);

    // useEffect 내부의 코드를 다음과 같이 수정
    useEffect(() => {
        let submitButton = null;
        let checkInterval;

        // submit 버튼을 주기적으로 찾는 함수
        const findSubmitButton = () => {
            const button = document.querySelector('#composer-submit-button');
            if (button && !submitButton) {
                submitButton = button;
                submitButton.addEventListener('click', handleSubmit);
            }
        };

        const handleSubmit = () => {
            const textarea = document.querySelector('#prompt-textarea');
            if (!textarea) return;

            // TODO: 프롬프트 교체 로직
            /*
            const currentPromptIndex = Math.floor(Math.random() * 2); // 0 또는 1
            const updatedPrompts = [...recommendedPrompts];
            updatedPrompts[currentPromptIndex] = predefinedPrompts[currentPromptIndex];
            setRecommendedPrompts(updatedPrompts);
            */
        };

        // 주기적으로 버튼을 찾음
        checkInterval = setInterval(findSubmitButton, 1000);

        // 컴포넌트 언마운트 시 정리
        return () => {
            clearInterval(checkInterval);
            if (submitButton) {
                submitButton.removeEventListener('click', handleSubmit);
            }
        };
    }, [recommendedPrompts]);

    // Enter 키 제출 감지
    useEffect(() => {
        const textarea = document.querySelector('#prompt-textarea');
        if (!textarea) return;

        const handleKeyPress = (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                const submitButton = document.querySelector('#composer-submit-button');
                if (submitButton && !submitButton.disabled) {
                    // Submit 버튼의 click 이벤트를 발생시켜 위의 핸들러가 처리하도록 함
                    submitButton.click();
                }
            }
        };

        textarea.addEventListener('keypress', handleKeyPress);
        return () => textarea.removeEventListener('keypress', handleKeyPress);
    }, []);

    // prompt를 textarea에 적용하는 함수
    const applyPrompt = (content) => {
        const textarea = document.querySelector('#prompt-textarea');
        if (!textarea) return;
            
        textarea.innerText = content;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.focus();
    };

    // 기존 JSX 반환 부분에서 map 함수만 수정
    // TODO: CSS 분리
    return (
        <>
            <div tabindex="0" data-fill class="group __menu-item hoverable" aria-expanded="true" aria-label="섹션 접기" data-no-hover-bg="true" data-no-contents-gap="true">
                <div class="text-token-text-tertiary flex w-full items-center justify-start gap-0.5">
                    {/* TODO: prompt 접기 만들기 */}
                    <h2 class="__menu-label" data-no-spacing="true"> prompt </h2>
                    { // TODO: 이미지 분리하기
                    /* <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg" class="hidden h-3 w-3 group-hover/sidebar-expando-section:block">
                        <path d="M12.1338 5.94433C12.3919 5.77382 12.7434 5.80202 12.9707 6.02929C13.1979 6.25656 13.2261 6.60807 13.0556 6.8662L12.9707 6.9707L8.47067 11.4707C8.21097 11.7304 7.78896 11.7304 7.52926 11.4707L3.02926 6.9707L2.9443 6.8662C2.77379 6.60807 2.80199 6.25656 3.02926 6.02929C3.25653 5.80202 3.60804 5.77382 3.86617 5.94433L3.97067 6.02929L7.99996 10.0586L12.0293 6.02929L12.1338 5.94433Z"></path>
                    </svg> */}
                </div>
            </div>

            {recommendedPrompts.map(p => (
                <a tabindex="0" data-fill class="group __menu-item hoverable" draggable="true" data-discover="true" key={p.id} onClick={() => applyPrompt(p.content)}>
                    <div class="flex min-w-0 grow items-center gap-2.5 group-data-no-contents-gap:gap-0">
                        <div class="truncate">
                            <span class dir="auto">
                                {p.title}
                            </span>
                        </div>
                    </div>

                    <div class="trailing-pair">
                        <div class="trailing highlight text-token-text-tertiary">
                            <button tabindex="0" data-trailing-button class="__menu-item-trailing-btn" data-testid="history-item-0-options" aria-label="대화 옵션 열기" type="button" id="radix-_r_g3_" aria-haspopup="menu" aria-expanded="false" data-state="closed" title="Unpin">
                                <div>
                                    <Trailp fill='currentColor' />   
                                </div>
                            </button>
                        </div>
                        <div class="trailing text-token-text-tertiary" tabindex="-1"></div>
                    </div>
                </a>
            ))}
        </>
    );
}