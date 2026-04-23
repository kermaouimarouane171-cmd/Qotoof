# 🎯 Best Practices & Common Patterns

## 1. API Service Pattern

**الملف**: `src/features/moduleName/services/api.js`

```javascript
import axiosInstance from '@/services/axiosInstance';

export const moduleApi = {
  // جلب البيانات مع filtration
  getAll: (filters = {}) =>
    axiosInstance.get('/endpoint', { params: filters }),

  // جلب عنصر واحد
  getById: (id) =>
    axiosInstance.get(`/endpoint/${id}`),

  // إنشاء
  create: (data) =>
    axiosInstance.post('/endpoint', data),

  // تعديل
  update: (id, data) =>
    axiosInstance.put(`/endpoint/${id}`, data),

  // حذف
  delete: (id) =>
    axiosInstance.delete(`/endpoint/${id}`),

  // عمليات مخصصة
  customAction: (id, params) =>
    axiosInstance.post(`/endpoint/${id}/action`, params),
};
```

---

## 2. React Query Hooks Pattern

**الملف**: `src/features/moduleName/hooks/useModule.js`

```javascript
import { useQuery, useMutation } from '@tanstack/react-query';
import queryClient from '@/services/queryClient';
import { moduleApi } from '../services/api';

// ✓ إنشاء Hook للقراءة
export function useItems(filters = {}) {
  return useQuery({
    queryKey: ['items', filters],
    queryFn: () => moduleApi.getAll(filters),
    staleTime: 5 * 60 * 1000, // 5 دقائق
  });
}

// ✓ إنشاء Hook لعنصر واحد
export function useItem(id) {
  return useQuery({
    queryKey: ['items', id],
    queryFn: () => moduleApi.getById(id),
    enabled: !!id, // لا تبدأ إلا إذا كان هناك id
  });
}

// ✓ إنشاء Hook للإضافة
export function useCreateItem() {
  return useMutation({
    mutationFn: moduleApi.create,
    onSuccess: (data) => {
      // أعد جلب البيانات
      queryClient.invalidateQueries({ queryKey: ['items'] });
      // أو استخدم setQueryData للتحديث الفوري
      queryClient.setQueryData(['items'], (old) => [...old, data]);
    },
    onError: (error) => {
      console.error('خطأ في الإضافة:', error.message);
    },
  });
}

// ✓ إنشاء Hook للتعديل
export function useUpdateItem() {
  return useMutation({
    mutationFn: ({ id, data }) => moduleApi.update(id, data),
    onSuccess: (data, variables) => {
      // أعد جلب القائمة
      queryClient.invalidateQueries({ queryKey: ['items'] });
      // أعد جلب العنصر المحدد
      queryClient.invalidateQueries({
        queryKey: ['items', variables.id],
      });
    },
  });
}

// ✓ إنشاء Hook للحذف
export function useDeleteItem() {
  return useMutation({
    mutationFn: moduleApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
    },
  });
}
```

---

## 3. Component with Loading & Error States

```javascript
import { useItems } from '../hooks/useModule';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorAlert from '@/components/ErrorAlert';

export default function ItemList() {
  const { data: items, isLoading, error, refetch } = useItems();

  // ✓ حالة التحميل
  if (isLoading) {
    return <LoadingSpinner message="جاري تحميل البيانات..." />;
  }

  // ✓ حالة الخطأ
  if (error) {
    return (
      <ErrorAlert 
        message="فشل تحميل البيانات"
        onRetry={refetch}
      />
    );
  }

  // ✓ حالة عدم وجود بيانات
  if (!items?.length) {
    return (
      <div className="p-8 text-center text-gray-500">
        لا توجد عناصر
      </div>
    );
  }

  // ✓ حالة النجاح
  return (
    <div className="space-y-4">
      {items.map(item => (
        <div key={item.id} className="p-4 border rounded">
          {/* محتوى */}
        </div>
      ))}
    </div>
  );
}
```

---

## 4. Form Submission Pattern

```javascript
import { useCreateItem } from '../hooks/useModule';
import { useState } from 'react';

export default function ItemForm() {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });

  const { mutate: createItem, isPending, error } = useCreateItem();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // ✓ اختياري: تحقق من صحة البيانات
    if (!formData.name.trim()) {
      alert('الحقل مطلوب');
      return;
    }

    // ✓ أرسل البيانات
    createItem(formData, {
      onSuccess: () => {
        // ✓ امسح النموذج بعد النجاح
        setFormData({ name: '', description: '' });
        // ✓ عرض رسالة نجاح
        alert('تم الإضافة بنجاح');
      },
      onError: (err) => {
        console.error('خطأ:', err);
      },
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* ✓ عرض الأخطاء */}
      {error && (
        <div className="p-3 bg-red-100 text-red-700 rounded">
          {error.message}
        </div>
      )}

      <input
        type="text"
        value={formData.name}
        onChange={(e) => 
          setFormData({ ...formData, name: e.target.value })
        }
        placeholder="الاسم"
        className="w-full p-2 border rounded"
        disabled={isPending}
      />

      <textarea
        value={formData.description}
        onChange={(e) => 
          setFormData({ ...formData, description: e.target.value })
        }
        placeholder="الوصف"
        className="w-full p-2 border rounded"
        disabled={isPending}
      />

      <button
        type="submit"
        disabled={isPending}
        className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
      >
        {isPending ? 'جاري الإرسال...' : 'إضافة'}
      </button>
    </form>
  );
}
```

---

## 5. Error Boundary Pattern

