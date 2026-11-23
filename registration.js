/* =====================================================
   囍莉旅遊｜報名系統（新版）
===================================================== */

const registrationParams = new URLSearchParams(window.location.search);
const selectedTripId = registrationParams.get("trip");
let selectedTrip = null;
let boardingPoints = [];

const API_BASE = "https://script.google.com/macros/s/AKfycbwnN2PWqKHvWnIyTRPHkdT5a69ilwG2MUY8Iwx7IH3rzhTgj_5o6fItSYloSnk6piI4/exec";

const registrationForm = document.getElementById("registrationForm");
const selectedTripContainer = document.getElementById("selectedTrip");
const peopleCountSelect = document.getElementById("peopleCount");
const travelerContainer = document.getElementById("travelerContainer");
const boardingContainer = document.getElementById("boardingContainer");
const submitButton = document.getElementById("submitButton");

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, function(ch) {
        return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch];
    });
}

async function fetchAPI(action) {
    const response = await fetch(`${API_BASE}?action=${encodeURIComponent(action)}`);
    if (!response.ok) throw new Error(`API HTTP ${response.status}`);
    return response.json();
}

async function loadSelectedTrip() {
    try {
        const result = await fetchAPI("trips");
        const trips = Array.isArray(result.data) ? result.data : [];
        const apiTrip = trips.find(trip => String(trip.id || trip.tripId) === String(selectedTripId));

        if (!apiTrip) {
            selectedTripContainer.innerHTML = `<div class="empty-trip"><h3>⚠️ 找不到旅遊行程</h3><p>請回到旅遊行程頁面，重新選擇想報名的行程。</p><a href="trips.html">返回旅遊行程</a></div>`;
            registrationForm.style.display = "none";
            return;
        }

        selectedTrip = {
            id: apiTrip.id || apiTrip.tripId,
            title: apiTrip.title || apiTrip.name || "未命名行程",
            dateText: apiTrip.dateText || apiTrip.date || "待設定",
            priceText: apiTrip.priceText || (apiTrip.price != null ? `$${apiTrip.price}` : "待設定"),
            status: apiTrip.status || "",
            maxPeople: apiTrip.maxPeople || 0,
            registeredPeople: apiTrip.registeredPeople || 0,
            deadline: apiTrip.deadline || "",
            departure: apiTrip.departure || "台南"
        };
        renderSelectedTrip();
        registrationForm.style.display = "";
    } catch (error) {
        console.error("載入行程失敗", error);
        selectedTripContainer.innerHTML = `<div class="empty-trip"><h3>⚠️ 行程資料載入失敗</h3><p>請重新整理頁面，或稍後再試。</p></div>`;
        registrationForm.style.display = "none";
    }
}

function renderSelectedTrip() {
    if (!selectedTrip) return;
    selectedTripContainer.innerHTML = `
        <div class="selected-trip-card">
            <h3>🌸 ${escapeHTML(selectedTrip.title)}</h3>
            <p>📅 <strong>出團日期：</strong>${escapeHTML(selectedTrip.dateText)}</p>
            <p>💰 <strong>團費：</strong>${escapeHTML(selectedTrip.priceText)}</p>
            <p>👥 <strong>已報名：</strong>${escapeHTML(selectedTrip.registeredPeople)} / ${escapeHTML(selectedTrip.maxPeople || "不限")}</p>
            <p>⏰ <strong>報名截止：</strong>${escapeHTML(selectedTrip.deadline || "待設定")}</p>
            <p>📍 <strong>出發地：</strong>${escapeHTML(selectedTrip.departure)}</p>
        </div>`;
}

async function loadBoardingPoints() {
    try {
        const result = await fetchAPI("boardingPoints");
        const raw = Array.isArray(result.data) ? result.data : [];
        boardingPoints = raw.map(item => typeof item === "string" ? item : (item.name || item.point || item.title || item.location || "")).filter(Boolean);
    } catch (error) {
        console.error("載入上車地點失敗", error);
        boardingPoints = [];
    }
    renderTravelers();
}

function makeOptions(points, first) {
    let html = first
        ? `<option value="">請選擇第一上車地點</option>`
        : `<option value="">不需要第二上車地點</option>`;
    points.forEach(point => html += `<option value="${escapeHTML(point)}">${escapeHTML(point)}</option>`);
    html += `<option value="custom">✏️ 自行輸入上車地點</option>`;
    return html;
}

