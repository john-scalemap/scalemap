import ContactForm from '@/components/public/ContactForm'

export default function ContactPage() {
  return (
    <div className="py-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Contact Us
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Get in touch with our team to learn how ScaleMap can transform your organization.
            We're here to help you succeed.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-12">
          {/* Contact Information */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Get in Touch</h2>

            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Sales Inquiries</h3>
                <p className="text-gray-600 mb-2">
                  Ready to start your enterprise assessment? Our sales team is here to help.
                </p>
                <a href="mailto:sales@scalemap.ai" className="text-blue-600 hover:text-blue-700">
                  sales@scalemap.ai
                </a>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Technical Support</h3>
                <p className="text-gray-600 mb-2">
                  Need help with our platform? Our technical team is ready to assist.
                </p>
                <a href="mailto:support@scalemap.ai" className="text-blue-600 hover:text-blue-700">
                  support@scalemap.ai
                </a>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">General Inquiries</h3>
                <p className="text-gray-600 mb-2">
                  Have questions about our services or want to learn more?
                </p>
                <a href="mailto:info@scalemap.ai" className="text-blue-600 hover:text-blue-700">
                  info@scalemap.ai
                </a>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Office Hours</h3>
                <p className="text-gray-600">
                  Monday - Friday: 9:00 AM - 6:00 PM PST<br />
                  Weekend support available for enterprise customers
                </p>
              </div>
            </div>
          </div>

          {/* Contact Form */}
          <div>
            <ContactForm />
          </div>
        </div>
      </div>
    </div>
  )
}