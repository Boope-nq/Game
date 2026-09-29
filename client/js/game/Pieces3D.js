import * as THREE from 'three';

export class Pieces3D {
    constructor(scene) {
        this.scene = scene;
        this.piecesGroup = new THREE.Group();
        this.scene.add(this.piecesGroup);
        
        this.animatedObjects = [];
        this.settlements = new Map();
        this.cities = new Map();
        this.roads = new Map();
        this.ships = new Map();
        
        this.robberMesh = null;
        this.pirateMesh = null;

        // Shared materials
        this.stoneBaseMat = new THREE.MeshStandardMaterial({ color: 0x5a5f6b, roughness: 0.85 });
        this.cottageWallMat = new THREE.MeshStandardMaterial({ color: 0xf0ece1, roughness: 0.7 });
        this.woodTrimMat = new THREE.MeshStandardMaterial({ color: 0x3d2514, roughness: 0.8 });
        this.chimneyMat = new THREE.MeshStandardMaterial({ color: 0x424650, roughness: 0.9 });
        this.goldAccentMat = new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.3, metalness: 0.7 });
        this.sailClothMat = new THREE.MeshStandardMaterial({ color: 0xf7f5eb, roughness: 0.6, side: THREE.DoubleSide });
    }

    clearAll() {
        this.piecesGroup.clear();
        this.animatedObjects = [];
        this.settlements.clear();
        this.cities.clear();
        this.roads.clear();
        this.ships.clear();
        this.robberMesh = null;
        this.pirateMesh = null;
    }

    // ─── 1. SETTLEMENT (MEDIEVAL TIMBERED COTTAGE) ──────────────────────────────
    createSettlement(colorHex) {
        const group = new THREE.Group();
        const roofMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.5 });

        // Stone foundation
        const baseGeo = new THREE.BoxGeometry(0.68, 0.12, 0.62);
        const base = new THREE.Mesh(baseGeo, this.stoneBaseMat);
        base.position.y = 0.06;
        base.castShadow = true;
        base.receiveShadow = true;

        // Plaster walls
        const wallGeo = new THREE.BoxGeometry(0.56, 0.42, 0.52);
        const walls = new THREE.Mesh(wallGeo, this.cottageWallMat);
        walls.position.y = 0.33;
        walls.castShadow = true;

        // Steep gabled roof in player's color
        const roofGeo = new THREE.ConeGeometry(0.48, 0.44, 4);
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.y = 0.74;
        roof.rotation.y = Math.PI / 4;
        roof.castShadow = true;

        // Stone chimney
        const chimneyGeo = new THREE.BoxGeometry(0.12, 0.52, 0.12);
        const chimney = new THREE.Mesh(chimneyGeo, this.chimneyMat);
        chimney.position.set(0.2, 0.62, 0.14);
        chimney.castShadow = true;

        // Wooden front door
        const doorGeo = new THREE.BoxGeometry(0.14, 0.24, 0.04);
        const door = new THREE.Mesh(doorGeo, this.woodTrimMat);
        door.position.set(0, 0.24, 0.27);

        group.add(base, walls, roof, chimney, door);
        return group;
    }

    // ─── 2. CITY (GRAND MEDIEVAL FORTIFIED CITADEL) ─────────────────────────────
    createCity(colorHex) {
        const group = new THREE.Group();
        const playerMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.5 });

        // Fortress stone foundation
        const baseGeo = new THREE.BoxGeometry(1.0, 0.18, 0.85);
        const base = new THREE.Mesh(baseGeo, this.stoneBaseMat);
        base.position.y = 0.09;
        base.castShadow = true;
        base.receiveShadow = true;

        // Main cathedral / keep building
        const keepGeo = new THREE.BoxGeometry(0.55, 0.62, 0.72);
        const keep = new THREE.Mesh(keepGeo, this.stoneBaseMat);
        keep.position.set(0.14, 0.49, 0);
        keep.castShadow = true;

        // Cathedral roof in player color
        const keepRoofGeo = new THREE.ConeGeometry(0.48, 0.45, 4);
        const keepRoof = new THREE.Mesh(keepRoofGeo, playerMat);
        keepRoof.position.set(0.14, 0.98, 0);
        keepRoof.rotation.y = Math.PI / 4;
        keepRoof.castShadow = true;

        // Tall defensive tower
        const towerGeo = new THREE.CylinderGeometry(0.22, 0.26, 1.1, 8);
        const tower = new THREE.Mesh(towerGeo, this.stoneBaseMat);
        tower.position.set(-0.28, 0.72, -0.15);
        tower.castShadow = true;

        // Tower spire in player color with golden top
        const spireGeo = new THREE.ConeGeometry(0.26, 0.6, 8);
        const spire = new THREE.Mesh(spireGeo, playerMat);
        spire.position.set(-0.28, 1.55, -0.15);
        spire.castShadow = true;

        const crestGeo = new THREE.SphereGeometry(0.07, 8, 8);
        const crest = new THREE.Mesh(crestGeo, this.goldAccentMat);
        crest.position.set(-0.28, 1.88, -0.15);

        // Tower crenellations (battlements)
        const battlementGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.12, 8);
        const battlement = new THREE.Mesh(battlementGeo, this.stoneBaseMat);
        battlement.position.set(-0.28, 1.28, -0.15);

        // Entrance arched gate
        const gateGeo = new THREE.BoxGeometry(0.16, 0.32, 0.04);
        const gate = new THREE.Mesh(gateGeo, this.woodTrimMat);
        gate.position.set(0.14, 0.32, 0.37);

        group.add(base, keep, keepRoof, tower, battlement, spire, crest, gate);
        return group;
    }

    // ─── 3. ROAD (CARVED TIMBER COBBLESTONE BEAM) ──────────────────────────────
    createRoad(colorHex, v1pos, v2pos) {
        const mat = new THREE.MeshStandardMaterial({
            color: colorHex,
            roughness: 0.75,
            metalness: 0.1
        });
        const distance = v1pos.distanceTo(v2pos);
        
        // Paved road segment
        const geo = new THREE.BoxGeometry(0.26, 0.16, distance * 0.94);
        const road = new THREE.Mesh(geo, mat);
        
        const midPoint = new THREE.Vector3().addVectors(v1pos, v2pos).multiplyScalar(0.5);
        road.position.copy(midPoint);
        road.position.y = 0.52;
        
        road.lookAt(v2pos);
        road.castShadow = true;
        road.receiveShadow = true;
        return road;
    }

    // ─── 4. SHIP (DETAILED SEAFARING CARAVEL COG) ───────────────────────────────
    createShip(colorHex, v1pos, v2pos) {
        const group = new THREE.Group();
        const hullMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.5 });
        const playerStripeMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.4 });

        // Curved wooden hull
        const hullGeo = new THREE.CylinderGeometry(0.25, 0.14, 0.85, 8);
        const hull = new THREE.Mesh(hullGeo, hullMat);
        hull.rotation.z = Math.PI / 2;
        hull.position.y = 0.16;
        hull.castShadow = true;

        // Raised forecastle & sterncastle
        const cabinGeo = new THREE.BoxGeometry(0.3, 0.22, 0.26);
        const cabin = new THREE.Mesh(cabinGeo, this.woodTrimMat);
        cabin.position.set(0, 0.28, -0.28);
        cabin.castShadow = true;

        // Timber mast
        const mastGeo = new THREE.CylinderGeometry(0.03, 0.035, 0.85, 6);
        const mast = new THREE.Mesh(mastGeo, this.woodTrimMat);
        mast.position.set(0, 0.58, 0.04);
        mast.castShadow = true;

        // Yardarm crossbeam
        const yardGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.55, 6);
        const yard = new THREE.Mesh(yardGeo, this.woodTrimMat);
        yard.rotation.z = Math.PI / 2;
        yard.position.set(0, 0.86, 0.04);

        // Billowing cloth sail with player-colored stripe
        const sailGeo = new THREE.PlaneGeometry(0.52, 0.54, 4, 4);
        // Curve sail vertices for billowing wind effect
        const posAttr = sailGeo.attributes.position;
        for (let i = 0; i < posAttr.count; i++) {
            const y = posAttr.getY(i);
            posAttr.setZ(i, Math.cos(y * 4) * 0.08);
        }
        sailGeo.computeVertexNormals();

        const sail = new THREE.Mesh(sailGeo, this.sailClothMat);
        sail.position.set(0, 0.58, 0.1);
        sail.castShadow = true;

        // Player pennant / flag at top of mast
        const flagGeo = new THREE.PlaneGeometry(0.18, 0.1);
        const flag = new THREE.Mesh(flagGeo, playerStripeMat);
        flag.position.set(0.1, 0.98, 0.04);

        group.add(hull, cabin, mast, yard, sail, flag);

        const midPoint = new THREE.Vector3().addVectors(v1pos, v2pos).multiplyScalar(0.5);
        group.position.copy(midPoint);
        group.position.y = 0.06;
        group.lookAt(v2pos);

        group.userData.baseY = group.position.y;
        group.userData.phase = Math.random() * Math.PI * 2;
        this.animatedObjects.push(group);
        return group;
    }

    // ─── 5. ROBBER (CLOAKED HOODED BANDIT WITH LOOT SACK) ───────────────────────
    createRobber() {
        const group = new THREE.Group();
        const cloakMat = new THREE.MeshStandardMaterial({ color: 0x1f2329, roughness: 0.9 });
        const beltMat  = new THREE.MeshStandardMaterial({ color: 0x5a341a, roughness: 0.7 });
        const sackMat  = new THREE.MeshStandardMaterial({ color: 0xb38647, roughness: 0.8 });

        // Cloaked flowing body
        const bodyGeo = new THREE.ConeGeometry(0.38, 1.25, 8);
        const body = new THREE.Mesh(bodyGeo, cloakMat);
        body.position.y = 0.65;
        body.castShadow = true;

        // Hooded head
        const headGeo = new THREE.SphereGeometry(0.24, 8, 8);
        const head = new THREE.Mesh(headGeo, cloakMat);
        head.position.y = 1.38;
        head.castShadow = true;

        // Leather belt with gold buckle
        const beltGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.1, 8);
        const belt = new THREE.Mesh(beltGeo, beltMat);
        belt.position.y = 0.62;

        const buckleGeo = new THREE.BoxGeometry(0.08, 0.12, 0.06);
        const buckle = new THREE.Mesh(buckleGeo, this.goldAccentMat);
        buckle.position.set(0, 0.62, 0.33);

        // Sack of stolen loot over shoulder
        const sackGeo = new THREE.SphereGeometry(0.28, 8, 8);
        const sack = new THREE.Mesh(sackGeo, sackMat);
        sack.scale.set(1.1, 1.3, 0.9);
        sack.position.set(-0.25, 0.88, -0.15);
        sack.castShadow = true;

        group.add(body, head, belt, buckle, sack);
        return group;
    }

    // ─── 6. PIRATE (MENACING BLACK GALLEON WITH SKULL FLAG) ─────────────────────
    createPirate() {
        const group = new THREE.Group();
        const blackHullMat = new THREE.MeshStandardMaterial({ color: 0x111316, roughness: 0.8 });
        const blackSailMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1e, side: THREE.DoubleSide });

        // Heavy pirate hull
        const hullGeo = new THREE.CylinderGeometry(0.32, 0.18, 1.05, 8);
        const hull = new THREE.Mesh(hullGeo, blackHullMat);
        hull.rotation.z = Math.PI / 2;
        hull.position.y = 0.22;
        hull.castShadow = true;

        // Sterncastle
        const cabinGeo = new THREE.BoxGeometry(0.38, 0.3, 0.35);
        const cabin = new THREE.Mesh(cabinGeo, blackHullMat);
        cabin.position.set(0, 0.36, -0.35);

        // Main mast
        const mastGeo = new THREE.CylinderGeometry(0.035, 0.04, 1.05, 6);
        const mast = new THREE.Mesh(mastGeo, blackHullMat);
        mast.position.set(0, 0.72, 0.05);

        // Black sails
        const sailGeo = new THREE.PlaneGeometry(0.65, 0.65);
        const sail = new THREE.Mesh(sailGeo, blackSailMat);
        sail.position.set(0, 0.72, 0.12);
        sail.castShadow = true;

        // Jolly Roger pirate flag
        const flagGeo = new THREE.PlaneGeometry(0.24, 0.15);
        const flag = new THREE.Mesh(flagGeo, blackSailMat);
        flag.position.set(0.14, 1.22, 0.05);

        group.add(hull, cabin, mast, sail, flag);
        group.userData.baseY = 0.08;
        group.userData.phase = 0;
        this.animatedObjects.push(group);
        return group;
    }

    // ─── PLACEMENT HELPERS ─────────────────────────────────────────────────────

    placeSettlement(vertexKey, worldPos, colorHex) {
        if (this.settlements.has(vertexKey)) return;
        const mesh = this.createSettlement(colorHex);
        mesh.position.set(worldPos.x, 0.44, worldPos.z);
        this.piecesGroup.add(mesh);
        this.settlements.set(vertexKey, mesh);
    }

    placeCity(vertexKey, worldPos, colorHex) {
        // Upgrade: remove existing settlement if present
        if (this.settlements.has(vertexKey)) {
            const old = this.settlements.get(vertexKey);
            this.piecesGroup.remove(old);
            this.settlements.delete(vertexKey);
        }
        if (this.cities.has(vertexKey)) return;

        const mesh = this.createCity(colorHex);
        mesh.position.set(worldPos.x, 0.44, worldPos.z);
        this.piecesGroup.add(mesh);
        this.cities.set(vertexKey, mesh);
    }

    placeRoad(edgeKey, v1pos, v2pos, colorHex) {
        if (this.roads.has(edgeKey)) return;
        const mesh = this.createRoad(colorHex, v1pos, v2pos);
        this.piecesGroup.add(mesh);
        this.roads.set(edgeKey, mesh);
    }

    placeShip(edgeKey, v1pos, v2pos, colorHex) {
        if (this.ships.has(edgeKey)) return;
        const mesh = this.createShip(colorHex, v1pos, v2pos);
        this.piecesGroup.add(mesh);
        this.ships.set(edgeKey, mesh);
    }

    removeShip(edgeKey) {
        if (this.ships.has(edgeKey)) {
            const shipMesh = this.ships.get(edgeKey);
            this.piecesGroup.remove(shipMesh);
            this.animatedObjects = this.animatedObjects.filter(obj => obj !== shipMesh);
            this.ships.delete(edgeKey);
        }
    }

    setRobberPos(worldPos) {
        if (!this.robberMesh) {
            this.robberMesh = this.createRobber();
            this.piecesGroup.add(this.robberMesh);
        }
        this.robberMesh.position.set(worldPos.x, 0.45, worldPos.z);
    }

    setPiratePos(worldPos) {
        if (!this.pirateMesh) {
            this.pirateMesh = this.createPirate();
            this.piecesGroup.add(this.pirateMesh);
        }
        this.pirateMesh.position.set(worldPos.x, 0.05, worldPos.z);
    }

    update(delta) {
        if (!this._elapsed) this._elapsed = 0;
        this._elapsed += delta;
        this.animateFloating(delta, this._elapsed);
    }

    animateFloating(delta, elapsedTime) {
        for (const obj of this.animatedObjects) {
            const phase = obj.userData.phase || 0;
            const baseY = obj.userData.baseY || 0.05;
            obj.position.y = baseY + Math.sin(elapsedTime * 2.2 + phase) * 0.035;
            obj.rotation.z = Math.sin(elapsedTime * 1.8 + phase) * 0.04;
            obj.rotation.x = Math.cos(elapsedTime * 1.5 + phase) * 0.03;
        }
    }
}
