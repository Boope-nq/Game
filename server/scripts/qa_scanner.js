const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('=== BẮT ĐẦU QUÉT TĨNH TOÀN BỘ CODEBASE ===');
const baseDir = path.resolve(__dirname, '../..');
let errorCount = 0;

function scanDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name !== 'node_modules' && entry.name !== '.git') {
                scanDir(fullPath);
            }
        } else if (entry.name.endsWith('.js')) {
            const relPath = path.relative(baseDir, fullPath);
            try {
                let code = fs.readFileSync(fullPath, 'utf8');
                // Basic syntax validation
                // Replace import / export for vm.Script test
                const transformed = code
                    .replace(/import\s+.*?from\s+['"][^'"]+['"];?/g, '// import')
                    .replace(/import\s*\{[^}]*\}\s*from\s*['"][^'"]+['"];?/g, '// import')
                    .replace(/export\s+default\s+/g, '// export default ')
                    .replace(/export\s+(const|let|var|function|class)/g, '$1')
                    .replace(/export\s*\{[^}]*\};?/g, '// export');
                
                new vm.Script(transformed, { filename: relPath });
            } catch (err) {
                console.error(`❌ Cú pháp lỗi tại: ${relPath} -> ${err.message}`);
                errorCount++;
            }
        }
    }
}

scanDir(baseDir);
console.log(`=== KẾT QUẢ QUÉT TĨNH: ${errorCount} lỗi cú pháp ===`);
