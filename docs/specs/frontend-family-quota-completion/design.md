# Frontend Family Management & Quota System Completion - Technical Design

## 1. Executive Summary

### 1.1 Architecture Overview
This design implements a comprehensive frontend completion for family management and quota systems, built on the existing Next.js 15, React 19, and ShadcnUI foundation. The architecture emphasizes progressive enhancement, ensuring new quota management features seamlessly integrate with existing AC controls while maintaining performance and user experience standards.

### 1.2 Design Principles
- **Progressive Enhancement**: Quota features enhance existing functionality without breaking current workflows
- **Role-Based Design**: Parent and child interfaces optimized for their specific needs and permissions
- **Real-time First**: All quota changes and usage updates reflect immediately across all family devices
- **Mobile-Responsive**: Dashboard and quota interfaces work seamlessly across all device sizes
- **Performance-Conscious**: Lazy loading, caching, and optimistic updates ensure responsive user experience

### 1.3 Integration Strategy
- **Non-Breaking**: All existing AC control functionality remains unchanged
- **API Complete**: Every backend family and quota API endpoint accessible via intuitive UI
- **WebSocket Enhanced**: Extend existing real-time system for quota notifications without interference
- **Design System Compliant**: All components follow established ShadcnUI patterns and accessibility standards

---

## 2. System Architecture

### 2.1 Application Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                     Next.js App Router                      │
│  /dashboard/page.tsx  /dashboard/quotas/  /rooms/[id]/     │
├─────────────────────────────────────────────────────────────┤
│                   Feature Components                        │
│  FamilyDashboard  QuotaManagement  UsageMonitoring        │
├─────────────────────────────────────────────────────────────┤
│                  Composite Components                       │
│  QuotaSetupWizard  OverrideInterface  UsageCharts         │
├─────────────────────────────────────────────────────────────┤
│                   Atomic Components                         │
│  QuotaStatusBadge  UsageProgressBar  OverrideButton       │
├─────────────────────────────────────────────────────────────┤
│              State Management (Zustand v5)                  │
│  family-store  quota-store  dashboard-store  auth-store   │
├─────────────────────────────────────────────────────────────┤
│               API Integration Layer                          │
│  family-client  quota-client  websocket-client            │
├─────────────────────────────────────────────────────────────┤
│                Backend Integration                           │
│  Spring Boot APIs  JWT Auth  WebSocket  MQTT              │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Component Hierarchy Design

**Level 1 - Page Components (App Router Integration)**
```typescript
/app/dashboard/page.tsx                 // Enhanced family dashboard
/app/dashboard/quotas/page.tsx          // NEW: Quota management hub
/app/dashboard/quotas/setup/page.tsx    // NEW: Quota setup wizard
/app/dashboard/quotas/monitor/page.tsx  // NEW: Usage monitoring
/app/rooms/[roomId]/page.tsx           // Enhanced with quota integration
```

**Level 2 - Feature Components (Major UI Sections)**
```typescript
components/dashboard/
├── FamilyDashboard.tsx                // Complete family overview
├── QuotaManagementInterface.tsx       // Quota configuration hub
├── UsageMonitoringDashboard.tsx       // Real-time usage tracking
└── FamilyNavigationHeader.tsx         // Role-based navigation

components/quotas/
├── QuotaSetupWizard.tsx              // Step-by-step quota creation
├── QuotaOverrideInterface.tsx        // Parent override controls
├── ChildQuotaStatusPanel.tsx         // Child quota visibility
└── QuotaTemplateSelector.tsx         // Pre-built quota templates
```

**Level 3 - Composite Components (Specific Functionality)**
```typescript
components/usage/
├── RealTimeUsageChart.tsx            // Live usage visualization
├── FamilyUsageOverview.tsx           // Family-wide usage display
├── UsageHistoryAnalytics.tsx         // Historical trends
└── ExportUsageReport.tsx             // Usage report generation

components/controls/
├── EnhancedRoomControl.tsx           // Room page with quota integration
├── QuotaValidationMiddleware.tsx     // Pre-command validation
└── EmergencyOverridePanel.tsx        // Emergency access controls
```

