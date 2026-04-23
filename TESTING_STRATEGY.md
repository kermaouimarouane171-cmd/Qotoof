# 🧪 المرحلة 4: Testing Strategy

> اختبار شامل: Unit Tests + Integration Tests + E2E Tests

---

## استراتيجية الاختبار الموصى بها

```
المستوى 1: Unit Tests (Jest)
└─ 80% من الاختبارات
└─ تختبر الدوال والـ Hooks بمعزل

المستوى 2: Integration Tests
└─ 15% من الاختبارات
└─ تختبر تفاعل عدة components معاً

المستوى 3: E2E Tests (Cypress)
└─ 5% من الاختبارات (لكن الأكثر أهمية!)
└─ تختبر الـ user workflows الكاملة
```

---

## 1️⃣ Unit Tests مع Jest

### الملف: `src/services/__tests__/axiosInstance.test.js`

```javascript
describe('axiosInstance', () => {
  describe('Request Interceptor', () => {
    test('should add Authorization header when token exists', async () => {
      localStorage.setItem('accessToken', 'test-token-123');
      
      const config = {
        headers: {},
      };
      
      // Interceptor يجب أن يضيف الـ header
      expect(config.headers.Authorization).toBeUndefined();
      // بعد التطبيق
      expect(config.headers.Authorization).toBe('Bearer test-token-123');
    });

    test('should not add header if token does not exist', () => {
      localStorage.removeItem('accessToken');
      
      const config = {
        headers: {},
      };
      
      // لا يجب أن يكون هناك header
      expect(config.headers.Authorization).toBeUndefined();
    });
  });

  describe('Response Interceptor - Token Refresh', () => {
    test('should refresh token on 401 response', async () => {
      // Mock البيانات
      const originalRequest = {
        url: '/orders',
        headers: {},
        _retry: false,
      };

      // يجب أن يحاول تجديد الـ token
      // ثم إعادة محاولة الطلب
    });

    test('should redirect to login on failed refresh', async () => {
      // إذا فشل التجديد
      // يجب التوجيه إلى /login
    });
  });
});
```

### الملف: `src/features/marketplace/hooks/__tests__/useProducts.test.js`

```javascript
import { renderHook, waitFor } from '@testing-library/react';
import { useProducts } from '../useProducts';
import { productsApi } from '../../services/api';

// Mock الـ API
jest.mock('../../services/api');

describe('useProducts Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should fetch products successfully', async () => {
    const mockProducts = {
      products: [
        { id: 1, name: 'طماطم', price: 25 },
        { id: 2, name: 'خيار', price: 15 },
      ],
    };

    productsApi.getList.mockResolvedValue(mockProducts);

    const { result } = renderHook(() => useProducts());

    // في البداية: loading
    expect(result.current.isLoading).toBe(true);

    // بعد الانتهاء
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockProducts);
    expect(productsApi.getList).toHaveBeenCalled();
  });

  test('should handle fetch error gracefully', async () => {
    const mockError = new Error('Network error');
    productsApi.getList.mockRejectedValue(mockError);

    const { result } = renderHook(() => useProducts());

    await waitFor(() => {
      expect(result.current.error).toBeDefined();
    });

    expect(result.current.data).toBeUndefined();
  });

  test('should support filtering', async () => {
    const filters = { category: 'vegetables', priceMax: 50 };
    const mockProducts = { products: [] };

    productsApi.getList.mockResolvedValue(mockProducts);

    renderHook(() => useProducts(filters));

    expect(productsApi.getList).toHaveBeenCalledWith(filters);
  });
});
```

### الملف: `src/components/__tests__/Button.test.js`

