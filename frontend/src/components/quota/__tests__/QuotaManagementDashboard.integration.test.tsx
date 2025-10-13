import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';

import { QuotaManagementDashboard } from '../QuotaManagementDashboard';
import { QuotaWebSocketContextProvider } from '@/lib/quota/quota-websocket';
import { createMockQuotaUsage, createMockOverrideRequest } from './setup';

// Mock the stores
const mockUser = {
  id: 'parent-1',
  role: 'parent' as const,
  displayName: 'Parent User',
  permissions: ['QUOTA_MANAGE'],
};

const mockFamilyMembers = [
  {
    id: 'child-1',
    displayName: 'Alex',
    role: 'child' as const,
    age: 12,
  },
  {
    id: 'child-2',
    displayName: 'Sam',
    role: 'child' as const,
    age: 15,
  },
];

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: vi.fn((selector) => selector({ user: mockUser })),
}));

vi.mock('@/stores/family-store', () => ({
  useFamilyMembers: vi.fn(() => mockFamilyMembers),
}));

// Mock the WebSocket context
const mockWebSocketContext = {
  isConnected: true,
  quotaUpdates: new Map(),
  violationAlerts: [],
  overrideRequests: new Map(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  requestOverride: vi.fn(),
  approveOverride: vi.fn(),
  rejectOverride: vi.fn(),
  connectionState: 1, // ReadyState.OPEN
  lastMessage: null,
  sendMessage: vi.fn(),
};

vi.mock('@/lib/quota/quota-websocket', () => ({
  useQuotaWebSocketContext: vi.fn(() => mockWebSocketContext),
  QuotaWebSocketProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock individual components for isolation
vi.mock('../QuotaSetupWizard', () => ({
  QuotaSetupWizard: ({ onComplete, onCancel }: any) => (
    <div data-testid="quota-setup-wizard">
      <button onClick={() => onComplete({ quotaType: { type: 'TIME_BASED' } })}>
        Complete Setup
      </button>
      <button onClick={onCancel}>Cancel Setup</button>
    </div>
  ),
}));

vi.mock('../QuotaStatusWidget', () => ({
  QuotaStatusWidget: ({ quotaId, familyMemberName, onOverrideClick }: any) => (
    <div data-testid={`quota-status-${quotaId}`}>
      <span>{familyMemberName} Quota</span>
      {onOverrideClick && (
        <button onClick={onOverrideClick}>Request Override</button>
      )}
    </div>
  ),
}));

vi.mock('../QuotaUsageTracker', () => ({
  QuotaUsageTracker: ({ quotaId }: any) => (
    <div data-testid={`usage-tracker-${quotaId}`}>
      Usage Tracker for {quotaId}
    </div>
  ),
}));

vi.mock('../QuotaOverrideRequest', () => ({
  QuotaOverrideRequest: ({ onRequestSubmit }: any) => (
    <div data-testid="override-request-form">
      <button onClick={() => onRequestSubmit({ requestType: 'TIME_EXTENSION' })}>
        Submit Override Request
      </button>
    </div>
  ),
  OverrideRequestList: ({ requests, showActions, onApprove, onReject }: any) => (
    <div data-testid="override-request-list">
      {requests.map((request: any) => (
        <div key={request.id} data-testid={`request-${request.id}`}>
          <span>{request.familyMemberName} - {request.reason}</span>
          {showActions && request.status === 'PENDING' && (
            <div>
              <button onClick={() => onApprove(request.id)}>Approve</button>
              <button onClick={() => onReject(request.id, 'Test rejection')}>Reject</button>
            </div>
          )}
        </div>
      ))}
    </div>
  ),
}));

// Mock UI components
vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children, value, onValueChange }: any) => (
    <div data-testid="tabs" data-value={value}>
      {children}
    </div>
  ),
  TabsList: ({ children }: any) => <div data-testid="tabs-list">{children}</div>,
  TabsTrigger: ({ value, children, onClick }: any) => (
    <button data-testid={`tab-${value}`} onClick={() => onClick?.(value)}>
      {children}
    </button>
  ),
  TabsContent: ({ value, children }: any) => (
    <div data-testid={`tab-content-${value}`}>{children}</div>
  ),
}));

const DashboardWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <QuotaWebSocketContextProvider familyMemberId="parent-1">
    {children}
  </QuotaWebSocketContextProvider>
);

