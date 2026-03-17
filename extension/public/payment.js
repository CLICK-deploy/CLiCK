document.addEventListener("DOMContentLoaded", function () {
  const planCards = document.querySelectorAll(".plan-card");
  const payButton = document.getElementById("pay-button");
  const customAlert = document.getElementById("custom-alert");
  const alertMessage = document.getElementById("alert-message");
  const alertClose = document.getElementById("alert-close");

  let selectedPlan = null;

  // 알림창 닫기
  alertClose.addEventListener("click", function () {
    customAlert.style.display = "none";
  });

  // 알림창 표시 함수
  function showAlert(message) {
    alertMessage.textContent = message;
    customAlert.style.display = "flex";
  }

  // 카드 선택 토글
  planCards.forEach((card) => {
    card.addEventListener("click", function () {
      planCards.forEach((c) => c.classList.remove("selected"));
      card.classList.add("selected");
      selectedPlan = card.dataset.plan;
    });
  });

  // 결제 / 플랜 선택 완료
  payButton.addEventListener("click", async function () {
    if (!selectedPlan) {
      showAlert("요금제를 선택해주세요.");
      return;
    }

    payButton.disabled = true;
    payButton.textContent = "처리 중...";

    try {
      const response = await chrome.runtime.sendMessage({
        type: "SELECT_PLAN",
        plan: selectedPlan,
      });

      if (response && response.success) {
        showAlert(
          selectedPlan === "free"
            ? "Free 플랜이 적용되었습니다."
            : "Pro 플랜 결제가 완료되었습니다."
        );
        // 2초 후 탭 닫기
        setTimeout(() => {
          chrome.tabs.getCurrent((tab) => {
            chrome.tabs.remove(tab.id);
          });
        }, 2000);
      } else {
        showAlert(response?.error || "처리 중 오류가 발생했습니다.");
        payButton.disabled = false;
        payButton.textContent = "선택 완료";
      }
    } catch (error) {
      console.error("플랜 선택 에러:", error);
      showAlert("오류가 발생했습니다: " + error.message);
      payButton.disabled = false;
      payButton.textContent = "선택 완료";
    }
  });
});