```javascript
import { render, screen, fireEvent } from '@testing-library/react';
import Button from '../Button';

describe('Button Component', () => {
  test('should render with text', () => {
    render(<Button>اضغط هنا</Button>);
    expect(screen.getByText('اضغط هنا')).toBeInTheDocument();
  });

  test('should handle click', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalled();
  });

  test('should be disabled when prop is true', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  test('should show loading state', () => {
    render(<Button isLoading>Loading</Button>);
    expect(screen.getByText('Loading')).toHaveClass('opacity-50');
  });

  test('should apply custom className', () => {
    const { container } = render(
      <Button className="custom-class">Test</Button>
    );
    expect(container.querySelector('button')).toHaveClass('custom-class');
  });
});
```

---

## 2️⃣ Integration Tests

### الملف: `src/features/marketplace/__tests__/addToCart.integration.test.js`

```javascript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import queryClient from '@/services/queryClient';
import ProductCard from '../components/ProductCard';

// Mock toast
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

describe('Add to Cart Integration', () => {
  const product = {
    id: 1,
    name: 'طماطم',
    price: 25,
    image: 'tomato.jpg',
  };

  test('should add product to cart and update UI', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ProductCard product={product} />
      </QueryClientProvider>
    );

    // المستخدم يضغط زر "أضف إلى السلة"
    const addButton = screen.getByText('أضف إلى السلة');
    fireEvent.click(addButton);

    // يجب أن يظهر رسالة النجاح
    await waitFor(() => {
      expect(screen.getByText('تم إضافة المنتج')).toBeInTheDocument();
    });
  });
});
```

---

## 3️⃣ E2E Tests مع Cypress

### الملف: `cypress/e2e/auth.cy.js`

```javascript
describe('Authentication Flow', () => {
  beforeEach(() => {
    cy.visit('http://localhost:5173');
  });

  describe('Login', () => {
    it('should successfully login with valid credentials', () => {
      // 1. الذهاب إلى صفحة الدخول
      cy.visit('/login');

      // 2. إدخال البيانات
      cy.get('input[name="email"]').type('buyer@example.com');
      cy.get('input[name="password"]').type('Password123');

      // 3. الضغط على الزر
      cy.get('button[type="submit"]').click();

      // 4. التحقق من التوجيه
      cy.url().should('include', '/marketplace');

      // 5. التحقق من وجود رسالة ترحيب
      cy.contains('مرحباً').should('be.visible');
    });

    it('should show error for invalid credentials', () => {
      cy.visit('/login');

      cy.get('input[name="email"]').type('wrong@example.com');
      cy.get('input[name="password"]').type('WrongPassword');

      cy.get('button[type="submit"]').click();

      cy.contains('بريد إلكتروني أو كلمة مرور غير صحيحة').should(
        'be.visible'
      );
    });
  });

  describe('Register', () => {
    it('should register new user successfully', () => {
      cy.visit('/register');

      cy.get('input[name="email"]').type('newuser@example.com');
      cy.get('input[name="password"]').type('SecurePass123');
      cy.get('input[name="confirmPassword"]').type('SecurePass123');
      cy.get('input[name="fullName"]').type('أحمد محمد');
      cy.get('input[name="phoneNumber"]').type('+212612345678');

      // اختيار الدور
      cy.get('select[name="role"]').select('buyer');

      // قبول الشروط
      cy.get('input[type="checkbox"]').check();

      cy.get('button[type="submit"]').click();

      // يجب التوجيه إلى التحقق من البريد
      cy.url().should('include', '/verify-email');
    });

    it('should validate email format', () => {
      cy.visit('/register');

      cy.get('input[name="email"]').type('invalid-email');
      cy.get('button[type="submit"]').click();

      cy.contains('بريد إلكتروني غير صحيح').should('be.visible');
    });
  });

  describe('Logout', () => {
    it('should logout user', () => {
      // Login أولاً
      cy.login('buyer@example.com', 'Password123');

      // الذهاب إلى الملف الشخصي
      cy.visit('/profile');

      // فتح القائمة
      cy.get('[data-testid="user-menu"]').click();

      // الضغط على تسجيل الخروج
      cy.contains('تسجيل الخروج').click();

      // التحقق من التوجيه إلى الصفحة الرئيسية
      cy.url().should('not.include', '/profile');
      cy.contains('تسجيل الدخول').should('be.visible');
    });
  });
});
```

