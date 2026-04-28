# 部署完整教學｜Medbeauty Content Checker

> 從零到上線，整個流程約 30 分鐘。完成後你會得到：
>
> - 一個放在 GitHub Pages 的稽核工具網頁
> - 一個放在 Cloudflare Workers 的後端 proxy（Anthropic API Key 藏在這裡）
> - 每日呼叫上限保護（預設 50 次／天）
> - 共用密碼保護（沒密碼的人打不到 API）

整體架構：

```
[使用者瀏覽器]                [GitHub Pages]            [Cloudflare Worker]         [Anthropic API]
  瀏覽器開網頁  ────────►  index.html (純靜態)
  填密碼 + 文章  ──────────────────────────────────────►  驗證密碼 + 檢查每日上限
                                                          代為呼叫 ────────────►  Claude
                                                          回傳結果  ◄────────────
  顯示稽核結果  ◄──────────────────────────────────────  回傳 + 剩餘額度
```

關鍵：你的 `ANTHROPIC_API_KEY` 只存在 Cloudflare Worker 的環境變數，前端永遠看不到。

---

## Part 1：把網頁部署到 GitHub Pages（約 5 分鐘）

### 1.1 上傳檔案

把這個資料夾的內容推上 GitHub repo。最少需要 `index.html`，其他文件檔可選。

如果你還沒建立 repo：

```bash
cd D:\lab\GITHUB\medbeauty-content-checker
git init
git add .
git commit -m "init: medbeauty content checker"
# 到 GitHub 建立一個 repo（例如名字也叫 medbeauty-content-checker）
git remote add origin https://github.com/你的帳號/medbeauty-content-checker.git
git branch -M main
git push -u origin main
```

### 1.2 開啟 GitHub Pages

1. 到 GitHub 你的 repo → **Settings** → 左側選單 **Pages**
2. **Source** 選 `Deploy from a branch`
3. **Branch** 選 `main`，資料夾選 `/ (root)`，按 **Save**
4. 等 1–2 分鐘，頁面上會出現網址：

   ```
   https://你的帳號.github.io/medbeauty-content-checker/
   ```

5. 點開來確認網頁能打開。**先別試 AI 檢測**，後端還沒部署。

### 1.3 記下這個網址

等等 Cloudflare Worker 的 `ALLOWED_ORIGIN` 會用到。範例：

```
https://your-name.github.io
```

⚠️ 注意只到 `.github.io`，不要含 `/medbeauty-content-checker/` 後面的 path。

---

## Part 2：部署 Cloudflare Worker（約 15 分鐘）

> 不需要安裝 wrangler CLI，全程用網頁操作。

### 2.1 註冊 Cloudflare 帳號

1. 到 https://dash.cloudflare.com/sign-up 註冊（免費）
2. 信箱驗證後登入

### 2.2 建立 Worker

1. 左側選單 → **Compute (Workers)** → **Workers & Pages**
   （新版介面可能叫 **Workers & Pages** 或 **Compute**）
2. 點 **Create**（或 **Create Worker**）
3. 給 Worker 命名，例如 `medbeauty-audit-proxy`
   - Cloudflare 會自動配 subdomain，最終網址會是：
     `https://medbeauty-audit-proxy.你的帳號.workers.dev`
4. 點 **Deploy**（先用預設範本部署，下一步再改）

### 2.3 把 worker.js 內容貼進去

1. 部署完成後 → 點 **Edit code**
2. 把編輯器裡的預設內容**全選刪除**
3. 打開本專案的 `worker/worker.js`，**全部複製**貼進去
4. 點右上角 **Deploy**

### 2.4 設定環境變數（最重要！）

回到 Worker 主頁 → **Settings** → **Variables and Secrets**

新增以下 4 個變數：

| 變數名稱            | 類型     | 值                                      | 說明 |
|---------------------|----------|-----------------------------------------|------|
| `ANTHROPIC_API_KEY` | Secret   | `sk-ant-api03-xxxxx...`                 | 你的 Anthropic Key（在 https://console.anthropic.com 取得） |
| `ACCESS_PASSWORD`   | Secret   | 自己想一組密碼，例如 `med-audit-2026`  | 給使用者輸入用，可隨時改 |
| `DAILY_LIMIT`       | Text     | `50`                                    | 每日總呼叫上限 |
| `ALLOWED_ORIGIN`    | Text     | `https://你的帳號.github.io`            | Part 1.3 記下的網址 |

**注意：**
- 「Secret」類型存進去後就看不到內容，要改的話只能重新設值
- `ALLOWED_ORIGIN` 在測試階段可以先填 `*`（不限），確認可用後再改回正式網址
- 設完每個變數記得按 **Save**

### 2.5 取得 Worker 網址

Worker 主頁可以看到網址，類似：

```
https://medbeauty-audit-proxy.你的帳號.workers.dev
```

記下這個網址。

### 2.6 測試後端通不通

直接用瀏覽器打開 Worker 網址（GET），應該看到：

```json
{
  "ok": true,
  "service": "medbeauty-content-checker proxy",
  "quota": { "used": 0, "limit": 50, "remaining": 50 }
}
```

看到這個就代表 Worker 成功跑起來了。

---

## Part 3：把前端串到後端

### 3.1 打開你的 GitHub Pages 網址