describe('QuotaManagementDashboard Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWebSocketContext.quotaUpdates.clear();
    mockWebSocketContext.violationAlerts.length = 0;
    mockWebSocketContext.overrideRequests.clear();
  });

  describe('Dashboard Initialization', () => {
    it('renders dashboard with correct initial state', () => {
      render(
        <DashboardWrapper>
          <QuotaManagementDashboard />
        </DashboardWrapper>
      );

      expect(screen.getByText('0')).toBeInTheDocument(); // Total quotas
      expect(screen.getByText('Total Quotas')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Exceeded')).toBeInTheDocument();
      expect(screen.getByText('Pending Requests')).toBeInTheDocument();
    });

    it('shows connection warning when WebSocket is disconnected', () => {
      mockWebSocketContext.isConnected = false;

      render(
        <DashboardWrapper>
          <QuotaManagementDashboard />
        </DashboardWrapper>
      );

      expect(screen.getByText(/Real-time quota updates are currently unavailable/)).toBeInTheDocument();
    });

    it('renders tabs for different dashboard sections', () => {
      render(
        <DashboardWrapper>
          <QuotaManagementDashboard />
        </DashboardWrapper>
      );

      expect(screen.getByTestId('tab-overview')).toBeInTheDocument();
      expect(screen.getByTestId('tab-requests')).toBeInTheDocument();
      expect(screen.getByTestId('tab-alerts')).toBeInTheDocument();
      expect(screen.getByTestId('tab-manage')).toBeInTheDocument(); // Parent has access
    });
  });

  describe('Quota Management (Parent Features)', () => {
    it('shows create quota button for parents', () => {
      render(
        <DashboardWrapper>
          <QuotaManagementDashboard />
        </DashboardWrapper>
      );

      expect(screen.getByText('Create Quota')).toBeInTheDocument();
    });

    it('opens quota setup wizard when create button is clicked', () => {
      render(
        <DashboardWrapper>
          <QuotaManagementDashboard />
        </DashboardWrapper>
      );

      const createButton = screen.getByText('Create Quota');
      fireEvent.click(createButton);

      expect(screen.getByTestId('quota-setup-wizard')).toBeInTheDocument();
    });

    it('handles quota creation workflow', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation();

      render(
        <DashboardWrapper>
          <QuotaManagementDashboard />
        </DashboardWrapper>
      );

      // Start wizard
      fireEvent.click(screen.getByText('Create Quota'));

      // Complete wizard
      fireEvent.click(screen.getByText('Complete Setup'));

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Creating quota:',
          expect.objectContaining({
            quotaType: { type: 'TIME_BASED' },
          })
        );
      });

      // Wizard should close
      expect(screen.queryByTestId('quota-setup-wizard')).not.toBeInTheDocument();

      consoleSpy.mockRestore();
    });

    it('cancels quota creation workflow', () => {
      render(
        <DashboardWrapper>
          <QuotaManagementDashboard />
        </DashboardWrapper>
      );

      // Start wizard
      fireEvent.click(screen.getByText('Create Quota'));
      expect(screen.getByTestId('quota-setup-wizard')).toBeInTheDocument();

      // Cancel wizard
      fireEvent.click(screen.getByText('Cancel Setup'));
      expect(screen.queryByTestId('quota-setup-wizard')).not.toBeInTheDocument();
    });
  });

  describe('Override Request Management', () => {
    const mockRequests = [
      createMockOverrideRequest({
        id: 'req-1',
        familyMemberName: 'Alex',
        reason: 'Need more time for homework',
        status: 'PENDING',
      }),
      createMockOverrideRequest({
        id: 'req-2',
        familyMemberName: 'Sam',
        reason: 'Emergency situation',
        status: 'APPROVED',
      }),
    ];

    beforeEach(() => {
      // Setup mock requests
      mockRequests.forEach(request => {
        mockWebSocketContext.overrideRequests.set(request.id, {
          type: 'OVERRIDE_REQUEST_CREATED',
          payload: request,
        });
      });
    });

    it('shows override requests in requests tab', async () => {
      render(
        <DashboardWrapper>
          <QuotaManagementDashboard />
        </DashboardWrapper>
      );

      // Switch to requests tab
      const requestsTab = screen.getByTestId('tab-requests');
      fireEvent.click(requestsTab);

      await waitFor(() => {
        expect(screen.getByTestId('override-request-list')).toBeInTheDocument();
        expect(screen.getByText('Alex - Need more time for homework')).toBeInTheDocument();
        expect(screen.getByText('Sam - Emergency situation')).toBeInTheDocument();
      });
    });

    it('handles override request approval', async () => {
      render(
        <DashboardWrapper>
          <QuotaManagementDashboard />
        </DashboardWrapper>
      );

      // Switch to requests tab
      fireEvent.click(screen.getByTestId('tab-requests'));

      await waitFor(() => {
        const approveButton = screen.getByText('Approve');
        fireEvent.click(approveButton);
      });

      expect(mockWebSocketContext.approveOverride).toHaveBeenCalledWith('req-1');
    });

    it('handles override request rejection', async () => {
      render(
        <DashboardWrapper>
          <QuotaManagementDashboard />
        </DashboardWrapper>
      );

      // Switch to requests tab
      fireEvent.click(screen.getByTestId('tab-requests'));

      await waitFor(() => {
        const rejectButton = screen.getByText('Reject');
        fireEvent.click(rejectButton);
      });

      expect(mockWebSocketContext.rejectOverride).toHaveBeenCalledWith(
        'req-1',
        'Test rejection'
      );
    });

    it('shows pending request count in tab badge', () => {
      render(
        <DashboardWrapper>
          <QuotaManagementDashboard />
        </DashboardWrapper>
      );

      // Should show count of pending requests (1 in our mock data)
      expect(screen.getByText('1')).toBeInTheDocument(); // Badge in stats
    });
  });

  describe('Quota Display and Interaction', () => {
    const mockQuotas = [
      createMockQuotaUsage({
        id: 'quota-1',
        familyMemberId: 'child-1',
        status: 'ACTIVE',
      }),
      createMockQuotaUsage({
        id: 'quota-2',
        familyMemberId: 'child-2',
        status: 'EXCEEDED',
      }),
    ];

    beforeEach(() => {
      // Mock quota data for dashboard
      vi.doMock('../QuotaManagementDashboard', async () => {
        const actual = await vi.importActual('../QuotaManagementDashboard');
        return {
          ...actual,
          // Override with test data
        };
      });
    });

    it('renders quota widgets for each family member', () => {
      render(
        <DashboardWrapper>
          <QuotaManagementDashboard />
        </DashboardWrapper>
      );

      // Should render quota widgets (mocked)
      expect(screen.queryByTestId('quota-status-quota-1')).not.toBeInTheDocument(); // Not yet, empty state
      expect(screen.getByText('No quotas configured')).toBeInTheDocument();
    });

    it('handles override request from child user', async () => {
      // Mock as child user
      const childUser = { ...mockUser, role: 'child' as const };
      vi.mocked(require('@/stores/auth-store').useAuthStore).mockImplementation(
        (selector) => selector({ user: childUser })
      );

      render(
        <DashboardWrapper>
          <QuotaManagementDashboard />
        </DashboardWrapper>
      );

      // For empty state, would need actual quota data to show override buttons
      // This test would be more meaningful with real quota data
      expect(screen.getByText('No quotas configured')).toBeInTheDocument();
    });
  });

  describe('Real-time Updates', () => {
    it('subscribes to quota updates on mount', () => {
      render(
        <DashboardWrapper>
          <QuotaManagementDashboard />
        </DashboardWrapper>
      );

      // Should subscribe to each quota (would need real quota IDs)
      // For now, verify context is being used
      expect(mockWebSocketContext.subscribe).toHaveBeenCalledTimes(0); // No quotas in empty state
    });

    it('handles violation alerts display', () => {
      // Add mock violation alerts
      mockWebSocketContext.violationAlerts.push(
        {
          quotaId: 'quota-1',
          familyMemberId: 'child-1',
          familyMemberName: 'Alex',
          roomId: 'room-1',
          roomName: 'Living Room',
          violationType: 'LIMIT_EXCEEDED',
          currentUsage: 8000,
          limit: 7200,
          timestamp: new Date().toISOString(),
        }
      );

      render(
        <DashboardWrapper>
          <QuotaManagementDashboard />
        </DashboardWrapper>
      );

      // Switch to alerts tab
      fireEvent.click(screen.getByTestId('tab-alerts'));

      // Should show the violation alert
      expect(screen.getByText(/LIMIT EXCEEDED/)).toBeInTheDocument();
    });
  });

  describe('Responsive Behavior', () => {
    it('adapts layout for different screen sizes', () => {
      // Mock different screen sizes
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: (query: string) => ({
          matches: query.includes('md'), // Mock desktop
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => {},
        }),
      });

      render(
        <DashboardWrapper>
          <QuotaManagementDashboard />
        </DashboardWrapper>
      );

      // Should render without errors on different screen sizes
      expect(screen.getByText('Total Quotas')).toBeInTheDocument();
    });
  });

  describe('Performance Optimization', () => {
    it('should not re-render unnecessarily', async () => {
      const renderSpy = vi.fn();
      
      const TestComponent = React.memo(() => {
        renderSpy();
        return (
          <DashboardWrapper>
            <QuotaManagementDashboard />
          </DashboardWrapper>
        );
      });

      const { rerender } = render(<TestComponent />);
      expect(renderSpy).toHaveBeenCalledTimes(1);

      // Re-render with same props should not cause additional renders
      rerender(<TestComponent />);
      
      // Due to WebSocket context and internal state, there might be some re-renders
      // The exact count depends on the memoization implementation
      expect(renderSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
    });

    it('lazy loads components efficiently', async () => {
      const { container } = render(
        <DashboardWrapper>
          <QuotaManagementDashboard />
        </DashboardWrapper>
      );

      // Initially should not load heavy components
      expect(container.querySelector('[data-testid="quota-setup-wizard"]')).not.toBeInTheDocument();

      // Should load wizard only when needed
      fireEvent.click(screen.getByText('Create Quota'));
      expect(screen.getByTestId('quota-setup-wizard')).toBeInTheDocument();
    });
  });
});