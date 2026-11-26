/* =====================================================
   囍莉旅遊｜報名系統
===================================================== */

const registrationParams = new URLSearchParams(window.location.search);
const selectedTripId = registrationParams.get("trip");
let selectedTrip = null;
let selectedSeatIds = [];
const seatActionsInFlight = new Set();
// 同一座位的操作依點擊順序排隊送出，但不阻擋使用者連續點擊。
const seatActionQueues = new Map();
// 本機先行釋放：避免等 Apps Script 回應時，舊的 pending 樣式仍卡在畫面上。
const locallyReleasedSeatIds = new Set();
const SEAT_IDS = [
  "1-1","1-2","1-3","1-4","2-1","2-2","2-3","2-4","3-1","3-2","3-3","3-4","4-1","4-2","4-3","4-4","5-1","5-2","5-3","5-4","6-1","6-2","7-1","7-2","8-1","8-2","9-1","9-2","9-3","9-4","10-1","10-2","10-3","10-4","11-1","11-2","11-3","11-4","12-1","12-2","12-3","12-4","12-5"
];
function renderSeatMap(occupied) {
  const root = document.getElementById("seatMap");
  if (!root) return;
  const isPendingStatus = x => x.status === "pending" || x.status === "held";
  const unavailable = new Set((occupied || []).filter(x => (isPendingStatus(x) || x.status === "confirmed") && !x.mine).map(x => String(x.seatId)));
  const pendingSeats = new Set((occupied || []).filter(x => isPendingStatus(x) && !locallyReleasedSeatIds.has(String(x.seatId))).map(x => String(x.seatId)));
  const confirmedSeats = new Set((occupied || []).filter(x => x.status === "confirmed").map(x => String(x.seatId)));
  const apiStaffSeats = (occupied || []).filter(x => x.status === "staff").map(x => String(x.seatId));
  const staffSeats = new Set([...(selectedTrip?.staffSeatIds || []).map(String), ...apiStaffSeats]);
  const cells = [];
  const add = (id, col, row) => {
    const staff = staffSeats.has(id);
    const taken = unavailable.has(id);
    const pending = pendingSeats.has(id);
    const confirmed = confirmedSeats.has(id);
    const ownPending = pending && (occupied || []).some(x => String(x.seatId) === id && x.mine);
    // 第一次送出只會建立待確認報名單；在使用者按下「確認無誤，完成報名」前，
    // 自己選取的座位仍維持橘色。只有最終確認後才結束本次暫選畫面。
    const chosen = selectedSeatIds.includes(id) && !registrationFinalized;
    // 座位表先立即顯示；行程設定尚未載入前暫時不能點選，
    // 避免 2-1／2-2 等工作人員座位在設定讀取前被誤選。
    const tripReady = !!selectedTrip;
    const disabled = !tripReady || staff || (taken && !ownPending);
    const cls = [staff ? 'staff-only' : '', confirmed ? 'taken' : '', pending && !chosen ? 'pending' : '', chosen ? 'selected' : '', !tripReady ? 'seat-loading' : ''].filter(Boolean).join(' ');
    const title = !tripReady ? '行程資料載入中' : staff ? '工作人員專用' : confirmed ? '已結清' : pending ? '已送出報名／待付款' : id;
    cells.push(`<button type="button" data-seat="${id}" class="${cls}" ${disabled ? 'disabled' : ''} title="${title}" style="grid-column:${col};grid-row:${row}">${id}</button>`);
  };
  const door = (label, cls, col, row, rowSpan = 1) =>
    `<div class="door ${cls}" style="grid-column:${col};grid-row:${row} / span ${rowSpan}">${label}</div>`;

  // 依原始座位表：左側 1–7 排、雙格安全門、8–12 排；右側前門、1–5 排、雙格中門、9–12 排；走道底端為 12-5。
  let html = door('前門', 'front', '4 / span 2', 1, 2)
    + door('安全門', 'safety', '1 / span 2', 8, 2)
    + door('中門', 'middle', '4 / span 2', 8, 3)
    + '<div class="aisle" style="grid-column:3;grid-row:1 / span 13">走道</div>';

  for (let r = 1; r <= 7; r++) { add(`${r}-1`, 1, r); add(`${r}-2`, 2, r); }
  for (let r = 8; r <= 12; r++) { add(`${r}-1`, 1, r + 2); add(`${r}-2`, 2, r + 2); }
  for (let r = 1; r <= 5; r++) { add(`${r}-3`, 4, r + 2); add(`${r}-4`, 5, r + 2); }
  for (let r = 9; r <= 12; r++) { add(`${r}-3`, 4, r + 2); add(`${r}-4`, 5, r + 2); }
  add('12-5', 3, 14);

  root.innerHTML = html + cells.join('');
  root.querySelectorAll('button[data-seat]').forEach(btn => btn.addEventListener('click', async () => {
    const id = btn.dataset.seat;

    // 即使同一座位的上一個請求尚未完成，也接受這次點擊；
    // 伺服器操作會依點擊順序排隊，畫面則立即更新。
    const wasSelected = selectedSeatIds.includes(id);
    if (wasSelected) {
      selectedSeatIds = selectedSeatIds.filter(x => x !== id);
      locallyReleasedSeatIds.add(id);
    } else if (selectedSeatIds.length < Number(peopleCountSelect.value || 1)) {
      locallyReleasedSeatIds.delete(id);
      selectedSeatIds.push(id);
    } else {
      alert('選擇座位數不可超過報名人數');
      return;
    }

    // 先更新畫面及草稿，不等待伺服器；本機選取一律先顯示橘色。
    refreshSeatSelection();
    saveRegistrationDraft();

    const action = wasSelected ? "releaseSeatSelection" : "selectSeat";
    enqueueSeatAction(action, id);
  }));
  refreshSeatSelection();
}

function refreshSeatSelection(){
  document.querySelectorAll('#seatMap button[data-seat]').forEach(b=>{
    const id = b.dataset.seat;
    const selected = selectedSeatIds.includes(id);
    b.classList.toggle('selected', selected);
    // 已在本機取消的座位，立即移除舊的藍色 pending 樣式並恢復可點選。
    if (locallyReleasedSeatIds.has(id) && !selected) {
      b.classList.remove('pending');
      if (!b.classList.contains('taken') && !b.classList.contains('staff-only')) {
        b.disabled = false;
        b.title = id;
      }
    }
  });
  const el=document.getElementById('seatSelectionText');if(el)el.textContent=selectedSeatIds.length?`已選座位：${selectedSeatIds.join('、')}`:'尚未選擇座位';
}