```
https://你的帳號.github.io/medbeauty-content-checker/
```

### 3.2 進入設定

1. 右上角點 **⚙ 設定**
2. 展開 **AI 模型設定**
3. **連線模式** 選 `Proxy 模式（推薦）`
4. **Proxy URL** 填入你的 Worker 網址（Part 2.5）
5. **使用密碼** 填 `ACCESS_PASSWORD` 設定的值（Part 2.4）
6. 模型名稱保持 `claude-sonnet-4-5`
7. 點 **💾 儲存**

設定畫面下方會顯示「📊 今日 AI 用量：已使用 0 / 50 次」，這代表前後端串通了。

### 3.3 測試一篇文章

1. 點工具列的 **📝 範例文章**（會載入一篇刻意違規的範例）
2. 點 **✨ AI 智慧檢測**
3. 等 10–30 秒，右側「AI 建議」分頁會出現完整稽核報告
4. 同時頁面右上會更新今日已用次數

---

## Part 4：把工具交給使用者

使用者需要的東西只有兩個：

1. 網址：`https://你的帳號.github.io/medbeauty-content-checker/`
2. 密碼：你在 `ACCESS_PASSWORD` 設的那組

使用者第一次使用：
1. 開網頁 → ⚙ 設定 → 確認模式是 **Proxy 模式**
2. Proxy URL 一般你已經在公司的版本預先填好（或請使用者複製貼上）
3. 填密碼 → 儲存
4. 之後就直接貼文章 → AI 檢測

> 💡 想讓使用者連 Proxy URL 都不用填？可以把 `index.html` 第 332 行附近的預設值寫死：
>
> ```js
> proxyUrl: 'https://medbeauty-audit-proxy.你的帳號.workers.dev',
> ```
>
> 這樣使用者只要填密碼就好。

---

## Part 5：日常維運

### 改密碼
Cloudflare Worker → Settings → Variables → 編輯 `ACCESS_PASSWORD` → 通知使用者更新。

### 改每日上限
編輯 `DAILY_LIMIT` 即可（不必重新部署，Worker 會即時讀新值）。

### 查看用量
- **每日剩餘額度**：直接打 Worker 網址（GET），會看到 JSON
- **完整呼叫日誌**：Cloudflare Dashboard → Worker → **Logs** 即時查看
- **Anthropic 端帳單**：https://console.anthropic.com/settings/usage

### 建議：在 Anthropic Console 也設一個月上限
即使 Cloudflare 端有日上限，建議在 Anthropic Console → Settings → Limits 也設一個 monthly spend cap，雙重保險防止意外帳單。

### 想升級到更精準的計數
目前 daily counter 用 Cloudflare Cache API。對單人使用足夠精準。如果未來給多人用、或希望跨地區嚴格同步，改用 Workers KV 更穩定（需在 Worker Settings → Bindings 綁一個 KV namespace，並改寫 worker.js 的 `readCounter` / `incrementCounter` 兩個函式）。

---

## 常見問題

**Q1：為什麼不能直接把 API Key 寫死在 index.html？**
GitHub Pages 是公開靜態檔案，任何人 F12 看 source 都能偷走。被人撿到 key 之後，幾小時內就可以燒掉幾千美金。**絕對不可以**。

**Q2：為什麼選 Cloudflare 不選 AWS / Vercel？**
- Cloudflare Workers **免費 100,000 次／天**，這個工具一輩子打不完
- 不用信用卡（免費方案）
- 全球 CDN，台灣連線速度極快
- 部署 5 分鐘，比 AWS Lambda 簡單 10 倍

**Q3：使用者忘記密碼？**
你在 Cloudflare 改 `ACCESS_PASSWORD` → 通知對方更新瀏覽器設定。

**Q4：Worker 突然 500 錯誤？**
- 進 Cloudflare Dashboard → Worker → **Logs**（即時 console），看錯誤訊息
- 90% 的問題是環境變數沒設好，或 `ANTHROPIC_API_KEY` 過期/沒額度

**Q5：CORS 錯誤？**
檢查 `ALLOWED_ORIGIN` 是否完全等於你 GitHub Pages 的 origin（含 `https://`，不含 path）。
測試階段可暫時設 `*`。

**Q6：成本估算？**
- Cloudflare Workers：免費（你不可能打超過 10 萬次／天）
- Anthropic Claude Sonnet 4.5：約 NT$0.5 ~ NT$2 / 篇（依文章長度）
- 一個月跑 1500 篇文章成本大概 NT$1000 上下

---

## 快速 Checklist

部署前確認：

- [ ] GitHub repo 已建立，`index.html` 已上傳
- [ ] GitHub Pages 已開啟，網址可以打開
- [ ] Cloudflare 帳號已註冊
- [ ] Worker 已建立並貼上 `worker/worker.js` 程式碼
- [ ] 4 個環境變數都設好（`ANTHROPIC_API_KEY` / `ACCESS_PASSWORD` / `DAILY_LIMIT` / `ALLOWED_ORIGIN`）
- [ ] 用瀏覽器打開 Worker URL（GET），看到 `{"ok":true,...}`
- [ ] 前端設定面板填好 Proxy URL + 密碼
- [ ] 跑一次 AI 檢測成功，今日用量數字 +1
