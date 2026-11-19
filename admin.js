// =========================
// 囍莉旅遊管理後台
// 目前使用 localStorage 暫存
// 未來改接 Google Sheets API
// =========================


// 資料儲存
const STORAGE_TRIPS = "xili_admin_trips";
const STORAGE_BOARDING = "xili_admin_boarding";


// =========================
// 讀取資料
// =========================

function getTrips() {
  return JSON.parse(localStorage.getItem(STORAGE_TRIPS) || "[]");
}

function saveTrips(trips) {
  localStorage.setItem(STORAGE_TRIPS, JSON.stringify(trips));
}

function getBoardingLocations() {
  return JSON.parse(localStorage.getItem(STORAGE_BOARDING) || "[]");
}

function saveBoardingLocations(locations) {
  localStorage.setItem(STORAGE_BOARDING, JSON.stringify(locations));
}


// =========================
// 頁面切換
// =========================

const navButtons = document.querySelectorAll(".admin-nav-btn");
const adminSections = document.querySelectorAll(".admin-section");

navButtons.forEach(button => {

  button.addEventListener("click", () => {

    const sectionId = button.dataset.section;

    navButtons.forEach(btn => {
      btn.classList.remove("active");
    });

    adminSections.forEach(section => {
      section.classList.remove("active");
    });

    button.classList.add("active");

    document.getElementById(sectionId).classList.add("active");

  });

});


// =========================
// 總覽
// =========================

function updateDashboard() {

  const trips = getTrips();

  document.getElementById("totalTrips").textContent = trips.length;

  // 報名資料尚未連接
  document.getElementById("totalRegistrations").textContent = "0";

  document.getElementById("pendingRegistrations").textContent = "0";

  document.getElementById("pendingPayments").textContent = "0";

}


// =========================
// 行程管理
// =========================

const tripForm = document.getElementById("tripForm");
const tripFormCard = document.getElementById("tripFormCard");


// 新增行程按鈕
document.getElementById("addTripBtn").addEventListener("click", () => {

  tripForm.reset();

  document.getElementById("tripId").value = "";

  document.getElementById("tripFormTitle").textContent = "新增行程";

  tripFormCard.style.display = "block";

  tripFormCard.scrollIntoView({
    behavior: "smooth"
  });

});


// 取消行程編輯
document.getElementById("cancelTripBtn").addEventListener("click", () => {

  tripForm.reset();

  tripFormCard.style.display = "none";

});


// 儲存行程
tripForm.addEventListener("submit", event => {

  event.preventDefault();

  const trips = getTrips();

  const tripId = document.getElementById("tripId").value;

  const trip = {

    id: tripId || "trip_" + Date.now(),

    title: document.getElementById("tripTitle").value.trim(),

    type: document.getElementById("tripType").value,

    date: document.getElementById("tripDate").value,

    price: Number(document.getElementById("tripPrice").value),

    maxPeople: Number(document.getElementById("tripMaxPeople").value || 0),

    deadline: document.getElementById("tripDeadline").value,

    status: document.getElementById("tripStatus").value,

    departure: document.getElementById("tripDeparture").value.trim(),

    description: document.getElementById("tripDescription").value.trim(),

    highlights: document.getElementById("tripHighlights").value
      .split("\n")
      .filter(item => item.trim() !== ""),

    boardingPoints: document.getElementById("tripBoardingPoints").value
      .split("\n")
      .filter(item => item.trim() !== ""),

    notes: document.getElementById("tripNotes").value
      .split("\n")
      .filter(item => item.trim() !== "")

  };


  if (tripId) {

    const index = trips.findIndex(item => item.id === tripId);

    if (index !== -1) {
      trips[index] = trip;
    }

  } else {

    trips.push(trip);

  }


  saveTrips(trips);

  renderTrips();

  updateDashboard();

  tripForm.reset();

  tripFormCard.style.display = "none";

  alert("行程已暫存！");

});


