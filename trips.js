




/* =====================================================
   囍莉旅遊｜報名系統
===================================================== */

const registrationParams = new URLSearchParams(window.location.search);
const selectedTripId = registrationParams.get("trip");
let selectedTrip = null;

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


/* =====================================================
   1. 載入行程資料
===================================================== */

async function loadSelectedTrip() {

    try {

        const response = await fetch(TRIPS_JSON_URL + "?t=" + Date.now(), { cache: "no-store" });
        if (!response.ok) throw new Error("讀取行程資料失敗（HTTP " + response.status + "）");
        const trips = await response.json();

        /* 載入上車地點 */

        try {

            const boardingResponse = await fetch(BOARDING_API_URL);
            const boardingResult = await boardingResponse.json();

            if (boardingResult.success && Array.isArray(boardingResult.data)) {

                boardingPointsList = boardingResult.data;

            } else if (Array.isArray(boardingResult.boardingPoints)) {

                boardingPointsList = boardingResult.boardingPoints;

            } else {

                boardingPointsList = [];

            }

        } catch (boardingError) {

            console.error("載入上車地點失敗：", boardingError);

            boardingPointsList = [];

        }


        /* 確認行程 API */

        if (!Array.isArray(trips)) {
            throw new Error("trips.json 格式錯誤");
        }

        const apiTrip = trips.find(function(trip) {

            return String(trip.id || trip.tripId) === String(selectedTripId);

        });


        if (!apiTrip) {

            selectedTripContainer.innerHTML = `
                <div class="empty-trip">
                    <h3>⚠️ 找不到旅遊行程</h3>
                    <p>請回到旅遊行程頁面，重新選擇想報名的行程。</p>
                    <a href="trips.html">返回旅遊行程</a>
                </div>
            `;

            registrationForm.style.display = "none";

            return;

        }


        /* 整理行程資料 */

        selectedTrip = {

            id: apiTrip.id || apiTrip.tripId,

            sheetName: apiTrip.sheetName || apiTrip.worksheetName || apiTrip.title || apiTrip.name || "",

            title: apiTrip.title || apiTrip.name || "未命名行程",

            date: apiTrip.date || "",

            dateText: apiTrip.dateText || apiTrip.date || "待設定",

            price: apiTrip.price || 0,

            priceText: apiTrip.priceText || (
                apiTrip.price != null
                    ? "$" + apiTrip.price
                    : "待設定"
            ),

            status: apiTrip.status || "",

            maxPeople: apiTrip.maxPeople || 0,

            registeredPeople: apiTrip.registeredPeople || 0,

            deadline: apiTrip.deadline || "",

            departure: apiTrip.departure || "台南",

            boardingPoints: apiTrip.boardingPoints || [],

            description: apiTrip.description || "",

            tripDays: Number(apiTrip.tripDays || apiTrip.days || 1),

            lodging:
                apiTrip.lodging === true ||
                apiTrip.tripLodging === "true" ||
                apiTrip.hasLodging === true,

            roomTypes: apiTrip.roomTypes || apiTrip.rooms || [],

            meals: apiTrip.meals || apiTrip.mealSettings || []

        };


        registrationForm.style.display = "";

        renderSelectedTrip();


    } catch (error) {

        console.error("載入報名行程失敗：", error);

        selectedTripContainer.innerHTML = `
            <div class="empty-trip">
                <h3>⚠️ 行程資料載入失敗</h3>
                <p>請重新整理頁面，或稍後再試。</p>
            </div>
        `;

        registrationForm.style.display = "none";

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
                    required
                    placeholder="請輸入旅客姓名"
                >

            </div>


            <div class="form-group">

                <label for="travelerBirth${i}">

                    出生年月日

                    <span class="required">*</span>

                </label>

                <input
                    type="text"
                    id="travelerBirth${i}"
                    name="travelerBirth${i}"
                    required
                    maxlength="9"
                    placeholder="民國 XX/XX/XX"
                    inputmode="numeric"
                >

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
            action: "submitRegistration",
            tripName: selectedTrip.sheetName || selectedTrip.title,
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
                privacyConsent: privacyConsent,
                photoConsent: photoConsent,
                proxyConsent: proxyConsent,
                confirmData: confirmData,
                submittedAt: new Date().toISOString(),
                saved: true,
                serverMessage: result.message || (result.data && result.data.message) || "報名資料已成功送出"
            };

            showRegistrationConfirmation(registrationData);

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
            onclick="location.reload()"
        >

            ↩️ 返回修改資料

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

loadSelectedTrip();


/* =====================================================
   12. 預設顯示提示
===================================================== */