// 同一座位可連續操作：例如「選 A → 立刻取消 A」，
// UI 立即反映最後一次點擊，API 則依序完成 select 再 release，避免請求順序顛倒。
function enqueueSeatAction(action, seatId) {
  const queue = seatActionQueues.get(seatId) || [];
  queue.push(action);
  seatActionQueues.set(seatId, queue);
  if (seatActionsInFlight.has(seatId)) return;

  seatActionsInFlight.add(seatId);
  (async () => {
    try {
      while (queue.length) {
        const nextAction = queue.shift();
        try {
          await postSeatAction(nextAction, seatId);
        } catch (error) {
          console.warn(`座位 ${seatId} 同步失敗（${nextAction}）：`, error);
          alert(error.message || "座位同步失敗，請稍後確認座位狀態");
        }
      }
    } finally {
      seatActionQueues.delete(seatId);
      seatActionsInFlight.delete(seatId);
      refreshSeatSelection();
      // 請求全部完成後再用伺服器狀態校正，避免舊狀態覆蓋尚未送出的操作。
      loadSeatStatus();
    }
  })();
}

async function postSeatAction(action, seatId) {
    const response = await fetch(SUBMIT_API_URL, {
        method: "POST",
        headers: {"Content-Type":"text/plain;charset=utf-8"},
        body: JSON.stringify({action, tripId:selectedTrip.id, seatId, sessionId:seatSessionId, orderId:currentOrderId || ""})
    });
    const result = await response.json();
    if (!result || result.success !== true) throw new Error(result?.message || "座位同步失敗");
    return result.data;
}

let seatStatusLoading = false;
async function loadSeatStatus(){
  // 有座位操作正在送出時，暫停背景查詢，避免與後端共用的 ScriptLock 互相排隊。
  if(!selectedTrip?.id || seatStatusLoading || seatActionsInFlight.size > 0) return;
  seatStatusLoading = true;
  try {
    const response = await fetch(SUBMIT_API_URL, {
      method: "POST",
      cache: "no-store",
      headers: {"Content-Type":"text/plain;charset=utf-8"},
      body: JSON.stringify({
        action: "seatStatus",
        tripId: selectedTrip.id,
        sessionId: seatSessionId,
        orderId: currentOrderId || "",
        requestId: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random())
      })
    });
    const result = await response.json();
    if (!result || result.success !== true) throw new Error(result?.message || "座位狀態讀取失敗");
    const status = result.data || [];
    // 狀態查詢已在操作完成後執行，交由伺服器最新結果接管畫面。
    locallyReleasedSeatIds.clear();
    selectedTrip.staffSeatIds = status.filter(x => x.status === "staff").map(x => String(x.seatId));
    renderSeatMap(status);
  } catch (error) {
    console.warn("座位狀態同步失敗：", error);
  } finally {
    seatStatusLoading = false;
  }
}

const TRIPS_JSON_URL = "https://xilitravel.github.io/xili-registration/trips.json";

const BOARDING_API_URL = "https://script.google.com/macros/s/AKfycbwnN2PWqKHvWnIyTRPHkdT5a69ilwG2MUY8Iwx7IH3rzhTgj_5o6fItSYloSnk6piI4/exec?action=boardingPoints";

const SUBMIT_API_URL = "https://script.google.com/macros/s/AKfycbwnN2PWqKHvWnIyTRPHkdT5a69ilwG2MUY8Iwx7IH3rzhTgj_5o6fItSYloSnk6piI4/exec";

let boardingPointsList = [];

const registrationForm = document.getElementById("registrationForm");
const selectedTripContainer = document.getElementById("selectedTrip");
const peopleCountSelect = document.getElementById("peopleCount");
const travelerContainer = document.getElementById("travelerContainer");
const boardingContainer = document.getElementById("boardingContainer");
const submitButton = document.getElementById("submitButton");

const REG_DRAFT_KEY = "xili_registration_draft_v2";
const SEAT_SESSION_KEY = "xili_seat_session_v1";
let currentOrderId = "";
let hasSubmittedOrder = false;
let registrationFinalized = false;
let seatSessionId = sessionStorage.getItem(SEAT_SESSION_KEY);
if (!seatSessionId) {
    seatSessionId = (crypto.randomUUID ? crypto.randomUUID() : "s" + Date.now() + Math.random().toString(16).slice(2));
    sessionStorage.setItem(SEAT_SESSION_KEY, seatSessionId);
}
let seatHeldByThisTab = new Set();
let registrationDraft = null;
let draftRestored = false;
let boardingPointsReady = false;

try { registrationDraft = JSON.parse(sessionStorage.getItem(REG_DRAFT_KEY) || "null"); } catch (_) { registrationDraft = null; }

function saveRegistrationDraft() {
    if (registrationFinalized) {
        sessionStorage.removeItem(REG_DRAFT_KEY);
        return;
    }
    if (!selectedTrip) return;
    const fields = {};
    registrationForm.querySelectorAll("input[id],select[id],textarea[id]").forEach(el => {
        if (el.type === "checkbox" || el.type === "radio") fields[el.id] = {checked:el.checked, value:el.value};
        else fields[el.id] = {value:el.value};
    });
    const draft = {
        tripId: selectedTrip.id,
        fields,
        selectedSeatIds: [...selectedSeatIds],
        currentOrderId: hasSubmittedOrder ? currentOrderId : "",
        orderSubmitted: hasSubmittedOrder
    };
    try { sessionStorage.setItem(REG_DRAFT_KEY, JSON.stringify(draft)); } catch (e) { console.warn("報名草稿暫存失敗",e); }
}

function restoreRegistrationDraft() {
    if (draftRestored || !registrationDraft || !selectedTrip || !boardingPointsReady) return;
    if (String(registrationDraft.tripId) !== String(selectedTrip.id)) return;
    const fields = registrationDraft.fields || {};
    const count = fields.peopleCount?.value;
    if (count) {
        peopleCountSelect.value = count;
        renderTravelers();
    }
    Object.entries(fields).forEach(([id, saved]) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (el.type === "checkbox" || el.type === "radio") el.checked = !!saved.checked;
        else el.value = saved.value ?? "";
    });
    selectedSeatIds = Array.isArray(registrationDraft.selectedSeatIds) ? registrationDraft.selectedSeatIds.map(String) : [];
    // 只有曾經成功建立報名單的草稿才可進入「修改報名」流程。
    // 舊版草稿可能殘留未成功送出的 orderId，不能拿它當作正式報名單。
    hasSubmittedOrder = registrationDraft.orderSubmitted === true && !!registrationDraft.currentOrderId;
    currentOrderId = hasSubmittedOrder ? String(registrationDraft.currentOrderId) : "";
    refreshSeatSelection();
    draftRestored = true;
    saveRegistrationDraft();
    loadSeatStatus();

}

