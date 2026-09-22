/**
 * Read Yourself adapter for the vendored jeremy-prt/bloub SVG core.
 * The core is framework-free; this file only supplies the existing stage's
 * lifecycle, appearance controls, and the four judgment-event states.
 * It never changes scoring.
 */
(() => {
  const mapping = { listen: 'neutre', confused: 'confus', interest: 'excite', drop: 'somnolent' };
  const faceLabels = {
    neutre: '平静', attentif: '专注', surpris: '惊讶', excite: '兴奋', heureux: '高兴', hilare: '大笑',
    colere: '生气', triste: '难过', effraye: '害怕', mefiant: '怀疑', confus: '困惑', curieux: '好奇',
    fier: '得意', timide: '害羞', blase: '无聊', somnolent: '困倦'
  };
  const motionLabels = {
    idle: '待机', thinking: '思考', wink: '眨眼', wide: '睁大', alert: '警觉', notify: '提示点',
    exclaim: '感叹', sleep: '睡着', egg: '蛋形', hexagon: '六边', play: '播放', orbit: '环绕',
    swirl: '旋转', burst: '爆开', comet: '彗星'
  };
  const defaults = {
    size: 58,
    x: 0,
    y: -8,
    ink: '#16151a',
    paper: '#f4efe8',
    card: false,
    showLabel: true,
    labelOpacity: 0.92,
    labelX: 0,
    labelY: 0,
    holdMs: 1600
  };

  function clamp(value, min, max, fallback) {
    const next = Number(value);
    return Number.isFinite(next) ? Math.min(max, Math.max(min, next)) : fallback;
  }

  function normalize(incoming) {
    const value = { ...defaults, ...(incoming && typeof incoming === 'object' ? incoming : {}) };
    value.size = clamp(value.size, 20, 100, defaults.size);
    value.x = clamp(value.x, -280, 280, defaults.x);
    value.y = clamp(value.y, -280, 280, defaults.y);
    value.ink = String(value.ink || defaults.ink);
    value.paper = String(value.paper || defaults.paper);
    value.card = value.card === true;
    value.showLabel = value.showLabel !== false;
    value.labelOpacity = clamp(value.labelOpacity, 0, 1, defaults.labelOpacity);
    value.labelX = clamp(value.labelX, -160, 160, defaults.labelX);
    value.labelY = clamp(value.labelY, -160, 160, defaults.labelY);
    value.holdMs = clamp(value.holdMs, 400, 8000, defaults.holdMs);
    return value;
  }

  function previewCatalog() {
    const core = window.ReadYourselfBloubCore;
    const faces = (core?.FACE_IDS || Object.keys(faceLabels)).map(id => ({ id, label: faceLabels[id] || id }));
    const motions = (core?.MOTION_IDS || Object.keys(motionLabels)).map(id => ({ id, label: motionLabels[id] || id }));
    return [
      { title: '训练四态', items: [
        { id: 'listen', label: '在听' }, { id: 'confused', label: '没跟上' },
        { id: 'interest', label: '兴趣回升' }, { id: 'drop', label: '注意力下降' }
      ] },
      { title: '更多表情', items: faces },
      { title: '动作形变', items: motions }
    ];
  }

  function currentSettings() {
    return normalize(window.CreatorQAControls?.getState?.().components?.bloubAudience || window.CreatorProjectConfig?.config?.components?.bloubAudience);
  }

  function applyAppearance(components) {
    const cfg = normalize(components?.bloubAudience || currentSettings());
    const root = document.documentElement;
    root.style.setProperty('--v2-bloub-size', `${cfg.size}%`);
    root.style.setProperty('--v2-bloub-x', `${cfg.x}px`);
    root.style.setProperty('--v2-bloub-y', `${cfg.y}px`);
    root.style.setProperty('--v2-bloub-label-opacity', cfg.showLabel ? String(cfg.labelOpacity) : '0');
    root.style.setProperty('--v2-bloub-label-x', `${cfg.labelX || 0}px`);
    root.style.setProperty('--v2-bloub-label-y', `${cfg.labelY || 0}px`);
    root.style.setProperty('--v2-bloub-hold-ms', String(cfg.holdMs));
    document.querySelectorAll('[data-v2-audience-stage]').forEach(stage => {
      stage._bloubAvatar?.configure?.(cfg);
    });
    return cfg;
  }

  function createAdapter(options = {}) {
    const Core = window.ReadYourselfBloubCore;
    if (!Core?.createBloubAvatar) return null;
    const settings = { ...currentSettings(), ...options };
    const avatar = Core.createBloubAvatar({ ink: settings.ink, paper: settings.paper, card: settings.card });
    return {
      kind: 'bloub-svg',
      status: 'ready',
      attach(host) {
        const mount = host.querySelector('[data-v2-audience-bloub]') || host;
        avatar.attach(mount);
      },
      configure(next) {
        const cfg = normalize({ ...currentSettings(), ...next });
        avatar.configure({ ink: cfg.ink, paper: cfg.paper, card: cfg.card });
      },
      setExpression(state) {
        return avatar.setState(state) === true;
      },
      destroy() { avatar.destroy(); }
    };
  }

  function expressionId(state) { return mapping[state] || mapping.listen; }
  function previewIds() {
    return ['listen', 'confused', 'interest', 'drop', ...(window.ReadYourselfBloubCore?.FACE_IDS || Object.keys(faceLabels)), ...(window.ReadYourselfBloubCore?.MOTION_IDS || Object.keys(motionLabels))];
  }
  document.addEventListener('creator:component-settings-change', event => applyAppearance(event.detail));
  const boot = () => applyAppearance(window.CreatorQAControls?.getState?.().components || window.CreatorProjectConfig?.config?.components);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  window.CreatorBloubAudienceRuntime = { defaults, normalize, currentSettings, applyAppearance, createAdapter, expressionId, previewCatalog, previewIds, mapping };
})();
