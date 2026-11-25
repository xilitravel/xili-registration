// =====================================================
// 囍莉旅遊｜管理後台
// Google Apps Script API 版本
// =====================================================


// =====================================================
// API 設定
// =====================================================

const API_URL =
  "https://script.google.com/macros/s/AKfycbwnN2PWqKHvWnIyTRPHkdT5a69ilwG2MUY8Iwx7IH3rzhTgj_5o6fItSYloSnk6piI4/exec";
const TRIPS_JSON_URL = "https://xilitravel.github.io/xili-registration/trips.json";


// =====================================================
// 系統資料
// =====================================================

let tripsData = [];

let boardingData = [];

let registrationData = [];

let paymentData = [];
let adminToken = "";


// =====================================================
// API 呼叫
// =====================================================

async function apiGet(action) {

  const url =
    API_URL +
    "?action=" +
    encodeURIComponent(action);

  const response = await fetch(url);

  const result = await response.json();

  if (!result.success) {

    throw new Error(
      result.message || "API 讀取失敗"
    );

  }

  return result.data;

}


async function apiPost(payload) {

  const response = await fetch(API_URL, {

    method: "POST",

    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },

    body: JSON.stringify(payload)

  });

  const result = await response.json();

  if (!result.success) {

    throw new Error(
      result.message || "API 儲存失敗"
    );

  }

  return result.data;

}


async function adminLogin(password) {
  const result = await apiPost({ action: "adminLogin", password });
  adminToken = result.token;
  return adminToken;
}

async function adminGetRegistrations() {
  if (!adminToken) await adminLogin();
  try {
    return await apiPost({ action: "adminGetRegistrations", token: adminToken });
  } catch (error) {
    adminToken = "";
    throw error;
  }
}

// =====================================================
// HTML 安全處理
// =====================================================

