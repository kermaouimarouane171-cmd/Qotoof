# 🔌 المرحلة 3: API Integration & React Query Hooks

> صلة الوصل بين Frontend و Backend

---

## البنية الموصى بها

```
src/features/moduleName/
├── services/
│   └── api.js              # API calls
├── hooks/
│   └── useModuleName.js    # React Query hooks
├── constants/
│   └── endpoints.js        # API endpoints
└── types/
    └── index.d.ts         # TypeScript types
```

---

## الخطوة 1: إنشاء API Endpoints Constants

### الملف: `src/features/marketplace/constants/endpoints.js`

```javascript
/**
 * Marketplace API Endpoints
 * 
 * التنسيق: /api/v1/{resource}/{action}
 */

export const MARKETPLACE_ENDPOINTS = {
  // ===== Products =====
  PRODUCT_LIST: '/api/v1/products',
  PRODUCT_DETAIL: (id) => `/api/v1/products/${id}`,
  PRODUCT_REVIEWS: (id) => `/api/v1/products/${id}/reviews`,
  PRODUCT_RECOMMENDATIONS: '/api/v1/products/recommendations',
  
  // ===== Orders =====
  ORDER_LIST: '/api/v1/orders',
  ORDER_DETAIL: (id) => `/api/v1/orders/${id}`,
  ORDER_TRACKING: (id) => `/api/v1/orders/${id}/tracking`,
  ORDER_CREATE: '/api/v1/orders',
  ORDER_CANCEL: (id) => `/api/v1/orders/${id}/cancel`,
  
  // ===== Cart =====
  CART_GET: '/api/v1/cart',
  CART_ADD: '/api/v1/cart/items',
  CART_UPDATE: (itemId) => `/api/v1/cart/items/${itemId}`,
  CART_REMOVE: (itemId) => `/api/v1/cart/items/${itemId}`,
  CART_CLEAR: '/api/v1/cart/clear',
  
  // ===== Checkout =====
  CHECKOUT_VALIDATE: '/api/v1/checkout/validate',
  CHECKOUT_CREATE_PAYMENT: '/api/v1/checkout/payment',
  
  // ===== Stores =====
  STORE_LIST: '/api/v1/stores',
  STORE_DETAIL: (id) => `/api/v1/stores/${id}`,
  STORE_PRODUCTS: (storeId) => `/api/v1/stores/${storeId}/products`,
};
```

---

## الخطوة 2: إنشاء API Services

### الملف: `src/features/marketplace/services/api.js`

