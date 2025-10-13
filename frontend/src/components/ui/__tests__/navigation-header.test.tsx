import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NavigationHeader } from '../navigation-header';

// Mock the BackButton and ConnectionStatusBadge components
jest.mock('../back-button', () => ({
  BackButton: ({ label, showLabel, onClick, className }: {
    label: string;
    showLabel: boolean;
    onClick: () => void;
    className: string;
  }) => (
    <button
      data-testid="back-button"
      onClick={onClick}
      className={className}
    >
      {showLabel ? label : 'BackIcon'}
    </button>
  ),
}));

jest.mock('../connection-status-badge', () => ({
  ConnectionStatusBadge: ({ showDetailedStatus, compact, onClick, className }: {
    showDetailedStatus: boolean;
    compact: boolean;
    onClick: () => void;
    className: string;
  }) => (
    <div
      data-testid="connection-status-badge"
      onClick={onClick}
      className={className}
    >
      {compact ? 'Compact Status' : showDetailedStatus ? 'Detailed Status' : 'Status'}
    </div>
  ),
}));

describe('NavigationHeader', () => {
  it('renders with default props', () => {
    render(<NavigationHeader />);
    
    expect(screen.getByTestId('back-button')).toBeInTheDocument();
    expect(screen.getByTestId('connection-status-badge')).toBeInTheDocument();
  });

  it('renders with title and subtitle', () => {
    render(
      <NavigationHeader 
        title="Control Room" 
        subtitle="Living Room AC Unit" 
      />
    );
    
    expect(screen.getByText('Control Room')).toBeInTheDocument();
    expect(screen.getByText('Living Room AC Unit')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Control Room' })).toHaveClass('text-xl');
  });

  it('renders in compact mode', () => {
    render(
      <NavigationHeader 
        title="Control Room" 
        subtitle="Living Room AC Unit" 
        compact={true}
      />
    );
    
    // Title should be smaller in compact mode
    expect(screen.getByRole('heading', { name: 'Control Room' })).toHaveClass('text-lg');
    
    // Subtitle should not be shown in compact mode
    expect(screen.queryByText('Living Room AC Unit')).not.toBeInTheDocument();
    
    // BackButton should not show label in compact mode
    expect(screen.getByTestId('back-button')).toHaveTextContent('BackIcon');
    
    // ConnectionStatusBadge should be compact
    expect(screen.getByTestId('connection-status-badge')).toHaveTextContent('Compact Status');
  });

  it('hides back button when showBackButton is false', () => {
    render(<NavigationHeader showBackButton={false} />);
    
    expect(screen.queryByTestId('back-button')).not.toBeInTheDocument();
  });

  it('hides connection status when showConnectionStatus is false', () => {
    render(<NavigationHeader showConnectionStatus={false} />);
    
    expect(screen.queryByTestId('connection-status-badge')).not.toBeInTheDocument();
  });

  it('shows detailed connection status when enabled', () => {
    render(<NavigationHeader showDetailedStatus={true} />);
    
    expect(screen.getByTestId('connection-status-badge')).toHaveTextContent('Detailed Status');
  });

  it('renders custom children', () => {
    render(
      <NavigationHeader title="Test">
        <div data-testid="custom-content">Custom Content</div>
      </NavigationHeader>
    );
    
    expect(screen.getByTestId('custom-content')).toBeInTheDocument();
    expect(screen.getByText('Custom Content')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const customClass = 'custom-header-class';
    render(<NavigationHeader className={customClass} />);
    
    const header = screen.getByRole('banner');
    expect(header).toHaveClass(customClass);
  });

  it('applies custom titleClassName', () => {
    const customTitleClass = 'custom-title-class';
    render(
      <NavigationHeader 
        title="Test Title" 
        titleClassName={customTitleClass}
      />
    );
    
    const title = screen.getByRole('heading', { name: 'Test Title' });
    expect(title).toHaveClass(customTitleClass);
  });

  it('applies sticky styling when sticky prop is true', () => {
    render(<NavigationHeader sticky={true} />);
    
    const header = screen.getByRole('banner');
    expect(header).toHaveClass('sticky', 'top-0', 'z-50', 'shadow-sm');
  });

  it('shows border by default and hides when showBorder is false', () => {
    const { rerender } = render(<NavigationHeader />);
    
    let header = screen.getByRole('banner');
    expect(header).toHaveClass('border-b', 'border-gray-200');
    
    rerender(<NavigationHeader showBorder={false} />);
    
    header = screen.getByRole('banner');
    expect(header).not.toHaveClass('border-b', 'border-gray-200');
  });

  it('calls custom onBackClick handler', async () => {
    const mockOnBackClick = jest.fn();
    const user = userEvent.setup();
    
    render(<NavigationHeader onBackClick={mockOnBackClick} />);
    
    const backButton = screen.getByTestId('back-button');
    await user.click(backButton);
    
    expect(mockOnBackClick).toHaveBeenCalledTimes(1);
  });

  it('calls custom onConnectionStatusClick handler', async () => {
    const mockOnConnectionStatusClick = jest.fn();
    const user = userEvent.setup();
    
    render(<NavigationHeader onConnectionStatusClick={mockOnConnectionStatusClick} />);
    
    const statusBadge = screen.getByTestId('connection-status-badge');
    await user.click(statusBadge);
    
    expect(mockOnConnectionStatusClick).toHaveBeenCalledTimes(1);
  });

  it('passes correct props to BackButton', () => {
    render(
      <NavigationHeader 
        backButtonFallback="/custom-fallback"
        backButtonLabel="Go Back"
        compact={false}
      />
    );
    
    const backButton = screen.getByTestId('back-button');
    expect(backButton).toHaveTextContent('Go Back');
  });

  it('handles long titles with truncation', () => {
    const longTitle = 'This is a very long title that should be truncated when it exceeds the available space';
    
    render(<NavigationHeader title={longTitle} />);
    
    const title = screen.getByRole('heading', { name: longTitle });
    expect(title).toHaveClass('truncate');
  });

  it('handles long subtitles with truncation', () => {
    const longSubtitle = 'This is a very long subtitle that should be truncated when it exceeds the available space';
    
    render(
      <NavigationHeader 
        title="Title"
        subtitle={longSubtitle}
      />
    );
    
    const subtitle = screen.getByText(longSubtitle);
    expect(subtitle).toHaveClass('truncate');
  });

  describe('Layout and Responsive Behavior', () => {
    it('maintains proper layout structure', () => {
      render(
        <NavigationHeader 
          title="Test Title"
          subtitle="Test Subtitle"
        />
      );
      
      const header = screen.getByRole('banner');
      expect(header).toHaveClass('flex', 'items-center', 'justify-between');
      
      // Should have minimum height for touch targets
      expect(header).toHaveClass('min-h-[64px]');
    });

    it('provides proper spacing between elements', () => {
      render(
        <NavigationHeader 
          title="Test Title"
          subtitle="Test Subtitle"
        />
      );
      
      const header = screen.getByRole('banner');
      expect(header).toHaveClass('gap-3');
    });
  });

  describe('Accessibility', () => {
    it('uses proper semantic HTML structure', () => {
      render(
        <NavigationHeader title="Page Title" />
      );
      
      // Header should be a banner landmark
      expect(screen.getByRole('banner')).toBeInTheDocument();
      
      // Title should be a proper heading
      expect(screen.getByRole('heading', { name: 'Page Title' })).toBeInTheDocument();
    });

    it('provides proper heading hierarchy', () => {
      render(
        <NavigationHeader title="Main Title" />
      );
      
      const heading = screen.getByRole('heading', { name: 'Main Title' });
      expect(heading.tagName).toBe('H1');
    });
  });
});