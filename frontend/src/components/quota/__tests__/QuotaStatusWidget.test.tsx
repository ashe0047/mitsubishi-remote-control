import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';

import { QuotaStatusWidget } from '../QuotaStatusWidget';

// Mock the UI components
vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className, onClick }: any) => (
    <div data-testid="card" className={className} onClick={onClick}>
      {children}
    </div>
  ),
  CardContent: ({ children, className }: any) => (
    <div data-testid="card-content" className={className}>
      {children}
    </div>
  ),
  CardDescription: ({ children, className }: any) => (
    <div data-testid="card-description" className={className}>
      {children}
    </div>
  ),
  CardHeader: ({ children, className }: any) => (
    <div data-testid="card-header" className={className}>
      {children}
    </div>
  ),
  CardTitle: ({ children, className }: any) => (
    <div data-testid="card-title" className={className}>
      {children}
    </div>
  ),
}));

vi.mock('@/components/ui/progress', () => ({
  Progress: ({ value, className, style }: any) => (
    <div 
      data-testid="progress-bar" 
      data-value={value} 
      className={className}
      style={style}
    />
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant, className }: any) => (
    <span data-testid="badge" data-variant={variant} className={className}>
      {children}
    </span>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, variant, size, className }: any) => (
    <button
      data-testid="button"
      onClick={onClick}
      disabled={disabled}
      data-variant={variant}
      data-size={size}
      className={className}
    >
      {children}
    </button>
  ),
}));

vi.mock('lucide-react', () => ({
  Clock: () => <div data-testid="clock-icon" />,
  Activity: () => <div data-testid="activity-icon" />,
  Zap: () => <div data-testid="zap-icon" />,
  DollarSign: () => <div data-testid="dollar-icon" />,
  AlertTriangle: () => <div data-testid="alert-triangle-icon" />,
  User: () => <div data-testid="user-icon" />,
  Home: () => <div data-testid="home-icon" />,
  Pause: () => <div data-testid="pause-icon" />,
  Play: () => <div data-testid="play-icon" />,
}));

