




// =====================================================
// 囍莉旅遊｜管理後台
// Google Apps Script API 版本
// =====================================================


// =====================================================
// API 設定
// =====================================================

const API_URL =
  "https://script.google.com/macros/s/AKfycbwnN2PWqKHvWnIyTRPHkdT5a69ilwG2MUY8Iwx7IH3rzhTgj_5o6fItSYloSnk6piI4/exec";


// =====================================================
// 系統資料
// =====================================================

let tripsData = [];

let boardingData = [];

let registrationData = [];

let paymentData = [];


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

    updateDashboard();

    populateTripFilters();

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

  tripsData = await apiGet("trips");

  renderTrips();

}


function updateDashboard() {

  document.getElementById("totalTrips")
    .textContent = tripsData.length;

  document.getElementById("totalRegistrations")
    .textContent = registrationData.length;

  document.getElementById("pendingRegistrations")
    .textContent = registrationData.filter(item => {

      return item.status === "待確認";

    }).length;

  document.getElementById("pendingPayments")
    .textContent = paymentData.filter(item => {

      return item.status === "未繳費";

    }).length;

}


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
        .filter(Boolean)

  };


  try {

    await apiPost({

      action: "saveTrip",

      trip: trip

    });


    alert(
      "行程已成功儲存至 Google Sheets！"
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

      tripId: id

    });


    alert(
      "行程已刪除！"
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
  registrationData = await apiGet("registrations");
  renderRegistrations();
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
      <td>${escapeHTML(item.idNumber)}</td>
      <td>${escapeHTML(item.phone)}</td>
      <td>${escapeHTML(item.boarding1)}</td>
      <td>${escapeHTML(item.boarding2)}</td>
      <td>${escapeHTML(item.photoConsent)}</td>
      <td>${escapeHTML(item.room)}</td>
    </tr>
  `).join("");
}

// =====================================================
// 繳費管理
// =====================================================

function renderPayments() {

  const tbody =
    document.getElementById("paymentsTableBody");


  if (!paymentData.length) {

    tbody.innerHTML = `

      <tr>

        <td colspan="7" class="empty-data">

          繳費資料 API 尚未完成

        </td>

      </tr>

    `;

    return;

  }

}


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
    const csvRows = [headers, ...rows.map(item => [item.tripName, item.name, item.birthDate, item.idNumber, item.phone, item.boarding1, item.boarding2, item.photoConsent, item.room])];
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

    alert(
      "目前尚未建立正式登入驗證系統。"
    );

  });


// =====================================================
// 初始化
// =====================================================

tripFormCard.style.display = "none";


loadAllData();




