import { Link } from 'react-router-dom'

const InternalServerError = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-xl text-center">
        <h1 className="text-6xl font-extrabold text-gray-900">500</h1>
        <p className="mt-4 text-2xl font-semibold text-gray-800">خطأ داخلي في الخادم</p>
        <p className="mt-2 text-gray-600">حدث خلل غير متوقع. حاول مرة أخرى بعد قليل أو عد إلى الصفحة الرئيسية.</p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button onClick={() => window.location.reload()} className="btn-primary">إعادة المحاولة</button>
          <Link to="/" className="btn-outline">العودة للرئيسية</Link>
        </div>
      </div>
    </div>
  )
}

export default InternalServerError