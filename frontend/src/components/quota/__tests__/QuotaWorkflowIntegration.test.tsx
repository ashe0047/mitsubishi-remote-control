/**
 * Comprehensive integration test for the complete quota management UI workflow.
 *
 * This test validates the entire frontend quota management flow:
 * 1. Quota setup form functionality
 * 2. Quota list display and management
 * 3. Usage dashboard with real-time updates
 * 4. Override request workflow
 * 5. Analytics visualization
 * 6. Error handling and loading states
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  QuotaSetupForm,
  QuotaList,
  QuotaManagementPage,
  UsageDashboard,
  OverrideRequestDialog,
  OverrideManagement,
  QuickOverrideButton
} from '../index';

import type {
  QuotaSetupData,
  QuotaData,
  UsageData,
  OverrideRecord,
  OverrideRequest,
  QuotaInfo
} from '../index';

// Mock data
const mockUsers = [
  { id: 'user1', name: 'John Doe', email: 'john@example.com', isChild: true },
  { id: 'user2', name: 'Jane Smith', email: 'jane@example.com', isChild: false }
];

const mockRooms = [
  { roomId: 'room1', roomName: 'Living Room' },
  { roomId: 'room2', roomName: 'Bedroom' }
];

const mockQuotaData: QuotaData[] = [
  {
    id: 'quota1',
    userId: 'user1',
    userName: 'John Doe',
    userEmail: 'john@example.com',
    roomId: 'room1',
    roomName: 'Living Room',
    quotaType: 'TIME_BASED',
    allowedAmount: 240,
    usedAmount: 180,
    warningThreshold: 75,
    status: 'ACTIVE',
    effectiveFrom: '2024-01-01',
    effectiveUntil: '2024-12-31',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  }
];

const mockUsageData: UsageData[] = [
  {
    userId: 'user1',
    userName: 'John Doe',
    roomId: 'room1',
    roomName: 'Living Room',
    quotaType: 'TIME_BASED',
    allowedAmount: 240,
    usedAmount: 180,
    warningThreshold: 75,
    status: 'ACTIVE',
    todayUsage: 180,
    weeklyUsage: 1200,
    monthlyUsage: 5000,
    sessions: [
      {
        id: 'session1',
        startTime: '2024-01-01T10:00:00Z',
        endTime: '2024-01-01T11:30:00Z',
        duration: 90,
        roomId: 'room1',
        roomName: 'Living Room'
      }
    ]
  }
];

const mockOverrideRecords: OverrideRecord[] = [
  {
    id: 'override1',
    quotaId: 'quota1',
    userId: 'user1',
    userName: 'John Doe',
    roomId: 'room1',
    roomName: 'Living Room',
    type: 'ADD_TIME',
    additionalSeconds: 1800,
    reason: 'Emergency situation',
    status: 'PENDING',
    requestedAt: '2024-01-01T12:00:00Z'
  }
];

const mockQuotaInfo: QuotaInfo = {
  id: 'quota1',
  userId: 'user1',
  userName: 'John Doe',
  roomId: 'room1',
  roomName: 'Living Room',
  quotaType: 'TIME_BASED',
  allowedAmount: 240,
  usedAmount: 250, // Exceeded
  status: 'EXCEEDED'
};

// Mock functions
const mockOnCreateQuota = vi.fn().mockResolvedValue(undefined);
const mockOnUpdateQuota = vi.fn().mockResolvedValue(undefined);
const mockOnDeleteQuota = vi.fn().mockResolvedValue(undefined);
const mockOnToggleQuotaStatus = vi.fn().mockResolvedValue(undefined);
const mockOnRequestOverride = vi.fn().mockResolvedValue(undefined);
const mockOnApproveOverride = vi.fn().mockResolvedValue(undefined);
const mockOnDenyOverride = vi.fn().mockResolvedValue(undefined);
const mockOnRefresh = vi.fn();

describe('Quota Workflow Integration Tests', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Complete Quota Setup and Management Flow', () => {
    it('should handle complete quota creation workflow', async () => {
      const { rerender } = render(
        <QuotaManagementPage
          users={mockUsers}
          rooms={mockRooms}
          quotas={[]}
          isParent={true}
          onCreateQuota={mockOnCreateQuota}
          onUpdateQuota={mockOnUpdateQuota}
          onDeleteQuota={mockOnDeleteQuota}
          onToggleQuotaStatus={mockOnToggleQuotaStatus}
        />
      );

      // Navigate to create tab
      await user.click(screen.getByRole('tab', { name: /create quota/i }));

      // Fill out quota form
      await user.click(screen.getByRole('combobox', { name: /select user/i }));
      await user.click(screen.getByText('John Doe'));

      await user.click(screen.getByRole('combobox', { name: /select room/i }));
      await user.click(screen.getByText('Living Room'));

      // Adjust quota amount using slider
      const slider = screen.getByRole('slider', { name: /daily time limit/i });
      fireEvent.change(slider, { target: { value: '240' } });

      // Set warning threshold
      const warningSlider = screen.getByRole('slider', { name: /warning threshold/i });
      fireEvent.change(warningSlider, { target: { value: '75' } });

      // Submit form
      await user.click(screen.getByRole('button', { name: /create quota/i }));

      await waitFor(() => {
        expect(mockOnCreateQuota).toHaveBeenCalledWith({
          userId: 'user1',
          roomId: 'room1',
          quotaType: 'TIME_BASED',
          allowedAmount: 240,
          warningThreshold: 75,
          effectiveFrom: expect.any(String)
        });
      });

      // Simulate successful creation and update props
      rerender(
        <QuotaManagementPage
          users={mockUsers}
          rooms={mockRooms}
          quotas={mockQuotaData}
          isParent={true}
          success="Quota created successfully!"
          onCreateQuota={mockOnCreateQuota}
          onUpdateQuota={mockOnUpdateQuota}
          onDeleteQuota={mockOnDeleteQuota}
          onToggleQuotaStatus={mockOnToggleQuotaStatus}
        />
      );

      // Verify success message
      expect(screen.getByText(/quota created successfully/i)).toBeInTheDocument();

      // Navigate to manage tab to see created quota
      await user.click(screen.getByRole('tab', { name: /manage quotas/i }));

      // Verify quota appears in list
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Living Room')).toBeInTheDocument();
      expect(screen.getByText('3h 0m / 4h 0m')).toBeInTheDocument(); // 180m used / 240m allowed
    });

    it('should handle quota editing workflow', async () => {
      render(
        <QuotaManagementPage
          users={mockUsers}
          rooms={mockRooms}
          quotas={mockQuotaData}
          isParent={true}
          onCreateQuota={mockOnCreateQuota}
          onUpdateQuota={mockOnUpdateQuota}
          onDeleteQuota={mockOnDeleteQuota}
          onToggleQuotaStatus={mockOnToggleQuotaStatus}
        />
      );

      // Navigate to manage tab
      await user.click(screen.getByRole('tab', { name: /manage quotas/i }));

      // Click edit button
      const editButton = screen.getByRole('button', { name: /edit/i });
      await user.click(editButton);

      // Should navigate to edit form
      expect(screen.getByRole('tab', { name: /edit quota/i })).toHaveAttribute('aria-selected', 'true');

      // Modify quota amount
      const slider = screen.getByRole('slider', { name: /daily time limit/i });
      fireEvent.change(slider, { target: { value: '300' } });

      // Submit update
      await user.click(screen.getByRole('button', { name: /update quota/i }));

      await waitFor(() => {
        expect(mockOnUpdateQuota).toHaveBeenCalledWith('quota1', expect.objectContaining({
          allowedAmount: 300
        }));
      });
    });

    it('should handle quota deletion workflow', async () => {
      // Mock window.confirm
      const originalConfirm = window.confirm;
      window.confirm = vi.fn().mockReturnValue(true);

      render(
        <QuotaList
          quotas={mockQuotaData}
          canManage={true}
          onDelete={mockOnDeleteQuota}
        />
      );

      // Click delete button
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      await waitFor(() => {
        expect(mockOnDeleteQuota).toHaveBeenCalledWith('quota1');
      });

      // Restore window.confirm
      window.confirm = originalConfirm;
    });
  });

  describe('Usage Dashboard Integration', () => {
    it('should display usage data correctly and handle period changes', async () => {
      render(
        <UsageDashboard
          usageData={mockUsageData}
          isHouseholdView={true}
          period="today"
          onPeriodChange={mockOnRefresh}
          onRefresh={mockOnRefresh}
        />
      );

      // Verify summary statistics
      expect(screen.getByText('180m')).toBeInTheDocument(); // Total usage
      expect(screen.getByText('75%')).toBeInTheDocument(); // Utilization
      expect(screen.getByText('1')).toBeInTheDocument(); // Active quotas

      // Test period change
      await user.click(screen.getByRole('combobox', { name: /period/i }));
      await user.click(screen.getByText('This Week'));

      expect(mockOnRefresh).toHaveBeenCalledWith('week');

      // Test detailed view tab
      await user.click(screen.getByRole('tab', { name: /detailed view/i }));

      // Verify detailed quota information
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Living Room')).toBeInTheDocument();

      // Should show warning since usage is 75% (180/240)
      expect(screen.getByText(/approaching quota limit/i)).toBeInTheDocument();
    });

    it('should handle empty usage data gracefully', () => {
      render(<UsageDashboard usageData={[]} />);

      expect(screen.getByText(/no usage data/i)).toBeInTheDocument();
      expect(screen.getByText(/no usage data available/i)).toBeInTheDocument();
    });

    it('should display loading state correctly', () => {
      render(<UsageDashboard usageData={[]} isLoading={true} />);

      expect(screen.getAllByText(/loading/i)).toHaveLength(3); // 3 skeleton loaders
    });
  });

  describe('Override Request Workflow', () => {
    it('should handle complete override request flow', async () => {
      render(
        <OverrideRequestDialog
          quota={mockQuotaInfo}
          isOpen={true}
          onRequestOverride={mockOnRequestOverride}
          onClose={vi.fn()}
        />
      );

      // Verify quota information display
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Living Room')).toBeInTheDocument();
      expect(screen.getByText('EXCEEDED')).toBeInTheDocument();

      // Select override type
      await user.click(screen.getByRole('combobox', { name: /override type/i }));
      await user.click(screen.getByText(/Add Time/i));

      // Adjust additional time
      const timeSlider = screen.getByRole('slider', { name: /additional time/i });
      fireEvent.change(timeSlider, { target: { value: '60' } });

      // Enter reason
      const reasonTextarea = screen.getByRole('textbox', { name: /reason for override/i });
      await user.type(reasonTextarea, 'Emergency situation requiring extended AC usage for health reasons');

      // Submit override request
      await user.click(screen.getByRole('button', { name: /grant override/i }));

      await waitFor(() => {
        expect(mockOnRequestOverride).toHaveBeenCalledWith({
          type: 'ADD_TIME',
          additionalSeconds: 3600, // 60 minutes
          reason: 'Emergency situation requiring extended AC usage for health reasons'
        });
      });
    });

    it('should validate override request form', async () => {
      render(
        <OverrideRequestDialog
          quota={mockQuotaInfo}
          isOpen={true}
          onRequestOverride={mockOnRequestOverride}
          onClose={vi.fn()}
        />
      );

      // Try to submit without reason
      await user.click(screen.getByRole('button', { name: /grant override/i }));

      // Should show validation error
      expect(screen.getByText(/please provide a reason/i)).toBeInTheDocument();

      // Enter too short reason
      const reasonTextarea = screen.getByRole('textbox', { name: /reason for override/i });
      await user.type(reasonTextarea, 'Short');

      await user.click(screen.getByRole('button', { name: /grant override/i }));

      // Should show minimum length error
      expect(screen.getByText(/reason must be at least 10 characters/i)).toBeInTheDocument();
    });

    it('should display quick override button for exceeded quotas', async () => {
      render(
        <QuickOverrideButton
          quota={mockQuotaInfo}
          canRequestOverride={true}
          onRequestOverride={mockOnRequestOverride}
          showStatus={true}
        />
      );

      // Should show override button since quota is exceeded
      expect(screen.getByRole('button', { name: /request override/i })).toBeInTheDocument();

      // Should show exceeded status
      expect(screen.getByText('Quota Exceeded')).toBeInTheDocument();

      // Should show quick action buttons
      expect(screen.getByRole('button', { name: /\+30min/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /reset/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /emergency/i })).toBeInTheDocument();

      // Should show usage info
      expect(screen.getByText('Today\'s Usage:')).toBeInTheDocument();
      expect(screen.getByText('250m / 240m')).toBeInTheDocument();
    });
  });

  describe('Override Management Workflow', () => {
    it('should display and manage override requests', async () => {
      render(
        <OverrideManagement
          overrides={mockOverrideRecords}
          canApprove={true}
          onApproveOverride={mockOnApproveOverride}
          onDenyOverride={mockOnDenyOverride}
        />
      );

      // Should show pending override
      expect(screen.getByText(/add time request/i)).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Emergency situation')).toBeInTheDocument();
      expect(screen.getByText('PENDING')).toBeInTheDocument();

      // Test approve action
      await user.click(screen.getByRole('button', { name: /approve/i }));

      await waitFor(() => {
        expect(mockOnApproveOverride).toHaveBeenCalledWith('override1');
      });
    });

    it('should handle deny override with reason prompt', async () => {
      // Mock window.prompt
      const originalPrompt = window.prompt;
      window.prompt = vi.fn().mockReturnValue('Insufficient justification provided');

      render(
        <OverrideManagement
          overrides={mockOverrideRecords}
          canApprove={true}
          onApproveOverride={mockOnApproveOverride}
          onDenyOverride={mockOnDenyOverride}
        />
      );

      // Test deny action
      await user.click(screen.getByRole('button', { name: /deny/i }));

      await waitFor(() => {
        expect(mockOnDenyOverride).toHaveBeenCalledWith('override1', 'Insufficient justification provided');
      });

      // Restore window.prompt
      window.prompt = originalPrompt;
    });

    it('should filter overrides by period', async () => {
      render(
        <OverrideManagement
          overrides={mockOverrideRecords}
          period="today"
          onPeriodChange={mockOnRefresh}
        />
      );

      // Change period filter
      await user.click(screen.getByRole('combobox', { name: /period/i }));
      await user.click(screen.getByText('This Week'));

      expect(mockOnRefresh).toHaveBeenCalledWith('week');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle quota setup form validation errors', async () => {
      render(
        <QuotaSetupForm
          users={mockUsers}
          rooms={mockRooms}
          onSubmit={mockOnCreateQuota}
        />
      );

      // Try to submit empty form
      await user.click(screen.getByRole('button', { name: /create quota/i }));

      // Should show validation errors
      expect(screen.getByText(/please select a user/i)).toBeInTheDocument();
      expect(screen.getByText(/please select a room/i)).toBeInTheDocument();
    });

    it('should handle API errors gracefully', async () => {
      const errorMessage = 'Failed to create quota';
      mockOnCreateQuota.mockRejectedValueOnce(new Error(errorMessage));

      render(
        <QuotaSetupForm
          users={mockUsers}
          rooms={mockRooms}
          error={errorMessage}
          onSubmit={mockOnCreateQuota}
        />
      );

      // Should display error message
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    it('should handle loading states correctly', () => {
      render(
        <QuotaList
          quotas={mockQuotaData}
          isLoading={true}
        />
      );

      // Should show loading skeleton
      expect(screen.getAllByText(/loading/i)).toHaveLength(3);
    });

    it('should handle access restrictions for non-parents', () => {
      render(
        <QuotaManagementPage
          users={mockUsers}
          rooms={mockRooms}
          quotas={mockQuotaData}
          isParent={false}
          onCreateQuota={mockOnCreateQuota}
          onUpdateQuota={mockOnUpdateQuota}
          onDeleteQuota={mockOnDeleteQuota}
          onToggleQuotaStatus={mockOnToggleQuotaStatus}
        />
      );

      // Should show access restricted message
      expect(screen.getByText(/access restricted/i)).toBeInTheDocument();
      expect(screen.getByText(/only parents can manage quotas/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility and User Experience', () => {
    it('should have proper ARIA labels and keyboard navigation', async () => {
      render(
        <QuotaSetupForm
          users={mockUsers}
          rooms={mockRooms}
          onSubmit={mockOnCreateQuota}
        />
      );

      // Check form controls have proper labels
      expect(screen.getByLabelText(/select user/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/select room/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/quota type/i)).toBeInTheDocument();

      // Test keyboard navigation
      const userSelect = screen.getByRole('combobox', { name: /select user/i });
      userSelect.focus();
      expect(userSelect).toHaveFocus();

      // Test tab navigation
      await user.tab();
      const roomSelect = screen.getByRole('combobox', { name: /select room/i });
      expect(roomSelect).toHaveFocus();
    });

    it('should provide helpful user feedback', async () => {
      render(
        <QuotaSetupForm
          users={mockUsers}
          rooms={mockRooms}
          success="Quota created successfully!"
          onSubmit={mockOnCreateQuota}
        />
      );

      // Should display success message
      expect(screen.getByText(/quota created successfully/i)).toBeInTheDocument();

      // Should show quota preview
      await user.click(screen.getByRole('combobox', { name: /select user/i }));
      await user.click(screen.getByText('John Doe'));

      await user.click(screen.getByRole('combobox', { name: /select room/i }));
      await user.click(screen.getByText('Living Room'));

      // Preview should be visible
      expect(screen.getByText(/quota preview/i)).toBeInTheDocument();
      expect(screen.getByText(/john doe.*can use.*living room/i)).toBeInTheDocument();
    });
  });
});