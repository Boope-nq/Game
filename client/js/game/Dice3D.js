import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/**
 * High-Fidelity 3D Monolithic Resin Animated Dice System for Catan: Seafarers
 * Features:
 * - 100% Nguyên khối (Solid watertight RoundedBoxGeometry with smooth bevelled edges and spherical corners)
 * - Seamless solid resin body with zero transparent gaps or seams between faces
 * - Recessed/drilled 3D pip cavities with enamel lacquer finish and subtle edge catchlights
 * - Attached directly to Camera Space for 100% viewport visibility on all screens
 * - Die 1: Classic Warm Amber Gold with Deep Ruby Red pips
 * - Die 2: Deep Crimson Red with Crisp White pips
 * - Realistic tumbling, gravity drop, and 3 damped acoustic bounces with Web Audio clacks
 * - Precise target face orientation (tilted towards player for optimal legibility)
 * - 4.0-second stationary rest period so players can clearly read the result
 * - Smooth 0.6-second dissolve / fade out after the 4-second hold
 */

export class Dice3D {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;

        // Group is child of camera to guarantee perfect framing regardless of board orbit/pan/zoom
        this.diceGroup = new THREE.Group();
        this.camera.add(this.diceGroup);
        if (!this.scene.children.includes(this.camera)) {
            this.scene.add(this.camera);
        }

        // NOTE: We do NOT add AmbientLight or wide PointLights to diceGroup.
        // Adding AmbientLight to any object in Three.js washes out the entire world/island!
        // Instead, the dice receive the existing scene lighting + self-contained emissive tone.

        this.die1 = null;
        this.die2 = null;
        this.dieEvent = null;
        this.die1Materials = [];
        this.die2Materials = [];
        this.dieEventMaterials = [];

        this.isRolling = false;
        this.rollPhase = 'idle'; // 'drop' | 'hold' | 'fade' | 'idle'
        this.phaseStartTime = 0;

        this.dropDuration = 1.35; // seconds
        this.holdDuration = 2.0;  // 2 seconds stationary hold as requested!
        this.fadeDuration = 0.55; // seconds fade out

        this.targetD1 = 1;
        this.targetD2 = 1;
        this.targetEvent = null; // 'ship' | 'science' | 'trade' | 'politics'
        this.onComplete = null;

