import { ReactNode } from 'react'

import FeedbackWidget from '@/components/ui/FeedbackWidget'
import LiveChatWidget from '@/components/ui/LiveChatWidget'

interface PublicLayoutProps {
  children: ReactNode
}

export default function PublicLayout({ children }: PublicLayoutProps) {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">ScaleMap</h1>
            </div>
            <nav className="flex space-x-8">
              <a href="/" className="text-gray-500 hover:text-gray-900">Home</a>
              <a href="/faq" className="text-gray-500 hover:text-gray-900">FAQ</a>
              <a href="/contact" className="text-gray-500 hover:text-gray-900">Contact</a>
              <a href="/status" className="text-gray-500 hover:text-gray-900">Status</a>
              <a href="/login" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">Login</a>
            </nav>
          </div>
        </div>
      </header>

      <main>{children}</main>

      <footer className="bg-gray-50 border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">ScaleMap</h3>
              <p className="text-gray-600 text-sm">
                Strategic Enterprise Assessment and Agent Framework for operational excellence.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900 mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><a href="/" className="hover:text-gray-900">Features</a></li>
                <li><a href="/faq" className="hover:text-gray-900">FAQ</a></li>
                <li><a href="/status" className="hover:text-gray-900">System Status</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900 mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><a href="/contact" className="hover:text-gray-900">Contact Us</a></li>
                <li><a href="mailto:support@scalemap.ai" className="hover:text-gray-900">support@scalemap.ai</a></li>
                <li><span>Mon-Fri, 9AM-6PM PST</span></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900 mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><a href="/contact" className="hover:text-gray-900">About</a></li>
                <li><a href="mailto:sales@scalemap.ai" className="hover:text-gray-900">Sales</a></li>
                <li><a href="/contact" className="hover:text-gray-900">Partnerships</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-200 mt-8 pt-8 text-center text-gray-500">
            <p>&copy; 2025 ScaleMap. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* Support Widgets */}
      <LiveChatWidget />
      <FeedbackWidget />
    </div>
  )
}