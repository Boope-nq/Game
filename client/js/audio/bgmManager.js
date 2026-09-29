/**
 * Eldora Background Music Manager
 * Handles auto-play with browser gesture fallback, seamless looping,
 * volume control, mute toggling, and persistent user preferences.
 */

export class BGMManager {
    constructor(src, buttonId = null, volume = 0.4) {
        this.src = src;
        this.targetVolume = volume;
        this.buttonId = buttonId;
        this.storageKey = 'eldora_bgm_muted';
        
        // Check saved mute state (default is unmuted: false)
        this.isMuted = localStorage.getItem(this.storageKey) === 'true';

        this.audio = new Audio(this.src);
        this.audio.loop = true;
        this.audio.preload = 'auto';
        this.audio.volume = this.isMuted ? 0 : this.targetVolume;

        // Extra fallback: when track ends, rewind and replay
        this.audio.addEventListener('ended', () => {
            this.audio.currentTime = 0;
            if (!this.isMuted) {
                this.audio.play().catch(() => {});
            }
        });

        this.isPlaying = false;
        this._setupButton();
        this._setupAutoPlay();
    }

    _setupButton() {
        if (!this.buttonId) return;
        const btn = document.getElementById(this.buttonId);
        if (!btn) return;

        this._updateButtonUI(btn);

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle();
        });
    }

    _updateButtonUI(btn) {
        if (!btn && this.buttonId) {
            btn = document.getElementById(this.buttonId);
        }
        if (!btn) return;

        if (this.isMuted) {
            btn.innerHTML = `
                <svg class="mono-icon" style="width:18px;height:18px;vertical-align:middle;" viewBox="0 0 24 24"><path fill="currentColor" d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27l4.73 4.73H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
                <span style="margin-left:5px;">Bật Nhạc</span>
            `;
            btn.setAttribute('title', 'Bật nhạc nền');
            btn.style.opacity = '0.75';
        } else {
            btn.innerHTML = `
                <svg class="mono-icon" style="width:18px;height:18px;vertical-align:middle;" viewBox="0 0 24 24"><path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
                <span style="margin-left:5px;">Tắt Nhạc</span>
            `;
            btn.setAttribute('title', 'Tắt nhạc nền');
            btn.style.opacity = '1';
        }
    }

    _setupAutoPlay() {
        if (this.isMuted) return;

        const startPlayback = () => {
            if (this.isMuted) return;
            this.audio.play().then(() => {
                this.isPlaying = true;
                this._cleanupInteractionListeners();
            }).catch(() => {
                // Browser still restricting autoplay, wait for next user action
            });
        };

        this._interactionHandler = () => {
            startPlayback();
        };

        // Try immediate play
        this.audio.play().then(() => {
            this.isPlaying = true;
        }).catch(() => {
            // Register interaction listeners for browser autoplay policy
            ['click', 'keydown', 'touchstart', 'pointerdown'].forEach(evt => {
                window.addEventListener(evt, this._interactionHandler, { once: true, passive: true });
            });
        });
    }

    _cleanupInteractionListeners() {
        if (!this._interactionHandler) return;
        ['click', 'keydown', 'touchstart', 'pointerdown'].forEach(evt => {
            window.removeEventListener(evt, this._interactionHandler);
        });
        this._interactionHandler = null;
    }

    toggle() {
        this.isMuted = !this.isMuted;
        localStorage.setItem(this.storageKey, this.isMuted ? 'true' : 'false');

        if (this.isMuted) {
            this.audio.pause();
            this.isPlaying = false;
        } else {
            this.audio.volume = this.targetVolume;
            this.audio.play().then(() => {
                this.isPlaying = true;
            }).catch(() => {});
        }

        this._updateButtonUI();
    }

    setVolume(vol) {
        this.targetVolume = Math.max(0, Math.min(1, vol));
        if (!this.isMuted) {
            this.audio.volume = this.targetVolume;
        }
    }

    destroy() {
        this._cleanupInteractionListeners();
        this.audio.pause();
        this.audio.src = '';
    }
}