registrationForm.addEventListener("input", saveRegistrationDraft);
registrationForm.addEventListener("change", saveRegistrationDraft);
window.addEventListener("pagehide", saveRegistrationDraft);


/* =====================================================
   個資告知書視窗：明確綁定事件，避免按鈕點擊無反應
===================================================== */
function openPrivacyModal() {
    const modal = document.getElementById("privacyModal");
    if (!modal) {
        console.error("找不到個資視窗：#privacyModal");
        return;
    }
    modal.classList.add("open");
    modal.style.display = "block";
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
}

function closePrivacyModal() {
    const modal = document.getElementById("privacyModal");
    if (!modal) return;
    modal.classList.remove("open");
    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
}

// 同時提供全域函式，讓舊版 HTML inline onclick 也能正常使用。
window.openPrivacyModal = openPrivacyModal;
window.closePrivacyModal = closePrivacyModal;

function bindPrivacyModalEvents() {
    const openButton = document.getElementById("openPrivacyModal");
    const closeButton = document.getElementById("closePrivacyModal");
    const closeBottomButton = document.getElementById("closePrivacyModalBottom");
    const backdrop = document.getElementById("privacyModalBackdrop");

    if (openButton) openButton.addEventListener("click", openPrivacyModal);
    if (closeButton) closeButton.addEventListener("click", closePrivacyModal);
    if (closeBottomButton) closeBottomButton.addEventListener("click", closePrivacyModal);
    if (backdrop) backdrop.addEventListener("click", closePrivacyModal);
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindPrivacyModalEvents, { once: true });
} else {
    bindPrivacyModalEvents();
}

document.addEventListener("keydown", function(event) {
    if (event.key === "Escape") closePrivacyModal();
});


/* =====================================================
   1. 載入行程資料
===================================================== */

const TRIPS_CACHE_KEY = "xili_trips_cache_v1";
const SELECTED_TRIP_CACHE_KEY = "xili_selected_trip_v1";

function normalizeSelectedTrip(apiTrip) {
    return {
        id: apiTrip.id || apiTrip.tripId,
        sheetName: apiTrip.sheetName || apiTrip.worksheetName || apiTrip.title || apiTrip.name || "",
        title: apiTrip.title || apiTrip.name || "未命名行程",
        date: apiTrip.date || "",
        dateText: apiTrip.dateText || apiTrip.date || "待設定",
        price: apiTrip.price || 0,
        priceText: apiTrip.priceText || (apiTrip.price != null ? "$" + Number(apiTrip.price).toLocaleString() : "待設定"),
        status: apiTrip.status || "",
        maxPeople: apiTrip.maxPeople || 0,
        registeredPeople: apiTrip.registeredPeople || 0,
        deadline: apiTrip.deadline || "",
        departure: apiTrip.departure || "台南",
        boardingPoints: apiTrip.boardingPoints || [],
        description: apiTrip.description || "",
        tripDays: Number(apiTrip.tripDays || apiTrip.days || 1),
        lodging: apiTrip.lodging === true || apiTrip.tripLodging === "true" || apiTrip.hasLodging === true,
        roomTypes: apiTrip.roomTypes || apiTrip.rooms || [],
        meals: apiTrip.meals || apiTrip.mealSettings || [],
        staffSeatIds: Array.isArray(apiTrip.staffSeatIds) ? apiTrip.staffSeatIds.map(String) : []
    };
}

function showSelectedTrip(apiTrip) {
    if (!apiTrip) return false;
    selectedTrip = normalizeSelectedTrip(apiTrip);
    registrationForm.style.display = "";
    renderSelectedTrip();
    return true;
}

async function loadBoardingPointsInBackground() {
    try {
        const response = await fetch(BOARDING_API_URL);
        if (!response.ok) throw new Error("HTTP " + response.status);
        const result = await response.json();
        if (result?.success && Array.isArray(result.data)) {
            boardingPointsList = result.data;
        } else if (Array.isArray(result?.boardingPoints)) {
            boardingPointsList = result.boardingPoints;
        } else {
            boardingPointsList = [];
        }
    } catch (error) {
        console.warn("載入上車地點失敗：", error);
        boardingPointsList = [];
    } finally {
        boardingPointsReady = true;
        restoreRegistrationDraft();
    }
}

