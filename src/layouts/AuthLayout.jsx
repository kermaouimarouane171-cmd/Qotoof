import { Outlet } from 'react-router-dom'
import { Link } from 'react-router-dom'

const AuthLayout = () => {
  return (
    <div className="min-h-screen flex">
      {/* Left Side - Form */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-md w-full">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 justify-center mb-10">
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/20">
              <span className="text-white font-bold text-xl">Q</span>
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">Qotoof</span>
          </Link>
          
          <Outlet />
        </div>
      </div>
      
      {/* Right Side - Hero Image */}
      <div className="hidden lg:flex flex-1 relative bg-gradient-to-br from-green-600 via-emerald-600 to-teal-700">
        {/* Background Image */}
        <div className="absolute inset-0">
          <img 
            src="https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=1200" 
            alt="Fresh produce" 
            className="w-full h-full object-cover mix-blend-overlay opacity-20"
          />
        </div>
        
        {/* Floating Elements */}
        <div className="absolute top-20 left-20 w-32 h-32 bg-white/10 rounded-full blur-2xl animate-pulse"></div>
        <div className="absolute bottom-32 right-24 w-48 h-48 bg-white/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        
        {/* Content */}
        <div className="relative flex items-center justify-center p-16">
          <div className="max-w-lg text-white">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-sm font-medium mb-6">
              <span>🌱</span>
              <span>#1 B2B Marketplace</span>
            </div>
            
            <h1 className="text-4xl xl:text-5xl font-extrabold mb-6 leading-tight">
              Fresh from
              <span className="block text-yellow-300">farm to business</span>
            </h1>
            
            <p className="text-lg text-green-100 mb-10">
              Connect directly with farmers and nurseries. Buy in bulk, save more.
            </p>
            
            {/* Stats */}
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
                <div className="text-3xl font-bold mb-1">10K+</div>
                <div className="text-green-200 text-sm">Active Products</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
                <div className="text-3xl font-bold mb-1">2K+</div>
                <div className="text-green-200 text-sm">Verified Vendors</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
                <div className="text-3xl font-bold mb-1">50K+</div>
                <div className="text-green-200 text-sm">Orders Completed</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
                <div className="text-3xl font-bold mb-1">98%</div>
                <div className="text-green-200 text-sm">Satisfaction Rate</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AuthLayout
