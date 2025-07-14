import Link from 'next/link'
import { Button } from '@/components/ui/button'

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
            <Link href="/auth/login" className="block">
              <Button className="w-full bg-blue-600 hover:bg-blue-700">
                Agent Login
              </Button>
            </Link>

            <Link href="/admin/dashboard" className="block">
              <Button variant="outline" className="w-full">
                Admin Dashboard
              </Button>
            </Link>
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