// 顯示行程
function renderTrips() {

  const trips = getTrips();

  const tbody = document.getElementById("tripsTableBody");

  if (trips.length === 0) {

    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-data">
          目前尚無行程資料
        </td>
      </tr>
    `;

    return;

  }


  tbody.innerHTML = trips.map(trip => {

    return `
      <tr>

        <td>${escapeHTML(trip.title)}</td>

        <td>${trip.date || "未設定"}</td>

        <td>${escapeHTML(trip.type || "")}</td>

        <td>$${Number(trip.price || 0).toLocaleString()}</td>

        <td>${escapeHTML(trip.status || "")}</td>

        <td>

          <button
            class="admin-btn admin-btn-light"
            onclick="editTrip('${trip.id}')"
          >
            編輯
          </button>

          <button
            class="admin-btn admin-btn-danger"
            onclick="deleteTrip('${trip.id}')"
          >
            刪除
          </button>

        </td>

      </tr>
    `;

  }).join("");

}


// 編輯行程
function editTrip(id) {

  const trips = getTrips();

  const trip = trips.find(item => item.id === id);

  if (!trip) return;


  document.getElementById("tripId").value = trip.id;

  document.getElementById("tripTitle").value = trip.title || "";

  document.getElementById("tripType").value = trip.type || "";

  document.getElementById("tripDate").value = trip.date || "";

  document.getElementById("tripPrice").value = trip.price || 0;

  document.getElementById("tripMaxPeople").value = trip.maxPeople || "";

  document.getElementById("tripDeadline").value = trip.deadline || "";

  document.getElementById("tripStatus").value = trip.status || "報名中";

  document.getElementById("tripDeparture").value = trip.departure || "";

  document.getElementById("tripDescription").value = trip.description || "";

  document.getElementById("tripHighlights").value =
    (trip.highlights || []).join("\n");

  document.getElementById("tripBoardingPoints").value =
    (trip.boardingPoints || []).join("\n");

  document.getElementById("tripNotes").value =
    (trip.notes || []).join("\n");


  document.getElementById("tripFormTitle").textContent = "修改行程";

  tripFormCard.style.display = "block";

  tripFormCard.scrollIntoView({
    behavior: "smooth"
  });

}


// 刪除行程
function deleteTrip(id) {

  if (!confirm("確定要刪除此行程嗎？")) {
    return;
  }

  const trips = getTrips().filter(item => item.id !== id);

  saveTrips(trips);

  renderTrips();

  updateDashboard();

}


// =========================
// 上車地點管理
// =========================

const boardingForm = document.getElementById("boardingForm");

boardingForm.addEventListener("submit", event => {

  event.preventDefault();

  const locations = getBoardingLocations();

  const location = {

    id: "boarding_" + Date.now(),

    name: document.getElementById("boardingName").value.trim(),

    address: document.getElementById("boardingAddress").value.trim(),

    description: document.getElementById("boardingDescription").value.trim()

  };


  locations.push(location);

  saveBoardingLocations(locations);

  renderBoardingLocations();

  boardingForm.reset();

  alert("上車地點已暫存！");

});


// 顯示上車地點
function renderBoardingLocations() {

  const locations = getBoardingLocations();

  const tbody = document.getElementById("boardingTableBody");

  if (locations.length === 0) {

    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="empty-data">
          尚無上車地點資料
        </td>
      </tr>
    `;

    return;

  }


  tbody.innerHTML = locations.map(location => {

    return `
      <tr>

        <td>${escapeHTML(location.name)}</td>

        <td>${escapeHTML(location.address || "")}</td>

        <td>${escapeHTML(location.description || "")}</td>

        <td>

          <button
            class="admin-btn admin-btn-danger"
            onclick="deleteBoardingLocation('${location.id}')"
          >
            刪除
          </button>

        </td>

      </tr>
    `;

  }).join("");

}


// 刪除上車地點
function deleteBoardingLocation(id) {

  if (!confirm("確定要刪除此上車地點嗎？")) {
    return;
  }

  const locations = getBoardingLocations()
    .filter(location => location.id !== id);

  saveBoardingLocations(locations);

  renderBoardingLocations();

}


// =========================
// 報名資料匯出
// =========================

document.getElementById("exportRegistrationBtn")
  .addEventListener("click", () => {

    alert(
      "目前尚未連接報名資料庫。\n" +
      "完成 Google Sheets API 後，這裡會提供 Excel 匯出功能。"
    );

  });


// =========================
// 系統設定
// =========================

document.getElementById("settingsForm")
  .addEventListener("submit", event => {

    event.preventDefault();

    alert(
      "目前系統設定尚未連接資料庫。\n" +
      "之後會將設定儲存至 Google Sheets 或後端資料庫。"
    );

  });


// =========================
// 登出
// =========================

document.getElementById("logoutBtn")
  .addEventListener("click", () => {

    alert(
      "目前尚未建立真正的登入驗證系統。\n" +
      "完成後台安全設定後，這裡才會提供正式登出功能。"
    );

  });


// =========================
// 防止 HTML 注入
// =========================

function escapeHTML(value) {

  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}


// =========================
// 初始化
// =========================

tripFormCard.style.display = "none";

renderTrips();

renderBoardingLocations();

updateDashboard();
