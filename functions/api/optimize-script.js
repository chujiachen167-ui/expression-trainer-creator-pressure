const MAX_TEXT_LENGTH = 6000;
const MAX_AI_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [150, 450];

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff'
    }
  });
}

function serviceReady(env) {
  return env.WEB_STT_ENABLED === 'true' && env.AI && typeof env.AI.run === 'function';
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function upstreamStatus(error) {
  const value = Number(error?.status || error?.cause?.status || 0);
  return Number.isFinite(value) ? value : 0;
}

function shouldRetry(error) {
  const status = upstreamStatus(error);
  if ([408, 409, 425, 429].includes(status) || status >= 500) return true;
  if (status >= 400) return false;
  return /capacity|timeout|temporar|rate|unavailable|internal|network|fetch/i.test(
    error instanceof Error ? error.message : String(error || '')
  ) || status === 0;
}

function messagesFor(text) {
  return [
    {
      role: 'system',
      content: `你是专业的中文口播稿编辑。把逐字稿整理成一份可以直接开口说的优化台词稿。

硬性规则：
1. 保留原意、立场和个人语气，不改变用户真正想表达的内容。
2. 删除口头禅、无效重复、识别残片和拖沓铺垫，修正明显语病。
3. 优先形成“开场钩子—核心观点—理由或例子—收束”的自然口播结构，但不要机械添加标题。
4. 绝不编造数据、经历、案例或产品事实；原文缺少必要事实时，用「[请补充：…]」标记。
5. 中文统一使用简体中文；保留确有必要的英文专有名词。
6. 只输出最终优化台词稿，不解释修改过程，不输出评分。`
    },
    { role: 'user', content: `请优化下面这份逐字稿：\n\n---\n${text}\n---` }
  ];
}

export async function onRequestPost(context) {
  if (!serviceReady(context.env)) {
    return json({ code: 'not-configured', message: '网页台词优化服务尚未启用。' }, 503);
  }
  const contentType = (context.request.headers.get('content-type') || '').toLowerCase().split(';')[0];
  if (contentType !== 'application/json') {
    return json({ code: 'unsupported-content', message: '请提交 JSON 格式的逐字稿。' }, 415);
  }
  const declaredSize = Number(context.request.headers.get('content-length') || 0);
  if (declaredSize > 30000) return json({ code: 'text-too-large', message: '逐字稿过长，请分段优化。' }, 413);

  let payload;
  try {
    payload = await context.request.json();
  } catch (_) {
    return json({ code: 'invalid-json', message: '逐字稿格式无效。' }, 400);
  }
  const text = String(payload?.text || '').trim();
  if (!text) return json({ code: 'empty-text', message: '请先录制或粘贴一段逐字稿。' }, 400);
  if (text.length > MAX_TEXT_LENGTH) return json({ code: 'text-too-large', message: '逐字稿过长，请分段优化。' }, 413);

  let lastError = null;
  let attempts = 0;
  for (attempts = 1; attempts <= MAX_AI_ATTEMPTS; attempts += 1) {
    try {
      const result = await context.env.AI.run('@cf/qwen/qwen3-30b-a3b-fp8', {
        messages: messagesFor(text),
        max_tokens: 2400,
        temperature: 0.3
      });
      const script = String(result?.response || result?.text || '').trim();
      if (!script) throw new Error('优化服务返回了空内容');
      return json({ script });
    } catch (error) {
      lastError = error;
      if (attempts >= MAX_AI_ATTEMPTS || !shouldRetry(error)) break;
      await wait(RETRY_DELAYS_MS[attempts - 1]);
    }
  }
  const requestId = context.request.headers.get('cf-ray') || '';
  console.error('Cloudflare script optimization failed', {
    requestId,
    attempts,
    upstreamStatus: upstreamStatus(lastError),
    error: lastError instanceof Error ? lastError.message : String(lastError)
  });
  return json({
    code: 'optimization-failed',
    message: '台词优化暂时失败，请稍后重试。',
    ...(requestId ? { requestId } : {})
  }, 502);
}
