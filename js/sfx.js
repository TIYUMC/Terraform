/**
 * sfx.js — Cozy Farm SFX 播放器（纯播放器；音频数据在 assets.js 的 ASSETS.audio 段，50 键 dataURI base64）
 * 键名 = Cozy 包内文件名去 .wav（kebab 原名，作废 0.9.7 的 sfx_* 自定义键）。
 * 加载顺序 = assets.js 之后（读 ASSETS.audio）、ui-events.js 之前（挂点用 window.SFX）。
 * 池化 ≤4 并发（连点收割不爆音）、首次手势解锁 AudioContext、localStorage stardew_sfx 静音位。
 * audio 不入 registry（registry 是图片表、preload 走 new Image，塞 audio 会被 Image 解码失败）。
 */
const SFX = {
  ctx: null,
  buffers: {},
  bgmBufs: {},
  bgm: { scene: null, src: null, gain: null, muted: false, keys: null, dead: false, gen: 0 },
  muted: false,
  _active: 0,
  _ac() {
    const A = window.AudioContext || window.webkitAudioContext;
    if (!A) return null;
    if (!this.ctx) this.ctx = new A();
    return this.ctx;
  },
  _decode(b64) {
    let raw = b64;
    if (typeof raw === 'string' && raw.indexOf('data:') === 0) raw = raw.split(',').pop();  // 去 dataURI 前缀取裸 base64
    const bytes = atob(raw), arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    return arr.buffer.slice(0);  // slice 防 buffer 复用
  },
  async init() {
    const c = this._ac();
    if (!c || !ASSETS.audio) return;
    for (const k of Object.keys(ASSETS.audio)) {
      const v = ASSETS.audio[k];
      if (typeof v !== 'string' || !v) continue;
      this.buffers[k] = await c.decodeAudioData(this._decode(v));
    }
    if (ASSETS.bgm) for (const k of Object.keys(ASSETS.bgm)) {
      const v = ASSETS.bgm[k];
      if (typeof v !== 'string' || !v) continue;
      this.bgmBufs[k] = await c.decodeAudioData(this._decode(v));
    }
    this.bgm.muted = localStorage.getItem('stardew_bgm') === 'off';
    this.muted = localStorage.getItem('stardew_sfx') === 'off';
  },
  unlock() {
    const c = this._ac();
    if (c && c.state === 'suspended') c.resume();
  },
  play(name, vol = 0.6) {
    if (this.muted) return;
    const c = this._ac(), buf = this.buffers[name];
    if (!c || !buf) return;
    if (this._active >= 4) return;  // 池化骨架：限 4 并发
    const s = c.createBufferSource(); s.buffer = buf;
    const g = c.createGain();
    const now = c.currentTime;
    const fadeIn = Math.min(0.025, buf.duration * 0.2);                    // 淡入 25ms（超长音按 20% 收）
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(vol, now + fadeIn);
    let tail = 0;
    if (buf.duration < 0.25) tail = Math.min(0.06, buf.duration * 0.3);    // 短音尾 60ms 淡出
    else tail = 0.1;                                                       // 长音尾 100ms 淡出
    g.gain.setValueAtTime(vol, now + buf.duration - tail);
    g.gain.linearRampToValueAtTime(0, now + buf.duration);
    s.connect(g); g.connect(c.destination);
    this._active++;
    s.onended = () => { this._active--; };
    s.start();
  },
  setMute(m) {
    this.muted = !!m;
    localStorage.setItem('stardew_sfx', m ? 'off' : 'on');
  },
  playBgm(key) {
    if (this.bgm.muted || this.bgm.src) return;
    const c = this._ac(), buf = this.bgmBufs[key];
    if (!c || !buf) return;
    const s = c.createBufferSource(); s.buffer = buf; s.loop = true;
    const g = c.createGain();
    g.gain.setValueAtTime(0, c.currentTime);
    g.gain.linearRampToValueAtTime(0.35, c.currentTime + 1.5);
    s.connect(g); g.connect(c.destination);
    this.bgm.src = s; this.bgm.gain = g; this.bgm.scene = key;
    s.start();
  },
  playBgmRandom(keys) {
    if (this.bgm.muted || this.bgm.src) return;
    const valid = (Array.isArray(keys) ? keys : []).filter(k => this.bgmBufs[k]);
    if (!valid.length) return;
    const c = this._ac();
    const myGen = ++this.bgm.gen; this.bgm.dead = false; this.bgm.keys = valid;
    const pick = () => valid[Math.floor(Math.random() * valid.length)];
    const self = this;
    const startNext = (key, fade) => {
      if (self.bgm.dead || myGen !== self.bgm.gen) return;
      const buf = self.bgmBufs[key];
      const s = c.createBufferSource(); s.buffer = buf; s.loop = false;
      const g = c.createGain();
      const now = c.currentTime;
      const tail = 0.1;  // 尾 100ms 淡出
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.35, now + fade);
      g.gain.setValueAtTime(0.35, now + buf.duration - tail);
      g.gain.linearRampToValueAtTime(0, now + buf.duration);
      s.onended = () => {
        if (self.bgm.dead || myGen !== self.bgm.gen) return;
        let next = pick();
        while (next === self.bgm.scene && valid.length > 1) next = pick();  // 防连续同曲
        self.bgm.scene = next;
        startNext(next, 0.25);  // 250ms 淡入接下一首
      };
      s.connect(g); g.connect(c.destination);
      self.bgm.src = s; self.bgm.gain = g; self.bgm.scene = key;
      s.start();
    };
    startNext(pick(), 0.25);  // 随机起点，250ms 淡入
  },
  stopBgm(fadeMs = 800) {
    if (!this.bgm.src) return;
    this.bgm.dead = true; this.bgm.keys = null; this.bgm.gen++;  // 断链 + 作废一切在途/孤儿链令牌
    const c = this._ac();
    this.bgm.gain.gain.setValueAtTime(this.bgm.gain.gain.value, c.currentTime);
    this.bgm.gain.gain.setTargetAtTime(0, c.currentTime, (fadeMs||800)/3000);
    const src = this.bgm.src, g = this.bgm.gain;
    setTimeout(() => { try { src.stop(); } catch (e) {} src.disconnect(); if (g) g.disconnect(); }, fadeMs||800);
    this.bgm.src = null; this.bgm.gain = null;
  },
  setBgmMute(m) {
    this.bgm.muted = !!m;
    localStorage.setItem('stardew_bgm', m ? 'off' : 'on');
    if (m && this.bgm.src) this.stopBgm();
  },
};
['pointerdown', 'keydown', 'touchstart'].forEach(e => window.addEventListener(e, () => SFX.unlock(), { passive: true }));
SFX.readyPromise = new Promise((resolve) => {
  window.addEventListener('load', () => { SFX.init().then(resolve); });
});
window.SFX = SFX;
