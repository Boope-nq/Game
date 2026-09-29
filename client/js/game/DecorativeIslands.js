import * as THREE from 'three';

/**
 * DecorativeIslands – stylized 3D archipelago islands with warm natural tones.
 * Islands are randomly generated in outer waters without overlapping.
 */
export class DecorativeIslands {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.scene.add(this.group);

        this.animatedBoats = [];
        this.animatedPalms = [];
        this.clouds        = [];
        this.birds         = [];

        this._initMaterials();
        this._buildAllIslands();
        this._buildClouds();
        this._buildBirds();

        if (typeof window !== 'undefined') {
            window.decorativeIslands = this;
        }
    }

    _initMaterials() {
        const m = (c, r, me = 0, em = null, ei = 0, tr = false, op = 1) => {
            const mat = new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: me });
            if (em) { mat.emissive = new THREE.Color(em); mat.emissiveIntensity = ei; }
            if (tr) { mat.transparent = true; mat.opacity = op; }
            return mat;
        };

        this.mat = {
            // Warm stylized tropical sand
            sand:       m(0xE8CE9B, 0.85, 0, 0x3d2a12, 0.06),
            sandWet:    m(0xD1A766, 0.65, 0.05),
            grass1:     m(0x429938, 0.72, 0, 0x102b0c, 0.10),
            grass2:     m(0x55b84c, 0.70, 0, 0x142c12, 0.08),
            grass3:     m(0x387a32, 0.78, 0, 0x0c200a, 0.10),
            rock:       m(0x5c6068, 0.92, 0.08),
            snow:       m(0xf8fbff, 0.25),
            trunk:      m(0x5a3c1e, 0.88),
            leaf1:      new THREE.MeshStandardMaterial({
                            color: 0x236b42, roughness: 0.62, side: THREE.DoubleSide,
                            emissive: new THREE.Color(0x0a2818), emissiveIntensity: 0.12 }),
            leaf2:      new THREE.MeshStandardMaterial({
                            color: 0x2e8a55, roughness: 0.60, side: THREE.DoubleSide,
                            emissive: new THREE.Color(0x0d3020), emissiveIntensity: 0.10 }),
            wood:       m(0x4a3018, 0.82),
            white:      m(0xf8f8f8, 0.40),
            red:        m(0xce3030, 0.50),
            sail:       new THREE.MeshStandardMaterial({
                            color: 0xFFF8EC, roughness: 0.58, side: THREE.DoubleSide }),
            glow:       new THREE.MeshStandardMaterial({
                            color: 0xfffde6, roughness: 0.2,
                            emissive: new THREE.Color(0xffd060), emissiveIntensity: 0.90 }),
            cloud:      m(0xffffff, 0.30, 0, null, 0, true, 0.88),
            foam:       m(0xE2F5FF, 0.20, 0, null, 0, true, 0.45)
        };
    }

    _buildAllIslands() {
        const islands   = [];
        const MIN_DIST  = 24;
        const MIN_BOARD = 32;
        const MAX_BOARD = 92;

        const configs = [
            { scale: 1.2,  sandR: 11, hasLighthouse: true, hasPalms: 3, hasBoat: true },
            { scale: 1.3,  sandR: 12, hasPalms: 4, hasBoat: true, hillCount: 3 },
            { scale: 1.25, sandR: 11, hasPalms: 2, hasBoat: true, hasRuins: true },
            { scale: 1.15, sandR: 10, hasPalms: 3, hasBoat: true },
            { scale: 1.25, sandR: 11, hasPalms: 3, hasBoat: true },
            { scale: 1.2,  sandR: 10, hasPalms: 3 },
            { scale: 1.2,  sandR: 10, hasPalms: 2, hasBoat: true, hasRuins: true },
            { scale: 1.6,  sandR: 17, hasPalms: 3, hasSnowPeak: true },
            { scale: 1.5,  sandR: 15, hasPalms: 2, hasPeakRock: true }
        ];

        let attempts = 0;
        while (islands.length < configs.length && attempts < 500) {
            attempts++;
            const angle  = Math.random() * Math.PI * 2;
            const dist   = MIN_BOARD + Math.random() * (MAX_BOARD - MIN_BOARD);
            const x      = Math.cos(angle) * dist;
            const z      = Math.sin(angle) * dist;

            const tooClose = islands.some(isl => {
                const dx = isl.x - x, dz = isl.z - z;
                return Math.sqrt(dx * dx + dz * dz) < MIN_DIST;
            });
            if (tooClose) continue;

            const cfg = configs[islands.length];
            islands.push({ x, z, ...cfg });
        }

        for (const isl of islands) this._buildIsland(isl);
    }

    _buildIsland(cfg) {
        const ig = new THREE.Group();
        ig.position.set(cfg.x, 0, cfg.z);

        // Shore foam ring
        const foamGeo = new THREE.RingGeometry(cfg.sandR * 0.92, cfg.sandR * 1.12, 32);
        foamGeo.rotateX(-Math.PI / 2);
        const foam = new THREE.Mesh(foamGeo, this.mat.foam);
        foam.position.y = 0.04;
        ig.add(foam);

        // Sand base cylinder: height 0.45, center at 0.225 -> bottom at 0, top at 0.45
        const sandGeo = new THREE.CylinderGeometry(cfg.sandR * 0.94, cfg.sandR, 0.45, 28);
        const sand    = new THREE.Mesh(sandGeo, this.mat.sand);
        sand.position.y = 0.225;
        sand.receiveShadow = true;
        ig.add(sand);

        const SAND_TOP = 0.45;

        // ── Hills ──────────────────────────────────────────────────────────
        const hillCount = cfg.hillCount || 3;
        const grassMats = [this.mat.grass1, this.mat.grass2, this.mat.grass3];
        const hillDefs  = [];

        for (let i = 0; i < hillCount; i++) {
            const angle = (i / hillCount) * Math.PI * 2 + Math.random() * 0.8;
            const dist  = Math.random() * (cfg.sandR * 0.35);
            const hx    = Math.cos(angle) * dist;
            const hz    = Math.sin(angle) * dist;
            const hr    = (cfg.sandR * 0.28) + Math.random() * (cfg.sandR * 0.15);
            const hh    = hr * (1.3 + Math.random() * 0.7);
            hillDefs.push({ x: hx, z: hz, r: hr, h: hh, mat: grassMats[i % 3] });
        }

        for (const h of hillDefs) {
            const hillGeo  = new THREE.ConeGeometry(h.r, h.h, 16);
            const hillMesh = new THREE.Mesh(hillGeo, h.mat);
            hillMesh.position.set(h.x, SAND_TOP + h.h / 2, h.z);
            hillMesh.castShadow = true; hillMesh.receiveShadow = true;
            ig.add(hillMesh);

            const hillApex = SAND_TOP + h.h;

            if (cfg.hasPeakRock) {
                const pr = new THREE.Mesh(new THREE.DodecahedronGeometry(h.r * 0.32, 0), this.mat.rock);
                pr.position.set(h.x, hillApex - h.r * 0.12, h.z);
                pr.castShadow = true; ig.add(pr);
            }

            if (cfg.hasSnowPeak) {
                // Snow cone snugly caps top 35% of the mountain
                const sH    = h.h * 0.35;
                const snowR = h.r * (sH / h.h) * 1.02;
                const snowM = new THREE.Mesh(new THREE.ConeGeometry(snowR, sH, 14), this.mat.snow);
                snowM.position.set(h.x, hillApex - sH / 2 + 0.02, h.z);
                snowM.castShadow = true;
                ig.add(snowM);
            }
        }

        // ── Shore rocks ────────────────────────────────────────────────────
        const rockCount = 1 + Math.floor(Math.random() * 2);
        for (let i = 0; i < rockCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const rdist = cfg.sandR * (0.45 + Math.random() * 0.35);
            const rx    = Math.cos(angle) * rdist;
            const rz    = Math.sin(angle) * rdist;
            const rr    = 1.4 + Math.random() * 0.8;
            const rockMesh = new THREE.Mesh(new THREE.DodecahedronGeometry(rr, 0), this.mat.rock);
            rockMesh.position.set(rx, SAND_TOP + rr * 0.4, rz);
            rockMesh.castShadow = true;
            ig.add(rockMesh);
        }

        // ── Palm trees ─────────────────────────────────────────────────────
        const palmCount = cfg.hasPalms || 0;
        for (let i = 0; i < palmCount; i++) {
            const angle  = (i / palmCount) * Math.PI * 2 + Math.random() * 1.0;
            const pdist  = cfg.sandR * (0.32 + Math.random() * 0.35);
            const px     = Math.cos(angle) * pdist;
            const pz     = Math.sin(angle) * pdist;
            const tilt   = 0.10 + Math.random() * 0.22;
            const pscale = 0.9 + Math.random() * 0.5;

            const { palmGroup, frondGroup } = this._makePalm(pscale, tilt);
            palmGroup.position.set(px, SAND_TOP, pz);
            ig.add(palmGroup);

            this.animatedPalms.push({
                crown: frondGroup,
                ampX:  0.020 + Math.random() * 0.016,
                ampZ:  0.016 + Math.random() * 0.014,
                speed: 0.55 + Math.random() * 0.40,
                phase: Math.random() * Math.PI * 2
            });
        }

        // ── Lighthouse ─────────────────────────────────────────────────────
        if (cfg.hasLighthouse && hillDefs.length > 0) {
            const topHill = hillDefs.reduce((a, b) => a.h > b.h ? a : b);
            const lh = this._makeLighthouse();
            // Solid stone foundation pad at the hill top
            const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 0.45, 12), this.mat.rock);
            pad.position.set(topHill.x, SAND_TOP + topHill.h * 0.88, topHill.z);
            pad.castShadow = true; ig.add(pad);

            lh.position.set(topHill.x, SAND_TOP + topHill.h * 0.88 + 0.22, topHill.z);
            ig.add(lh);
        }

        // ── Ancient Ruins ──────────────────────────────────────────────────
        if (cfg.hasRuins) {
            const ruins = this._makeRuins();
            // Grounded securely on sand surface
            ruins.position.set(Math.random() * 2 - 1, SAND_TOP, Math.random() * 2 - 1);
            ig.add(ruins);
        }

        // ── Sailboat ───────────────────────────────────────────────────────
        if (cfg.hasBoat) {
            const boat  = this._makeBoat();
            const bAngle = Math.random() * Math.PI * 2;
            const bDist  = cfg.sandR * (1.15 + Math.random() * 0.4);
            const bx     = Math.cos(bAngle) * bDist;
            const bz     = Math.sin(bAngle) * bDist;
            boat.position.set(bx, 0.05, bz);
            boat.rotation.y = bAngle + Math.PI + (Math.random() - 0.5) * 0.8;
            ig.add(boat);
            this.animatedBoats.push({
                mesh: boat, baseY: 0.05,
                speed: 1.1 + Math.random() * 0.5,
                phase: Math.random() * Math.PI * 2
            });
        }

        this.group.add(ig);
    }

    _makePalm(scale = 1.0, tilt = 0.2) {
        const palmGroup  = new THREE.Group();
        palmGroup.scale.setScalar(scale);

        const segs = 5;
        const segH = 0.58;
        let cy = 0, cx = 0;

        for (let i = 0; i < segs; i++) {
            const rT = Math.max(0.04, 0.16 - i * 0.018);
            const rB = Math.max(0.06, 0.22 - i * 0.018);
            const seg = new THREE.Mesh(new THREE.CylinderGeometry(rT, rB, segH, 7), this.mat.trunk);
            cx += Math.sin(tilt) * 0.08 * (i + 1);
            seg.position.set(cx, cy + segH / 2, 0);
            seg.rotation.z = -tilt * (i / segs);
            seg.castShadow = true;
            palmGroup.add(seg);
            cy += segH * 0.92;
        }

        const frondGroup = new THREE.Group();
        frondGroup.position.set(cx, cy, 0);

        for (let i = 0; i < 7; i++) {
            const angle   = (i / 7) * Math.PI * 2;
            const leafGeo = new THREE.ConeGeometry(0.52, 2.1, 4);
            leafGeo.scale(0.78, 1, 0.18);
            leafGeo.rotateX(Math.PI / 2.2);
            const mat  = i % 2 === 0 ? this.mat.leaf1 : this.mat.leaf2;
            const leaf = new THREE.Mesh(leafGeo, mat);
            leaf.rotation.y = angle;
            leaf.castShadow = true;
            frondGroup.add(leaf);
        }
        palmGroup.add(frondGroup);

        return { palmGroup, frondGroup };
    }

    _makeLighthouse() {
        const g = new THREE.Group();
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.6, 12), this.mat.rock);
        base.position.y = 0.3; g.add(base);
        const tH = 3.6;
        for (let i = 0; i < 4; i++) {
            const rB = 0.85 - i * 0.08, rT = 0.77 - i * 0.08;
            const sec = new THREE.Mesh(new THREE.CylinderGeometry(rT, rB, tH / 4, 12),
                i % 2 === 0 ? this.mat.white : this.mat.red);
            sec.position.y = 0.6 + (i + 0.5) * (tH / 4);
            sec.castShadow = true; g.add(sec);
        }
        const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.55, 0.7, 10), this.mat.glow);
        lantern.position.y = 0.6 + tH + 0.35; g.add(lantern);
        const roof = new THREE.Mesh(new THREE.ConeGeometry(0.68, 0.6, 10), this.mat.red);
        roof.position.y = 0.6 + tH + 0.7 + 0.3; g.add(roof);
        return g;
    }

    _makeRuins() {
        const g = new THREE.Group();
        const pilGeo = new THREE.CylinderGeometry(0.25, 0.28, 2.2, 8);
        [[-1.2,-0.8],[1.2,-0.8],[-1.2,0.8],[1.2,0.8]].forEach(([px, pz]) => {
            const p = new THREE.Mesh(pilGeo, this.mat.sandWet);
            p.position.set(px, 1.1, pz); p.castShadow = true; g.add(p);
        });
        const arch = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.4, 0.6), this.mat.sandWet);
        arch.position.set(0, 2.3, -0.8); arch.castShadow = true; g.add(arch);
        return g;
    }

    _makeBoat() {
        const g = new THREE.Group();
        const hullGeo = new THREE.ConeGeometry(0.9, 3.2, 5);
        hullGeo.rotateX(Math.PI / 2); hullGeo.scale(1.0, 0.45, 1.0);
        const hull = new THREE.Mesh(hullGeo, this.mat.wood);
        hull.position.y = 0.20; hull.castShadow = true; g.add(hull);

        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.0, 6), this.mat.wood);
        mast.position.set(0, 1.7, 0.1); g.add(mast);

        const sailVerts = new Float32Array([0,0.7,0.1, 0,3.0,0.1, 1.5,1.2,0.2]);
        const sailGeo   = new THREE.BufferGeometry();
        sailGeo.setAttribute('position', new THREE.BufferAttribute(sailVerts, 3));
        sailGeo.computeVertexNormals();
        g.add(new THREE.Mesh(sailGeo, this.mat.sail));

        return g;
    }

    _buildClouds() {
        for (let i = 0; i < 14; i++) {
            const cloud = new THREE.Group();
            const puffs = 4 + Math.floor(Math.random() * 5);
            for (let j = 0; j < puffs; j++) {
                const r = 2.2 + Math.random() * 2.5;
                const p = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 1), this.mat.cloud);
                p.position.set(
                    (j - puffs/2) * 2.4 + (Math.random()-0.5)*1.6,
                    (Math.random()-0.5)*0.9,
                    (Math.random()-0.5)*2.0
                );
                cloud.add(p);
            }
            const angle = (i / 14) * Math.PI * 2 + Math.random() * 0.5;
            const dist  = 68 + Math.random() * 48;
            cloud.position.set(Math.cos(angle)*dist, 34+Math.random()*14, Math.sin(angle)*dist);
            this.clouds.push({ group: cloud, speed: 0.35+Math.random()*0.55, dist, angle });
            this.group.add(cloud);
        }
    }

    _buildBirds() {
        this.birdsCenter = new THREE.Vector3(52, 10, -32);
        for (let i = 0; i < 5; i++) {
            const bird   = new THREE.Group();
            const wingV  = new Float32Array([-0.65,0,-0.14, 0,0,0.14, 0.65,0,-0.14]);
            const wGeo   = new THREE.BufferGeometry();
            wGeo.setAttribute('position', new THREE.BufferAttribute(wingV, 3));
            wGeo.computeVertexNormals();
            bird.add(new THREE.Mesh(wGeo, this.mat.white));
            const r = 6 + Math.random() * 4;
            const a = (i / 5) * Math.PI * 2;
            const h = 7 + Math.random() * 3;
            this.birds.push({ mesh: bird, radius: r, angle: a, speed: 1.2+Math.random()*0.4, height: h });
            this.group.add(bird);
        }
    }

    update(time, delta) {
        const TWO_PI = Math.PI * 2;

        // Boats: wave bob + roll + pitch
        for (const b of this.animatedBoats) {
            b.mesh.position.y = b.baseY + Math.sin(time * b.speed + b.phase) * 0.08;
            b.mesh.rotation.z = Math.cos(time * b.speed + b.phase) * 0.040;
            b.mesh.rotation.x = Math.sin(time * b.speed * 0.7 + b.phase + 1.0) * 0.020;
        }

        // Palm frond crown sway (dual axis)
        for (const p of this.animatedPalms) {
            p.crown.rotation.x = Math.sin(time * p.speed + p.phase) * p.ampX;
            p.crown.rotation.z = Math.cos(time * p.speed * 0.8 + p.phase + 0.6) * p.ampZ;
        }

        // Clouds drift with angle wrap
        for (const c of this.clouds) {
            c.angle = (c.angle + delta * 0.007 * c.speed) % TWO_PI;
            c.group.position.x = Math.cos(c.angle) * c.dist;
            c.group.position.z = Math.sin(c.angle) * c.dist;
        }

        // Seagulls circle with wing flap
        for (const b of this.birds) {
            b.angle = (b.angle + delta * b.speed * 0.6) % TWO_PI;
            b.mesh.position.x = this.birdsCenter.x + Math.cos(b.angle) * b.radius;
            b.mesh.position.z = this.birdsCenter.z + Math.sin(b.angle) * b.radius;
            b.mesh.position.y = this.birdsCenter.y + b.height + Math.sin(time * 4 + b.angle) * 0.45;
            b.mesh.rotation.y = -b.angle - Math.PI / 2;
            b.mesh.rotation.z = Math.sin(time * 5 + b.angle * 2) * 0.20;
        }
    }
}