function escapeHTML(value) {

  return String(value ?? "")

    .replace(/&/g, "&amp;")

    .replace(/</g, "&lt;")

    .replace(/>/g, "&gt;")

    .replace(/"/g, "&quot;")

    .replace(/'/g, "&#039;");

}


// =====================================================
// 頁面切換
// =====================================================

const navButtons =
  document.querySelectorAll(".admin-nav-btn");

const adminSections =
  document.querySelectorAll(".admin-section");


navButtons.forEach(button => {

  button.addEventListener("click", () => {

    const sectionId =
      button.dataset.section;

    navButtons.forEach(btn => {

      btn.classList.remove("active");

    });

    adminSections.forEach(section => {

      section.classList.remove("active");

    });

    button.classList.add("active");

    const targetSection =
      document.getElementById(sectionId);

    if (targetSection) {

      targetSection.classList.add("active");

    }

  });

});


// =====================================================
// 載入全部資料
// =====================================================

async function loadAllData() {

  try {

    await loadTrips();

    await loadBoardingLocations();

    await loadRegistrations();

    await loadPayments();

    updateDashboard();

    populateTripFilters();
    const updatedAt = document.getElementById("dashboardLastUpdated");
    if (updatedAt) updatedAt.textContent = new Date().toLocaleString("zh-TW", { hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });

  } catch (error) {

    console.error(error);

    alert(
      "資料載入失敗：\n\n" +
      error.message
    );

  }

}


// =====================================================
// 行程管理
// =====================================================

async function loadTrips() {
  // 登入後先執行一次舊行程遷移；之後只會讀取 GitHub 靜態 JSON。
  await apiPost({ action: "migrateTrips", token: adminToken });
  const response = await fetch(TRIPS_JSON_URL + "?t=" + Date.now(), { cache: "no-store" });
  if (!response.ok) throw new Error("讀取 trips.json 失敗（HTTP " + response.status + "）");
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error("trips.json 格式錯誤");
  tripsData = data;
  renderTrips();
}


function updateDashboard() {
  const total = registrationData.length;
  const pending = registrationData.filter(item => String(item.status || "").includes("待確認")).length;
  const cancelled = registrationData.filter(item => String(item.status || "").includes("取消")).length;
  const confirmed = Math.max(0, total - pending - cancelled);
  const pendingPayment = paymentData
    .filter(item => !["已結清", "已取消"].includes(String(item.paymentStatus || item.status || "")))
    .reduce((sum, item) => sum + (Number(item.travelerCount) || 1), 0);

  const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
  setText("totalTrips", tripsData.length);
  setText("totalRegistrations", total);
  setText("pendingRegistrations", pending);
  setText("pendingPayments", pendingPayment);
  setText("donutTotal", total);
  setText("chartPending", `${pending} 人`);
  setText("chartConfirmed", `${confirmed} 人`);
  setText("chartCancelled", `${cancelled} 人`);
  const pct = value => total ? `${Math.round(value / total * 100)}%` : "0%";
  setText("chartPendingPct", pct(pending));
  setText("chartConfirmedPct", pct(confirmed));
  setText("chartCancelledPct", pct(cancelled));

  const donut = document.getElementById("registrationDonut");
  if (donut) {
    const p1 = total ? pending / total * 100 : 0;
    const p2 = total ? (pending + confirmed) / total * 100 : 0;
    donut.style.background = total
      ? `conic-gradient(#e8a1b8 0% ${p1}%, #c6537b ${p1}% ${p2}%, #d7d6d5 ${p2}% 100%)`
      : "conic-gradient(#eee7e9 0% 100%)";
  }

  renderDashboardRecentTrips();
}

function renderDashboardRecentTrips() {
  const tbody = document.getElementById("dashboardRecentTrips");
  if (!tbody) return;
  const sorted = [...tripsData].sort((a, b) => String(a.date || "9999-99-99").localeCompare(String(b.date || "9999-99-99"))).slice(0, 5);
  if (!sorted.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-data">目前尚無行程資料</td></tr>`;
    return;
  }
  tbody.innerHTML = sorted.map(trip => {
    const tripId = String(trip.tripId || trip.id || "");
    const tripName = trip.name || trip.title || "未命名行程";
    const orders = paymentData.filter(x => String(x.tripId || "") === tripId || x.tripName === tripName);
    const registered = orders.reduce((sum, x) => sum + (Number(x.travelerCount) || 0), 0);
    const unpaid = orders.filter(x => !["已結清", "已取消"].includes(String(x.paymentStatus || x.status || "")))
      .reduce((sum, x) => sum + (Number(x.travelerCount) || 1), 0);
    const quota = Number(trip.maxPeople) || 0;
    return `<tr>
      <td>${escapeHTML(trip.date || "—")}</td>
      <td class="recent-trip-name">${escapeHTML(tripName)}</td>
      <td>${registered} / ${quota || "—"}</td>
      <td><span class="payment-pill ${unpaid ? "has-unpaid" : "all-paid"}">${unpaid} 人未繳</span></td>
    </tr>`;
  }).join("");
}

// 快速功能與「查看全部」共用左側原有導覽切換，避免重複建立另一套頁面狀態。
document.addEventListener("click", event => {
  const jump = event.target.closest("[data-jump-section]");
  if (!jump) return;
  const target = document.querySelector(`.admin-nav-btn[data-section="${jump.dataset.jumpSection}"]`);
  if (target) target.click();
  if (jump.dataset.quickAction === "add-trip") {
    document.getElementById("addTripBtn")?.click();
  }
});


// =====================================================
// 彈性行程服務設定：天數、住宿、房型、餐食
// =====================================================

function renderTripMealsConfig(days, savedMeals = []) {
  const container = document.getElementById("tripMealsConfig");
  if (!container) return;
  const mealNames = ["早餐", "午餐", "晚餐"];
  const saved = Array.isArray(savedMeals) ? savedMeals : [];
  const safeDays = Math.max(1, Math.min(30, Number(days) || 1));
  container.innerHTML = Array.from({ length: safeDays }, (_, index) => {
    const day = index + 1;
    return `<div class="meal-day-config" style="border:1px solid #f2c6dc;border-radius:12px;padding:12px;margin:10px 0;background:#fff9fc">
      <strong>第 ${day} 天</strong>
      <div style="display:flex;flex-wrap:wrap;gap:14px;margin-top:8px">
        ${mealNames.map(meal => {
          const key = `day${day}_${meal}`;
          const item = saved.find(x => x.key === key) || {};
          return `<label style="display:inline-flex;align-items:center;gap:6px">
            <input type="checkbox" class="meal-provided" data-key="${key}" ${item.provided ? "checked" : ""}> ${meal}
          </label>`;
        }).join("")}
      </div>
    </div>`;
  }).join("");
}

function collectTripMealsConfig() {
  return Array.from(document.querySelectorAll(".meal-provided"))
    .map(input => ({ key: input.dataset.key, provided: input.checked }));
}

function updateLodgingSettings() {
  const isLodging = document.getElementById("tripLodging")?.value === "true";
  const group = document.getElementById("roomTypesGroup");
  if (group) group.style.display = isLodging ? "block" : "none";
  if (!isLodging) document.querySelectorAll(".room-type").forEach(cb => cb.checked = false);
}

document.getElementById("tripDays")?.addEventListener("input", event => {
  renderTripMealsConfig(event.target.value);
});
document.getElementById("tripLodging")?.addEventListener("change", updateLodgingSettings);
renderTripMealsConfig(1);
updateLodgingSettings();

// 每團工作人員專用座位設定（不影響其他行程）
const ADMIN_SEAT_IDS = ["1-1","1-2","1-3","1-4","2-1","2-2","2-3","2-4","3-1","3-2","3-3","3-4","4-1","4-2","4-3","4-4","5-1","5-2","5-3","5-4","6-1","6-2","7-1","7-2","8-1","8-2","9-1","9-2","9-3","9-4","10-1","10-2","10-3","10-4","11-1","11-2","11-3","11-4","12-1","12-2","12-3","12-4","12-5"];
function renderStaffSeatOptions(selected = []) {
  const root = document.getElementById("tripStaffSeats");
  if (!root) return;

  const chosen = new Set((selected || []).map(String));
  root.classList.add("admin-seat-map");

  // 欄位：左側 1、2｜走道 3｜右側 3、4
  // 位置依前台遊覽車座位表排列；2-1、2-2 仍可依每團勾選／取消。
  const positions = {};
  for (let row = 1; row <= 7; row++) {
    positions[`${row}-1`] = [1, row];
    positions[`${row}-2`] = [2, row];
  }
  for (let row = 1; row <= 5; row++) {
    // 前門佔兩列，因此右側前半段座位從第 3 列開始。
    positions[`${row}-3`] = [4, row + 2];
    positions[`${row}-4`] = [5, row + 2];
  }
  for (let row = 8; row <= 12; row++) {
    positions[`${row}-1`] = [1, row + 1];
    positions[`${row}-2`] = [2, row + 1];
  }
  for (let row = 9; row <= 11; row++) {
    // 中門佔第 8、9 列，後半段座位從第 10 列開始。
    positions[`${row}-3`] = [4, row + 1];
    positions[`${row}-4`] = [5, row + 1];
  }
  // 最後一排右側 12-3、12-4 必須與左側 12-1、12-2 及中央 12-5 同列。
  positions["12-3"] = [4, 13];
  positions["12-4"] = [5, 13];
  positions["12-5"] = [3, 13];

  const doors = `
    <div class="admin-seat-door front">前門</div>
    <div class="admin-seat-door safety">安全門</div>
    <div class="admin-seat-door middle">中門</div>
    <div class="admin-seat-aisle">走道</div>
  `;

  const seats = ADMIN_SEAT_IDS.map(id => {
    const [column, row] = positions[id] || [1, 1];
    return `<label class="admin-seat-option" style="grid-column:${column};grid-row:${row}" title="${id}">
      <input type="checkbox" class="staff-seat-option" value="${id}" ${chosen.has(id) ? "checked" : ""}>
      <span>${id}</span>
    </label>`;
  }).join("");

  root.innerHTML = doors + seats;
}
function getStaffSeatIds() {
  return Array.from(document.querySelectorAll(".staff-seat-option:checked")).map(x => x.value);
}
renderStaffSeatOptions();

// =====================================================
// 新增行程
// =====================================================

const tripForm =
  document.getElementById("tripForm");

const tripFormCard =
  document.getElementById("tripFormCard");


document.getElementById("addTripBtn")
  .addEventListener("click", () => {

    tripForm.reset();
    renderStaffSeatOptions([]);

    document.getElementById("tripDays").value = 1;
    renderTripMealsConfig(1);
    updateLodgingSettings();

    document.getElementById("tripId").value = "";

    document.getElementById("tripFormTitle")
      .textContent = "新增行程";

    tripFormCard.style.display = "block";

    tripFormCard.scrollIntoView({

      behavior: "smooth"

    });

  });


// =====================================================
// 取消行程編輯
// =====================================================

document.getElementById("cancelTripBtn")
  .addEventListener("click", () => {

    tripForm.reset();

    document.getElementById("tripId").value = "";

    tripFormCard.style.display = "none";

  });


// =====================================================
// 儲存行程
// =====================================================

tripForm.addEventListener("submit", async event => {

  event.preventDefault();

  const tripId =
    document.getElementById("tripId").value;

  const trip = {

    tripId:
      tripId || "",

    name:
      document.getElementById("tripTitle")
        .value.trim(),

    type:
      document.getElementById("tripType")
        .value,

    days:
      Number(document.getElementById("tripDays").value || 1),

    lodging:
      document.getElementById("tripLodging").value === "true",

    roomTypes:
      Array.from(document.querySelectorAll(".room-type:checked")).map(cb => cb.value),

    meals:
      collectTripMealsConfig(),

    date:
      document.getElementById("tripDate")
        .value,

    price:
      Number(
        document.getElementById("tripPrice")
          .value || 0
      ),

    maxPeople:
      Number(
        document.getElementById("tripMaxPeople")
          .value || 0
      ),

    deadline:
      document.getElementById("tripDeadline")
        .value,

    status:
      document.getElementById("tripStatus")
        .value,

    departure:
      document.getElementById("tripDeparture")
        .value.trim(),

    description:
      document.getElementById("tripDescription")
        .value.trim(),

    highlights:
      document.getElementById("tripHighlights")
        .value
        .split("\n")
        .map(item => item.trim())
        .filter(Boolean),

    boardingPoints:
      document.getElementById("tripBoardingPoints")
        .value
        .split("\n")
        .map(item => item.trim())
        .filter(Boolean),

    notes:
      document.getElementById("tripNotes")
        .value
        .split("\n")
        .map(item => item.trim())
        .filter(Boolean),

    staffSeatIds: getStaffSeatIds()

  };


  try {

    await apiPost({

      action: "saveTrip",

      token: adminToken,

      trip: trip

    });


    alert(
      "行程已成功發布！\n\n網站行程資料已更新，不會寫入行程管理工作表。\nGitHub Pages 可能需要約 1～2 分鐘部署更新。"
    );


    tripForm.reset();

    document.getElementById("tripId").value = "";

    tripFormCard.style.display = "none";


    await loadTrips();

    updateDashboard();

    populateTripFilters();


  } catch (error) {

    console.error(error);

    alert(
      "儲存行程失敗：\n\n" +
      error.message
    );

  }

});


// =====================================================
// 顯示行程列表
// =====================================================

function renderTrips() {

  const tbody =
    document.getElementById("tripsTableBody");


  if (!tripsData || tripsData.length === 0) {

    tbody.innerHTML = `

      <tr>

        <td colspan="6" class="empty-data">

          目前尚無行程資料

        </td>

      </tr>

    `;

    return;

  }


  tbody.innerHTML = tripsData.map(trip => {

    const id =
      trip.tripId || trip.id || "";

    const name =
      trip.name || trip.title || "";

    const date =
      trip.date || "";

    const type =
      trip.type || "";

    const price =
      Number(trip.price || 0);

    const status =
      trip.status || "";


    return `

      <tr>

        <td>
          ${escapeHTML(name)}
        </td>

        <td>
          ${escapeHTML(date)}
        </td>

        <td>
          ${escapeHTML(type)}
        </td>

        <td>
          $${price.toLocaleString()}
        </td>

        <td>
          ${escapeHTML(status)}
        </td>

        <td>

          <button

            class="admin-btn admin-btn-light"

            onclick="editTrip('${escapeHTML(id)}')"

          >

            編輯

          </button>


          <button

            class="admin-btn admin-btn-danger"

            onclick="deleteTrip('${escapeHTML(id)}')"

          >

            刪除

          </button>

        </td>

      </tr>

    `;

  }).join("");

}


// =====================================================
// 編輯行程
// =====================================================

function editTrip(id) {

  const trip = tripsData.find(item => {

    return String(item.tripId || item.id) === String(id);

  });


  if (!trip) {

    alert("找不到行程資料");

    return;

  }


  document.getElementById("tripId")
    .value = trip.tripId || trip.id || "";


  document.getElementById("tripTitle")
    .value = trip.name || trip.title || "";


  document.getElementById("tripType")
    .value = trip.type || "";

  document.getElementById("tripDays")
    .value = trip.days || (trip.type === "一日遊" ? 1 : 2);

  document.getElementById("tripLodging")
    .value = trip.lodging ? "true" : "false";

  document.querySelectorAll(".room-type").forEach(cb => {
    cb.checked = (trip.roomTypes || []).includes(cb.value);
  });

  renderTripMealsConfig(document.getElementById("tripDays").value, trip.meals || []);
  updateLodgingSettings();

  document.getElementById("tripDate")
    .value = trip.date || "";


  document.getElementById("tripPrice")
    .value = trip.price || 0;


  document.getElementById("tripMaxPeople")
    .value = trip.maxPeople || "";


  document.getElementById("tripDeadline")
    .value = trip.deadline || "";


  document.getElementById("tripStatus")
    .value = trip.status || "報名中";


  document.getElementById("tripDeparture")
    .value = trip.departure || "台南";


  document.getElementById("tripDescription")
    .value = trip.description || "";


  document.getElementById("tripHighlights")
    .value = (trip.highlights || [])
      .join("\n");


  document.getElementById("tripBoardingPoints")
    .value = (trip.boardingPoints || [])
      .join("\n");


  document.getElementById("tripNotes")
    .value = (trip.notes || [])
      .join("\n");


  renderStaffSeatOptions(trip.staffSeatIds || []);

  document.getElementById("tripFormTitle")
    .textContent = "修改行程";


  tripFormCard.style.display = "block";


  tripFormCard.scrollIntoView({

    behavior: "smooth"

  });

}


// =====================================================
// 刪除行程
// =====================================================

async function deleteTrip(id) {

  if (!confirm("確定要刪除此行程嗎？")) {

    return;

  }


  try {

    await apiPost({

      action: "deleteTrip",

      token: adminToken,

      tripId: id

    });


    alert(
      "行程已從網站下架！\nGitHub Pages 可能需要約 1～2 分鐘部署更新。"
    );


    await loadTrips();

    updateDashboard();

    populateTripFilters();


  } catch (error) {

    console.error(error);

    alert(
      "刪除行程失敗：\n\n" +
      error.message
    );

  }

}


// =====================================================
// 上車地點管理
// =====================================================

async function loadBoardingLocations() {

  boardingData = await apiGet("boardingPoints");

  renderBoardingLocations();

}


// =====================================================
// 新增上車地點
// =====================================================

const boardingForm =
  document.getElementById("boardingForm");


boardingForm.addEventListener("submit", async event => {

  event.preventDefault();


  const location = {

    name:
      document.getElementById("boardingName")
        .value.trim(),

    address:
      document.getElementById("boardingAddress")
        .value.trim(),

    description:
      document.getElementById("boardingDescription")
        .value.trim()

  };


  try {

    await apiPost({

      action: "addBoardingPoint",

      boardingPoint: location

    });


    alert(
      "上車地點已成功新增！"
    );


    boardingForm.reset();


    await loadBoardingLocations();

    populateTripFilters();


  } catch (error) {

    console.error(error);

    alert(
      "新增上車地點失敗：\n\n" +
      error.message
    );

  }

});


// =====================================================
// 顯示上車地點
// =====================================================

function renderBoardingLocations() {

  const tbody =
    document.getElementById("boardingTableBody");


  if (!boardingData || boardingData.length === 0) {

    tbody.innerHTML = `

      <tr>

        <td colspan="4" class="empty-data">

          尚無上車地點資料

        </td>

      </tr>

    `;

    return;

  }


  tbody.innerHTML = boardingData.map(location => {

    const name =
      typeof location === "string"
        ? location
        : location.name || location.location || "";


    const address =
      typeof location === "string"
        ? ""
        : location.address || "";


    const description =
      typeof location === "string"
        ? ""
        : location.description || "";


    const id =
      typeof location === "string"
        ? location
        : location.id || name;


    return `

      <tr>

        <td>
          ${escapeHTML(name)}
        </td>

        <td>
          ${escapeHTML(address)}
        </td>

        <td>
          ${escapeHTML(description)}
        </td>

        <td>

          <button

            class="admin-btn admin-btn-danger"

            onclick="deleteBoardingLocation('${escapeHTML(id)}')"

          >

            刪除

          </button>

        </td>

      </tr>

    `;

  }).join("");

}


// =====================================================
// 刪除上車地點
// =====================================================

async function deleteBoardingLocation(id) {

  if (!confirm("確定要刪除此上車地點嗎？")) {

    return;

  }


  try {

    await apiPost({

      action: "deleteBoardingPoint",

      boardingPointId: id

    });


    alert(
      "上車地點已刪除！"
    );


    await loadBoardingLocations();

    populateTripFilters();


  } catch (error) {

    console.error(error);

    alert(
      "刪除上車地點失敗：\n\n" +
      error.message
    );

  }

}


// =====================================================
// 報名管理
// =====================================================

async function loadRegistrations() {
  registrationData = await adminGetRegistrations();
  renderRegistrations();
}

function maskIdNumber(value) {
  const id = String(value || "");
  if (id.length <= 4) return id ? "＊".repeat(id.length) : "";
  return id.slice(0, 3) + "＊".repeat(Math.max(0, id.length - 5)) + id.slice(-2);
}

function renderRegistrations() {
  const tbody = document.getElementById("registrationsTableBody");
  if (!tbody) return;

  // 將原本的報名團體表格改為旅客個人資料表格
  const table = tbody.closest("table");
  if (table) {
    const thead = table.querySelector("thead");
    if (thead) {
      thead.innerHTML = `<tr>
        <th>行程</th><th>姓名</th><th>出生年月日</th><th>身分證字號</th>
        <th>電話</th><th>上車點1</th><th>上車點2</th><th>同意人鏡</th><th>房型</th>
      </tr>`;
    }
  }

  const filter = document.getElementById("registrationTripFilter");
  const selectedTrip = filter ? filter.value : "";
  const rows = registrationData.filter(item => !selectedTrip || String(item.tripId) === String(selectedTrip) || item.tripName === selectedTrip);

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty-data">目前沒有報名資料</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(item => `
    <tr>
      <td>${escapeHTML(item.tripName)}</td>
      <td>${escapeHTML(item.name)}</td>
      <td>${escapeHTML(item.birthDate)}</td>
      <td><span class="id-mask" data-full-id="${escapeHTML(item.idNumber)}">${escapeHTML(maskIdNumber(item.idNumber))}</span> <button type="button" class="admin-btn admin-btn-light reveal-id-btn">查看</button></td>
      <td>${escapeHTML(item.phone)}</td>
      <td>${escapeHTML(item.boarding1)}</td>
      <td>${escapeHTML(item.boarding2)}</td>
      <td>${escapeHTML(item.photoConsent)}</td>
      <td>${escapeHTML(item.room)}</td>
    </tr>
  `).join("");
}

document.getElementById("registrationsTableBody")?.addEventListener("click", event => {
  const button = event.target.closest(".reveal-id-btn");
  if (!button) return;
  const span = button.previousElementSibling;
  if (!span) return;
  const isRevealed = button.dataset.revealed === "true";
  span.textContent = isRevealed ? maskIdNumber(span.dataset.fullId) : span.dataset.fullId;
  button.textContent = isRevealed ? "查看" : "遮蔽";
  button.dataset.revealed = isRevealed ? "false" : "true";
});

// =====================================================
// 繳費管理
// =====================================================

async function loadPayments() {
  paymentData = await apiPost({ action: "adminGetOrders", token: adminToken });
  renderPayments();
}

function renderPayments() {
  const tbody = document.getElementById("paymentsTableBody");
  if (!tbody) return;
  const tripFilter = document.getElementById("paymentTripFilter")?.value || "";
  const statusFilter = document.getElementById("paymentStatusFilter")?.value || "";
  const rows = paymentData.filter(x => (!tripFilter || String(x.tripId)===String(tripFilter)) && (!statusFilter || x.paymentStatus===statusFilter));
  if (!rows.length) { tbody.innerHTML = `<tr><td colspan="7" class="empty-data">目前沒有報名／繳費資料</td></tr>`; return; }
  tbody.innerHTML = rows.map(x => `
    <tr>
      <td>${escapeHTML(x.orderId)}</td><td>${escapeHTML(x.tripName)}</td><td>${escapeHTML(x.mainName)}（${Number(x.travelerCount)||0}人）<br><small>${escapeHTML(x.paymentMethod)}｜座位：${escapeHTML(x.seatIds||"未選")}</small></td>
      <td>應繳 $${Number(x.amountDue||0).toLocaleString()}<br>實收 $${Number(x.amountPaid||0).toLocaleString()}</td>
      <td>${escapeHTML(x.paymentStatus)}<br><small>保留至：${escapeHTML(formatAdminDate(x.holdUntil))}</small></td>
      <td>${escapeHTML(formatAdminDate(x.paidAt))}</td>
      <td>
        ${x.paymentStatus!=="已結清" && x.paymentStatus!=="已取消" ? `<button class="admin-btn admin-btn-primary" data-pay="${escapeHTML(x.orderId)}">標記已結清</button><button class="admin-btn admin-btn-light" data-extend="${escapeHTML(x.orderId)}">延長24小時</button>` : ""}
        ${x.paymentStatus!=="已取消" ? `<button class="admin-btn admin-btn-light" data-cancel="${escapeHTML(x.orderId)}">取消</button>` : ""}
      </td>
    </tr>`).join("");
}
function formatAdminDate(value) { if(!value)return "—"; const d=new Date(value); return isNaN(d)?String(value):d.toLocaleString("zh-TW",{timeZone:"Asia/Taipei",hour12:false}); }
document.getElementById("paymentsTableBody")?.addEventListener("click", async event => {
  const b=event.target.closest("button"); if(!b)return;
  try {
    if(b.dataset.pay){ const order=paymentData.find(x=>x.orderId===b.dataset.pay); await apiPost({action:"adminUpdatePayment",token:adminToken,orderId:b.dataset.pay,amountPaid:order.amountDue,status:"已結清"}); alert("已更新為已結清"); }
    if(b.dataset.extend){ await apiPost({action:"adminExtendHold",token:adminToken,orderId:b.dataset.extend,hours:24}); alert("已延長保留 24 小時"); }
    if(b.dataset.cancel){ const reason=prompt("請輸入取消原因（必填）"); if(reason===null)return; const unexcused=confirm("是否屬於無故取消？按「確定」會累計一次，達兩次列入黑名單。"); await apiPost({action:"adminCancelRegistration",token:adminToken,orderId:b.dataset.cancel,reason,unexcused}); alert("報名已取消，座位已釋出"); }
    await loadPayments();
  } catch(error){alert("操作失敗："+error.message);}
});
document.getElementById("paymentTripFilter")?.addEventListener("change",renderPayments);
document.getElementById("paymentStatusFilter")?.addEventListener("change",renderPayments);


// =====================================================
// 行程下拉選單
// =====================================================

function populateTripFilters() {

  const filters = [

    document.getElementById("registrationTripFilter"),

    document.getElementById("paymentTripFilter")

  ];


  filters.forEach(select => {

    if (!select) return;


    const currentValue =
      select.value;


    select.innerHTML = `

      <option value="">
        所有行程
      </option>

    `;


    tripsData.forEach(trip => {

      const id =
        trip.tripId || trip.id || "";

      const name =
        trip.name || trip.title || "";


      const option =
        document.createElement("option");


      option.value = id;

      option.textContent = name;


      select.appendChild(option);

    });


    select.value = currentValue;

  });

}


document.getElementById("registrationTripFilter")?.addEventListener("change", renderRegistrations);


// =====================================================
// 報名資料匯出
// =====================================================

document.getElementById("exportRegistrationBtn")
  .addEventListener("click", () => {
    const filter = document.getElementById("registrationTripFilter");
    const selectedTrip = filter ? filter.value : "";
    const rows = registrationData.filter(item => !selectedTrip || String(item.tripId) === String(selectedTrip) || item.tripName === selectedTrip);
    if (!rows.length) {
      alert("目前沒有可匯出的報名資料。");
      return;
    }
    const headers = ["行程", "姓名", "出生年月日", "身分證字號", "電話", "上車點1", "上車點2", "同意人鏡", "房型"];
    const csvRows = [headers, ...rows.map(item => [item.tripName, item.name, item.birthDate, maskIdNumber(item.idNumber), item.phone, item.boarding1, item.boarding2, item.photoConsent, item.room])];
    const csv = "\uFEFF" + csvRows.map(row => row.map(value => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "囍莉旅遊_報名資料.csv";
    link.click();
    URL.revokeObjectURL(url);
  });


// =====================================================
// 系統設定
// =====================================================

document.getElementById("settingsForm")
  .addEventListener("submit", event => {

    event.preventDefault();


    alert(
      "系統設定 API 尚未完成。\n\n" +
      "下一階段將連接 Google Sheets，" +
      "讓網站名稱、標語、聯絡資訊及注意事項可以真正儲存。"
    );

  });


// =====================================================
// 登出
// =====================================================

document.getElementById("logoutBtn")
  .addEventListener("click", () => {
    adminToken = "";
    registrationData = [];
    lockAdminPage();
  });



// =====================================================
// 囍莉旅遊｜粉色工作人員登入頁
// =====================================================

let adminPageLocked = true;
let originalBodyChildren = [];
let loginOverlay = null;

function lockAdminPage() {
  adminPageLocked = true;

  // 隱藏整個後台頁面內容
  originalBodyChildren = Array.from(document.body.children)
    .filter(element => element !== loginOverlay);

  originalBodyChildren.forEach(element => {
    element.dataset.adminOriginalDisplay = element.style.display || "";
    element.style.display = "none";
  });

  if (loginOverlay) {
    loginOverlay.style.display = "flex";
  }
}

function unlockAdminPage() {
  adminPageLocked = false;

  originalBodyChildren.forEach(element => {
    element.style.display = element.dataset.adminOriginalDisplay || "";
    delete element.dataset.adminOriginalDisplay;
  });

  if (loginOverlay) {
    loginOverlay.remove();
  }
  loginOverlay = null;
}

function initializeAdminLock() {
  loginOverlay = document.createElement("div");
  loginOverlay.id = "adminLoginOverlay";
  loginOverlay.innerHTML = `
    <div class="login-stage">
      <img class="login-artwork" src="login-cover.png?v=20261125-pin-clean-3" alt="囍莉旅遊旅遊報名系統工作人員登入" draggable="false">
      <form id="adminLoginForm" class="login-hotspots" aria-label="工作人員登入">
        <input id="adminLoginPassword" type="password" autocomplete="current-password"
          placeholder="輸入工作人員 PIN" aria-label="工作人員 PIN" required>
        <button type="submit" id="adminLoginSubmit" aria-label="進入後台" title="進入後台">進入後台</button>
        <div id="adminLoginError" role="alert" aria-live="polite"></div>
      </form>
    </div>
    <form id="adminLoginFormMobile" class="login-mobile-form" aria-label="工作人員登入">
      <h2>🔐 工作人員登入</h2>
      <label for="adminLoginPasswordMobile">工作人員 PIN</label>
      <input id="adminLoginPasswordMobile" type="password" autocomplete="current-password"
        placeholder="輸入 PIN" required>
      <button type="submit" id="adminLoginSubmitMobile">🌸 進入後台</button>
      <div id="adminLoginErrorMobile" role="alert" aria-live="polite"></div>
    </form>
  `;

  document.body.appendChild(loginOverlay);

  // 設計稿本身已包含 PIN 外框；輸入欄只負責接收文字，不再繪製第二層框線。
  const desktopPinInput = document.getElementById("adminLoginPassword");
  ["border", "outline", "box-shadow", "background", "border-radius", "appearance"].forEach(prop => {
    desktopPinInput.style.setProperty(prop, prop === "background" ? "transparent" : "none", "important");
  });

  lockAdminPage();

  const bindLoginForm = (formId, inputId, buttonId, errorId) => {
    document.getElementById(formId).addEventListener("submit", async event => {
      event.preventDefault();
      const passwordInput = document.getElementById(inputId);
      const submitButton = document.getElementById(buttonId);
      const errorBox = document.getElementById(errorId);
      const password = passwordInput.value;

      submitButton.disabled = true;
      if (buttonId === "adminLoginSubmitMobile") submitButton.textContent = "驗證中...";
      errorBox.textContent = "";

      try {
        await adminLogin(password);
        unlockAdminPage();
        await loadAllData();
      } catch (error) {
        adminToken = "";
        errorBox.textContent = "PIN 錯誤或登入失敗，請重新輸入。";
        passwordInput.value = "";
        passwordInput.focus();
      } finally {
        if (loginOverlay) {
          submitButton.disabled = false;
          if (buttonId === "adminLoginSubmitMobile") submitButton.textContent = "🌸 進入後台";
        }
      }
    });
  };

  bindLoginForm("adminLoginForm", "adminLoginPassword", "adminLoginSubmit", "adminLoginError");
  bindLoginForm("adminLoginFormMobile", "adminLoginPasswordMobile", "adminLoginSubmitMobile", "adminLoginErrorMobile");

  const desktopInput = document.getElementById("adminLoginPassword");
  if (window.matchMedia("(min-width: 701px)").matches) desktopInput.focus();
  else document.getElementById("adminLoginPasswordMobile").focus();
}

// 總覽重新整理：沿用既有資料載入流程，不另造 API。
const dashboardRefreshButton = document.getElementById("dashboardRefreshBtn");
if (dashboardRefreshButton) {
  dashboardRefreshButton.addEventListener("click", async () => {
    dashboardRefreshButton.disabled = true;
    const original = dashboardRefreshButton.innerHTML;
    dashboardRefreshButton.innerHTML = '<span aria-hidden="true">⟳</span> 更新中…';
    try { await loadAllData(); }
    finally {
      dashboardRefreshButton.disabled = false;
      dashboardRefreshButton.innerHTML = original;
    }
  });
}

// =====================================================
// 初始化
// =====================================================

tripFormCard.style.display = "none";

// 登入前不載入任何後台資料
initializeAdminLock();