import ErrorPage from '@/components/ui/ErrorPage'

export const dynamic = 'force-dynamic'

export default function NotFound() {
  return (
    <ErrorPage
      title="Page not found"
      description="Sorry, we couldn't find the page you're looking for."
      statusCode={404}
      actions={[
        {
          label: 'Go back home',
          href: '/',
          variant: 'primary'
        },
        {
          label: 'Contact us if you think this is a mistake',
          href: '/contact',
          variant: 'secondary'
        }
      ]}
      showPopularPages={true}
    />
  )
}