function renderTravelers() {
    const count = Number(peopleCountSelect.value || 0);
    travelerContainer.innerHTML = "";
    boardingContainer.innerHTML = "";

    if (!count) {
        travelerContainer.innerHTML = `<div class="empty-category">請先選擇同行人數。</div>`;
        return;
    }

    for (let i = 1; i <= count; i++) {
        const travelerCard = document.createElement("div");
        travelerCard.className = "traveler-card";
        travelerCard.innerHTML = `
            <h3>👤 同行者 ${i}</h3>
            <div class="form-group"><label for="travelerName${i}">姓名 <span class="required">*</span></label><input type="text" id="travelerName${i}" name="travelerName${i}" required placeholder="請輸入姓名"></div>
            <div class="form-group"><label for="travelerID${i}">身分證字號 <span class="required">*</span></label><input type="text" id="travelerID${i}" name="travelerID${i}" required maxlength="10" autocomplete="off" placeholder="請輸入身分證字號"></div>
            <div class="form-group"><label for="travelerBirth${i}">出生日期 <span class="required">*</span></label><input type="date" id="travelerBirth${i}" name="travelerBirth${i}" required></div>
        `;
        travelerContainer.appendChild(travelerCard);

        const boardingCard = document.createElement("div");
        boardingCard.className = "boarding-card";
        boardingCard.innerHTML = `
            <h3>🚌 同行者 ${i} 上車地點</h3>
            <div class="form-group"><label for="boardingFirst${i}">第一上車地點 <span class="required">*</span></label><select id="boardingFirst${i}" name="boardingFirst${i}" required>${makeOptions(boardingPoints, true)}</select><input type="text" id="boardingFirstCustom${i}" placeholder="請輸入第一上車地點" style="display:none"></div>
            <div class="form-group"><label for="boardingSecond${i}">第二上車地點（選填）</label><select id="boardingSecond${i}" name="boardingSecond${i}">${makeOptions(boardingPoints, false)}</select><input type="text" id="boardingSecondCustom${i}" placeholder="請輸入第二上車地點" style="display:none"></div>
            <p class="boarding-hint">💡 第二上車地點不需要選擇時，請直接留空即可。</p>`;
        boardingContainer.appendChild(boardingCard);

        const first = document.getElementById(`boardingFirst${i}`);
        const firstCustom = document.getElementById(`boardingFirstCustom${i}`);
        const second = document.getElementById(`boardingSecond${i}`);
        const secondCustom = document.getElementById(`boardingSecondCustom${i}`);

        first.addEventListener("change", () => {
            firstCustom.style.display = first.value === "custom" ? "block" : "none";
            firstCustom.required = first.value === "custom";
            if (first.value !== "custom") firstCustom.value = "";
            checkBoardingLocations(i);
        });
        second.addEventListener("change", () => {
            secondCustom.style.display = second.value === "custom" ? "block" : "none";
            if (second.value !== "custom") secondCustom.value = "";
            checkBoardingLocations(i);
        });
        firstCustom.addEventListener("input", () => checkBoardingLocations(i));
        secondCustom.addEventListener("input", () => checkBoardingLocations(i));
    }

    const proxyConsent = document.getElementById("proxyConsent");
    proxyConsent.required = count > 1;
    proxyConsent.checked = false;
}

function checkBoardingLocations(i) {
    const first = document.getElementById(`boardingFirst${i}`);
    const second = document.getElementById(`boardingSecond${i}`);
    const firstCustom = document.getElementById(`boardingFirstCustom${i}`);
    const secondCustom = document.getElementById(`boardingSecondCustom${i}`);
    const firstValue = first.value === "custom" ? firstCustom.value.trim() : first.value;
    const secondValue = second.value === "custom" ? secondCustom.value.trim() : second.value;
    if (firstValue && secondValue && firstValue === secondValue) {
        alert("第一及第二上車地點不能相同，請重新選擇。");
        second.value = "";
        secondCustom.value = "";
        secondCustom.style.display = "none";
    }
}

function collectTravelerData() {
    const count = Number(peopleCountSelect.value);
    const travelers = [];
    for (let i = 1; i <= count; i++) {
        const firstSelect = document.getElementById(`boardingFirst${i}`);
        const secondSelect = document.getElementById(`boardingSecond${i}`);
        const firstCustom = document.getElementById(`boardingFirstCustom${i}`);
        const secondCustom = document.getElementById(`boardingSecondCustom${i}`);
        travelers.push({
            travelerNumber: i,
            name: document.getElementById(`travelerName${i}`).value.trim(),
            idNumber: document.getElementById(`travelerID${i}`).value.trim().toUpperCase(),
            birthday: document.getElementById(`travelerBirth${i}`).value,
            boardingFirst: firstSelect.value === "custom" ? firstCustom.value.trim() : firstSelect.value,
            boardingSecond: secondSelect.value === "custom" ? secondCustom.value.trim() : secondSelect.value
        });
    }
    return travelers;
}

