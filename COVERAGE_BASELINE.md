# Coverage Baseline

Last generated: 2026-05-25
Source command: `npm run test:unit -- --runInBand`

## Global Coverage Snapshot

- Lines: 10.10%
- Statements: 9.64%
- Functions: 7.97%
- Branches: 7.47%

## Test Execution Snapshot

- Test suites: 76 passed, 0 failed
- Tests: 695 passed, 0 failed, 2 todo
- Snapshots: 9 passed
- Command exit: non-zero بسبب عدم تحقيق عتبات التغطية العالمية في Jest

## Threshold Policy Impact

Current global thresholds in Jest config:

- Statements: 80%
- Branches: 70%
- Functions: 75%
- Lines: 80%

Current measured coverage أقل من هذه العتبات بشكل كبير، لذا `test:unit` يفشل كـ quality gate رغم نجاح جميع الاختبارات المنفذة.

## Recommended Use

- استخدم هذا الملف كخط أساس واقعي للحالة الحالية.
- عند تحديث استراتيجية التغطية أو إضافة اختبارات واسعة، حدّث هذا الملف مباشرة بعد إعادة تشغيل:
  - `npm run test:unit -- --runInBand`