**Level 4 - Atomic Components (Reusable UI Elements)**
```typescript
components/ui/quota/
├── QuotaStatusIndicator.tsx          // Simple quota status display
├── UsageProgressBar.tsx              // Visual usage progress
├── OverrideRequestButton.tsx         // Quick override request
├── QuotaWarningModal.tsx             // Quota limit warnings
└── FamilyMemberQuickStatus.tsx       // Member status card
```

---

## 3. State Management Architecture

### 3.1 Enhanced Zustand Store Design

**Enhanced quota-store.ts Architecture**
```typescript
interface QuotaStore {
  // Configuration State
  quotaTemplates: QuotaTemplate[];
  quotaWizardState: WizardState;
  quotaConfigurations: Record<string, QuotaConfig>;
  
  // Real-time Usage State
  realTimeUsage: Record<string, UsageData>;
  usageHistory: Record<string, HistoricalUsage[]>;
  
  // Override and Request State
  pendingOverrideRequests: OverrideRequest[];
  activeOverrides: Override[];
  
  // Actions with Proper Zustand v5 Patterns
  createQuota: (config: QuotaConfig) => Promise<Quota>;
  updateRealTimeUsage: (userId: string, usage: UsageData) => void;
  requestOverride: (request: OverrideRequest) => Promise<void>;
  approveOverride: (requestId: string) => Promise<void>;
}

// Critical Zustand v5 Pattern - Avoid Infinite Loops
const useQuotaStatus = (userId: string) => {
  return useQuotaStore((state) => state.realTimeUsage[userId]); // ✅ Specific selector
  // Never: useQuotaStore(state => state); // ❌ Causes infinite loops
};
```

**New dashboard-store.ts Architecture**
```typescript
interface DashboardStore {
  // Aggregated Family Overview
  familyOverview: FamilyOverviewData;
  dashboardWidgets: DashboardWidget[];
  
  // Real-time Coordination
  lastUpdateTimestamp: number;
  pendingUpdates: PendingUpdate[];
  
  // Actions
  refreshFamilyOverview: () => Promise<void>;
  updateDashboardWidget: (widgetId: string, data: any) => void;
  coordinateRealTimeUpdates: (updates: Update[]) => void;
}
```

**Enhanced family-store.ts Integration**
```typescript
interface EnhancedFamilyStore extends ExistingFamilyStore {
  // New Family Dashboard State
  familyDashboardData: FamilyDashboardData;
  parentChildInteractions: Interaction[];
  
  // Bulk Operation State
  bulkOperationProgress: BulkOperationState;
  
  // Enhanced Actions
  loadFamilyDashboard: () => Promise<void>;
  processBulkQuotaAssignment: (assignments: Assignment[]) => Promise<void>;
}
```

### 3.2 State Management Patterns

**Zustand v5 Safe Patterns Implementation**
```typescript
// ✅ CORRECT: Specific selector usage
const QuotaStatusComponent = ({ userId }) => {
  const quotaStatus = useQuotaStore((state) => state.realTimeUsage[userId]);
  const updateUsage = useQuotaStore((state) => state.updateRealTimeUsage);
  
  useEffect(() => {
    // updateUsage is stable, safe to omit from deps with eslint-disable
    updateUsage(userId, newUsage);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
};

// ✅ CORRECT: Multiple selections with useShallow
import { useShallow } from 'zustand/react/shallow';

const DashboardComponent = () => {
  const [familyData, quotaData, updateDashboard] = useQuotaStore(
    useShallow((state) => [
      state.familyOverview,
      state.quotaConfigurations,
      state.refreshFamilyOverview
    ])
  );
};
```

