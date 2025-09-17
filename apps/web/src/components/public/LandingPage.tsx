import Link from 'next/link'

import SystemStatusIndicator from './SystemStatusIndicator'

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              ScaleMap
            </h1>
            <p className="text-xl md:text-2xl mb-8 text-blue-100">
              Strategic Enterprise Assessment and Agent Framework
            </p>
            <p className="text-lg mb-12 text-blue-100 max-w-3xl mx-auto">
              Transform your organization with AI-powered assessments and intelligent automation.
              ScaleMap provides comprehensive enterprise evaluation and deployment-ready agent solutions
              for modern businesses.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/register"
                className="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
              >
                Get Started
              </Link>
              <Link
                href="/login"
                className="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-blue-600 transition-colors"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Comprehensive Enterprise Solutions
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              From assessment to implementation, ScaleMap provides the tools and insights
              your organization needs to scale effectively.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <span className="text-2xl">📊</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                Strategic Assessment
              </h3>
              <p className="text-gray-600">
                Comprehensive evaluation of your organization's processes, technology,
                and operational efficiency with actionable insights.
              </p>
            </div>

            <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200">
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
                <span className="text-2xl">🤖</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                AI Agent Framework
              </h3>
              <p className="text-gray-600">
                Deploy intelligent automation agents tailored to your business needs
                with our robust and scalable framework.
              </p>
            </div>

            <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <span className="text-2xl">⚡</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                Rapid Implementation
              </h3>
              <p className="text-gray-600">
                Fast-track your digital transformation with proven methodologies
                and ready-to-deploy solutions.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* System Status Section */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Platform Status
            </h2>
            <p className="text-gray-600">
              Real-time status of our platform services and infrastructure
            </p>
          </div>

          <div className="max-w-md mx-auto">
            <SystemStatusIndicator />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-blue-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Scale Your Enterprise?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Join leading organizations who trust ScaleMap for their digital transformation.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register"
              className="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
            >
              Start Your Assessment
            </Link>
            <Link
              href="/contact"
              className="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-blue-600 transition-colors"
            >
              Contact Sales
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}