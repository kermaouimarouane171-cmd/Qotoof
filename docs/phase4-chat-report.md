# Phase 4A-3: Chat Module Audit Report

**Module:** Chat (نظام الدردشة)  
**Date:** 2026-07-11  
**Status:** ⚠️ Passed with Security Concerns  
**Approach:** شامل - التحليل المعماري، الاختبارات التلقائية، التحقق من قاعدة البيانات، تحليل الأمان، قائمة الاختبار اليدوي

---

## ملخص التنفيذ

وحدة chat هي طبقة re-export تم إنشاؤها في Phase 4.3. الوحدة تغطي:
- محادثات بين مستخدمين (إنشاء، عرض، حذف)
- رسائل (إرسال، قراءة، pagination)
- حالة قراءة الرسائل (mark as read)
- اشتراكات Realtime عبر Supabase Realtime
- مرفقات الملفات (رفع، validation، preview)
- رسائل سياق التوصيل/الطلبات (messagesApi أبسط)
- React Query hooks (queries + mutations)

**حالة الوحدة:** طبقة re-export فقط - لم يتم نقل الملفات المصدرية بعد.

---

## الملفات المقروءة

| # | الملف | الغرض | Lines |
|---|------|------|-------|
| 1 | `src/modules/chat/README.md` | توثيق الوحدة | 233 |
| 2 | `src/modules/chat/index.js` | نقطة الدخول العامة | 57 |
| 3 | `src/modules/chat/api/messagesApi.js` | رسائل التوصيل/الطلبات | 133 |
| 4 | `src/services/chatService.jsx` | الخدمة الأساسية (class-based) | 493 |
| 5 | `src/hooks/queries/useChatQueries.js` | React Query hooks (queries) | 38 |
| 6 | `src/hooks/mutations/useChatMutations.js` | React Query hooks (mutations) | 65 |
| 7 | `src/components/Chat/ChatWindow.jsx` | نافذة الدردشة الرئيسية | 329 |
| 8 | `src/components/Chat/ChatMessage.jsx` | فقاعة الرسالة | 123 |
| 9 | `src/components/Chat/ChatList.jsx` | قائمة المحادثات | 80+ |
| 10 | `src/components/Chat/FilePreview.jsx` | عرض المرفقات | 130 |
| 11 | `src/components/ui/ChatComponent.jsx` | مكون دردشة سياق التوصيل/الطلب | 80+ |
| 12 | `src/pages/Chat.jsx` | صفحة الدردشة الرئيسية | 80+ |
| 13 | `src/pages/Messages.jsx` | صفحة الرسائل (Inbox) | 80+ |
| 14 | `src/types/database.ts` | Type definitions (conversations, messages) | 50+ |
| 15 | `database/migrations/030-unified-schema.sql` | Schema الجداول | 30+ |
| 16 | `database/migrations/001-add-favorites-table.sql` | messages table + RLS | 40+ |
| 17 | `database/migrations/031-unified-rls-policies.sql` | RLS policies | 20+ |
| 18 | `database/migrations/002-create-missing-tables.sql` | RLS policies مفصلة | 50+ |

**إجمالي الملفات المقروءة:** 18 ملف، ~2,000+ سطر

---

## التحليل المعماري

### البنية المعمارية

```
src/modules/chat/
├── index.js          # Public API entry point
├── api/
│   ├── index.js      # chatService, messagesApi
│   └── messagesApi.js # رسائل التوصيل/الطلبات
├── data/
│   └── index.js      # Placeholder
├── domain/
│   └── index.js      # Placeholder
├── ui/
│   └── index.js      # Placeholder (Chat components not re-exported)
├── hooks/
│   └── index.js      # useChatList, useChatMessages, useSendMessage, etc.
├── stores/
│   └── index.js      # Placeholder
├── utils/
│   └── index.js      # Placeholder
└── README.md
```

### مصادر الحقيقة (Source of Truth)

| المكون | المصدر |
|--------|--------|
| **بيانات المحادثات** | Supabase `conversations` table |
| **بيانات المشاركين** | Supabase `conversation_participants` table |
| **بيانات الرسائل** | Supabase `messages` table |
| **منطق المحادثات** | `src/services/chatService.jsx` (class-based) |
| **رسائل التوصيل/الطلب** | `src/modules/chat/api/messagesApi.js` |
| **UI الرئيسي** | `src/components/Chat/ChatWindow.jsx` |
| **UI سياق التوصيل** | `src/components/ui/ChatComponent.jsx` |

