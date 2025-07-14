// Force dynamic rendering to prevent Context issues during build
export const dynamic = 'force-dynamic'

// Simple static home page without Context dependencies
export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            PropertyHub Command
          </h1>
          <p className="text-gray-600">
            Real Estate Bot Management System
          </p>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <h2 className="text-lg font-semibold text-green-800 mb-2">
              🎉 System Deployed Successfully!
            </h2>
            <p className="text-green-700 text-sm">
              Your real estate bot system is now live and operational.
            </p>
          </div>

          <div className="space-y-3">
            <a href="/auth/login" className="block w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-lg transition-colors">
              Agent Login
            </a>

            <a href="/admin/dashboard" className="block w-full border border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white py-3 px-6 rounded-lg transition-colors">
              Admin Dashboard
            </a>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              Multi-tenant WABA • AI Learning System • Property Intelligence
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
