// Navigation and connection status type definitions

// Connection status interfaces
export interface ConnectionStatus {
  websocket: {
    state: 'connected' | 'connecting' | 'disconnected' | 'error';
    lastConnected: number | null;
    reconnectAttempts: number;
  };
  mqtt: {
    state: 'connected' | 'disconnected' | 'unknown';
    lastUpdate: number | null;
  };
  overall: 'healthy' | 'degraded' | 'disconnected';
}

// Navigation state interfaces
export interface NavigationState {
  currentRoute: string;
  previousRoute: string | null;
  canGoBack: boolean;
  isNavigating: boolean;
}

// Navigation component props
export interface NavigationHeaderProps {
  roomName?: string;
  showBackButton?: boolean;
  customActions?: React.ReactNode;
  className?: string;
}

export interface BackButtonProps {
  fallbackRoute?: string;
  onNavigate?: () => void;
  disabled?: boolean;
  className?: string;
  variant?: 'default' | 'ghost' | 'outline';
}

export interface ConnectionStatusBadgeProps {
  showDetails?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'compact' | 'detailed';
  className?: string;
}

// Hook interfaces
export interface UseNavigateBackOptions {
  fallbackRoute?: string;
  confirmNavigation?: boolean;
  forceFallbackRoute?: boolean; // Always use fallback route instead of browser history
}

export interface UseNavigateBackReturn {
  navigateBack: () => void;
  canGoBack: boolean;
  isNavigating: boolean;
}

export interface UseConnectionStatusReturn {
  status: ConnectionStatus;
  isOnline: boolean;
  retryConnection: () => void;
  lastError: string | null;
}

// Store enhancement interfaces
export interface ApiAirconStoreEnhancements {
  // Connection status tracking
  connectionStatus: ConnectionStatus;
  updateConnectionStatus: (status: Partial<ConnectionStatus>) => void;
  
  // Navigation state
  navigationState: NavigationState;
  updateNavigationState: (state: Partial<NavigationState>) => void;
  
  // Status polling
  startStatusPolling: () => void;
  stopStatusPolling: () => void;
}