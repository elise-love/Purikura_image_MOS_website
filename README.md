# Photo Booth 人類 MOS 評分網站

這是一個可部署到 GitHub Pages 的匿名、雙盲、5 分制 ACR 評分網站。網站包含 27 張正式刺激圖、3 張一致性重複與 1 個注意力檢核，並將參與者平均分派到正序／反序兩個平衡版本。

## 1. 先連接 Google 試算表

GitHub Pages 本身不能接收資料，因此本專案用 Google Apps Script 把匿名結果寫入 Google Sheet。

1. 新增一份 Google 試算表。
2. 開啟「擴充功能 → Apps Script」。
3. 把 `google-apps-script/Code.gs` 全部貼進編輯器並儲存。
4. 按「部署 → 新增部署作業 → 網頁應用程式」。
5. 執行身分選「我」，誰可以存取選「任何人」。
6. 複製部署後的 `/exec` 網址，貼進 `config.js` 的 `endpoint`。
7. 先完整試填一次，確認試算表自動出現 `MOS_responses` 工作表與 31 筆資料列。

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

- 排除 P-210 注意力檢核後再計算 MOS。
- P-201 ↔ P-257、P-283 ↔ P-227、P-293 ↔ P-243 是 test–retest 配對。
- 先用 `analysis-key.csv` 依 `display_id` 解盲，再分別計算 appeal 與 naturalness。
- 新竹 `Lab_default_1.png` 的條件名稱有歧義；細節與上線前核對要求請見 `research_private/README.md`。