async function loadSelectedTrip() {
    let renderedFromCache = false;

    // 由行程列表頁點選時，先讀取該行程完整資料，第一時間直接顯示，不必等待 trips.json 網路請求。
    try {
        const handedOffTrip = JSON.parse(localStorage.getItem(SELECTED_TRIP_CACHE_KEY) || "null");
        if (handedOffTrip && String(handedOffTrip.id || handedOffTrip.tripId) === String(selectedTripId)) {
            renderedFromCache = showSelectedTrip(handedOffTrip);
            if (renderedFromCache) loadSeatStatus();
        }
    } catch (error) {
        console.warn("讀取選取行程快取失敗：", error);
    }

    // 若沒有單筆行程快取，再使用完整行程清單快取。
    try {
        const cached = JSON.parse(localStorage.getItem(TRIPS_CACHE_KEY) || "null");
        if (Array.isArray(cached)) {
            const cachedTrip = cached.find(trip => String(trip.id || trip.tripId) === String(selectedTripId));
            if (cachedTrip && !renderedFromCache) {
                renderedFromCache = showSelectedTrip(cachedTrip);
                if (renderedFromCache) loadSeatStatus();
            }
        }
    } catch (error) {
        console.warn("行程快取讀取失敗：", error);
    }

    // 上車地點與座位狀態都在背景載入，不阻擋行程卡片顯示。
    loadBoardingPointsInBackground();

    try {
        // 每次開啟報名頁都向 GitHub Pages 取得最新行程，避免瀏覽器/CDN 快取舊清單。
        const response = await fetch(TRIPS_JSON_URL + "?t=" + Date.now(), { cache: "no-store" });
        if (!response.ok) throw new Error("讀取行程資料失敗（HTTP " + response.status + "）");
        const trips = await response.json();
        if (!Array.isArray(trips)) throw new Error("trips.json 格式錯誤");

        // 保存最新行程快取，下一次進入報名頁即可先顯示。
        try { localStorage.setItem(TRIPS_CACHE_KEY, JSON.stringify(trips)); }
        catch (error) { console.warn("無法保存行程快取：", error); }

        const apiTrip = trips.find(trip => String(trip.id || trip.tripId) === String(selectedTripId));
        if (!apiTrip) {
            selectedTripContainer.innerHTML = `
                <div class="empty-trip">
                    <h3>⚠️ 找不到旅遊行程</h3>
                    <p>請回到旅遊行程頁面，重新選擇想報名的行程。</p>
                    <a href="trips.html">返回旅遊行程</a>
                </div>`;
            registrationForm.style.display = "none";
            return;
        }

        // 若已有快取先顯示，收到最新資料後再靜默更新畫面。
        showSelectedTrip(apiTrip);
        restoreRegistrationDraft();
        loadSeatStatus();
    } catch (error) {
        console.error("載入報名行程失敗：", error);
        if (!renderedFromCache) {
            selectedTripContainer.innerHTML = `
                <div class="empty-trip">
                    <h3>⚠️ 行程資料載入失敗</h3>
                    <p>請確認網路連線後重新整理頁面。</p>
                </div>`;
            registrationForm.style.display = "none";
        } else {
            // 快取資料仍可供查看，提醒使用者資料可能不是最新版本。
            const note = document.createElement("small");
            note.textContent = "目前顯示上次載入的行程資料，最新資料暫時無法更新。";
            note.style.color = "#9b456f";
            selectedTripContainer.appendChild(note);
        }
    }
}

/* =====================================================
   2. 顯示選擇的行程
===================================================== */

function renderSelectedTrip() {

    if (!selectedTrip) return;

    selectedTripContainer.innerHTML = `
        <div class="selected-trip-card">

            <h3>🌸 ${selectedTrip.title}</h3>

            <p>
                📅 <strong>出團日期：</strong>
                ${selectedTrip.dateText || "待設定"}
            </p>

            <p>
                💰 <strong>團費：</strong>
                ${selectedTrip.priceText || "待設定"}
            </p>

            <p>
                👥 <strong>報名人數：</strong>
                ${selectedTrip.registeredPeople || 0}
                /
                ${selectedTrip.maxPeople || "不限"}
            </p>

            <p>
                ⏰ <strong>報名截止：</strong>
                ${selectedTrip.deadline || "待設定"}
            </p>

            <p>
                📍 <strong>出發地：</strong>
                ${selectedTrip.departure || "台南"}
            </p>

        </div>
    `;

}


/* =====================================================
   3. 建立旅客資料欄位
===================================================== */

