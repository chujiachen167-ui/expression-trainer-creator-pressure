/*
 * Text effects for the launcher.
 *
 * React Bits' Warp Text and True Focus are intentionally adapted here as
 * small, dependency-free DOM adapters. The current Electron product stays
 * native HTML/CSS/JS and remains offline-capable.
 * Copyright (c) 2026 David Haz. Adapted component source is subject to
 * vendor/react-bits/LICENSE.md (MIT + Commons Clause).
 */
(() => {
  const title = document.querySelector('[data-true-focus]');
  const subtitle = document.querySelector('[data-warp-text]');
  if (!title && !subtitle) return;

  const defaults = {
    warpText: { enabled: true, color: '#a9a3b3', warpStrength: 0.08, warpScale: 1.7, speed: 0.55, pointerInfluence: 0.42, pointerStrength: 0.38, refraction: 0.018, ripple: true },
    trueFocus: { enabled: true, blurAmount: 3, animationDuration: 420, pauseBetweenAnimations: 1600, borderColor: '#ff2f92', glowColor: '#ff2f92' }
  };
  let settings = { warpText: { ...defaults.warpText }, trueFocus: { ...defaults.trueFocus } };
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');

  function getSettings(detail) {
    const source = detail || window.CreatorQAControls?.getState?.()?.components || window.CreatorProjectConfig?.config?.components || {};
    settings = {
      warpText: { ...defaults.warpText, ...(source.warpText || {}) },
      trueFocus: { ...defaults.trueFocus, ...(source.trueFocus || {}) }
    };
    mountTrueFocus();
    mountWarpText();
  }

  let focusOverlay;
  let focusFrame;
  let focusWords = [];
  let focusIndex = 0;
  let focusTimer;
  let focusObserver;

  function positionFocus() {
    if (!title || !focusOverlay) return;
    const parentRect = title.parentElement.getBoundingClientRect();
    const rect = title.getBoundingClientRect();
    Object.assign(focusOverlay.style, {
      left: `${rect.left - parentRect.left}px`,
      top: `${rect.top - parentRect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      fontFamily: getComputedStyle(title).fontFamily,
      fontSize: getComputedStyle(title).fontSize,
      fontWeight: getComputedStyle(title).fontWeight,
      lineHeight: getComputedStyle(title).lineHeight,
      letterSpacing: getComputedStyle(title).letterSpacing
    });
    setFocusIndex(focusIndex);
  }

  function setFocusIndex(index) {
    if (!focusWords.length || !focusFrame || !focusOverlay) return;
    focusIndex = (index + focusWords.length) % focusWords.length;
    focusWords.forEach((word, wordIndex) => word.classList.toggle('active', wordIndex === focusIndex));
    const wordRect = focusWords[focusIndex].getBoundingClientRect();
    const overlayRect = focusOverlay.getBoundingClientRect();
    Object.assign(focusFrame.style, {
      left: `${wordRect.left - overlayRect.left}px`,
      top: `${wordRect.top - overlayRect.top}px`,
      width: `${wordRect.width}px`,
      height: `${wordRect.height}px`
    });
  }

  function scheduleFocus() {
    window.clearTimeout(focusTimer);
    if (!settings.trueFocus.enabled || settings.trueFocus.manualMode || focusWords.length < 2 || reduceMotion?.matches) return;
    focusTimer = window.setTimeout(() => {
      setFocusIndex(focusIndex + 1);
      scheduleFocus();
    }, Number(settings.trueFocus.pauseBetweenAnimations) + Number(settings.trueFocus.animationDuration));
  }

  function renderFocus() {
    if (!title) return;
    const source = title.querySelector('[data-true-focus-source]') || title;
    const words = source.textContent.trim().split(/\s+/).filter(Boolean);
    if (!words.length) return;
    if (!focusOverlay) {
      focusOverlay = document.createElement('div');
      focusOverlay.className = 'true-focus-overlay';
      focusOverlay.setAttribute('aria-hidden', 'true');
      focusOverlay.setAttribute('data-qa-copy-ignore', '');
      title.parentElement.append(focusOverlay);
    }
    focusOverlay.replaceChildren();
    focusWords = words.map(word => {
      const node = document.createElement('span');
      node.className = 'true-focus-word';
      node.textContent = word;
      node.addEventListener('pointerenter', () => { window.clearTimeout(focusTimer); setFocusIndex(focusWords.indexOf(node)); });
      node.addEventListener('pointerleave', scheduleFocus);
      focusOverlay.append(node, document.createTextNode(' '));
      return node;
    });
    focusFrame = document.createElement('span');
    focusFrame.className = 'true-focus-frame';
    focusFrame.innerHTML = '<i class="true-focus-corner tl"></i><i class="true-focus-corner tr"></i><i class="true-focus-corner bl"></i><i class="true-focus-corner br"></i>';
    focusOverlay.append(focusFrame);
    focusOverlay.style.setProperty('--true-focus-blur', `${Number(settings.trueFocus.blurAmount) || 0}px`);
    focusOverlay.style.setProperty('--true-focus-duration', `${Number(settings.trueFocus.animationDuration) || 420}ms`);
    focusOverlay.style.setProperty('--true-focus-border', settings.trueFocus.borderColor);
    focusOverlay.style.setProperty('--true-focus-glow', settings.trueFocus.glowColor);
    title.classList.toggle('true-focus-ready', Boolean(settings.trueFocus.enabled));
    focusOverlay.hidden = !settings.trueFocus.enabled;
    focusOverlay.classList.add('ready');
    positionFocus();
    scheduleFocus();
  }

  function mountTrueFocus() {
    if (!title) return;
    renderFocus();
    focusObserver?.disconnect();
    const source = title.querySelector('[data-true-focus-source]') || title;
    focusObserver = new MutationObserver(() => renderFocus());
    focusObserver.observe(source, { childList: true, characterData: true, subtree: true });
  }

  // This shader is a no-dependency WebGL2 translation of React Bits Warp
  // Text's pointer lens: ambient noise, a local bulge, RGB refraction and a
  // ripple. If WebGL2 is unavailable the semantic subtitle simply remains.
  const vertexShader = `#version 300 es
    in vec2 position; in vec2 uv; out vec2 vUv;
    void main(){ vUv=uv; gl_Position=vec4(position,0.0,1.0); }`;
  const fragmentShader = `#version 300 es
    precision highp float; uniform sampler2D uTextTexture; uniform vec2 uResolution; uniform vec2 uPointer;
    uniform float uPointerActive; uniform float uTime; uniform float uWarpStrength; uniform float uWarpScale;
    uniform float uSpeed; uniform float uPointerInfluence; uniform float uPointerStrength; uniform float uRefraction;
    uniform float uRipple; uniform float uMotion; in vec2 vUv; out vec4 fragColor;
    float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),u.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),u.x),u.y);}
    float fbm(vec2 p){float value=0.,amplitude=.5;for(int i=0;i<4;i++){value+=amplitude*noise(p);p*=2.02;amplitude*=.5;}return value;}
    vec4 sampleText(vec2 uv){if(uv.x<0.||uv.x>1.||uv.y<0.||uv.y>1.)return vec4(0.);return texture(uTextTexture,uv);}
    void main(){vec2 uv=vUv;float aspect=uResolution.x/max(uResolution.y,1.);float time=uTime*uSpeed;float scale=max(uWarpScale,.001);
      vec2 drift=vec2(time*.055,-time*.045);float n1=fbm(uv*scale*3.1+drift),n2=fbm((uv+19.17)*scale*3.4-drift.yx);
      vec2 ambient=(vec2(n1,n2)-.5)*uWarpStrength*.045*uMotion;vec2 delta=uv-uPointer;vec2 aspectDelta=vec2(delta.x*aspect,delta.y);
      float dist=length(aspectDelta),radius=max(uPointerInfluence,.001),t=clamp(dist/radius,0.,1.),lens=smoothstep(radius,0.,dist)*uPointerActive;
      float bulge=t*(1.-t)*(1.-t)*6.75*uPointerActive;vec2 dir=dist>.0001?vec2(aspectDelta.x/aspect,aspectDelta.y)/dist:vec2(0.);float rippleWave=sin(dist*28.-time*4.2)*.5+.5;
      vec2 pointerWarp=-dir*bulge*uPointerStrength*.045;pointerWarp+=dir*(rippleWave-.5)*uRipple*bulge*uPointerStrength*.016;
      vec2 displaced=uv+ambient+pointerWarp,splitDir=ambient+pointerWarp;float splitLen=length(splitDir);splitDir=splitLen>.00001?splitDir/splitLen:vec2(.7071);
      vec2 split=splitDir*uRefraction*.16*(.35+lens*1.65);vec4 base=sampleText(displaced);float r=sampleText(displaced+split).r,g=base.g,b=sampleText(displaced-split).b;
      float a=max(max(sampleText(displaced+split).a,base.a),sampleText(displaced-split).a);fragColor=vec4(vec3(r,g,b)+lens*base.a*.055,a);}`;

  let warpContext;
  function shader(gl, type, source) {
    const value = gl.createShader(type); gl.shaderSource(value, source); gl.compileShader(value);
    if (!gl.getShaderParameter(value, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(value));
    return value;
  }
  function buildWarpTexture(canvas, source) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const texture = document.createElement('canvas'); texture.width = Math.max(1, rect.width * dpr); texture.height = Math.max(1, rect.height * dpr);
    const ctx = texture.getContext('2d'); if (!ctx) return null;
    const style = getComputedStyle(source); const size = parseFloat(style.fontSize) || 18;
    ctx.scale(dpr, dpr); ctx.clearRect(0, 0, rect.width, rect.height); ctx.fillStyle = settings.warpText.color;
    ctx.font = `${style.fontWeight || 400} ${size}px ${style.fontFamily || 'sans-serif'}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    if ('letterSpacing' in ctx) ctx.letterSpacing = style.letterSpacing === 'normal' ? '0px' : style.letterSpacing;
    // Use the paragraph's actual line breaks/positions, not a single canvas
    // line. This respects edited copy, font settings and narrow viewports.
    const walker = document.createTreeWalker(source, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    const lines = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      let offset = 0;
      for (const char of node.textContent) {
        range.setStart(node, offset); offset += char.length; range.setEnd(node, offset);
        const box = range.getBoundingClientRect();
        if (!box.width || !box.height) continue;
        const last = lines[lines.length - 1];
        if (last && Math.abs(last.top - box.top) < 2) last.text += char;
        else lines.push({ text: char, left: box.left, top: box.top, height: box.height });
      }
    }
    for (const line of lines) ctx.fillText(line.text, line.left - rect.left, line.top - rect.top + line.height / 2);
    return texture;
  }
  function mountWarpText() {
    if (!subtitle) return;
    if (!settings.warpText.enabled || reduceMotion?.matches) { subtitle.classList.remove('warp-text-ready'); warpContext?.destroy?.(); warpContext = null; return; }
    if (warpContext) { warpContext.update(settings.warpText); return; }
    const canvas = document.createElement('canvas'); canvas.className = 'warp-text-canvas'; canvas.setAttribute('aria-hidden', 'true'); subtitle.append(canvas);
    let gl;
    try { gl = canvas.getContext('webgl2', { alpha: true, antialias: true }); } catch (_) { gl = null; }
    if (!gl) { canvas.remove(); return; }
    try {
      const program = gl.createProgram(); const shaders = [shader(gl, gl.VERTEX_SHADER, vertexShader), shader(gl, gl.FRAGMENT_SHADER, fragmentShader)]; shaders.forEach(value => gl.attachShader(program, value)); gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
      const position = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, position); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
      // Bottom vertices use v=0, top vertices v=1. Canvas upload flips Y once;
      // inverted UVs here would flip the subtitle a second time.
      const uv = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, uv); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0,0,1,0,0,1,0,1,1,0,1,1]), gl.STATIC_DRAW);
      const texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, texture); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const uniforms = Object.fromEntries(['uTextTexture','uResolution','uPointer','uPointerActive','uTime','uWarpStrength','uWarpScale','uSpeed','uPointerInfluence','uPointerStrength','uRefraction','uRipple','uMotion'].map(name => [name, gl.getUniformLocation(program, name)]));
      const pointer = { x: .5, y: .5, tx: .5, ty: .5, active: 0, target: 0 }; let raf = 0; let visible = true; let disposed = false; let start = performance.now();
      const resize = () => { const rect = canvas.getBoundingClientRect(); const dpr = Math.min(window.devicePixelRatio || 1, 2); canvas.width = Math.max(1, rect.width * dpr); canvas.height = Math.max(1, rect.height * dpr); gl.viewport(0, 0, canvas.width, canvas.height); rasterize(); };
      let hasTexture = false;
      const rasterize = () => { const image = buildWarpTexture(canvas, subtitle); if (!image) { hasTexture = false; subtitle.classList.remove('warp-text-ready'); return; } gl.bindTexture(gl.TEXTURE_2D, texture); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image); hasTexture = true; };
      const update = next => {
        settings.warpText = { ...settings.warpText, ...next };
        // QA's copy editor replaces textContent; reattach the existing canvas
        // instead of rendering forever into a detached node.
        if (!subtitle.contains(canvas)) subtitle.append(canvas);
        resize();
      };
      const render = now => { raf = 0; if (disposed || !visible || document.hidden) return; const elapsed = (now - start) * .001; const tx=pointer.tx, ty=pointer.ty; const damp=.12; pointer.x+=(tx-pointer.x)*damp; pointer.y+=(ty-pointer.y)*damp; pointer.active+=(pointer.target-pointer.active)*.1;
        gl.useProgram(program); gl.uniform1i(uniforms.uTextTexture, 0); gl.uniform2f(uniforms.uResolution, canvas.width, canvas.height); gl.uniform2f(uniforms.uPointer, pointer.x, pointer.y); gl.uniform1f(uniforms.uPointerActive, (reduceMotion?.matches? .35:1)*pointer.active); gl.uniform1f(uniforms.uTime, reduceMotion?.matches?0:elapsed); gl.uniform1f(uniforms.uWarpStrength, settings.warpText.warpStrength); gl.uniform1f(uniforms.uWarpScale, settings.warpText.warpScale); gl.uniform1f(uniforms.uSpeed, settings.warpText.speed); gl.uniform1f(uniforms.uPointerInfluence, settings.warpText.pointerInfluence); gl.uniform1f(uniforms.uPointerStrength, settings.warpText.pointerStrength); gl.uniform1f(uniforms.uRefraction, settings.warpText.refraction); gl.uniform1f(uniforms.uRipple, settings.warpText.ripple?1:0); gl.uniform1f(uniforms.uMotion, reduceMotion?.matches?0:1);
        gl.bindBuffer(gl.ARRAY_BUFFER, position); const p=gl.getAttribLocation(program,'position'); gl.enableVertexAttribArray(p); gl.vertexAttribPointer(p,2,gl.FLOAT,false,0,0); gl.bindBuffer(gl.ARRAY_BUFFER,uv); const u=gl.getAttribLocation(program,'uv'); gl.enableVertexAttribArray(u); gl.vertexAttribPointer(u,2,gl.FLOAT,false,0,0); gl.drawArrays(gl.TRIANGLES,0,6); subtitle.classList.toggle('warp-text-ready', hasTexture); raf=requestAnimationFrame(render); };
      const move = event => { if (event.pointerType==='touch') return; const rect=canvas.getBoundingClientRect(); pointer.tx=(event.clientX-rect.left)/rect.width; pointer.ty=1-(event.clientY-rect.top)/rect.height; pointer.target=1; };
      const leave = () => { pointer.target=0; };
      const resume = () => { cancelAnimationFrame(raf); raf = 0; if (!disposed && visible && !document.hidden) raf = requestAnimationFrame(render); };
      const observer = new ResizeObserver(resize); observer.observe(subtitle);
      const intersection = window.IntersectionObserver ? new IntersectionObserver(entries => { visible = entries[0].isIntersecting; resume(); }) : null;
      intersection?.observe(subtitle);
      const contextLost = event => { event.preventDefault(); warpContext?.destroy(); warpContext = null; };
      canvas.addEventListener('webglcontextlost', contextLost);
      canvas.addEventListener('pointermove',move); canvas.addEventListener('pointerleave',leave); window.addEventListener('resize',resize); document.addEventListener('visibilitychange', resume);
      resize(); resume();
      document.fonts?.ready.then(() => { if (!disposed) { resize(); positionFocus(); } });
      warpContext={ update, destroy:()=>{
        disposed=true; cancelAnimationFrame(raf); observer.disconnect(); intersection?.disconnect();
        canvas.removeEventListener('pointermove',move); canvas.removeEventListener('pointerleave',leave); canvas.removeEventListener('webglcontextlost',contextLost);
        window.removeEventListener('resize',resize); document.removeEventListener('visibilitychange', resume);
        gl.deleteBuffer(position); gl.deleteBuffer(uv); gl.deleteTexture(texture); shaders.forEach(value => gl.deleteShader(value)); gl.deleteProgram(program);
        canvas.remove(); subtitle.classList.remove('warp-text-ready');
      } };
    } catch (error) { console.warn('Warp Text adaptation could not be initialized:', error); canvas.remove(); }
  }

  window.addEventListener('resize', positionFocus);
  document.addEventListener('creator:logo-layout-change', positionFocus);
  document.addEventListener('creator:component-settings-change', event => getSettings(event.detail));
  document.addEventListener('creator:copy-change', () => { mountTrueFocus(); mountWarpText(); });
  reduceMotion?.addEventListener?.('change', () => { renderFocus(); mountWarpText(); });
  getSettings();
})();