### تدفق البيانات (Data Flow)

```
┌─────────────┐     ┌─────────────┐
│   User A    │     │   User B    │
│ (Chat.jsx)  │     │ (Chat.jsx)  │
└──────┬──────┘     └──────┬──────┘
       │                   │
       ▼                   ▼
┌─────────────────────────────────────┐
│  chatService.sendMessage()          │
│  ─────────────────────────────────  │
│  1. Insert to messages table       │
│  2. Update conversation last_msg   │
│  3. Realtime → User B receives    │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────┐
│  Supabase   │
│  messages   │
│  conversations │
│  conversation_participants │
└─────────────┘

Realtime flow:
┌─────────────┐
│  Supabase   │
│  Realtime   │
└──────┬──────┘
       │ INSERT event
       ▼
┌─────────────────────────────────────┐
│  subscribeToConversation()          │
│  ─────────────────────────────────  │
│  Channel: conversation:<id>        │
│  Filter: conversation_id=eq.<id>   │
│  → callback(newMessage)            │
└─────────────────────────────────────┘
```

### الاعتماديات

**الداخلية:**
- `@/services/supabase` - Supabase client
- `@/utils/withRetry` - Retry logic
- `@/utils/logger` - Logging
- `@/store/authStore` - Current user

**الخارجية:**
- `@tanstack/react-query` - Data fetching
- `react-hot-toast` - Notifications
- `date-fns` - Date formatting
- `react-i18next` - i18n

**المستخدمين:**
- `src/pages/Chat.jsx` - صفحة الدردشة
- `src/pages/Messages.jsx` - صفحة الرسائل
- `src/components/Chat/ChatWindow.jsx` - نافذة الدردشة
- `src/components/ui/ChatComponent.jsx` - دردشة سياق التوصيل/الطلب

---

## نتائج الاختبارات التلقائية

### Jest Tests

**Test Suites:** 0 (لا توجد اختبارات chat على الإطلاق) ❌
**Tests:** 0

```
> qotoof@1.0.0 test
> jest --testPathPattern=chat|message --no-coverage

No tests found, exiting with code 1
```

**هذه نتيجة حرفية من تشغيل فعلي.** لا توجد أي اختبارات Jest لوحدة chat.

### Build & Lint

**Build:** PASS (مع warnings موجودة مسبقاً - circular chunks, dynamic imports)
**Lint:** 0 errors, 44 warnings (لا warnings جديدة من chat)

---

## حالة قاعدة البيانات

### الجداول

**الجدول 1: `conversations`**

| العمود | النوع | الوصف |
|--------|------|-------|
| id | UUID | Primary Key |
| type | TEXT | نوع المحادثة (default: 'direct') |
| title | TEXT | عنوان المحادثة (nullable) |
| created_by | UUID | FK to profiles |
| last_message | TEXT | آخر رسالة (nullable) |
| last_message_at | TIMESTAMPTZ | وقت آخر رسالة |
| is_active | BOOLEAN | نشطة (default: true) |
| created_at | TIMESTAMPTZ | تاريخ الإنشاء |
| updated_at | TIMESTAMPTZ | تاريخ التحديث |

**الجدول 2: `conversation_participants`**

| العمود | النوع | الوصف |
|--------|------|-------|
| id | UUID | Primary Key |
| conversation_id | UUID | FK to conversations (CASCADE) |
| user_id | UUID | FK to profiles (CASCADE) |
| joined_at | TIMESTAMPTZ | وقت الانضمام |
| last_read_at | TIMESTAMPTZ | آخر قراءة |
| is_admin | BOOLEAN | أدمن المحادثة (default: false) |

**Constraint:** `UNIQUE(conversation_id, user_id)`

**الجدول 3: `messages`**