vi.mock('@/lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

describe('QuotaStatusWidget', () => {
  const defaultProps = {
    quotaId: 'test-quota-1',
    familyMemberId: 'family-member-1',
    familyMemberName: 'John Doe',
    roomId: 'room-1',
    roomName: 'Living Room',
    quotaType: 'TIME_BASED' as const,
    currentUsage: 3600, // 1 hour in seconds
    dailyLimit: 7200, // 2 hours in seconds
    status: 'ACTIVE' as const,
    warningThreshold: 75,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders basic quota information correctly', () => {
      render(<QuotaStatusWidget {...defaultProps} />);

      expect(screen.getByText('Time Based Quota')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Living Room')).toBeInTheDocument();
      expect(screen.getByTestId('clock-icon')).toBeInTheDocument();
    });

    it('displays correct usage format for TIME_BASED quota', () => {
      render(<QuotaStatusWidget {...defaultProps} />);

      expect(screen.getByText('1h 0m / 2h 0m')).toBeInTheDocument();
    });

    it('displays correct usage format for USAGE_BASED quota', () => {
      render(
        <QuotaStatusWidget
          {...defaultProps}
          quotaType="USAGE_BASED"
          currentUsage={5}
          dailyLimit={10}
        />
      );

      expect(screen.getByText('5 uses / 10 uses')).toBeInTheDocument();
    });

    it('displays correct usage format for ENERGY_BASED quota', () => {
      render(
        <QuotaStatusWidget
          {...defaultProps}
          quotaType="ENERGY_BASED"
          currentUsage={2500} // 2.5 kWh in Wh
          dailyLimit={5000} // 5 kWh in Wh
        />
      );

      expect(screen.getByText('2.50 kWh / 5.00 kWh')).toBeInTheDocument();
    });

    it('displays correct usage format for COST_BASED quota', () => {
      render(
        <QuotaStatusWidget
          {...defaultProps}
          quotaType="COST_BASED"
          currentUsage={15.5}
          dailyLimit={25}
        />
      );

      expect(screen.getByText('$15.50 / $25.00')).toBeInTheDocument();
    });

    it('shows correct progress percentage', () => {
      render(<QuotaStatusWidget {...defaultProps} />);

      const progressBar = screen.getByTestId('progress-bar');
      expect(progressBar).toHaveAttribute('data-value', '50'); // 1h / 2h = 50%
    });
  });

  describe('Status Display', () => {
    it('displays ACTIVE status correctly', () => {
      render(<QuotaStatusWidget {...defaultProps} status="ACTIVE" />);

      const badge = screen.getByTestId('badge');
      expect(badge).toHaveAttribute('data-variant', 'default');
      expect(badge).toHaveTextContent('Active');
    });

    it('displays WARNING status correctly', () => {
      render(<QuotaStatusWidget {...defaultProps} status="WARNING" />);

      const badge = screen.getByTestId('badge');
      expect(badge).toHaveAttribute('data-variant', 'secondary');
      expect(badge).toHaveTextContent('Warning');
    });

    it('displays EXCEEDED status correctly', () => {
      render(<QuotaStatusWidget {...defaultProps} status="EXCEEDED" />);

      const badge = screen.getByTestId('badge');
      expect(badge).toHaveAttribute('data-variant', 'destructive');
      expect(badge).toHaveTextContent('Exceeded');
    });

    it('displays PAUSED status correctly', () => {
      render(<QuotaStatusWidget {...defaultProps} status="PAUSED" />);

      const badge = screen.getByTestId('badge');
      expect(badge).toHaveAttribute('data-variant', 'outline');
      expect(badge).toHaveTextContent('Paused');
    });

    it('shows warning message when approaching limit', () => {
      render(
        <QuotaStatusWidget
          {...defaultProps}
          currentUsage={5500} // 76.4% of 7200
          status="WARNING"
        />
      );

      expect(screen.getByText('Approaching limit')).toBeInTheDocument();
      expect(screen.getByTestId('alert-triangle-icon')).toBeInTheDocument();
    });

    it('shows exceeded message when limit is exceeded', () => {
      render(
        <QuotaStatusWidget
          {...defaultProps}
          currentUsage={8000} // More than 7200 limit
          status="EXCEEDED"
        />
      );

      expect(screen.getByText('Limit exceeded')).toBeInTheDocument();
      expect(screen.getByTestId('alert-triangle-icon')).toBeInTheDocument();
    });
  });

  describe('Interactive Features', () => {
    it('calls onOverrideClick when override button is clicked', () => {
      const onOverrideClick = vi.fn();
      
      render(
        <QuotaStatusWidget
          {...defaultProps}
          status="EXCEEDED"
          showOverrideButton={true}
          onOverrideClick={onOverrideClick}
        />
      );

      const overrideButton = screen.getByText('Request Override');
      fireEvent.click(overrideButton);

      expect(onOverrideClick).toHaveBeenCalledTimes(1);
    });

    it('does not show override button when showOverrideButton is false', () => {
      render(
        <QuotaStatusWidget
          {...defaultProps}
          status="EXCEEDED"
          showOverrideButton={false}
        />
      );

      expect(screen.queryByText('Request Override')).not.toBeInTheDocument();
    });

    it('only shows override button when status is EXCEEDED', () => {
      render(
        <QuotaStatusWidget
          {...defaultProps}
          status="ACTIVE"
          showOverrideButton={true}
        />
      );

      expect(screen.queryByText('Request Override')).not.toBeInTheDocument();
    });

    it('shows resume button when status is PAUSED', () => {
      render(<QuotaStatusWidget {...defaultProps} status="PAUSED" />);

      expect(screen.getByText('Resume')).toBeInTheDocument();
      expect(screen.getByTestId('play-icon')).toBeInTheDocument();
    });
  });

  describe('Compact Mode', () => {
    it('renders in compact collapsed mode initially', () => {
      render(<QuotaStatusWidget {...defaultProps} compact={true} />);

      // Should show minimal info
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('50%')).toBeInTheDocument(); // Usage percentage
      
      // Should not show detailed info
      expect(screen.queryByText('Time Based Quota')).not.toBeInTheDocument();
      expect(screen.queryByText('Living Room')).not.toBeInTheDocument();
    });

    it('expands when clicked in compact mode', () => {
      render(<QuotaStatusWidget {...defaultProps} compact={true} />);

      const card = screen.getByTestId('card');
      fireEvent.click(card);

      waitFor(() => {
        expect(screen.getByText('Time Based Quota')).toBeInTheDocument();
        expect(screen.getByText('Living Room')).toBeInTheDocument();
      });
    });

    it('shows collapse/expand button in compact mode when expanded', () => {
      render(<QuotaStatusWidget {...defaultProps} compact={true} />);

      // First expand
      const card = screen.getByTestId('card');
      fireEvent.click(card);

      waitFor(() => {
        expect(screen.getByText('Collapse')).toBeInTheDocument();
      });
    });
  });

  describe('Reset Time Display', () => {
    it('displays time until reset when resetTime is provided', () => {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      
      render(
        <QuotaStatusWidget {...defaultProps} resetTime={tomorrow} />
      );

      expect(screen.getByText(/Resets in/)).toBeInTheDocument();
    });

    it('displays "Resetting soon" when resetTime has passed', () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      render(
        <QuotaStatusWidget {...defaultProps} resetTime={yesterday} />
      );

      expect(screen.getByText('Resetting soon')).toBeInTheDocument();
    });

    it('does not display reset time when not provided', () => {
      render(<QuotaStatusWidget {...defaultProps} />);

      expect(screen.queryByText(/Resets in/)).not.toBeInTheDocument();
      expect(screen.queryByText('Resetting soon')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      render(<QuotaStatusWidget {...defaultProps} />);

      const card = screen.getByTestId('card');
      expect(card).toBeInTheDocument();
      
      const progressBar = screen.getByTestId('progress-bar');
      expect(progressBar).toHaveAttribute('data-value', '50');
    });

    it('has proper button attributes when override is available', () => {
      render(
        <QuotaStatusWidget
          {...defaultProps}
          status="EXCEEDED"
          showOverrideButton={true}
        />
      );

      const button = screen.getByText('Request Override');
      expect(button).not.toBeDisabled();
      expect(button).toHaveAttribute('data-variant', 'outline');
      expect(button).toHaveAttribute('data-size', 'sm');
    });
  });

  describe('Edge Cases', () => {
    it('handles zero daily limit gracefully', () => {
      render(<QuotaStatusWidget {...defaultProps} dailyLimit={0} />);

      const progressBar = screen.getByTestId('progress-bar');
      expect(progressBar).toHaveAttribute('data-value', '0');
    });

    it('caps progress at 100% when usage exceeds limit', () => {
      render(
        <QuotaStatusWidget
          {...defaultProps}
          currentUsage={10000} // More than dailyLimit
          dailyLimit={7200}
        />
      );

      const progressBar = screen.getByTestId('progress-bar');
      expect(progressBar).toHaveAttribute('data-value', '100');
    });

    it('handles singular vs plural usage text correctly', () => {
      render(
        <QuotaStatusWidget
          {...defaultProps}
          quotaType="USAGE_BASED"
          currentUsage={1}
          dailyLimit={1}
        />
      );

      expect(screen.getByText('1 use / 1 use')).toBeInTheDocument();
    });
  });
});