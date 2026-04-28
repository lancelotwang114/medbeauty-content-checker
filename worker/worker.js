/**
 * Medbeauty Content Checker — Anthropic API Proxy
 * --------------------------------------------------
 * 部署到 Cloudflare Workers（免費方案即可）。
 *
 * 功能：
 *   1. 把你的 Anthropic API Key 藏在後端，前端永遠看不到。
 *   2. 共用密碼（ACCESS_PASSWORD）驗證，沒密碼的人打不到 API。
 *   3. 每日呼叫上限（DAILY_LIMIT），超過自動回 429。
 *   4. CORS 限制只接受指定來源（ALLOWED_ORIGIN）。
 *
 * 在 Cloudflare Worker 的 Settings → Variables and Secrets 設這些：
 *   ANTHROPIC_API_KEY  Secret  — 你的 Anthropic API Key (sk-ant-...)
 *   ACCESS_PASSWORD    Secret  — 共用密碼（你發給使用者）
 *   DAILY_LIMIT        Text    — 每日呼叫上限（例如 50）
 *   ALLOWED_ORIGIN     Text    — 你的 GitHub Pages 網址
 *                                例如 https://your-name.github.io
 *                                若填 * 則不限來源（不建議）
 *
 * 注意：daily counter 用 Cloudflare Cache API 儲存，
 * 對單人使用足夠精準。若要嚴格跨邊緣節點同步，可改用 Workers KV。
 */

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-sonnet-4-5';
const DEFAULT_MAX_TOKENS = 2500;

export default {
  async fetch(request, env, ctx) {
    const corsOrigin = env.ALLOWED_ORIGIN || '*';

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(corsOrigin) });
    }

    // 健康檢查 / 配額查詢（GET）
    if (request.method === 'GET') {
      const dailyLimit = parseInt(env.DAILY_LIMIT || '50', 10);
      const used = await readCounter();
      return json({
        ok: true,
        service: 'medbeauty-content-checker proxy',
        quota: { used, limit: dailyLimit, remaining: Math.max(0, dailyLimit - used) }
      }, 200, corsOrigin);
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405, corsOrigin);
    }

    // 解析 body
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return json({ error: 'Invalid JSON' }, 400, corsOrigin);
    }

    // 後端設定檢查
    if (!env.ACCESS_PASSWORD) {
      return json({ error: 'Server not configured: ACCESS_PASSWORD missing' }, 500, corsOrigin);
    }
    if (!env.ANTHROPIC_API_KEY) {
      return json({ error: 'Server not configured: ANTHROPIC_API_KEY missing' }, 500, corsOrigin);
    }

    // 密碼驗證
    if (body.password !== env.ACCESS_PASSWORD) {
      return json({ error: '密碼錯誤或未提供' }, 401, corsOrigin);
    }

    // 每日上限
    const dailyLimit = parseInt(env.DAILY_LIMIT || '50', 10);
    let count = await readCounter();
    if (count >= dailyLimit) {
      return json({
        error: `今日 AI 檢測已達上限（${dailyLimit} 次），請明日再試。`,
        quota: { used: count, limit: dailyLimit, remaining: 0 }
      }, 429, corsOrigin);
    }

    // 文章長度保護（避免一次燒太多 token）
    const userContent = String(body.user || '');
    if (userContent.length > 12000) {
      return json({
        error: `文章內容過長（${userContent.length} 字元），請拆段或縮減後再試（上限 12000 字元）。`
      }, 413, corsOrigin);
    }

    // 呼叫 Anthropic
    const anthropicReq = {
      model: body.model || DEFAULT_MODEL,
      max_tokens: Math.min(parseInt(body.max_tokens, 10) || DEFAULT_MAX_TOKENS, 4000),
      system: String(body.system || ''),
      messages: [{ role: 'user', content: userContent }]
    };

    let anthropicResp;
    try {
      anthropicResp = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': ANTHROPIC_VERSION
        },
        body: JSON.stringify(anthropicReq)
      });
    } catch (e) {
      return json({ error: 'Anthropic 連線失敗：' + e.message }, 502, corsOrigin);
    }

    if (!anthropicResp.ok) {
      const errText = await anthropicResp.text();
      return json({
        error: `Anthropic API 錯誤 ${anthropicResp.status}：${errText.slice(0, 500)}`
      }, anthropicResp.status, corsOrigin);
    }

    const data = await anthropicResp.json();
    const text = data.content?.[0]?.text || '（無內容）';

    // 成功才計數
    count = await incrementCounter(count);
    ctx.waitUntil(Promise.resolve());

    return json({
      text,
      usage: data.usage,
      quota: { used: count, limit: dailyLimit, remaining: Math.max(0, dailyLimit - count) }
    }, 200, corsOrigin);
  }
};

/* ============ 每日計數（用 Cloudflare Cache API） ============ */
function counterKey() {
  // 以 UTC+8（台北時區）切日，避免使用者半夜被 reset
  const now = new Date(Date.now() + 8 * 3600 * 1000);
  const today = now.toISOString().slice(0, 10);
  return `https://counter.local/${today}`;
}

async function readCounter() {
  const cached = await caches.default.match(counterKey());
  if (!cached) return 0;
  const txt = await cached.text();
  return parseInt(txt, 10) || 0;
}

async function incrementCounter(currentCount) {
  const next = currentCount + 1;
  await caches.default.put(counterKey(), new Response(String(next), {
    headers: { 'Cache-Control': 'public, max-age=86400' }
  }));
  return next;
}

/* ============ 工具 ============ */
function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function json(obj, status, origin) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...corsHeaders(origin)
    }
  });
}