| العمود | النوع | الوصف |
|--------|------|-------|
| id | UUID | Primary Key |
| conversation_id | UUID | FK to conversations |
| sender_id | UUID | FK to profiles |
| content | TEXT | محتوى الرسالة (nullable) |
| message_type | TEXT | نوع الرسالة (default: 'text') |
| attachment_url | TEXT | رابط المرفق (nullable) |
| is_read | BOOLEAN | مقروءة (default: false) |
| read_at | TIMESTAMPTZ | وقت القراءة |
| created_at | TIMESTAMPTZ | تاريخ الإنشاء |
| updated_at | TIMESTAMPTZ | تاريخ التحديث |
| delivery_id | UUID | FK to deliveries (nullable) |
| order_id | UUID | FK to orders (nullable) |
| receiver_id | UUID | FK to profiles |
| message | TEXT | محتوى الرسالة (للرسائل السياقية) |
| deleted_at | TIMESTAMPTZ | Soft delete (nullable) |

**ملاحظة:** جدول `messages` مزدوج الاستخدام:
1. رسائل المحادثات (conversation_id, sender_id, content)
2. رسائل التوصيل/الطلبات (delivery_id, order_id, sender_id, receiver_id, message)

### RLS Policies (نص حرفي من migrations)

**من `031-unified-rls-policies.sql`:**

```sql
-- Messages
CREATE POLICY "messages_user_select" ON messages FOR SELECT TO authenticated
  USING (
    sender_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id AND cp.user_id = auth.uid()
    )
  );
CREATE POLICY "messages_user_insert" ON messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid());

-- Conversations
CREATE POLICY "conversations_user_select" ON conversations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM conversation_participants cp WHERE cp.conversation_id = conversations.id AND cp.user_id = auth.uid()));
CREATE POLICY "conversations_user_insert" ON conversations FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Conversation participants
CREATE POLICY "conversation_participants_user_select" ON conversation_participants FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM conversation_participants cp2 WHERE cp2.conversation_id = conversation_participants.conversation_id AND cp2.user_id = auth.uid())
  );
```

**من `001-add-favorites-table.sql` (رسائل التوصيل/الطلبات):**

```sql
CREATE POLICY "Users can view messages they sent or received"
  ON messages FOR SELECT USING (sender_id = auth.uid() OR receiver_id = auth.uid());

CREATE POLICY "Users can send messages"
  ON messages FOR INSERT WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Users can update messages they received"
  ON messages FOR UPDATE USING (receiver_id = auth.uid());
```

**من `002-create-missing-tables.sql` (storage):**

```sql
CREATE POLICY "Users can upload chat attachments"
  ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'chat-attachments' AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can view chat attachments in their conversations"
  ON storage.objects FOR SELECT USING (
    bucket_id = 'chat-attachments' AND auth.role() = 'authenticated'
  );
```

### Indexes

| Index | الأعمدة | الوصف |
|-------|---------|-------|
| `idx_messages_delivery` | delivery_id | للبحث بالتوصيل |
| `idx_messages_order` | order_id | للبحث بالطلب |
| `idx_messages_sender` | sender_id | للبحث بالمرسل |
| `idx_messages_receiver` | receiver_id | للبحث بالمستقبل |
| `idx_messages_created` | created_at | للترتيب الزمني |
| `idx_messages_unread` | receiver_id, is_read | للرسائل غير المقروءة |

---

## تحليل الأمان

### 1. Authorization (RBAC)

✅ **جيد:**
- RLS policies تمنع المستخدمين من قراءة محادثات لا يشاركون فيها
- `messages_user_insert` يتحقق من `sender_id = auth.uid()`
- `conversations_user_insert` يتحقق من `created_by = auth.uid()`
- `deleteConversation` يتحقق من أن المستخدم مشارك قبل الحذف

⚠️ **تحسينات مطلوبة:**
- **P1:** `messages_user_insert` لا يتحقق من أن المرسل مشارك في المحادثة - يمكن لأي مستخدم مصادق إرسال رسالة لأي محادثة طالما `sender_id = auth.uid()`
- **P2:** لا يوجد policy DELETE على `messages` - لا يمكن حذف الرسائل عبر RLS
- **P2:** لا يوجد policy UPDATE على `conversations` - لا يمكن تحديث المحادثة
- **P2:** `messagesApi.markAsRead` يستخدم `receiver_id = auth.uid()` لكن الـ RLS policy للـ UPDATE تستخدم `receiver_id = auth.uid()` فقط للرسائل السياقية، وليس لرسائل المحادثات
- **P3:** `conversation_participants` INSERT policy تسمح لأي مستخدم بإضافة نفسه لأي محادثة