function renderTravelers() {

    const peopleCount = Number(peopleCountSelect.value);

    travelerContainer.innerHTML = "";

    boardingContainer.innerHTML = "";


    if (!peopleCount) {

        travelerContainer.innerHTML = `
            <div class="empty-category">
                請先選擇報名人數。
            </div>
        `;

        boardingContainer.innerHTML = "";

        return;

    }


    /* 使用已載入的上車地點 */

    const boardingPoints = boardingPointsList;


    /* =================================================
       建立每位旅客資料
    ================================================= */

    for (let i = 1; i <= peopleCount; i++) {

        /* =============================================
           旅客資料卡
        ============================================= */

        const travelerCard = document.createElement("div");

        travelerCard.className = "traveler-card";


        const isMainContact = i === 1;


        /* 房型選項 */

        const roomOptions =
            Array.isArray(selectedTrip.roomTypes) &&
            selectedTrip.roomTypes.length
                ? selectedTrip.roomTypes
                : [
                    "單人房",
                    "雙人房（一大床）",
                    "雙人房（兩小床）",
                    "三人房",
                    "四人房"
                ];


        /* 餐食設定 */

        const mealEntries = Array.isArray(selectedTrip.meals)
            ? selectedTrip.meals.filter(function(meal) {
                return meal && meal.provided;
            })
            : [];


        const mealFieldsHTML = mealEntries.map(function(meal) {

            const label = meal.label || meal.name || meal.key || "餐食";

            const key = meal.key || label.replace(/\s/g, "");


            return `
                <div class="form-group">

                    <label for="travelerMeal${i}_${key}">

                        ${label}飲食需求

                        <span class="required">*</span>

                    </label>

                    <select
                        id="travelerMeal${i}_${key}"
                        name="travelerMeal${i}_${key}"
                        required
                    >

                        <option value="">請選擇</option>

                        <option value="葷食">葷食</option>

                        <option value="素食">素食</option>

                    </select>

                </div>
            `;

        }).join("");


        /* 住宿房型欄位 */

        const roomFieldHTML = selectedTrip.lodging
            ? `
                <div class="form-group">

                    <label for="travelerRoom${i}">

                        房型

                        <span class="required">*</span>

                    </label>

                    <select
                        id="travelerRoom${i}"
                        name="travelerRoom${i}"
                        required
                    >

                        <option value="">請選擇房型</option>

                        ${roomOptions.map(function(room) {
                            return `<option value="${room}">${room}</option>`;
                        }).join("")}

                    </select>

                </div>
            `
            : "";


        /* 旅客基本資料 */

        travelerCard.innerHTML = `

            <h3>
                👤 旅客資料 ${i}

                ${isMainContact
                    ? '<span class="main-contact-label">（主要聯絡人）</span>'
                    : ''
                }

            </h3>


            <div class="form-group">

                <label for="travelerName${i}">

                    姓名

                    <span class="required">*</span>

                </label>

                <input
                    type="text"
                    id="travelerName${i}"
                    name="travelerName${i}"
                    autocomplete="name"
                    required
                    placeholder="請輸入旅客姓名"
                >

            </div>


            <div class="form-group">

                <label for="travelerBirth${i}">

                    出生年月日

                    <span class="required">*</span>

                </label>

                <div class="birth-date-input-wrap" style="display:flex; flex-direction:column; gap:8px; align-items:flex-start;">

                    <input
                        type="text"
                        id="travelerBirth${i}"
                        name="travelerBirth${i}"
                        autocomplete="off"
                        required
                        maxlength="9"
                        placeholder="民國 84/06/24"
                        inputmode="numeric"
                        autocomplete="bday"
                        onblur="normalizeRocBirthDate(${i})"
                        style="width:100%; max-width:310px;"
                    >

                    <button
                        type="button"
                        onclick="toggleBirthCalendar(${i})"
                        style="display:inline-flex; align-items:center; gap:8px; padding:9px 13px; border:1px solid #e7a1bd; border-radius:9px; background:#fff0f6; color:#b51d63; font-weight:600; cursor:pointer;"
                    >📅 選擇日期</button>

                    <div
                        id="travelerBirthCalendar${i}"
                        style="display:none; width:100%; max-width:320px; box-sizing:border-box; padding:12px; border:1px solid #efb5cc; border-radius:12px; background:#fff; box-shadow:0 4px 14px rgba(181,29,99,.10);"
                    ></div>

                </div>

                <small style="display:block; margin-top:6px; color:#8a7180;">
                    可直接輸入民國年（例如 84/06/24），或使用日曆選擇；年份可直接輸入，不必逐年滑動。
                </small>

            </div>


            <div class="form-group">

                <label for="travelerID${i}">

                    身分證字號

                    <span class="required">*</span>

                </label>

                <input
                    type="text"
                    id="travelerID${i}"
                    name="travelerID${i}"
                    required
                    maxlength="10"
                    autocomplete="off"
                    placeholder="請輸入身分證字號"
                >

            </div>


            <div class="form-group">

                <label for="travelerPhone${i}">

                    聯絡電話

                    ${isMainContact
                        ? '<span class="required">*</span>'
                        : '<span>（選填）</span>'
                    }

                </label>

                <input
                    type="tel"
                    id="travelerPhone${i}"
                    name="travelerPhone${i}"
                    autocomplete="off"
                    ${isMainContact ? 'required' : ''}
                    placeholder="請輸入聯絡電話"
                >

            </div>


            ${roomFieldHTML}

            ${mealFieldsHTML}

        `;


        travelerContainer.appendChild(travelerCard);
               /* =============================================
           上車地點卡
        ============================================= */

        const boardingCard = document.createElement("div");

        boardingCard.className = "boarding-card";


        /* 第一上車地點選項 */

        let firstOptionsHTML = `

            <option value="">
                請選擇第一上車地點
            </option>

        `;


        boardingPoints.forEach(function(point) {

            firstOptionsHTML += `

                <option value="${point}">
                    ${point}
                </option>

            `;

        });


        firstOptionsHTML += `

            <option value="custom">
                ✏️ 自行輸入上車地點
            </option>

        `;


        /* 第二上車地點選項 */

        let secondOptionsHTML = `

            <option value="">
                不需要第二上車地點
            </option>

        `;


        boardingPoints.forEach(function(point) {

            secondOptionsHTML += `

                <option value="${point}">
                    ${point}
                </option>

            `;

        });


        secondOptionsHTML += `

            <option value="custom">
                ✏️ 自行輸入上車地點
            </option>

        `;


        boardingCard.innerHTML = `

            <h3>
                🚌 旅客 ${i} 上車地點
            </h3>


            <!-- 第一上車地點 -->

            <div class="form-group">

                <label for="boardingFirst${i}">

                    第一上車地點
                    <span class="required">*</span>

                </label>


                <select
                    id="boardingFirst${i}"
                    name="boardingFirst${i}"
                    required
                >

                    ${firstOptionsHTML}

                </select>


                <input
                    type="text"
                    id="boardingFirstCustom${i}"
                    name="boardingFirstCustom${i}"
                    placeholder="請輸入第一上車地點"
                    style="display:none;"
                >

            </div>


            <!-- 第二上車地點 -->

            <div class="form-group">

                <label for="boardingSecond${i}">

                    第二上車地點

                    <span>
                        （選填）
                    </span>

                </label>


                <select
                    id="boardingSecond${i}"
                    name="boardingSecond${i}"
                >

                    ${secondOptionsHTML}

                </select>


                <input
                    type="text"
                    id="boardingSecondCustom${i}"
                    name="boardingSecondCustom${i}"
                    placeholder="請輸入第二上車地點"
                    style="display:none;"
                >

            </div>


            <p class="boarding-hint">

                💡 第二上車地點不需要選擇時，
                請直接留空即可。

            </p>

        `;


        boardingContainer.appendChild(boardingCard);


        /* =============================================
           第一上車地點自行輸入
        ============================================= */

        const firstSelect = document.getElementById(
            "boardingFirst" + i
        );

        const firstCustomInput = document.getElementById(
            "boardingFirstCustom" + i
        );


        firstSelect.addEventListener("change", function() {

            if (this.value === "custom") {

                firstCustomInput.style.display = "block";

                firstCustomInput.required = true;

            } else {

                firstCustomInput.style.display = "none";

                firstCustomInput.required = false;

                firstCustomInput.value = "";

            }

        });


        /* =============================================
           第二上車地點自行輸入
        ============================================= */

        const secondSelect = document.getElementById(
            "boardingSecond" + i
        );

        const secondCustomInput = document.getElementById(
            "boardingSecondCustom" + i
        );


        secondSelect.addEventListener("change", function() {

            if (this.value === "custom") {

                secondCustomInput.style.display = "block";

            } else {

                secondCustomInput.style.display = "none";

                secondCustomInput.value = "";

            }

        });


        /* =============================================
           第一及第二上車地點不能相同
        ============================================= */

        firstSelect.addEventListener("change", function() {

            checkBoardingLocations(i);

        });


        secondSelect.addEventListener("change", function() {

            checkBoardingLocations(i);

        });


    }


    /* =================================================
       多人報名時，代理填寫確認
    ================================================= */

    const proxyConsent = document.getElementById(
        "proxyConsent"
    );


    if (peopleCount > 1) {

        proxyConsent.required = true;

    } else {

        proxyConsent.required = false;

    }


}
/* =====================================================
   6. 檢查上車地點是否重複
===================================================== */

