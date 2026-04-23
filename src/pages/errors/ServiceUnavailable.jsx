import { Link } from 'react-router-dom'

const ServiceUnavailable = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-xl text-center">
        <h1 className="text-6xl font-extrabold text-gray-900">503</h1>
        <p className="mt-4 text-2xl font-semibold text-gray-800">الخدمة غير متاحة مؤقتًا</p>
        <p className="mt-2 text-gray-600">قد تكون المنصة تحت الصيانة أو ضغط مرتفع. يرجى المحاولة بعد دقائق.</p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button onClick={() => window.location.reload()} className="btn-primary">إعادة المحاولة</button>
          <Link to="/" className="btn-outline">العودة للرئيسية</Link>
        </div>
      </div>
    </div>
  )
}

export default ServiceUnavailable