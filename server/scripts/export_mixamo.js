import * as THREE from '../node_modules/three/build/three.module.js';
import { GLTFLoader } from '../node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from '../node_modules/three/examples/jsm/libs/meshopt_decoder.module.js';
import fs from 'fs';

globalThis.self = globalThis;
globalThis.createImageBitmap = () => Promise.resolve({});

async function run() {
    await MeshoptDecoder.ready;
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);

    const fileBuf = fs.readFileSync('client/assets/models/bunny_pirate.glb');
    loader.parse(fileBuf.buffer.slice(fileBuf.byteOffset, fileBuf.byteOffset + fileBuf.byteLength), '', (gltf) => {
        gltf.scene.traverse((child) => {
            if (child.isMesh) {
                const pos = child.geometry.attributes.position;
                const index = child.geometry.index;

                const oldToNew = new Int32Array(pos.count).fill(-1);
                const newIndices = [];
                const newPos = [];
                let newCount = 0;

                const idxArr = index.array;
                for (let i = 0; i < idxArr.length; i += 3) {
                    const i0 = idxArr[i], i1 = idxArr[i + 1], i2 = idxArr[i + 2];
                    const avgZ = (pos.getZ(i0) + pos.getZ(i1) + pos.getZ(i2)) / 3;
                    if (avgZ >= 0.255) {
                        for (const vi of [i0, i1, i2]) {
                            if (oldToNew[vi] === -1) {
                                oldToNew[vi] = newCount++;
                                const x = pos.getX(vi), y = pos.getY(vi), z = pos.getZ(vi);
                                newPos.push(z, y, -x);
                            }
                            newIndices.push(oldToNew[vi]);
                        }
                    }
                }

                console.log('Filtered unique vertices:', newCount);
                console.log('Filtered triangles:', newIndices.length / 3);

                let minX = Infinity, maxX = -Infinity;
                let minY = Infinity, maxY = -Infinity;
                let minZ = Infinity, maxZ = -Infinity;
                for (let i = 0; i < newPos.length; i += 3) {
                    const x = newPos[i], y = newPos[i + 1], z = newPos[i + 2];
                    if (x < minX) minX = x; if (x > maxX) maxX = x;
                    if (y < minY) minY = y; if (y > maxY) maxY = y;
                    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
                }
                const cx = (minX + maxX) / 2;
                const cz = (minZ + maxZ) / 2;
                const cy = minY;
                const s = 1.8 / (maxY - minY);

                // Write clean OBJ
                const chunks = ['# Mixamo Single Bunny Pirate\n'];
                for (let i = 0; i < newPos.length; i += 3) {
                    const x = ((newPos[i] - cx) * s).toFixed(4);
                    const y = ((newPos[i + 1] - cy) * s).toFixed(4);
                    const z = ((newPos[i + 2] - cz) * s).toFixed(4);
                    chunks.push(`v ${x} ${y} ${z}\n`);
                }
                for (let i = 0; i < newIndices.length; i += 3) {
                    chunks.push(`f ${newIndices[i] + 1} ${newIndices[i + 1] + 1} ${newIndices[i + 2] + 1}\n`);
                }

                fs.writeFileSync('client/assets/models/bunny_mixamo.obj', chunks.join(''));
                const stat = fs.statSync('client/assets/models/bunny_mixamo.obj');
                console.log('Done! bunny_mixamo.obj size:', (stat.size / 1024 / 1024).toFixed(2), 'MB');

                // Clean up huge test file if exists
                if (fs.existsSync('client/assets/models/single_bunny_for_mixamo.obj')) {
                    fs.unlinkSync('client/assets/models/single_bunny_for_mixamo.obj');
                }
            }
        });
    });
}

run();
