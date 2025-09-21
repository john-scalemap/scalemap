import ErrorPage from '@/components/ui/ErrorPage'

export default function MaintenancePage() {
  return (
    <ErrorPage
      title="System Maintenance"
      description="ScaleMap is currently undergoing scheduled maintenance to improve your experience. We'll be back online shortly."
      icon={<span className="text-orange-600 text-xl">🔧</span>}
      actions={[
        {
          label: 'Check Status',
          href: '/status',
          variant: 'primary'
        },
        {
          label: 'Contact Support',
          href: '/contact',
          variant: 'secondary'
        }
      ]}
    >
      <div className="mt-4 bg-orange-50 border border-orange-200 rounded-md p-4">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-orange-800">
              What's being updated?
            </h3>
            <div className="mt-2 text-sm text-orange-700">
              <ul className="list-disc pl-5 space-y-1">
                <li>Performance improvements</li>
                <li>Security updates</li>
                <li>New features</li>
              </ul>
            </div>
            <div className="mt-4">
              <p className="text-xs text-orange-600">
                Estimated completion: We'll update you as soon as we're back online.
              </p>
            </div>
          </div>
        </div>
      </div>
    </ErrorPage>
  )
}