/**
 * Login.jsx - صفحة تسجيل الدخول
 * 
 * مسؤوليات:
 * 1. جمع بيانات المستخدم (email + password)
 * 2. التحقق من صحة البيانات
 * 3. إرسال طلب المصادقة إلى Supabase
 * 4. معالجة الأخطاء (خطأ في البيانات، حساب معطل، إلخ)
 * 5. إعادة التوجيه إلى الصفحة المناسبة حسب الدور
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/services/supabase';
import toast from 'react-hot-toast';
import { z } from 'zod';
import { EyeIcon as Eye, EyeSlashIcon as EyeOff, EnvelopeIcon as Mail, LockClosedIcon as Lock } from '@heroicons/react/24/outline';

// === Zod Schema للتحقق من البيانات ===
const loginSchema = z.object({
  email: z.string().email('البريد الإلكتروني غير صحيح'),
  password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
});

export default function Login() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // === معالجة التغيير في الحقول ===
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  // === معالجة الـ submit ===
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      loginSchema.parse(formData);
    } catch (error) {
      const fieldErrors = {};
      error.errors.forEach(err => {
        fieldErrors[err.path[0]] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);

    try {
      // === تسجيل الدخول عبر Supabase ===
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast.error('بريد إلكتروني أو كلمة مرور غير صحيحة');
        } else if (error.message.includes('Email not confirmed')) {
          toast.error('الرجاء تأكيد بريدك الإلكتروني أولاً');
          navigate('/verify-email', { state: { email: formData.email } });
          return;
        } else {
          toast.error(error.message || 'حدث خطأ في تسجيل الدخول');
        }
        return;
      }

      // === الحصول على بيانات المستخدم ===
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (!profile) {
        toast.error('حدث خطأ في جلب بيانات المستخدم');
        return;
      }

      // === تسجيل النشاط في audit log ===
      await supabase.from('audit_logs').insert({
        user_id: data.user.id,
        action: 'LOGIN',
        details: { ip: 'detected-by-function' },
      });

      toast.success('تم تسجيل الدخول بنجاح');
      
      const roleRoutes = {
        admin: '/admin/dashboard',
        vendor: '/vendor/dashboard',
        driver: '/driver/dashboard',
        buyer: '/marketplace',
      };

      const redirectTo = roleRoutes[profile.role] || '/marketplace';
      navigate(redirectTo);

    } catch (error) {
      console.error('Login error:', error);
      toast.error('حدث خطأ غير متوقع');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* === Header === */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">قطوف</h1>
          <p className="text-gray-600">منصة بيع الخضار والفواكه بالجملة</p>
        </div>

        {/* === Login Form === */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-lg shadow-lg p-8 space-y-6"
        >
          {/* === Email Field === */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              البريد الإلكتروني
            </label>
            <div className="relative">
              <Mail className="absolute right-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Qotoof273@gmail.com"
                className={`w-full pl-3 pr-10 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                  errors.email
                    ? 'border-red-500 focus:ring-red-500'
                    : 'border-gray-300 focus:ring-green-500'
                }`}
                disabled={isLoading}
              />
            </div>
            {errors.email && (
              <p className="text-red-500 text-sm mt-1">{errors.email}</p>
            )}
          </div>

          {/* === Password Field === */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">
                كلمة المرور
              </label>
              <a
                href="/forgot-password"
                className="text-sm text-green-600 hover:text-green-700"
              >
                هل نسيت كلمتك؟
              </a>
            </div>
            <div className="relative">
              <Lock className="absolute right-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="أدخل كلمة المرور"
                className={`w-full pl-10 pr-10 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                  errors.password
                    ? 'border-red-500 focus:ring-red-500'
                    : 'border-gray-300 focus:ring-green-500'
                }`}
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-3 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="text-red-500 text-sm mt-1">{errors.password}</p>
            )}
          </div>

          {/* === Submit Button === */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium py-2 rounded-lg transition duration-200 flex items-center justify-center gap-2"
          >
            {isLoading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
          </button>

          {/* === Divider === */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">أو</span>
            </div>
          </div>

          {/* === Sign Up Link === */}
          <div className="text-center">
            <p className="text-gray-600">
              ليس لديك حساب؟{' '}
              <a
                href="/register"
                className="text-green-600 hover:text-green-700 font-medium"
              >
                اشترك الآن
              </a>
            </p>
          </div>
        </form>

        {/* === Footer === */}
        <div className="mt-8 text-center text-sm text-gray-600">
          <p>تسجيلك يعني موافقتك على</p>
          <div className="flex justify-center gap-4 mt-2">
            <a href="/privacy" className="hover:text-green-600">
              سياسة الخصوصية
            </a>
            <span>•</span>
            <a href="/terms" className="hover:text-green-600">
              شروط الخدمة
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
