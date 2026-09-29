/**
 * Web Audio API procedurally synthesized sound effects and ambient drone.
 * Replicates the audio synthesis from the Unity project with zero external dependencies.
 */
export class AudioService {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;

    // Volume settings (0..1) with localStorage persistence
    this.masterVolume = this._loadPref('apa_master_vol', 0.8);
    this.musicVolume = this._loadPref('apa_music_vol', 0.6);
    this.sfxVolume = this._loadPref('apa_sfx_vol', 0.9);

    this.isMuteAll = this._loadPref('apa_mute_all', false);
    this.isMuteBgm = this._loadPref('apa_mute_bgm', false);
    this.isMuteSfx = this._loadPref('apa_mute_sfx', false);

    this.bgmOscs = [];
    this.bgmGain = null;
    this.bgmRunning = false;

    this._initialized = false;
  }

  _loadPref(key, defaultVal) {
    try {
      const stored = localStorage.getItem(key);
      if (stored !== null) return JSON.parse(stored);
    } catch (e) {}
    return defaultVal;
  }

  _savePref(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {}
  }

  init() {
    if (this._initialized) return;

    try {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtxClass) {
        console.warn('Web Audio API is not supported in this browser.');
        return;
      }
      this.ctx = new AudioCtxClass();

      // Master Gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.isMuteAll ? 0 : this.masterVolume;
      this.masterGain.connect(this.ctx.destination);

      // Music Gain
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = (this.isMuteAll || this.isMuteBgm) ? 0 : this.musicVolume;
      this.musicGain.connect(this.masterGain);

      // SFX Gain
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = (this.isMuteAll || this.isMuteSfx) ? 0 : this.sfxVolume;
      this.sfxGain.connect(this.masterGain);

      this._initialized = true;
    } catch (e) {
      console.warn('AudioContext initialization error:', e);
    }
  }

  ensureContext() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setMasterVolume(val) {
    this.masterVolume = Math.max(0, Math.min(1, val));
    this._savePref('apa_master_vol', this.masterVolume);
    if (this.masterGain && this.ctx) {
      const g = this.isMuteAll ? 0 : this.masterVolume;
      this.masterGain.gain.setTargetAtTime(g, this.ctx.currentTime, 0.03);
    }
  }

  setMusicVolume(val) {
    this.musicVolume = Math.max(0, Math.min(1, val));
    this._savePref('apa_music_vol', this.musicVolume);
    if (this.musicGain && this.ctx) {
      const g = (this.isMuteAll || this.isMuteBgm) ? 0 : this.musicVolume;
      this.musicGain.gain.setTargetAtTime(g, this.ctx.currentTime, 0.03);
    }
  }

  setSfxVolume(val) {
    this.sfxVolume = Math.max(0, Math.min(1, val));
    this._savePref('apa_sfx_vol', this.sfxVolume);
    if (this.sfxGain && this.ctx) {
      const g = (this.isMuteAll || this.isMuteSfx) ? 0 : this.sfxVolume;
      this.sfxGain.gain.setTargetAtTime(g, this.ctx.currentTime, 0.03);
    }
  }

  toggleMuteAll() {
    this.isMuteAll = !this.isMuteAll;
    this._savePref('apa_mute_all', this.isMuteAll);
    this.setMasterVolume(this.masterVolume);
    return this.isMuteAll;
  }

  toggleMuteBgm() {
    this.isMuteBgm = !this.isMuteBgm;
    this._savePref('apa_mute_bgm', this.isMuteBgm);
    this.setMusicVolume(this.musicVolume);
    return this.isMuteBgm;
  }

  toggleMuteSfx() {
    this.isMuteSfx = !this.isMuteSfx;
    this._savePref('apa_mute_sfx', this.isMuteSfx);
    this.setSfxVolume(this.sfxVolume);
    return this.isMuteSfx;
  }

  startBgm() {
    if (this.bgmRunning) return;
    this.ensureContext();
    if (!this.ctx) return;

    try {
      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.setValueAtTime(0.18, this.ctx.currentTime);
      this.bgmGain.connect(this.musicGain);

      // Procedural drone chords: D3 (146.83Hz), A3 (220.0Hz), D4 (293.66Hz)
      const freqs = [146.83, 220.0, 293.66];
      const gains = [0.35, 0.25, 0.15];

      this.bgmOscs = freqs.map((freq, idx) => {
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        const oscGain = this.ctx.createGain();
        oscGain.gain.setValueAtTime(gains[idx], this.ctx.currentTime);

        // Slow LFO modulation
        const lfo = this.ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(0.25 + idx * 0.1, this.ctx.currentTime);

        const lfoGain = this.ctx.createGain();
        lfoGain.gain.setValueAtTime(0.1, this.ctx.currentTime);

        lfo.connect(lfoGain);
        lfoGain.connect(oscGain.gain);

        osc.connect(oscGain);
        oscGain.connect(this.bgmGain);

        osc.start();
        lfo.start();
        return { osc, lfo };
      });

      this.bgmRunning = true;
    } catch (e) {
      console.warn('Could not start BGM:', e);
    }
  }

  stopBgm() {
    if (!this.bgmRunning) return;
    try {
      this.bgmOscs.forEach(({ osc, lfo }) => {
        osc.stop();
        lfo.stop();
      });
      this.bgmOscs = [];
      this.bgmRunning = false;
    } catch (e) {
      console.warn('Could not stop BGM:', e);
    }
  }

  playButtonClick() {
    this.ensureContext();
    if (!this.ctx || this.isMuteAll || this.isMuteSfx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, t);
    osc.frequency.exponentialRampToValueAtTime(600, t + 0.05);

    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.05);
  }

  playPieceSelect() {
    this.ensureContext();
    if (!this.ctx || this.isMuteAll || this.isMuteSfx) return;

    const t = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(660, t);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(990, t);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.sfxGain);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.12);
    osc2.stop(t + 0.12);
  }

  playGoatPlace() {
    this.ensureContext();
    if (!this.ctx || this.isMuteAll || this.isMuteSfx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const subOsc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(380, t);
    osc.frequency.exponentialRampToValueAtTime(180, t + 0.18);

    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(110, t);

    gain.gain.setValueAtTime(0.45, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    osc.connect(gain);
    subOsc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    subOsc.start(t);
    osc.stop(t + 0.18);
    subOsc.stop(t + 0.18);
  }

  playTigerMove() {
    this.ensureContext();
    if (!this.ctx || this.isMuteAll || this.isMuteSfx) return;

    const t = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(280, t);
    osc1.frequency.exponentialRampToValueAtTime(140, t + 0.20);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(560, t);
    osc2.frequency.exponentialRampToValueAtTime(280, t + 0.20);

    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.20);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.sfxGain);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.20);
    osc2.stop(t + 0.20);
  }

  playTigerCapture() {
    this.ensureContext();
    if (!this.ctx || this.isMuteAll || this.isMuteSfx) return;

    const t = this.ctx.currentTime;
    const strike = this.ctx.createOscillator();
    const bell1 = this.ctx.createOscillator();
    const bell2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    strike.type = 'triangle';
    strike.frequency.setValueAtTime(440, t);
    strike.frequency.exponentialRampToValueAtTime(110, t + 0.1);

    bell1.type = 'sine';
    bell1.frequency.setValueAtTime(880, t);

    bell2.type = 'sine';
    bell2.frequency.setValueAtTime(1320, t);

    gain.gain.setValueAtTime(0.55, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

    strike.connect(gain);
    bell1.connect(gain);
    bell2.connect(gain);
    gain.connect(this.sfxGain);

    strike.start(t);
    bell1.start(t);
    bell2.start(t);
    strike.stop(t + 0.45);
    bell1.stop(t + 0.45);
    bell2.stop(t + 0.45);
  }

  playInvalidMove() {
    this.ensureContext();
    if (!this.ctx || this.isMuteAll || this.isMuteSfx) return;

    const t = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(130, t);

    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(175, t);

    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.sfxGain);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.15);
    osc2.stop(t + 0.15);
  }

  playVictory() {
    this.ensureContext();
    if (!this.ctx || this.isMuteAll || this.isMuteSfx) return;

    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    const stepDuration = 0.18;

    notes.forEach((freq, idx) => {
      const noteTime = this.ctx.currentTime + idx * stepDuration;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0.4, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.4);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(noteTime);
      osc.stop(noteTime + 0.4);
    });
  }
}
