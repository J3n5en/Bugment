#!/bin/bash

# Bugment 测试运行脚本
# 运行所有测试并生成覆盖率报告

set -e

echo "🧪 Running Bugment Test Suite"
echo "================================"

# 检查依赖
echo "📦 Checking dependencies..."
if ! command -v npm &> /dev/null; then
    echo "❌ npm is required but not installed"
    exit 1
fi

if ! command -v jest &> /dev/null; then
    echo "📦 Installing Jest..."
    npm install --save-dev jest ts-jest @types/jest
fi

# 清理之前的覆盖率报告
echo "🧹 Cleaning previous coverage reports..."
rm -rf coverage/

# 运行单元测试
echo "🔬 Running unit tests..."
npm test -- --testPathPatterns="test/unit" --coverage

# 运行集成测试
echo "🔗 Running integration tests..."
npm test -- --testPathPatterns="test/integration" --coverage=false

# 运行所有测试
echo "🚀 Running full test suite..."
npm test -- --coverage

# 生成覆盖率报告
echo "📊 Generating coverage report..."
if [ -d "coverage" ]; then
    echo "✅ Coverage report generated in coverage/ directory"
    echo "📖 Open coverage/lcov-report/index.html to view detailed report"
else
    echo "⚠️ No coverage report generated"
fi

# 检查覆盖率阈值
echo "🎯 Checking coverage thresholds..."
npm test -- --coverage --passWithNoTests

echo "✅ All tests completed successfully!"
echo "================================"