### 2. Input Validation

⚠️ **تحسينات مطلوبة:**
- **P1:** `chatService.sendMessage` لا يقوم بـ sanitization على `content` - XSS risk
- **P2:** لا يوجد length limit على `content` - يمكن إرسال رسائل طويلة جداً
- **P2:** `messagesApi.send` لا يقوم بأي validation على `message` - XSS risk
- **P3:** لا يوجد validation على `conversation_id` أو `sender_id` قبل الحفظ

### 3. Rate Limiting

❌ **مفقود:**
- **P1:** لا يوجد rate limiting على إرسال الرسائل - يمكن للمستخدم إرسال رسائل غير محدودة
- **P1:** لا يوجد rate limiting على إنشاء المحادثات
- **P1:** لا يوجد rate limiting على رفع المرفقات

### 4. File Upload Security

✅ **جيد:**
- `validateFile` يتحقق من حجم الملف (5MB max)
- يتحقق من MIME type (قائمة بيضاء)
- يتحقق من extension (قائمة سوداء)
- ChatWindow.jsx يتحقق من حجم الملف (10MB) ونوعه

⚠️ **تحسينات مطلوبة:**
- **P2:** `MAX_FILE_SIZE` في chatService (5MB) يختلف عن ChatWindow (10MB) - عدم اتساق
- **P2:** `ALLOWED_MIME_TYPES` في chatService يختلف عن `ALLOWED_TYPES` في ChatWindow - عدم اتساق
- **P3:** لا يوجد antivirus scan على المرفقات
- **P3:** `BLOCKED_EXTENSIONS` لا يشمل جميع الامتدادات الخطرة

### 5. SQL Injection

✅ **محمي:**
- جميع الاستعلامات عبر Supabase client (parameterized queries)
- لا يوجد string concatenation في SQL

⚠️ **تحسينات مطلوبة:**
- **P2:** `chatService.getOrCreateConversation` يستخدم `.or()` مع string interpolation (`participant_1_id.eq.${userId1}`) - يجب التأكد من أن userIds تأتي من مصدر موثوق

### 6. XSS Protection

⚠️ **تحسينات مطلوبة:**
- **P1:** `content` لا يتم sanitization قبل الحفظ في `chatService.sendMessage`
- **P1:** `message` لا يتم sanitization قبل الحفظ في `messagesApi.send`
- **P2:** عرض `content` في ChatMessage.jsx يستخدم `{content}` (React escape تلقائي ✅) لكن لا يوجد `dangerouslySetInnerHTML` (جيد)
- **P2:** عرض `message.content` في ChatComponent.jsx يستخدم `{message.content}` (React escape تلقائي ✅)

### 7. Realtime Security

⚠️ **تحسينات مطلوبة:**
- **P2:** اشتراكات Realtime لا تتحقق من أن المستخدم مشارك في المحادثة قبل الاشتراك
- **P3:** لا يوجد cleanup للأشتراكات في حالة خطأ

### 8. Storage Security

⚠️ **تحسينات مطلوبة:**
- **P2:** `storage.objects` SELECT policy تسمح لأي مستخدم مصادق بقراءة جميع مرفقات chat-attachments - لا تتحقق من المشاركة في المحادثة
- **P2:** `storage.objects` INSERT policy تسمح لأي مستخدم مصادق برفع الملفات - لا تتحقق من المشاركة في المحادثة

---

## تحليل الجودة

### 1. Error Handling

✅ **جيد:**
- try-catch في معظم الدوال
- toast notifications للأخطاء
- logger.error لتسجيل الأخطاء

⚠️ **تحسينات مطلوبة:**
- **P3:** `chatService.sendMessage` الـ "fire and forget" لتحديث `last_message` لا يلتقط الأخطاء بشكل كافٍ
- **P3:** `ChatComponent.jsx` لا يعرض toast errors للمستخدم

### 2. Loading States

✅ **جيد:**
- loading state في ChatWindow.jsx
- loading state في Chat.jsx
- loading state في Messages.jsx
- skeleton loading في ChatList.jsx

### 3. Empty States

