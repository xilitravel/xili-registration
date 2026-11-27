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

// 管理總覽「查看全部」：切換至既有的行程管理頁面
function openAdminSection(sectionId) {
  const targetButton = document.querySelector(
    `.admin-nav-btn[data-section="${sectionId}"]`
  );
  if (targetButton) {
    targetButton.click();
  } else {
    document.querySelectorAll(".admin-nav-btn").forEach(btn => btn.classList.remove("active"));
    document.querySelectorAll(".admin-section").forEach(section => section.classList.remove("active"));
    document.getElementById(sectionId)?.classList.add("active");
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll("[data-jump-section]").forEach(button => {
  button.addEventListener("click", () => {
    const sectionId = button.dataset.jumpSection;
    if (sectionId) openAdminSection(sectionId);
  });
});


// =====================================================
// 載入全部資料
// =====================================================

let dashboardLoadInProgress = false;

async function loadAllData() {
  if (dashboardLoadInProgress) return;
  dashboardLoadInProgress = true;

  const updatedEl = document.getElementById("dashboardLastUpdated");
  const refreshBtn = document.getElementById("dashboardRefreshBtn");
  const originalButtonText = refreshBtn ? refreshBtn.innerHTML : "";

  if (updatedEl) {
    updatedEl.textContent = "更新中…";
    updatedEl.classList.remove("is-error");
    updatedEl.removeAttribute("title");
  }
  if (refreshBtn) {
    refreshBtn.disabled = true;
    refreshBtn.classList.add("is-loading");
  }

  let timeoutId;
  try {
    // 四組資料彼此獨立，平行讀取，避免一個 API 等待完才開始下一個。
    const loadingTask = (async () => {
      await Promise.all([
        loadTrips(),
        loadBoardingLocations(),
        loadRegistrations(),
        loadPayments()
      ]);
      updateDashboard();
      populateTripFilters();
    })();

    // 避免 API 或網路沒有回應時，畫面永遠停留在載入中。
    await Promise.race([
      loadingTask,
      new Promise((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error("資料載入逾時，請確認網路或 Google Apps Script 部署狀態後再重新整理。")),
          25000
        );
      })
    ]);

    if (updatedEl) {
      updatedEl.textContent = "更新於 " + new Date().toLocaleString("zh-TW", {
        timeZone: "Asia/Taipei",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      });
      updatedEl.classList.remove("is-error");
      updatedEl.title = "資料已成功載入";
    }
  } catch (error) {
    console.error("管理總覽資料載入失敗：", error);
    if (updatedEl) {
      updatedEl.textContent = "更新失敗，請重新整理";
      updatedEl.classList.add("is-error");
      updatedEl.title = error && error.message ? error.message : "未知錯誤";
    }
    const tripList = document.getElementById("dashboardTripList");
    if (tripList && (!Array.isArray(tripsData) || !tripsData.length)) {
      tripList.innerHTML = '<div class="dashboard-trip-empty">行程資料載入失敗，請按右上角「重新整理」再試一次</div>';
    }
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    dashboardLoadInProgress = false;
    if (refreshBtn) {
      refreshBtn.disabled = false;
      refreshBtn.classList.remove("is-loading");
      if (originalButtonText) refreshBtn.innerHTML = originalButtonText;
    }
  }
}

// 管理總覽的重新整理按鈕：重新讀取行程、上車地點、報名及繳費資料。
document.getElementById("dashboardRefreshBtn")?.addEventListener("click", () => {
  loadAllData();
});


// =====================================================
// 行程管理
// =====================================================

function updateTripLastUpdated() {
  const el = document.getElementById("tripLastUpdated");
  if (!el) return;
  const stamp = new Date().toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false
  });
  el.textContent = "更新於 " + stamp;
}

async function loadTrips() {
  // 行程已由新增／編輯行程流程直接發布到 GitHub；讀取時不再重跑遷移 API。
  const response = await fetch(TRIPS_JSON_URL + "?t=" + Date.now(), { cache: "no-store" });
  if (!response.ok) throw new Error("讀取 trips.json 失敗（HTTP " + response.status + "）");
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error("trips.json 格式錯誤");
  tripsData = data;
  renderTrips();
  // 行程資料先到就先顯示左側清單，不必等報名／繳費 API 全部完成。
  renderDashboardTripList();
  renderDashboardRecentTrips();
  updateTripLastUpdated();
}

