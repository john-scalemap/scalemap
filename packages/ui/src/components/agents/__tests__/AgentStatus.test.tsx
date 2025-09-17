import { render, screen } from '@testing-library/react';
import React from 'react';

import '@testing-library/jest-dom';
import { AgentStatus, AgentStatusBadge } from '../AgentStatus';

describe('AgentStatus', () => {
  it('renders available status correctly', () => {
    render(<AgentStatus status="available" />);

    expect(screen.getByText('Available')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Agent status: Available');
  });

  it('renders analyzing status with animation', () => {
    render(<AgentStatus status="analyzing" />);

    expect(screen.getByText('Analyzing')).toBeInTheDocument();
    const statusElement = screen.getByRole('status');
    expect(statusElement).toHaveClass('animate-pulse');
  });

  it('renders completed status', () => {
    render(<AgentStatus status="completed" />);

    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('renders offline status', () => {
    render(<AgentStatus status="offline" />);

    expect(screen.getByText('Offline')).toBeInTheDocument();
  });

  it('renders maintenance status with animation', () => {
    render(<AgentStatus status="maintenance" />);

    expect(screen.getByText('Maintenance')).toBeInTheDocument();
    const statusElement = screen.getByRole('status');
    expect(statusElement).toHaveClass('animate-pulse');
  });

  it('hides label when showLabel is false', () => {
    render(<AgentStatus status="available" showLabel={false} />);

    expect(screen.queryByText('Available')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('displays activity when provided', () => {
    render(<AgentStatus status="analyzing" activity="Processing financial data" />);

    expect(screen.getByText('Analyzing')).toBeInTheDocument();
    expect(screen.getByText((content, node) => {
      return node?.textContent === '- Processing financial data';
    })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Agent status: Analyzing - Processing financial data');
  });

  it('displays progress bar when showProgress is true and status is analyzing', () => {
    render(<AgentStatus status="analyzing" showProgress={true} progress={75} />);

    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeInTheDocument();
    expect(progressBar).toHaveAttribute('aria-valuenow', '75');
    expect(progressBar).toHaveAttribute('aria-label', 'Analysis progress: 75%');
  });

  it('does not display progress bar when status is not analyzing', () => {
    render(<AgentStatus status="available" showProgress={true} progress={75} />);

    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('clamps progress value between 0 and 100', () => {
    render(<AgentStatus status="analyzing" showProgress={true} progress={150} />);

    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '150'); // aria-valuenow reflects the raw value
    // But the visual width should be clamped to 100%
    expect(progressBar).toHaveStyle('width: 100%');
  });

  it('applies size classes correctly', () => {
    const { rerender } = render(<AgentStatus status="available" size="sm" />);
    expect(screen.getByRole('status')).toHaveClass('px-2', 'py-1', 'text-xs');

    rerender(<AgentStatus status="available" size="md" />);
    expect(screen.getByRole('status')).toHaveClass('px-3', 'py-1', 'text-sm');

    rerender(<AgentStatus status="available" size="lg" />);
    expect(screen.getByRole('status')).toHaveClass('px-4', 'py-2', 'text-base');
  });

  it('does not show activity for small size', () => {
    render(<AgentStatus status="analyzing" size="sm" activity="Processing data" />);

    expect(screen.getByText('Analyzing')).toBeInTheDocument();
    expect(screen.queryByText(/Processing data/)).not.toBeInTheDocument();
  });
});

describe('AgentStatusBadge', () => {
  it('renders available status badge', () => {
    render(<AgentStatusBadge status="available" />);

    const badge = screen.getByLabelText('Status: Available');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-green-500');
  });

  it('renders analyzing status badge with animation', () => {
    render(<AgentStatusBadge status="analyzing" />);

    const badge = screen.getByLabelText('Status: Analyzing');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-blue-500', 'animate-pulse');
  });

  it('renders completed status badge', () => {
    render(<AgentStatusBadge status="completed" />);

    const badge = screen.getByLabelText('Status: Completed');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-gray-400');
  });

  it('renders offline status badge', () => {
    render(<AgentStatusBadge status="offline" />);

    const badge = screen.getByLabelText('Status: Offline');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-gray-300');
  });

  it('renders maintenance status badge with animation', () => {
    render(<AgentStatusBadge status="maintenance" />);

    const badge = screen.getByLabelText('Status: Maintenance');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-yellow-500', 'animate-pulse');
  });

  it('applies custom className', () => {
    render(<AgentStatusBadge status="available" className="custom-class" />);

    const badge = screen.getByLabelText('Status: Available');
    expect(badge).toHaveClass('custom-class');
  });
});