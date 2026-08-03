# Photo Booth 人類 MOS 評分網站

這是一個可部署到 GitHub Pages 的匿名、雙盲、5 分制 ACR 評分網站。網站包含 27 張正式刺激圖與 3 張一致性重複，並為每位參與者建立固定、可重現的限制式隨機順序。

## 1. 先連接 Google 試算表

GitHub Pages 本身不能接收資料，因此本專案用 Google Apps Script 把匿名結果寫入 Google Sheet。

1. 新增一份 Google 試算表。
2. 開啟「擴充功能 → Apps Script」。
3. 把 `google-apps-script/Code.gs` 全部貼進編輯器並儲存。
4. 按「部署 → 新增部署作業 → 網頁應用程式」。
5. 執行身分選「我」，誰可以存取選「任何人」。
6. 複製部署後的 `/exec` 網址，貼進 `config.js` 的 `endpoint`。
7. 在 Apps Script 編輯器先執行一次 `setupSheets()`，授權後會建立兩張工作表。
8. 選擇「部署 → 管理部署作業 → 編輯 → 新版本」，重新部署後仍沿用原本的 `/exec` 網址。
9. 完整試填一次，確認：
   - `MOS_participants` 新增 1 行受試者摘要。
   - `MOS_ratings` 新增 30 行逐圖原始評分。

原有的 `MOS_responses` 不會被刪除或覆寫；新版資料改寫入上述兩張工作表。

## 2. 部署 GitHub Pages

1. 建立 GitHub repository，將本專案推到 `main` 分支。
2. 到 repository 的「Settings → Pages」。
3. Source 選擇「GitHub Actions」。
4. 推送後，`Deploy MOS study to GitHub Pages` workflow 會自動建置與發布。

網站使用相對資源路徑，可同時支援 `username.github.io` 與 `username.github.io/repository-name/`。

## 3. 雙盲與資料安全

- 公開網站只有 P-xxx 顯示 ID，圖片檔名也已改成盲碼。
- `research_private/analysis-key.csv` 是研究者解盲主檔，已被 `.gitignore` 排除，請勿公開上傳。
- 不收姓名、Email、IP 或登入資訊。
- 若 endpoint 尚未設定，測試填答會下載匿名 JSON 備份；正式招募前務必完成 Google Sheet 測試。

## 4. 本機執行

需要 Node.js 22 與 pnpm 10 以上版本：

```bash
pnpm install
pnpm run dev
```

正式建置：

```bash
pnpm run build
```

## 5. 分析注意事項

- 順序以匿名參與者代碼為 seed 產生；重新整理或繼續未完成問卷時不會重新洗牌。
- 三張重複圖與原圖之間至少保留 8 個其他評分畫面，且重複圖彼此不相鄰。
- `sequence_version` 記錄隨機化演算法版本與 seed；每列的 `order` 與 `display_id` 可重建實際呈現順序。
- P-201 ↔ P-257、P-283 ↔ P-227、P-293 ↔ P-243 是 test–retest 配對。
- 先用 `analysis-key.csv` 依 `display_id` 解盲，再分別計算 appeal 與 naturalness。
- 新竹 `Lab_default_1.png` 的條件名稱有歧義；細節與上線前核對要求請見 `research_private/README.md`。

## 6. 雙工作表資料結構

- `MOS_participants`：每位受試者一行，包含背景資料、完成題數、平均分數、平均反應時間、重複題 MAE 與資料完整狀態。
- `MOS_ratings`：每張照片一行，只保留逐圖評分與呈現順序。
- 兩張表以相同的 `submission_id` 連結。
- `data_status = COMPLETE` 只代表收到 30 個不重複顯示 ID；重複題 MAE 的排除門檻仍應在查看研究結果前預先定義。
