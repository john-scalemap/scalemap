'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  const handleStartAssessment = () => {
    if (isAuthenticated) {
      router.push('/assessment/new');
    } else {
      router.push('/login?redirect=/assessment/new');
    }
  };

  const handleLearnMore = () => {
    // Scroll to features section or navigate to about page
    const featuresSection = document.getElementById('features');
    if (featuresSection) {
      featuresSection.scrollIntoView({ behavior: 'smooth' });
    }
  };
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-secondary-900 mb-6">
            Welcome to <span className="text-primary-600">ScaleMap</span>
          </h1>
          <p className="text-xl text-secondary-600 mb-8 max-w-2xl mx-auto">
            AI-powered business assessments and strategic recommendations to transform your operations
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={handleStartAssessment}
              className="btn-primary px-8 py-3 hover:bg-primary-700 transition-colors"
            >
              Start Assessment
            </button>
            <button
              onClick={handleLearnMore}
              className="btn-secondary px-8 py-3 hover:bg-secondary-200 transition-colors"
            >
              Learn More
            </button>
          </div>
        </div>

        <div id="features" className="mt-16 grid md:grid-cols-3 gap-8">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold text-secondary-900 mb-4">
              AI-Powered Analysis
            </h3>
            <p className="text-secondary-600">
              Leverage advanced AI to identify operational gaps and growth opportunities
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold text-secondary-900 mb-4">
              Strategic Recommendations
            </h3>
            <p className="text-secondary-600">
              Get actionable insights and prioritized recommendations for your business
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold text-secondary-900 mb-4">
              72-Hour Delivery
            </h3>
            <p className="text-secondary-600">
              Receive comprehensive assessment results within 72 hours
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
