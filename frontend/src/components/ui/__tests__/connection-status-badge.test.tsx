import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConnectionStatusBadge } from '../connection-status-badge';
import { useConnectionStatus } from '@/hooks/navigation/useConnectionStatus';

// Mock the useConnectionStatus hook
jest.mock('@/hooks/navigation/useConnectionStatus');
const mockUseConnectionStatus = useConnectionStatus as jest.MockedFunction<typeof useConnectionStatus>;

// Mock icons from lucide-react
jest.mock('lucide-react', () => ({
  Wifi: ({ className }: { className: string }) => <div className={className} data-testid="wifi-icon" />,
  WifiOff: ({ className }: { className: string }) => <div className={className} data-testid="wifi-off-icon" />,
  AlertCircle: ({ className }: { className: string }) => <div className={className} data-testid="alert-circle-icon" />,
  RotateCcw: ({ className }: { className: string }) => <div className={className} data-testid="rotate-icon" />,
}));

describe('ConnectionStatusBadge', () => {
  const mockRetryConnection = jest.fn();

  const createMockStatus = (overall: 'healthy' | 'degraded' | 'disconnected', wsState = 'connected', mqttState = 'connected') => ({
    status: {
      overall,
      websocket: {
        state: wsState,
        lastConnected: Date.now(),
        reconnectAttempts: 0,
      },
      mqtt: {
        state: mqttState,
        lastUpdate: Date.now(),
      },
    },
    isOnline: overall === 'healthy' || overall === 'degraded',
    retryConnection: mockRetryConnection,
    lastError: null,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Connection Status Display', () => {
    it('renders healthy connection status', () => {
      mockUseConnectionStatus.mockReturnValue(createMockStatus('healthy'));
      
      render(<ConnectionStatusBadge />);
      
      expect(screen.getByText('Connected')).toBeInTheDocument();
      expect(screen.getByTestId('wifi-icon')).toBeInTheDocument();
    });

    it('renders degraded connection status', () => {
      mockUseConnectionStatus.mockReturnValue(createMockStatus('degraded', 'connected', 'disconnected'));
      
      render(<ConnectionStatusBadge />);
      
      expect(screen.getByText('Degraded')).toBeInTheDocument();
      expect(screen.getByTestId('alert-circle-icon')).toBeInTheDocument();
    });

    it('renders disconnected status', () => {
      mockUseConnectionStatus.mockReturnValue(createMockStatus('disconnected', 'disconnected', 'disconnected'));
      
      render(<ConnectionStatusBadge />);
      
      expect(screen.getByText('Offline')).toBeInTheDocument();
      expect(screen.getByTestId('wifi-off-icon')).toBeInTheDocument();
    });
  });

  describe('Detailed Status', () => {
    it('shows detailed status when enabled', () => {
      mockUseConnectionStatus.mockReturnValue(createMockStatus('healthy'));
      
      render(<ConnectionStatusBadge showDetailedStatus={true} />);
      
      expect(screen.getByText('All systems online')).toBeInTheDocument();
    });

    it('shows WebSocket and MQTT states in detailed mode', () => {
      mockUseConnectionStatus.mockReturnValue(createMockStatus('degraded', 'connected', 'disconnected'));
      
      render(<ConnectionStatusBadge showDetailedStatus={true} />);
      
      expect(screen.getByText('WebSocket OK, MQTT disconnected')).toBeInTheDocument();
    });

    it('shows connecting state in detailed mode', () => {
      mockUseConnectionStatus.mockReturnValue(createMockStatus('disconnected', 'connecting', 'disconnected'));
      
      render(<ConnectionStatusBadge showDetailedStatus={true} />);
      
      expect(screen.getByText('Connecting...')).toBeInTheDocument();
    });
  });

  describe('Compact Mode', () => {
    it('renders in compact mode without text', () => {
      mockUseConnectionStatus.mockReturnValue(createMockStatus('healthy'));
      
      render(<ConnectionStatusBadge compact={true} />);
      
      expect(screen.getByTestId('wifi-icon')).toBeInTheDocument();
      expect(screen.queryByText('Connected')).not.toBeInTheDocument();
    });
  });

  describe('Retry Button', () => {
    it('shows retry button when connection is offline', () => {
      mockUseConnectionStatus.mockReturnValue(createMockStatus('disconnected', 'disconnected', 'disconnected'));
      
      render(<ConnectionStatusBadge />);
      
      const retryButton = screen.getByLabelText('Retry connection');
      expect(retryButton).toBeInTheDocument();
      expect(screen.getByTestId('rotate-icon')).toBeInTheDocument();
    });

    it('does not show retry button when connection is healthy', () => {
      mockUseConnectionStatus.mockReturnValue(createMockStatus('healthy'));
      
      render(<ConnectionStatusBadge />);
      
      expect(screen.queryByLabelText('Retry connection')).not.toBeInTheDocument();
    });

    it('hides retry button when showRetryButton is false', () => {
      mockUseConnectionStatus.mockReturnValue(createMockStatus('disconnected', 'disconnected', 'disconnected'));
      
      render(<ConnectionStatusBadge showRetryButton={false} />);
      
      expect(screen.queryByLabelText('Retry connection')).not.toBeInTheDocument();
    });

    it('calls retryConnection when retry button is clicked', async () => {
      const user = userEvent.setup();
      mockUseConnectionStatus.mockReturnValue(createMockStatus('disconnected', 'disconnected', 'disconnected'));
      
      render(<ConnectionStatusBadge />);
      
      const retryButton = screen.getByLabelText('Retry connection');
      await user.click(retryButton);
      
      expect(mockRetryConnection).toHaveBeenCalledTimes(1);
    });

    it('shows spinning icon when connecting', () => {
      mockUseConnectionStatus.mockReturnValue(createMockStatus('disconnected', 'connecting', 'disconnected'));
      
      render(<ConnectionStatusBadge />);
      
      const retryButton = screen.getByLabelText('Retry connection');
      const rotateIcon = screen.getByTestId('rotate-icon');
      
      expect(retryButton).toBeDisabled();
      expect(rotateIcon).toHaveClass('animate-spin');
    });
  });

  describe('Error Handling', () => {
    it('displays error message in status', () => {
      const mockStatusWithError = {
        ...createMockStatus('disconnected', 'error', 'disconnected'),
        lastError: 'Connection timeout',
      };
      mockUseConnectionStatus.mockReturnValue(mockStatusWithError);
      
      render(<ConnectionStatusBadge />);
      
      // Error should be shown in tooltip or description
      expect(screen.getByText('Offline')).toBeInTheDocument();
    });
  });

  describe('Custom Handlers', () => {
    it('calls custom onClick handler when badge is clicked', async () => {
      const mockOnClick = jest.fn();
      const user = userEvent.setup();
      mockUseConnectionStatus.mockReturnValue(createMockStatus('healthy'));
      
      render(<ConnectionStatusBadge onClick={mockOnClick} />);
      
      const badge = screen.getByText('Connected');
      await user.click(badge);
      
      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('prevents badge click when retry button is clicked', async () => {
      const mockOnClick = jest.fn();
      const user = userEvent.setup();
      mockUseConnectionStatus.mockReturnValue(createMockStatus('disconnected', 'disconnected', 'disconnected'));
      
      render(<ConnectionStatusBadge onClick={mockOnClick} />);
      
      const retryButton = screen.getByLabelText('Retry connection');
      await user.click(retryButton);
      
      expect(mockOnClick).not.toHaveBeenCalled();
      expect(mockRetryConnection).toHaveBeenCalledTimes(1);
    });
  });

  describe('Styling and Accessibility', () => {
    it('applies custom className', () => {
      mockUseConnectionStatus.mockReturnValue(createMockStatus('healthy'));
      
      render(<ConnectionStatusBadge className="custom-class" />);
      
      const badge = screen.getByText('Connected').closest('[class*="custom-class"]');
      expect(badge).toHaveClass('custom-class');
    });

    it('has proper ARIA labels for retry button', () => {
      mockUseConnectionStatus.mockReturnValue(createMockStatus('disconnected', 'disconnected', 'disconnected'));
      
      render(<ConnectionStatusBadge />);
      
      const retryButton = screen.getByLabelText('Retry connection');
      expect(retryButton).toBeInTheDocument();
    });
  });

  describe('Badge Variants', () => {
    it('applies correct badge variant for healthy status', () => {
      mockUseConnectionStatus.mockReturnValue(createMockStatus('healthy'));
      
      render(<ConnectionStatusBadge />);
      
      const badge = screen.getByText('Connected');
      expect(badge).toHaveClass('bg-green-50', 'border-green-200');
    });

    it('applies correct badge variant for degraded status', () => {
      mockUseConnectionStatus.mockReturnValue(createMockStatus('degraded', 'connected', 'disconnected'));
      
      render(<ConnectionStatusBadge />);
      
      const badge = screen.getByText('Degraded');
      expect(badge).toHaveClass('bg-yellow-50', 'border-yellow-200');
    });

    it('applies correct badge variant for offline status', () => {
      mockUseConnectionStatus.mockReturnValue(createMockStatus('disconnected', 'disconnected', 'disconnected'));
      
      render(<ConnectionStatusBadge />);
      
      const badge = screen.getByText('Offline');
      expect(badge).toHaveClass('bg-red-50', 'border-red-200');
    });
  });
});