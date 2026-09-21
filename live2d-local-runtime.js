/** Local Live2D pixel runtime. Proprietary Core and the locally built official
 *  Cubism Web Framework bridge are never bundled. Any failure restores SVG.
 */
(() => {
  const CORE_SRC = 'local-runtime/live2dcubismcore.min.js';
  const FRAMEWORK_SRC = 'local-runtime/live2d-framework-bridge.js';
  const STATES = ['listen', 'confused', 'interest', 'drop'];
  const STATE_ALIASES = {
    listen: ['listen', 'idle', 'default', 'normal', 'neutral', 'rest', '平常', '默认', '在听', '平静'],
    confused: ['confused', 'confuse', 'question', 'doubt', 'wonder', 'think', '疑问', '困惑', '没跟上', '思考'],
    interest: ['interest', 'smile', 'happy', 'joy', 'laugh', 'pleased', 'excited', 'fun', '笑', '兴趣', '开心', '高兴'],
    drop: ['drop', 'sad', 'bored', 'sleep', 'angry', 'unimpressed', 'tired', '无语', '无聊', '注意力', '失落']
  };
  const MOTION_ALIASES = {
    listen: ['idle', 'listen', 'default', 'rest', '平常', '待机'],
    confused: ['confused', 'tapbody', 'tap_body', 'hit', 'question', 'doubt', '没跟上', '困惑'],
    interest: ['interest', 'smile', 'happy', 'taphead', 'flick', '兴趣', '开心'],
    drop: ['drop', 'sad', 'bored', 'sleep', 'flickdown', '注意力', '失落']
  };
  const STANDARD_REACTION = {
    listen: {},
    confused: {
      ParamAngleZ: 14, ParamAngleX: -10, ParamBrowLY: -0.7, ParamBrowRY: 0.55,
      ParamEyeLOpen: 0.72, ParamEyeROpen: 0.88, ParamMouthForm: -0.25
    },
    interest: {
      ParamAngleY: 8, ParamEyeLSmile: 0.85, ParamEyeRSmile: 0.85, ParamMouthForm: 0.9,
      ParamBrowLY: 0.3, ParamBrowRY: 0.3, ParamEyeLOpen: 1, ParamEyeROpen: 1
    },
    drop: {
      ParamAngleY: -16, ParamBodyAngleY: -8, ParamEyeLOpen: 0.28, ParamEyeROpen: 0.28,
      ParamMouthForm: -0.7, ParamBrowLY: -0.45, ParamBrowRY: -0.45
    }
  };
  const SEG_LINEAR = 0;
  const SEG_BEZIER = 1;
  const SEG_STEPPED = 2;
  const SEG_INV_STEPPED = 3;
  const FINGERPRINT_IDS = ['ParamAngleX', 'ParamAngleY', 'ParamAngleZ', 'ParamEyeLOpen', 'ParamMouthForm', 'ParamBrowLY'];
  const VISIBLE = 1;
  const BLEND_ADDITIVE = 1;
  const BLEND_MULTIPLY = 2;
  const INVERTED_MASK = 8;
  let coreLoad;
  let frameworkLoad;

  function isProduction() {
    return typeof document !== 'undefined' && document.body?.dataset.environment === 'production';
  }

  function detectWebGL(factory) {
    if (typeof document === 'undefined') return false;
    try {
      const canvas = document.createElement('canvas');
      const gl = factory
        ? factory(canvas)
        : canvas.getContext('webgl2', { alpha: true }) || canvas.getContext('webgl', { alpha: true }) || canvas.getContext('experimental-webgl', { alpha: true });
      return Boolean(gl);
    } catch (_) {
      return false;
    }
  }

  function findAlias(names, aliases) {
    return names.find(item => {
      const lower = String(item || '').toLowerCase().replace(/[\s_-]+/g, '');
      return aliases.some(alias => {
        const token = String(alias).toLowerCase().replace(/[\s_-]+/g, '');
        return lower === token || lower.includes(token);
      });
    }) || null;
  }

  function mapGroups(manifest) {
    const groups = { EyeBlink: [], LipSync: [] };
    const listed = Array.isArray(manifest?.Groups) ? manifest.Groups : [];
    listed.forEach(group => {
      if (!group || typeof group.Name !== 'string' || !Array.isArray(group.Ids)) return;
      groups[group.Name] = group.Ids.filter(id => typeof id === 'string');
    });
    return groups;
  }

  function mapFourStates(manifest, expressions = {}, motions = {}) {
    const listed = [];
    const refs = manifest && typeof manifest === 'object' ? manifest.FileReferences : null;
    const items = refs && Array.isArray(refs.Expressions) ? refs.Expressions : [];
    items.forEach(item => {
      const name = item && typeof item.Name === 'string' ? item.Name : '';
      if (name) listed.push(name);
    });
    Object.keys(expressions).forEach(name => {
      if (name && !listed.includes(name)) listed.push(name);
    });
    const motionGroups = Object.keys(motions || {});
    const mapped = {};
    STATES.forEach(state => {
      const aliases = STATE_ALIASES[state];
      const name = findAlias(listed, aliases);
      const motionGroup = findAlias(motionGroups, MOTION_ALIASES[state] || aliases);
      const clips = motionGroup && Array.isArray(motions[motionGroup]) ? motions[motionGroup] : [];
      mapped[state] = {
        name,
        expression: name ? expressions[name] || null : null,
        fallback: !name,
        motionGroup,
        motion: clips[0] || null
      };
    });
    return mapped;
  }

  function clamp01(value) {
    return value < 0 ? 0 : value > 1 ? 1 : value;
  }

  function cardanoForBezier(a, b, c, d) {
    const epsilon = 1e-5;
    if (Math.abs(a) < epsilon) {
      if (Math.abs(b) < epsilon) return clamp01(Math.abs(c) < epsilon ? -d : -c === 0 ? -d : -d / c);
      return clamp01(-(c + Math.sqrt(Math.max(0, c * c - 4 * b * d))) / (2 * b));
    }
    const ba = b / a;
    const ca = c / a;
    const da = d / a;
    const p = (3 * ca - ba * ba) / 3;
    const p3 = p / 3;
    const q = (2 * ba * ba * ba - 9 * ba * ca + 27 * da) / 27;
    const q2 = q / 2;
    const discriminant = q2 * q2 + p3 * p3 * p3;
    const center = 0.5;
    const threshold = 0.51;
    if (discriminant < 0) {
      const mp3 = -p / 3;
      const r = Math.sqrt(Math.max(0, mp3 * mp3 * mp3));
      const phi = Math.acos(Math.max(-1, Math.min(1, -q / (2 * r))));
      const t1 = 2 * Math.cbrt(r);
      const root1 = t1 * Math.cos(phi / 3) - ba / 3;
      if (Math.abs(root1 - center) < threshold) return clamp01(root1);
      const root2 = t1 * Math.cos((phi + 2 * Math.PI) / 3) - ba / 3;
      if (Math.abs(root2 - center) < threshold) return clamp01(root2);
      return clamp01(t1 * Math.cos((phi + 4 * Math.PI) / 3) - ba / 3);
    }
    if (discriminant === 0) {
      const u1 = q2 < 0 ? Math.cbrt(-q2) : -Math.cbrt(q2);
      const root1 = 2 * u1 - ba / 3;
      if (Math.abs(root1 - center) < threshold) return clamp01(root1);
      return clamp01(-u1 - ba / 3);
    }
    const sd = Math.sqrt(discriminant);
    return clamp01(Math.cbrt(sd - q2) - Math.cbrt(sd + q2) - ba / 3);
  }

  function lerpPoint(a, b, t) {
    return { time: a.time + (b.time - a.time) * t, value: a.value + (b.value - a.value) * t };
  }

  function bezierValue(points, time) {
    const a = points[3].time - 3 * points[2].time + 3 * points[1].time - points[0].time;
    const b = 3 * points[2].time - 6 * points[1].time + 3 * points[0].time;
    const c = 3 * points[1].time - 3 * points[0].time;
    const d = points[0].time - time;
    const t = cardanoForBezier(a, b, c, d);
    const p01 = lerpPoint(points[0], points[1], t);
    const p12 = lerpPoint(points[1], points[2], t);
    const p23 = lerpPoint(points[2], points[3], t);
    return lerpPoint(lerpPoint(p01, p12, t), lerpPoint(p12, p23, t), t).value;
  }

  function parseMotionSegments(segments) {
    if (!Array.isArray(segments) || segments.length < 2) return [];
    const points = [{ time: Number(segments[0]) || 0, value: Number(segments[1]) || 0 }];
    const segs = [];
    let index = 2;
    while (index < segments.length) {
      const type = Number(segments[index]);
      index += 1;
      if (type === SEG_BEZIER) {
        const controlA = { time: Number(segments[index]) || 0, value: Number(segments[index + 1]) || 0 };
        const controlB = { time: Number(segments[index + 2]) || 0, value: Number(segments[index + 3]) || 0 };
        const end = { time: Number(segments[index + 4]) || 0, value: Number(segments[index + 5]) || 0 };
        index += 6;
        segs.push({ type, points: [points[points.length - 1], controlA, controlB, end] });
        points.push(end);
      } else {
        const end = { time: Number(segments[index]) || 0, value: Number(segments[index + 1]) || 0 };
        index += 2;
        segs.push({ type, points: [points[points.length - 1], end] });
        points.push(end);
      }
    }
    return segs;
  }

  function evaluateSegments(segments, time) {
    const segs = parseMotionSegments(segments);
    if (!segs.length) return 0;
    const first = segs[0].points[0];
    if (time <= first.time) return first.value;
    for (const seg of segs) {
      const end = seg.points[seg.points.length - 1];
      if (time > end.time) continue;
      if (seg.type === SEG_STEPPED) return seg.points[0].value;
      if (seg.type === SEG_INV_STEPPED) return end.value;
      if (seg.type === SEG_BEZIER) return bezierValue(seg.points, time);
      const start = seg.points[0];
      const span = end.time - start.time;
      const t = span <= 0 ? 1 : (time - start.time) / span;
      return start.value + (end.value - start.value) * t;
    }
    return segs[segs.length - 1].points[segs[segs.length - 1].points.length - 1].value;
  }

  function evaluateMotion(motionJson, timeSeconds) {
    const meta = motionJson && typeof motionJson === 'object' ? motionJson.Meta || {} : {};
    const duration = Number(meta.Duration) || 0;
    const loop = meta.Loop === true;
    let time = Number(timeSeconds) || 0;
    if (time < 0) time = 0;
    if (duration > 0 && loop) time = time % duration;
    else if (duration > 0) time = Math.min(time, duration);
    const values = {};
    const parts = {};
    const curves = Array.isArray(motionJson?.Curves) ? motionJson.Curves : [];
    curves.forEach(curve => {
      if (!curve || typeof curve.Id !== 'string') return;
      const value = evaluateSegments(curve.Segments, time);
      if (curve.Target === 'PartOpacity') parts[curve.Id] = value;
      else if (curve.Target !== 'Model') values[curve.Id] = value;
    });
    return {
      values,
      parts,
      duration,
      loop,
      time,
      finished: duration > 0 && !loop && (Number(timeSeconds) || 0) >= duration
    };
  }

  function blinkOpen(clock, reduced) {
    if (reduced) return 1;
    const cycle = (Number(clock) || 0) % 4.2;
    if (cycle < 0.1) return 1 - cycle / 0.1;
    if (cycle < 0.15) return 0;
    if (cycle < 0.3) return (cycle - 0.15) / 0.15;
    return 1;
  }

  function breathValues(clock, reduced) {
    if (reduced) return {};
    const time = Number(clock) || 0;
    return {
      ParamBreath: 0.5 + 0.5 * Math.sin(time * 1.4),
      ParamBodyAngleX: 0.35 * Math.sin(time * 0.65)
    };
  }

  function stateFingerprint(values = {}) {
    return FINGERPRINT_IDS.map(id => `${id}:${Number(values[id] || 0).toFixed(3)}`).join('|');
  }

  function prefersReducedMotion(media = null) {
    try {
      return Boolean((media || (typeof window !== 'undefined' ? window.matchMedia?.('(prefers-reduced-motion: reduce)') : null))?.matches);
    } catch (_) {
      return false;
    }
  }

  function pickMotion(state, mapping, motions) {
    const mapped = mapping?.[state];
    if (mapped?.motion) return mapped.motion;
    if (state !== 'listen') return null;
    const idle = motions?.Idle || motions?.idle || [];
    return idle[0] || null;
  }

  function createLive2DDirector(assets = {}, options = {}) {
    const motions = assets.motions || {};
    const groups = assets.groups || mapGroups(assets.manifest);
    const mapping = assets.mapping || mapFourStates(assets.manifest, assets.expressions, motions);
    let state = 'listen';
    let motionTime = 0;
    let clock = 0;
    let reduced = Boolean(options.reducedMotion);
    let currentMotion = pickMotion(state, mapping, motions);
    let draws = 0;
    let last = {
      time: 0, dt: 0, state, values: {}, parts: {}, motionFile: currentMotion?.file || null,
      motionTime: 0, reduced, drawIndex: 0, updated: false, lipSyncDriven: false, fingerprint: stateFingerprint({})
    };

    function setReducedMotion(value) {
      reduced = Boolean(value);
    }

    function setExpression(next) {
      const resolved = STATES.includes(next) ? next : 'listen';
      const interrupted = state !== 'listen' && resolved !== state;
      state = resolved;
      motionTime = 0;
      currentMotion = pickMotion(state, mapping, motions);
      return {
        state,
        interrupted,
        motionFile: currentMotion?.file || null,
        expression: mapping[state]?.name || null,
        usesStandardParameters: Boolean(STANDARD_REACTION[state] && Object.keys(STANDARD_REACTION[state]).length)
      };
    }

    function tick(dt) {
      const delta = Math.max(0, Math.min(Number(dt) || 0, 0.1));
      clock += delta;
      motionTime += delta;
      const values = {};
      const parts = {};
      let motionResult = null;
      if (currentMotion?.json && !reduced) {
        motionResult = evaluateMotion(currentMotion.json, motionTime);
        Object.assign(values, motionResult.values);
        Object.assign(parts, motionResult.parts);
        if (motionResult.finished && state === 'listen') motionTime = 0;
      } else if (!reduced && state === 'listen') {
        Object.assign(values, breathValues(clock, false));
      }
      const blinkIds = Array.isArray(groups.EyeBlink) ? groups.EyeBlink : [];
      const motionOwnsBlink = blinkIds.some(id => Object.hasOwn(values, id));
      if (!reduced && blinkIds.length && !motionOwnsBlink) {
        const open = blinkOpen(clock, false);
        blinkIds.forEach(id => { values[id] = open; });
      }
      const recipe = STANDARD_REACTION[state] || {};
      if (state !== 'listen' && !mapping[state]?.expression) {
        Object.entries(recipe).forEach(([id, value]) => { values[id] = value; });
      }
      draws += 1;
      last = {
        time: clock,
        dt: delta,
        state,
        values,
        parts,
        motionFile: currentMotion?.file || null,
        motionTime,
        reduced,
        drawIndex: draws,
        updated: true,
        lipSyncDriven: false,
        physicsJson: Boolean(assets.physicsJson || assets.physicsBytes),
        fingerprint: stateFingerprint(values)
      };
      return last;
    }

    return {
      setExpression,
      setReducedMotion,
      tick,
      snapshot: () => last,
      getState: () => state,
      mapping
    };
  }

  function createFrameLoop(options = {}) {
    const raf = options.requestAnimationFrame
      || (typeof requestAnimationFrame === 'function' ? requestAnimationFrame.bind(typeof window !== 'undefined' ? window : globalThis) : null);
    const caf = options.cancelAnimationFrame
      || (typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame.bind(typeof window !== 'undefined' ? window : globalThis) : null);
    const now = options.now || (() => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()));
    let id = 0;
    let running = false;
    let last = 0;
    let frames = 0;
    let starts = 0;

    function step(stamp) {
      if (!running) return;
      if (options.isPaused?.() === true) {
        last = 0;
        id = raf ? raf(step) : 0;
        return;
      }
      const current = stamp || now();
      const dt = last ? Math.min(0.1, Math.max(0, (current - last) / 1000)) : 1 / 60;
      last = current;
      frames += 1;
      try { options.step(dt); }
      catch (error) {
        stop();
        options.onError?.(error);
        return;
      }
      id = raf ? raf(step) : 0;
    }

    function start() {
      if (running) return stats();
      running = true;
      starts += 1;
      last = now();
      id = raf ? raf(step) : 0;
      return stats();
    }

    function stop() {
      running = false;
      if (id && caf) caf(id);
      id = 0;
      last = 0;
    }

    function stats() {
      return { running, id, starts, frames };
    }

    return { start, stop, isRunning: () => running, stats };
  }

  function resolveRef(modelFile, relative, validator) {
    const cleaned = validator.cleanRelativePath(relative);
    if (!cleaned) return null;
    const directory = String(modelFile || '').includes('/') ? String(modelFile).split('/').slice(0, -1).join('/') : '';
    return validator.joinRelativePath(directory, cleaned);
  }

  function copyBytes(bytes) {
    const source = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
    return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
  }

  function decodeJson(bytes) {
    return JSON.parse(new TextDecoder().decode(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || [])));
  }

  function imageFromBytes(bytes, mime) {
    const blob = new Blob([bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || [])], { type: mime || 'image/png' });
    const url = URL.createObjectURL(blob);
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
      image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('模型贴图加载失败。')); };
      image.src = url;
    });
  }

  async function loadCubismCore() {
    if (typeof window !== 'undefined' && window.Live2DCubismCore) return window.Live2DCubismCore;
    if (isProduction()) return null;
    if (window.CreatorLocalAvatarImport && !window.CreatorLocalAvatarImport.isLocalEnvironment()) return null;
    if (coreLoad) return coreLoad;
    coreLoad = new Promise(resolve => {
      const script = document.createElement('script');
      script.src = CORE_SRC;
      script.async = true;
      script.onload = () => resolve(window.Live2DCubismCore || null);
      script.onerror = () => resolve(null);
      document.head.append(script);
    });
    return coreLoad;
  }

  async function loadCubismFramework() {
    if (typeof window !== 'undefined' && window.CreatorCubismFrameworkBridge?.createPresenter) {
      return window.CreatorCubismFrameworkBridge;
    }
    if (isProduction()) return null;
    if (window.CreatorLocalAvatarImport && !window.CreatorLocalAvatarImport.isLocalEnvironment()) return null;
    if (frameworkLoad) return frameworkLoad;
    frameworkLoad = new Promise(resolve => {
      const script = document.createElement('script');
      script.src = FRAMEWORK_SRC;
      script.async = true;
      script.onload = () => resolve(window.CreatorCubismFrameworkBridge?.createPresenter ? window.CreatorCubismFrameworkBridge : null);
      script.onerror = () => resolve(null);
      document.head.append(script);
    });
    return frameworkLoad;
  }

  async function loadModelAssets(record, readFile) {
    const validator = window.CreatorLocalLive2DValidator;
    if (!record?.modelFile) throw new Error('模型清单文件不存在或路径无效。');
    if (typeof readFile !== 'function') throw new Error('无法读取本地模型文件夹，请重新导入。');
    const manifestAsset = await readFile(record, record.modelFile);
    let manifest;
    try { manifest = decodeJson(manifestAsset.bytes); }
    catch (_) { throw new Error('模型清单不是有效 JSON。'); }
    const files = manifest?.FileReferences && typeof manifest.FileReferences === 'object' ? manifest.FileReferences : {};
    const mocPath = resolveRef(record.modelFile, files.Moc, validator);
    if (!mocPath) throw new Error('模型引用必须是文件夹内的相对路径：Moc');
    const mocAsset = await readFile(record, mocPath);
    const textureRefs = Array.isArray(files.Textures) ? files.Textures : [];
    if (!textureRefs.length) throw new Error('模型贴图加载失败。');
    const textures = [];
    for (const texture of textureRefs) {
      const texturePath = resolveRef(record.modelFile, texture, validator);
      if (!texturePath) throw new Error(`模型引用必须是文件夹内的相对路径：${texture}`);
      const asset = await readFile(record, texturePath);
      textures.push(await imageFromBytes(asset.bytes, asset.mime));
    }
    const expressions = {};
    const listed = Array.isArray(files.Expressions) ? files.Expressions : [];
    for (const item of listed) {
      const name = item && typeof item.Name === 'string' ? item.Name : '';
      const file = item && typeof item.File === 'string' ? item.File : '';
      if (!name || !file) continue;
      const expressionPath = resolveRef(record.modelFile, file, validator);
      if (!expressionPath) continue;
      try { expressions[name] = decodeJson((await readFile(record, expressionPath)).bytes); }
      catch (_) { /* missing expression files degrade to default parameters */ }
    }
    let poseBytes = null;
    const posePath = resolveRef(record.modelFile, files.Pose, validator);
    if (posePath) poseBytes = (await readFile(record, posePath)).bytes;
    let physicsBytes = null;
    let physicsJson = null;
    const physicsPath = resolveRef(record.modelFile, files.Physics, validator);
    if (physicsPath) {
      const physicsAsset = await readFile(record, physicsPath);
      physicsBytes = physicsAsset.bytes instanceof Uint8Array ? physicsAsset.bytes : new Uint8Array(physicsAsset.bytes || []);
      try { physicsJson = decodeJson(physicsBytes); }
      catch (_) { physicsJson = null; }
    }
    const motions = {};
    const motionRefs = files.Motions && typeof files.Motions === 'object' && !Array.isArray(files.Motions) ? files.Motions : {};
    for (const [group, items] of Object.entries(motionRefs)) {
      if (!Array.isArray(items)) continue;
      motions[group] = [];
      for (const item of items) {
        const file = item && typeof item.File === 'string' ? item.File : '';
        if (!file) continue;
        const motionPath = resolveRef(record.modelFile, file, validator);
        if (!motionPath) continue;
        try {
          motions[group].push({
            group,
            file: motionPath,
            fadeIn: Number(item.FadeInTime),
            fadeOut: Number(item.FadeOutTime),
            json: decodeJson((await readFile(record, motionPath)).bytes)
          });
        } catch (_) { /* missing motion files degrade to standard parameters */ }
      }
    }
    const groups = mapGroups(manifest);
    const mapping = mapFourStates(manifest, expressions, motions);
    return {
      manifest,
      mocBytes: mocAsset.bytes instanceof Uint8Array ? mocAsset.bytes : new Uint8Array(mocAsset.bytes || []),
      textures,
      expressions,
      poseBytes: poseBytes ? (poseBytes instanceof Uint8Array ? poseBytes : new Uint8Array(poseBytes || [])) : null,
      physicsBytes,
      physicsJson,
      motions,
      groups,
      mapping
    };
  }

  function compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  function createProgram(gl) {
    const vertex = compileShader(gl, gl.VERTEX_SHADER, `attribute vec2 a_pos; attribute vec2 a_uv; varying vec2 v_uv;
      void main() { v_uv = a_uv; gl_Position = vec4(a_pos, 0.0, 1.0); }`);
    const fragment = compileShader(gl, gl.FRAGMENT_SHADER, `precision mediump float; varying vec2 v_uv; uniform sampler2D u_tex; uniform float u_opacity;
      void main() { vec4 color = texture2D(u_tex, v_uv); gl_FragColor = vec4(color.rgb, color.a * u_opacity); }`);
    if (!vertex || !fragment) return null;
    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return null;
    }
    return program;
  }

  function uploadTexture(gl, image) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return texture;
  }

  function readXY(data, index) {
    if (!data) return [0, 0];
    const item = data[index];
    if (item && typeof item.x === 'number') return [item.x, item.y];
    return [Number(data[index * 2]) || 0, Number(data[index * 2 + 1]) || 0];
  }

  function clipScale(model) {
    const info = model.canvasinfo || {};
    const ppu = Number(info.PixelsPerUnit) || 1;
    const width = Number(info.CanvasWidth) || 2 * ppu;
    const height = Number(info.CanvasHeight) || 2 * ppu;
    return { halfW: Math.max((width / ppu) / 2, 0.0001), halfH: Math.max((height / ppu) / 2, 0.0001) };
  }

  function setBlend(gl, flags) {
    if (flags & BLEND_ADDITIVE) gl.blendFunc(gl.ONE, gl.ONE);
    else if (flags & BLEND_MULTIPLY) gl.blendFunc(gl.DST_COLOR, gl.ONE_MINUS_SRC_ALPHA);
    else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }

  function applyExpression(model, expression) {
    const parameters = model.parameters;
    if (!parameters?.values || !parameters.defaultValues) return;
    for (let i = 0; i < parameters.values.length; i++) parameters.values[i] = parameters.defaultValues[i];
    const list = expression && Array.isArray(expression.Parameters) ? expression.Parameters : [];
    const ids = parameters.ids || [];
    list.forEach(item => {
      if (!item || typeof item.Id !== 'string') return;
      const index = typeof ids.indexOf === 'function' ? ids.indexOf(item.Id) : -1;
      if (index < 0) return;
      const value = Number(item.Value);
      if (!Number.isFinite(value)) return;
      const blend = item.Blend || 'Add';
      if (blend === 'Multiply') parameters.values[index] *= value;
      else if (blend === 'Override') parameters.values[index] = value;
      else parameters.values[index] += value;
    });
    model.update?.();
  }

  function drawMesh(gl, program, model, textures, index, scale, opacity) {
    const drawables = model.drawables;
    const vertexCount = drawables.vertexCounts[index];
    const positions = drawables.vertexPositions[index];
    const uvs = drawables.vertexUvs[index];
    const indices = drawables.indices[index];
    if (!vertexCount || !positions || !uvs || !indices) return;
    const clip = new Float32Array(vertexCount * 2);
    const uv = new Float32Array(vertexCount * 2);
    for (let i = 0; i < vertexCount; i++) {
      const [x, y] = readXY(positions, i);
      const [u, v] = readXY(uvs, i);
      clip[i * 2] = x / scale.halfW * 0.92;
      clip[i * 2 + 1] = y / scale.halfH * 0.92;
      uv[i * 2] = u;
      uv[i * 2 + 1] = v;
    }
    const indexArray = indices instanceof Uint16Array ? indices : new Uint16Array(indices);
    const posBuf = gl.createBuffer();
    const uvBuf = gl.createBuffer();
    const indexBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, clip, gl.DYNAMIC_DRAW);
    const posLoc = gl.getAttribLocation(program, 'a_pos');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
    gl.bufferData(gl.ARRAY_BUFFER, uv, gl.DYNAMIC_DRAW);
    const uvLoc = gl.getAttribLocation(program, 'a_uv');
    gl.enableVertexAttribArray(uvLoc);
    gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indexArray, gl.DYNAMIC_DRAW);
    const textureIndex = drawables.textureIndices[index] || 0;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, textures[textureIndex] || textures[0]);
    gl.uniform1i(gl.getUniformLocation(program, 'u_tex'), 0);
    gl.uniform1f(gl.getUniformLocation(program, 'u_opacity'), opacity);
    gl.drawElements(gl.TRIANGLES, indexArray.length, gl.UNSIGNED_SHORT, 0);
    gl.deleteBuffer(posBuf);
    gl.deleteBuffer(uvBuf);
    gl.deleteBuffer(indexBuf);
  }

  function paint(gl, program, model, textures, canvas) {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    const drawables = model.drawables;
    const count = drawables.count || 0;
    const order = Array.from({ length: count }, (_, index) => index)
      .sort((a, b) => (drawables.renderOrders?.[a] || 0) - (drawables.renderOrders?.[b] || 0));
    const scale = clipScale(model);
    order.forEach(index => {
      if (((drawables.dynamicFlags?.[index] || 0) & VISIBLE) === 0) return;
      const opacity = Number(drawables.opacities?.[index]);
      if (!Number.isFinite(opacity) || opacity < 0.01) return;
      const masks = drawables.masks?.[index] || [];
      const maskCount = drawables.maskCounts?.[index] || masks.length || 0;
      if (maskCount > 0) {
        gl.enable(gl.STENCIL_TEST);
        gl.clear(gl.STENCIL_BUFFER_BIT);
        gl.colorMask(false, false, false, false);
        gl.stencilFunc(gl.ALWAYS, 1, 0xff);
        gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
        for (let mask = 0; mask < maskCount; mask++) drawMesh(gl, program, model, textures, masks[mask], scale, 1);
        gl.colorMask(true, true, true, true);
        const inverted = (drawables.constantFlags[index] & INVERTED_MASK) !== 0;
        gl.stencilFunc(inverted ? gl.NOTEQUAL : gl.EQUAL, 1, 0xff);
        gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
      }
      setBlend(gl, drawables.constantFlags?.[index] || 0);
      drawMesh(gl, program, model, textures, index, scale, Number.isFinite(opacity) ? opacity : 1);
      if (maskCount > 0) gl.disable(gl.STENCIL_TEST);
    });
  }

  function createWebGLPresenter(canvas, core, assets) {
    if (!canvas || !core?.Moc?.fromArrayBuffer || !core.Model?.fromMoc) return null;
    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, stencil: true, antialias: true })
      || canvas.getContext('experimental-webgl', { alpha: true, premultipliedAlpha: true, stencil: true });
    if (!gl) return null;
    const program = createProgram(gl);
    if (!program) return null;
    let moc;
    let model;
    try {
      moc = core.Moc.fromArrayBuffer(copyBytes(assets.mocBytes));
      model = core.Model.fromMoc(moc);
    } catch (_) {
      throw new Error('无法解析 moc3 模型。');
    }
    if (!model?.drawables) throw new Error('无法从 moc3 创建模型。');
    const textures = (assets.textures || []).map(image => uploadTexture(gl, image));
    if (!textures.length) throw new Error('模型贴图加载失败。');
    const mapping = assets.mapping || mapFourStates(assets.manifest, assets.expressions);
    canvas.width = 512;
    canvas.height = 512;
    gl.useProgram(program);

    function setExpression(state) {
      const next = STATES.includes(state) ? state : 'listen';
      applyExpression(model, mapping[next]?.expression || null);
      paint(gl, program, model, textures, canvas);
      return true;
    }

    function destroy() {
      try { model.release?.(); } catch (_) {}
      textures.forEach(texture => gl.deleteTexture(texture));
      gl.deleteProgram(program);
    }

    setExpression('listen');
    return { setExpression, destroy, status: 'ready' };
  }

  function createAdapter(record, hooks = {}) {
    const adapter = {
      kind: 'local-live2d',
      status: 'loading',
      record,
      setExpression(state) {
        try {
          if (adapter.status !== 'ready') return false;
          adapter._director?.setExpression?.(state);
          return adapter._presenter?.setExpression?.(state) === true;
        } catch (_) {
          fallback('model-load-failed');
          return false;
        }
      },
      destroy() {
        if (adapter.status === 'ready' || adapter.status === 'loading') adapter.status = 'destroyed';
        unbindLifecycle();
        adapter._loop?.stop();
        try { adapter._canvas?.removeEventListener('webglcontextlost', adapter._onLost); } catch (_) {}
        try { adapter._presenter?.destroy?.(); } catch (_) {}
        adapter._canvas?.remove();
        adapter._presenter = null;
        adapter._canvas = null;
        adapter._stage = null;
        adapter._director = null;
      },
      attach(stage) {
        adapter._stage = stage;
        adapter.ready = boot();
        return adapter.ready;
      }
    };

    const detect = hooks.detectWebGL || detectWebGL;
    const loadCore = hooks.loadCore || loadCubismCore;
    const loadAssets = hooks.loadAssets || (current => loadModelAssets(current, hooks.readFile || window.CreatorLocalAvatarImport?.readFile));
    const loadFramework = hooks.loadFramework || loadCubismFramework;
    const present = hooks.createPresenter;

    function unbindLifecycle() {
      try { document.removeEventListener('visibilitychange', adapter._onVisibility); } catch (_) {}
      try { adapter._motionQuery?.removeEventListener?.('change', adapter._onMotionChange); } catch (_) {}
      try { adapter._io?.disconnect(); } catch (_) {}
      adapter._onVisibility = null;
      adapter._onMotionChange = null;
      adapter._motionQuery = null;
      adapter._io = null;
    }

    function pauseReason() {
      if (typeof document !== 'undefined' && document.hidden) return true;
      return adapter._offscreen === true;
    }

    function syncLoop() {
      if (adapter.status !== 'ready' || !adapter._loop) return;
      if (pauseReason()) adapter._loop.stop();
      else adapter._loop.start();
    }

    function bindLifecycle(stage, canvas) {
      adapter._onVisibility = () => syncLoop();
      document.addEventListener('visibilitychange', adapter._onVisibility);
      adapter._motionQuery = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
      adapter._onMotionChange = () => {
        const reduced = prefersReducedMotion(adapter._motionQuery);
        adapter._director?.setReducedMotion?.(reduced);
        adapter._presenter?.setReducedMotion?.(reduced);
      };
      adapter._motionQuery?.addEventListener?.('change', adapter._onMotionChange);
      adapter._offscreen = false;
      if (typeof IntersectionObserver === 'function' && (canvas || stage)) {
        adapter._io = new IntersectionObserver(entries => {
          adapter._offscreen = entries.some(entry => (
            entry.isIntersecting === false
            && (entry.intersectionRatio || 0) === 0
            && (entry.boundingClientRect?.height || 0) > 0
          ));
          syncLoop();
        });
        adapter._io.observe(canvas || stage);
      }
    }

    function fallback(status) {
      adapter.status = status;
      unbindLifecycle();
      adapter._loop?.stop();
      try { adapter._canvas?.removeEventListener('webglcontextlost', adapter._onLost); } catch (_) {}
      try { adapter._presenter?.destroy?.(); } catch (_) {}
      adapter._presenter = null;
      adapter._director = null;
      adapter._canvas?.remove();
      adapter._canvas = null;
      if (adapter._stage) {
        adapter._stage.dataset.adapterStatus = status;
        if (window.CreatorAudienceStage?.restoreFallback) window.CreatorAudienceStage.restoreFallback(adapter._stage, status);
        else adapter._stage.dataset.presentation = 'svg';
      }
    }

    async function boot() {
      try {
        if (!detect()) return fallback('webgl-unavailable');
        const core = await loadCore();
        if (!core) return fallback('cubism-core-missing');
        const framework = await loadFramework();
        if (!framework?.createPresenter && typeof present !== 'function') return fallback('cubism-framework-missing');
        const assets = await loadAssets(record);
        if (!adapter._stage) return fallback('model-load-failed');
        const canvas = document.createElement('canvas');
        canvas.className = 'v2-audience-pixel';
        canvas.setAttribute('aria-hidden', 'true');
        const reduced = prefersReducedMotion();
        const director = createLive2DDirector(assets, { reducedMotion: reduced });
        const presenter = typeof present === 'function'
          ? present(canvas, core, assets, { director, reducedMotion: reduced })
          : framework.createPresenter(canvas, core, assets, { director, reducedMotion: reduced });
        if (!presenter) return fallback('webgl-unavailable');
        adapter._onLost = event => {
          event.preventDefault();
          fallback('webgl-unavailable');
        };
        canvas.addEventListener('webglcontextlost', adapter._onLost);
        adapter._canvas = canvas;
        adapter._stage.querySelector('.v2-audience-face')?.after(canvas);
        adapter._presenter = presenter;
        adapter._director = presenter.director || director;
        adapter.renderer = presenter.renderer || framework?.renderer || 'official-cubism-web-framework';
        adapter._loop = createFrameLoop({
          requestAnimationFrame: hooks.requestAnimationFrame || window.requestAnimationFrame?.bind(window),
          cancelAnimationFrame: hooks.cancelAnimationFrame || window.cancelAnimationFrame?.bind(window),
          now: hooks.now,
          isPaused: pauseReason,
          step: dt => {
            if (typeof presenter.tick === 'function') presenter.tick(dt);
            else if (typeof presenter.applySnapshot === 'function') presenter.applySnapshot(adapter._director.tick(dt));
            else adapter._director.tick(dt);
          },
          onError: () => fallback('model-load-failed')
        });
        bindLifecycle(adapter._stage, canvas);
        await Promise.resolve(presenter.ready);
        if (adapter.status !== 'loading') return;
        adapter.status = 'ready';
        adapter._stage.dataset.adapterStatus = 'ready';
        adapter._stage._bloubAvatar?.destroy?.();
        adapter._stage._bloubAvatar = null;
        adapter._loop.start();
        window.CreatorAudienceStage?.setExpression(adapter._stage, adapter._stage.dataset.expression || 'listen');
      } catch (error) {
        const accessExpired = /重新导入|尚未授权读取/.test(String(error?.message || ''));
        fallback(accessExpired ? 'folder-access-expired' : 'model-load-failed');
      }
    }

    adapter.ready = Promise.resolve();
    adapter.loopStats = () => adapter._loop?.stats?.() || { running: false, id: 0, starts: 0, frames: 0 };
    adapter.snapshot = () => adapter._presenter?.snapshot?.() || adapter._director?.snapshot?.() || null;
    return adapter;
  }

  window.CreatorLive2DRuntime = {
    CORE_SRC,
    FRAMEWORK_SRC,
    STATES,
    STANDARD_REACTION,
    detectWebGL,
    prefersReducedMotion,
    mapGroups,
    mapFourStates,
    evaluateMotion,
    stateFingerprint,
    createLive2DDirector,
    createFrameLoop,
    loadCubismCore,
    loadCubismFramework,
    loadModelAssets,
    createWebGLPresenter,
    createAdapter
  };
})();