### الملف: `cypress/e2e/checkout.cy.js` (Critical!)

```javascript
describe('Checkout & Payment Flow', () => {
  beforeEach(() => {
    // Login كـ buyer
    cy.login('buyer@example.com', 'Password123');
    
    // أضف منتج إلى السلة
    cy.visit('/marketplace');
    cy.contains('طماطم').click();
    cy.get('input[name="quantity"]').clear().type('2');
    cy.contains('أضف إلى السلة').click();
  });

  it('should complete checkout with valid data', () => {
    // 1. انسخ إلى السلة
    cy.get('[data-testid="cart-icon"]').click();

    // 2. تحقق من المنتج
    cy.contains('طماطم').should('be.visible');
    cy.contains('السعر: 50 درهم').should('be.visible');

    // 3. الذهاب إلى الدفع
    cy.contains('متابعة الدفع').click();

    // === Checkout Step 1: معلومات الشحن ===
    cy.contains('معلومات الشحن').should('be.visible');
    
    cy.get('input[name="address"]').type('شارع النيل، الدار البيضاء');
    cy.get('select[name="governorate"]').select('Casablanca');
    cy.get('select[name="city"]').select('Casablanca');

    cy.get('button[aria-label="next-step"]').click();

    // === Checkout Step 2: طريقة الدفع ===
    cy.contains('اختر طريقة الدفع').should('be.visible');

    // اختيار Stripe
    cy.get('input[value="stripe"]').check();

    cy.get('button[aria-label="next-step"]').click();

    // === Checkout Step 3: تأكيد ===
    cy.contains('تأكيد الطلب').should('be.visible');
    cy.contains('السعر النهائي: 50 درهم').should('be.visible');

    cy.get('button[aria-label="confirm-order"]').click();

    // === Checkout Step 4: الدفع ===
    // Stripe modal يظهر
    cy.get('iframe').should('exist');

    // ملء بيانات البطاقة (في بيئة الاختبار)
    cy.fillStripeForm({
      cardNumber: '4242424242424242',
      expiry: '12/25',
      cvc: '123',
    });

    cy.contains('دفع').click();

    // === تأكيد النجاح ===
    cy.contains('تم إتمام الطلب بنجاح!').should('be.visible');
    cy.contains('رقم الطلب').should('be.visible');
  });

  it('should handle payment failure', () => {
    // نفس الخطوات لكن مع بطاقة فاشلة
    cy.visit('/checkout');
    
    // ...
    
    cy.fillStripeForm({
      cardNumber: '4000000000000002', // بطاقة ستفشل
      expiry: '12/25',
      cvc: '123',
    });

    cy.contains('دفع').click();

    // يجب عرض رسالة الخطأ
    cy.contains('فشل الدفع').should('be.visible');
  });

  it('should support COD payment', () => {
    cy.visit('/checkout');

    // نفس الخطوات...

    // اختيار الدفع عند التسليم
    cy.get('input[value="cod"]').check();

    cy.contains('تأكيد الطلب').click();

    // يجب أن ينجح بدون معالجة دفع
    cy.contains('تم تأكيد الطلب').should('be.visible');
  });
});
```

### الملف: `cypress/e2e/orderTracking.cy.js`

```javascript
describe('Order Tracking', () => {
  it('should track order in real-time', () => {
    cy.login('buyer@example.com', 'Password123');

    cy.visit('/orders');

    // انقر على طلب
    cy.get('[data-testid="order-row"]:first').click();

    // يجب أن نرى:
    cy.contains('موقع التسليم').should('be.visible');
    cy.get('[data-testid="map"]').should('exist');
    cy.contains('السائق').should('be.visible');

    // تحديث الموقع (في الحقيقة Real-time subscription)
    cy.wait(3000);
    cy.get('[data-testid="map"]').should('exist'); // الخريطة تُحدّث
  });
});
```

### الملف: `cypress/support/commands.js`

