document.addEventListener("DOMContentLoaded", function () {
  const form = document.querySelector(".user-data-form");
  const customAlert = document.getElementById("custom-alert");
  const alertMessage = document.getElementById("alert-message");
  const alertClose = document.getElementById("alert-close");
  const submitButton = document.querySelector(".start-button");

  // 알림창 닫기
  alertClose.addEventListener("click", function () {
    customAlert.style.display = "none";
  });

  // 알림창 표시 함수
  function showAlert(message) {
    alertMessage.textContent = message;
    customAlert.style.display = "flex";
  }

  // 폼 제출 처리 (로그인)
  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const nickname = form.nickname.value.trim();
    const password = form.password.value;
    const agreeCheckbox = document.getElementById("agreeAllInfo");

    if (!nickname) {
      showAlert("닉네임을 입력해주세요.");
      form.nickname.focus();
      return;
    }

    if (!password) {
      showAlert("비밀번호를 입력해주세요.");
      form.password.focus();
      return;
    }

    // 약관 동의 체크 확인
    if (!agreeCheckbox.checked) {
      showAlert("이용 약관을 읽고 동의해주세요.");
      agreeCheckbox.focus();
      return;
    }

    // 버튼 비활성화 및 텍스트 변경
    submitButton.disabled = true;
    submitButton.textContent = "로그인 중...";

    try {
      console.log("로그인 요청 전송:", nickname);
      
      // Chrome Extension API를 통해 로그인 요청
      const response = await chrome.runtime.sendMessage({
        type: "LOGIN",
        userId: nickname,
        password: password
      });

      console.log("로그인 응답:", response);

      if (response.success) {
        showAlert("로그인에 성공했습니다!");
        // 2초 후 현재 탭 닫기
        setTimeout(() => {
          chrome.tabs.getCurrent((tab) => {
            chrome.tabs.remove(tab.id);
          });
        }, 2000);
      } else {
        showAlert(response.error || "로그인에 실패했습니다.");
        submitButton.disabled = false;
        submitButton.textContent = "시작하기";
      }
    } catch (error) {
      console.error("로그인 에러:", error);
      showAlert("로그인 중 오류가 발생했습니다: " + error.message);
      submitButton.disabled = false;
      submitButton.textContent = "시작하기";
    }
  });
});