// 行程管理頁專用重新整理：不必切回管理總覽。
// 同步更新報名人數與繳費資料，避免只更新行程名稱、日期卻留下舊人數。
document.getElementById("tripsRefreshBtn")?.addEventListener("click", async () => {
  const button = document.getElementById("tripsRefreshBtn");
  if (!button || button.disabled) return;
  const originalHTML = button.innerHTML;
  button.disabled = true;
  button.classList.add("is-loading");
  button.innerHTML = '<span aria-hidden="true">↻</span> 更新中…';
  try {
    await Promise.all([loadTrips(), loadRegistrations(), loadPayments()]);
    renderTrips();
    updateDashboard();
    updateTripLastUpdated();
  } catch (error) {
    console.error("行程管理重新整理失敗：", error);
    alert("重新整理失敗，請稍後再試。\n\n" + (error?.message || "未知錯誤"));
  } finally {
    button.disabled = false;
    button.classList.remove("is-loading");
    button.innerHTML = originalHTML;
  }
});



// =====================================================
// 管理總覽｜近期出團行程（最近 5 筆）
// =====================================================

function formatDashboardTripDate(value) {
  if (!value) return "日期未設定";
  const raw = String(value).trim();

  // 日期欄位通常是 YYYY-MM-DD；直接拆字串避免時區造成日期前移。
  const match = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (match) {
    return `${match[1]}/${String(match[2]).padStart(2, "0")}/${String(match[3]).padStart(2, "0")}`;
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
}

function renderDashboardRecentTrips() {
  const tbody = document.getElementById("dashboardRecentTrips");
  if (!tbody) return;

  if (!Array.isArray(tripsData) || tripsData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-data">目前尚無出團行程</td></tr>`;
    return;
  }

  const getTripDate = trip => String(trip.date || trip.departureDate || trip.tripDate || "").trim();
  const getTripName = trip => trip.name || trip.title || trip.tripName || "未命名行程";
  const getTripId = trip => String(trip.tripId || trip.id || "");

  const sortedTrips = tripsData
    .filter(trip => !["已取消", "已下架", "取消"].includes(String(trip.status || "").trim()))
    .map((trip, index) => {
      const dateText = getTripDate(trip);
      const parsedDate = dateText ? new Date(`${dateText.slice(0, 10)}T00:00:00`) : null;
      const timestamp = parsedDate && !Number.isNaN(parsedDate.getTime())
        ? parsedDate.getTime()
        : Number.MAX_SAFE_INTEGER;
      return { trip, index, timestamp, dateText };
    })
    .sort((a, b) => {
      // 有日期的行程依日期排序；日期相同或未設定時保留原始順序。
      if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
      return a.index - b.index;
    });

  if (!sortedTrips.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-data">目前沒有可顯示的出團行程</td></tr>`;
    return;
  }

  const registrations = Array.isArray(registrationData) ? registrationData : [];
  const orders = Array.isArray(paymentData) ? paymentData : [];

  tbody.innerHTML = sortedTrips.map(({ trip, dateText }) => {
    const tripId = getTripId(trip);
    const tripName = getTripName(trip);

    const tripRegistrations = registrations.filter(item =>
      (tripId && String(item.tripId || "") === tripId) ||
      (!tripId && String(item.tripName || "").trim() === String(tripName).trim()) ||
      (tripId && !item.tripId && String(item.tripName || "").trim() === String(tripName).trim())
    );

    const tripOrders = orders.filter(item =>
      (tripId && String(item.tripId || "") === tripId) ||
      (!tripId && String(item.tripName || "").trim() === String(tripName).trim()) ||
      (tripId && !item.tripId && String(item.tripName || "").trim() === String(tripName).trim())
    );

    const registeredCount = tripRegistrations.length;
    const capacity = Number(trip.maxPeople || trip.capacity || 0);
    const registrationText = capacity > 0
      ? `${registeredCount} / ${capacity} 人`
      : `${registeredCount} 人`;

    let paymentText = "尚無繳費資料";
    if (tripOrders.length) {
      const paidCount = tripOrders.filter(item =>
        ["已結清", "已付款", "已繳費"].includes(String(item.paymentStatus || item.status || "").trim())
      ).length;
      const unpaidCount = tripOrders.filter(item =>
        !["已結清", "已付款", "已繳費", "已取消"].includes(String(item.paymentStatus || item.status || "").trim())
      ).length;
      paymentText = unpaidCount > 0
        ? `待繳 ${unpaidCount} 筆`
        : (paidCount > 0 ? `已結清 ${paidCount} 筆` : `${tripOrders.length} 筆訂單`);
    }

    return `<tr>
      <td>${escapeHTML(formatDashboardTripDate(dateText))}</td>
      <td>${escapeHTML(tripName)}</td>
      <td>${escapeHTML(registrationText)}</td>
      <td>${escapeHTML(paymentText)}</td>
    </tr>`;
  }).join("");
}

function getTaipeiTodayDateString() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function getDaysUntilNearestDeadline() {
  const todayText = getTaipeiTodayDateString();
  const [year, month, day] = todayText.split("-").map(Number);
  const today = Date.UTC(year, month - 1, day);

  const deadlines = (Array.isArray(tripsData) ? tripsData : [])
    .filter(trip => !["已取消", "已下架", "已截止", "取消"].includes(String(trip.status || "").trim()))
    .map(trip => String(trip.deadline || trip.registrationDeadline || "").trim().slice(0, 10))
    .filter(value => /^\\d{4}-\\d{2}-\\d{2}$/.test(value))
    .map(value => {
      const [y, m, d] = value.split("-").map(Number);
      return Math.round((Date.UTC(y, m - 1, d) - today) / 86400000);
    })
    .filter(days => days >= 0)
    .sort((a, b) => a - b);

  return deadlines.length ? deadlines[0] : null;
}

function getDashboardTripMatch(item, tripId, tripName) {
  const ids = [item.tripId, item.trip_id, item.id, item.tripID, item.tripKey]
    .filter(value => value !== undefined && value !== null && String(value).trim() !== "")
    .map(String);
  const names = [item.tripName, item.tripTitle, item.sheetName, item.trip, item["行程名稱"], item.name]
    .filter(value => value !== undefined && value !== null && String(value).trim() !== "")
    .map(value => String(value).trim());
  return (tripId && ids.includes(String(tripId))) ||
    (tripName && names.includes(String(tripName).trim()));
}

function getDashboardTripStats(trip) {
  const tripId = String(trip.tripId || trip.id || "");
  const tripName = trip.name || trip.title || trip.tripName || "未命名行程";
  const registrations = Array.isArray(registrationData) ? registrationData : [];
  const orders = Array.isArray(paymentData) ? paymentData : [];
  const tripRegistrations = registrations.filter(item => getDashboardTripMatch(item, tripId, tripName));
  const tripOrders = orders.filter(item => getDashboardTripMatch(item, tripId, tripName));
  const pendingCount = tripOrders.filter(item => {
    const status = String(item.paymentStatus || item.status || "").trim();
    return status && !["已結清", "已付款", "已繳費", "已取消"].includes(status);
  }).length;

  const deadline = String(trip.deadline || trip.registrationDeadline || "").trim().slice(0, 10);
  let deadlineText = "未設定";
  if (/^\d{4}-\d{2}-\d{2}$/.test(deadline)) {
    const [dy, dm, dd] = deadline.split("-").map(Number);
    const [yy, mm, today] = getTaipeiTodayDateString().split("-").map(Number);
    const days = Math.round((Date.UTC(dy, dm - 1, dd) - Date.UTC(yy, mm - 1, today)) / 86400000);
    deadlineText = days < 0 ? "已截止" : days === 0 ? "今天截止" : `${days} 天`;
  }

  return {
    registeredCount: tripRegistrations.length,
    pendingCount,
    deadlineText
  };
}


function dashboardCountBy(rows, getter) {
  const counts = new Map();
  rows.forEach(row => {
    const value = String(getter(row) || "").trim();
    if (!value || ["不需要", "無", "未選擇", "未設定"].includes(value)) return;
    counts.set(value, (counts.get(value) || 0) + 1);
  });
  return [...counts.entries()].sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0], "zh-TW"));
}

