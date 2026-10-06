import * as THREE from 'three';

const HEX_SIZE = 2.5;
const SCALE    = 2.5 / 52;

const TILE_COLORS = {
    'BRICK':  0xC44E35, 'LUMBER': 0x2A6B28, 'GRAIN':  0xE5B338,
    'WOOL':   0x6EB83E, 'ORE':    0x616675, 'GOLD':   0xE5BC3B,
    'SEA':    0x39A7FF, 'DESERT': 0xE8CF9B
};

// Explicit Y placement helper: centers geometry of height h so its bottom is at (0 + add)
function by(h, add = 0) { return h / 2 + add; }

export class HexBoard3D {
    constructor(scene) {
        this.scene = scene;
        this.boardGroup      = new THREE.Group();
        this.highlightsGroup = new THREE.Group();
        this.scene.add(this.boardGroup);
        this.scene.add(this.highlightsGroup);

        this.tiles            = new Map();
        this.highlightObjects = [];

        // Animation registries
        this._windmills  = [];   // { sailsHub, speed }
        this._swayTrees  = [];   // { group, axis, amp, speed, phase }
        this._sheepWalk  = [];   // { mesh, cx, cz, r, angle, speed, baseY }

        this.hexGeometryLand = this._createHexGeometry(0.42);
        this.hexGeometrySea  = this._createHexGeometry(0.12);

        // Tile base materials
        this.materials = {};
        for (const type in TILE_COLORS) {
            const isSea   = type === 'SEA';
            const isGreen = type === 'WOOL' || type === 'LUMBER';
            this.materials[type] = new THREE.MeshStandardMaterial({
                color:    TILE_COLORS[type],
                roughness: isSea ? 0.08 : 0.72,
                metalness: isSea ? 0.40 : (type === 'GOLD' ? 0.18 : 0.05),
                transparent: isSea, opacity: isSea ? 0.88 : 1.0,
                emissive:          isGreen ? new THREE.Color(TILE_COLORS[type]).multiplyScalar(0.04) : new THREE.Color(0),
                emissiveIntensity: isGreen ? 0.06 : 0
            });
        }
        this.fogMaterial   = new THREE.MeshStandardMaterial({ color: 0x87c4ff, roughness: 0.25, transparent: true, opacity: 0.65 });
        this.crossroadMat  = new THREE.MeshStandardMaterial({ color: 0x6e737c, roughness: 0.9  });
        this.stoneFrameMat = new THREE.MeshStandardMaterial({ color: 0x7a7d85, roughness: 0.85 });

        this.vertexHighlightMat = new THREE.MeshBasicMaterial({ color: 0xffea00, transparent: true, opacity: 0.88 });
        this.edgeHighlightMat   = new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.88 });
        this.tileHighlightMat   = new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.55, wireframe: true });

        this._initMaterials();
    }

    _initMaterials() {
        const s = (c, r, m = 0, em = null, ei = 0) => {
            const mat = new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
            if (em) { mat.emissive = new THREE.Color(em); mat.emissiveIntensity = ei; }
            return mat;
        };
        this.snowMat        = s(0xf8fbff, 0.25);
        this.rockMat        = s(0x5a5e66, 0.90, 0.08);
        this.trunkMat       = s(0x4a2f18, 0.88);
        this.foliageMat1    = s(0x1b5c1b, 0.72, 0, 0x0a2c0a, 0.12);
        this.foliageMat2    = s(0x2a7229, 0.70, 0, 0x0d360d, 0.10);
        this.foliageMat3    = s(0x3d8c1f, 0.65, 0, 0x1a3f0a, 0.08);
        this.oakFoliageMat  = s(0x255c25, 0.68, 0, 0x112811, 0.10);
        this.sheepWoolMat   = s(0xf2efe9, 0.95);
        this.sheepFaceMat   = s(0x1c1c1c, 0.85);
        this.hornMat        = s(0xb89060, 0.72, 0.05);
        this.wheatMat       = s(0xebbf42, 0.60);
        this.hayMat         = s(0xd4a230, 0.78);
        this.clayMat        = s(0x973f27, 0.92);
        this.brickMat       = s(0xb83c22, 0.88);
        this.goldNuggetMat  = s(0xffd700, 0.12, 0.92);
        this.goldCoinMat    = s(0xffe066, 0.08, 0.95);
        this.dockWoodMat    = s(0x4e3218, 0.82);
        this.fenceWoodMat   = s(0x5c3a21, 0.92);
        this.logMat         = s(0x4a2e18, 0.85);
        this.ironMat        = s(0x90a4ae, 0.22, 0.88);
        this.desertMat      = s(0xe8cf9b, 0.92);
        this.scarecrowMat   = s(0x8d6e63, 0.80);
        this.palmLeafMat    = new THREE.MeshStandardMaterial({
            color: 0x2e8b57, roughness: 0.62, side: THREE.DoubleSide,
            emissive: new THREE.Color(0x0d3d1a), emissiveIntensity: 0.10 });
        this.sailMatW       = new THREE.MeshStandardMaterial({
            color: 0xfffde7, roughness: 0.55, side: THREE.DoubleSide,
            emissive: new THREE.Color(0x221900), emissiveIntensity: 0.04 });
        this.riverMat       = new THREE.MeshStandardMaterial({
            color: 0x00bcd4, roughness: 0.08, metalness: 0.35,
            transparent: true, opacity: 0.85 });
        this.beaconGlowMat  = new THREE.MeshStandardMaterial({
            color: 0xffd600, emissive: new THREE.Color(0xff9900), emissiveIntensity: 1.1, roughness: 0.15 });
        this.beaconPillarMat = new THREE.MeshBasicMaterial({ color: 0xffe082, transparent: true, opacity: 0.75 });
        this.targetRingMat   = new THREE.MeshBasicMaterial({ color: 0xffea00, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
        this.flowerYellow    = new THREE.MeshBasicMaterial({ color: 0xffeb3b });
        this.flowerRed       = new THREE.MeshBasicMaterial({ color: 0xe53935 });
        this.mushroomMat     = s(0xd32f2f, 0.38);
        this.whiteMat        = new THREE.MeshBasicMaterial({ color: 0xffffff });
    }

    _createHexGeometry(depth) {
        const shape = new THREE.Shape();
        for (let i = 0; i < 6; i++) {
            const a = (Math.PI / 3) * i - Math.PI / 6;
            const x = HEX_SIZE * Math.cos(a), y = HEX_SIZE * Math.sin(a);
            i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y);
        }
        return new THREE.ExtrudeGeometry(shape, {
            depth, bevelEnabled: true, bevelSegments: 2, steps: 1,
            bevelSize: 0.08, bevelThickness: 0.08
        });
    }

    hexToWorld(q, r) {
        return new THREE.Vector3(HEX_SIZE * Math.sqrt(3) * (q + r / 2), 0, HEX_SIZE * 3 / 2 * r);
    }
    vertexToWorld(vertex) {
        return new THREE.Vector3(vertex.pos.x * SCALE, 0.45, vertex.pos.y * SCALE);
    }

    _getSurfaceY(tileMesh) {
        try {
            tileMesh.updateWorldMatrix(true, false);
            const bb = new THREE.Box3().setFromObject(tileMesh);
            if (!bb.isEmpty() && isFinite(bb.max.y)) return bb.max.y;
        } catch (_) { /* fallback */ }
        return 0.42;
    }

    update(delta, elapsed) {
        // 1. Windmill sails spin
        for (const wm of this._windmills) {
            wm.sailsHub.rotation.z += delta * wm.speed;
        }

        // 2. Forest trees sway
        for (const t of this._swayTrees) {
            t.group.rotation[t.axis] = t.base + Math.sin(elapsed * t.speed + t.phase) * t.amp;
        }

        // 3. Pasture sheep walk with modular cycle (prevents float overflow)
        const TWO_PI = Math.PI * 2;
        for (const s of this._sheepWalk) {
            s.angle = (s.angle + delta * s.speed) % TWO_PI;
            s.mesh.position.x = s.cx + Math.cos(s.angle) * s.r;
            s.mesh.position.z = s.cz + Math.sin(s.angle) * s.r;
            s.mesh.rotation.y = -s.angle - Math.PI / 2;
            // Subtle trot bounce: minimum position.y is exactly baseY = 0
            s.mesh.position.y = s.baseY + Math.abs(Math.sin(s.angle * 4)) * 0.015;
        }
    }

    _registerSway(grp) {
        const axis = Math.random() > 0.5 ? 'x' : 'z';
        this._swayTrees.push({
            group: grp, axis, base: 0,
            amp:   0.018 + Math.random() * 0.015,
            speed: 0.55 + Math.random() * 0.50,
            phase: Math.random() * Math.PI * 2
        });
    }

    _decorateHex(group, tile, worldPos, surfaceY) {
        if (tile.isDiscovered === false || tile.type === 'SEA') return;
        const tg = new THREE.Group();
        tg.position.set(worldPos.x, surfaceY, worldPos.z);

        switch (tile.type) {
            case 'ORE':    this._buildMountain(tg); break;
            case 'LUMBER': this._buildForest(tg);   break;
            case 'WOOL':   this._buildPasture(tg);  break;
            case 'GRAIN':  this._buildField(tg);    break;
            case 'BRICK':  this._buildHill(tg);     break;
            case 'DESERT': this._buildDesert(tg);   break;
            case 'GOLD':   this._buildGold(tg);     break;
        }
        group.add(tg);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 1. MOUNTAIN (ORE)
    // ─────────────────────────────────────────────────────────────────────────
    _buildMountain(g) {
        // Peaks placed in outer perimeter (dist >= 1.05) leaving center (r < 0.90) clear for token
        const peaks = [
            { x: -0.85, z: -0.85, r: 0.85, h: 1.85, s: 7 },
            { x:  0.88, z: -0.75, r: 0.72, h: 1.55, s: 6 },
            { x: -0.75, z:  0.95, r: 0.65, h: 1.35, s: 6 },
            { x:  0.95, z:  0.70, r: 0.55, h: 1.15, s: 5 }
        ];

        for (const p of peaks) {
            const rock = new THREE.Mesh(new THREE.ConeGeometry(p.r, p.h, p.s), this.rockMat);
            rock.position.set(p.x, by(p.h), p.z);
            rock.castShadow = true; rock.receiveShadow = true; g.add(rock);

            // Snow cap: apex matches mountain apex (p.h + 0.01), snugly covers the peak
            const sH = p.h * 0.36;
            const snowR = p.r * 0.37;
            const snow = new THREE.Mesh(new THREE.ConeGeometry(snowR, sH, p.s), this.snowMat);
            snow.position.set(p.x, p.h - sH / 2 + 0.01, p.z);
            snow.castShadow = true; g.add(snow);
        }

        // Mine portal frame
        const postH = 0.45;
        const postGeo = new THREE.BoxGeometry(0.08, postH, 0.08);
        const lintelGeo = new THREE.BoxGeometry(0.36, 0.08, 0.08);
        const portal = new THREE.Group();
        const pL = new THREE.Mesh(postGeo, this.fenceWoodMat);
        pL.position.set(-0.14, by(postH), 0);
        const pR = new THREE.Mesh(postGeo, this.fenceWoodMat);
        pR.position.set( 0.14, by(postH), 0);
        const lintel = new THREE.Mesh(lintelGeo, this.fenceWoodMat);
        lintel.position.set(0, postH - 0.04, 0);
        portal.add(pL, pR, lintel);
        portal.position.set(-1.18, 0, -0.35);
        portal.rotation.y = 0.8;
        g.add(portal);

        // Mine-cart rails
        const railMat = this.ironMat;
        [[-1.05, -0.05], [-0.95, -0.15]].forEach(([rx, rz]) => {
            const rail = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.65), railMat);
            rail.position.set(rx, 0.01, rz); rail.rotation.y = 0.8; g.add(rail);
        });

        // Cart
        const cart = new THREE.Group();
        const cb = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 0.30), this.ironMat);
        cb.position.y = by(0.18);
        const ore = new THREE.Mesh(new THREE.DodecahedronGeometry(0.10, 0), this.rockMat);
        ore.position.y = 0.18 + 0.10;
        cart.add(cb, ore);
        cart.position.set(-0.95, 0, 0.25); cart.rotation.y = 0.8;
        g.add(cart);

        // Crag boulders
        const bGeo = new THREE.DodecahedronGeometry(0.18, 0);
        [{ x: -1.25, z: 0.55 }, { x: 1.20, z: -0.25 }].forEach(b => {
            const bm = new THREE.Mesh(bGeo, this.rockMat);
            bm.position.set(b.x, 0.12, b.z);
            bm.castShadow = true; g.add(bm);
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. FOREST (LUMBER)
    // ─────────────────────────────────────────────────────────────────────────
    _buildForest(g) {
        const trunkH = 0.45;

        // Oak trees (outer perimeter)
        const oakSpots = [
            { x: -1.18, z: -0.35, s: 1.10 },
            { x:  1.20, z:  0.25, s: 1.05 },
            { x:  0.15, z: -1.25, s: 0.95 }
        ];
        for (const sp of oakSpots) {
            const oak = new THREE.Group();
            const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, trunkH, 7), this.trunkMat);
            trunk.position.y = by(trunkH);
            trunk.castShadow = true; oak.add(trunk);

            const clusters = [
                { y: 0.62, r: 0.38, m: this.oakFoliageMat },
                { y: 0.55, r: 0.28, dx: -0.18, dz:  0.12, m: this.foliageMat2 },
                { y: 0.57, r: 0.30, dx:  0.18, dz: -0.12, m: this.foliageMat3 },
                { y: 0.76, r: 0.24, dx:  0.06, dz:  0.06, m: this.foliageMat1 }
            ];
            for (const c of clusters) {
                const cl = new THREE.Mesh(new THREE.IcosahedronGeometry(c.r, 1), c.m);
                cl.position.set(c.dx || 0, c.y, c.dz || 0);
                cl.castShadow = true; oak.add(cl);
            }
            oak.position.set(sp.x, 0, sp.z);
            oak.scale.setScalar(sp.s);
            g.add(oak);
            this._registerSway(oak);
        }

        // Pine trees
        const pineSpots = [[-0.85,-0.95],[0.95,-0.85],[-1.15,0.70],[1.05,0.85],[-0.15,1.28]];
        pineSpots.forEach(([px, pz], i) => {
            const pine = new THREE.Group();
            const pTrH = 0.35;
            const ptr = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.065, pTrH, 5), this.trunkMat);
            ptr.position.y = by(pTrH); ptr.castShadow = true; pine.add(ptr);

            const tiers = [
                { r: 0.36, h: 0.40, m: this.foliageMat1 },
                { r: 0.28, h: 0.33, m: this.foliageMat2 },
                { r: 0.18, h: 0.25, m: this.foliageMat3 }
            ];
            let topY = pTrH;
            for (const t of tiers) {
                const tier = new THREE.Mesh(new THREE.ConeGeometry(t.r, t.h, 6), t.m);
                tier.position.y = topY + t.h / 2;
                tier.castShadow = true; pine.add(tier);
                topY += t.h * 0.55;
            }

            pine.position.set(px, 0, pz);
            pine.scale.setScalar(0.85 + (i % 3) * 0.15);
            g.add(pine);
            this._registerSway(pine);
        });

        // Firewood stack
        const fwGrp = new THREE.Group();
        const fwPost = new THREE.BoxGeometry(0.03, 0.28, 0.03);
        [-0.22, 0.22].forEach(ox => {
            const fw = new THREE.Mesh(fwPost, this.fenceWoodMat);
            fw.position.set(ox, by(0.28), 0); fwGrp.add(fw);
        });
        for (let row = 0; row < 3; row++) {
            const log = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.42, 6), this.logMat);
            log.rotation.z = Math.PI / 2;
            log.position.y = 0.04 + row * 0.08;
            fwGrp.add(log);
        }
        fwGrp.position.set(-0.55, 0, -1.15); fwGrp.rotation.y = 0.5;
        g.add(fwGrp);

        // Tree stump
        const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.20, 7), this.logMat);
        stump.position.set(0.65, by(0.20), -1.10); stump.castShadow = true; g.add(stump);

        // Forest mushrooms
        [[-.85,.45],[-.92,.52],[.85,.48]].forEach(([mx, mz]) => {
            const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.10, 4), this.whiteMat);
            stem.position.set(mx, by(0.10), mz); g.add(stem);
            const cap  = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.08, 6), this.mushroomMat);
            cap.position.set(mx, 0.10 + by(0.08), mz); g.add(cap);
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. PASTURE (WOOL)
    // ─────────────────────────────────────────────────────────────────────────
    _buildPasture(g) {
        // Perimeter knolls
        [
            { x: -0.95, z: -0.65, sx: 0.95, sy: 0.18 },
            { x:  0.95, z:  0.65, sx: 0.85, sy: 0.16 }
        ].forEach(k => {
            const knoll = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 8), this.materials['WOOL']);
            knoll.scale.set(k.sx, k.sy, 0.70); knoll.position.set(k.x, 0, k.z);
            knoll.receiveShadow = true; g.add(knoll);
        });

        // Fence at boundary (radius ~ 1.45)
        const postH = 0.36, postGeo = new THREE.CylinderGeometry(0.035, 0.045, postH, 6);
        const rLen   = 1.15,  railGeo = new THREE.BoxGeometry(rLen, 0.032, 0.032);
        const fSegs  = [
            { x: 0,    z: -1.45, ry: 0            },
            { x: 1.25, z:  0.72, ry:  Math.PI / 3 },
            { x:-1.25, z:  0.72, ry: -Math.PI / 3 },
            { x: 0,    z:  1.45, ry: 0             }
        ];
        for (const ln of fSegs) {
            const seg = new THREE.Group();
            [-rLen/2, 0, rLen/2].forEach(ox => {
                const p = new THREE.Mesh(postGeo, this.fenceWoodMat);
                p.position.set(ox, by(postH), 0);
                p.castShadow = true; seg.add(p);
            });
            const rT = new THREE.Mesh(railGeo, this.fenceWoodMat);
            rT.position.y = postH * 0.78;
            const rB = new THREE.Mesh(railGeo, this.fenceWoodMat);
            rB.position.y = postH * 0.42;
            seg.add(rT, rB);
            seg.position.set(ln.x, 0, ln.z); seg.rotation.y = ln.ry;
            g.add(seg);
        }

        const makeSheep = (isRam, isLamb) => {
            const grp = new THREE.Group();
            const sc  = isLamb ? 0.58 : (isRam ? 1.12 : 1.0);

            const body = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), this.sheepWoolMat);
            body.scale.set(1.32, 1.0, 1.0);
            body.position.y = 0.21;
            body.castShadow = true; grp.add(body);

            const head = new THREE.Mesh(new THREE.SphereGeometry(0.08, 7, 7), this.sheepFaceMat);
            head.position.set(0.20, 0.25, 0);
            grp.add(head);

            const legGeo = new THREE.CylinderGeometry(0.022, 0.018, 0.14, 5);
            [[ 0.06, -0.08], [ 0.06, 0.08], [-0.07, -0.08], [-0.07, 0.08]].forEach(([lx, lz]) => {
                const leg = new THREE.Mesh(legGeo, this.sheepFaceMat);
                leg.position.set(lx, by(0.14), lz);
                grp.add(leg);
            });

            if (isRam) {
                const hornGeo = new THREE.TorusGeometry(0.06, 0.022, 5, 8, Math.PI * 1.3);
                [-1, 1].forEach(side => {
                    const h = new THREE.Mesh(hornGeo, this.hornMat);
                    h.position.set(0.22, 0.30, side * 0.10);
                    grp.add(h);
                });
            }
            grp.scale.setScalar(sc);
            return grp;
        };

        // Sheep walk around in outer zones (clear of center token)
        const sheepDefs = [
            { isRam: true,  isLamb: false, cx: -1.05, cz: -0.45, r: 0.24, speed: 0.35 },
            { isRam: false, isLamb: false, cx:  0.95, cz: -0.55, r: 0.25, speed: 0.32 },
            { isRam: false, isLamb: false, cx: -0.55, cz:  1.05, r: 0.22, speed: 0.36 },
            { isRam: false, isLamb: true,  cx:  0.65, cz:  0.95, r: 0.18, speed: 0.45 }
        ];
        for (const def of sheepDefs) {
            const sheep = makeSheep(def.isRam, def.isLamb);
            const startAngle = Math.random() * Math.PI * 2;
            sheep.position.x = def.cx + Math.cos(startAngle) * def.r;
            sheep.position.y = 0;
            sheep.position.z = def.cz + Math.sin(startAngle) * def.r;
            g.add(sheep);
            this._sheepWalk.push({
                mesh: sheep, cx: def.cx, cz: def.cz, r: def.r,
                angle: startAngle, speed: def.speed, baseY: 0
            });
        }

        // Trough
        const troughGrp = new THREE.Group();
        const tBody = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.22), this.fenceWoodMat);
        tBody.position.y = by(0.16);
        const tWater = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.06, 0.16), this.riverMat);
        tWater.position.y = 0.16 - 0.03;
        troughGrp.add(tBody, tWater);
        troughGrp.position.set(-0.75, 0, -1.05); troughGrp.rotation.y = 0.35;
        g.add(troughGrp);

        // Wildflowers outside center
        const fGeo = new THREE.CircleGeometry(0.06, 6);
        [[-1.15,0.15],[-0.45,-1.25],[1.15,-0.2],[0.25,1.25],[0.95,0.9],[-0.95,0.85]].forEach(([fx, fz], i) => {
            const fl = new THREE.Mesh(fGeo, i % 2 === 0 ? this.flowerYellow : this.flowerRed);
            fl.rotation.x = -Math.PI / 2; fl.position.set(fx, 0.01, fz);
            g.add(fl);
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. FIELDS (GRAIN)
    // ─────────────────────────────────────────────────────────────────────────
    _buildField(g) {
        // ── WINDMILL (positioned in corner dist = 1.28) ──
        const mill = new THREE.Group();
        const towerH = 0.82;
        const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.42, towerH, 8), this.fenceWoodMat);
        tower.position.y = by(towerH);
        tower.castShadow = true; mill.add(tower);

        const capH = 0.32;
        const cap = new THREE.Mesh(new THREE.ConeGeometry(0.30, capH, 8), this.wheatMat);
        cap.position.y = towerH + by(capH);
        cap.castShadow = true; mill.add(cap);

        const sailsHub = new THREE.Group();
        sailsHub.position.set(0, towerH * 0.78, 0.28);
        const hubCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.10, 8), this.logMat);
        hubCyl.rotation.x = Math.PI / 2; sailsHub.add(hubCyl);

        const sparGeo = new THREE.BoxGeometry(0.026, 0.90, 0.026);
        const sailGeo = new THREE.PlaneGeometry(0.19, 0.36);
        for (let i = 0; i < 4; i++) {
            const arm = new THREE.Group(); arm.rotation.z = (i * Math.PI) / 2;
            const spar  = new THREE.Mesh(sparGeo, this.fenceWoodMat);
            const cloth = new THREE.Mesh(sailGeo,  this.sailMatW);
            spar.position.y = 0.45;
            cloth.position.y = 0.45;
            arm.add(spar, cloth); sailsHub.add(arm);
        }
        mill.add(sailsHub);

        mill.position.set(-1.10, 0, -0.65); mill.rotation.y = 0.5;
        g.add(mill);
        this._windmills.push({ sailsHub, speed: 0.55 + Math.random() * 0.25 });

        // ── Scarecrow (positioned in opposite corner dist = 1.18) ──
        const scGrp = new THREE.Group();
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.65), this.scarecrowMat);
        post.position.y = by(0.65);
        const arms = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.42), this.scarecrowMat);
        arms.rotation.z = Math.PI / 2; arms.position.y = 0.50;
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), this.wheatMat);
        head.position.y = 0.70;
        const hat = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.14, 6), this.scarecrowMat);
        hat.position.y = 0.84;
        scGrp.add(post, arms, head, hat);
        scGrp.position.set(1.05, 0, 0.55);
        g.add(scGrp);

        // Hay bales (outer ring)
        const baleGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.28, 12);
        [
            { x:  0.95, z: -0.65, rz: Math.PI / 2 },
            { x:  1.15, z:  0.45, rz: 0            },
            { x: -0.35, z:  1.15, rz: Math.PI / 2 }
        ].forEach(b => {
            const bale = new THREE.Mesh(baleGeo, this.hayMat);
            bale.rotation.z = b.rz; bale.castShadow = true;
            bale.position.y = Math.abs(b.rz) > 0.1 ? 0.22 : by(0.28);
            bale.position.x = b.x; bale.position.z = b.z;
            g.add(bale);
        });

        // Wheat sheaves
        [[0.45,-1.15],[-0.95,0.45]].forEach(([sx, sz]) => {
            const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.36, 6), this.wheatMat);
            sh.position.set(sx, by(0.36), sz); g.add(sh);
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. HILLS (BRICK)
    // ─────────────────────────────────────────────────────────────────────────
    _buildHill(g) {
        const moundH = 0.48;
        [{ x: -0.95, z: -0.55, s: 0.95 }, { x: 0.95, z: 0.55, s: 0.85 }].forEach(m => {
            const mound = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.95, moundH, 6), this.clayMat);
            mound.scale.setScalar(m.s); mound.position.set(m.x, by(moundH), m.z);
            mound.castShadow = true; mound.receiveShadow = true; g.add(mound);
        });

        // Brick kiln (dist = 1.14)
        const kilnGrp = new THREE.Group();
        const dome = new THREE.Mesh(
            new THREE.SphereGeometry(0.28, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
            this.brickMat
        );
        dome.position.y = 0; kilnGrp.add(dome);
        const chiH = 0.42;
        const chi = new THREE.Mesh(new THREE.BoxGeometry(0.12, chiH, 0.12), this.brickMat);
        chi.position.set(0, 0.28 + by(chiH), 0); kilnGrp.add(chi);
        kilnGrp.position.set(-1.05, 0, 0.45); kilnGrp.rotation.y = -0.4;
        g.add(kilnGrp);

        // Brick pallet
        const pltGrp = new THREE.Group();
        const pBoard = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.04, 0.35), this.fenceWoodMat);
        pBoard.position.y = by(0.04);
        const pStack = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.18, 0.30), this.brickMat);
        pStack.position.y = 0.04 + by(0.18);
        pltGrp.add(pBoard, pStack);
        pltGrp.position.set(0.55, 0, -1.05);
        g.add(pltGrp);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 6. DESERT
    // ─────────────────────────────────────────────────────────────────────────
    _buildDesert(g) {
        // Dunes
        [{ x: -0.45, z: -0.35, sx: 1.25, sy: 0.26 }, { x: 0.55, z: 0.45, sx: 1.05, sy: 0.20 }].forEach(d => {
            const dune = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 8), this.desertMat);
            dune.scale.set(d.sx, d.sy, 0.68); dune.position.set(d.x, 0, d.z); g.add(dune);
        });

        // Oasis pool
        const pool = new THREE.Mesh(new THREE.CircleGeometry(0.42, 12), this.riverMat);
        pool.rotation.x = -Math.PI / 2; pool.position.set(-0.45, 0.02, 0.45); g.add(pool);

        // Palm trees
        [[0.75, 0.18, 0.4, -0.65, 0.35], [0.6, -0.15, -0.8, -0.35, 0.65]].forEach(([h, rz, ry, px, pz]) => {
            const palm = new THREE.Group();
            const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.075, h, 6), this.logMat);
            trunk.position.y = by(h);
            trunk.rotation.z = rz; palm.add(trunk);
            for (let i = 0; i < 6; i++) {
                const frond = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.18), this.palmLeafMat);
                frond.rotation.y = (i * Math.PI) / 3;
                frond.rotation.x = 0.65;
                frond.position.y = h;
                palm.add(frond);
            }
            palm.rotation.y = ry; palm.position.set(px, 0, pz);
            g.add(palm);
        });

        // Obelisk
        const ob = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.65, 4), this.clayMat);
        ob.position.set(0.65, by(0.65), -0.45); ob.rotation.y = Math.PI / 4; ob.rotation.z = -0.10; g.add(ob);

        // Fallen column
        const fc = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.42, 8), this.clayMat);
        fc.rotation.z = Math.PI / 2;
        fc.position.set(0.45, 0.08, -0.58); fc.rotation.y = 0.35;
        g.add(fc);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 7. GOLD FIELD
    // ─────────────────────────────────────────────────────────────────────────
    _buildGold(g) {
        const river = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 0.52), this.riverMat);
        river.rotation.x = -Math.PI / 2; river.position.set(0, 0.04, 0.35); g.add(river);

        const sluice = new THREE.Group();
        const base = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.03, 0.22), this.dockWoodMat);
        base.position.y = by(0.03);
        [-0.11, 0.11].forEach(oz => {
            const w = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.10, 0.03), this.dockWoodMat);
            w.position.set(0, by(0.10), oz); sluice.add(w);
        });
        sluice.add(base);
        sluice.position.set(0.45, 0, 0.95); sluice.rotation.y = -0.2;
        g.add(sluice);

        const chest = new THREE.Group();
        const cBody = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.20), this.dockWoodMat);
        cBody.position.y = by(0.18);
        const lid = new THREE.Mesh(
            new THREE.CylinderGeometry(0.10, 0.10, 0.28, 8, 1, false, 0, Math.PI),
            this.dockWoodMat
        );
        lid.rotation.z = Math.PI / 2; lid.rotation.x = -0.55;
        lid.position.set(0, 0.20, -0.08);
        const coins = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.14), this.goldCoinMat);
        coins.position.y = 0.18 + by(0.08);
        chest.add(cBody, lid, coins);
        chest.position.set(-0.85, 0, -0.75); chest.rotation.y = 0.6;
        g.add(chest);

        const nGeo = new THREE.DodecahedronGeometry(0.10, 1);
        [[-0.55,-0.95],[0.95,-0.75],[-0.85,0.65],[0.85,0.85]].forEach(([nx, nz]) => {
            const nug = new THREE.Mesh(nGeo, this.goldNuggetMat);
            nug.position.set(nx, 0.10, nz); nug.castShadow = true; g.add(nug);
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CROSSROADS
    // ─────────────────────────────────────────────────────────────────────────
    _buildCrossroads(gameState) {
        const padGeo = new THREE.CylinderGeometry(0.32, 0.35, 0.08, 16);
        for (const [, vertex] of gameState.vertices) {
            const touches = vertex.hexes.some(h => {
                const t = gameState.getTile ? gameState.getTile(h.q, h.r) : null;
                return t && t.type !== 'SEA';
            });
            if (!touches) continue;
            const pos = this.vertexToWorld(vertex);
            const pad = new THREE.Mesh(padGeo, this.crossroadMat);
            pad.position.set(pos.x, 0.43, pos.z);
            pad.receiveShadow = true; this.boardGroup.add(pad);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // NUMBER TOKEN
    // ─────────────────────────────────────────────────────────────────────────
    createNumberToken(number) {
        if (!number) return null;
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 256;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#f3edd6';
        ctx.beginPath(); ctx.arc(128,128,122,0,Math.PI*2); ctx.fill();
        ctx.lineWidth = 10; ctx.strokeStyle = '#c4b38d'; ctx.stroke();
        ctx.lineWidth = 3; ctx.strokeStyle = '#8d7951';
        ctx.beginPath(); ctx.arc(128,128,106,0,Math.PI*2); ctx.stroke();
        const isRed = number === 6 || number === 8;
        ctx.fillStyle = isRed ? '#c62828' : '#1c1b18';
        ctx.font = 'bold 112px "Times New Roman",Georgia,serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(number), 128, 114);
        const dots = 6 - Math.abs(7 - number);
        const sx = 128 - (dots - 1) * 11;
        for (let d = 0; d < dots; d++) {
            ctx.beginPath(); ctx.arc(sx + d * 22, 192, 7, 0, Math.PI * 2);
            ctx.fillStyle = isRed ? '#c62828' : '#333333'; ctx.fill();
        }
        const tg = new THREE.Group();
        const base = new THREE.Mesh(
            new THREE.CylinderGeometry(0.80, 0.82, 0.10, 32),
            new THREE.MeshStandardMaterial({ color: 0xd8caa6, roughness: 0.7 })
        );
        const top = new THREE.Mesh(
            new THREE.CircleGeometry(0.79, 32),
            new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(canvas), roughness: 0.4 })
        );
        top.rotation.x = -Math.PI / 2; top.position.y = 0.055;
        tg.add(base, top);
        return tg;
    }

    createHarborMarker(harbor) {
        const g = new THREE.Group();
        const deck = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.10, 1.2), this.dockWoodMat);
        deck.position.y = 0.18; g.add(deck);
        const pGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.40, 6);
        [[-0.25,-0.45],[0.25,-0.45],[-0.25,0.45],[0.25,0.45]].forEach(([px, pz]) => {
            const p = new THREE.Mesh(pGeo, this.dockWoodMat);
            p.position.set(px, 0.05, pz); g.add(p);
        });
        const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128;
        const ctx = cv.getContext('2d');
        ctx.fillStyle = '#0e2646'; ctx.fillRect(0, 0, 128, 128);
        ctx.lineWidth = 8; ctx.strokeStyle = '#f5c542'; ctx.strokeRect(4, 4, 120, 120);
        ctx.fillStyle = '#f5c542'; ctx.font = 'bold 44px Arial';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(harbor.type === 'GENERIC' ? '3:1' : '2:1', 64, 48);
        ctx.font = 'bold 22px Arial';
        ctx.fillText(harbor.type === 'GENERIC' ? '?' : harbor.type.slice(0, 4), 64, 94);
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.8), this.dockWoodMat);
        post.position.set(0, 0.45, 0.3);
        const sign = new THREE.Mesh(
            new THREE.BoxGeometry(0.60, 0.60, 0.04),
            new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv) })
        );
        sign.position.set(0, 0.75, 0.3);
        g.add(post, sign);
        return g;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // BUILD BOARD
    // ─────────────────────────────────────────────────────────────────────────
    buildBoardFromGameState(gameState) {
        this.boardGroup.clear();
        this.tiles.clear();
        this._windmills = [];
        this._swayTrees  = [];
        this._sheepWalk  = [];

        try {
            const tilesMap = gameState.tiles;
            const harbors  = gameState.harbors || [];

            for (const tile of tilesMap.values()) {
                const isSea = tile.type === 'SEA';
                const geo   = isSea ? this.hexGeometrySea : this.hexGeometryLand;
                const mat   = tile.isDiscovered === false
                    ? this.fogMaterial
                    : (this.materials[tile.type] || this.materials['SEA']);

                const mesh = new THREE.Mesh(geo, mat);
                const pos  = this.hexToWorld(tile.q, tile.r);
                mesh.rotation.x = Math.PI / 2;
                mesh.position.set(pos.x, isSea ? -0.05 : 0, pos.z);
                mesh.receiveShadow = true; mesh.castShadow = !isSea;
                mesh.userData = { q: tile.q, r: tile.r, type: 'tile', tileData: tile, revealed: (tile.isDiscovered !== false) };
                this.boardGroup.add(mesh);
                this.tiles.set(`${tile.q},${tile.r}`, mesh);

                const surfaceY = isSea ? -0.05 : this._getSurfaceY(mesh);

                this._decorateHex(this.boardGroup, tile, pos, surfaceY);

                if (!isSea && tile.isDiscovered !== false && tile.number && tile.type !== 'DESERT') {
                    const token = this.createNumberToken(tile.number);
                    if (token) {
                        token.position.set(pos.x, surfaceY + 0.06, pos.z);
                        this.boardGroup.add(token);
                    }
                }
            }

            this._buildCrossroads(gameState);

            for (const harbor of harbors) {
                const pos    = this.hexToWorld(harbor.q, harbor.r);
                const marker = this.createHarborMarker(harbor);
                if (marker) { marker.position.set(pos.x, 0.05, pos.z); this.boardGroup.add(marker); }
            }

        } catch (err) {
            console.error('[HexBoard3D] buildBoardFromGameState error:', err);
        }
    }

    /**
     * Lật một ô đảo từ sương mù (fog) → hiển thị thực tế (reveal).
     * Gọi sau khi tile.isDiscovered đã được set true bởi GameState.
     * @param {number} q
     * @param {number} r
     * @param {object} tile - HexTile object từ gameState.tiles
     */
    revealTile(q, r, tile) {
        const key  = `${q},${r}`;
        const mesh = this.tiles.get(key);
        if (!mesh) return;

        mesh.userData.revealed = true;
        mesh.userData.tileData = tile;

        // Swap material từ fog → vật liệu thực
        mesh.material = this.materials[tile.type] || this.materials['SEA'];
        if (mesh.material) mesh.material.needsUpdate = true;
        mesh.castShadow = (tile.type !== 'SEA');
        mesh.receiveShadow = true;

        // Thêm trang trí địa hình
        const pos      = this.hexToWorld(q, r);
        const surfaceY = this._getSurfaceY(mesh);
        this._decorateHex(this.boardGroup, tile, pos, surfaceY);

        // Thêm số token nếu có
        if (tile.number && tile.type !== 'DESERT') {
            const token = this.createNumberToken(tile.number);
            if (token) {
                token.position.set(pos.x, surfaceY + 0.06, pos.z);
                this.boardGroup.add(token);
            }
        }
    }

    clearHighlights() { this.highlightsGroup.clear(); this.highlightObjects = []; }

    showVertexHighlights(vertexKeys, gameState) {
        this.clearHighlights();
        const vGeo = new THREE.SphereGeometry(0.55, 18, 18);
        const pGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.25, 8);
        const rGeo = new THREE.RingGeometry(0.42, 0.65, 16);
        const hMat = new THREE.MeshBasicMaterial({ visible: false });
        const hGeo = new THREE.SphereGeometry(1.25, 12, 12);

        for (const vKey of vertexKeys) {
            const vertex = gameState.vertices.get(vKey); if (!vertex) continue;
            const pos = this.vertexToWorld(vertex);
            const grp = new THREE.Group(); grp.position.set(pos.x, 0, pos.z);
            grp.userData = { targetType: 'vertex', key: vKey };

            const vm = new THREE.Mesh(vGeo, this.beaconGlowMat);
            vm.position.y = 1.35; vm.userData = { targetType: 'vertex', key: vKey };
            const pl = new THREE.Mesh(pGeo, this.beaconPillarMat); pl.position.y = 0.72;
            const rg = new THREE.Mesh(rGeo, this.targetRingMat); rg.rotation.x = -Math.PI / 2; rg.position.y = 0.48;
            const hm = new THREE.Mesh(hGeo, hMat); hm.position.y = 1.35; hm.userData = { targetType: 'vertex', key: vKey };
            grp.add(vm, pl, rg, hm);
            this.highlightsGroup.add(grp);
            this.highlightObjects.push(vm, hm);
        }
    }

    showEdgeHighlights(edgeKeys, gameState) {
        this.clearHighlights();
        const nGeo = new THREE.SphereGeometry(0.52, 18, 18);
        const pGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.0, 8);
        const hMat = new THREE.MeshBasicMaterial({ visible: false });
        const hGeo = new THREE.SphereGeometry(1.2, 12, 12);

        for (const eKey of edgeKeys) {
            const edge = gameState.edges.get(eKey); if (!edge) continue;
            const v1 = gameState.vertices.get(edge.vertices[0]);
            const v2 = gameState.vertices.get(edge.vertices[1]);
            if (!v1 || !v2) continue;
            const p1 = this.vertexToWorld(v1), p2 = this.vertexToWorld(v2);
            const dist = p1.distanceTo(p2);
            const mid  = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);

            const grp = new THREE.Group(); grp.position.set(mid.x, 0, mid.z);
            grp.userData = { targetType: 'edge', key: eKey };

            const nm = new THREE.Mesh(nGeo, this.beaconGlowMat);
            nm.position.y = 1.25; nm.userData = { targetType: 'edge', key: eKey };
            const pin = new THREE.Mesh(pGeo, this.beaconPillarMat); pin.position.y = 0.65;
            const dir = new THREE.Vector3().subVectors(p2, p1).normalize();
            const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, dist * 0.94, 12), this.edgeHighlightMat);
            bar.position.y = 1.05; bar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
            bar.userData = { targetType: 'edge', key: eKey };
            const hm = new THREE.Mesh(hGeo, hMat); hm.position.y = 1.25; hm.userData = { targetType: 'edge', key: eKey };
            grp.add(nm, pin, bar, hm);
            this.highlightsGroup.add(grp);
            this.highlightObjects.push(nm, bar, hm);
        }
    }

    showTileHighlights(filterFn) {
        this.clearHighlights();
        const hitGeo = new THREE.CylinderGeometry(2.35, 2.35, 0.6, 6);
        const hitMat = new THREE.MeshBasicMaterial({ visible: false });

        for (const [, tileMesh] of this.tiles) {
            const tile = tileMesh.userData.tileData;
            if (!filterFn || filterFn(tile)) {
                const grp = new THREE.Group();
                grp.position.set(tileMesh.position.x, 0.55, tileMesh.position.z);
                grp.userData = { targetType: 'tile', q: tile.q, r: tile.r };

                // 1. Visual glowing outline ring (aligned with hex orientation)
                const ring = new THREE.Mesh(new THREE.RingGeometry(1.6, 2.2, 6), this.tileHighlightMat);
                ring.rotation.z = Math.PI / 6;
                ring.rotation.x = -Math.PI / 2;
                ring.userData = { targetType: 'tile', q: tile.q, r: tile.r };

                // 2. Solid 3D hex hitbox covering the entire surface and center (r: 0 -> 2.35)
                const hitMesh = new THREE.Mesh(hitGeo, hitMat);
                hitMesh.position.y = 0.2;
                hitMesh.userData = { targetType: 'tile', q: tile.q, r: tile.r };

                grp.add(ring, hitMesh);
                this.highlightsGroup.add(grp);
                this.highlightObjects.push(ring, hitMesh);
            }
        }
    }
}
