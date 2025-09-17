import Link from 'next/link'
import { ReactNode } from 'react'

export interface ErrorPageProps {
  title: string
  description: string
  statusCode?: number
  icon?: ReactNode
  actions?: {
    label: string
    href?: string
    onClick?: () => void
    variant?: 'primary' | 'secondary'
  }[]
  showPopularPages?: boolean
  children?: ReactNode
}

export default function ErrorPage({
  title,
  description,
  statusCode,
  icon,
  actions = [],
  showPopularPages = false,
  children
}: ErrorPageProps) {
  const defaultIcon = statusCode ? (
    <span className="text-gray-600 text-2xl font-bold">{statusCode}</span>
  ) : (
    <span className="text-red-600 text-xl">⚠</span>
  )

  const defaultActions = [
    {
      label: 'Go back home',
      href: '/',
      variant: 'primary' as const
    },
    {
      label: 'Contact support',
      href: '/contact',
      variant: 'secondary' as const
    }
  ]

  const finalActions = actions.length > 0 ? actions : defaultActions

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-gray-100">
              {icon || defaultIcon}
            </div>
            <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">
              {title}
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              {description}
            </p>

            {children && (
              <div className="mt-4">
                {children}
              </div>
            )}

            <div className="mt-6 flex flex-col space-y-4">
              {finalActions.map((action, index) => {
                const baseClasses = "w-full flex justify-center py-2 px-4 border rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                const primaryClasses = "border-transparent text-white bg-blue-600 hover:bg-blue-700"
                const secondaryClasses = "border-gray-300 text-gray-700 bg-white hover:bg-gray-50"

                const classes = action.variant === 'primary'
                  ? `${baseClasses} ${primaryClasses}`
                  : `${baseClasses} ${secondaryClasses}`

                if (action.href) {
                  return (
                    <Link
                      key={index}
                      href={action.href}
                      className={classes}
                    >
                      {action.label}
                    </Link>
                  )
                }

                if (action.onClick) {
                  return (
                    <button
                      key={index}
                      onClick={action.onClick}
                      className={classes}
                    >
                      {action.label}
                    </button>
                  )
                }

                return null
              })}
            </div>

            {showPopularPages && (
              <div className="mt-8 border-t border-gray-200 pt-6">
                <p className="text-xs text-gray-500">
                  Popular pages:
                </p>
                <div className="mt-2 flex flex-wrap justify-center gap-4 text-sm">
                  <Link href="/" className="text-blue-600 hover:text-blue-500">
                    Home
                  </Link>
                  <Link href="/contact" className="text-blue-600 hover:text-blue-500">
                    Contact
                  </Link>
                  <Link href="/login" className="text-blue-600 hover:text-blue-500">
                    Login
                  </Link>
                  <Link href="/register" className="text-blue-600 hover:text-blue-500">
                    Register
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}