function renderDashboardDetailStats(trip) {
  const root = document.getElementById("dashboardTripStatsContent");
  const title = document.getElementById("dashboardStatsTripName");
  if (!root) return;
  if (!trip) {
    if (title) title.textContent = "請選擇左側行程";
    root.innerHTML = '<div class="dashboard-stats-placeholder">請選擇左側行程</div>';
    return;
  }
  const tripId = String(trip.tripId || trip.id || "");
  const tripName = trip.name || trip.title || trip.tripName || "未命名行程";
  if (title) title.textContent = tripName;

  const matches = item => getDashboardTripMatch(item, tripId, tripName) ||
    (item && String(item.tripId || item.trip_id || "") === tripId);
  const rawOrders = Array.isArray(paymentData) ? paymentData : (paymentData?.orders || paymentData?.data || []);
  const rawRegistrations = Array.isArray(registrationData) ? registrationData : (registrationData?.registrations || registrationData?.data || []);
  const allOrders = rawOrders.filter(matches);
  const cancelledIds = new Set(allOrders.filter(o => ["已取消","取消"].includes(String(o.paymentStatus || o.status || "").trim())).map(o => String(o.orderId || "")));
  const orders = allOrders.filter(o => !["已取消","取消"].includes(String(o.paymentStatus || o.status || "").trim()));
  const registrations = rawRegistrations.filter(item =>
    matches(item) && (!item.orderId || !cancelledIds.has(String(item.orderId)))
  );

  const boardingRows = [];
  registrations.forEach(r => {
    [r.boarding1, r.boarding2, r.boardingPoint, r.boarding, r["上車點1"], r["上車點2"], r["上車地點"], r["上車地點1"], r["上車地點2"]].forEach(v => {
      if (v && !["不需要","無","未選擇"].includes(String(v).trim())) boardingRows.push({v:String(v).trim()});
    });
  });
  const boarding = dashboardCountBy(boardingRows, x => x.v);
  const boardingTotal = boarding.reduce((n,x)=>n+x[1],0);

  const rooms = dashboardCountBy(registrations, r => r.room || r.roomType || r.roomName || r["房型"] || r["住宿房型"]);
  const roomTotalPeople = rooms.reduce((n,x)=>n+x[1],0);
  const roomCount = ([...rooms].reduce((n,[type,people]) => {
    const match=type.match(/(\d+)\s*人/);
    const capacity=match?Number(match[1]):(type.includes("雙")?2:type.includes("三")?3:type.includes("四")?4:1);
    return n+Math.ceil(people/Math.max(1,capacity));
  },0));

  let meat=0, vegetarian=0, mealOther=0;
  registrations.forEach(r => {
    const raw=String(r.meals || r.meal || r.food || r.diet || r["餐食需求"] || r["餐食"] || "").trim();
    if (!raw) { mealOther++; return; }
    const veg=(raw.match(/素食/g)||[]).length;
    const meatHits=(raw.match(/葷食|葷|一般餐/g)||[]).length;
    if (veg>0 && meatHits===0) vegetarian++;
    else if (meatHits>0) meat++;
    else mealOther++;
  });

  const payGroups = new Map();
  orders.forEach(o => {
    const method=String(o.paymentMethod || o.payMethod || o.paymentType || "未填付款方式").trim() || "未填付款方式";
    const people=Math.max(1,Number(o.travelerCount || o.peopleCount || 1));
    payGroups.set(method,(payGroups.get(method)||0)+people);
  });
  const payTotal=[...payGroups.values()].reduce((a,b)=>a+b,0);
  const notes=Array.isArray(trip.notes)?trip.notes.map(x=>typeof x==="string"?x:(x?.text||x?.content||"")).filter(Boolean):String(trip.notes||"").split(/\n/).map(x=>x.trim()).filter(Boolean);

  const barRows = (items,total) => items.length ? items.map(([name,count]) =>
    `<div class="dashboard-stat-bar-row"><span>${escapeHTML(name)}</span><span class="dashboard-stat-bar"><i style="width:${Math.max(3,Math.round(count/Math.max(1,total)*100))}%"></i></span><strong>${count} 人</strong></div>`
  ).join("") : '<div class="dashboard-stat-empty">目前沒有統計資料</div>';

  root.innerHTML = `
    <div class="dashboard-detail-grid">
      <article class="dashboard-detail-card boarding-detail"><h4 class="dashboard-detail-heading-art"><img src="01_boarding-point.png" alt="上車地點" draggable="false"></h4>
        ${barRows(boarding,boardingTotal)}
        ${boarding.length?`<div class="dashboard-detail-total"><b>合計</b><strong>${boardingTotal} 人次</strong></div>`:""}
      </article>
      <article class="dashboard-detail-card"><h4 class="dashboard-detail-heading-art"><img src="02_room-type.png" alt="房型" draggable="false"></h4>
        ${rooms.length?`<div class="dashboard-room-head"><span>房型</span><span>房間數*</span><span>入住人數</span></div>${rooms.map(([name,count])=>{const m=name.match(/(\d+)\s*人/);const cap=m?Number(m[1]):(name.includes("雙")?2:name.includes("三")?3:name.includes("四")?4:1);return `<div class="dashboard-room-row"><span>${escapeHTML(name)}</span><b>${Math.ceil(count/Math.max(1,cap))} 間</b><b>${count} 人</b></div>`}).join("")}<div class="dashboard-detail-total"><b>合計</b><strong>${roomCount} 間　${roomTotalPeople} 人</strong></div><small class="dashboard-stat-footnote">* 房間數依房型人數估算</small>`:'<div class="dashboard-stat-empty">此行程尚無房型／住宿資料</div>'}
      </article>
      <article class="dashboard-detail-card"><h4 class="dashboard-detail-heading-art"><img src="03_meal.png" alt="餐食" draggable="false"></h4>
        <div class="dashboard-meal-row"><span>葷食</span><strong>${meat} 人</strong></div>
        <div class="dashboard-meal-row"><span>素食</span><strong>${vegetarian} 人</strong></div>
        ${mealOther?`<div class="dashboard-meal-row muted"><span>未填／其他</span><strong>${mealOther} 人</strong></div>`:""}
        <div class="dashboard-detail-total"><b>合計</b><strong>${meat+vegetarian+mealOther} 人</strong></div>
      </article>
      <article class="dashboard-detail-card"><h4 class="dashboard-detail-heading-art"><img src="04_payment-method.png" alt="付款方式" draggable="false"></h4>
        ${payGroups.size?[...payGroups.entries()].map(([name,count])=>`<div class="dashboard-meal-row"><span>${escapeHTML(name)}</span><strong>${count} 人</strong></div>`).join(""):'<div class="dashboard-stat-empty">目前沒有付款資料</div>'}
        ${payGroups.size?`<div class="dashboard-detail-total"><b>合計</b><strong>${payTotal} 人</strong></div>`:""}
      </article>
    </div>
    <article class="dashboard-detail-card dashboard-reminder-card"><h4 class="dashboard-detail-heading-art"><img src="05_important-reminder.png" alt="重點提醒" draggable="false"></h4>
      ${notes.length?`<ul>${notes.map(n=>`<li>${escapeHTML(n)}</li>`).join("")}</ul>`:'<div class="dashboard-stat-empty">此行程尚未設定重要提醒</div>'}
    </article>`;
}