**Optimistic Update Pattern**
```typescript
const useOptimisticQuotaUpdate = () => {
  const updateQuotaOptimistically = useQuotaStore((state) => state.optimisticUpdate);
  const rollbackQuota = useQuotaStore((state) => state.rollbackUpdate);
  
  return async (quotaId: string, update: QuotaUpdate) => {
    // 1. Immediate UI update
    updateQuotaOptimistically(quotaId, update);
    
    try {
      // 2. Server confirmation
      await quotaClient.updateQuota(quotaId, update);
    } catch (error) {
      // 3. Rollback on failure
      rollbackQuota(quotaId);
      throw error;
    }
  };
};
```

---

## 4. API Integration Architecture

### 4.1 Enhanced API Client Design

**Quota Validation Integration**
```typescript
// Enhanced AC Control Flow
class EnhancedACControlFlow {
  async executeACCommand(roomId: string, command: ACCommand): Promise<void> {
    // 1. Pre-command quota validation
    const quotaValidation = await this.validateQuotaBeforeCommand(roomId, command);
    
    if (!quotaValidation.allowed) {
      throw new QuotaExceededException(quotaValidation.reason);
    }
    
    // 2. Optimistic UI update
    this.updateUIOptimistically(command);
    
    try {
      // 3. Execute command
      await apiAirConStore.getState().sendCommand(roomId, command);
      
      // 4. Update usage tracking
      await this.trackUsage(roomId, command);
      
    } catch (error) {
      // 5. Rollback optimistic update
      this.rollbackUIUpdate(command);
      throw error;
    }
  }
  
  private async validateQuotaBeforeCommand(roomId: string, command: ACCommand): Promise<QuotaValidation> {
    const userId = authStore.getState().user?.id;
    if (!userId) return { allowed: true }; // No quota for unauthenticated users
    
    return await quotaClient.validateCommand(userId, roomId, command);
  }
}
```

**WebSocket Integration Enhancement**
```typescript
// Enhanced WebSocket Client
class EnhancedWebSocketClient extends ExistingWebSocketClient {
  constructor() {
    super();
    this.setupQuotaEventHandlers();
  }
  
  private setupQuotaEventHandlers(): void {
    // Quota-specific event channels (separate from AC control events)
    this.on('quota:usage_updated', this.handleQuotaUsageUpdate);
    this.on('quota:limit_approached', this.handleQuotaWarning);
    this.on('quota:override_requested', this.handleOverrideRequest);
    this.on('quota:override_approved', this.handleOverrideApproval);
    
    // Family-wide broadcasting
    this.on('family:member_usage_updated', this.handleFamilyUsageUpdate);
    this.on('family:quota_configuration_changed', this.handleQuotaConfigChange);
  }
  
  private handleQuotaUsageUpdate = (data: QuotaUsageUpdate) => {
    // Update quota store without interfering with AC control state
    quotaStore.getState().updateRealTimeUsage(data.userId, data.usage);
  };
}
```

### 4.2 API Error Handling Strategy

**Comprehensive Error Handling Architecture**
```typescript
class APIErrorHandler {
  async handleQuotaOperation<T>(
    operation: () => Promise<T>,
    fallbackBehavior: 'cache' | 'disable' | 'retry'
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      switch (fallbackBehavior) {
        case 'cache':
          return this.getCachedResult<T>();
        case 'disable':
          return this.disableFeatureGracefully<T>();
        case 'retry':
          return this.retryWithBackoff(operation);
      }
    }
  }
  
  private async retryWithBackoff<T>(operation: () => Promise<T>, attempts: number = 3): Promise<T> {
    for (let i = 0; i < attempts; i++) {
      try {
        return await operation();
      } catch (error) {
        if (i === attempts - 1) throw error;
        await this.delay(Math.pow(2, i) * 1000); // Exponential backoff
      }
    }
    throw new Error('Max retry attempts exceeded');
  }
}
```

---

## 5. User Experience Architecture

### 5.1 Role-Based UI Architecture

