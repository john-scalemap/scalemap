import { jest } from '@jest/globals'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import ContactForm from '../ContactForm'

// Mock fetch
global.fetch = jest.fn()

// Mock console.log and console.error to avoid noise in tests
const originalConsoleLog = console.log
const originalConsoleError = console.error

beforeAll(() => {
  console.log = jest.fn()
  console.error = jest.fn()
})

afterAll(() => {
  console.log = originalConsoleLog
  console.error = originalConsoleError
})

describe('ContactForm', () => {
  beforeEach(() => {
    jest.clearAllTimers()
    jest.useFakeTimers()
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  it('should render form heading and all form fields', () => {
    render(<ContactForm />)

    expect(screen.getByText('Send us a Message')).toBeInTheDocument()
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/company/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/subject/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/message/i)).toBeInTheDocument()
  })

  it('should render submit button', () => {
    render(<ContactForm />)

    expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument()
  })

  it('should update form fields when user types', async () => {
    const user = userEvent.setup({ delay: null })
    render(<ContactForm />)

    const nameInput = screen.getByLabelText(/full name/i)
    const emailInput = screen.getByLabelText(/email address/i)
    const companyInput = screen.getByLabelText(/company/i)
    const messageInput = screen.getByLabelText(/message/i)

    await user.type(nameInput, 'John Doe')
    await user.type(emailInput, 'john@example.com')
    await user.type(companyInput, 'Test Company')
    await user.type(messageInput, 'Test message')

    expect(nameInput).toHaveValue('John Doe')
    expect(emailInput).toHaveValue('john@example.com')
    expect(companyInput).toHaveValue('Test Company')
    expect(messageInput).toHaveValue('Test message')
  })

  it('should update subject when selected', async () => {
    const user = userEvent.setup({ delay: null })
    render(<ContactForm />)

    const subjectSelect = screen.getByLabelText(/subject/i)
    await user.selectOptions(subjectSelect, 'sales')

    expect(subjectSelect).toHaveValue('sales')
  })

  it('should show validation errors for required fields', async () => {
    const user = userEvent.setup({ delay: null })
    render(<ContactForm />)

    const submitButton = screen.getByRole('button', { name: /send message/i })
    await user.click(submitButton)

    // HTML5 validation should prevent submission
    const nameInput = screen.getByLabelText(/full name/i)
    expect(nameInput).toBeInvalid()
  })

  it('should submit form with valid data', async () => {
    // Mock successful API response
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, ticketId: 'TICKET-123' })
    })

    const user = userEvent.setup({ delay: null })
    render(<ContactForm />)

    // Fill in required fields
    await user.type(screen.getByLabelText(/full name/i), 'John Doe')
    await user.type(screen.getByLabelText(/email address/i), 'john@example.com')
    await user.selectOptions(screen.getByLabelText(/subject/i), 'sales')
    await user.type(screen.getByLabelText(/message/i), 'Test message')

    const submitButton = screen.getByRole('button', { name: /send message/i })
    await user.click(submitButton)

    // Should show submitting state
    expect(screen.getByText('Sending...')).toBeInTheDocument()
    expect(submitButton).toBeDisabled()

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'John Doe',
          email: 'john@example.com',
          company: '',
          subject: 'sales',
          message: 'Test message'
        }),
      })
    })

    await waitFor(() => {
      expect(screen.getByText(/thank you for your message/i)).toBeInTheDocument()
    })
  })

  it('should clear form after successful submission', async () => {
    // Mock successful API response
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, ticketId: 'TICKET-123' })
    })

    const user = userEvent.setup({ delay: null })
    render(<ContactForm />)

    // Fill in form
    const nameInput = screen.getByLabelText(/full name/i)
    const emailInput = screen.getByLabelText(/email address/i)
    const messageInput = screen.getByLabelText(/message/i)

    await user.type(nameInput, 'John Doe')
    await user.type(emailInput, 'john@example.com')
    await user.selectOptions(screen.getByLabelText(/subject/i), 'sales')
    await user.type(messageInput, 'Test message')

    // Submit form
    await user.click(screen.getByRole('button', { name: /send message/i }))

    await waitFor(() => {
      expect(nameInput).toHaveValue('')
      expect(emailInput).toHaveValue('')
      expect(messageInput).toHaveValue('')
    })
  })

  it('should handle API errors gracefully', async () => {
    // Mock API error response
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Server error' })
    })

    const user = userEvent.setup({ delay: null })
    render(<ContactForm />)

    // Fill in required fields
    await user.type(screen.getByLabelText(/full name/i), 'John Doe')
    await user.type(screen.getByLabelText(/email address/i), 'john@example.com')
    await user.selectOptions(screen.getByLabelText(/subject/i), 'support')
    await user.type(screen.getByLabelText(/message/i), 'Test message')

    // Submit form
    await user.click(screen.getByRole('button', { name: /send message/i }))

    await waitFor(() => {
      expect(screen.getByText(/sorry, there was an error/i)).toBeInTheDocument()
    })
  })

  it('should have proper form styling', () => {
    render(<ContactForm />)

    const formContainer = screen.getByText('Send us a Message').closest('div')
    expect(formContainer).toHaveClass('bg-white', 'border', 'border-gray-200', 'rounded-lg')
  })

  it('should have proper accessibility attributes', () => {
    render(<ContactForm />)

    const nameInput = screen.getByLabelText(/full name/i)
    const emailInput = screen.getByLabelText(/email address/i)
    const subjectSelect = screen.getByLabelText(/subject/i)
    const messageTextarea = screen.getByLabelText(/message/i)

    expect(nameInput).toHaveAttribute('required')
    expect(emailInput).toHaveAttribute('required')
    expect(emailInput).toHaveAttribute('type', 'email')
    expect(subjectSelect).toHaveAttribute('required')
    expect(messageTextarea).toHaveAttribute('required')
  })

  it('should display subject options correctly', () => {
    render(<ContactForm />)

    const subjectSelect = screen.getByLabelText(/subject/i)
    const options = subjectSelect.querySelectorAll('option')

    expect(options).toHaveLength(6) // Including default option
    expect(screen.getByRole('option', { name: /sales inquiry/i })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /technical support/i })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /partnership opportunity/i })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /request demo/i })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /other/i })).toBeInTheDocument()
  })
})