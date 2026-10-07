/**
 * test_runner.js — Đơn vị chạy test nhẹ dùng Node.js assert
 * Không cần dependencies ngoài (Jest/Mocha), chạy siêu tốc!
 */

import assert from 'assert';

export class TestSuite {
  constructor(name) {
    this.name = name;
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
    this.errors = [];
  }

  test(description, fn) {
    this.tests.push({ description, fn });
  }

  async run() {
    console.log(`\n📦 BẮT ĐẦU TEST SUITE: ${this.name}`);
    console.log('='.repeat(50));

    for (const { description, fn } of this.tests) {
      try {
        await fn();
        this.passed++;
        console.log(`  ✅ ${description}`);
      } catch (err) {
        this.failed++;
        this.errors.push({ description, error: err });
        console.log(`  ❌ ${description}`);
        console.log(`     Lỗi: ${err.message}`);
      }
    }

    console.log('-'.repeat(50));
    console.log(`Tổng kết: ${this.passed} passed, ${this.failed} failed / ${this.tests.length} tests`);
    
    if (this.failed > 0) {
      console.log('\n🚨 Chi tiết lỗi:');
      this.errors.forEach(({ description, error }, idx) => {
        console.log(`\n${idx + 1}. ${description}`);
        console.log(error.stack || error);
      });
      process.exitCode = 1;
    } else {
      console.log('🎉 TẤT CẢ TEST ĐÃ VƯỢT QUA!');
    }
  }
}
