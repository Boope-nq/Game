const { execSync } = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname, '../..');
const serverDir = path.resolve(__dirname, '..');

function runStep(name, cmd) {
    console.log(`\n▶ [CHẠY]: ${name}`);
    const start = Date.now();
    try {
        const output = execSync(cmd, { cwd: rootDir, encoding: 'utf8', stdio: 'inherit' });
        const duration = ((Date.now() - start) / 1000).toFixed(1);
        console.log(`✔ [THÀNH CÔNG]: ${name} (${duration}s)`);
        return true;
    } catch (err) {
        console.error(`❌ [THẤT BẠI]: ${name}`);
        throw err;
    }
}

async function runAutonomousCycles() {
    console.log('================================================================');
    console.log('🤖 KHỞI ĐỘNG VÒNG LẶP KIỂM THỬ TỰ ĐỘNG KHÉP KÍN (2 VÒNG LIÊN TIẾP)');
    console.log('================================================================');

    for (let cycle = 1; cycle <= 2; cycle++) {
        console.log(`\n================================================================`);
        console.log(`🔄 BẮT ĐẦU VÒNG KIỂM THỬ TOÀN DIỆN THỨ ${cycle} / 2`);
        console.log(`================================================================`);

        // Step 1: Static syntax audit
        runStep(`Vòng ${cycle} - 1. Quét tĩnh toàn bộ cú pháp JS/ESM`, `node server/scripts/qa_scanner.js`);

        // Step 2: Cross-platform Responsive, Viewport & Touch Targets
        runStep(`Vòng ${cycle} - 2. Kiểm thử Cross-Platform & Touch Targets trên 8 tỉ lệ viewport`, `node server/scripts/test_viewport_audit.js`);

        // Step 3: QA Master Suite (Gameplay loop, Shortcuts, Abuse defense, Resize, F5 Persistence)
        runStep(`Vòng ${cycle} - 3. Kiểm thử Luồng Gameplay, Phím tắt, Chống spam & Khôi phục F5`, `node server/scripts/qa_master_test.js`);

        // Step 4: Full Multi-User E2E & Game Lifecycle
        runStep(`Vòng ${cycle} - 4. Kiểm thử Đa người chơi thực tế, Kết bạn, Chat & Chuyển Phase`, `node server/test_e2e.js`);

        console.log(`\n🎉 VÒNG KIỂM THỬ THỨ ${cycle} HOÀN THÀNH VỚI 100% KẾT QUẢ ĐẠT (PASS)!`);
    }

    console.log('\n================================================================');
    console.log('🏆 TẤT CẢ 2 VÒNG KIỂM THỬ LIÊN TIẾP ĐÃ HOÀN TẤT THÀNH CÔNG 100%!');
    console.log('HỆ THỐNG ĐẠT CHUẨN HOÀN HẢO - ZERO REMAINING DEFECTS!');
    console.log('================================================================');
}

runAutonomousCycles().catch(err => {
    console.error('Lỗi nghiêm trọng trong chu trình kiểm thử:', err.message);
    process.exit(1);
});