function checkBoardingLocations(travelerNumber) {


    const firstSelect = document.getElementById(
        "boardingFirst" + travelerNumber
    );


    const secondSelect = document.getElementById(
        "boardingSecond" + travelerNumber
    );


    const firstCustomInput = document.getElementById(
        "boardingFirstCustom" + travelerNumber
    );


    const secondCustomInput = document.getElementById(
        "boardingSecondCustom" + travelerNumber
    );


    let firstValue = firstSelect.value;


    let secondValue = secondSelect.value;


    /* 自行輸入時使用輸入內容 */

    if (firstValue === "custom") {

        firstValue = firstCustomInput.value.trim();

    }


    if (secondValue === "custom") {

        secondValue = secondCustomInput.value.trim();

    }


    if (
        firstValue &&
        secondValue &&
        firstValue === secondValue
    ) {

        alert(
            "第一及第二上車地點不能相同，請重新選擇。"
        );

        secondSelect.value = "";

        secondCustomInput.value = "";

        secondCustomInput.style.display = "none";

    }

}


/* =====================================================
   7. 報名人數變更
===================================================== */

peopleCountSelect.addEventListener(
    "change",
    renderTravelers
);


/* =====================================================
   8. 收集旅客資料
===================================================== */

/* =========================
   出生年月日：手動輸入 / 快速日曆
   西元年份可直接輸入；轉存格式為民國年，不補前導 0
   例如 1995/06/24 -> 84/06/24
========================= */

window.birthCalendarState = window.birthCalendarState || {};