```javascript
/**
 * Marketplace API Service
 * 
 * جميع الـ HTTP requests للـ marketplace
 * يستخدم axiosInstance (مع interceptors تلقائية)
 */

import { axiosInstance } from '@/services/axiosInstance';
import { MARKETPLACE_ENDPOINTS } from '../constants/endpoints';

/**
 * ===== PRODUCTS =====
 */
export const productsApi = {
  // جلب قائمة المنتجات مع filters
  getList: (params = {}) =>
    axiosInstance.get(MARKETPLACE_ENDPOINTS.PRODUCT_LIST, { params }),

  // جلب تفاصيل منتج واحد
  getDetail: (id) =>
    axiosInstance.get(MARKETPLACE_ENDPOINTS.PRODUCT_DETAIL(id)),

  // جلب آراء المنتج
  getReviews: (id, params = {}) =>
    axiosInstance.get(MARKETPLACE_ENDPOINTS.PRODUCT_REVIEWS(id), { params }),

  // جلب توصيات منتجات مشابهة
  getRecommendations: (productId) =>
    axiosInstance.get(MARKETPLACE_ENDPOINTS.PRODUCT_RECOMMENDATIONS, {
      params: { productId },
    }),

  // إضافة تقييم جديد
  addReview: (productId, data) =>
    axiosInstance.post(
      `${MARKETPLACE_ENDPOINTS.PRODUCT_REVIEWS(productId)}/new`,
      data
    ),
};

/**
 * ===== ORDERS =====
 */
export const ordersApi = {
  // جلب قائمة طلبات المستخدم
  getList: (params = {}) =>
    axiosInstance.get(MARKETPLACE_ENDPOINTS.ORDER_LIST, { params }),

  // جلب تفاصيل طلب واحد
  getDetail: (id) =>
    axiosInstance.get(MARKETPLACE_ENDPOINTS.ORDER_DETAIL(id)),

  // جلب بيانات التتبع (خريطة + موقع السائق)
  getTracking: (id) =>
    axiosInstance.get(MARKETPLACE_ENDPOINTS.ORDER_TRACKING(id)),

  // إنشاء طلب جديد
  create: (data) =>
    axiosInstance.post(MARKETPLACE_ENDPOINTS.ORDER_CREATE, data),

  // إلغاء طلب
  cancel: (id, reason) =>
    axiosInstance.post(MARKETPLACE_ENDPOINTS.ORDER_CANCEL(id), { reason }),

  // طلب ترجيع
  requestReturn: (orderId, data) =>
    axiosInstance.post(`/api/v1/orders/${orderId}/return-request`, data),
};

/**
 * ===== CART =====
 */
export const cartApi = {
  // جلب السلة
  get: () =>
    axiosInstance.get(MARKETPLACE_ENDPOINTS.CART_GET),

  // إضافة منتج إلى السلة
  addItem: (data) =>
    axiosInstance.post(MARKETPLACE_ENDPOINTS.CART_ADD, data),

  // تحديث كمية عنصر
  updateItem: (itemId, data) =>
    axiosInstance.put(MARKETPLACE_ENDPOINTS.CART_UPDATE(itemId), data),

  // حذف عنصر من السلة
  removeItem: (itemId) =>
    axiosInstance.delete(MARKETPLACE_ENDPOINTS.CART_REMOVE(itemId)),

  // مسح السلة كاملة
  clear: () =>
    axiosInstance.post(MARKETPLACE_ENDPOINTS.CART_CLEAR),
};

/**
 * ===== CHECKOUT =====
 */
export const checkoutApi = {
  // التحقق من صحة البيانات قبل الدفع
  validate: (data) =>
    axiosInstance.post(MARKETPLACE_ENDPOINTS.CHECKOUT_VALIDATE, data),

  // إنشاء payment intent (الخطوة الأولى قبل الدفع)
  createPaymentIntent: (data) =>
    axiosInstance.post(MARKETPLACE_ENDPOINTS.CHECKOUT_CREATE_PAYMENT, data),

  // تأكيد الدفع (بعد إتمام العملية)
  confirmPayment: (paymentId, data) =>
    axiosInstance.post(`/api/v1/checkout/payment/${paymentId}/confirm`, data),
};

/**
 * ===== STORES =====
 */
export const storesApi = {
  // جلب قائمة المتاجر
  getList: (params = {}) =>
    axiosInstance.get(MARKETPLACE_ENDPOINTS.STORE_LIST, { params }),

  // جلب تفاصيل متجر واحد
  getDetail: (id) =>
    axiosInstance.get(MARKETPLACE_ENDPOINTS.STORE_DETAIL(id)),

  // جلب منتجات متجر معين
  getProducts: (storeId, params = {}) =>
    axiosInstance.get(MARKETPLACE_ENDPOINTS.STORE_PRODUCTS(storeId), {
      params,
    }),

  // متابعة متجر
  follow: (storeId) =>
    axiosInstance.post(`/api/v1/stores/${storeId}/follow`),

  // إلغاء المتابعة
  unfollow: (storeId) =>
    axiosInstance.delete(`/api/v1/stores/${storeId}/follow`),
};
```

---

## الخطوة 3: إنشاء React Query Hooks

### الملف: `src/features/marketplace/hooks/useProducts.js`

```javascript
/**
 * Custom Hooks for Products
 * 
 * السلوك الموصى به:
 * - استخدم useQuery للـ GET requests
 * - استخدم useMutation للـ POST/PUT/DELETE
 * - أدر الـ error handling تلقائياً
 * - أعد جلب البيانات ذات الصلة عند التحديث
 */

import { useQuery, useMutation } from '@tanstack/react-query';
import { productsApi } from '../services/api';
import queryClient from '@/services/queryClient';

/**
 * جلب قائمة المنتجات
 * 
 * @param {object} filters - فلاتر البحث
 * @returns {useQuery result}
 */
export function useProducts(filters = {}) {
  return useQuery({
    queryKey: ['products', filters],
    queryFn: () => productsApi.getList(filters),
    staleTime: 5 * 60 * 1000, // 5 دقائق
    gcTime: 10 * 60 * 1000, // 10 دقائق (سابقاً cacheTime)
    enabled: true, // ابدأ الطلب فوراً
  });
}

/**
 * جلب منتج واحد بـ ID
 * 
 * @param {string} id - معرّف المنتج
 * @returns {useQuery result}
 */
export function useProduct(id) {
  return useQuery({
    queryKey: ['products', id],
    queryFn: () => productsApi.getDetail(id),
    staleTime: 10 * 60 * 1000, // 10 دقائق (تفاصيل لا تتغير كثيراً)
    enabled: !!id, // لا تبدأ إلا إذا كان هناك ID
  });
}

/**
 * جلب آراء وتقييمات المنتج
 * 
 * @param {string} productId - معرّف المنتج
 * @param {object} params - pagination, sorting
 * @returns {useQuery result}
 */
export function useProductReviews(productId, params = {}) {
  return useQuery({
    queryKey: ['productReviews', productId, params],
    queryFn: () => productsApi.getReviews(productId, params),
    enabled: !!productId,
  });
}

/**
 * جلب منتجات موصى بها (مشابهة)
 * 
 * @param {string} productId - المنتج الحالي
 * @returns {useQuery result}
 */
export function useProductRecommendations(productId) {
  return useQuery({
    queryKey: ['productRecommendations', productId],
    queryFn: () => productsApi.getRecommendations(productId),
    enabled: !!productId,
    staleTime: 30 * 60 * 1000, // 30 دقيقة
  });
}

/**
 * إضافة تقييم جديد للمنتج
 * 
 * @returns {useMutation result}
 */
export function useAddProductReview() {
  return useMutation({
    mutationFn: ({ productId, data }) => 
      productsApi.addReview(productId, data),
    
    onSuccess: (response, { productId }) => {
      // أعد جلب التقييمات
      queryClient.invalidateQueries({
        queryKey: ['productReviews', productId],
      });
      
      // أعد جلب بيانات المنتج (لتحديث المتوسط)
      queryClient.invalidateQueries({
        queryKey: ['products', productId],
      });
    },
    
    onError: (error) => {
      console.error('خطأ في إضافة التقييم:', error);
    },
  });
}
```

