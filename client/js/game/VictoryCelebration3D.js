import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

/**
 * 3D Victory Celebration Stage
 * Displays the winner's 3D avatar (Bunny Pirate) celebrating on a golden pedestal
 * with confetti, lighting, floating crown, and celebratory animations.
 */
export class VictoryCelebration3D {
    constructor(containerId = 'win-avatar-stage', winnerData = null) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        this.winnerData = winnerData;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.model = null;
        this.crown = null;
        this.pedestal = null;
        this.confettiGroup = null;
        this.confettiParticles = [];
        this.sparklesGroup = null;
        this.clock = new THREE.Clock();
        this.animId = null;
        this.isMegaJumping = false;
        this.megaJumpProgress = 0;
        this.baseModelY = 0;
        this.modelScale = 1;
        this.isInitialized = false;
        this.loader = new GLTFLoader();
    }

    async init() {
        if (!this.container) {
            this.container = document.getElementById(this.containerId);
        }
        if (!this.container) return;

        // Clean container
        this.container.innerHTML = '';

        const width = this.container.clientWidth || 380;
        const height = this.container.clientHeight || 300;

        // Scene
        this.scene = new THREE.Scene();

        // Camera
        this.camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
        this.camera.position.set(0, 1.8, 4.2);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.35;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);

        // Controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.08;
        this.controls.enableZoom = true;
        this.controls.minDistance = 2.2;
        this.controls.maxDistance = 6.0;
        this.controls.maxPolarAngle = Math.PI / 2 + 0.1; // Don't go below floor
        this.controls.target.set(0, 1.1, 0);
        this.controls.update();

        // Lighting
        this.setupLighting();

        // Podium / Pedestal
        this.setupPodium();

        // Confetti & Sparkles
        this.setupConfetti();
        this.setupSparkles();

        // Floating Crown
        this.setupCrown();

        // Loading indicator
        this.showLoadingIndicator();

        // Load 3D Champion Model (Thỏ, Cáo, Khỉ hoặc Rái Cá tùy theo avatar & animation được chọn)
        let modelUrl = 'assets/models/bunny_rigged.glb';
        let animUrl = 'assets/models/bunny_anim.glb';

        // Read custom chosen animation (from winnerData or localStorage)
        const chosenAnim = (this.winnerData && this.winnerData.anim) || localStorage.getItem('userCelebrationAnim') || 'bunny_anim';
        if (chosenAnim === 'dance_05' || chosenAnim === 'fox_dance') animUrl = 'assets/models/fox_dance.glb';
        else if (chosenAnim === 'front_kick_02' || chosenAnim === 'monkey_anim') animUrl = 'assets/models/monkey_anim.glb';
        else if (chosenAnim === 'dance_02' || chosenAnim === 'otter_anim') animUrl = 'assets/models/otter_anim.glb';
        else animUrl = 'assets/models/bunny_anim.glb';

        // Read character avatar (from winnerData or localStorage)
        const charAvatar = (this.winnerData && (this.winnerData.avatarId || this.winnerData.avatar)) || localStorage.getItem('userAvatar') || 'bunny_pirate';
        if (charAvatar === '🦊' || charAvatar === 'fox_explorer' || (typeof charAvatar === 'string' && charAvatar.includes('fox'))) {
            modelUrl = 'assets/models/fox_pirate.glb';
        } else if (charAvatar === '🐵' || charAvatar === '🐒' || charAvatar === 'monkey_pirate' || (typeof charAvatar === 'string' && charAvatar.includes('monkey'))) {
            modelUrl = 'assets/models/monkey_pirate.glb';
        } else if (charAvatar === '🦦' || charAvatar === 'otter_pirate' || (typeof charAvatar === 'string' && charAvatar.includes('otter'))) {
            modelUrl = 'assets/models/otter_pirate.glb';
        } else {
            modelUrl = 'assets/models/bunny_rigged.glb';
        }
        await this.loadModel(modelUrl, animUrl);

        // Resize handler
        window.addEventListener('resize', this.onResize.bind(this));

        // Start render loop
        this.clock.start();
        this.isInitialized = true;
        this.animate();
    }

    setupLighting() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
        this.scene.add(ambientLight);

        // Main Spotlight hitting the champion from above-front
        const spotLight = new THREE.SpotLight(0xfff1cc, 3.5);
        spotLight.position.set(0, 5, 3.5);
        spotLight.angle = Math.PI / 4.5;
        spotLight.penumbra = 0.5;
        spotLight.castShadow = true;
        this.scene.add(spotLight);

        // Back Rim Light for dramatic silhouette glow
        const rimLight = new THREE.DirectionalLight(0x4cc3ff, 2.0);
        rimLight.position.set(0, 3, -3);
        this.scene.add(rimLight);

        // Golden Warm Fill Light from left
        const goldFill = new THREE.PointLight(0xffd700, 1.8, 10);
        goldFill.position.set(-2.5, 1.5, 2);
        this.scene.add(goldFill);

        // Cyan Fill Light from right
        const cyanFill = new THREE.PointLight(0x00e5ff, 1.4, 10);
        cyanFill.position.set(2.5, 1.5, 2);
        this.scene.add(cyanFill);
    }

    setupPodium() {
        const podiumGroup = new THREE.Group();

        // Base Step
        const baseGeo = new THREE.CylinderGeometry(1.6, 1.75, 0.22, 32);
        const baseMat = new THREE.MeshStandardMaterial({
            color: 0x1a3350,
            metalness: 0.6,
            roughness: 0.3
        });
        const baseMesh = new THREE.Mesh(baseGeo, baseMat);
        baseMesh.position.y = 0.11;
        baseMesh.receiveShadow = true;
        podiumGroup.add(baseMesh);

        // Golden Champion Ring
        const ringGeo = new THREE.TorusGeometry(1.58, 0.05, 16, 48);
        const ringMat = new THREE.MeshStandardMaterial({
            color: 0xffd700,
            metalness: 0.9,
            roughness: 0.15,
            emissive: 0x664400
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.rotation.x = Math.PI / 2;
        ringMesh.position.y = 0.22;
        podiumGroup.add(ringMesh);

        // Golden Pedestal Pillar
        const pillarGeo = new THREE.CylinderGeometry(1.35, 1.45, 0.45, 32);
        const pillarMat = new THREE.MeshStandardMaterial({
            color: 0xffb703,
            metalness: 0.85,
            roughness: 0.2,
            emissive: 0x332200
        });
        const pillarMesh = new THREE.Mesh(pillarGeo, pillarMat);
        pillarMesh.position.y = 0.45;
        pillarMesh.receiveShadow = true;
        pillarMesh.castShadow = true;
        podiumGroup.add(pillarMesh);

        // Top Velvet Mat
        const topGeo = new THREE.CylinderGeometry(1.3, 1.3, 0.05, 32);
        const topMat = new THREE.MeshStandardMaterial({
            color: 0xa81c1c, // Royal Red
            metalness: 0.1,
            roughness: 0.8
        });
        const topMesh = new THREE.Mesh(topGeo, topMat);
        topMesh.position.y = 0.69;
        topMesh.receiveShadow = true;
        podiumGroup.add(topMesh);

        this.scene.add(podiumGroup);
        this.pedestal = podiumGroup;
        this.basePedestalTopY = 0.71;
    }

    setupCrown() {
        // Procedural Golden 3D Crown floating above champion's head
        const crownGroup = new THREE.Group();
        const goldMat = new THREE.MeshStandardMaterial({
            color: 0xffdf00,
            metalness: 0.95,
            roughness: 0.1,
            emissive: 0x553300
        });
        const rubyMat = new THREE.MeshStandardMaterial({
            color: 0xff0044,
            metalness: 0.3,
            roughness: 0.1,
            emissive: 0x330011
        });

        // Crown ring base
        const ringGeo = new THREE.CylinderGeometry(0.24, 0.22, 0.08, 16);
        const ring = new THREE.Mesh(ringGeo, goldMat);
        crownGroup.add(ring);

        // 5 Crown spikes
        const numSpikes = 5;
        for (let i = 0; i < numSpikes; i++) {
            const angle = (i / numSpikes) * Math.PI * 2;
            const spikeGeo = new THREE.ConeGeometry(0.06, 0.18, 4);
            const spike = new THREE.Mesh(spikeGeo, goldMat);
            spike.position.set(Math.cos(angle) * 0.22, 0.12, Math.sin(angle) * 0.22);
            crownGroup.add(spike);

            // Small jewel on top of each spike
            const jewelGeo = new THREE.SphereGeometry(0.03, 8, 8);
            const jewel = new THREE.Mesh(jewelGeo, rubyMat);
            jewel.position.set(Math.cos(angle) * 0.22, 0.22, Math.sin(angle) * 0.22);
            crownGroup.add(jewel);
        }

        crownGroup.position.set(0, 2.55, 0);
        this.scene.add(crownGroup);
        this.crown = crownGroup;
    }

    setupConfetti() {
        this.confettiGroup = new THREE.Group();
        const colors = [0xffd700, 0xff3b30, 0x34c759, 0x007aff, 0xaf52de, 0xff9500, 0x00ffff];
        const count = 90;

        const particleGeo = new THREE.PlaneGeometry(0.08, 0.08);

        for (let i = 0; i < count; i++) {
            const color = colors[i % colors.length];
            const mat = new THREE.MeshBasicMaterial({
                color: color,
                side: THREE.DoubleSide
            });
            const mesh = new THREE.Mesh(particleGeo, mat);

            // Initial random distribution
            mesh.position.set(
                (Math.random() - 0.5) * 4.0,
                0.8 + Math.random() * 3.5,
                (Math.random() - 0.5) * 3.5
            );
            mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);

            // Physics velocity properties
            mesh.userData = {
                vy: -(0.015 + Math.random() * 0.025),
                vx: (Math.random() - 0.5) * 0.01,
                vz: (Math.random() - 0.5) * 0.01,
                rotX: (Math.random() - 0.5) * 0.08,
                rotY: (Math.random() - 0.5) * 0.08,
                rotZ: (Math.random() - 0.5) * 0.08
            };

            this.confettiParticles.push(mesh);
            this.confettiGroup.add(mesh);
        }

        this.scene.add(this.confettiGroup);
    }

    setupSparkles() {
        this.sparklesGroup = new THREE.Group();
        const sparkleGeo = new THREE.OctahedronGeometry(0.045);
        const sparkleMat = new THREE.MeshStandardMaterial({
            color: 0xfff066,
            emissive: 0xffcc00,
            metalness: 0.9,
            roughness: 0.1
        });

        this.sparkleList = [];
        for (let i = 0; i < 24; i++) {
            const mesh = new THREE.Mesh(sparkleGeo, sparkleMat);
            const radius = 1.0 + Math.random() * 0.6;
            const angle = (i / 24) * Math.PI * 2;
            const y = 0.8 + Math.random() * 1.6;
            mesh.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
            mesh.userData = {
                angle: angle,
                radius: radius,
                baseY: y,
                speed: 0.8 + Math.random() * 0.6
            };
            this.sparkleList.push(mesh);
            this.sparklesGroup.add(mesh);
        }
        this.scene.add(this.sparklesGroup);
    }

    showLoadingIndicator() {
        const loadingDiv = document.createElement('div');
        loadingDiv.id = 'victory-loading-hint';
        loadingDiv.style.cssText = `
            position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
            color: #ffd700; font-weight: bold; font-size: 0.95rem; text-shadow: 0 2px 8px rgba(0,0,0,0.8);
            pointer-events: none; text-align: center;
        `;
        loadingDiv.innerHTML = `
            <div style="font-size:1.8rem; margin-bottom:6px; animation:spin 1.5s infinite linear;">🐰</div>
            <div>Đang tải mô hình 3D Quán Quân...</div>
        `;
        this.container.appendChild(loadingDiv);
    }

    async loadModel(url, animUrl) {
        try {
            await MeshoptDecoder.ready;
            this.loader.setMeshoptDecoder(MeshoptDecoder);

            const gltf = await new Promise((resolve, reject) => {
                this.loader.load(url, resolve, undefined, reject);
            });

            const loadingHint = document.getElementById('victory-loading-hint');
            if (loadingHint) loadingHint.remove();

            const rawModel = gltf.scene || gltf.scenes[0];

            let isSkinned = false;
            rawModel.traverse((child) => {
                if (child.isSkinnedMesh) isSkinned = true;
            });

            // If not a pre-rigged model (e.g. legacy multi-bunny sheet), isolate single main front bunny
            if (!isSkinned) {
                rawModel.traverse((child) => {
                    if (child.isMesh && child.geometry) {
                        const geo = child.geometry.toNonIndexed();
                        const pos = geo.attributes.position;
                        const norm = geo.attributes.normal;
                        const uv = geo.attributes.uv;

                        let minZ = Infinity, maxZ = -Infinity;
                        for (let i = 0; i < pos.count; i++) {
                            const z = pos.getZ(i);
                            if (z < minZ) minZ = z;
                            if (z > maxZ) maxZ = z;
                        }

                        if (maxZ - minZ > 0.6 && maxZ > 0.25) {
                            const newPos = [];
                            const newNorm = [];
                            const newUv = [];

                            for (let i = 0; i < pos.count; i += 3) {
                                const avgZ = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
                                if (avgZ >= 0.255) {
                                    for (let v = 0; v < 3; v++) {
                                        newPos.push(pos.getX(i + v), pos.getY(i + v), pos.getZ(i + v));
                                        if (norm) newNorm.push(norm.getX(i + v), norm.getY(i + v), norm.getZ(i + v));
                                        if (uv) newUv.push(uv.getX(i + v), uv.getY(i + v));
                                    }
                                }
                            }

                            if (newPos.length > 0) {
                                const singleGeo = new THREE.BufferGeometry();
                                singleGeo.setAttribute('position', new THREE.Float32BufferAttribute(newPos, 3));
                                if (newNorm.length > 0) singleGeo.setAttribute('normal', new THREE.Float32BufferAttribute(newNorm, 3));
                                if (newUv.length > 0) singleGeo.setAttribute('uv', new THREE.Float32BufferAttribute(newUv, 2));
                                child.geometry.dispose();
                                child.geometry = singleGeo;
                            }
                        }
                    }
                });
            }

            // Wrapper group for clean hierarchy
            const wrapper = new THREE.Group();
            wrapper.add(rawModel);

            if (isSkinned) {
                // Skinned characters face camera (+Z)
                rawModel.rotation.set(0, Math.PI, 0);
            } else {
                // Legacy bunny rotated to face camera
                rawModel.rotation.set(0, -Math.PI / 2, 0);
            }
            rawModel.position.set(0, 0, 0);
            rawModel.updateMatrixWorld(true);

            // Compute bounding box after orientation
            const box = new THREE.Box3().setFromObject(rawModel);
            const size = new THREE.Vector3();
            const center = new THREE.Vector3();
            box.getSize(size);
            box.getCenter(center);

            // Center horizontally (X and Z) and place feet exactly at Y = 0
            rawModel.position.x = -center.x;
            rawModel.position.z = -center.z;
            rawModel.position.y = -box.min.y;
            rawModel.updateMatrixWorld(true);

            // Scale up to fit podium (target height: ~2.1 units)
            const targetHeight = 2.15;
            this.targetModelHeight = targetHeight;
            const singleHeight = Math.max(size.y, 0.1);
            const scale = targetHeight / singleHeight;
            wrapper.scale.set(scale, scale, scale);

            // Enable shadows & fine-tune materials
            rawModel.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    if (child.material) {
                        child.material.metalness = Math.min(child.material.metalness || 0.2, 0.45);
                        child.material.roughness = Math.max(child.material.roughness || 0.5, 0.35);
                    }
                }
            });

            // Position atop pedestal
            wrapper.position.set(0, this.basePedestalTopY, 0);
            this.baseModelY = this.basePedestalTopY;
            this.modelScale = scale;

            // Load Companion Skeletal Animation (e.g. dance_05)
            if (isSkinned && animUrl) {
                try {
                    const animGltf = await new Promise((res, rej) => {
                        this.loader.load(animUrl, res, undefined, rej);
                    });
                    if (animGltf && animGltf.animations && animGltf.animations.length > 0) {
                        this.mixer = new THREE.AnimationMixer(rawModel);
                        const clip = animGltf.animations[0];
                        const action = this.mixer.clipAction(clip);
                        action.setLoop(THREE.LoopRepeat);
                        action.play();
                        this.hasSkeletalAnimation = true;
                        console.log('🎉 3D Character dance animation loaded successfully:', clip.name);
                    }
                } catch (animErr) {
                    console.warn('Could not load companion animation, using procedural bounce:', animErr);
                }
            }

            this.scene.add(wrapper);
            this.model = wrapper;

            // Adjust Crown position to float right above champion's hat
            if (this.crown) {
                this.crown.position.set(0, this.baseModelY + targetHeight + 0.16, 0);
                this.crown.scale.set(1.15, 1.15, 1.15);
            }

            // Adjust Camera and OrbitControls to frame this dancing champion
            if (this.camera && this.controls) {
                this.camera.position.set(0, 1.9, 4.3);
                this.controls.target.set(0, 1.6, 0);
                this.controls.update();
            }

        } catch (err) {
            console.error('Error loading Victory 3D Model:', err);
            // Fallback attempt to bunny if fox failed
            if (url !== 'assets/models/bunny_pirate.glb') {
                console.log('Falling back to bunny_pirate.glb...');
                return this.loadModel('assets/models/bunny_pirate.glb');
            }
            const loadingHint = document.getElementById('victory-loading-hint');
            if (loadingHint) {
                loadingHint.innerHTML = `<div style="color:#ff6b6b;">Không thể tải model 3D (${err.message}). Hiển thị tượng thay thế.</div>`;
            }
            this.createFallbackChampion();
        }
    }

    createFallbackChampion() {
        // Stylish Chibi Rabbit Pirate fallback mesh
        const championGroup = new THREE.Group();
        const goldMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.9, roughness: 0.15 });
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.55, 1.0, 16), goldMat);
        body.position.y = 0.5;
        championGroup.add(body);

        const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 16), goldMat);
        head.position.y = 1.25;
        championGroup.add(head);

        championGroup.position.set(0, this.basePedestalTopY, 0);
        this.baseModelY = this.basePedestalTopY;
        this.scene.add(championGroup);
        this.model = championGroup;
    }

    triggerCelebrationJump() {
        if (this.isMegaJumping) return;
        this.isMegaJumping = true;
        this.megaJumpProgress = 0;

        // Burst extra confetti!
        this.confettiParticles.forEach(p => {
            p.position.set((Math.random() - 0.5) * 1.5, 1.2 + Math.random() * 0.8, (Math.random() - 0.5) * 1.5);
            p.userData.vy = -(0.02 + Math.random() * 0.035);
        });
    }

    animate() {
        this.animId = requestAnimationFrame(this.animate.bind(this));

        const delta = this.clock.getDelta();
        const elapsed = this.clock.getElapsedTime();

        // Update Skeletal Animation Mixer
        if (this.mixer) {
            this.mixer.update(delta);
        }

        // Model Celebration Motion
        if (this.model) {
            if (this.hasSkeletalAnimation) {
                // Skinned celebration dance (arms, legs, hips moving dynamically)
                if (this.isMegaJumping) {
                    this.megaJumpProgress += 0.035;
                    const progress = this.megaJumpProgress;
                    if (progress >= 1.0) {
                        this.isMegaJumping = false;
                        this.model.position.y = this.baseModelY;
                    } else {
                        const jumpHeight = Math.sin(progress * Math.PI) * 1.0;
                        this.model.position.y = this.baseModelY + jumpHeight;
                    }
                } else {
                    this.model.position.y = this.baseModelY;
                }
            } else {
                // Procedural bounce for static models
                if (this.isMegaJumping) {
                    // Mega Victory Flip Jump
                    this.megaJumpProgress += 0.035;
                    const progress = this.megaJumpProgress;
                    if (progress >= 1.0) {
                        this.isMegaJumping = false;
                        this.model.position.y = this.baseModelY;
                        this.model.rotation.y = 0;
                        this.model.rotation.x = 0;
                    } else {
                        const jumpHeight = Math.sin(progress * Math.PI) * 1.2;
                        this.model.position.y = this.baseModelY + jumpHeight;
                        this.model.rotation.y += 0.25; // 360 degree spin
                        this.model.rotation.x = Math.sin(progress * Math.PI * 2) * 0.3;
                    }
                } else {
                    // Cheerful Rhythmic Bounce (Nhảy nhót ăn mừng)
                    const bounce = Math.abs(Math.sin(elapsed * 4.2));
                    this.model.position.y = this.baseModelY + bounce * 0.28;

                    // Gentle joyful body sway
                    this.model.rotation.z = Math.sin(elapsed * 4.2) * 0.08;
                    this.model.rotation.y += 0.012;

                    // Squash & stretch on landing
                    if (bounce < 0.15) {
                        const squash = 1 - bounce * 0.4;
                        this.model.scale.set(this.modelScale * 1.05, this.modelScale * 0.95, this.modelScale * 1.05);
                    } else {
                        this.model.scale.set(this.modelScale, this.modelScale, this.modelScale);
                    }
                }
            }
        }

        // Floating Crown Gentle Bobbing & Spinning
        if (this.crown) {
            this.crown.rotation.y += 0.02;
            const modelH = this.targetModelHeight || 2.25;
            const targetY = (this.model ? this.model.position.y : this.baseModelY) + modelH + 0.16 + Math.sin(elapsed * 2.5) * 0.05;
            this.crown.position.y = targetY;
        }

        // Confetti physics & looping
        for (let i = 0; i < this.confettiParticles.length; i++) {
            const p = this.confettiParticles[i];
            p.position.y += p.userData.vy;
            p.position.x += p.userData.vx;
            p.position.z += p.userData.vz;

            p.rotation.x += p.userData.rotX;
            p.rotation.y += p.userData.rotY;
            p.rotation.z += p.userData.rotZ;

            // Loop back to top
            if (p.position.y < 0.2) {
                p.position.y = 4.2 + Math.random() * 0.5;
                p.position.x = (Math.random() - 0.5) * 3.8;
                p.position.z = (Math.random() - 0.5) * 3.5;
            }
        }

        // Sparkles orbiting
        if (this.sparkleList) {
            for (let i = 0; i < this.sparkleList.length; i++) {
                const sp = this.sparkleList[i];
                sp.userData.angle += 0.025 * sp.userData.speed;
                sp.position.x = Math.cos(sp.userData.angle) * sp.userData.radius;
                sp.position.z = Math.sin(sp.userData.angle) * sp.userData.radius;
                sp.position.y = sp.userData.baseY + Math.sin(elapsed * 3 + i) * 0.15;
                sp.rotation.x += 0.03;
                sp.rotation.y += 0.05;
            }
        }

        if (this.controls) this.controls.update();
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }

    async setModelAndAnimation(modelUrl, animUrl) {
        if (this.model) {
            this.scene.remove(this.model);
            this.model = null;
        }
        if (this.mixer) {
            this.mixer.stopAllAction();
            this.mixer = null;
        }
        this.hasSkeletalAnimation = false;
        await this.loadModel(modelUrl, animUrl);
    }

    onResize() {
        if (!this.container || !this.renderer || !this.camera) return;
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        if (width === 0 || height === 0) return;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    destroy() {
        if (this.animId) cancelAnimationFrame(this.animId);
        window.removeEventListener('resize', this.onResize.bind(this));
        if (this.renderer && this.renderer.domElement) {
            this.renderer.domElement.remove();
            this.renderer.dispose();
        }
        this.scene = null;
        this.camera = null;
        this.controls = null;
        this.isInitialized = false;
    }
}