**Parent Dashboard Experience**
```typescript
const ParentDashboard = () => {
  const user = useAuthStore((state) => state.user);
  const familyOverview = useDashboardStore((state) => state.familyOverview);
  
  if (!hasPermission(user?.role, FamilyPermission.MANAGE_FAMILY)) {
    return <UnauthorizedAccess />;
  }
  
  return (
    <DashboardLayout>
      <FamilyOverviewWidget data={familyOverview} />
      <QuotaManagementPanel />
      <UsageMonitoringWidget />
      <QuickActionsPanel />
    </DashboardLayout>
  );
};
```

**Child Room Experience**
```typescript
const EnhancedRoomPage = ({ roomId }: { roomId: string }) => {
  const user = useAuthStore((state) => state.user);
  const quotaStatus = useQuotaStore((state) => 
    user?.id ? state.realTimeUsage[user.id] : null
  );
  
  return (
    <RoomLayout>
      {/* Prominent quota status display */}
      <QuotaStatusPanel status={quotaStatus} roomId={roomId} />
      
      {/* Enhanced AC controls with quota integration */}
      <QuotaAwareACControls roomId={roomId} />
      
      {/* Override request if needed */}
      {quotaStatus?.exceeded && (
        <OverrideRequestPanel roomId={roomId} />
      )}
    </RoomLayout>
  );
};
```

### 5.2 Mobile-Responsive Design Architecture

**Responsive Component Strategy**
```typescript
const ResponsiveFamilyDashboard = () => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  return (
    <div className="container mx-auto px-4">
      {isMobile ? (
        <MobileFamilyDashboard />
      ) : (
        <DesktopFamilyDashboard />
      )}
    </div>
  );
};

// Mobile-optimized components
const MobileFamilyDashboard = () => (
  <div className="space-y-4">
    <FamilyStatusCards layout="stacked" />
    <QuickActionButtons size="large" />
    <CollapsibleUsageCharts />
  </div>
);
```

**Touch-Optimized Controls**
```typescript
const TouchOptimizedQuotaControls = () => (
  <div className="space-y-4">
    {/* Minimum 44px touch targets */}
    <Button 
      size="lg" 
      className="min-h-[44px] min-w-[44px] touch-manipulation"
    >
      Request Override
    </Button>
    
    {/* Swipe gestures for usage charts */}
    <SwipeableUsageChart />
    
    {/* Large, clear status indicators */}
    <QuotaStatusIndicator size="large" />
  </div>
);
```

---

## 6. Performance Architecture

### 6.1 Loading and Rendering Optimization

**Lazy Loading Strategy**
```typescript
// Progressive component loading
const LazyFamilyDashboard = lazy(() => import('@/components/dashboard/FamilyDashboard'));
const LazyQuotaManagement = lazy(() => import('@/components/quotas/QuotaManagementInterface'));
const LazyUsageMonitoring = lazy(() => import('@/components/usage/UsageMonitoringDashboard'));

const DashboardPage = () => (
  <Suspense fallback={<DashboardSkeleton />}>
    <LazyFamilyDashboard />
    <LazyQuotaManagement />
    <LazyUsageMonitoring />
  </Suspense>
);
```

**Caching Strategy**
```typescript
class QuotaCache {
  private cache = new Map<string, CachedData>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  
  async getQuotaStatus(userId: string): Promise<QuotaStatus> {
    const cached = this.cache.get(userId);
    
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
      return cached.data;
    }
    
    const fresh = await quotaClient.getQuotaStatus(userId);
    this.cache.set(userId, { data: fresh, timestamp: Date.now() });
    
    return fresh;
  }
}
```

### 6.2 Real-Time Performance Architecture