### الملف: `src/features/marketplace/hooks/useOrders.js`

```javascript
import { useQuery, useMutation } from '@tanstack/react-query';
import { ordersApi } from '../services/api';
import queryClient from '@/services/queryClient';
import toast from 'react-hot-toast';

export function useOrders(filters = {}) {
  return useQuery({
    queryKey: ['orders', filters],
    queryFn: () => ordersApi.getList(filters),
  });
}

export function useOrder(id) {
  return useQuery({
    queryKey: ['orders', id],
    queryFn: () => ordersApi.getDetail(id),
    enabled: !!id,
  });
}

export function useOrderTracking(orderId) {
  return useQuery({
    queryKey: ['orderTracking', orderId],
    queryFn: () => ordersApi.getTracking(orderId),
    enabled: !!orderId,
    refetchInterval: 5000, // أعد جلب كل 5 ثوان (للموقع الحي)
  });
}

export function useCreateOrder() {
  return useMutation({
    mutationFn: ordersApi.create,
    onSuccess: (response) => {
      toast.success('تم إنشاء الطلب بنجاح!');
      
      // أعد جلب قائمة الطلبات
      queryClient.invalidateQueries({
        queryKey: ['orders'],
      });
    },
    onError: (error) => {
      toast.error(error.message || 'فشل إنشاء الطلب');
    },
  });
}

export function useCancelOrder() {
  return useMutation({
    mutationFn: ({ orderId, reason }) =>
      ordersApi.cancel(orderId, reason),
    
    onSuccess: (response, { orderId }) => {
      toast.success('تم إلغاء الطلب');
      
      // أعد جلب الطلب
      queryClient.invalidateQueries({
        queryKey: ['orders', orderId],
      });
    },
  });
}
```

### الملف: `src/features/marketplace/hooks/useCart.js`

```javascript
import { useQuery, useMutation } from '@tanstack/react-query';
import { cartApi } from '../services/api';
import queryClient from '@/services/queryClient';
import toast from 'react-hot-toast';

/**
 * جلب السلة الحالية
 */
export function useCart() {
  return useQuery({
    queryKey: ['cart'],
    queryFn: cartApi.get,
    staleTime: 1 * 60 * 1000, // 1 دقيقة
  });
}

/**
 * إضافة منتج إلى السلة
 */
export function useAddToCart() {
  return useMutation({
    mutationFn: (data) => cartApi.addItem(data),
    
    onSuccess: () => {
      toast.success('تم إضافة المنتج إلى السلة');
      
      // أعد جلب السلة
      queryClient.invalidateQueries({
        queryKey: ['cart'],
      });
    },
    
    onError: (error) => {
      toast.error(error.message || 'فشل إضافة المنتج');
    },
  });
}

/**
 * تحديث كمية منتج في السلة
 */
export function useUpdateCartItem() {
  return useMutation({
    mutationFn: ({ itemId, data }) =>
      cartApi.updateItem(itemId, data),
    
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['cart'],
      });
    },
  });
}

/**
 * حذف منتج من السلة
 */
export function useRemoveFromCart() {
  return useMutation({
    mutationFn: (itemId) => cartApi.removeItem(itemId),
    
    onSuccess: () => {
      toast.success('تم حذف المنتج من السلة');
      queryClient.invalidateQueries({
        queryKey: ['cart'],
      });
    },
  });
}

/**
 * مسح السلة كاملة
 */
export function useClearCart() {
  return useMutation({
    mutationFn: cartApi.clear,
    
    onSuccess: () => {
      toast('تم مسح السلة');
      queryClient.invalidateQueries({
        queryKey: ['cart'],
      });
    },
  });
}
```

