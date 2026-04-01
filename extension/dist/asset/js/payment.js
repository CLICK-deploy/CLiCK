// API_BASE_URL, TOSS_CLIENT_KEY 는 config.js 에서 전역으로 제공됩니다.

const PLAN_ORDER = ['free', 'naive', 'pro'];

const PLAN_INFO = {
  naive: { amount: 1200, orderName: "CLiCK Naive 플랜" },
  pro:   { amount: 9900, orderName: "CLiCK Pro 플랜"   },
};

function generateOrderId(userID) {
  const rand = Math.random().toString(36).slice(2, 8);
  return `click-${userID}-${Date.now()}-${rand}`.slice(0, 64);
}

// DOM 요소 전역 참조 (메시지 리스너에서 접근하기 위해)
let payButton = null;
function showAlert(message) {
  const alertMessage = document.getElementById("alert-message");
  const customAlert = document.getElementById("custom-alert");
  if (alertMessage && customAlert) {
    alertMessage.textContent = message;
    customAlert.style.display = "flex";
  }
}

// 결제 취소/실패 시 background.js로부터 UI 복구 메시지 수신
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "PAYMENT_CANCELLED") {
    if (payButton) {
      payButton.disabled = false;
      payButton.textContent = "선택 완료";
    }
    showAlert("결제가 취소되었습니다. 플랜을 다시 선택해주세요.");
  }
  if (message.type === "PAYMENT_SUCCESS") {
    showAlert(`결제가 완료되었습니다! ${message.plan} 플랜이 적용되었습니다.`);
    setTimeout(() => chrome.tabs.getCurrent((tab) => chrome.tabs.remove(tab.id)), 2500);
  }
});

document.addEventListener("DOMContentLoaded", async function () {
  const planCards = document.querySelectorAll(".plan-card");
  payButton = document.getElementById("pay-button");
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

  // ─── 사용량 요약 섹션 로드 ───────────────────────────────────────────────

  const PLAN_DISPLAY = { free: "Free", naive: "Naive", pro: "Pro" };

  function renderUsageInfo(info) {
    const amountEl   = document.getElementById("usage-amount");
    const barEl      = document.getElementById("usage-bar");
    const planNameEl = document.getElementById("usage-plan-name");
    const expiryEl   = document.getElementById("usage-expiry");
    if (!amountEl) return;

    if (info.expires_at) {
      const daysLeft = Math.ceil((new Date(info.expires_at) - new Date()) / (1000 * 60 * 60 * 24));
      planNameEl.textContent = daysLeft > 0 ? `${daysLeft}일 남음` : "만료됨";
    } else if (info.plan === "free") {
      planNameEl.textContent = "–";
    } else {
      planNameEl.textContent = "–";
    }

    if (info.credits_total != null && info.credits_total > 0) {
      const used  = Number(info.credits_used  || 0).toLocaleString("ko-KR");
      const total = Number(info.credits_total).toLocaleString("ko-KR");
      amountEl.textContent = `${used} 크레딧 / ${total} 크레딧`;
      const pct = Math.min(100, Math.round(((info.credits_used || 0) / info.credits_total) * 100));
      barEl.style.width = `${pct}%`;
    } else if (info.plan === "pro") {
      amountEl.textContent = "무제한";
      barEl.style.width = "100%";
    } else {
      amountEl.textContent = "–";
      barEl.style.width = "0%";
    }

    if (info.expires_at) {
      const d     = new Date(info.expires_at);
      const month = d.getMonth() + 1;
      const day   = d.getDate();
      expiryEl.textContent = `${month}월 ${day}일에 취소됩니다`;
    } else if (info.plan === "free") {
      expiryEl.textContent = "무료 플랜 사용 중";
    } else {
      expiryEl.textContent = "";
    }
  }

  (async () => {
    try {
      const storage = await chrome.storage.local.get(["access_token", "plan"]);
      if (!storage.access_token) {
        renderUsageInfo({ plan: storage.plan || "free", credits_used: 0, credits_total: null, expires_at: null });
        return;
      }
      const response = await chrome.runtime.sendMessage({ type: "GET_USER_INFO" });
      if (response && !response.error) {
        renderUsageInfo(response);
      } else {
        renderUsageInfo({ plan: storage.plan || "free", credits_used: 0, credits_total: null, expires_at: null });
      }
    } catch (e) {
      const storage = await chrome.storage.local.get(["plan"]);
      renderUsageInfo({ plan: storage.plan || "free", credits_used: 0, credits_total: null, expires_at: null });
    }
  })();

  // ────────────────────────────────────────────────────────────────────────

  planCards.forEach((card) => {
    const cardPlan = card.dataset.plan;
    const cardRank = PLAN_ORDER.indexOf(cardPlan);
    const currentRank = PLAN_ORDER.indexOf(currentPlan);

    if (cardPlan === currentPlan) {
      // 현재 플랜 표시
      card.classList.add("current-plan");
      const badge = document.createElement("div");
      badge.className = "current-plan-badge";
      badge.textContent = "현재 플랜";
      card.prepend(badge);

      // 유료 플랜이면 구독 취소 버튼 삽입
      if (currentPlan !== "free") {
        const cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.className = "manage-btn";
        cancelBtn.textContent = "✕ 구독 취소";
        cancelBtn.addEventListener("click", () => {
          if (!confirm("구독을 취소하시겠습니까? 취소 후 현재 기간 만료 시 Free 플랜으로 전환됩니다.")) return;
          chrome.runtime.sendMessage({ type: "CANCEL_SUBSCRIPTION" }, (res) => {
            if (res && res.success) {
              showAlert("구독이 취소되었습니다. 현재 기간 만료 후 Free 플랜으로 전환됩니다.");
            } else {
              showAlert(res?.error || "구독 취소에 실패했습니다. 다시 시도해주세요.");
            }
          });
        });
        card.querySelector(".plan-header").insertAdjacentElement("afterend", cancelBtn);
      }
    } else if (cardRank < currentRank) {
      // 현재보다 낮은 플랜 비활성화
      card.classList.add("lower-plan");
    } else if (cardRank === currentRank + 1) {
      // 현재 플랜 바로 다음 단계에 추천 배지
      const badge = document.createElement("div");
      badge.className = "plan-badge";
      badge.textContent = "추천";
      card.prepend(badge);
    }
  });

  // 알림창 닫기
  alertClose.addEventListener("click", function () {
    customAlert.style.display = "none";
  });

  // 카드 선택 토글 (현재 플랜은 선택 불가)
  planCards.forEach((card) => {
    card.addEventListener("click", function () {
      if (card.classList.contains("current-plan")) return;
      if (card.classList.contains("lower-plan")) return;
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

    payButton.disabled = true;
    payButton.textContent = "결제 페이지 이동 중...";

    try {
      // background.js가 pendingPayment 저장 + 서버 결제 페이지(일반 웹) 새 탭으로 열기
      // 서버 페이지에서 js.tosspayments.com SDK를 자유롭게 사용
      const response = await chrome.runtime.sendMessage({
        type: "OPEN_TOSS_PAYMENT",
        orderId,
        plan: selectedPlan,
        amount: plan.amount,
        userID,
      });

      if (!response?.success) {
        showAlert(response?.error || "결제 페이지를 열지 못했습니다.");
        payButton.disabled = false;
        payButton.textContent = "선택 완료";
      }
      // 성공 시 새 탭이 열리며 현재 payment.html은 그대로 유지
    } catch (error) {
      showAlert("오류가 발생했습니다: " + error.message);
      payButton.disabled = false;
      payButton.textContent = "선택 완료";
    }
  });
});
