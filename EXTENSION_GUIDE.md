# 🔧 دليل التوسع والامتداد (Extension Guide)

## كيفية إضافة Feature جديد

### مثال: إضافة مميزة الـ "Comments" (التعليقات)

---

## الخطوة 1️⃣: إنشاء بنية المجلد

```bash
mkdir -p src/features/comments/{routes,services,components,hooks}
```

**النتيجة:**
```
src/features/comments/
├── routes/
├── services/
├── components/
└── hooks/
```

---

## الخطوة 2️⃣: إنشاء API Service

**الملف:** `src/features/comments/services/api.js`

```javascript
import axiosInstance from '@/services/axiosInstance';

export const commentsApi = {
  // جلب التعليقات
  getAll: (filters = {}) =>
    axiosInstance.get('/comments', { params: filters }),

  // جلب تعليق واحد
  getById: (id) =>
    axiosInstance.get(`/comments/${id}`),

  // إنشاء تعليق جديد
  create: (data) =>
    axiosInstance.post('/comments', data),

  // تعديل تعليق
  update: (id, data) =>
    axiosInstance.put(`/comments/${id}`, data),

  // حذف تعليق
  delete: (id) =>
    axiosInstance.delete(`/comments/${id}`),
};
```

---

## الخطوة 3️⃣: إنشاء Hooks المخصصة

**الملف:** `src/features/comments/hooks/useComments.js`

```javascript
import { useQuery, useMutation } from '@tanstack/react-query';
import { commentsApi } from '../services/api';
import queryClient from '@/services/queryClient';

// جلب قائمة التعليقات
export function useComments(filters = {}) {
  return useQuery({
    queryKey: ['comments', filters],
    queryFn: () => commentsApi.getAll(filters),
    staleTime: 5 * 60 * 1000,
  });
}

// جلب تعليق واحد
export function useComment(id) {
  return useQuery({
    queryKey: ['comments', id],
    queryFn: () => commentsApi.getById(id),
    staleTime: 10 * 60 * 1000,
  });
}

// إنشاء تعليق جديد
export function useCreateComment() {
  return useMutation({
    mutationFn: commentsApi.create,
    onSuccess: () => {
      // أعد جلب التعليقات بعد الإنشاء
      queryClient.invalidateQueries({ queryKey: ['comments'] });
    },
  });
}

// تعديل تعليق
export function useUpdateComment() {
  return useMutation({
    mutationFn: ({ id, data }) => commentsApi.update(id, data),
    onSuccess: (_, { id }) => {
      // أعد جلب التعليق والقائمة
      queryClient.invalidateQueries({ queryKey: ['comments'] });
      queryClient.invalidateQueries({ queryKey: ['comments', id] });
    },
  });
}

// حذف تعليق
export function useDeleteComment() {
  return useMutation({
    mutationFn: commentsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments'] });
    },
  });
}
```

---

## الخطوة 4️⃣: إنشاء Components

**الملف:** `src/features/comments/components/CommentList.jsx`

```javascript
import { useComments } from '../hooks/useComments';

export default function CommentList({ productId }) {
  const { data: comments, isLoading, error } = useComments({
    productId,
  });

  if (isLoading) return <div>جاري التحميل...</div>;
  if (error) return <div>خطأ: {error.message}</div>;

  return (
    <div className="space-y-4">
      {comments?.map(comment => (
        <div key={comment.id} className="p-4 border rounded">
          <p className="font-bold">{comment.author}</p>
          <p className="text-gray-600">{comment.text}</p>
          <p className="text-sm text-gray-400">
            {new Date(comment.createdAt).toLocaleDateString('ar-SA')}
          </p>
        </div>
      ))}
    </div>
  );
}
```

**الملف:** `src/features/comments/components/CommentForm.jsx`

```javascript
import { useState } from 'react';
import { useCreateComment } from '../hooks/useComments';

export default function CommentForm({ productId }) {
  const [text, setText] = useState('');
  const { mutate: createComment, isPending } = useCreateComment();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;

    createComment({ productId, text }, {
      onSuccess: () => setText(''),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="اكتب تعليقك..."
        className="w-full p-2 border rounded"
        rows="3"
      />
      <button
        type="submit"
        disabled={isPending || !text.trim()}
        className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
      >
        {isPending ? 'جاري الإرسال...' : 'إرسال'}
      </button>
    </form>
  );
}
```

---

## الخطوة 5️⃣: إنشاء Routes

**الملف:** `src/features/comments/routes/index.js`

```javascript
import { lazy } from 'react';

// import components
const CommentList = lazy(() => 
  import('../components/CommentList')
);
const CommentDetail = lazy(() => 
  import('../components/CommentDetail')
);

// export routes configuration
export const commentRoutes = [
  {
    path: 'comments',
    element: <CommentList />,
  },
  {
    path: 'comments/:id',
    element: <CommentDetail />,
  },
];
```

---

## الخطوة 6️⃣: إضافة Routes إلى App.jsx

**في:** `src/App.jsx`