---

## استخدام الـ Hooks في المكونات

### مثال: استخدام في ProductList Component

```javascript
import { useProducts } from '@/features/marketplace/hooks/useProducts';
import ProductCard from './ProductCard';

export default function ProductList() {
  const [filters, setFilters] = useState({});
  const { data, isLoading, error } = useProducts(filters);

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorAlert error={error} />;

  return (
    <div className="grid grid-cols-4 gap-4">
      {data?.products?.map(product => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
```

### مثال: استخدام Mutation في Cart Component

```javascript
import { useAddToCart } from '@/features/marketplace/hooks/useCart';

export default function AddToCartButton({ productId, quantity }) {
  const { mutate: addToCart, isPending } = useAddToCart();

  const handleClick = () => {
    addToCart({
      productId,
      quantity,
    });
  };

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
    >
      {isPending ? 'جاري الإضافة...' : 'أضف إلى السلة'}
    </button>
  );
}
```

---

## الأنماط الموصى بها

### ✅ Pattern 1: Optimistic Updates

```javascript
export function useUpdateCartItem() {
  return useMutation({
    mutationFn: ({ itemId, quantity }) =>
      cartApi.updateItem(itemId, { quantity }),

    // تحديث فوري قبل الرد من السيرفر
    onMutate: async ({ itemId, quantity }) => {
      // ألغِ أي طلبات جاري معلقة
      await queryClient.cancelQueries({
        queryKey: ['cart'],
      });

      // احفظ البيانات القديمة
      const previousCart = queryClient.getQueryData(['cart']);

      // حدث البيانات فوراً
      queryClient.setQueryData(['cart'], (old) => ({
        ...old,
        items: old.items.map(item =>
          item.id === itemId ? { ...item, quantity } : item
        ),
      }));

      return { previousCart };
    },

    // إذا فشل، استرجع البيانات القديمة
    onError: (err, variables, context) => {
      if (context?.previousCart) {
        queryClient.setQueryData(['cart'], context.previousCart);
      }
      toast.error('فشل التحديث');
    },

    // أعاد جلب للتأكد
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['cart'],
      });
    },
  });
}
```

### ✅ Pattern 2: Polling (استقصاء)

```javascript
export function useOrderStatusPolling(orderId) {
  return useQuery({
    queryKey: ['orderStatus', orderId],
    queryFn: () => ordersApi.getDetail(orderId),
    refetchInterval: 3000, // كل 3 ثواني
    refetchIntervalInBackground: true, // استمر حتى لو كان التاب في الخلفية
    enabled: !!orderId,
  });
}
```

### ✅ Pattern 3: Infinite Query (تحميل بلا حدود)

```javascript
import { useInfiniteQuery } from '@tanstack/react-query';

export function useInfiniteOrders() {
  return useInfiniteQuery({
    queryKey: ['orders'],
    queryFn: ({ pageParam = 0 }) =>
      ordersApi.getList({ page: pageParam, limit: 10 }),
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
  });
}

// الاستخدام في Component:
export default function OrderList() {
  const { data, fetchNextPage, hasNextPage } = useInfiniteOrders();

  return (
    <div>
      {data?.pages.flatMap(page => page.orders).map(order => (
        <OrderRow key={order.id} order={order} />
      ))}
      
      {hasNextPage && (
        <button onClick={() => fetchNextPage()}>
          تحميل المزيد
        </button>
      )}
    </div>
  );
}
```

---

## Error Handling

```javascript
export function useCreateOrderSafe() {
  return useMutation({
    mutationFn: ordersApi.create,
    
    onError: (error) => {
      // معالجة أنواع الأخطاء المختلفة
      if (error.response?.status === 400) {
        toast.error('بيانات غير صحيحة');
      } else if (error.response?.status === 401) {
        toast.error('يجب تسجيل الدخول أولاً');
        navigate('/login');
      } else if (error.response?.status === 409) {
        toast.error('المنتج غير متاح');
      } else {
        toast.error('حدث خطأ. الرجاء المحاولة لاحقاً');
      }
      
      // تسجيل الخطأ
      console.error('Order error:', error);
    },
  });
}
```

---

## ✅ Verification Checklist

- [ ] جميع API endpoints معرّفة
- [ ] جميع API services مكتوبة
- [ ] جميع Hooks منشأة
- [ ] جميع Hooks توثق خطأها
- [ ] جميع الـ mutations لديها `onSuccess` و `onError`
- [ ] جميع الـ queries لديها `staleTime`
- [ ] جميع الـ refetch محسنة (ليست بطيئة)
- [ ] جميع الأخطاء معالجة بشكل لائق