**Efficient WebSocket Update Handling**
```typescript
class OptimizedWebSocketHandler {
  private updateQueue: Update[] = [];
  private batchTimeout: NodeJS.Timeout | null = null;
  
  handleQuotaUpdate(update: QuotaUpdate): void {
    this.updateQueue.push(update);
    
    if (!this.batchTimeout) {
      this.batchTimeout = setTimeout(() => {
        this.processBatchedUpdates();
        this.batchTimeout = null;
      }, 100); // Batch updates every 100ms
    }
  }
  
  private processBatchedUpdates(): void {
    const updates = [...this.updateQueue];
    this.updateQueue = [];
    
    // Apply all updates in a single state transaction
    quotaStore.setState((state) => ({
      ...state,
      realTimeUsage: this.mergeBatchedUpdates(state.realTimeUsage, updates)
    }));
  }
}
```

---

## 7. Security Architecture

### 7.1 Frontend Security Patterns

**Role-Based Access Control Implementation**
```typescript
// Enhanced route protection
const ProtectedRoute = ({ children, requiredPermission }: {
  children: React.ReactNode;
  requiredPermission: FamilyPermission;
}) => {
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  
  useEffect(() => {
    if (!user || !hasPermission(user.role, requiredPermission)) {
      router.push('/unauthorized');
    }
  }, [user, requiredPermission, router]);
  
  if (!user || !hasPermission(user.role, requiredPermission)) {
    return <LoadingSpinner />;
  }
  
  return <>{children}</>;
};
```

**Data Filtering Architecture**
```typescript
class DataSecurityFilter {
  filterFamilyDataForUser(data: FamilyData, user: User): FamilyData {
    switch (user.role) {
      case 'PARENT':
        return data; // Parents see all family data
        
      case 'CHILD':
        return {
          ...data,
          members: data.members.filter(m => m.id === user.id), // Children only see themselves
          quotas: data.quotas.filter(q => q.userId === user.id), // Only their quotas
          usage: data.usage.filter(u => u.userId === user.id), // Only their usage
        };
        
      default:
        throw new Error('Unknown user role');
    }
  }
}
```

### 7.2 API Security Integration

**JWT Token Management Enhancement**
```typescript
class SecureAPIClient {
  private async makeAuthenticatedRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = authStore.getState().token;
    
    if (!token) {
      throw new UnauthorizedException('No authentication token');
    }
    
    const response = await fetch(endpoint, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (response.status === 401) {
      // Token expired, attempt refresh
      await this.refreshToken();
      return this.makeAuthenticatedRequest(endpoint, options);
    }
    
    if (!response.ok) {
      throw new APIException(`Request failed: ${response.statusText}`);
    }
    
    return response.json();
  }
}
```

---

## 8. Testing Architecture

### 8.1 Component Testing Strategy

**Comprehensive Test Coverage Design**
```typescript
// Family dashboard integration test
describe('FamilyDashboard', () => {
  beforeEach(() => {
    // Mock Zustand stores with proper selectors
    vi.mocked(useFamilyStore).mockImplementation((selector) => 
      selector(mockFamilyState)
    );
  });
  
  test('displays all family members for parent user', () => {
    const mockParentUser = { role: 'PARENT', id: 'parent-1' };
    render(<FamilyDashboard />, { 
      wrapper: ({ children }) => (
        <AuthProvider initialUser={mockParentUser}>
          {children}
        </AuthProvider>
      )
    });
    
    expect(screen.getByText('Family Members (3)')).toBeInTheDocument();
    expect(screen.getByText('child-1@example.com')).toBeInTheDocument();
  });
  
  test('restricts data for child user', () => {
    const mockChildUser = { role: 'CHILD', id: 'child-1' };
    render(<FamilyDashboard />, {
      wrapper: ({ children }) => (
        <AuthProvider initialUser={mockChildUser}>
          {children}
        </AuthProvider>
      )
    });
    
    // Child should only see their own data
    expect(screen.queryByText('Family Members')).not.toBeInTheDocument();
    expect(screen.getByText('Your Quota Status')).toBeInTheDocument();
  });
});
```