```javascript
// Import الـ Components
const CommentList = lazy(() => 
  import('@/features/comments/components/CommentList')
);

// Add Route
<Route path="/" element={<MainLayout />}>
  <Route index element={<SuspenseRoute><HomePage /></SuspenseRoute>} />
  {/* ... routes أخرى */}
  <Route path="comments" element={
    <SuspenseRoute><CommentList /></SuspenseRoute>
  } />
</Route>
```

---

## أنماط التطوير الموصى بها

### ✅ Do's (افعل)

```javascript
// ✓ استخدم axiosInstance
import axiosInstance from '@/services/axiosInstance';
const data = await axiosInstance.get('/endpoint');

// ✓ استخدم React Query hooks
const { data, isLoading } = useQuery({
  queryKey: ['comments'],
  queryFn: commentsApi.getAll,
});

// ✓ استخدم Suspense للـ Code Splitting
const Component = lazy(() => import('./Component'));

// ✓ استخدم ProtectedRoute
<Route element={<ProtectedRoute Layout={MainLayout} />}>
  <Route path="comments" element={<CommentList />} />
</Route>

// ✓ معالجة الأخطاء
if (error) return <div>خطأ: {error.message}</div>;
```

### ❌ Don'ts (لا تفعل)

```javascript
// ✗ لا تستخدم fetch مباشرة
const data = await fetch('/api/endpoint');

// ✗ لا تستخدم Redux
dispatch(fetchComments());

// ✗ لا تستخدم Context API للبيانات من السيرفر
<AuthContext.Provider value={data}>

// ✗ لا تنسى استخدام ErrorBoundary
// ✗ لا تستخدم require() في الـ Components
// ✗ لا تضع جميع الكود في Component واحد
```

---

## مثال عملي شامل

### المطلب: إنشاء صفحة لعرض وإضافة تعليقات المنتج

### 1. المبنى المطلوب:
```
src/features/comments/
├── routes/
├── services/
│   └── api.js           # API calls
├── components/
│   ├── CommentList.jsx  # قائمة التعليقات
│   └── CommentForm.jsx  # نموذج إضافة تعليق
├── hooks/
│   └── useComments.js   # Hooks مخصصة
└── types/
    └── index.d.ts       # TypeScript types (اختياري)
```

### 2. الملف الكامل - CommentList.jsx:
```javascript
import { useComments, useDeleteComment } from '../hooks/useComments';
import CommentForm from './CommentForm';

export default function CommentList({ productId }) {
  const { data: comments, isLoading, error } = useComments({ productId });
  const { mutate: deleteComment } = useDeleteComment();

  if (isLoading) return <div className="p-4">جاري التحميل...</div>;
  if (error) return <div className="p-4 text-red-600">خطأ: {error.message}</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">التعليقات ({comments?.length || 0})</h2>
      
      {/* نموذج إضافة تعليق */}
      <CommentForm productId={productId} />

      {/* قائمة التعليقات */}
      <div className="space-y-4">
        {comments?.map(comment => (
          <div key={comment.id} className="p-4 border rounded-lg">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-bold">{comment.author}</p>
                <p className="text-gray-600">{comment.text}</p>
                <p className="text-sm text-gray-400">
                  {new Date(comment.createdAt).toLocaleDateString('ar-SA')}
                </p>
              </div>
              {/* زر الحذف (للمسؤولين فقط) */}
              <button
                onClick={() => deleteComment(comment.id)}
                className="px-3 py-1 text-red-600 hover:bg-red-100 rounded"
              >
                حذف
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 3. الاستخدام في Product Page:
```javascript
import CommentList from '@/features/comments/components/CommentList';

export default function ProductDetail() {
  const { id } = useParams();

  return (
    <div className="space-y-8">
      {/* تفاصيل المنتج */}
      
      {/* التعليقات */}
      <CommentList productId={id} />
    </div>
  );
}
```

---

## الخطوات التالية

### للمبتدئين:
1. اتبع المثال أعلاه خطوة بخطوة
2. اختبر الـ API في Postman أولاً
3. اطبع في Console لتفهم البيانات

### للمطورين:
1. أضف Validation للبيانات
2. أضف TypeScript types
3. اكتب اختبارات Unit
4. أضف caching متقدم

### للمعماريين:
1. راقب الـ API calls
2. حسّن الـ queries
3. أضف pagination
4. افكر في الـ infinite scrolling

---

## نصائح مهمة

1. **ابدأ ببسيط**: لا تعقّد من البداية
2. **اختبر أثناء التطوير**: استخدم DevTools
3. **اتبع النمط**: ابقَ consistent
4. **وثّق الكود**: أضف comments
5. **أعد الاستخدام**: لا تكرر نفس الكود

---

## أسئلة شائعة

**س: كيف أضيف Pagination؟**
ج: أضف `page` و `limit` إلى filters في الـ Hook

**س: كيف أستخدم infinite scroll؟**
ج: استخدم `useInfiniteQuery` بدلاً من `useQuery`

**س: كيف أتعامل مع الأخطاء؟**
ج: أضف `onError` callback في useMutation

**س: كيف أتحقق من صلحيات المستخدم؟**
ج: استخدم `authMiddleware` أو `getCurrentUser()`

---

✅ الآن أنت جاهز لإضافة أي feature جديد!
