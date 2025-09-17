import ErrorPage from '@/components/ui/ErrorPage'

export default function InternalServerError() {
  return (
    <ErrorPage
      title="Internal Server Error"
      description="We're experiencing technical difficulties. Our team has been notified and is working to resolve this issue."
      statusCode={500}
      icon={<span className="text-red-600 text-xl">🔥</span>}
      actions={[
        {
          label: 'Try again',
          href: '/',
          variant: 'primary'
        },
        {
          label: 'Contact support',
          href: '/contact',
          variant: 'secondary'
        }
      ]}
    >
      <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-4">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">
              What can you do?
            </h3>
            <div className="mt-2 text-sm text-red-700">
              <ul className="list-disc pl-5 space-y-1">
                <li>Wait a few minutes and try again</li>
                <li>Check if the issue persists on different pages</li>
                <li>Contact our support team if the problem continues</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </ErrorPage>
  )
}