✅ **جيد:**
- empty state في ChatWindow.jsx ("اختر محادثة للبدء")
- empty state في ChatList.jsx ("لا توجد محادثات")
- empty state في ChatComponent.jsx ("لا توجد رسائل بعد")

### 4. Accessibility

⚠️ **تحسينات مطلوبة:**
- **P3:** لا يوجد ARIA labels على أزرار الإرسال
- **P3:** لا يوجد live region للرسائل الجديدة
- **P3:** لا يوجد keyboard navigation كامل
- **P3:** `onKeyPress` مستخدم بدلاً من `onKeyDown` (deprecated)

### 5. Responsive Design

✅ **جيد:**
- Tailwind classes للتجاوب
- mobile/desktop layout switching في Chat.jsx
- `hidden md:flex` patterns

### 6. i18n Support

✅ **جيد:**
- useTranslation hook في معظم المكونات
- Arabic RTL support
- date-fns locale support (ar, fr, en)

⚠️ **تحسينات مطلوبة:**
- **P3:** بعض النصوص hardcoded في ChatComponent.jsx (مثل "فشل في تحميل الرسائل", "فشل في إرسال الرسالة", "اختر محادثة للبدء")

### 7. Code Quality

⚠️ **تحسينات مطلوبة:**
- **P2:** `chatService.jsx` يحتوي على class + component في نفس الملف (mixing concerns)
- **P2:** `getOrCreateConversation` يستخدم `.or()` بطريقة قد لا تعمل بشكل صحيح ( chained `.or()` overwrites)
- **P3:** `ChatWindow.jsx` و `ChatComponent.jsx` لديهما منطق مكرر (loading, sending, subscription)
- **P3:** `messagesApi` موجود في `favorites.js` (موقع خاطئ - تم نسخه إلى `modules/chat/api/` لكن الأصل لا يزال في favorites.js)

---

## المشاكل المكتشفة

### P0 - Critical
لا يوجد

### P1 - High
1. **XSS Risk** - `content` لا يتم sanitization في `chatService.sendMessage`
2. **XSS Risk** - `message` لا يتم sanitization في `messagesApi.send`
3. **Rate Limiting مفقود** - لا يوجد حد على إرسال الرسائل
4. **Rate Limiting مفقود** - لا يوجد حد على إنشاء المحادثات
5. **Rate Limiting مفقود** - لا يوجد حد على رفع المرفقات
6. **RLS Policy** - `messages_user_insert` لا يتحقق من المشاركة في المحادثة
7. **No Tests** - لا توجد أي اختبارات لوحدة chat

### P2 - Medium
1. **RLS Policy** - لا يوجد policy DELETE على `messages`
2. **RLS Policy** - لا يوجد policy UPDATE على `conversations`
3. **RLS Policy** - `messagesApi.markAsRead` RLS غير متسق
4. **Input Validation** - لا يوجد length limit على `content`
5. **Input Validation** - لا يوجد validation على `conversation_id`
6. **File Upload** - `MAX_FILE_SIZE` غير متسق (5MB vs 10MB)
7. **File Upload** - `ALLOWED_MIME_TYPES` غير متسق
8. **Storage Security** - SELECT/INSERT policies لا تتحقق من المشاركة
9. **SQL Injection** - `.or()` مع string interpolation
10. **Code Quality** - class + component في نفس الملف
11. **Code Quality** - `getOrCreateConversation` منطق `.or()` خاطئ
12. **Realtime** - لا يتحقق من المشاركة قبل الاشتراك

### P3 - Low
1. **RLS Policy** - `conversation_participants` INSERT تسمح بإضافة أي مستخدم
2. **File Upload** - لا يوجد antivirus scan
3. **File Upload** - `BLOCKED_EXTENSIONS` غير شامل
4. **Error Handling** - fire and forget لتحديث last_message
5. **Error Handling** - ChatComponent.jsx لا يعرض toast errors
6. **Accessibility** - لا يوجد ARIA labels
7. **Accessibility** - لا يوجد live region
8. **Accessibility** - `onKeyPress` deprecated
9. **i18n** - نصوص hardcoded في ChatComponent.jsx
10. **Code Quality** - منطق مكرر بين ChatWindow و ChatComponent
11. **Code Quality** - `messagesApi` في favorites.js (موقع خاطئ)
12. **Realtime** - لا يوجد cleanup في حالة خطأ

