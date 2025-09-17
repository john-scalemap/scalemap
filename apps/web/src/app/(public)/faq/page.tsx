'use client'

import Link from 'next/link'
import { useState } from 'react'

interface FAQItem {
  id: string
  question: string
  answer: string
  category: 'general' | 'technical' | 'billing' | 'security'
}

const faqData: FAQItem[] = [
  {
    id: 'what-is-scalemap',
    question: 'What is ScaleMap?',
    answer: 'ScaleMap is a strategic enterprise assessment and agent framework platform that helps organizations evaluate their operational efficiency, identify growth opportunities, and implement AI-powered solutions for better decision-making.',
    category: 'general'
  },
  {
    id: 'how-it-works',
    question: 'How does ScaleMap work?',
    answer: 'ScaleMap uses advanced AI agents to analyze your organization\'s structure, processes, and performance metrics. It provides comprehensive assessments, identifies bottlenecks, and recommends improvements tailored to your specific industry and business model.',
    category: 'general'
  },
  {
    id: 'getting-started',
    question: 'How do I get started with ScaleMap?',
    answer: 'Getting started is easy! Simply register for an account, complete the initial setup wizard to configure your organization profile, and begin your first assessment. Our onboarding team will guide you through the process.',
    category: 'general'
  },
  {
    id: 'pricing',
    question: 'What are the pricing options?',
    answer: 'ScaleMap offers flexible pricing tiers based on organization size and feature requirements. We have plans for small teams, growing companies, and enterprise organizations. Contact our sales team for detailed pricing information.',
    category: 'billing'
  },
  {
    id: 'data-security',
    question: 'How secure is my data?',
    answer: 'Data security is our top priority. ScaleMap uses enterprise-grade encryption, secure cloud infrastructure, and follows industry best practices for data protection. We are SOC 2 compliant and undergo regular security audits.',
    category: 'security'
  },
  {
    id: 'integrations',
    question: 'What integrations are available?',
    answer: 'ScaleMap integrates with popular business tools including CRM systems, project management platforms, communication tools, and analytics software. We offer APIs and webhooks for custom integrations.',
    category: 'technical'
  },
  {
    id: 'support-hours',
    question: 'What are your support hours?',
    answer: 'Our support team is available Monday through Friday, 9 AM to 6 PM PST. Enterprise customers have access to priority support and extended hours. For urgent issues, we provide 24/7 emergency support.',
    category: 'general'
  },
  {
    id: 'trial-period',
    question: 'Do you offer a free trial?',
    answer: 'Yes! We offer a 14-day free trial that includes access to core features and one complete organizational assessment. No credit card required to start your trial.',
    category: 'billing'
  },
  {
    id: 'data-export',
    question: 'Can I export my data?',
    answer: 'Absolutely. ScaleMap provides comprehensive data export capabilities in multiple formats including CSV, JSON, and PDF reports. You own your data and can export it at any time.',
    category: 'technical'
  },
  {
    id: 'team-size',
    question: 'Is there a limit on team size?',
    answer: 'Team size limits depend on your chosen plan. Our Starter plan supports up to 50 team members, Professional up to 500, and Enterprise plans can accommodate unlimited users.',
    category: 'billing'
  },
  {
    id: 'mobile-access',
    question: 'Is ScaleMap available on mobile devices?',
    answer: 'Yes, ScaleMap is fully responsive and works on all devices. We also offer dedicated mobile apps for iOS and Android with key features optimized for mobile use.',
    category: 'technical'
  },
  {
    id: 'compliance',
    question: 'What compliance standards do you meet?',
    answer: 'ScaleMap meets various compliance standards including GDPR, CCPA, SOC 2 Type II, and ISO 27001. We can provide compliance documentation for enterprise customers.',
    category: 'security'
  }
]

const categories = [
  { id: 'all', label: 'All Questions' },
  { id: 'general', label: 'General' },
  { id: 'technical', label: 'Technical' },
  { id: 'billing', label: 'Billing & Pricing' },
  { id: 'security', label: 'Security & Compliance' }
]

export default function FAQPage() {
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [openItems, setOpenItems] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  const filteredFAQs = faqData.filter(faq => {
    const matchesCategory = selectedCategory === 'all' || faq.category === selectedCategory
    const matchesSearch = searchQuery === '' ||
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const toggleItem = (id: string) => {
    setOpenItems(prev =>
      prev.includes(id)
        ? prev.filter(item => item !== id)
        : [...prev, id]
    )
  }

  const expandAll = () => {
    setOpenItems(filteredFAQs.map(faq => faq.id))
  }

  const collapseAll = () => {
    setOpenItems([])
  }

  return (
    <div className="py-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Frequently Asked Questions
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Find answers to common questions about ScaleMap. Can't find what you're looking for?{' '}
            <Link href="/contact" className="text-blue-600 hover:text-blue-700">
              Contact our support team
            </Link>
            .
          </p>
        </div>

        {/* Search */}
        <div className="mb-8">
          <div className="relative">
            <input
              type="text"
              placeholder="Search FAQ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-400">🔍</span>
            </div>
          </div>
        </div>

        {/* Category Filter */}
        <div className="mb-8">
          <div className="flex flex-wrap gap-2 mb-4">
            {categories.map(category => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  selectedCategory === category.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {category.label}
              </button>
            ))}
          </div>

          {/* Expand/Collapse Controls */}
          <div className="flex gap-4 text-sm">
            <button
              onClick={expandAll}
              className="text-blue-600 hover:text-blue-700"
            >
              Expand All
            </button>
            <button
              onClick={collapseAll}
              className="text-blue-600 hover:text-blue-700"
            >
              Collapse All
            </button>
          </div>
        </div>

        {/* FAQ Items */}
        <div className="space-y-4">
          {filteredFAQs.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No questions found matching your search.</p>
            </div>
          ) : (
            filteredFAQs.map(faq => (
              <div
                key={faq.id}
                className="border border-gray-200 rounded-lg overflow-hidden"
              >
                <button
                  onClick={() => toggleItem(faq.id)}
                  className="w-full px-6 py-4 text-left bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset"
                >
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium text-gray-900">
                      {faq.question}
                    </h3>
                    <span className="text-gray-400 text-xl">
                      {openItems.includes(faq.id) ? '−' : '+'}
                    </span>
                  </div>
                </button>
                {openItems.includes(faq.id) && (
                  <div className="px-6 pb-4 bg-gray-50">
                    <p className="text-gray-700 leading-relaxed">
                      {faq.answer}
                    </p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Contact CTA */}
        <div className="mt-12 text-center bg-blue-50 rounded-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Still have questions?
          </h2>
          <p className="text-gray-600 mb-6">
            Our support team is here to help you get the most out of ScaleMap.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/contact"
              className="bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors"
            >
              Contact Support
            </Link>
            <Link
              href="/status"
              className="bg-white text-blue-600 px-6 py-3 rounded-md font-medium border border-blue-600 hover:bg-blue-50 transition-colors"
            >
              Check System Status
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}