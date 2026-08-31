(function (root, factory) {
  const config = factory();
  if (typeof module === 'object' && module.exports) module.exports = config;
  else root.CreatorMarqueeConfig = config;
})(typeof window === 'object' ? window : this, function () {
  const examples = [
    ['我今天[[其实主要就是想]]跟大家聊一聊，新账号的开头怎么写。', '今天聊聊：[[新账号的开头怎么写]]。'],
    ['我[[个人感觉吧]]，这个视频的开头[[还是有一点点]]太长了。', '这个视频的[[开头太长了]]。'],
    ['这个方法[[怎么说呢]]，更适合刚开始做知识口播的人。', '这个方法更适合[[知识口播新手]]。'],
    ['[[然后接下来]]我再给大家[[简单]]分享一下，我第一次接广告的经历。', '分享一下我[[第一次接广告的经历]]。'],
    ['这个支架[[总体来说]]比较轻，[[就是]]收起来以后也不怎么占地方。', '这个支架[[轻便，收纳不占地方]]。'],
    ['我想说的意思[[其实就是说]]，拍之前得先想清楚要讲给谁听。', '开拍前，先想清楚[[你在讲给谁听]]。'],
    ['我们[[首先第一步]]，要把这条视频里[[最主要的那个]]观点给找出来。', '第一步，找到这条视频的[[核心观点]]。'],
    ['这个功能[[我自己个人]]用下来，最方便的就是能一键导出字幕。', '用下来最方便的是：[[一键导出字幕]]。'],
    ['[[关于这个问题的话]]，我的建议是先用手机拍，[[暂时先]]别急着买相机。', '我的建议是：[[先用手机拍，别急着买相机]]。'],
    ['今天[[差不多大概就是]]这些，下一期我会讲一下怎么写视频标题。', '今天先讲到这里，[[下期聊视频标题怎么写]]。']
  ].map(pair => pair.join('\n')).join('\n\n');
  const defaults = {
    enabled: true, scrollDuration: 40000, reverse: false, pauseOnHover: true, paused: false,
    // Project owner explicitly chose automatic playback; system/static modes
    // remain available per component, without changing OS preferences.
    playbackMode: 'autoplay',
    repeat: 4, gap: 38, height: 420, fadeSize: 8, edgeOpacity: 0,
    followTheme: true, rawColor: '#a9a3b3', cleanColor: '#f4f1f7',
    issueColor: '#df9765', highlightColor: '#df9765', emphasisColor: '#f4f1f7',
    highlightStyle: 'random', randomMarksVersion: 1, highlightOpacity: 0.16, rawFontSize: 17,
    cleanFontSize: 25, cleanWeight: 750,
    gooeySwapEnabled: true, hoverSwapDuration: 620, gooeyBlur: 4.5, gooeyColor: '#ff2f92',
    examples
  };
  function normalize(incoming = {}) {
    const source = incoming && typeof incoming === 'object' ? incoming : {};
    const settings = { ...defaults, ...source };
    const clamp = (key, min, max) => { const value = Number(settings[key]); settings[key] = Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : defaults[key]; };
    for (const key of ['enabled', 'reverse', 'pauseOnHover', 'paused', 'followTheme']) settings[key] = typeof settings[key] === 'boolean' ? settings[key] : defaults[key];
    for (const [key, min, max] of [['scrollDuration', 12000, 120000], ['repeat', 2, 6], ['gap', 12, 96], ['height', 260, 640], ['fadeSize', 0, 24], ['edgeOpacity', 0, 1], ['highlightOpacity', 0, 0.5], ['rawFontSize', 14, 24], ['cleanFontSize', 18, 36], ['cleanWeight', 600, 900], ['hoverSwapDuration', 220, 1200], ['gooeyBlur', 0, 14]]) clamp(key, min, max);
    settings.repeat = Math.round(settings.repeat);
    if (!['autoplay', 'system', 'static'].includes(settings.playbackMode)) settings.playbackMode = defaults.playbackMode;
    for (const key of ['rawColor', 'cleanColor', 'issueColor', 'highlightColor', 'emphasisColor', 'gooeyColor']) if (!/^[\da-f]{6}$/i.test(String(settings[key]).replace('#', '')) || !String(settings[key]).startsWith('#')) settings[key] = defaults[key];
    if (!['random', 'underline', 'highlight', 'box', 'both'].includes(settings.highlightStyle)) settings.highlightStyle = defaults.highlightStyle;
    settings.gooeySwapEnabled = typeof settings.gooeySwapEnabled === 'boolean' ? settings.gooeySwapEnabled : defaults.gooeySwapEnabled;
    if (typeof settings.examples !== 'string') settings.examples = examples;
    return settings;
  }
  // Keep the original storage namespace. Existing color/timing edits must survive.
  function migrate(incoming = {}) {
    const result = { ...incoming };
    // v1 of this adaptation accidentally defaulted to manual pause controls.
    // Existing drafts become hover-first unless a later QA edit opted out.
    if (result.hoverPauseConfigured !== true) result.pauseOnHover = true;
    result.paused = false;
    // One-time adoption of the requested random treatments, without touching
    // saved copy, colors or timing. Later explicit style choices are preserved.
    if (result.randomMarksVersion !== 1) result.highlightStyle = 'random';
    result.randomMarksVersion = 1;
    if (result.issueColor == null && /^#[\da-f]{6}$/i.test(result.labelColor)) result.issueColor = result.labelColor;
    if (result.followTheme == null && ((result.rawColor && result.rawColor !== defaults.rawColor) || (result.cleanColor && result.cleanColor !== defaults.cleanColor))) result.followTheme = false;
    return result;
  }
  function parseExamples(text) {
    const blocks = String(text).trim().split(/\n\s*\n/).filter(Boolean);
    const pairs = blocks.map(block => block.split('\n').map(line => line.trim()).filter(Boolean));
    if (!pairs.length || pairs.length > 20 || pairs.some(pair => pair.length !== 2 || pair.some(line => line.length > 220 || !line.replace(/\[\[|\]\]/g, '').trim()))) return null;
    return pairs;
  }
  function segments(text) {
    return String(text).split(/(\[\[[^\[\]\n]+\]\])/g).filter(Boolean).map(part => ({ text: part.startsWith('[[') && part.endsWith(']]') ? part.slice(2, -2) : part, marked: part.startsWith('[[') && part.endsWith(']]') }));
  }
  return { defaults, normalize, migrate, parseExamples, segments };
});
