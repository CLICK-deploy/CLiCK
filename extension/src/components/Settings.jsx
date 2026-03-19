import { useState, useEffect, useRef } from 'react';

const PLAN_LABEL = { free: 'Free 플랜', naive: 'Naive 플랜', pro: 'Pro 플랜' };

export default function Settings() {
    const [isOpen, setIsOpen] = useState(false);
    const [popupPos, setPopupPos] = useState({ top: 0, right: 0 });
    const [dialog, setDialog] = useState(null); // 'confirm' | 'success' | null
    const [userInfo, setUserInfo] = useState(null); // { userID, plan } | null
    const popoverRef = useRef(null);
    const buttonRef = useRef(null);

    const getButtonPosition = () => {
        if (buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            return {
                top: rect.bottom + 8,
                right: window.innerWidth - rect.right,
            };
        }
        return { top: 0, right: 0 };
    };

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
        if (!isOpen) {
            setPopupPos(getButtonPosition());
            // 팝업 열릴 때 최신 유저 정보 로드
            chrome.storage.local.get(['userID', 'isLoggedIn', 'plan'], (data) => {
                if (data.isLoggedIn && data.userID) {
                    setUserInfo({ userID: data.userID, plan: data.plan || 'free' });
                } else {
                    setUserInfo(null);
                }
            });
        }
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
                <div data-radix-popper-content-wrapper dir="ltr" style={{ position: 'fixed', top: popupPos.top, right: popupPos.right, minWidth: 'max-content', zIndex: 49 }}>
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
                        {/* 유저 정보 카드 (로그인 시에만 표시) */}
                        {userInfo && (
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '12px',
                                padding: '12px 16px 10px',
                                borderBottom: '1px solid rgba(128,128,128,0.15)',
                                marginBottom: '4px'
                            }}>
                                <div style={{
                                    width: '36px', height: '36px', borderRadius: '50%',
                                    background: 'var(--theme-user-selection-bg)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '13px', fontWeight: 700, color: '#fff',
                                    flexShrink: 0, userSelect: 'none'
                                }}>
                                    {userInfo.userID.slice(0, 2).toUpperCase()}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                                    <span style={{ fontSize: '14px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {userInfo.userID}
                                    </span>
                                    <span style={{ fontSize: '12px', opacity: 0.55, whiteSpace: 'nowrap' }}>
                                        {PLAN_LABEL[userInfo.plan] ?? userInfo.plan}
                                    </span>
                                </div>
                            </div>
                        )}
                        <div 
                            role="menuitem" 
                            tabIndex={0} 
                            className="group __menu-item hoverable gap-1.5" 
                            data-orientation="vertical" 
                            data-radix-collection-item
                            onClick={() => {
                                setIsOpen(false);
                                setDialog('confirm');
                            }}
                        >
                            <div className="flex items-center justify-center group-disabled:opacity-50 group-data-disabled:opacity-50 icon">
                                <svg xmlns="http://www.w3.org/2000/svg" width='20' height='20' viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                                    <polyline points="16 17 21 12 16 7"/>
                                    <line x1="21" y1="12" x2="9" y2="12"/>
                                </svg>
                            </div>
                            로그아웃
                        </div>

                        {!userInfo && (
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
                                <svg xmlns="http://www.w3.org/2000/svg" width='20' height='20' viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                                    <polyline points="10 17 15 12 10 7"/>
                                    <line x1="15" y1="12" x2="3" y2="12"/>
                                </svg>
                            </div>
                            로그인
                        </div>
                        )}

                        {!userInfo && (
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
                                <svg xmlns="http://www.w3.org/2000/svg" width='20' height='20' viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                                    <circle cx="9" cy="7" r="4"/>
                                    <line x1="19" y1="8" x2="19" y2="14"/>
                                    <line x1="22" y1="11" x2="16" y2="11"/>
                                </svg>
                            </div>
                            회원가입
                        </div>
                        )}

                        <div 
                            role="menuitem" 
                            tabIndex={0} 
                            className="group __menu-item hoverable gap-1.5" 
                            data-orientation="vertical" 
                            data-radix-collection-item
                            onClick={() => {
                                chrome.runtime.sendMessage({ type: "OPEN_PAYMENT_PAGE" });
                                setIsOpen(false);
                            }}
                        >
                            <div className="flex items-center justify-center group-disabled:opacity-50 group-data-disabled:opacity-50 icon">
                                <svg xmlns="http://www.w3.org/2000/svg" width='20' height='20' viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                                </svg>
                            </div>
                            플랜 업그레이드
                        </div>
                    </div>
                </div>
            )}
        {/* 로그아웃 확인 팝업 */}
        {dialog && (
            <div style={{
                position: 'fixed', inset: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                zIndex: 9999,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
                <div style={{
                    background: 'var(--main-surface-primary, #fff)',
                    borderRadius: '12px',
                    padding: '24px 28px',
                    width: '260px',
                    textAlign: 'center',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                    border: '1px solid rgba(0,0,0,0.08)',
                    color: 'var(--text-primary, #0d0d0d)',
                    fontFamily: 'inherit',
                    animation: 'clickSlideIn 0.2s ease-out'
                }}>
                    <style>{`@keyframes clickSlideIn { from { transform: translateY(-16px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
                    <p style={{ margin: '0 0 20px', fontSize: '14px', lineHeight: '1.5' }}>
                        {dialog === 'confirm' ? '로그아웃 하시겠습니까?' : '로그아웃 되었습니다.'}
                    </p>
                    {dialog === 'confirm' ? (
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                            <button
                                onClick={() => setDialog(null)}
                                style={{ padding: '7px 18px', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.12)', background: 'transparent', cursor: 'pointer', fontSize: '13px', color: 'inherit' }}
                            >취소</button>
                            <button
                                onClick={async () => {
                                    await chrome.runtime.sendMessage({ type: 'LOGOUT' });
                                    setDialog('success');
                                }}
                                style={{ padding: '7px 18px', borderRadius: '6px', border: 'none', background: '#19c37d', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}
                            >로그아웃</button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setDialog(null)}
                            style={{ padding: '7px 24px', borderRadius: '6px', border: 'none', background: '#19c37d', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}
                        >확인</button>
                    )}
                </div>
            </div>
        )}
        </div>
    );
}