### P4 - Info
1. **Schema** - جدول `messages` مزدوج الاستخدام (محادثات + رسائل سياقية) - قد يحتاج فصل
2. **Re-export** - الوحدة طبقة re-export فقط

---

## التوصيات

### قصيرة المدى (فورية)
1. إضافة sanitization على `content` و `message` (sanitizeText)
2. إضافة rate limiting على إرسال الرسائل (مثلاً 30 رسالة/10 دقائق)
3. إضافة rate limiting على إنشاء المحادثات (مثلاً 10/ساعة)
4. إضافة rate limiting على رفع المرفقات (مثلاً 20/ساعة)
5. إصلاح RLS policy `messages_user_insert` للتحقق من المشاركة
6. إضافة length limit على `content` (مثلاً 5000 حرف)
7. توحيد `MAX_FILE_SIZE` و `ALLOWED_MIME_TYPES` بين chatService و ChatWindow
8. كتابة اختبارات Jest للخدمات والمكونات

### متوسطة المدى
1. إضافة RLS policy DELETE على `messages`
2. إضافة RLS policy UPDATE على `conversations`
3. إصلاح storage policies للتحقق من المشاركة
4. إصلاح `getOrCreateConversation` منطق `.or()`
5. فصل class عن component في chatService.jsx
6. إضافة ARIA labels و live regions
7. إزالة النصوص hardcoded في ChatComponent.jsx

### طويلة المدى
1. فصل جدول `messages` إلى جدولين (محادثات + رسائل سياقية)
2. إضافة antivirus scan على المرفقات
3. إضافة end-to-end encryption للرسائل الحساسة
4. نقل `messagesApi` من `favorites.js` بالكامل
5. إضافة typing indicators و presence

---

## قائمة الاختبار اليدوي

### سيناريوهات إيجابية (Positive Cases)

#### 1. إنشاء محادثة جديدة
- **الخطوات:** تسجيل الدخول → فتح صفحة Chat → النقر على محادثة جديدة → اختيار مستخدم → إرسال رسالة
- **النتيجة المتوقعة:** المحادثة تُنشأ، الرسالة تُرسل، تظهر في الطرف الآخر

#### 2. إرسال رسالة نصية
- **الخطوات:** فتح محادثة موجود → كتابة رسالة → النقر على إرسال
- **النتيجة المتوقعة:** الرسالة تُرسل وتظهر فوراً

#### 3. استقبال رسالة في Realtime
- **الخطوات:** المستخدم A يرسل رسالة → المستخدم B يرى الرسالة فوراً
- **النتيجة المتوقعة:** الرسالة تظهر بدون refresh

#### 4. إرسال رسالة مع مرفق (صورة)
- **الخطوات:** فتح محادثة → اختيار صورة → إرسال
- **النتيجة المتوقعة:** الصورة تُرفع وتظهر في المحادثة

#### 5. إرسال رسالة مع مرفق (PDF)
- **الخطوات:** فتح محادثة → اختيار PDF → إرسال
- **النتيجة المتوقعة:** PDF يُرفع ويظهر preview

#### 6. عرض سجل الرسائل (pagination)
- **الخطوات:** فتح محادثة بـ 100+ رسالة → التمرير لأعلى
- **النتيجة المتوقعة:** رسائل أقدم تُحمّل (infinite scroll)

#### 7. تحديد الرسائل كمقروءة
- **الخطوات:** فتح محادثة برسائل غير مقروءة
- **النتيجة المتوقعة:** الرسائل تُحدد كمقروءة، unread count يُحدّث

#### 8. البحث في المحادثات
- **الخطوات:** فتح Chat → كتابة اسم في البحث
- **النتيجة المتوقعة:** المحادثات تُفلتر بالاسم

#### 9. حذف محادثة
- **الخطوات:** فتح محادثة → النقر على حذف
- **النتيجة المتوقعة:** المحادثة ورسائلها تُحذف

#### 10. إرسال رسالة في سياق طلب
- **الخطوات:** فتح صفحة OrderDetail → استخدام ChatComponent → إرسال رسالة
- **النتيجة المتوقعة:** الرسالة تُرسل في سياق الطلب

