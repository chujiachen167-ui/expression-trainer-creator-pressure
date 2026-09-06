const MAX_AUDIO_BYTES = 1_500_000;
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

function toAudioBytes(buffer) {
  // Workers AI's binding expects the encoded audio file as byte values.
  // A base64 string is valid for some REST APIs, but not for AI.run().
  return Array.from(new Uint8Array(buffer));
}

function serviceReady(env) {
  return env.WEB_STT_ENABLED === 'true' && env.AI && typeof env.AI.run === 'function';
}

export async function onRequestGet(context) {
  if (!serviceReady(context.env)) {
    return json({
      available: false,
      code: 'not-configured',
      message: '网页转写服务尚未启用。'
    }, 503);
  }
  return json({ available: true, engine: 'cloudflare-whisper', chunkMs: 3000 });
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
  const language = new URL(context.request.url).searchParams.get('lang') || 'zh';
  try {
    const result = await context.env.AI.run('@cf/openai/whisper', {
      audio: toAudioBytes(audio),
      language
    });
    return json({ text: String(result?.text || '').trim() });
  } catch (error) {
    const requestId = context.request.headers.get('cf-ray') || '';
    console.error('Cloudflare Whisper transcription failed', {
      requestId,
      contentType,
      audioBytes: audio.byteLength,
      error: error instanceof Error ? error.message : String(error)
    });
    return json({
      code: 'transcription-failed',
      message: '网页转写暂时失败，请稍后重试。',
      ...(requestId ? { requestId } : {})
    }, 502);
  }
}