function showRegistrationConfirmation(data) {
    let travelerHTML = data.travelers.map(t => `
        <div class="confirmation-traveler">
            <h4>👤 同行者 ${t.travelerNumber}</h4>
            <p><strong>姓名：</strong>${escapeHTML(t.name)}</p>
            <p><strong>身分證字號：</strong>${escapeHTML(t.idNumber)}</p>
            <p><strong>出生日期：</strong>${escapeHTML(t.birthday)}</p>
            <p><strong>第一上車地點：</strong>${escapeHTML(t.boardingFirst)}</p>
            <p><strong>第二上車地點：</strong>${escapeHTML(t.boardingSecond || "未選擇")}</p>
        </div>`).join("");

    const confirmation = document.createElement("section");
    confirmation.className = "card confirmation-card";
    confirmation.innerHTML = `
        <h2>🎉 報名資料確認</h2><p>請確認以下報名資料。</p>
        <div class="confirmation-section"><h3>🌸 報名行程</h3>
            <p><strong>行程名稱：</strong>${escapeHTML(data.trip.title)}</p>
            <p><strong>出團日期：</strong>${escapeHTML(data.trip.date)}</p>
            <p><strong>團費：</strong>${escapeHTML(data.trip.price)}</p>
            <p><strong>同行人數：</strong>${data.peopleCount} 人</p>
        </div>
        <div class="confirmation-section"><h3>📞 旅遊主要聯絡人代表</h3>
            <p><strong>姓名：</strong>${escapeHTML(data.mainRegistrant.name)}</p>
            <p><strong>電話：</strong>${escapeHTML(data.mainRegistrant.phone)}</p>
            <p><strong>身分證字號：</strong>${escapeHTML(data.mainRegistrant.idNumber)}</p>
        </div>
        <div class="confirmation-section"><h3>👥 同行者資料</h3>${travelerHTML}</div>
        <div class="confirmation-section"><h3>📋 同意事項</h3>
            <p><strong>個資知悉：</strong>${data.privacyConsent ? "已確認" : "未確認"}</p>
            <p><strong>個資使用同意：</strong>${data.privacyUseConsent ? "已同意" : "未同意"}</p>
            <p><strong>照片／影片：</strong>${escapeHTML(data.photoConsent)}</p>
            <p><strong>多人代填：</strong>${data.proxyConsent ? "已確認" : "未勾選"}</p>
            <p><strong>資料確認：</strong>${data.confirmData ? "已確認" : "未確認"}</p>
        </div>
        <div class="confirmation-notice"><h3>📢 下一步</h3>
            <p>目前此頁為報名資料確認流程，尚未將資料正式寫入報名資料庫。</p>
            <p>請聯絡囍莉旅遊確認報名資料及報名成功。</p>
            <p>聯絡電話：<strong>0909686339</strong></p>
            <p>聯絡人：<strong>陳莉瀅（阿冷）－悅揚旅行社</strong></p>
        </div>
        <button type="button" onclick="window.print()">🖨️ 列印報名資料</button>
        <button type="button" onclick="location.reload()">↩️ 返回修改資料</button>`;
    registrationForm.style.display = "none";
    registrationForm.parentElement.appendChild(confirmation);
    confirmation.scrollIntoView({behavior:"smooth", block:"start"});
}

registrationForm.addEventListener("submit", function(event) {
    event.preventDefault();
    if (!selectedTrip) return alert("找不到報名行程，請重新選擇行程。");
    if (!registrationForm.checkValidity()) {
        registrationForm.reportValidity();
        return;
    }
    const data = {
        trip: {id:selectedTrip.id, title:selectedTrip.title, date:selectedTrip.dateText, price:selectedTrip.priceText},
        mainRegistrant: {
            name:document.getElementById("mainName").value.trim(),
            phone:document.getElementById("mainPhone").value.trim(),
            idNumber:document.getElementById("mainID").value.trim().toUpperCase()
        },
        peopleCount:Number(peopleCountSelect.value),
        travelers:collectTravelerData(),
        privacyConsent:document.getElementById("privacyConsent").checked,
        privacyUseConsent:document.getElementById("privacyUseConsent").checked,
        photoConsent:document.querySelector('input[name="photoConsent"]:checked').value,
        proxyConsent:document.getElementById("proxyConsent").checked,
        confirmData:document.getElementById("confirmData").checked,
        submittedAt:new Date().toISOString()
    };
    showRegistrationConfirmation(data);
});

peopleCountSelect.addEventListener("change", renderTravelers);

/* Modal */
const privacyModal = document.getElementById("privacyModal");
function openPrivacyModal() {
    privacyModal.classList.add("open");
    privacyModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
}
function closePrivacyModal() {
    privacyModal.classList.remove("open");
    privacyModal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
}
document.getElementById("openPrivacyModal").addEventListener("click", openPrivacyModal);
document.getElementById("closePrivacyModal").addEventListener("click", closePrivacyModal);
document.getElementById("closePrivacyModalBottom").addEventListener("click", closePrivacyModal);
document.getElementById("privacyModalBackdrop").addEventListener("click", closePrivacyModal);
document.addEventListener("keydown", event => { if (event.key === "Escape") closePrivacyModal(); });

async function initializeRegistration() {
    await Promise.all([loadSelectedTrip(), loadBoardingPoints()]);
}
initializeRegistration();




