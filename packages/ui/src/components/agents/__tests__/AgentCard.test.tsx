import { AgentPersona } from '@scalemap/shared';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

import '@testing-library/jest-dom';
import { AgentCard } from '../AgentCard';

const mockAgent: AgentPersona = {
  id: 'strategic-alignment',
  name: 'Dr. Alexandra Chen',
  title: 'Strategic Transformation Consultant',
  domainExpertise: {
    primaryDomains: ['strategic-alignment'],
    industrySpecializations: ['technology', 'professional-services'],
    regulatoryExpertise: ['GDPR'],
    yearsExperience: 12,
    certifications: ['McKinsey Principal', 'PhD Strategy Stanford'],
    specializations: ['Strategic transformation', 'Vision alignment']
  },
  personality: {
    communicationStyle: 'analytical',
    approach: 'data-driven',
    backstory: 'Former McKinsey Principal, 12 years strategy consulting',
    keyPhrase: 'Strategy without execution is hallucination; execution without strategy is chaos.',
    professionalBackground: 'Strategic transformation for scaling companies',
    strengthAreas: ['Strategic vision development', 'Competitive positioning']
  },
  performance: {
    assessmentsCompleted: 127,
    avgConfidenceScore: 0.89,
    avgProcessingTimeMs: 38000,
    successRate: 0.94,
    clientSatisfactionScore: 4.7
  },
  status: 'available',
  createdAt: '2023-01-01T00:00:00Z',
  updatedAt: '2023-01-01T00:00:00Z'
};

describe('AgentCard', () => {
  it('renders agent information correctly', () => {
    render(<AgentCard agent={mockAgent} />);

    expect(screen.getByText('Dr. Alexandra Chen')).toBeInTheDocument();
    expect(screen.getByText('Strategic Transformation Consultant')).toBeInTheDocument();
    expect(screen.getByText(/Strategy without execution is hallucination/)).toBeInTheDocument();
  });

  it('displays agent status when showStatus is true', () => {
    render(<AgentCard agent={mockAgent} showStatus={true} />);

    // Check if status indicator is present
    const statusElement = screen.getByLabelText(/Status: available/);
    expect(statusElement).toBeInTheDocument();
  });

  it('hides agent status when showStatus is false', () => {
    render(<AgentCard agent={mockAgent} showStatus={false} />);

    // Check if status indicator is not present
    const statusElement = screen.queryByLabelText(/Status: available/);
    expect(statusElement).not.toBeInTheDocument();
  });

  it('displays expertise when showExpertise is true', () => {
    render(<AgentCard agent={mockAgent} showExpertise={true} />);

    expect(screen.getByText('Primary Expertise')).toBeInTheDocument();
    expect(screen.getByText('Strategic Alignment')).toBeInTheDocument();
    expect(screen.getByText('Industry Focus')).toBeInTheDocument();
    expect(screen.getByText('Technology')).toBeInTheDocument();
  });

  it('hides expertise when showExpertise is false', () => {
    render(<AgentCard agent={mockAgent} showExpertise={false} />);

    expect(screen.queryByText('Primary Expertise')).not.toBeInTheDocument();
    expect(screen.queryByText('Industry Focus')).not.toBeInTheDocument();
  });

  it('displays performance metrics', () => {
    render(<AgentCard agent={mockAgent} />);

    expect(screen.getByText('127 assessments')).toBeInTheDocument();
    expect(screen.getByText('89% confidence')).toBeInTheDocument();
    expect(screen.getByText('12 years experience')).toBeInTheDocument();
  });

  it('handles click events', () => {
    const mockOnClick = jest.fn();
    render(<AgentCard agent={mockAgent} onClick={mockOnClick} />);

    const cardElement = screen.getByRole('button');
    fireEvent.click(cardElement);

    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it('handles keyboard events', () => {
    const mockOnClick = jest.fn();
    render(<AgentCard agent={mockAgent} onClick={mockOnClick} />);

    const cardElement = screen.getByRole('button');

    // Test Enter key
    fireEvent.keyDown(cardElement, { key: 'Enter' });
    expect(mockOnClick).toHaveBeenCalledTimes(1);

    // Test Space key
    fireEvent.keyDown(cardElement, { key: ' ' });
    expect(mockOnClick).toHaveBeenCalledTimes(2);

    // Test other key (should not trigger)
    fireEvent.keyDown(cardElement, { key: 'Tab' });
    expect(mockOnClick).toHaveBeenCalledTimes(2);
  });

  it('displays avatar initials when no avatar is provided', () => {
    render(<AgentCard agent={mockAgent} />);

    // Should display initials "DAC" for "Dr. Alexandra Chen"
    expect(screen.getByText('DAC')).toBeInTheDocument();
  });

  it('displays avatar image when provided', () => {
    const agentWithAvatar = {
      ...mockAgent,
      avatar: 'https://example.com/avatar.jpg'
    };

    render(<AgentCard agent={agentWithAvatar} />);

    const avatarImage = screen.getByAltText('Dr. Alexandra Chen avatar');
    expect(avatarImage).toBeInTheDocument();
    expect(avatarImage).toHaveAttribute('src', 'https://example.com/avatar.jpg');
  });

  it('truncates long domain lists', () => {
    const agentWithManyDomains = {
      ...mockAgent,
      domainExpertise: {
        ...mockAgent.domainExpertise,
        primaryDomains: ['domain1', 'domain2', 'domain3', 'domain4'],
        industrySpecializations: ['industry1', 'industry2', 'industry3', 'industry4', 'industry5']
      }
    };

    render(<AgentCard agent={agentWithManyDomains} />);

    // Should show "+2 more" for both primary domains (showing 2 out of 4) and industries (showing 3 out of 5)
    const moreTags = screen.getAllByText('+2 more');
    expect(moreTags).toHaveLength(2); // One for domains, one for industries
  });

  it('applies custom className', () => {
    const { container } = render(
      <AgentCard agent={mockAgent} className="custom-class" />
    );

    const cardElement = container.firstChild as HTMLElement;
    expect(cardElement).toHaveClass('custom-class');
  });

  it('has proper accessibility attributes', () => {
    render(<AgentCard agent={mockAgent} />);

    const cardElement = screen.getByRole('button');
    expect(cardElement).toHaveAttribute('tabIndex', '0');
    expect(cardElement).toHaveAttribute('aria-label', 'View details for Dr. Alexandra Chen, Strategic Transformation Consultant');
  });
});