        this._initDiceMaterials();
        this._buildDice();
        this.diceGroup.visible = false;
    }

    _createFaceTexture(pipCount, bgColor, pipColor) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        // 1. 100% SOLID MONOLITHIC RESIN BODY - NO TRANSPARENCY, NO GAPS
        // Fill entire canvas completely so borders meet adjacent faces with 0 seam
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, 256, 256);

        // 2. Ultra-subtle surface depth (radial sheen across face, keeping edges exact matching bgColor)
        const grad = ctx.createRadialGradient(128, 128, 30, 128, 128, 175);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.12)'); // soft top specular sheen
        grad.addColorStop(0.65, 'rgba(0, 0, 0, 0)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0.06)'); // very subtle edge darkening
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 256, 256);

        // 3. Sunken drilled pips with enameled lacquer fill and catchlights
        const pipRadius = 22;
        const drawPip = (x, y) => {
            ctx.save();

            // A. Sunken hole socket shadow (gives realistic engraved 3D depth)
            ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
            ctx.shadowBlur = 5;
            ctx.shadowOffsetX = 1;
            ctx.shadowOffsetY = 2;

            ctx.fillStyle = pipColor;
            ctx.beginPath();
            ctx.arc(x, y, pipRadius, 0, Math.PI * 2);
            ctx.fill();

            // Reset shadow before highlights
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;

            // B. Tiny bevel catchlight on the bottom rim of the socket hole
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.arc(x, y + 1, pipRadius - 1, 0.2 * Math.PI, 0.8 * Math.PI);
            ctx.stroke();

            // C. Tiny glossy specular glint on the enamel lacquer
            ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
            ctx.beginPath();
            ctx.arc(x - 5, y - 5, 4.5, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        };

        const c = 128;
        const l = 72;
        const r = 184;
        const t = 72;
        const b = 184;

        switch (pipCount) {
            case 1:
                drawPip(c, c);
                break;
            case 2:
                drawPip(l, t);
                drawPip(r, b);
                break;
            case 3:
                drawPip(l, t);
                drawPip(c, c);
                drawPip(r, b);
                break;
            case 4:
                drawPip(l, t);
                drawPip(r, t);
                drawPip(l, b);
                drawPip(r, b);
                break;
            case 5:
                drawPip(l, t);
                drawPip(r, t);
                drawPip(c, c);
                drawPip(l, b);
                drawPip(r, b);
                break;
            case 6:
                drawPip(l, t);
                drawPip(r, t);
                drawPip(l, c);
                drawPip(r, c);
                drawPip(l, b);
                drawPip(r, b);
                break;
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.anisotropy = 4;
        return texture;
    }

    _createEventFaceTexture(symbolType) {
        // symbolType: 'ship' | 'science' | 'trade' | 'politics'
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        // Ivory / Pearl White Body for Event Die
        const bgColor = '#f8fafc';
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, 256, 256);

        // Radial luster
        const grad = ctx.createRadialGradient(128, 128, 30, 128, 128, 175);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
        grad.addColorStop(0.65, 'rgba(0, 0, 0, 0)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0.08)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 256, 256);

        // Outer ornate border frame
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 6;
        ctx.strokeRect(16, 16, 224, 224);

        const c = 128;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (symbolType === 'ship') {
            // Black Barbarian Warship face
            ctx.fillStyle = '#0f172a';
            ctx.beginPath();
            ctx.arc(c, c, 76, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 4;
            ctx.stroke();

            // Skull / Ship flag icon
            ctx.font = '84px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
            ctx.fillText('🏴‍☠️', c - 4, c + 2);
        } else if (symbolType === 'science') {
            // Green Science Gate
            ctx.fillStyle = '#059669';
            ctx.beginPath();
            ctx.roundRect ? ctx.roundRect(46, 46, 164, 164, 24) : ctx.rect(46, 46, 164, 164);
            ctx.fill();
            ctx.strokeStyle = '#6ee7b7';
            ctx.lineWidth = 6;
            ctx.stroke();

            ctx.font = '82px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
            ctx.fillText('🧪', c, c + 2);
        } else if (symbolType === 'trade') {
            // Golden Amber Trade Gate
            ctx.fillStyle = '#d97706';
            ctx.beginPath();
            ctx.roundRect ? ctx.roundRect(46, 46, 164, 164, 24) : ctx.rect(46, 46, 164, 164);
            ctx.fill();
            ctx.strokeStyle = '#fde68a';
            ctx.lineWidth = 6;
            ctx.stroke();

            ctx.font = '82px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
            ctx.fillText('⚖️', c, c + 2);
        } else if (symbolType === 'politics') {
            // Royal Blue Politics Gate
            ctx.fillStyle = '#2563eb';
            ctx.beginPath();
            ctx.roundRect ? ctx.roundRect(46, 46, 164, 164, 24) : ctx.rect(46, 46, 164, 164);
            ctx.fill();
            ctx.strokeStyle = '#93c5fd';
            ctx.lineWidth = 6;
            ctx.stroke();

            ctx.font = '82px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
            ctx.fillText('🏛️', c, c + 2);
        }

        ctx.restore();

        const texture = new THREE.CanvasTexture(canvas);
        texture.anisotropy = 4;
        return texture;
    }

    _initDiceMaterials() {
        // Standard opposite faces sum to 7:
        // Index 0: +X = 1 | Index 1: -X = 6
        // Index 2: +Y = 2 | Index 3: -Y = 5
        // Index 4: +Z = 3 | Index 5: -Z = 4
        const yelBg = '#e8a317'; // Warm Golden Honey Amber (slightly lighter)
        const yelPip = '#7f131f'; // Deep Ruby Crimson pip

        const createMat = (pip, bg, pipCol) => new THREE.MeshStandardMaterial({
            map: this._createFaceTexture(pip, bg, pipCol),
            roughness: 0.22,
            metalness: 0.02,
            emissive: new THREE.Color(bg).multiplyScalar(0.06),
            transparent: false,
            opacity: 1.0,
            depthWrite: true,
            depthTest: true
        });

        this.die1Materials = [
            createMat(1, yelBg, yelPip),
            createMat(6, yelBg, yelPip),
            createMat(2, yelBg, yelPip),
            createMat(5, yelBg, yelPip),
            createMat(3, yelBg, yelPip),
            createMat(4, yelBg, yelPip)
        ];

        const redBg = '#b21825'; // Vibrant Deep Crimson Red
        const redPip = '#ffffff'; // Crisp Porcelain White

        this.die2Materials = [
            createMat(1, redBg, redPip),
            createMat(6, redBg, redPip),
            createMat(2, redBg, redPip),
            createMat(5, redBg, redPip),
            createMat(3, redBg, redPip),
            createMat(4, redBg, redPip)
        ];

        // Event Die: 3 Ship faces, 1 Science, 1 Trade, 1 Politics
        // Index 0: +X = 'ship' (1)
        // Index 1: -X = 'ship' (6)
        // Index 2: +Y = 'ship' (2)
        // Index 3: -Y = 'trade' (5)
        // Index 4: +Z = 'politics' (3)
        // Index 5: -Z = 'science' (4)
        const createEvMat = (sym) => new THREE.MeshStandardMaterial({
            map: this._createEventFaceTexture(sym),
            roughness: 0.18,
            metalness: 0.02,
            emissive: new THREE.Color('#ffffff').multiplyScalar(0.04),
            transparent: false,
            opacity: 1.0,
            depthWrite: true,
            depthTest: true
        });

        this.dieEventMaterials = [
            createEvMat('ship'),     // +X (face 1)
            createEvMat('ship'),     // -X (face 6)
            createEvMat('ship'),     // +Y (face 2)
            createEvMat('trade'),    // -Y (face 5)
            createEvMat('politics'), // +Z (face 3)
            createEvMat('science')   // -Z (face 4)
        ];
    }

    _buildDice() {
        // True 3D Rounded Box Geometry (Monolithic solid block with smooth bevelled edges and spherical corners)
        const size = 1.02;
        const bevelRadius = 0.13;
        const bevelSegments = 5;
        const geo = new RoundedBoxGeometry(size, size, size, bevelSegments, bevelRadius);

        this.die1 = new THREE.Mesh(geo, this.die1Materials);
        this.die2 = new THREE.Mesh(geo, this.die2Materials);
        this.dieEvent = new THREE.Mesh(geo, this.dieEventMaterials);

        this.diceGroup.add(this.die1);
        this.diceGroup.add(this.die2);
        this.diceGroup.add(this.dieEvent);
    }

    /**
     * Compute the exact Euler rotation so faceValue faces upward and tilted toward camera (+Z)
     */
    _getFaceEuler(val, yaw = 0) {
        const tiltX = 0.80; // ~46 deg upward tilt towards player for crystal-clear readability
        switch (val) {
            case 2:
                return new THREE.Euler(tiltX, yaw, 0, 'YXZ');
            case 5:
                return new THREE.Euler(tiltX, yaw, Math.PI, 'YXZ');
            case 1:
                return new THREE.Euler(tiltX, yaw, Math.PI / 2, 'YXZ');
            case 6:
                return new THREE.Euler(tiltX, yaw, -Math.PI / 2, 'YXZ');
            case 3:
                return new THREE.Euler(tiltX - Math.PI / 2, yaw, 0, 'YXZ');
            case 4:
                return new THREE.Euler(tiltX + Math.PI / 2, yaw, 0, 'YXZ');
            default:
                return new THREE.Euler(tiltX, yaw, 0, 'YXZ');
        }
    }

    _getEventFaceEuler(sym, yaw = 0) {
        // Face mapping in dieEventMaterials:
        if (sym === 'ship') {
            return this._getFaceEuler(2, yaw); // +Y is ship
        } else if (sym === 'trade') {
            return this._getFaceEuler(5, yaw); // -Y is trade
        } else if (sym === 'politics') {
            return this._getFaceEuler(3, yaw); // +Z is politics
        } else if (sym === 'science') {
            return this._getFaceEuler(4, yaw); // -Z is science
        }
        return this._getFaceEuler(2, yaw);
    }

    _setDiceOpacity(op) {
        const isTrans = op < 0.999;
        const updateMats = (mats) => {
            mats.forEach(m => {
                if (m.transparent !== isTrans) {
                    m.transparent = isTrans;
                    m.needsUpdate = true;
                }
                m.opacity = op;
                m.depthWrite = !isTrans;
            });
        };
        updateMats(this.die1Materials);
        updateMats(this.die2Materials);
        updateMats(this.dieEventMaterials);
    }

    _playClackSound(volume = 0.3) {
        try {
            if (!this.audioCtx) {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (AudioCtx) this.audioCtx = new AudioCtx();
            }
            if (this.audioCtx && this.audioCtx.state === 'suspended') {
                this.audioCtx.resume();
            }
            if (!this.audioCtx) return;

            const now = this.audioCtx.currentTime;

            // Noise burst for surface click
            const bufferSize = Math.floor(this.audioCtx.sampleRate * 0.035);
            const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
            }
            const noise = this.audioCtx.createBufferSource();
            noise.buffer = buffer;

            const filter = this.audioCtx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(620 + Math.random() * 180, now);
            filter.Q.setValueAtTime(2.8, now);

            const osc = this.audioCtx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(450 + Math.random() * 100, now);
            osc.frequency.exponentialRampToValueAtTime(160, now + 0.05);

            const gain = this.audioCtx.createGain();
            gain.gain.setValueAtTime(volume, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

            noise.connect(filter);
            filter.connect(gain);
            osc.connect(gain);
            gain.connect(this.audioCtx.destination);

            noise.start(now);
            osc.start(now);
            noise.stop(now + 0.06);
            osc.stop(now + 0.06);
        } catch (_) {}
    }

    /**
     * Start the 3D roll animation for 2 base dice or 3 C&K dice
     */
    roll(d1, d2, eventDieOrCb, onCompleteCb) {
        let eventDie = null;
        let onComplete = null;

        if (typeof eventDieOrCb === 'function') {
            onComplete = eventDieOrCb;
        } else {
            eventDie = eventDieOrCb;
            onComplete = onCompleteCb;
        }

        this.targetD1 = d1;
        this.targetD2 = d2;
        this.targetEvent = eventDie;
        this.onComplete = onComplete;

        this.isRolling = true;
        this.rollPhase = 'drop';
        this.phaseStartTime = performance.now();
        this.lastBounceStep = -1;

        // Reset visibility, scale and opacity
        this._setDiceOpacity(1.0);
        this.diceGroup.scale.set(1, 1, 1);
        this.diceGroup.visible = true;

        this.isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
        const diceScale = this.isMobile ? (this.targetEvent ? 0.38 : 0.48) : (this.targetEvent ? 0.85 : 1.0);
        this.die1.scale.set(diceScale, diceScale, diceScale);
        this.die2.scale.set(diceScale, diceScale, diceScale);

        if (this.dieEvent) {
            this.dieEvent.scale.set(diceScale, diceScale, diceScale);
            this.dieEvent.visible = !!this.targetEvent;
        }

        if (this.targetEvent) {
            // 3 DICE LAYOUT (Left = Yellow, Middle = Red, Right = Event Die)
            if (this.isMobile) {
                this.startPos1 = new THREE.Vector3(-0.95, 3.8, -7.0);
                this.startPos2 = new THREE.Vector3(0.0, 4.0, -6.8);
                this.startPos3 = new THREE.Vector3(0.95, 3.9, -7.0);

                this.endPos1 = new THREE.Vector3(-0.75, 0.35, -7.0);
                this.endPos2 = new THREE.Vector3(0.0, 0.35, -7.0);
                this.endPos3 = new THREE.Vector3(0.75, 0.35, -7.0);
            } else {
                this.startPos1 = new THREE.Vector3(-2.2, 5.0, -7.0);
                this.startPos2 = new THREE.Vector3(0.0, 5.2, -6.8);
                this.startPos3 = new THREE.Vector3(2.2, 5.1, -7.0);

                this.endPos1 = new THREE.Vector3(-1.65, -0.45, -7.0);
                this.endPos2 = new THREE.Vector3(0.0, -0.45, -7.0);
                this.endPos3 = new THREE.Vector3(1.65, -0.45, -7.0);
            }

            this.spinRate3 = new THREE.Vector3(
                (17 + Math.random() * 12) * (Math.random() < 0.5 ? 1 : -1),
                (21 + Math.random() * 14) * (Math.random() < 0.5 ? 1 : -1),
                (15 + Math.random() * 10) * (Math.random() < 0.5 ? 1 : -1)
            );
            this.finalYaw3 = (Math.random() - 0.5) * 0.35;
            this.finalEuler3 = this._getEventFaceEuler(this.targetEvent, this.finalYaw3);
            this.targetQuat3 = new THREE.Quaternion().setFromEuler(this.finalEuler3);
        } else {
            // 2 DICE LAYOUT (Base Game / Seafarers)
            if (this.isMobile) {
                this.startPos1 = new THREE.Vector3(-0.65, 3.8, -7.0);
                this.startPos2 = new THREE.Vector3(0.65, 4.0, -6.8);
                this.endPos1 = new THREE.Vector3(-0.55, 0.35, -7.0);
                this.endPos2 = new THREE.Vector3(0.55, 0.35, -7.0);
            } else {
                this.startPos1 = new THREE.Vector3(-1.8, 5.0, -7.0);
                this.startPos2 = new THREE.Vector3(1.8, 5.2, -6.8);
                this.endPos1 = new THREE.Vector3(-1.22, -0.45, -7.0);
                this.endPos2 = new THREE.Vector3(1.22, -0.45, -7.0);
            }
        }

        // Random spin velocity (rad/s)
        this.spinRate1 = new THREE.Vector3(
            (16 + Math.random() * 12) * (Math.random() < 0.5 ? 1 : -1),
            (20 + Math.random() * 14) * (Math.random() < 0.5 ? 1 : -1),
            (14 + Math.random() * 10) * (Math.random() < 0.5 ? 1 : -1)
        );
        this.spinRate2 = new THREE.Vector3(
            (18 + Math.random() * 12) * (Math.random() < 0.5 ? 1 : -1),
            (22 + Math.random() * 14) * (Math.random() < 0.5 ? 1 : -1),
            (16 + Math.random() * 10) * (Math.random() < 0.5 ? 1 : -1)
        );

        this.finalYaw1 = (Math.random() - 0.5) * 0.35;
        this.finalYaw2 = (Math.random() - 0.5) * 0.35;

        this.finalEuler1 = this._getFaceEuler(this.targetD1, this.finalYaw1);
        this.finalEuler2 = this._getFaceEuler(this.targetD2, this.finalYaw2);

        this.targetQuat1 = new THREE.Quaternion().setFromEuler(this.finalEuler1);
        this.targetQuat2 = new THREE.Quaternion().setFromEuler(this.finalEuler2);

        // Haptic burst
        if (navigator.vibrate) {
            try { navigator.vibrate([20, 30, 20]); } catch (_) {}
        }
    }

    update(delta) {
        if (!this.isRolling) return;

        const now = performance.now();

        // ─── PHASE 1: DROP, BOUNCE & TUMBLE (0.0s -> 1.35s) ───
        if (this.rollPhase === 'drop') {
            const elapsed = (now - this.phaseStartTime) / 1000;
            const progress = Math.min(1.0, elapsed / this.dropDuration);

            // Interpolate X and Z smoothly
            const easeHorizontal = 1 - Math.pow(1 - progress, 2.5);
            const curX1 = THREE.MathUtils.lerp(this.startPos1.x, this.endPos1.x, easeHorizontal);
            const curZ1 = THREE.MathUtils.lerp(this.startPos1.z, this.endPos1.z, easeHorizontal);
            const curX2 = THREE.MathUtils.lerp(this.startPos2.x, this.endPos2.x, easeHorizontal);
            const curZ2 = THREE.MathUtils.lerp(this.startPos2.z, this.endPos2.z, easeHorizontal);

            let curX3, curZ3, curY3;
            if (this.targetEvent && this.dieEvent) {
                curX3 = THREE.MathUtils.lerp(this.startPos3.x, this.endPos3.x, easeHorizontal);
                curZ3 = THREE.MathUtils.lerp(this.startPos3.z, this.endPos3.z, easeHorizontal);
            }

            // 3-stage damping parabolic bounce on Y
            let curY1, curY2;
            const floorY = this.endPos1.y;

            if (progress < 0.45) {
                // Drop 1 from high down to floor
                const p = progress / 0.45;
                const dropH = this.startPos1.y - floorY;
                curY1 = floorY + dropH * (1 - p * p);
                curY2 = floorY + (this.startPos2.y - floorY) * (1 - p * p);
                if (this.targetEvent) curY3 = floorY + (this.startPos3.y - floorY) * (1 - p * p);
                if (progress >= 0.43 && this.lastBounceStep < 1) {
                    this.lastBounceStep = 1;
                    this._playClackSound(0.4);
                    if (navigator.vibrate) { try { navigator.vibrate(25); } catch (_) {} }
                }
            } else if (progress < 0.82) {
                // Bounce 1: Rebounds up
                const p = (progress - 0.45) / (0.82 - 0.45);
                const bounceHeight = this.isMobile ? 0.65 : 1.35;
                curY1 = floorY + bounceHeight * 4 * p * (1 - p);
                curY2 = floorY + (bounceHeight * 1.05) * 4 * p * (1 - p);
                if (this.targetEvent) curY3 = floorY + (bounceHeight * 0.95) * 4 * p * (1 - p);
                if (progress >= 0.80 && this.lastBounceStep < 2) {
                    this.lastBounceStep = 2;
                    this._playClackSound(0.25);
                    if (navigator.vibrate) { try { navigator.vibrate(15); } catch (_) {} }
                }
            } else if (progress < 0.96) {
                // Bounce 2: Small rebound
                const p = (progress - 0.82) / (0.96 - 0.82);
                const bounceHeight = this.isMobile ? 0.18 : 0.38;
                curY1 = floorY + bounceHeight * 4 * p * (1 - p);
                curY2 = floorY + (bounceHeight * 0.9) * 4 * p * (1 - p);
                if (this.targetEvent) curY3 = floorY + (bounceHeight * 0.85) * 4 * p * (1 - p);
                if (progress >= 0.94 && this.lastBounceStep < 3) {
                    this.lastBounceStep = 3;
                    this._playClackSound(0.15);
                    if (navigator.vibrate) { try { navigator.vibrate(10); } catch (_) {} }
                }
            } else {
                // Settle flat on floor
                curY1 = floorY;
                curY2 = floorY;
                if (this.targetEvent) curY3 = floorY;
            }

            this.die1.position.set(curX1, curY1, curZ1);
            this.die2.position.set(curX2, curY2, curZ2);
            if (this.targetEvent && this.dieEvent) {
                this.dieEvent.position.set(curX3, curY3, curZ3);
            }

            // Rotational tumbling & settling
            if (progress < 0.82) {
                const spinScale = 1 - progress * 0.7;
                this.die1.rotation.x += this.spinRate1.x * delta * spinScale;
                this.die1.rotation.y += this.spinRate1.y * delta * spinScale;
                this.die1.rotation.z += this.spinRate1.z * delta * spinScale;

                this.die2.rotation.x += this.spinRate2.x * delta * spinScale;
                this.die2.rotation.y += this.spinRate2.y * delta * spinScale;
                this.die2.rotation.z += this.spinRate2.z * delta * spinScale;

                if (this.targetEvent && this.dieEvent) {
                    this.dieEvent.rotation.x += this.spinRate3.x * delta * spinScale;
                    this.dieEvent.rotation.y += this.spinRate3.y * delta * spinScale;
                    this.dieEvent.rotation.z += this.spinRate3.z * delta * spinScale;
                }
            } else {
                // Smooth quaternion SLERP to target face orientation
                const settleP = Math.min(1.0, (progress - 0.82) / (1.0 - 0.82));
                const slerpFactor = Math.pow(settleP, 2);
                this.die1.quaternion.slerp(this.targetQuat1, Math.min(1.0, slerpFactor * 0.5 + 0.5));
                this.die2.quaternion.slerp(this.targetQuat2, Math.min(1.0, slerpFactor * 0.5 + 0.5));
                if (this.targetEvent && this.dieEvent) {
                    this.dieEvent.quaternion.slerp(this.targetQuat3, Math.min(1.0, slerpFactor * 0.5 + 0.5));
                }
            }

            // Drop completed: snap to exact landing position & orientation, then ENTER HOLD PHASE
            if (progress >= 1.0) {
                this.die1.position.copy(this.endPos1);
                this.die2.position.copy(this.endPos2);
                this.die1.quaternion.copy(this.targetQuat1);
                this.die2.quaternion.copy(this.targetQuat2);

                if (this.targetEvent && this.dieEvent) {
                    this.dieEvent.position.copy(this.endPos3);
                    this.dieEvent.quaternion.copy(this.targetQuat3);
                }

                // Notify callback immediately so game state & HUD score update
                if (this.onComplete) {
                    this.onComplete(this.targetD1, this.targetD2, this.targetEvent);
                    this.onComplete = null;
                }

                // Transition to STATIONARY HOLD PHASE
                this.rollPhase = 'hold';
                this.phaseStartTime = performance.now();
            }
        }

        // ─── PHASE 2: STATIONARY REST ───
        else if (this.rollPhase === 'hold') {
            const holdElapsed = (now - this.phaseStartTime) / 1000;

            // Keep dice completely stable and visible
            this.die1.position.copy(this.endPos1);
            this.die2.position.copy(this.endPos2);
            this.die1.quaternion.copy(this.targetQuat1);
            this.die2.quaternion.copy(this.targetQuat2);

            if (this.targetEvent && this.dieEvent) {
                this.dieEvent.position.copy(this.endPos3);
                this.dieEvent.quaternion.copy(this.targetQuat3);
            }

            // Transition to fade-out
            if (holdElapsed >= this.holdDuration) {
                this.rollPhase = 'fade';
                this.phaseStartTime = performance.now();
            }
        }

        // ─── PHASE 3: SMOOTH FADE OUT & DISSOLVE ───
        else if (this.rollPhase === 'fade') {
            const fadeElapsed = (now - this.phaseStartTime) / 1000;
            const fadeProgress = Math.min(1.0, fadeElapsed / this.fadeDuration);

            // Fade opacity 1 -> 0
            const opacity = 1.0 - fadeProgress;
            this._setDiceOpacity(opacity);

            // Subtle shrink 1.0 -> 0.75
            const scale = 1.0 - fadeProgress * 0.25;
            this.diceGroup.scale.set(scale, scale, scale);

            if (fadeProgress >= 1.0) {
                this.diceGroup.visible = false;
                this.isRolling = false;
                this.rollPhase = 'idle';
            }
        }
    }
}
