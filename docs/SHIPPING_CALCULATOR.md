# Shipping Calculator Service

## نظرة عامة

خدمة حساب تكلفة الشحن الديناميكية تحسب تكلفة التوصيل بناءً على:
- المسافة بين البائع والمشتري
- منطقة التوصيل (المدينة)
- تفضيلات السائق (إذا تم اختياره)
- الوقت الحالي (ساعات الذروة/المسائية)

## الملفات

- `src/services/shippingCalculator.js` - الخدمة الرئيسية
- `src/pages/CheckoutSimplified.jsx` - صفحة الدفع المحدثة

## كيفية الاستخدام

### استخدام أساسي

```javascript
import { calculateShippingCost } from '@/services/shippingCalculator'

const result = await calculateShippingCost({
  vendorCity: 'Casablanca',
  vendorLat: 33.5731,
  vendorLon: -7.5898,
  buyerCity: 'Rabat',
  buyerLat: 34.0209,
  buyerLon: -6.8416,
  driverId: 'driver-uuid-here', // اختياري
})

console.log(result.cost) // التكلفة الإجمالية
console.log(result.distance) // المسافة بالكيلومتر
console.log(result.estimatedTime) // وقت التوصيل المقدر
```

### الحصول على وقت التوصيل المقدر

```javascript
import { getEstimatedDeliveryTime } from '@/services/shippingCalculator'

const deliveryTime = getEstimatedDeliveryTime(15.5) // 15.5 كم
console.log(deliveryTime) // "45-60 min"
```

### التحقق من توفر التوصيل

```javascript
import { isDeliveryAvailable } from '@/services/shippingCalculator'

const available = await isDeliveryAvailable('Casablanca')
console.log(available) // true/false
```

## معادلة الحساب

```
التكلفة = (السعر الأساسي + (المسافة × سعر لكل كم)) × مضاعف الوقت

مع قيود:
- الحد الأدنى: minPrice
- الحد الأقصى: maxPrice
```

### مضاعفات الوقت

- **ساعات الذروة (12:00 - 14:00)**: 1.5x
- **ساعات مسائية (20:00 - 06:00)**: 1.3x
- **باقي الأوقات**: 1.0x

## مصادر التسعير

1. **افتراضي**: إذا لم توجد منطقة/سائق
   - السعر الأساسي: 15 MAD
   - سعر لكل كم: 2 MAD
   
2. **منطقة التوصيل**: من جدول `delivery_zones`
   - حسب مدينة المشتري
   - يمكن إدارتها من لوحة المدير

3. **تفضيلات السائق**: من جدول `driver_pricing`
   - إذا كان السائق يستخدم تسعير مخصص
   - يمكن للسائق تعديلها من لوحة التحكم

## قاعدة البيانات

### جداول مطلوبة

```sql
-- جدول مناطق التوصيل
CREATE TABLE delivery_zones (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    city TEXT NOT NULL,
    zone_name TEXT NOT NULL,
    zone_code TEXT,
    base_price DECIMAL(10, 2) NOT NULL,
    price_per_km DECIMAL(10, 2) DEFAULT 2.0,
    max_distance_km DECIMAL(10, 2) DEFAULT 50,
    is_active BOOLEAN DEFAULT true
);

-- جدول تسعير السائقين
CREATE TABLE driver_pricing (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    driver_id UUID REFERENCES profiles(id),
    base_price DECIMAL(10, 2) DEFAULT 15.0,
    price_per_km DECIMAL(10, 2) DEFAULT 2.0,
    min_price DECIMAL(10, 2) DEFAULT 10.0,
    max_price DECIMAL(10, 2) DEFAULT 200.0,
    max_distance_km DECIMAL(10, 2) DEFAULT 50,
    is_custom_pricing BOOLEAN DEFAULT false
);
```

## أمثلة على البيانات

### إضافة مناطق توصيل للمغرب

```sql
INSERT INTO delivery_zones (city, zone_name, zone_code, base_price, price_per_km, max_distance_km) VALUES
('Casablanca', 'Centre Ville', 'CASA-C', 15.0, 2.0, 50),
('Casablanca', 'Ain Diab', 'CASA-AD', 18.0, 2.5, 50),
('Rabat', 'Centre', 'RABAT-C', 12.0, 1.8, 40),
('Marrakech', 'Medina', 'MARR-M', 10.0, 1.5, 30),
('Tangier', 'Centre', 'TANG-C', 12.0, 2.0, 40);
```

## واجهة المستخدم

### في صفحة الدفع

1. **الخطوة 1**: إدخال معلومات الشحن
   - الاسم، الهاتف، المدينة، العنوان

2. **الخطوة 2**: اختيار السائق
   - عرض تكلفة الشحن المقدرة
   - عرض المسافة ووقت التوصيل

3. **الخطوة 3**: الدفع
   - ملخص الطلب مع تكلفة الشحن
   - الإجمالي النهائي

## الاختبار

```javascript
// اختبار حساب المسافة
import { calculateDistance } from '@/services/shippingCalculator'

const distance = calculateDistance(33.5731, -7.5898, 34.0209, -6.8416)
console.log(distance) // ~85 km (Casablanca to Rabat)
```

## ملاحظات مهمة

1. **الإحداثيات**: يجب أن تكون متوفرة في جدول `profiles` (latitude, longitude)
2. **الأداء**: يتم حساب الشحن عند تغيير المدينة أو اختيار السائق
3. **Fallback**: إذا فشل الحساب، يتم استخدام السعر الافتراضي (15 MAD)
4. **العملة**: جميع الأسعار بـ MAD (درهم مغربي)

## التطوير المستقبلي

- [ ] إضافة دعم لخدمات شحن خارجية (Google Maps API)
- [ ] دعم التوصيل في نفس اليوم (سعر أعلى)
- [ ] دعم نقاط الاستلام (Pickup Points)
- [ ] دعم الشحن المجاني للطلبات فوق مبلغ معين
- [ ] تحسين دقة المسافة باستخدام طرق الشوارع الفعلية