function renderSelectedDashboardTripStats(tripId) {
  const trip = (Array.isArray(tripsData) ? tripsData : []).find(item =>
    String(item.tripId || item.id || "") === String(tripId)
  );
  const registrationsEl = document.getElementById("totalRegistrations");
  const pendingEl = document.getElementById("pendingPayments");
  const deadlineEl = document.getElementById("deadlineDays");

  if (!trip) {
    if (registrationsEl) registrationsEl.textContent = "0";
    if (pendingEl) pendingEl.textContent = "0";
    if (deadlineEl) deadlineEl.textContent = "—";
    renderDashboardDetailStats(null);
    return;
  }

  const stats = getDashboardTripStats(trip);
  if (registrationsEl) registrationsEl.textContent = String(stats.registeredCount);
  if (pendingEl) pendingEl.textContent = String(stats.pendingCount);
  if (deadlineEl) deadlineEl.textContent = stats.deadlineText;
  renderDashboardDetailStats(trip);
}

function formatDashboardTripDateWithWeekday(value) {
  const base = formatDashboardTripDate(value);
  const match = String(value || "").trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (!match) return base;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  return `${base}（${weekdays[date.getUTCDay()]}）`;
}

function renderDashboardTripList() {
  const root = document.getElementById("dashboardTripList");
  if (!root) return;
  if (!Array.isArray(tripsData) || tripsData.length === 0) {
    root.innerHTML = '<div class="dashboard-trip-empty">目前尚無出團行程</div>';
    renderSelectedDashboardTripStats("");
    return;
  }
  const getDate = trip => String(trip.date || trip.departureDate || trip.tripDate || "").trim();
  const getName = trip => trip.name || trip.title || trip.tripName || "未命名行程";
  const todayText = getTaipeiTodayDateString();
  const [yy, mm, dd] = todayText.split("-").map(Number);
  const todayUTC = Date.UTC(yy, mm - 1, dd);
  const activeTrips = tripsData
    .filter(trip => !["已取消", "已下架", "取消"].includes(String(trip.status || "").trim()))
    .map((trip, index) => {
      const rawDate = getDate(trip);
      const parsed = rawDate ? new Date(`${rawDate.slice(0, 10)}T00:00:00`) : null;
      const stamp = parsed && !Number.isNaN(parsed.getTime()) ? parsed.getTime() : Number.MAX_SAFE_INTEGER;
      return { trip, index, rawDate, stamp };
    })
    .sort((a, b) => a.stamp - b.stamp || a.index - b.index);
  if (!activeTrips.length) {
    root.innerHTML = '<div class="dashboard-trip-empty">目前沒有可顯示的出團行程</div>';
    renderSelectedDashboardTripStats("");
    return;
  }

  let currentSelected = root.querySelector(".dashboard-trip-item.is-selected")?.dataset.tripId || "";
  if (!activeTrips.some(({trip}) => String(trip.tripId || trip.id || "") === currentSelected)) {
    currentSelected = String(activeTrips[0].trip.tripId || activeTrips[0].trip.id || "");
  }

  root.innerHTML = activeTrips.map(({ trip, rawDate }) => {
    const tripId = String(trip.tripId || trip.id || "");
    const tripName = getName(trip);
    const dateText = formatDashboardTripDateWithWeekday(rawDate);
    const selected = currentSelected === tripId ? " is-selected" : "";
    return `<button type="button" class="dashboard-trip-item${selected}" data-trip-id="${escapeHTML(tripId)}" aria-pressed="${selected ? "true" : "false"}" title="${escapeHTML(tripName)}">
      <span class="dashboard-trip-item-date"><img class="dashboard-trip-calendar" src="trip-row-calendar.png" alt="" aria-hidden="true" draggable="false"><span>${escapeHTML(dateText)}</span></span>
      <span class="dashboard-trip-item-name">${escapeHTML(tripName)}</span>
      <span class="dashboard-trip-item-arrow" aria-hidden="true"><img src="trip-chevron.png" alt="" draggable="false"></span>
    </button>`;
  }).join("");

  renderSelectedDashboardTripStats(currentSelected);
}

