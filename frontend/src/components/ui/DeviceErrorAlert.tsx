/**
 * Device Error Alert Component
 * 
 * Displays user-friendly error messages for device-related operations
 * with specific handling for different error types.
 */

import React from 'react';
import { AlertCircle, RefreshCw, Info, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface DeviceErrorAlertProps {
  error: string;
  errorType?: 'generic' | 'device_exists' | 'device_unavailable' | 'validation' | null;
  errorDetails?: any;
  onRetry?: () => void;
  onDismiss?: () => void;
  onUpdateExisting?: () => void;
  className?: string;
}

export function DeviceErrorAlert({
  error,
  errorType,
  errorDetails,
  onRetry,
  onDismiss,
  onUpdateExisting,
  className
}: DeviceErrorAlertProps) {
  const getErrorConfig = () => {
    switch (errorType) {
      case 'device_exists':
        return {
          title: 'Device Already Exists',
          icon: <Info className="h-4 w-4" />,
          variant: 'default' as const,
          color: 'bg-blue-50 border-blue-200 text-blue-800',
          showRetry: false,
          showUpdate: true,
          suggestions: errorDetails?.suggestion ? [errorDetails.suggestion] : [
            'Use a different device identifier',
            'Update the existing device instead'
          ]
        };
      
      case 'device_unavailable':
        return {
          title: 'Device Unavailable',
          icon: <AlertCircle className="h-4 w-4" />,
          variant: 'destructive' as const,
          color: 'bg-orange-50 border-orange-200 text-orange-800',
          showRetry: errorDetails?.retryable !== false,
          showUpdate: false,
          suggestions: [
            'Check device power and network connection',
            'Try again in a few moments'
          ]
        };
      
      case 'validation':
        return {
          title: 'Invalid Device Data',
          icon: <AlertCircle className="h-4 w-4" />,
          variant: 'destructive' as const,
          color: 'bg-red-50 border-red-200 text-red-800',
          showRetry: false,
          showUpdate: false,
          suggestions: ['Please check the device information and try again']
        };
      
      default:
        return {
          title: 'Device Operation Failed',
          icon: <AlertCircle className="h-4 w-4" />,
          variant: 'destructive' as const,
          color: 'bg-red-50 border-red-200 text-red-800',
          showRetry: true,
          showUpdate: false,
          suggestions: ['Please try again or contact support if the problem persists']
        };
    }
  };

  const config = getErrorConfig();

  return (
    <Alert variant={config.variant} className={`${className} ${config.color}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-2 flex-1">
          {config.icon}
          <div className="flex-1">
            <AlertTitle className="flex items-center gap-2">
              {config.title}
              {errorType && (
                <Badge variant="outline" className="text-xs">
                  {errorType.replace('_', ' ')}
                </Badge>
              )}
            </AlertTitle>
            <AlertDescription className="mt-2">
              <div className="space-y-2">
                <p>{error}</p>
                
                {/* Device-specific details */}
                {errorDetails?.deviceIdentifier && (
                  <p className="text-sm opacity-75">
                    Device: <code className="bg-black/10 px-1 rounded text-xs">
                      {errorDetails.deviceIdentifier}
                    </code>
                  </p>
                )}
                
                {/* Suggestions */}
                {config.suggestions.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm font-medium mb-1">Suggestions:</p>
                    <ul className="text-sm space-y-1">
                      {config.suggestions.map((suggestion, index) => (
                        <li key={index} className="flex items-start">
                          <span className="mr-2">•</span>
                          <span>{suggestion}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </AlertDescription>
          </div>
        </div>
        
        {/* Action buttons */}
        <div className="flex items-center space-x-2 ml-4">
          {config.showUpdate && onUpdateExisting && (
            <Button
              variant="outline"
              size="sm"
              onClick={onUpdateExisting}
              className="text-xs"
            >
              Update Existing
            </Button>
          )}
          
          {config.showRetry && onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="text-xs"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Retry
            </Button>
          )}
          
          {onDismiss && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="text-xs p-1"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    </Alert>
  );
}

/**
 * Hook for using device error alerts with common patterns.
 */
export function useDeviceErrorAlert() {
  const [error, setError] = React.useState<{
    message: string;
    type?: 'generic' | 'device_exists' | 'device_unavailable' | 'validation' | null;
    details?: any;
  } | null>(null);

  const showError = React.useCallback((
    message: string,
    type?: 'generic' | 'device_exists' | 'device_unavailable' | 'validation' | null,
    details?: any
  ) => {
    setError({ message, type, details });
  }, []);

  const clearError = React.useCallback(() => {
    setError(null);
  }, []);

  const ErrorAlert = React.useCallback(({
    onRetry,
    onUpdateExisting,
    className
  }: {
    onRetry?: () => void;
    onUpdateExisting?: () => void;
    className?: string;
  }) => {
    if (!error) return null;

    return (
      <DeviceErrorAlert
        error={error.message}
        errorType={error.type}
        errorDetails={error.details}
        onRetry={onRetry}
        onDismiss={clearError}
        onUpdateExisting={onUpdateExisting}
        className={className}
      />
    );
  }, [error, clearError]);

  return {
    error,
    showError,
    clearError,
    ErrorAlert
  };
}