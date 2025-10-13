"use client";

import React, { useEffect } from 'react';
import { useStore } from 'zustand';
import { ApiAirconContext } from '@/components/AirconProvider';
import { QuotaFeedback } from './QuotaFeedback';
import { useQuotaFeedback } from '@/hooks/useQuotaFeedback';

export interface QuotaFeedbackWrapperProps {
  children: React.ReactNode;
  roomId: string;
  className?: string;
}

/**
 * QuotaFeedbackWrapper wraps any AC control components with quota feedback display.
 *
 * This component:
 * 1. Monitors quota validation results from the aircon store
 * 2. Displays quota feedback to users via QuotaFeedback component
 * 3. Provides a non-intrusive overlay for existing AC controls
 */
export const QuotaFeedbackWrapper: React.FC<QuotaFeedbackWrapperProps> = React.memo(({
  children,
  roomId,
  className
}) => {
  const apiAirconStore = React.useContext(ApiAirconContext);

  if (!apiAirconStore) {
    throw new Error("QuotaFeedbackWrapper must be used within ApiAirconContext.Provider");
  }

  // Get quota state from the store
  const lastQuotaValidation = useStore(apiAirconStore, (state) => state.lastQuotaValidation);
  const quotaValidationEnabled = useStore(apiAirconStore, (state) => state.quotaValidationEnabled);

  // Set up quota feedback with appropriate timeouts
  const quotaFeedback = useQuotaFeedback({
    autoHideTimeout: 5000,
    autoHideSuccess: true,    // Hide success messages automatically
    autoHideWarnings: false,  // Keep warnings visible
    autoHideErrors: false     // Keep errors visible
  });

  // Monitor quota validation results and show feedback
  useEffect(() => {
    if (lastQuotaValidation && quotaValidationEnabled) {
      console.log('📊 Quota validation result received:', lastQuotaValidation);

      // Show feedback for all validation results
      quotaFeedback.showFeedback(lastQuotaValidation);
    }
  }, [lastQuotaValidation, quotaValidationEnabled, quotaFeedback]);

  return (
    <div className={className}>
      {/* Quota feedback display */}
      {quotaValidationEnabled && quotaFeedback.isVisible && (
        <div className="mb-4">
          <QuotaFeedback
            validationResult={quotaFeedback.validationResult}
            onDismiss={quotaFeedback.hideFeedback}
          />
        </div>
      )}

      {/* Original AC control content */}
      {children}

      {/* Debug info in development */}
      {process.env.NODE_ENV === 'development' && lastQuotaValidation && (
        <div className="mt-4 p-2 bg-muted rounded text-xs text-muted-foreground">
          <div>Room: {roomId}</div>
          <div>Quota Validation: {quotaValidationEnabled ? 'Enabled' : 'Disabled'}</div>
          <div>Last Result: {lastQuotaValidation.status} - {lastQuotaValidation.message}</div>
        </div>
      )}
    </div>
  );
});

QuotaFeedbackWrapper.displayName = 'QuotaFeedbackWrapper';

export default QuotaFeedbackWrapper;