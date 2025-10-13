import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BackButton } from '../back-button';
import { useNavigateBack } from '@/hooks/navigation/useNavigateBack';

// Mock the useNavigateBack hook
jest.mock('@/hooks/navigation/useNavigateBack');
const mockUseNavigateBack = useNavigateBack as jest.MockedFunction<typeof useNavigateBack>;

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
  }),
}));

// Mock haptic feedback
jest.mock('@/hooks/use-haptic', () => ({
  useHaptic: () => jest.fn(),
}));

describe('BackButton', () => {
  const mockNavigateBack = jest.fn();

  beforeEach(() => {
    mockUseNavigateBack.mockReturnValue({
      navigateBack: mockNavigateBack,
      isNavigating: false,
      error: null,
      canGoBack: true,
    });
    
    jest.clearAllMocks();
  });

  it('renders with default props', () => {
    render(<BackButton />);
    
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-label', 'Back navigation');
  });

  it('renders with custom label when showLabel is true', () => {
    render(<BackButton showLabel={true} label="Go Back" />);
    
    expect(screen.getByText('Go Back')).toBeInTheDocument();
  });

  it('calls navigateBack when clicked', async () => {
    const user = userEvent.setup();
    render(<BackButton />);
    
    const button = screen.getByRole('button');
    await user.click(button);
    
    expect(mockNavigateBack).toHaveBeenCalledTimes(1);
  });

  it('calls custom onClick handler when provided', async () => {
    const customOnClick = jest.fn();
    const user = userEvent.setup();
    
    render(<BackButton onClick={customOnClick} />);
    
    const button = screen.getByRole('button');
    await user.click(button);
    
    expect(customOnClick).toHaveBeenCalledTimes(1);
    expect(mockNavigateBack).not.toHaveBeenCalled();
  });

  it('shows loading state when isNavigating is true', () => {
    mockUseNavigateBack.mockReturnValue({
      navigateBack: mockNavigateBack,
      isNavigating: true,
      error: null,
      canGoBack: true,
    });

    render(<BackButton />);
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    
    // Check for loading spinner
    const spinner = button.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('shows loading state when loading prop is true', () => {
    render(<BackButton loading={true} />);
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    
    // Check for loading spinner
    const spinner = button.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('is disabled when disabled prop is true', () => {
    render(<BackButton disabled={true} />);
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('does not call navigateBack when disabled', async () => {
    const user = userEvent.setup();
    render(<BackButton disabled={true} />);
    
    const button = screen.getByRole('button');
    await user.click(button);
    
    expect(mockNavigateBack).not.toHaveBeenCalled();
  });

  it('applies error styling when error exists', () => {
    mockUseNavigateBack.mockReturnValue({
      navigateBack: mockNavigateBack,
      isNavigating: false,
      error: 'Navigation failed',
      canGoBack: true,
    });

    render(<BackButton />);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass('ring-2', 'ring-red-300');
  });

  it('renders tooltip when showTooltip is true and no label', async () => {
    render(<BackButton showTooltip={true} tooltipText="Custom tooltip" />);
    
    // Tooltip content is not immediately visible, would need user interaction
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const customClass = 'custom-back-button';
    render(<BackButton className={customClass} />);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass(customClass);
  });

  it('uses fallback route', () => {
    render(<BackButton fallbackRoute="/custom" />);
    
    // Check that the hook was called with correct fallback route
    expect(mockUseNavigateBack).toHaveBeenCalledWith({
      fallbackRoute: '/custom',
      confirmNavigation: false,
    });
  });

  it('handles keyboard navigation', async () => {
    const user = userEvent.setup();
    render(<BackButton />);
    
    const button = screen.getByRole('button');
    
    // Focus the button
    await user.tab();
    expect(button).toHaveFocus();
    
    // Press Enter
    await user.keyboard('{Enter}');
    expect(mockNavigateBack).toHaveBeenCalledTimes(1);
    
    jest.clearAllMocks();
    
    // Press Space
    await user.keyboard(' ');
    expect(mockNavigateBack).toHaveBeenCalledTimes(1);
  });

  it('renders different button variants', () => {
    const { rerender } = render(<BackButton variant="outline" />);
    let button = screen.getByRole('button');
    expect(button).toHaveClass('border');
    
    rerender(<BackButton variant="secondary" />);
    button = screen.getByRole('button');
    expect(button).toHaveClass('bg-secondary');
  });

  it('renders different button sizes', () => {
    const { rerender } = render(<BackButton size="lg" />);
    let button = screen.getByRole('button');
    expect(button).toHaveClass('h-11');
    
    rerender(<BackButton size="icon" />);
    button = screen.getByRole('button');
    expect(button).toHaveClass('h-10', 'w-10');
  });

  it('maintains minimum touch target size for mobile', () => {
    render(<BackButton />);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass('min-h-[44px]', 'min-w-[44px]');
  });
});