#### 11. إرسال رسالة في سياق توصيل
- **الخطوات:** فتح صفحة DeliveryDetail → استخدام ChatComponent → إرسال رسالة
- **النتيجة المتوقعة:** الرسالة تُرسل في سياق التوصيل

#### 12. عرض unread count
- **الخطوات:** استقبال رسائل جديدة → فتح Chat
- **النتيجة المتوقعة:** unread count يظهر بجانب كل محادثة

#### 13. رد على رسالة (reply)
- **الخطوات:** تمرير المؤشر فوق رسالة → النقر على reply → كتابة رد
- **النتيجة المتوقعة:** الرد يُرسل مع إشارة للرسالة الأصلية

#### 14. تحميل مرفق
- **الخطوات:** النقر على زر تحميل بجانب مرفق
- **النتيجة المتوقعة:** الملف يُحمّل

#### 15. عرض صورة مرفقة بـ full size
- **الخطوات:** النقر على صورة مرفقة
- **النتيجة المتوقعة:** الصورة تفتح في تبويب جديد

### سيناريوهات سلبية (Negative Cases)

#### 16. إرسال رسالة فارغة
- **الخطوات:** كتابة مسافات فقط → النقر على إرسال
- **النتيجة المتوقعة:** لا يُرسل شيء (trim check)

#### 17. رفع ملف كبير جداً (>10MB)
- **الخطوات:** اختيار ملف 15MB → إرسال
- **النتيجة المتوقعة:** خطأ "الملف أكبر من 10 ميجابايت"

#### 18. رفع ملف بنوع غير مدعوم
- **الخطوات:** اختيار ملف .exe → إرسال
- **النتيجة المتوقعة:** خطأ "نوع الملف غير مدعوم"

#### 19. رفع ملف فارغ (0 bytes)
- **الخطوات:** اختيار ملف فارغ → إرسال
- **النتيجة المتوقعة:** خطأ "File is empty"

#### 20. إرسال رسالة بدون تسجيل الدخول
- **الخطوات:** عدم تسجيل الدخول → محاولة فتح Chat
- **النتيجة المتوقعة:** إعادة توجيه لصفحة تسجيل الدخول

#### 21. محاولة قراءة محادثة لا يشارك فيها
- **الخطوات:** محاولة فتح محادثة مستخدم آخر
- **النتيجة المتوقعة:** RLS يمنع القراءة

#### 22. محاولة إرسال رسالة لمحادثة لا يشارك فيها
- **الخطوات:** محاولة إرسال رسالة لمحادثة مستخدم آخر
- **النتيجة المتوقعة:** RLS يمنع الإرسال (لكن ⚠️ policy الحالي لا يتحقق)

#### 23. حذف محادثة لا يشارك فيها
- **الخطوات:** محاولة حذف محادثة مستخدم آخر
- **النتيجة المتوقعة:** خطأ "Unauthorized"

#### 24. رفع أكثر من 5 مرفقات
- **الخطوات:** اختيار 6 ملفات
- **النتيجة المتوقعة:** فقط أول 5 ملفات تُقبل

### سيناريوهات حدّية (Edge Cases)

#### 25. إرسال رسالة طويلة جداً
- **الخطوات:** كتابة رسالة 10000 حرف → إرسال
- **النتيجة المتوقعة:** ⚠️ حالياً يُقبل (يجب إضافة limit)

#### 26. إرسال رسالة بـ HTML
- **الخطوات:** كتابة `<script>alert('xss')</script>` → إرسال
- **النتيجة المتوقعة:** ⚠️ حالياً يُحفظ (XSS risk) لكن React escape عند العرض

#### 27. إرسال 100 رسالة متتالية
- **الخطوات:** إرسال 100 رسالة في دقيقة
- **النتيجة المتوقعة:** ⚠️ حالياً يُسمح (يجب إضافة rate limiting)

#### 28. فتح محادثة بـ 1000 رسالة
- **الخطوات:** فتح محادثة بـ 1000 رسالة
- **النتيجة المتوقعة:** أول 30 رسالة تُحمّل، الباقي via infinite scroll

#### 29. فقدان الاتصال أثناء إرسال
- **الخطوات:** إرسال رسالة → فقدان الاتصال
- **النتيجة المتوقعة:** withRetry يعيد المحاولة 2 مرات

