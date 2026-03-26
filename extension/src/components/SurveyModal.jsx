import { useState, useEffect } from 'react';

const SURVEY_INTERVAL_MS = 48 * 60 * 60 * 1000; // 48시간

export default function SurveyModal() {
    const [visible, setVisible] = useState(false);
    const [rating, setRating] = useState(0);
    const [hovered, setHovered] = useState(0);
    const [submitted, setSubmitted] = useState(false);

    useEffect(() => {
        chrome.storage.local.get(['lastSurveyTime', 'isLoggedIn'], (data) => {
            if (!data.isLoggedIn) return;
            const last = data.lastSurveyTime || 0;
            if (Date.now() - last >= SURVEY_INTERVAL_MS) {
                setVisible(true);
            }
        });
    }, []);

    const dismiss = () => {
        chrome.storage.local.set({ lastSurveyTime: Date.now() });
        setVisible(false);
    };

    const submit = () => {
        if (rating === 0) return;
        chrome.runtime.sendMessage({ type: 'SUBMIT_SURVEY', rating });
        chrome.storage.local.set({ lastSurveyTime: Date.now() });
        setSubmitted(true);
        setTimeout(() => setVisible(false), 1800);
    };

    if (!visible) return null;

    return (
        <div className="click-survey-backdrop">
            <div className="click-survey-modal">
                <button className="click-survey-close" onClick={dismiss} aria-label="닫기">×</button>

                {submitted ? (
                    <div className="click-survey-thanks">
                        <span>감사합니다! 😊</span>
                    </div>
                ) : (
                    <>
                        <p className="click-survey-title">CLiCK이 도움이 되셨나요?</p>
                        <p className="click-survey-sub">만족도를 알려주세요</p>

                        <div className="click-survey-stars">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    className="click-survey-star"
                                    onMouseEnter={() => setHovered(star)}
                                    onMouseLeave={() => setHovered(0)}
                                    onClick={() => setRating(star)}
                                    aria-label={`${star}점`}
                                >
                                    <svg
                                        width="32" height="32"
                                        viewBox="0 0 24 24"
                                        fill={(hovered || rating) >= star ? '#F5A623' : 'none'}
                                        stroke={(hovered || rating) >= star ? '#F5A623' : 'currentColor'}
                                        strokeWidth="1.5"
                                        style={{ transition: 'fill 0.15s, stroke 0.15s' }}
                                    >
                                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                    </svg>
                                </button>
                            ))}
                        </div>

                        <div className="click-survey-labels">
                            <span>별로예요</span>
                            <span>최고예요</span>
                        </div>

                        <button
                            className="click-survey-submit"
                            onClick={submit}
                            disabled={rating === 0}
                        >
                            제출하기
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
