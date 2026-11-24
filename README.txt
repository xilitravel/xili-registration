囍莉旅遊｜個資告知書按鈕修正

請先備份 GitHub Pages 原本的 registration.html、registration.js。
再將本資料夾內兩個檔案上傳到 GitHub 專案根目錄，覆蓋同名檔案。

修正內容：
1. 為「閱讀完整告知及同意書」按鈕明確綁定 click 事件。
2. 開啟、右上角關閉、底部關閉、點擊遮罩、Esc 均可操作。
3. 將開啟／關閉函式掛到 window，兼容舊版 inline onclick。
4. 更新 registration.js 的版本參數，避免瀏覽器繼續使用舊快取。

注意：本次只修正個資視窗按鈕，不更動 Google Apps Script 或試算表。
已執行 JavaScript 語法檢查；尚未在實際 GitHub Pages 網站進行瀏覽器端到端測試。