**WebSocket Integration Testing**
```typescript
// WebSocket quota update test
describe('WebSocket Quota Integration', () => {
  let mockWebSocket: MockWebSocket;
  
  beforeEach(() => {
    mockWebSocket = new MockWebSocket();
    vi.mocked(WebSocket).mockImplementation(() => mockWebSocket);
  });
  
  test('updates quota status in real-time', async () => {
    render(<QuotaStatusBadge userId="child-1" />);
    
    // Simulate quota update via WebSocket
    mockWebSocket.emit('quota:usage_updated', {
      userId: 'child-1',
      usage: { remaining: 30, total: 240 } // 30 minutes remaining
    });
    
    await waitFor(() => {
      expect(screen.getByText('30 min remaining')).toBeInTheDocument();
    });
  });
});
```

### 8.2 Performance Testing Architecture

**Load Time and Responsiveness Testing**
```typescript
describe('Dashboard Performance', () => {
  test('dashboard loads within 2 second target', async () => {
    const startTime = performance.now();
    
    render(<FamilyDashboard />);
    
    await waitFor(() => {
      expect(screen.getByTestId('dashboard-content')).toBeInTheDocument();
    });
    
    const loadTime = performance.now() - startTime;
    expect(loadTime).toBeLessThan(2000); // 2 second target
  });
  
  test('real-time updates respond within 500ms', async () => {
    render(<QuotaStatusBadge userId="child-1" />);
    
    const updateStartTime = performance.now();
    
    // Trigger quota update
    quotaStore.getState().updateRealTimeUsage('child-1', newUsage);
    
    await waitFor(() => {
      expect(screen.getByText('25 min remaining')).toBeInTheDocument();
    });
    
    const updateTime = performance.now() - updateStartTime;
    expect(updateTime).toBeLessThan(500); // 500ms target
  });
});
```

---

## 9. Risk Mitigation Architecture

### 9.1 High-Risk Mitigation Strategies

**Zustand v5 Infinite Loop Prevention Architecture**
```typescript
// Safe selector patterns enforcement
const createSafeSelector = <T, U>(
  store: StoreApi<T>,
  selector: (state: T) => U
) => {
  return () => {
    const state = store.getState();
    return selector(state);
  };
};

// Custom hook enforcement
const useQuotaStatusSafe = (userId: string) => {
  return useQuotaStore(
    useCallback((state) => state.realTimeUsage[userId], [userId])
  );
};

// React.memo for expensive components
const ExpensiveFamilyDashboard = React.memo(({ familyData }: {
  familyData: FamilyData;
}) => {
  // Expensive rendering logic
  return <ComplexDashboard data={familyData} />;
}, (prevProps, nextProps) => {
  // Custom comparison to prevent unnecessary re-renders
  return shallowEqual(prevProps.familyData, nextProps.familyData);
});
```

**WebSocket Separation Architecture**
```typescript
// Event namespace isolation
class WebSocketEventManager {
  private acControlChannel = new EventChannel('ac_control');
  private quotaChannel = new EventChannel('quota_management');
  
  constructor(websocket: WebSocket) {
    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      // Route messages to appropriate channels
      if (data.type.startsWith('ac:')) {
        this.acControlChannel.emit(data.type, data);
      } else if (data.type.startsWith('quota:')) {
        this.quotaChannel.emit(data.type, data);
      }
    };
  }
  
  // Separate subscription methods
  subscribeToACEvents(handler: (event: ACEvent) => void) {
    this.acControlChannel.on('*', handler);
  }
  
  subscribeToQuotaEvents(handler: (event: QuotaEvent) => void) {
    this.quotaChannel.on('*', handler);
  }
}
```

### 9.2 Performance Risk Mitigation