#### 30. استعادة الاتصال بعد فقدانه
- **الخطوات:** فقدان الاتصال → استعادته
- **النتيجة المتوقعة:** Realtime يعيد الاشتراك تلقائياً

### سيناريوهات RBAC

#### 31. المشتري يمكنه الدردشة مع البائع
- **النتيجة المتوقعة:** ✅ مسموح

#### 32. البائع يمكنه الدردشة مع المشتري
- **النتيجة المتوقعة:** ✅ مسموح

#### 33. السائق يمكنه الدردشة في سياق التوصيل
- **النتيجة المتوقعة:** ✅ مسموح

#### 34. الزائر لا يمكنه الدردشة
- **النتيجة المتوقعة:** ❌ ممنوع (requires authenticated)

#### 35. المستخدم لا يمكنه قراءة محادثات الآخرين
- **النتيجة المتوقعة:** ❌ ممنوع (RLS)

#### 36. المستخدم لا يمكنه حذف محادثات الآخرين
- **النتيجة المتوقعة:** ❌ ممنوع (participant check)

### سيناريوهات الأداء

#### 37. فتح Chat بـ 100 محادثة
- **النتيجة المتوقعة:** الصفحة تُحمل في < 2 ثانية

#### 38. فتح محادثة بـ 500 رسالة
- **النتيجة المتوقعة:** أول 30 رسالة تُحمل في < 1 ثانية

#### 39. إرسال رسالة مع مرفق 5MB
- **النتيجة المتوقعة:** الرفع يكتمل في < 10 ثواني

#### 40. Realtime مع 10 محادثات نشطة
- **النتيجة المتوقعة:** لا تأخير ملحوظ في استقبال الرسائل

### سيناريوهات التوافق

#### 41. عرض Chat على Mobile
- **النتيجة المتوقعة:** layout يتبدل لـ single panel

#### 42. عرض Chat على Tablet
- **النتيجة المتوقعة:** layout يعمل بشكل صحيح

#### 43. عرض Chat على Desktop
- **النتيجة المتوقعة:** layout ثنائي الأعمدة

#### 44. عرض Chat في RTL (Arabic)
- **النتيجة المتوقعة:** اتجاه RTL صحيح

#### 45. عرض Chat في LTR (English)
- **النتيجة المتوقعة:** اتجاه LTR صحيح

**إجمالي سيناريوهات الاختبار اليدوي:** 45 سيناريو

---

## الخلاصة

### ✅ نقاط القوة
- بنية معمارية واضحة مع فصل المسؤوليات
- RLS policies للمحادثات والرسائل
- Realtime عبر Supabase Realtime
- File upload validation (size, type, extension)
- withRetry للتعامل مع الأخطاء المؤقتة
- Loading states و empty states جيدة
- Responsive design مع mobile/desktop switching
- i18n support (ar, fr, en)

### ⚠️ نقاط الضعف
- **لا توجد اختبارات** - 0 اختبارات Jest لوحدة chat
- **XSS Risk** - content و message لا يتم sanitization
- **Rate Limiting مفقود** - لا يوجد حد على إرسال الرسائل
- **RLS Policy** - `messages_user_insert` لا يتحقق من المشاركة
- **عدم اتساق** - MAX_FILE_SIZE و ALLOWED_TYPES مختلفة بين chatService و ChatWindow
- **Code Quality** - class + component في نفس الملف
- **Storage Security** - policies لا تتحقق من المشاركة
- **Accessibility** - ناقصة

### الحالة العامة

**التقييم:** ⚠️ **Passed with Security Concerns**

الوحدة تعمل من الناحية الوظيفية، لكن هناك مخاطر أمان مهمة:
- **P1:** 7 مشاكل (XSS, Rate Limiting, RLS, No Tests)
- **P2:** 12 مشكلة (RLS, Validation, File Upload, Storage, Code Quality)
- **P3:** 12 مشكلة (Accessibility, i18n, Error Handling)
- **P4:** 2 مشاكل (Schema, Re-export)

**القرار يعود للمستخدم.** الوحدة تحتاج إصلاحات P1 قبل أي إطلاق للإنتاج.

---

**تم إنشاء هذا التقرير في 2026-07-11 بواسطة Devin AI**
