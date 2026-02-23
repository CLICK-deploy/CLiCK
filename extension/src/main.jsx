import React from 'react';
import ReactDOM from 'react-dom/client';

import Sidebar from './components/Sidebar';
import PromptInput from './components/PromptInput';
import Settings from './components/Settings';
import './App.css'; 

/*
// 이 파일은 빌드 후 content.js가 되어 ChatGPT 페이지에 직접 주입됩니다.
// 따라서 이 파일 자체가 콘텐츠 스크립트의 역할을 수행합니다.
*/

let loginPageOpened = false;

// 로그인 상태 확인 및 필요 시 로그인 페이지 열기
async function checkLoginAndRedirect() {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage(
            { type: "CHECK_LOGIN" },
            (response) => {
                if (!response || !response.isLoggedIn) {
                    if (!loginPageOpened) {
                        // 로그인 페이지 열기
                        chrome.runtime.sendMessage({ type: "OPEN_LOGIN_PAGE" });
                        loginPageOpened = true;
                    }
                    resolve(false);  
                } else {
                    resolve(true); 
                }
            }
        );
    });
}

function injectSidebar() {
    const targetNav = document.querySelector('[class="group/sidebar-expando-section mb-[var(--sidebar-collapsed-section-margin-bottom)]"]');
    if (targetNav && !document.querySelector('#click-sidebar-root')) {
        const sidebarRoot = document.createElement('div');
        sidebarRoot.id = 'click-sidebar-root';
        targetNav.before(sidebarRoot);

        const root = ReactDOM.createRoot(sidebarRoot);
        root.render(
            <React.StrictMode>
                <Sidebar />
            </React.StrictMode>
        );
    }
}

function injectSettings() {
    // 공유하기 버튼 찾기 (스크린샷의 버튼)
    const shareButton = document.querySelector('[data-testid="share-chat-button"]');
    
    if (shareButton && !document.querySelector('#click-settings-root')) {
        // Settings 컴포넌트를 담을 루트 생성
        const settingsRoot = document.createElement('div');
        settingsRoot.id = 'click-settings-root';
        
        // 공유하기 버튼의 부모 컨테이너 찾기
        const parentContainer = shareButton.parentElement;
        
        if (parentContainer) {
            // 공유하기 버튼 바로 앞에 삽입
            parentContainer.insertBefore(settingsRoot, shareButton);
            
            const root = ReactDOM.createRoot(settingsRoot);
            root.render(
                <React.StrictMode>
                    <Settings />
                </React.StrictMode>
            );
            
            console.log('[Settings] CLiCK 설정 버튼 삽입 완료');
        }
    }
}

function injectPromptTools() {
    // 이 함수는 이제 버튼과 패널 삽입을 모두 처리하는 두 개의 새 함수를 호출합니다.
    injectClickButton();
    injectAnalysisContainer();
}

function injectClickButton() {
    // 채팅창 오른쪽의 아이콘 그룹을 선택합니다.
    const targetContainer = document.querySelector('[class="ms-auto flex items-center gap-1.5"]');
    if (targetContainer && !document.querySelector('#click-button-root')) {
        const buttonRoot = document.createElement('span');
        buttonRoot.id = 'click-button-root';
        
        // 아이콘 그룹의 맨 앞에 버튼을 추가합니다.
        targetContainer.prepend(buttonRoot);

        const root = ReactDOM.createRoot(buttonRoot);
        // PromptInput 컴포넌트가 버튼과 패널의 로직을 모두 관리합니다.
        root.render(<PromptInput />);
    }
}

function injectAnalysisContainer() {
    // 패널은 form 태그 바로 앞에 삽입합니다.
    const targetForm = document.querySelector('[class="group/composer w-full"]');
    if (targetForm && !document.querySelector('#click-prompt-tools-container')) {
        const panelRoot = document.createElement('div');
        panelRoot.id = 'click-prompt-tools-container';
        // panelRoot.style.width = '100%'; // 부모 너비를 채우도록 설정
        
        // form 앞에 삽입
        targetForm.parentNode.insertBefore(panelRoot, targetForm);
    }
}

// 폼/버튼이 사라졌을 때 자동 복구를 위한 폴백 인터벌
let clickUiInterval = null;
async function ensureUiInjected() {
    const isLoggedIn = await checkLoginAndRedirect();

    // 로그인되어 있을 때만 UI 주입
    if (isLoggedIn) {
        injectSidebar();
        injectPromptTools();
        injectSettings();
    }
}

// 초기 실행 - 로그인 확인 및 UI 주입
(async () => {
    await ensureUiInjected();
})();

// MutationObserver를 사용하여 ChatGPT의 동적 UI 로딩에 대응
const observer = new MutationObserver(async () => {
    // 로그인 상태 확인
    const isLoggedIn = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
            { type: "CHECK_LOGIN" },
            (response) => resolve(response && response.isLoggedIn)
        );
    });

    // 로그인되어 있을 때만 UI 주입
    if (isLoggedIn) {
        injectSidebar();
        injectPromptTools();
        injectSettings();
        // 폴백 인터벌 시작(계속 감시)
        if (!clickUiInterval) {
            clickUiInterval = setInterval(ensureUiInjected, 300);
        }
    }
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});

// 로그인 성공 메시지를 받으면 UI 주입 시작
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "LOGIN_SUCCESS") {
        loginPageOpened = false; // 리셋
        ensureUiInjected();
        sendResponse({ success: true });
    }
    return true;
});