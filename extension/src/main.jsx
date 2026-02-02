import React from 'react';
import ReactDOM from 'react-dom/client';

import Sidebar from './components/Sidebar';
import PromptInput from './components/PromptInput';
import './App.css'; 

// ★★★
// 이 파일은 빌드 후 content.js가 되어 ChatGPT 페이지에 직접 주입됩니다.
// 따라서 이 파일 자체가 콘텐츠 스크립트의 역할을 수행합니다.
// ★★★

function injectSidebar() {
    const targetNav = document.querySelector('[class="group/sidebar-expando-section mb-[var(--sidebar-expanded-section-margin-bottom)]"]');
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
        return true;
    }
    return false;
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
function ensureUiInjected() {
    const sidebarInjected = injectSidebar();
    const promptToolsInjected = injectPromptTools();
    
    // 두 UI가 모두 성공적으로 주입된 경우에만 인터벌을 시작
    if ((sidebarInjected || document.querySelector('#click-sidebar-root')) && 
        (promptToolsInjected || document.querySelector('#click-button-root'))) {
        if (!clickUiInterval) {
            clickUiInterval = setInterval(() => {
                injectSidebar();
                injectPromptTools();
            }, 300);
        }
    }
}

// MutationObserver를 사용하여 ChatGPT의 동적 UI 로딩에 대응
const observer = new MutationObserver((mutations, obs) => {
    ensureUiInjected();
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});