import { useMemo, useState, useRef, useEffect } from 'react';

const TAG_COLORS = {
    '모호/지시 불명확': '#7BEB75',  
    '구조/길이 중복': '#B7A3E3',  
    '문체/스타일 개선': '#C2E2FA', 
    '오타/맞춤법': '#FF8F8F',     
};

export default function PromptAnalysis({ source, result, onClose, onApplyAll, panelStyle, onAnalyze, loading }) {
    const [enabledTags, setEnabledTags] = useState([]);
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

    // 결과가 변경될 때 태그 상태 초기화
    useEffect(() => {
        if (result?.tags) {
            // 모든 태그를 활성화 상태로 시작
            setEnabledTags(result.tags);
        }
    }, [result]);

    const toggleTag = (tag) => {
        setEnabledTags(prev => 
            prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
        );
    };

    const getColoredText = useMemo(() => {
        if (!result?.full_suggestion) return source;
        
        let text = result.full_suggestion;
        const replacements = [];

        Object.entries(result.patches || {}).forEach(([tag, patches]) => {
            if (!Array.isArray(patches)) return;
            
            patches.forEach(patch => {
                // 활성화된 태그의 교정된 텍스트(to)에만 색상 적용
                if (enabledTags.includes(tag) && text.includes(patch.to)) {
                    replacements.push({
                        from: patch.to,
                        to: `<span style="color: ${TAG_COLORS[tag]};">${patch.to}</span>`,
                        index: text.indexOf(patch.to)
                    });
                }
            });
        });

        // 뒤에서부터 적용하여 인덱스 문제 방지
        replacements
            .sort((a, b) => b.index - a.index)
            .forEach(({ from, to }) => {
                if (text.includes(from)) {
                    text = text.replace(from, to);
                }
            });

        return text;
    }, [result, enabledTags, source]);

    // TODO: 함수명 PromptInput 함수와 겹침
    // Apply 버튼 클릭 시 활성화된 태그의 교정사항만 적용
    const handleApplyAll = () => {
        if (!result?.full_suggestion) return;
        
        // 활성화된 태그의 교정사항만 적용
        let finalText = result.original_text;
        Object.entries(result.patches || {}).forEach(([tag, patches]) => {
            if (Array.isArray(patches) && enabledTags.includes(tag)) {
                patches.forEach(patch => {
                    finalText = finalText.replace(patch.from, patch.to);
                });
            }
        });

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
                style={{padding: 0, height: bodyHeight, overflow: 'auto'}}>
                <div className="text-container" 
                    style={{...fallbackStyle, margin: 0, whiteSpace: 'pre-wrap'}}
                    dangerouslySetInnerHTML={{ __html: getColoredText }}>
                </div>
            </div>

            <div className='panel-footer' style={fallbackStyle}> 
                <div className="tag-bar">
                    {(result.tags || []).map(tag => (
                        <button 
                            key={tag} 
                            className={`tag ${enabledTags.includes(tag) ? 'active' : ''}`}
                            onClick={() => toggleTag(tag)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '6px 12px',
                                borderRadius: '20px',
                                cursor: 'pointer',
                                background: enabledTags.includes(tag) ? 
                                    TAG_COLORS[tag] : panelDetailStyle.background,
                                color: enabledTags.includes(tag) ? '#fff' : panelDetailStyle.color,
                                transition: 'all 0.2s ease',
                                borderColor: panelDetailStyle.borderColor,
                            '--tw-shadow': panelDetailStyle['--tw-shadow'],
                            boxShadow: panelDetailStyle.boxShadow,
                            }}
                        >
                            <span 
                                style={{
                                    width: '10px',
                                    height: '10px',
                                    borderRadius: '50%',
                                    background: TAG_COLORS[tag],
                                    display: 'inline-block'
                                }}
                            />
                            {tag}
                        </button>
                    ))}
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