```javascript
// Custom Cypress Commands

Cypress.Commands.add('login', (email, password) => {
  cy.visit('/login');
  cy.get('input[name="email"]').type(email);
  cy.get('input[name="password"]').type(password);
  cy.get('button[type="submit"]').click();
  cy.url().should('not.include', '/login');
});

Cypress.Commands.add('addToCart', (productName, quantity = 1) => {
  cy.visit('/marketplace');
  cy.contains(productName).click();
  cy.get('input[name="quantity"]').clear().type(quantity);
  cy.contains('أضف إلى السلة').click();
});

Cypress.Commands.add('fillStripeForm', (data) => {
  // ملء نموذج Stripe في iframe
  cy.get('iframe')
    .its('0.contentDocument.body')
    .within(() => {
      cy.get('[placeholder="Card number"]').type(data.cardNumber);
      cy.get('[placeholder="MM / YY"]').type(data.expiry);
      cy.get('[placeholder="CVC"]').type(data.cvc);
    });
});

Cypress.Commands.add('checkoutWithPayment', (paymentMethod = 'stripe') => {
  // خطوات الدفع الكاملة
  cy.get('input[name="address"]').type('Test Address');
  cy.get(`input[value="${paymentMethod}"]`).check();
  cy.contains('تأكيد').click();
});
```

---

## 4️⃣ Running Tests

### Unit Tests

```bash
# تشغيل جميع الاختبارات
npm test

# تشغيل اختبار واحد
npm test -- useProducts.test.js

# مع Coverage
npm run test:coverage

# في Watch Mode
npm run test:watch
```

### E2E Tests

```bash
# فتح Cypress UI
npm run test:cypress

# تشغيل جميع E2E tests
npm run test:cypress:run

# تشغيل اختبار معين
npm run test:cypress:run -- --spec "cypress/e2e/auth.cy.js"

# في بيئة headed برو
npm run test:cypress:headed
```

---

## 5️⃣ Coverage Goals

**Target Coverage: 80%+**

```
Type                  | Target | How
----------------------|--------|---
Statements            | 80%    | Write unit tests
Branches              | 75%    | Test conditionals
Functions             | 80%    | Test all exports
Lines                 | 80%    | Cover code paths
```

### مثال على تقرير Coverage:

```
======= Coverage summary =======
Statements   : 78.5%
Branches     : 72.3%
Functions    : 81.2%
Lines        : 79.1%
===============================
```

---

## 6️⃣ Test Organization

```
src/
├── __tests__/
│   ├── setup.js              # Jest configuration
│   └── mocks/
│       ├── supabase.js
│       ├── axios.js
│       └── router.js
│
├── components/
│   ├── __tests__/
│   │   ├── Button.test.js
│   │   ├── Modal.test.js
│   │   └── ...
│
├── features/
│   ├── marketplace/
│   │   ├── hooks/
│   │   │   ├── __tests__/
│   │   │   │   ├── useProducts.test.js
│   │   │   │   └── useCart.test.js
│   │   │
│   │   └── __tests__/
│   │       └── integration.test.js

cypress/
├── e2e/
│   ├── auth.cy.js
│   ├── checkout.cy.js
│   ├── orderTracking.cy.js
│   └── ...
├── support/
│   ├── commands.js
│   └── e2e.js
└── fixtures/
    ├── users.json
    ├── products.json
    └── orders.json
```

---

## ✅ Testing Checklist

- [ ] جميع الـ Hooks لها unit tests
- [ ] جميع المكونات لها unit tests
- [ ] جميع API calls لها mock tests
- [ ] الـ critical user flows لها E2E tests
- [ ] Coverage > 80%
- [ ] جميع الأخطاء الشائعة مختبرة
- [ ] الـ edge cases مختبرة
- [ ] Performance tests أُضيفت

---

## 🎯 الخطوات التالية

1. إنشاء mock data في `/cypress/fixtures`
2. كتابة أول E2E test (auth)
3. كتابة critical path test (checkout)
4. تشغيل جميع الاختبارات في CI/CD

