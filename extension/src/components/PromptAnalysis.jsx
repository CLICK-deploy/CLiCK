import { useMemo, useState, useRef, useEffect } from 'react';

const TAG_COLORS = {
    '모호/지시 불명확': '#7BEB75',  
    '구조/길이 중복': '#B7A3E3',  
    '문체/스타일 개선': '#C2E2FA', 
    '오타/맞춤법': '#FF8F8F',     
};

export default function PromptAnalysis({ source, result, onClose, onApplyAll, panelStyle, onAnalyze, loading }) {
    const [enabledPatchKeys, setEnabledPatchKeys] = useState([]);
    const bodyRef = useRef(null);
    const headerRef = useRef(null);
    const [bodyHeight, setBodyHeight] = useState();
    const [colorScheme, setColorScheme] = useState('dark');

    // color-scheme 감지
    useEffect(() => {
        const detectColorScheme = () => {
            const htmlElement = document.documentElement;
            const computedStyle = getComputedStyle(htmlElement);
            const scheme = computedStyle.getPropertyValue('color-scheme').trim();
            setColorScheme(scheme || 'dark');
        };

        // 초기 감지
        detectColorScheme();

        // MutationObserver로 class 변경 감지
        const observer = new MutationObserver(detectColorScheme);
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class', 'data-chat-theme']
        });

        return () => observer.disconnect();
    }, []);

    // source 순서대로 정렬된 패치 목록
    const allPatches = useMemo(() => {
        if (!result?.patches) return [];
        const entries = [];
        Object.entries(result.patches).forEach(([tag, patches]) => {
            if (!Array.isArray(patches)) return;
            patches.forEach((patch, idx) => {
                const pos = source.indexOf(patch.from);
                if (pos !== -1) entries.push({ key: `${tag}::${idx}`, tag, patch, pos });
            });
        });
        return entries.sort((a, b) => a.pos - b.pos);
    }, [result, source]);

    // 결과가 변경될 때 모든 패치 활성화
    useEffect(() => {
        setEnabledPatchKeys(allPatches.map(p => p.key));
    }, [result]);

    const togglePatch = (key) => {
        setEnabledPatchKeys(prev =>
            prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
        );
    };

    const getColoredText = useMemo(() => {
        if (!allPatches.length) return source;

        const activeSet = new Set(enabledPatchKeys);
        let output = '';
        let pos = 0;
        for (const { key, tag, patch, pos: idx } of allPatches) {
            if (idx < pos) continue;
            output += source.slice(pos, idx);
            if (activeSet.has(key)) {
                output += `<span style="color: ${TAG_COLORS[tag]};">${patch.to}</span>`;
            } else {
                output += patch.from;
            }
            pos = idx + patch.from.length;
        }
        output += source.slice(pos);
        return output;
    }, [allPatches, enabledPatchKeys, source]);

    // TODO: 함수명 PromptInput 함수와 겹침
    // Apply 버튼 클릭 시 활성화된 패치만 적용
    const handleApplyAll = () => {
        if (!allPatches.length) return;

        const activeSet = new Set(enabledPatchKeys);
        const active = allPatches.filter(p => activeSet.has(p.key));

        let finalText = source;
        for (let i = active.length - 1; i >= 0; i--) {
            const { patch, pos } = active[i];
            finalText = finalText.slice(0, pos) + patch.to + finalText.slice(pos + patch.from.length);
        }
        onApplyAll(finalText);
    };

    const fallbackStyle = {
        fontFamily: (panelStyle && panelStyle.fontFamily) || 'var(--font-sans, Inter, Noto Sans KR, Apple SD Gothic Neo, Arial, sans-serif)',
        fontSize: (panelStyle && panelStyle.fontSize) || 'var(--composer-font-size, 1rem)',
        width: panelStyle && panelStyle.width,
    };

    const panelDetailStyle = {
        color: colorScheme === 'dark' ? '#ececf1' : '#0d0d0d',
        background: colorScheme === 'dark' ? '#2f2f2f' : '#fff',
        borderColor: colorScheme === 'dark' ? '#ffffff26' : '#0000001a',
        fontFamily: (panelStyle && panelStyle.fontFamily) || 'var(--font-sans, Inter, Noto Sans KR, Apple SD Gothic Neo, Arial, sans-serif)',
        fontSize: (panelStyle && panelStyle.fontSize) || 'var(--composer-font-size, 1rem)',
        width: panelStyle && panelStyle.width,
        overflow: 'hidden',
        '--tw-shadow': colorScheme === 'dark' ? '0px 4px 12px 0px var(--tw-shadow-color,var(--shadow-color-1,#0000001a)),inset 0px 0px 1px 0px var(--tw-shadow-color,var(--shadow-color-2,#fff3))' : '0px 4px 4px 0px var(--tw-shadow-color,var(--shadow-color-1,#0000000a)),0px 0px 1px 0px var(--tw-shadow-color,var(--shadow-color-2,#0000009e))',
        boxShadow: 'var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)',
    };

    // TODO: 최대 height 작동하게 "해"
    useEffect(() => {
        if (!panelStyle?.minHeight || !headerRef.current) return;
        const maxHeight = 600;
        const height = Math.min(panelStyle.minHeight, maxHeight);
        setBodyHeight(`${height}px`);
    }, [panelStyle, headerRef]);

    // TODO: CSS 분리
    return (
        <div className="click-analysis-panel" style={{...panelStyle, ...panelDetailStyle}}>
            <div className="panel-header" style={fallbackStyle} ref={headerRef}>
                <h3>GPT Prompt Analysis</h3>
                <button className="close-btn" onClick={onClose}>×</button>
            </div>
            <div className="panel-body" ref={bodyRef}
                style={{padding: 0}}>
                <div className="text-container" 
                    style={{...fallbackStyle, margin: 0, whiteSpace: 'pre-wrap'}}
                    dangerouslySetInnerHTML={{ __html: getColoredText }}>
                </div>
            </div>

            <div className='panel-footer' style={fallbackStyle}> 
                <div className="tag-bar">
                    {allPatches.map(({ key, tag, patch }) => {
                        const isActive = enabledPatchKeys.includes(key);
                        const label = tag;
                        return (
                            <button
                                key={key}
                                className={`tag ${isActive ? 'active' : ''}`}
                                onClick={() => togglePatch(key)}
                                title={`${tag}: "${patch.from}" → "${patch.to}"`}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '6px 12px',
                                    borderRadius: '20px',
                                    cursor: 'pointer',
                                    background: isActive ? TAG_COLORS[tag] : panelDetailStyle.background,
                                    color: isActive ? '#fff' : panelDetailStyle.color,
                                    transition: 'all 0.2s ease',
                                    borderColor: panelDetailStyle.borderColor,
                                    '--tw-shadow': panelDetailStyle['--tw-shadow'],
                                    boxShadow: panelDetailStyle.boxShadow,
                                }}
                            >
                                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: TAG_COLORS[tag], display: 'inline-block', flexShrink: 0 }} />
                                {label}
                            </button>
                        );
                    })}
                </div>

                <button className="apply-all-btn" onClick={handleApplyAll}
                    style={{
                        background: panelDetailStyle.background,
                        borderColor: panelDetailStyle.borderColor,
                        '--tw-shadow': panelDetailStyle['--tw-shadow'],
                        boxShadow: panelDetailStyle.boxShadow,
                    }}
                >
                    <h3>Apply</h3>
                </button>

                <button className="analysis-btn" 
                    onClick={onAnalyze} 
                    disabled={loading}
                    style={{
                        borderColor: panelDetailStyle.borderColor,
                        '--tw-shadow': panelDetailStyle['--tw-shadow'],
                        boxShadow: panelDetailStyle.boxShadow,
                    }}
                >
                    <h3>
                        {loading ? 'Analyzing...' : 'Analyze'}
                    </h3>
                </button>
            </div>
        </div>
    );
}