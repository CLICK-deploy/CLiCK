import { useState } from 'react';

export default function Login({ onLoginSuccess }) {
    const [nickname, setNickname] = useState('');
    const [password, setPassword] = useState('');
    const [ageGroup, setAgeGroup] = useState('');
    const [gender, setGender] = useState('');
    const [agreeAll, setAgreeAll] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        // 유효성 검사
        if (!nickname.trim()) {
            setError('닉네임을 입력해주세요.');
            setLoading(false);
            return;
        }

        if (!ageGroup) {
            setError('연령대를 선택해주세요.');
            setLoading(false);
            return;
        }

        if (!gender) {
            setError('성별을 선택해주세요.');
            setLoading(false);
            return;
        }

        if (!agreeAll) {
            setError('개인정보 수집·이용에 동의해주세요.');
            setLoading(false);
            return;
        }

        try {
            const response = await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage(
                    { 
                        type: "LOGIN", 
                        username: nickname,
                        password: password,
                        ageGroup: ageGroup,
                        gender: gender
                    }, 
                    (res) => res && res.error ? reject(res.error) : resolve(res)
                );
            });

            if (response.success) {
                onLoginSuccess(response.userID);
            } else {
                setError('로그인에 실패했습니다.');
            }
        } catch (error) {
            console.error('로그인 에러:', error);
            setError(error.message || '로그인 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                    <h2 style={{ fontSize: '24px', fontWeight: '600', margin: '0 0 10px 0' }}>CLiCK</h2>
                    <p style={{ fontSize: '14px', color: '#666', margin: 0 }}>사용자 정보 입력</p>
                </div>

                <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="닉네임"
                    style={{
                        width: '100%',
                        padding: '10px',
                        border: '1px solid rgba(0, 0, 0, 0.1)',
                        borderRadius: '8px',
                        fontSize: '13px',
                        boxSizing: 'border-box'
                    }}
                    disabled={loading}
                />

                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="패스워드"
                    style={{
                        width: '100%',
                        padding: '10px',
                        border: '1px solid rgba(0, 0, 0, 0.1)',
                        borderRadius: '8px',
                        fontSize: '13px',
                        boxSizing: 'border-box'
                    }}
                    disabled={loading}
                />

                <select
                    value={ageGroup}
                    onChange={(e) => setAgeGroup(e.target.value)}
                    style={{
                        width: '100%',
                        padding: '10px',
                        border: '1px solid rgba(0, 0, 0, 0.1)',
                        borderRadius: '8px',
                        fontSize: '13px',
                        boxSizing: 'border-box'
                    }}
                    disabled={loading}
                >
                    <option value="">연령대</option>
                    <option value="under_20">20세 미만</option>
                    <option value="20s">20대</option>
                    <option value="30s">30대</option>
                    <option value="40s">40대</option>
                    <option value="50s">50대</option>
                    <option value="over_60">60세 이상</option>
                </select>

                <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    style={{
                        width: '100%',
                        padding: '10px',
                        border: '1px solid rgba(0, 0, 0, 0.1)',
                        borderRadius: '8px',
                        fontSize: '13px',
                        boxSizing: 'border-box'
                    }}
                    disabled={loading}
                >
                    <option value="">성별</option>
                    <option value="male">남자</option>
                    <option value="female">여자</option>
                    <option value="not_disclosed">선택 안함</option>
                </select>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                    <input
                        type="checkbox"
                        checked={agreeAll}
                        onChange={(e) => setAgreeAll(e.target.checked)}
                        disabled={loading}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <span>개인정보 수집·이용에 동의합니다.</span>
                </label>

                {error && (
                    <div style={{ color: '#dc2626', fontSize: '13px', textAlign: 'center' }}>
                        {error}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    style={{
                        width: '100%',
                        padding: '10px',
                        backgroundColor: '#19c37d',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '13px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        opacity: loading ? 0.6 : 1,
                        fontWeight: '500'
                    }}
                >
                    {loading ? '처리 중...' : '시작하기'}
                </button>
            </form>
        </div>
    );
}