// 點選左側行程後，上方卡片同步切換成該行程的報名、待付款及截止日資料。
document.addEventListener("click", event => {
  const item = event.target.closest("#dashboardTripList .dashboard-trip-item");
  if (!item) return;
  document.querySelectorAll("#dashboardTripList .dashboard-trip-item").forEach(card => {
    const active = card === item;
    card.classList.toggle("is-selected", active);
    card.setAttribute("aria-pressed", active ? "true" : "false");
  });
  renderSelectedDashboardTripStats(item.dataset.tripId);
});

function updateDashboard() {
  renderDashboardTripList();
  renderDashboardRecentTrips();

  const totalTripsEl = document.getElementById("totalTrips");
  if (totalTripsEl) totalTripsEl.textContent = String(tripsData.length);
}


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
  const tbody = document.getElementById("tripsTableBody");
  if (!tbody) return;

  const search = (document.getElementById("tripSearch")?.value || "").trim().toLowerCase();
  const typeFilter = document.getElementById("tripTypeFilter")?.value || "";
  const statusFilter = document.getElementById("tripStatusFilter")?.value || "";
  const monthFilter = document.getElementById("tripMonthFilter")?.value || "";
  const sortMode = document.getElementById("tripSort")?.value || "asc";

  const sourceTrips = Array.isArray(tripsData) ? tripsData : [];
  const filtered = sourceTrips.filter(trip => {
    const name = String(trip.name || trip.title || "");
    const id = String(trip.tripId || trip.id || "");
    const date = String(trip.date || "");
    const type = String(trip.type || "");
    const status = String(trip.status || "");
    return (!search || name.toLowerCase().includes(search) || id.toLowerCase().includes(search))
      && (!typeFilter || type === typeFilter)
      && (!statusFilter || status === statusFilter)
      && (!monthFilter || date.slice(5, 7) === monthFilter);
  });

  filtered.sort((a, b) => {
    const da = String(a.date || "9999-99-99");
    const db = String(b.date || "9999-99-99");
    if (sortMode === "name") return String(a.name || a.title || "").localeCompare(String(b.name || b.title || ""), "zh-Hant");
    return sortMode === "desc" ? db.localeCompare(da) : da.localeCompare(db);
  });

  const countLabel = document.getElementById("tripListCount");
  if (countLabel) countLabel.textContent = `（共 ${filtered.length} 筆）`;

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-data">${sourceTrips.length ? "找不到符合條件的行程" : "目前尚無行程資料"}</td></tr>`;
    return;
  }

  const registrations = Array.isArray(registrationData) ? registrationData : [];
  tbody.innerHTML = filtered.map(trip => {
    const id = String(trip.tripId || trip.id || "");
    const name = String(trip.name || trip.title || "未命名行程");
    const date = String(trip.date || "");
    const type = String(trip.type || "");
    const departure = String(trip.departure || "台南");
    const status = String(trip.status || "");
    const capacity = Number(trip.maxPeople || trip.capacity || 0);
    const tripId = String(trip.tripId || trip.id || "");
    const tripRegistrations = registrations.filter(item =>
      (tripId && String(item.tripId || "") === tripId) ||
      (tripId && !item.tripId && String(item.tripName || "").trim() === name.trim()) ||
      (!tripId && String(item.tripName || "").trim() === name.trim())
    );
    const people = tripRegistrations.length;
    const countClass = people >= 40 ? "count-purple" : people >= 30 ? "count-blue" : people >= 20 ? "count-green" : "count-red";
    const countText = capacity > 0 ? `${people} / ${capacity} 人` : `${people} 人`;
    const dateParts = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const dateDisplay = dateParts ? `${dateParts[2]}/${dateParts[3]}` : date;
    const safeId = escapeHTML(id);
    return `
      <tr class="trip-list-row">
        <td><span class="trip-date-chip"><small>${dateParts ? `${dateParts[1]} 年` : "出發日期"}</small><strong>${escapeHTML(dateDisplay)}</strong></span></td>
        <td><span class="trip-deadline-text">${escapeHTML(trip.deadline || "未設定")}</span></td>
        <td><strong class="trip-name-text">${escapeHTML(name)}</strong></td>
        <td><span class="trip-type-chip">${escapeHTML(type || "未設定")}</span></td>
        <td><span class="trip-departure-text">⌖ ${escapeHTML(departure)}</span></td>
        <td><span class="trip-people-chip ${countClass}"><span class="trip-people-icon" aria-hidden="true">♟</span>${escapeHTML(countText)}</span></td>
        <td><span class="trip-status-chip">${escapeHTML(status || "未設定")}</span></td>
        <td class="trip-actions-cell">
          <button type="button" class="admin-btn admin-btn-light" onclick="editTrip('${safeId}')">編輯</button>
          <button type="button" class="admin-btn admin-btn-danger" onclick="deleteTrip('${safeId}')">刪除</button>
        </td>
      </tr>`;
  }).join("");
}

// 行程列表篩選條件即時更新，不需重新讀取伺服器資料。
["tripSearch", "tripTypeFilter", "tripStatusFilter", "tripMonthFilter", "tripSort"].forEach(id => {
  const control = document.getElementById(id);
  if (!control) return;
  control.addEventListener(id === "tripSearch" ? "input" : "change", renderTrips);
});


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
  renderDashboardTripList();
  renderDashboardRecentTrips();
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
  renderDashboardTripList();
  renderDashboardRecentTrips();
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
      <img class="login-artwork" src="login-cover.png?v=20261126-user-login-cover-final" alt="囍莉旅遊旅遊報名系統工作人員登入" draggable="false">
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

// =====================================================
// 初始化
// =====================================================

tripFormCard.style.display = "none";

// 登入前不載入任何後台資料
initializeAdminLock();