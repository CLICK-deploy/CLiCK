import { useState, useEffect, useRef } from 'react';

export default function Settings() {
    const [isOpen, setIsOpen] = useState(false);
    const popoverRef = useRef(null);
    const buttonRef = useRef(null);

    // 외부 클릭 감지하여 팝업 닫기
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                popoverRef.current && 
                !popoverRef.current.contains(event.target) &&
                buttonRef.current &&
                !buttonRef.current.contains(event.target)
            ) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const togglePopover = () => {
        setIsOpen(!isOpen);
    };

    return (
        <div className='relative'>
            <button 
                ref={buttonRef}
                className='btn group-focus-within/dialog:focus-visible:[outline-width:1.5px] group-focus-within/dialog:focus-visible:[outline-offset:2.5px] group-focus-within/dialog:focus-visible:[outline-style:solid] group-focus-within/dialog:focus-visible:[outline-color:var(--text-primary)] text-token-text-primary hover:bg-token-surface-hover keyboard-focused:bg-token-surface-hover rounded-lg max-sm:hidden px-3 py-2'
                type="button"
                aria-expanded={isOpen}
                aria-haspopup="menu"
                onClick={togglePopover}
            >
                CLiCK
            </button>

            {/* 팝업 메뉴 */}
            {isOpen && (
                <div data-radix-popper-content-wrapper dir="ltr" style={{position: 'fixed', left: '270px', top: '0px', transform: 'translate(641.5px, 44px)', minWidth: 'max-content', '--radix-popper-transform-origin': '100% 0px', willChange: 'transform', zIndex: 49, '--radix-popper-available-width': '821.0000000000001px', '--radix-popper-available-height': '728px', '--radix-popper-anchor-width': '36px', '--radix-popper-anchor-height': '36px'}}>
                    <div 
                        ref={popoverRef}
                        data-side="bottom" 
                        data-align="end" 
                        role="menu" 
                        aria-orientation="vertical" 
                        data-state="open" 
                        data-radix-menu-content 
                        dir="ltr" 
                        className="z-49 max-w-xs rounded-2xl popover bg-token-main-surface-primary dark:bg-[#353535] shadow-long will-change-[opacity,transform] radix-side-bottom:animate-slideUpAndFade radix-side-left:animate-slideRightAndFade radix-side-right:animate-slideLeftAndFade radix-side-top:animate-slideDownAndFade py-1.5 data-[unbound-width]:min-w-[unset] data-[custom-padding]:py-0 [--trigger-width:calc(var(--radix-dropdown-menu-trigger-width)-2*var(--radix-align-offset))] min-w-(--trigger-width) max-h-[var(--radix-dropdown-menu-content-available-height)] overflow-y-auto select-none" 
                        tabIndex={-1} 
                        data-orientation="vertical" 
                        style={{outline: 'none', '--radix-dropdown-menu-content-transform-origin': 'var(--radix-popper-transform-origin)', '--radix-dropdown-menu-content-available-width': 'var(--radix-popper-available-width)', '--radix-dropdown-menu-content-available-height': 'var(--radix-popper-available-height)', '--radix-dropdown-menu-trigger-width': 'var(--radix-popper-anchor-width)', '--radix-dropdown-menu-trigger-height': 'var(--radix-popper-anchor-height)'}}
                    >
                        <div 
                            role="menuitem" 
                            tabIndex={0} 
                            className="group __menu-item hoverable gap-1.5" 
                            data-orientation="vertical" 
                            data-radix-collection-item
                            onClick={() => {
                            }}
                        >
                            <div className="flex items-center justify-center group-disabled:opacity-50 group-data-disabled:opacity-50 icon">
                                <svg xmlns="http://www.w3.org/2000/svg" width='20' height='20' aria-hidden="true" className="icon">
                                    <use href="/cdn/assets/sprites-core-jxe2m7va.svg#427dd9" fill="currentColor"></use>
                                </svg>
                            </div>
                            로그아웃
                        </div>

                        <div 
                            role="menuitem" 
                            tabIndex={0} 
                            className="group __menu-item hoverable gap-1.5" 
                            data-orientation="vertical" 
                            data-radix-collection-item
                            onClick={() => {
                                chrome.runtime.sendMessage({ type: "OPEN_LOGIN_PAGE" });
                                setIsOpen(false);
                            }}
                        >
                            <div className="flex items-center justify-center group-disabled:opacity-50 group-data-disabled:opacity-50 icon">
                                <svg xmlns="http://www.w3.org/2000/svg" width='20' height='20' aria-hidden="true" className="icon">
                                    <use href="/cdn/assets/sprites-core-jxe2m7va.svg#427dd9" fill="currentColor"></use>
                                </svg>
                            </div>
                            로그인
                        </div>

                        <div 
                            role="menuitem" 
                            tabIndex={0} 
                            className="group __menu-item hoverable gap-1.5" 
                            data-orientation="vertical" 
                            data-radix-collection-item
                            onClick={() => {
                                chrome.runtime.sendMessage({ type: "OPEN_SIGNUP_PAGE" });
                                setIsOpen(false);
                            }}
                        >
                            <div className="flex items-center justify-center group-disabled:opacity-50 group-data-disabled:opacity-50 icon">
                                <svg xmlns="http://www.w3.org/2000/svg" width='20' height='20' aria-hidden="true" className="icon">
                                    <use href="/cdn/assets/sprites-core-jxe2m7va.svg#427dd9" fill="currentColor"></use>
                                </svg>
                            </div>
                            회원가입
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}