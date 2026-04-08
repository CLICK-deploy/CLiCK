// 백엔드 API 주소
// 로컬 개발: "http://localhost:8000"
// 운영 서버: "http://54.253.211.53:8000"
export const API_BASE_URL = "http://localhost:8000";
// export const API_BASE_URL = "http://54.253.211.53:8000";

// 토스페이먼츠 클라이언트 키
// 테스트: "test_ck_..."  /  운영: "live_ck_..."
export const TOSS_CLIENT_KEY = "YOUR_TOSS_CLIENT_KEY";

// Google OAuth 클라이언트 ID
// Google Cloud Console > API 및 서비스 > 사용자 인증 정보에서 발급
// 리디렉션 URI에 https://<EXTENSION_ID>.chromiumapp.org/ 를 등록해야 합니다.
export const GOOGLE_CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com";

// Apple 서비스 ID (Apple Developer > Certificates, IDs & Profiles > Identifiers > Services IDs)
// redirect URI에 https://<EXTENSION_ID>.chromiumapp.org/ 를 등록해야 합니다.
export const APPLE_SERVICE_ID = "YOUR_APPLE_SERVICE_ID";