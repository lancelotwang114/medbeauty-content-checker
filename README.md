# Medbeauty Content Checker｜醫美文章稽核工具

A lightweight, single-file web tool for SEO / marketing teams to audit medical-aesthetics articles before publishing.
專為醫美 SEO / 行銷團隊設計的單檔網頁工具，用於上稿前的禁字、通順度、SEO 結構與 AI 智慧審閱。

> **Live demo:** https://<your-github-username>.github.io/medbeauty-content-checker/

---

## ✨ 功能特色 Features

- **禁字檢測** — 內建六大分類示範清單（誇大療效、醫療宣稱、副作用宣稱、未核可功效詞等），可自訂、匯入/匯出 JSON。
- **通順度規則檢查** — 偵測過長句、連續重字、重複用詞、標點異常、中英夾雜未空格、段落過長。
- **SEO 結構分析** — 標題長度、字數區間、關鍵字密度、段落分布、小標、CTA 行動呼籲。
- **AI 智慧審閱** — 串接 Anthropic Claude 或 OpenAI GPT，做語意層違規偵測 + 通順度評分 + 改寫建議。
- **資料保存於本機** — API Key 與禁字清單只存於瀏覽器 localStorage，不上傳任何伺服器。
- **單檔部署** — 一個 `index.html` 即完成，可放 GitHub Pages、公司內網、Notion 附檔、Google Drive。

---

## 🚀 部署到 GitHub Pages

1. 在 GitHub 建立一個 repo，命名為 `medbeauty-content-checker`（或其他你喜歡的名稱）。
2. 把 `index.html` 與本 `README.md` 上傳到 repo 根目錄。
3. 進入 repo → **Settings** → **Pages**。
4. 在 **Source** 選擇 `Deploy from a branch`，**Branch** 選 `main` / `(root)`，按 Save。
5. 等 1–2 分鐘，重新整理該頁，會出現網址：`https://<your-username>.github.io/medbeauty-content-checker/`
6. 將網址分享給團隊即可使用。

> 若希望網址不公開可被搜尋，建議開設 **Private repo + GitHub Pages（需付費方案）**，或部署在公司內網。

---

## 🔐 API Key 安全性說明

此工具直接從瀏覽器呼叫 LLM API，金鑰存在使用者本機 localStorage。
若多人使用同一台電腦或擔心金鑰外洩，建議：

- 每位編輯使用自己的個人 API Key（OpenAI 可設用量上限）。
- 或自行架設 proxy backend（如 Cloudflare Workers）統一中介金鑰，前端只呼叫 proxy。

---

## 📝 使用流程

1. 第一次使用 → 點 **⚙ 設定** → 填入 API Key → 視需要修改禁字清單 → 儲存。
2. 把員工寫的文章貼到左側 → 規則檢查會即時跑（停手 0.5 秒後）。
3. 右側分頁切換查看：禁字、通順度、SEO、標記預覽、AI 建議。
4. 需要 AI 二次審閱時點 **✨ AI 智慧檢測**。

---

## 🛠 自訂禁字清單格式

設定面板的禁字 textarea 採以下格式：

```
== 絕對禁用 (誇大療效) ==
療效
根治
100%

== 醫療宣稱用語 ==
治療
治癒
```

以 `== 分類名稱 ==` 起頭代表新增分類。
分類名稱包含「絕對 / 禁用 / 不可 / 重大 / 療效」會被視為高嚴重度（紅色），其餘為中嚴重度（黃色）。

匯入 JSON 格式：

```json
{
  "絕對禁用 (誇大療效)": ["療效", "根治", "100%"],
  "醫療宣稱用語": ["治療", "治癒"]
}
```

---

## 🧱 技術細節

- 純 HTML + Vanilla JS，零依賴、零打包。
- 約 700 行單檔，可離線執行（除 AI 檢測需要網路）。
- 支援 Anthropic Messages API 與 OpenAI Chat Completions API。
- LocalStorage key：`medAuditTool_v1`。

---

## 📄 License

MIT — 內部使用、二次開發、商用皆可。