```javascript
import { withErrorBoundary } from 'react-error-boundary';
import ErrorFallback from '@/components/ErrorFallback';

function MyComponent() {
  // الكود هنا
  return <div>...</div>;
}

// ✓ الطريقة 1: Wrap بـ HOC
export default withErrorBoundary(MyComponent, {
  FallbackComponent: ErrorFallback,
});

// ✓ الطريقة 2: استخدام Component
export default function App() {
  return (
    <ErrorBoundary fallback={<ErrorFallback />}>
      <MyComponent />
    </ErrorBoundary>
  );
}
```

---

## 6. Pagination Pattern

```javascript
import { useState } from 'react';
import { useItems } from '../hooks/useModule';

export default function PaginatedList() {
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const { data, isLoading, error } = useItems({
    page,
    limit: pageSize,
  });

  const totalPages = Math.ceil((data?.total || 0) / pageSize);

  return (
    <div className="space-y-4">
      {/* قائمة العناصر */}
      {data?.items?.map(item => (
        <div key={item.id}>...</div>
      ))}

      {/* pagination controls */}
      <div className="flex justify-between items-center">
        <button
          onClick={() => setPage(p => Math.max(p - 1, 1))}
          disabled={page === 1}
          className="px-4 py-2 border rounded disabled:opacity-50"
        >
          السابق
        </button>

        <span>
          صفحة {page} من {totalPages}
        </span>

        <button
          onClick={() => setPage(p => Math.min(p + 1, totalPages))}
          disabled={page === totalPages}
          className="px-4 py-2 border rounded disabled:opacity-50"
        >
          التالي
        </button>
      </div>
    </div>
  );
}
```

---

## 7. Filtering Pattern

```javascript
import { useState } from 'react';
import { useItems } from '../hooks/useModule';

export default function FilteredList() {
  const [filters, setFilters] = useState({
    search: '',
    category: '',
    status: 'all',
  });

  const { data: items } = useItems(filters);

  return (
    <div className="space-y-4">
      {/* Filter Controls */}
      <div className="space-y-2">
        <input
          type="text"
          placeholder="بحث..."
          value={filters.search}
          onChange={(e) =>
            setFilters({ ...filters, search: e.target.value })
          }
          className="w-full p-2 border rounded"
        />

        <select
          value={filters.category}
          onChange={(e) =>
            setFilters({ ...filters, category: e.target.value })
          }
          className="w-full p-2 border rounded"
        >
          <option value="">جميع الفئات</option>
          <option value="cat1">الفئة 1</option>
          <option value="cat2">الفئة 2</option>
        </select>
      </div>

      {/* Results */}
      {items?.map(item => (
        <div key={item.id}>...</div>
      ))}
    </div>
  );
}
```

---

## 8. Real-time Updates Pattern

```javascript
import { useEffect } from 'react';
import queryClient from '@/services/queryClient';

export function useRealtimeUpdates(eventName) {
  useEffect(() => {
    // ✓ استمع لتحديثات WebSocket
    const handleUpdate = (data) => {
      queryClient.invalidateQueries({ queryKey: [eventName] });
    };

    // socket.on(eventName, handleUpdate);
    // return () => socket.off(eventName, handleUpdate);
  }, [eventName]);
}

// الاستخدام
export default function LiveList() {
  useRealtimeUpdates('items-updated');
  const { data: items } = useItems();

  return (
    <div>
      {items?.map(item => (
        <div key={item.id}>{item.name}</div>
      ))}
    </div>
  );
}
```

---

## 9. Debounced Search Pattern

```javascript
import { useState, useEffect } from 'react';
import { useItems } from '../hooks/useModule';

export default function SearchList() {
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // ✓ Debounce البحث
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 500); // 500ms تأخير

    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data: results } = useItems({
    search: debouncedSearch,
  });

  return (
    <div>
      <input
        type="text"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        placeholder="ابحث..."
        className="w-full p-2 border rounded"
      />

      {/* النتائج */}
      {results?.map(item => (
        <div key={item.id}>{item.name}</div>
      ))}
    </div>
  );
}
```

---

## 10. Optimistic Updates Pattern

```javascript
import { useUpdateItem } from '../hooks/useModule';

export default function EditableItem({ item }) {
  const { mutate: updateItem } = useUpdateItem();

  const handleUpdate = async (newData) => {
    // ✓ حدث البيانات الفوري (قبل الرد من السيرفر)
    queryClient.setQueryData(['items', item.id], {
      ...item,
      ...newData,
    });

    // ✓ أرسل الطلب في الخلفية
    updateItem(
      { id: item.id, data: newData },
      {
        onError: (error) => {
          // ✓ استرجع البيانات القديمة في حالة الخطأ
          queryClient.invalidateQueries({
            queryKey: ['items', item.id],
          });
          alert('فشل التحديث');
        },
      }
    );
  };

  return (
    <div className="p-4 border rounded">
      <h3>{item.name}</h3>
      <button
        onClick={() => handleUpdate({ name: 'اسم جديد' })}
        className="px-4 py-2 bg-blue-600 text-white rounded"
      >
        تحديث
      </button>
    </div>
  );
}
```

---

## ملخص dos و don'ts

| ✅ افعل | ❌ لا تفعل |
|---------|----------|
| استخدم axiosInstance | استخدم fetch |
| استخدم React Query | استخدم Redux |
| استخدم Hooks | استخدم Class Components |
| استخدم lazy() | استخدم require() |
| استخدم ErrorBoundary | اتجاهل الأخطاء |
| قسم الـ Features | ضع كل شيء في مجلد واحد |
| استخدم TypeScript | استخدم any type |
| اكتب Tests | اتجاهل الاختبارات |
| استخدم const | استخدم var |
| استخدم async/await | استخدم .then() |

---

✅ الآن أنت جاهز للتطوير الاحترافي!
