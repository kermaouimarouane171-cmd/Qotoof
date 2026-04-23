#!/bin/bash

# 🚀 Marketplace Architecture - Setup Script
# هذا الملف يساعدك على البدء بسرعة

echo "=========================================="
echo "🚀 Green Market Marketplace - Setup"
echo "=========================================="
echo ""

# 1. التحقق من Node.js
echo "✓ التحقق من Node.js..."
if ! command -v node &> /dev/null; then
    echo "✗ Node.js غير مثبت. يرجى تثبيت Node.js من https://nodejs.org"
    exit 1
fi
echo "✓ Node.js ${node --version} مثبت"
echo ""

# 2. التحقق من npm
echo "✓ التحقق من npm..."
if ! command -v npm &> /dev/null; then
    echo "✗ npm غير مثبت"
    exit 1
fi
echo "✓ npm ${npm --version} مثبت"
echo ""

# 3. تثبيت المكتبات
echo "📦 تثبيت المكتبات الجديدة..."
npm install @tanstack/react-query@^5.48.0 axios@^1.7.5 react-error-boundary@^4.0.11

if [ $? -eq 0 ]; then
    echo "✓ تم تثبيت المكتبات بنجاح"
else
    echo "✗ فشل تثبيت المكتبات"
    exit 1
fi
echo ""

# 4. التحقق من ملف .env
echo "🔍 التحقق من .env..."
if [ ! -f ".env" ]; then
    echo "⚠ ملف .env غير موجود"
    echo "💡 إنشاء .env من نموذج؟"
    echo ""
    echo "VITE_API_URL=http://localhost:3000/api" > .env
    echo "✓ تم إنشاء .env"
else
    echo "✓ ملف .env موجود"
fi
echo ""

# 5. عرض المعلومات
echo "=========================================="
echo "✅ الإعداد الأساسي مكتمل!"
echo "=========================================="
echo ""
echo "📚 الملفات التوثيقية المتاحة:"
echo "  • QUICK_START.md          - دليل البدء السريع"
echo "  • ARCHITECTURE_GUIDE.md   - دليل المعمارية الشامل"
echo "  • FILE_DOCUMENTATION.md   - شرح الملفات الأساسية"
echo "  • IMPLEMENTATION_COMPLETE.md - ملخص الهندسة"
echo ""
echo "🚀 الخطوات التالية:"
echo "  1. اقرأ QUICK_START.md"
echo "  2. شغّل: npm run dev"
echo "  3. افتح: http://localhost:5173"
echo ""
echo "📞 للمساعدة، راجع ARCHITECTURE_GUIDE.md"
echo "=========================================="
