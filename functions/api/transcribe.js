import { toSimplifiedChinese } from '../lib/opencc-t2s.js';

const MAX_AUDIO_BYTES = 1_500_000;
const MAX_AI_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [150, 450];
const CHUNK_MS = 2200;
const allowedContentTypes = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/mpeg', 'application/octet-stream'];

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

function toAudioBase64(buffer) {
  // whisper-large-v3-turbo's Workers AI binding expects base64-encoded audio.
  // Convert in bounded blocks so a browser-sized segment does not overflow the call stack.
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
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

function normalizedLanguage(value) {
  return String(value || '').toLowerCase().startsWith('en') ? 'en' : 'zh';
}

function expressionUnits(text) {
  return String(text || '').match(/[A-Za-z]+(?:'[A-Za-z]+)?|\d+(?:\.\d+)?|[\u3400-\u9fff]/g) || [];
}

function removeHallucinationLoops(text) {
  let removed = false;
  const cleaned = String(text || '').replace(
    /(^|[\s,，。！？!?:;、.\-])([A-Za-z]+|\d+(?:\.\d+)?|[\u3400-\u9fff])(?:\s*[\-,，。！？!?:;、.]*\s*\2){5,}/giu,
    (_, prefix) => {
      removed = true;
      return prefix;
    }
  );
  return { text: cleaned.replace(/(?:\s*[\-,，。！？!?:;、.]){2,}/g, ' ').trim(), removed };
}

const highRiskHallucinationPatterns = [
  /明镜与点点栏目/iu,
  /优优独播剧场|yoyo\s+television\s+series\s+exclusive/iu,
  /请不吝[^。！？!?]{0,80}(?:点赞|订阅)[^。！？!?]{0,80}(?:转发|打赏)/iu,
  /字幕(?:视听|視聴)[^。！？!?]{0,20}(?:谢谢|感謝)/iu,
  /未经许可[^。！？!?]{0,60}(?:翻唱|使用简体)/iu,
  /中文一律使用[^。！？!?]{0,40}简体中文|不使用简体中文|不要补写未说出的内容/iu
];

function containsHighRiskHallucination(text) {
  return highRiskHallucinationPatterns.some(pattern => pattern.test(String(text || '')));
}

function normalizeTranscript(input, language) {
  let text = String(input || '').replace(/\s+/g, ' ').trim();
  const changes = [];
  if (language === 'zh') {
    const simplified = toSimplifiedChinese(text);
    if (simplified !== text) changes.push('simplified-chinese');
    text = simplified;
    const withoutUnexpectedScripts = text.replace(/[\u3040-\u30ff\u31f0-\u31ff\uac00-\ud7af\u0400-\u04ff]+/g, ' ')
      .replace(/\s+/g, ' ').trim();
    if (withoutUnexpectedScripts !== text) changes.push('unexpected-script');
    text = withoutUnexpectedScripts;
  }
  if (containsHighRiskHallucination(text)) {
    return { text: '', filtered: true, filters: [...changes, 'known-hallucination'] };
  }
  const withoutSubtitleArtifacts = text
    .replace(/\s*(?:中文字幕志愿者|字幕志愿者)[：:\s]*[\p{L}\p{N}·.\s-]*$/giu, '')
    .replace(/\s*字幕由[^。！？!?]{0,80}(?:提供|制作)[。！？!?]?$/giu, '')
    .replace(/\s*(?:subtitles? by|captions? by|amara\.org)[^。！？!?]*$/giu, '')
    .replace(/\s*请不吝点赞订阅转发打赏支持[^。！？!?]*$/gu, '')
    .trim();
  if (withoutSubtitleArtifacts !== text) changes.push('subtitle-artifact');
  text = withoutSubtitleArtifacts;
  const loopResult = removeHallucinationLoops(text);
  if (loopResult.removed) changes.push('repetition-loop');
  text = loopResult.text;
  if (changes.includes('repetition-loop') && expressionUnits(text).length < 5) text = '';
  return { text, filtered: changes.length > 0, filters: changes };
}

function transcriptionOptions(audio, language) {
  return {
    audio,
    task: 'transcribe',
    language,
    vad_filter: true,
    condition_on_previous_text: false,
    no_speech_threshold: 0.35,
    compression_ratio_threshold: 2,
    log_prob_threshold: -0.5,
    hallucination_silence_threshold: 0.5
  };
}

export async function onRequestGet(context) {
  if (!serviceReady(context.env)) {
    return json({
      available: false,
      code: 'not-configured',
      message: '网页转写服务尚未启用。'
    }, 503);
  }
  return json({ available: true, engine: 'cloudflare-whisper-large-v3-turbo', chunkMs: CHUNK_MS });
}

export async function onRequestPost(context) {
  if (!serviceReady(context.env)) {
    return json({ code: 'not-configured', message: '网页转写服务尚未启用。' }, 503);
  }
  const contentType = (context.request.headers.get('content-type') || '').toLowerCase().split(';')[0];
  if (!allowedContentTypes.includes(contentType)) {
    return json({ code: 'unsupported-audio', message: '不支持当前浏览器输出的音频格式。' }, 415);
  }
  const declaredSize = Number(context.request.headers.get('content-length') || 0);
  if (declaredSize > MAX_AUDIO_BYTES) {
    return json({ code: 'audio-too-large', message: '单次转写音频过大，请缩短分段。' }, 413);
  }
  const audio = await context.request.arrayBuffer();
  if (!audio.byteLength || audio.byteLength > MAX_AUDIO_BYTES) {
    return json({ code: 'audio-too-large', message: '单次转写音频为空或过大。' }, 413);
  }
  const language = normalizedLanguage(new URL(context.request.url).searchParams.get('lang'));
  const audioBase64 = toAudioBase64(audio);
  let lastError = null;
  let attempts = 0;
  for (attempts = 1; attempts <= MAX_AI_ATTEMPTS; attempts += 1) {
    try {
      const result = await context.env.AI.run('@cf/openai/whisper-large-v3-turbo', transcriptionOptions(audioBase64, language));
      return json(normalizeTranscript(result?.text, language));
    } catch (error) {
      lastError = error;
      if (attempts >= MAX_AI_ATTEMPTS || !shouldRetry(error)) break;
      await wait(RETRY_DELAYS_MS[attempts - 1]);
    }
  }
  const requestId = context.request.headers.get('cf-ray') || '';
  console.error('Cloudflare Whisper transcription failed', {
    requestId,
    contentType,
    audioBytes: audio.byteLength,
    attempts,
    upstreamStatus: upstreamStatus(lastError),
    error: lastError instanceof Error ? lastError.message : String(lastError)
  });
  return json({
    code: 'transcription-failed',
    message: '网页转写暂时失败，请稍后重试。',
    ...(requestId ? { requestId } : {})
  }, 502);
}