**Quota Validation Optimization**
```typescript
class OptimizedQuotaValidator {
  private validationCache = new Map<string, CachedValidation>();
  private readonly CACHE_DURATION = 30 * 1000; // 30 seconds
  
  async validateACCommand(
    userId: string, 
    roomId: string, 
    command: ACCommand
  ): Promise<QuotaValidation> {
    const cacheKey = `${userId}-${roomId}-${command.type}`;
    const cached = this.validationCache.get(cacheKey);
    
    // Use cached validation if recent
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
      return { ...cached.validation, fromCache: true };
    }
    
    // Perform validation with timeout
    const validation = await Promise.race([
      quotaClient.validateCommand(userId, roomId, command),
      this.timeoutPromise(1000) // 1 second timeout
    ]);
    
    // Cache successful validations
    this.validationCache.set(cacheKey, {
      validation,
      timestamp: Date.now()
    });
    
    return validation;
  }
  
  private timeoutPromise(ms: number): Promise<QuotaValidation> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Validation timeout')), ms);
    });
  }
}
```

---

## 10. Implementation Phases

### 10.1 Phase 1: Core Dashboard Integration (Week 1)
**Components to Implement:**
- Enhanced FamilyDashboard component
- Role-based navigation system
- Basic quota status displays
- WebSocket integration for real-time updates

**State Management:**
- Enhanced family-store with dashboard aggregation
- Basic dashboard-store implementation
- Zustand v5 safe patterns enforcement

**Success Criteria:**
- Parents can see family overview with real-time quota status
- Children can see their quota status prominently
- Navigation adapts properly to user roles

### 10.2 Phase 2: Quota Configuration Interface (Week 2)
**Components to Implement:**
- QuotaSetupWizard with step-by-step guidance
- QuotaManagementInterface for CRUD operations
- QuotaTemplateSelector for common scenarios
- Bulk quota assignment functionality

**API Integration:**
- Complete quota-client.ts integration
- Quota validation middleware
- Error handling and fallback strategies

**Success Criteria:**
- Parents can create and configure quotas via intuitive wizard
- Quota changes take effect immediately across all devices
- Form validation prevents invalid configurations

### 10.3 Phase 3: Real-time Usage & Override System (Week 3)
**Components to Implement:**
- UsageMonitoringDashboard with live charts
- QuotaOverrideInterface for parent controls
- ChildQuotaRequestPanel for override requests
- Enhanced room page with quota integration

**WebSocket Enhancement:**
- Quota notification channels
- Override request/approval workflows
- Cross-device synchronization

**Success Criteria:**
- Real-time usage updates across all family devices
- Override requests reach parents within 30 seconds
- Room controls show quota status prominently

### 10.4 Phase 4: Performance Optimization & Testing (Week 4)
**Optimization Work:**
- Component lazy loading implementation
- Caching strategies for quota data
- Mobile performance optimization
- Bundle size optimization

**Testing Implementation:**
- Component integration tests
- WebSocket integration tests
- Performance regression tests
- Accessibility compliance testing

**Success Criteria:**
- Dashboard loads within 2 second target
- Real-time updates complete within 500ms
- All accessibility standards met
- Comprehensive test coverage achieved

---

## 11. Success Metrics

### 11.1 Technical Architecture Metrics
- **Component Integration**: 100% of new components follow established ShadcnUI patterns
- **API Coverage**: All backend quota and family management endpoints accessible via UI
- **Performance Targets**: Dashboard < 2s load, real-time updates < 500ms
- **Error Rates**: <1% error rate for all quota operations
- **WebSocket Reliability**: >99.5% uptime for real-time features

### 11.2 User Experience Metrics
- **Setup Completion**: 85% of parents complete family and quota setup within 15 minutes
- **Mobile Responsiveness**: All components work seamlessly on mobile devices
- **Cross-device Sync**: Changes reflect across all family devices within 1 second
- **Accessibility Compliance**: 100% WCAG 2.1 AA compliance achieved

### 11.3 Integration Quality Metrics
- **Non-Breaking Changes**: Existing AC control functionality unaffected
- **Zustand v5 Compliance**: No infinite loop issues with state management
- **Design Consistency**: All components pass design system compliance audit
- **Test Coverage**: >90% test coverage for all new components and functionality

---

*This technical design provides a comprehensive architecture for completing the frontend family management and quota system while maintaining the high quality, performance, and user experience standards of the existing system. The progressive enhancement approach ensures seamless integration without disrupting current functionality.*