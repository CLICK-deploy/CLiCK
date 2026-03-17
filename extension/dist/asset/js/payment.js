// 토스페이먼츠 클라이언트 키 (테스트: test_ck_..., 운영: live_ck_...)
const TOSS_CLIENT_KEY = "YOUR_TOSS_CLIENT_KEY";

const PLAN_INFO = {
  naive: { amount: 1200, orderName: "CLiCK Naive 플랜" },
  pro:   { amount: 9900, orderName: "CLiCK Pro 플랜"   },
};

function generateOrderId(userID) {
  const rand = Math.random().toString(36).slice(2, 8);
  return `click-${userID}-${Date.now()}-${rand}`.slice(0, 64);
}

document.addEventListener("DOMContentLoaded", async function () {
  const planCards = document.querySelectorAll(".plan-card");
  const payButton = document.getElementById("pay-button");
  const customAlert = document.getElementById("custom-alert");
  const alertMessage = document.getElementById("alert-message");
  const alertClose = document.getElementById("alert-close");

  let selectedPlan = null;

  // 현재 플랜 로드 및 해당 카드 비활성화
  let currentPlan = "free";
  let userID = null;
  try {
    const data = await chrome.storage.local.get(["plan", "userID"]);
    currentPlan = data.plan || "free";
    userID = data.userID || null;
  } catch (e) {}

  planCards.forEach((card) => {
    if (card.dataset.plan === currentPlan) {
      card.classList.add("current-plan");
      const badge = document.createElement("div");
      badge.className = "current-plan-badge";
      badge.textContent = "현재 플랜";
      card.prepend(badge);
    }
  });

  // 알림창 닫기
  alertClose.addEventListener("click", function () {
    customAlert.style.display = "none";
  });

  function showAlert(message) {
    alertMessage.textContent = message;
    customAlert.style.display = "flex";
  }

  // 카드 선택 토글 (현재 플랜은 선택 불가)
  planCards.forEach((card) => {
    card.addEventListener("click", function () {
      if (card.classList.contains("current-plan")) return;
      planCards.forEach((c) => c.classList.remove("selected"));
      card.classList.add("selected");
      selectedPlan = card.dataset.plan;
    });
  });

  // 결제 버튼
  payButton.addEventListener("click", async function () {
    if (!selectedPlan) {
      showAlert("요금제를 선택해주세요.");
      return;
    }

    // Free 플랜은 결제 없이 바로 적용
    if (selectedPlan === "free") {
      payButton.disabled = true;
      payButton.textContent = "처리 중...";
      try {
        const response = await chrome.runtime.sendMessage({ type: "SELECT_PLAN", plan: "free" });
        if (response && response.success) {
          showAlert("Free 플랜이 적용되었습니다.");
          setTimeout(() => chrome.tabs.getCurrent((tab) => chrome.tabs.remove(tab.id)), 2000);
        } else {
          showAlert(response?.error || "처리 중 오류가 발생했습니다.");
          payButton.disabled = false;
          payButton.textContent = "선택 완료";
        }
      } catch (error) {
        showAlert("오류가 발생했습니다: " + error.message);
        payButton.disabled = false;
        payButton.textContent = "선택 완료";
      }
      return;
    }

    // 유료 플랜: 토스페이먼츠 결제
    if (!userID) {
      showAlert("로그인이 필요합니다.");
      return;
    }

    const plan = PLAN_INFO[selectedPlan];
    if (!plan) return;

    const orderId = generateOrderId(userID);

    try {
      // pendingPayment를 storage에 저장 (background.js가 리다이렉트 감지 후 읽음)
      await chrome.storage.local.set({
        pendingPayment: { orderId, plan: selectedPlan, amount: plan.amount, userID },
      });

      const tossPayments = TossPayments(TOSS_CLIENT_KEY);
      await tossPayments.requestPayment("카드", {
        amount: plan.amount,
        orderId,
        orderName: plan.orderName,
        customerName: userID,
        successUrl: "http://54.253.211.53:8000/api/payment/success",
        failUrl:    "http://54.253.211.53:8000/api/payment/fail",
      });
      // requestPayment는 현재 탭을 Toss 결제 페이지로 리다이렉트하므로
      // 이 아래 코드는 결제 취소 시에만 실행됨
    } catch (error) {
      await chrome.storage.local.remove(["pendingPayment"]);
      if (error.code !== "USER_CANCEL") {
        showAlert("결제 중 오류가 발생했습니다: " + error.message);
      }
    }
  });
});