function normalizeRocBirthDate(index) {
    const input = document.getElementById("travelerBirth" + index);
    if (!input) return;

    const match = input.value.trim().match(/^0*(\d{1,3})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (!match) return;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    if (year <= 0 || month < 1 || month > 12 || day < 1 || day > 31) return;

    input.value =
        String(year) + "/" +
        String(month).padStart(2, "0") + "/" +
        String(day).padStart(2, "0");
}

function toggleBirthCalendar(index) {
    const panel = document.getElementById("travelerBirthCalendar" + index);
    if (!panel) return;

    const isOpen = panel.style.display !== "none";
    if (isOpen) {
        panel.style.display = "none";
        return;
    }

    const textInput = document.getElementById("travelerBirth" + index);
    const match = textInput && textInput.value.match(/^(\d{1,3})\/(\d{1,2})\/(\d{1,2})$/);
    let year, month;

    if (match) {
        year = Number(match[1]) + 1911;
        month = Number(match[2]);
    } else {
        const now = new Date();
        year = now.getFullYear() - 30;
        month = now.getMonth() + 1;
    }

    window.birthCalendarState[index] = { year, month };
    panel.style.display = "block";
    renderBirthCalendar(index);
}

function renderBirthCalendar(index) {
    const panel = document.getElementById("travelerBirthCalendar" + index);
    const state = window.birthCalendarState[index];
    if (!panel || !state) return;

    const year = Number(state.year);
    const month = Number(state.month);
    const firstDay = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const today = new Date();
    const maxDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const weekdays = ["日", "一", "二", "三", "四", "五", "六"];

    let dayCells = weekdays.map(d =>
        `<div style="text-align:center;padding:6px 0;color:#98627b;font-size:13px;">${d}</div>`
    ).join("");

    for (let blank = 0; blank < firstDay; blank++) {
        dayCells += `<div></div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const candidate = new Date(year, month - 1, day);
        const disabled = candidate > maxDate;
        dayCells += `
            <button type="button"
                ${disabled ? "disabled" : ""}
                onclick="selectBirthCalendarDate(${index},${year},${month},${day})"
                style="min-height:34px;border:0;border-radius:7px;background:${disabled ? "#f4f0f2" : "#fff"};color:${disabled ? "#c9c0c5" : "#71334f"};cursor:${disabled ? "not-allowed" : "pointer"};font:inherit;">
                ${day}
            </button>`;
    }

    panel.innerHTML = `
        <div style="display:flex;align-items:center;gap:7px;margin-bottom:10px;">
            <label style="font-size:13px;color:#71334f;white-space:nowrap;">西元年</label>
            <input type="number" min="1912" max="${today.getFullYear()}" step="1"
                value="${year}" aria-label="輸入西元年份"
                onchange="changeBirthCalendarYear(${index},this.value)"
                onkeydown="if(event.key==='Enter'){changeBirthCalendarYear(${index},this.value)}"
                style="width:105px;min-height:36px;padding:5px 7px;border:1px solid #e7a1bd;border-radius:7px;">
            <label style="font-size:13px;color:#71334f;">月份</label>
            <select aria-label="選擇月份"
                onchange="changeBirthCalendarMonth(${index},this.value)"
                style="flex:1;min-height:36px;padding:5px;border:1px solid #e7a1bd;border-radius:7px;background:#fff;">
                ${Array.from({length:12},(_,n)=>`<option value="${n+1}" ${month===n+1?"selected":""}>${n+1} 月</option>`).join("")}
            </select>
        </div>
        <div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:3px;">
            ${dayCells}
        </div>
        <div style="margin-top:9px;text-align:right;">
            <button type="button" onclick="document.getElementById('travelerBirthCalendar${index}').style.display='none'"
                style="padding:6px 12px;border:1px solid #e7a1bd;border-radius:7px;background:#fff0f6;color:#b51d63;cursor:pointer;">關閉</button>
        </div>`;
}

function changeBirthCalendarYear(index, value) {
    const year = Number(value);
    const currentYear = new Date().getFullYear();
    if (!Number.isInteger(year) || year < 1912 || year > currentYear) {
        alert("請輸入 1912 到 " + currentYear + " 之間的西元年份。");
        renderBirthCalendar(index);
        return;
    }
    window.birthCalendarState[index].year = year;
    renderBirthCalendar(index);
}

function changeBirthCalendarMonth(index, value) {
    const month = Number(value);
    if (month < 1 || month > 12) return;
    window.birthCalendarState[index].month = month;
    renderBirthCalendar(index);
}

function selectBirthCalendarDate(index, year, month, day) {
    const textInput = document.getElementById("travelerBirth" + index);
    const panel = document.getElementById("travelerBirthCalendar" + index);
    const rocYear = year - 1911;

    if (!textInput || rocYear <= 0) return;

    textInput.value =
        String(rocYear) + "/" +
        String(month).padStart(2, "0") + "/" +
        String(day).padStart(2, "0");

    textInput.dispatchEvent(new Event("input", { bubbles: true }));
    textInput.dispatchEvent(new Event("change", { bubbles: true }));

    if (panel) panel.style.display = "none";
}

function collectTravelerData() {

    const peopleCount = Number(
        peopleCountSelect.value
    );


    const travelers = [];


    for (let i = 1; i <= peopleCount; i++) {


        /* =========================
           旅客基本資料
        ========================= */

        const travelerName = document.getElementById(
            "travelerName" + i
        ).value.trim();


        const travelerID = document.getElementById(
            "travelerID" + i
        ).value.trim().toUpperCase();


        const travelerBirth = document.getElementById(
            "travelerBirth" + i
        ).value;


        const travelerPhone = document.getElementById(
            "travelerPhone" + i
        ).value.trim();


        /* =========================
           第一上車地點
        ========================= */

        let boardingFirst = document.getElementById(
            "boardingFirst" + i
        ).value;


        const boardingFirstCustom = document.getElementById(
            "boardingFirstCustom" + i
        ).value.trim();


        if (boardingFirst === "custom") {

            boardingFirst = boardingFirstCustom;

        }


        /* =========================
           第二上車地點
        ========================= */

        let boardingSecond = document.getElementById(
            "boardingSecond" + i
        ).value;


        const boardingSecondCustom = document.getElementById(
            "boardingSecondCustom" + i
        ).value.trim();


        if (boardingSecond === "custom") {

            boardingSecond = boardingSecondCustom;

        }


        /* =========================
           房型
        ========================= */

        const roomElement = document.getElementById(
            "travelerRoom" + i
        );

        const roomType = roomElement
            ? roomElement.value
            : "";


        /* =========================
           餐食
        ========================= */

        const meals = {};


        document.querySelectorAll(
            `[id^="travelerMeal${i}_"]`
        ).forEach(function(element) {

            meals[
                element.id.replace(
                    `travelerMeal${i}_`,
                    ""
                )
            ] = element.value;

        });


        /* =========================
           建立旅客資料
        ========================= */

        travelers.push({

            travelerNumber: i,

            isMainContact: i === 1,

            name: travelerName,

            idNumber: travelerID,

            birthday: travelerBirth,

            phone: travelerPhone,

            boardingFirst: boardingFirst,

            boardingSecond: boardingSecond,

            roomType: roomType,

            meals: meals

        });


    }


    return travelers;

}


/* =====================================================
   9. 送出報名資料
===================================================== */

registrationForm.addEventListener(
    "submit",
    async function(event) {

        event.preventDefault();

        if (!selectedTrip) {
            alert("找不到報名行程，請重新選擇行程。");
            return;
        }

        if (!registrationForm.checkValidity()) {
            registrationForm.reportValidity();
            return;
        }

        const peopleCount = Number(peopleCountSelect.value);
        const travelers = collectTravelerData();
        const privacyConsent = document.getElementById("privacyConsent").checked;
        const photoConsentElement = document.querySelector('input[name="photoConsent"]:checked');
        const photoConsent = photoConsentElement ? photoConsentElement.value : "";
        const proxyConsent = document.getElementById("proxyConsent").checked;
        const confirmData = document.getElementById("confirmData").checked;

        // 將目前表單資料轉成 Code.gs submitRegistration 所需格式
        const payload = {
            action: hasSubmittedOrder && currentOrderId ? "updateRegistration" : "submitRegistration",
            orderId: hasSubmittedOrder ? currentOrderId : "",
            seatSessionId: seatSessionId,
            tripId: selectedTrip.id,
            tripName: selectedTrip.sheetName || selectedTrip.title,
            seatIds: selectedSeatIds,
            paymentMethod: document.getElementById("paymentMethod").value,
            peopleCount: peopleCount,
            travelers: travelers.map(function(traveler) {
                return {
                    name: traveler.name,
                    birthDate: traveler.birthday,
                    idNumber: traveler.idNumber,
                    phone: traveler.phone,
                    boardingFirst: traveler.boardingFirst,
                    boardingSecond: traveler.boardingSecond,
                    photoConsent: photoConsent,
                    roomType: traveler.roomType,
                    meals: traveler.meals
                };
            }),
            privacyConsent: privacyConsent,
            privacyUseConsent: document.getElementById("privacyUseConsent").checked,
            photoConsent: photoConsent,
            proxyConsent: proxyConsent,
            confirmData: confirmData,
            submittedAt: new Date().toISOString()
        };

        const originalButtonText = submitButton ? submitButton.textContent : "";
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = "資料送出中…";
        }

        try {
            const response = await fetch(SUBMIT_API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "text/plain;charset=utf-8"
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (!result || result.success !== true) {
                throw new Error(result && result.message ? result.message : "報名資料送出失敗");
            }

            currentOrderId = (result.data && result.data.orderId) || currentOrderId;
            hasSubmittedOrder = !!currentOrderId;
            seatHeldByThisTab.clear();
            saveRegistrationDraft();
            // 不等待額外的座位狀態 API；報名已由伺服器成功寫入，先立即顯示確認畫面。
            const registrationData = {
                trip: {
                    id: selectedTrip.id,
                    title: selectedTrip.title,
                    date: selectedTrip.dateText,
                    price: selectedTrip.priceText
                },
                mainRegistrant: travelers[0] || {},
                peopleCount: peopleCount,
                travelers: travelers,
                seatIds: [...selectedSeatIds],
                privacyConsent: privacyConsent,
                photoConsent: photoConsent,
                proxyConsent: proxyConsent,
                confirmData: confirmData,
                submittedAt: new Date().toISOString(),
                saved: true,
                orderId: result.data && result.data.orderId,
                amountDue: result.data && result.data.amountDue,
                holdUntil: result.data && result.data.holdUntil,
                serverMessage: result.message || (result.data && result.data.message) || "報名資料已成功送出"
            };

            showRegistrationConfirmation(registrationData);
            // 座位狀態改為背景同步，不再讓客人等兩次 API 才看到成功畫面。
            loadSeatStatus().catch(error => console.warn("報名後座位狀態背景同步失敗：", error));

        } catch (error) {
            console.error("報名送出錯誤：", error);
            alert("報名資料送出失敗：\n" + (error.message || "請稍後再試，或聯絡阿冷確認。"));
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = originalButtonText || "送出報名";
            }
        }

    }
);

/* =====================================================
   10. 顯示報名確認
===================================================== */

function showRegistrationConfirmation(data) {


    /* =========================
       整理旅客資料
    ========================= */

    let travelerHTML = "";


    data.travelers.forEach(function(traveler) {


        travelerHTML += `

            <div class="confirmation-traveler">

                <h4>
                    👤 旅客 ${traveler.travelerNumber}
                </h4>


                <p>

                    <strong>姓名：</strong>

                    ${traveler.name}

                </p>


                <p>

                    <strong>身分證字號：</strong>

                    ${traveler.idNumber}

                </p>


                <p>

                    <strong>出生日期：</strong>

                    ${traveler.birthday}

                </p>


                <p>

                    <strong>聯絡電話：</strong>

                    ${traveler.phone || "未填寫"}

                </p>


                <p>

                    <strong>第一上車地點：</strong>

                    ${traveler.boardingFirst}

                </p>


                <p>

                    <strong>第二上車地點：</strong>

                    ${traveler.boardingSecond || "未選擇"}

                </p>


                ${traveler.roomType
                    ? `<p><strong>房型：</strong>${traveler.roomType}</p>`
                    : ""
                }


                ${Object.entries(traveler.meals || {})
                    .map(function([meal, choice]) {

                        return `
                            <p>
                                <strong>${meal}：</strong>
                                ${choice || "未選擇"}
                            </p>
                        `;

                    })
                    .join("")
                }

            </div>

        `;


    });


    /* =========================
       建立確認畫面
    ========================= */

    const confirmation = document.createElement("section");


    confirmation.className = "card confirmation-card";


    confirmation.innerHTML = `

        <h2>
            🎉 報名資料確認
        </h2>


        <p>

            請確認以下報名資料。

        </p>


        <div class="confirmation-section">


            <h3>
                🌸 報名行程
            </h3>


            <p>

                <strong>行程名稱：</strong>

                ${data.trip.title}

            </p>


            <p>

                <strong>出團日期：</strong>

                ${data.trip.date}

            </p>


            <p>

                <strong>團費：</strong>

                ${data.trip.price}

            </p>


            <p>

                <strong>報名人數：</strong>

                ${data.peopleCount} 人

            </p>


        </div>


        <div class="confirmation-section">


            <h3>
                👥 旅客資料
            </h3>


            ${travelerHTML}


        </div>


        <div class="confirmation-section">

            <h3>
                🚌 遊覽車座位
            </h3>

            <p>
                <strong>已選座位：</strong>
                ${(Array.isArray(data.seatIds) && data.seatIds.length) ? data.seatIds.join("、") : "未選擇座位"}
            </p>

        </div>


        <div class="confirmation-section">


            <h3>
                📋 同意事項
            </h3>


            <p>

                <strong>個資同意：</strong>

                ${data.privacyConsent ? "已同意" : "未同意"}

            </p>


            <p>

                <strong>照片／影片：</strong>

                ${data.photoConsent}

            </p>


            <p>

                <strong>代理填寫：</strong>

                ${data.proxyConsent ? "已確認" : "未勾選"}

            </p>


        </div>


        <div class="confirmation-notice">


            <h3>
                📢 下一步
            </h3>


            <p>

                報名資料已送出並寫入報名名單。
                請保留此確認畫面，並依旅行社通知完成後續付款。

            </p>


            <p>

                送出後請加入 LINE 聯絡阿冷，
                確認報名資料及報名成功。

            </p>


            <p>

                LINE：

                <strong>0909686339</strong>

            </p>


            <p>

                聯絡人：

                <strong>陳莉瀅（阿冷）－悅揚旅行社</strong>

            </p>


        </div>


        <button
            type="button"
            onclick="window.print()"
        >

            🖨️ 列印報名資料

        </button>


        <button
            type="button"
            id="returnToEditRegistration"
        >

            ↩️ 返回修改資料

        </button>

        <button
            type="button"
            id="finalConfirmRegistration"
            class="primary-button"
        >

            ✓ 確認無誤，完成報名

        </button>


    `;


    /* =========================
       隱藏原本表單
    ========================= */

    registrationForm.style.display = "none";


    /* =========================
       顯示確認資料
    ========================= */

    registrationForm.parentElement.appendChild(
        confirmation
    );

    const returnButton = confirmation.querySelector("#returnToEditRegistration");
    if (returnButton) returnButton.addEventListener("click", function() {
        confirmation.remove();
        registrationForm.style.display = "";
        registrationForm.scrollIntoView({behavior:"smooth",block:"start"});
        saveRegistrationDraft();
    });

    // 最終確認：保留後端已建立的正式報名單與座位，不再把它當成可編輯草稿。
    // 清除本瀏覽器的訂單關聯，下一次重新整理／重新填寫會建立全新報名單。
    const finalConfirmButton = confirmation.querySelector("#finalConfirmRegistration");
    if (finalConfirmButton) finalConfirmButton.addEventListener("click", function() {
        if (!window.confirm("確認資料無誤並完成本次報名嗎？完成後若要更改，請聯絡阿冷。")) return;
        registrationFinalized = true;
        sessionStorage.removeItem(REG_DRAFT_KEY);
        currentOrderId = "";
        hasSubmittedOrder = false;
        selectedSeatIds = [];
        seatHeldByThisTab.clear();
        confirmation.innerHTML = `
            <h2>🎉 本次報名已完成最終確認</h2>
            <p>報名資料已保留，座位仍依付款狀態顯示。若需要修改，請聯絡阿冷。</p>
            <p>下一次重新整理此頁或重新開啟報名頁，將會開始一筆全新的報名。</p>
        `;
        confirmation.scrollIntoView({behavior:"smooth",block:"start"});
    });


    /* =========================
       捲動到確認畫面
    ========================= */

    confirmation.scrollIntoView({

        behavior: "smooth",

        block: "start"

    });


}


/* =====================================================
   11. 初始化
===================================================== */

// 不等待 trips.json 或 Apps Script：先把固定座位表畫面立即顯示。
// 此時座位按鈕暫時 disabled；取得行程設定與座位狀態後再開放可選座位。
renderSeatMap([]);

loadSelectedTrip();


/* =====================================================
   12. 預設顯示提示
===================================================== */
// 人數變更時同步限制選位數量
peopleCountSelect?.addEventListener("change", function(){
  if(selectedSeatIds.length>Number(this.value||1)){selectedSeatIds=selectedSeatIds.slice(0,Number(this.value||1));refreshSeatSelection();}
});

// 座位狀態定期同步；避免過密查詢與選位／取消共用後端鎖。
let seatSyncTimer = null;
function startSeatStatusSync(){
  if(seatSyncTimer) clearInterval(seatSyncTimer);
  seatSyncTimer = setInterval(() => {
    if(document.visibilityState === "visible") loadSeatStatus();
  }, 5000);
}
document.addEventListener("visibilitychange", () => {
  if(document.visibilityState === "visible") loadSeatStatus();
});
startSeatStatusSync();