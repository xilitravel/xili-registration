/* =====================================================
   囍莉旅遊｜報名系統
===================================================== */


/* =====================================================
   1. 取得行程資料
===================================================== */

const registrationParams = new URLSearchParams(
    window.location.search
);

const selectedTripId = registrationParams.get("trip");

const selectedTrip = tripsData.find(function(trip) {

    return trip.id === selectedTripId;

});


/* =====================================================
   2. 取得 HTML 元素
===================================================== */

const registrationForm = document.getElementById("registrationForm");

const selectedTripContainer = document.getElementById("selectedTrip");

const peopleCountSelect = document.getElementById("peopleCount");

const travelerContainer = document.getElementById("travelerContainer");

const boardingContainer = document.getElementById("boardingContainer");

const submitButton = document.getElementById("submitButton");


/* =====================================================
   3. 顯示選擇的行程
===================================================== */

function renderSelectedTrip() {

    if (!selectedTrip) {

        selectedTripContainer.innerHTML = `

            <div class="empty-trip">

                <h3>⚠️ 找不到旅遊行程</h3>

                <p>
                    請先回到旅遊行程頁面，
                    選擇想報名的行程。
                </p>

                <a href="trips.html">
                    返回旅遊行程
                </a>

            </div>

        `;

        registrationForm.style.display = "none";

        return;

    }


    selectedTripContainer.innerHTML = `

        <div class="selected-trip-card">

            <h3>
                🌸 ${selectedTrip.title}
            </h3>

            <p>
                📅
                <strong>出團日期：</strong>
                ${selectedTrip.dateText || "待設定"}
            </p>

            <p>
                💰
                <strong>團費：</strong>
                ${selectedTrip.priceText || "待設定"}
            </p>

            <p>
                👥
                <strong>報名人數：</strong>
                ${selectedTrip.registeredPeople || 0}
                /
                ${selectedTrip.maxPeople || "不限"}
            </p>

            <p>
                ⏰
                <strong>報名截止：</strong>
                ${selectedTrip.deadline || "待設定"}
            </p>

            <p>
                📍
                <strong>出發地：</strong>
                ${selectedTrip.departure || "台南"}
            </p>

        </div>

    `;

}


/* =====================================================
   4. 取得上車地點
===================================================== */

function getBoardingPoints() {

    if (
        selectedTrip &&
        selectedTrip.boardingPoints &&
        selectedTrip.boardingPoints.length > 0
    ) {

        return selectedTrip.boardingPoints;

    }


    return [

        "永康轉運站",

        "虎尾寮文聖公園"

    ];

}


/* =====================================================
   5. 建立旅客資料欄位
===================================================== */

function renderTravelers() {

    const peopleCount = Number(
        peopleCountSelect.value
    );


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


    const boardingPoints = getBoardingPoints();


    /* =================================================
       建立每位旅客資料
    ================================================= */

    for (let i = 1; i <= peopleCount; i++) {


        /* =============================================
           旅客資料卡
        ============================================= */

        const travelerCard = document.createElement("div");

        travelerCard.className = "traveler-card";


        travelerCard.innerHTML = `

            <h3>
                👤 旅客 ${i}
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
                    placeholder="請輸入身分證字號"
                >

            </div>


            <div class="form-group">

                <label for="travelerBirth${i}">

                    出生日期
                    <span class="required">*</span>

                </label>

                <input
                    type="date"
                    id="travelerBirth${i}"
                    name="travelerBirth${i}"
                    required
                >

            </div>


            <div class="form-group">

                <label for="travelerPhone${i}">

                    聯絡電話

                </label>

                <input
                    type="tel"
                    id="travelerPhone${i}"
                    name="travelerPhone${i}"
                    placeholder="請輸入聯絡電話"
                >

            </div>


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


        travelers.push({

            travelerNumber: i,

            name: travelerName,

            idNumber: travelerID,

            birthday: travelerBirth,

            phone: travelerPhone,

            boardingFirst: boardingFirst,

            boardingSecond: boardingSecond

        });


    }


    return travelers;

}


/* =====================================================
   9. 送出報名資料
===================================================== */

registrationForm.addEventListener(
    "submit",
    function(event) {


        event.preventDefault();


        /* =========================
           基本驗證
        ========================= */

        if (!selectedTrip) {

            alert(
                "找不到報名行程，請重新選擇行程。"
            );

            return;

        }


        if (!registrationForm.checkValidity()) {

            registrationForm.reportValidity();

            return;

        }


        /* =========================
           取得報名人資料
        ========================= */

        const mainName = document.getElementById(
            "mainName"
        ).value.trim();


        const mainPhone = document.getElementById(
            "mainPhone"
        ).value.trim();


        const mainEmail = document.getElementById(
            "mainEmail"
        ).value.trim();


        const mainLine = document.getElementById(
            "mainLine"
        ).value.trim();


        const peopleCount = Number(
            peopleCountSelect.value
        );


        /* =========================
           取得旅客資料
        ========================= */

        const travelers = collectTravelerData();


        /* =========================
           個資同意
        ========================= */

        const privacyConsent = document.getElementById(
            "privacyConsent"
        ).checked;


        /* =========================
           照片同意
        ========================= */

        const photoConsent = document.querySelector(
            'input[name="photoConsent"]:checked'
        ).value;


        /* =========================
           代理填寫確認
        ========================= */

        const proxyConsent = document.getElementById(
            "proxyConsent"
        ).checked;


        /* =========================
           確認資料
        ========================= */

        const confirmData = document.getElementById(
            "confirmData"
        ).checked;


        /* =========================
           建立報名資料
        ========================= */

        const registrationData = {

            trip: {

                id: selectedTrip.id,

                title: selectedTrip.title,

                date: selectedTrip.dateText,

                price: selectedTrip.priceText

            },


            mainRegistrant: {

                name: mainName,

                phone: mainPhone,

                email: mainEmail,

                line: mainLine

            },


            peopleCount: peopleCount,


            travelers: travelers,


            privacyConsent: privacyConsent,


            photoConsent: photoConsent,


            proxyConsent: proxyConsent,


            confirmData: confirmData,


            submittedAt: new Date().toISOString()

        };


        /* =========================
           顯示確認資料
        ========================= */

        showRegistrationConfirmation(
            registrationData
        );


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
                📞 報名人資料
            </h3>


            <p>

                <strong>姓名：</strong>

                ${data.mainRegistrant.name}

            </p>


            <p>

                <strong>電話：</strong>

                ${data.mainRegistrant.phone}

            </p>


            <p>

                <strong>Email：</strong>

                ${data.mainRegistrant.email || "未填寫"}

            </p>


            <p>

                <strong>LINE：</strong>

                ${data.mainRegistrant.line || "未填寫"}

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

                目前網站尚未串接正式資料庫，
                此確認畫面僅供確認資料。

            </p>


            <p>

                請加入 LINE 聯絡小幫手，
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

renderSelectedTrip();


/* =====================================================
   12. 預設顯示提示
===================================================== */

renderTravelers();
