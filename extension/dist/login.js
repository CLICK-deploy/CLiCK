document.addEventListener("DOMContentLoaded", function () {
  const form = document.querySelector(".user-data-form");
  const customAlert = document.getElementById("custom-alert");
  const alertMessage = document.getElementById("alert-message");
  const alertClose = document.getElementById("alert-close");
  const submitButton = document.querySelector(".start-button");
  const checkDuplicateButton = document.getElementById("check-duplicate");
  const nicknameInput = document.getElementById("nickname");
  
  let isNicknameChecked = false;

  // 알림창 닫기
  alertClose.addEventListener("click", function () {
    customAlert.style.display = "none";
  });

  // 알림창 표시 함수
  function showAlert(message) {
    alertMessage.textContent = message;
    customAlert.style.display = "flex";
  }

  // 닉네임 입력 시 중복확인 상태 초기화
  nicknameInput.addEventListener("input", function () {
    isNicknameChecked = false;
    checkDuplicateButton.classList.remove("checked");
    checkDuplicateButton.textContent = "중복확인";
  });

  // 중복확인 버튼 클릭
  checkDuplicateButton.addEventListener("click", async function () {
    const nickname = nicknameInput.value.trim();

    if (!nickname) {
      showAlert("닉네임을 입력해주세요.");
      nicknameInput.focus();
      return;
    }

    checkDuplicateButton.disabled = true;
    checkDuplicateButton.textContent = "확인 중...";

    try {
      // Chrome Extension API를 통해 중복 확인 요청
      const response = await chrome.runtime.sendMessage({
        type: "CHECK_DUPLICATE",
        userId: nickname
      });

      if (response.available) {
        isNicknameChecked = true;
        checkDuplicateButton.classList.add("checked");
        checkDuplicateButton.textContent = "✓ 사용가능";
        showAlert("사용 가능한 닉네임입니다.");
      } else {
        isNicknameChecked = false;
        checkDuplicateButton.classList.remove("checked");
        checkDuplicateButton.textContent = "중복확인";
        showAlert("이미 사용 중인 닉네임입니다.");
      }
    } catch (error) {
      console.error("중복확인 에러:", error);
      showAlert("중복확인 중 오류가 발생했습니다.");
      checkDuplicateButton.textContent = "중복확인";
    } finally {
      checkDuplicateButton.disabled = false;
    }
  });

  // 폼 제출 처리
  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const nickname = form.nickname.value.trim();
    const password = form.password.value;
    const passwordCheck = form.passwordCheck.value.trim();
    const ageGroup = form.age_group.value;
    const gender = form.gender.value;
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

    if (!passwordCheck) {
      showAlert("비밀번호 확인을 입력해주세요.");
      form.passwordCheck.focus();
      return;
    }

    if (password !== passwordCheck) {
      showAlert("비밀번호가 일치하지 않습니다.");
      form.passwordCheck.focus();
      return;
    }

    if (!ageGroup) {
      showAlert("연령대를 선택해주세요.");
      form.age_group.focus();
      return;
    }

    if (!gender) {
      showAlert("성별을 선택해주세요.");
      form.gender.focus();
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
    submitButton.textContent = "처리 중...";

    try {
      console.log("로그인 요청 전송:", nickname);
      
      // Chrome Extension API를 통해 로그인 요청
      const response = await chrome.runtime.sendMessage({
        type: "LOGIN",
        userId: nickname,
        ageGroup: ageGroup,
        gender: gender,
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