# Mobile Responsive Layout - Technical Design

## 1. Executive Summary

### 1.1 Design Overview
This document defines the technical architecture for transforming the app and admin layouts into fully responsive, mobile-friendly interfaces. The design follows clean code principles (DRY, SOLID, YAGNI), applies the Strategy Pattern for responsive behavior, and refactors existing 311-line SharedSidebar into modular components.

### 1.2 Key Architectural Decisions
1. **Strategy Pattern** for responsive behavior selection (mobile/desktop strategies)
2. **Component Composition** over inheritance for layout flexibility
3. **Custom Hook** (`useResponsive`) for centralized breakpoint detection
4. **Code Extraction** to eliminate duplication between app and admin layouts
5. **Component Splitting** to maintain <200 line limit per file

### 1.3 Success Criteria
- ✅ All components < 200 lines
- ✅ All functions < 20 lines
- ✅ < 3% code duplication
- ✅ 60fps animations on mobile
- ✅ SOLID principles validated
- ✅ Zero breaking changes to desktop experience

---

## 2. Clean Code Principles Analysis

### 2.1 DRY (Don't Repeat Yourself)

**Current Violations Identified**:
1. **app/layout.tsx** and **admin/layout.tsx** have identical structure (39 lines, 100% duplicate)
2. Mobile detection logic exists in SharedSidebar but not centralized
3. Responsive padding/spacing duplicated across components
4. Breakpoint values scattered throughout codebase

**Solutions**:
1. Extract `BaseLayout` component accepting `context` prop
2. Create `useResponsive` hook for all breakpoint detection
3. Create `ResponsiveContainer` component for consistent spacing
4. Define breakpoint constants in theme configuration

**Impact**: Reduce ~80 lines of duplicate code, improve maintainability

### 2.2 SOLID Principles

#### Single Responsibility Principle (SRP)

**Current Violations**:
- **SharedSidebar.tsx** (311 lines): Handles user display, navigation rendering, mobile detection, styling, and animations
- **Layout files**: Mix provider management, layout structure, and sidebar orchestration

**Refactoring Strategy**:
```
SharedSidebar (311 lines) → Split into:
├── SidebarHeader.tsx (~70 lines) - User info display
├── SidebarContent.tsx (~120 lines) - Navigation items
├── SidebarFooter.tsx (~40 lines) - Footer actions
└── DesktopSidebar.tsx (~80 lines) - Composition & structure

Layout files → Split into:
├── BaseLayout.tsx - Pure layout structure
├── LayoutProviders.tsx - Context providers wrapper
└── ResponsiveLayout.tsx - Responsive orchestration
```

#### Open/Closed Principle (OCP)

**Current State**: Adding new layout types (e.g., public, auth) requires modifying existing files

**Design Solution**:
- `ResponsiveLayout` accepts `context` prop (extensible without modification)
- Navigation components registered via props, not hard-coded
- Layout strategies selected via composition, not conditionals

#### Dependency Inversion Principle (DIP)

**Current Violations**:
- Layouts depend on concrete `SharedSidebar` component
- Components depend on `window.innerWidth` directly

**Design Solution**:
- Define `ILayoutNavigation` interface
- All navigation components implement interface
- Use `useResponsive` hook (abstraction) instead of direct window access

### 2.3 YAGNI (You Aren't Gonna Need It)

**Avoided Over-Engineering**:
- ❌ No separate mobile app
- ❌ No complex gesture library
- ❌ No tablet-specific layouts initially (can add later if needed)
- ✅ Simple CSS-based responsive design
- ✅ Use existing ShadcnUI components (Sheet, Card)
- ✅ Minimal custom code

---

## 3. Design Pattern Analysis

### 3.1 Selected Pattern: Strategy Pattern

**Why Strategy Pattern?**

**Trade-off Analysis**:
| Pattern | Complexity | Maintainability | Testability | Flexibility | Score |
|---------|-----------|----------------|-------------|-------------|-------|
| Template Method | 2 | 4 | 5 | 3 | 3.5 |
| **Strategy** | **3** | **5** | **5** | **5** | **4.5** ✅ |
| Adapter | 2 | 3 | 4 | 3 | 3.0 |
| Observer | 4 | 3 | 3 | 4 | 3.5 |

**Decision Rationale**:
- Higher flexibility (5/5) - Easy to add new responsive strategies
- Excellent maintainability (5/5) - Each strategy isolated
- Perfect testability (5/5) - Strategies independently testable
- Aligns with React's compositional model
- Enables runtime strategy selection based on breakpoint

### 3.2 Strategy Pattern Implementation

**Pattern Structure**:
```typescript
// Strategy Interface
interface IResponsiveStrategy {
  renderNavigation: (props: NavigationProps) => ReactNode;
  renderContent: (children: ReactNode) => ReactNode;
}

// Concrete Strategies
class MobileStrategy implements IResponsiveStrategy {
  renderNavigation(props) {
    return <MobileDrawer {...props} />;
  }
  renderContent(children) {
    return <ResponsiveContainer mobile>{children}</ResponsiveContainer>;
  }
}

class DesktopStrategy implements IResponsiveStrategy {
  renderNavigation(props) {
    return <DesktopSidebar {...props} />;
  }
  renderContent(children) {
    return <ResponsiveContainer desktop>{children}</ResponsiveContainer>;
  }
}

// Context (ResponsiveLayout)
const ResponsiveLayout: FC<Props> = ({ context, children }) => {
  const { isMobile } = useResponsive();
  const strategy = isMobile ? new MobileStrategy() : new DesktopStrategy();

  return (
    <>
      {strategy.renderNavigation({ context })}
      {strategy.renderContent(children)}
    </>
  );
};
```

### 3.3 Complementary Patterns

**Composite Pattern** - For building complex layouts:
- `ResponsiveContainer` → `ResponsiveLayout` → `BaseLayout`
- Each layer adds specific responsibility
- Enables flexible composition

**Adapter Pattern** - For existing components:
- Wrap `SharedSidebar` with adapter to work with new responsive system
- Gradually migrate without breaking changes

---

## 4. Architecture Design

### 4.1 Component Hierarchy

```
/frontend/src/
├── hooks/
│   └── responsive/
│       ├── useResponsive.ts          # Breakpoint detection hook (~40 lines)
│       ├── useMediaQuery.ts          # matchMedia wrapper (~30 lines)
│       └── index.ts
│
├── components/
│   └── layout/
│       ├── ResponsiveLayout.tsx      # Main orchestrator (~80 lines)
│       ├── ResponsiveContainer.tsx   # Content wrapper (~40 lines)
│       ├── BaseLayout.tsx            # Shared layout structure (~60 lines)
│       ├── LayoutProviders.tsx       # Context providers (~50 lines)
│       │
│       ├── mobile/
│       │   ├── MobileHeader.tsx      # Top navigation bar (~60 lines)
│       │   ├── MobileDrawer.tsx      # Slide-out navigation (~80 lines)
│       │   └── index.ts
│       │
│       └── desktop/
│           ├── DesktopSidebar.tsx    # Main sidebar container (~90 lines)
│           ├── SidebarHeader.tsx     # User info section (~70 lines)
│           ├── SidebarContent.tsx    # Navigation items (~120 lines)
│           ├── SidebarFooter.tsx     # Footer actions (~40 lines)
│           └── index.ts
│
└── app/
    ├── app/layout.tsx                # Uses BaseLayout with context="app"
    └── admin/layout.tsx              # Uses BaseLayout with context="admin"
```

### 4.2 Component Responsibility Matrix

| Component | Responsibility | Lines | SOLID Alignment |
|-----------|---------------|-------|-----------------|
| `useResponsive` | Detect breakpoints, provide responsive state | 40 | SRP: Only breakpoint detection |
| `ResponsiveLayout` | Orchestrate mobile/desktop strategies | 80 | SRP: Layout orchestration only, OCP: Extensible via props |
| `ResponsiveContainer` | Apply responsive padding/max-width | 40 | SRP: Container styling only |
| `BaseLayout` | Shared layout structure | 60 | DRY: Eliminates app/admin duplication |
| `MobileHeader` | Mobile top navigation | 60 | SRP: Mobile header only |
| `MobileDrawer` | Mobile slide-out navigation | 80 | SRP: Mobile nav drawer only |
| `DesktopSidebar` | Desktop sidebar composition | 90 | SRP: Sidebar orchestration |
| `SidebarHeader` | User info display | 70 | SRP: User section only |
| `SidebarContent` | Navigation items rendering | 120 | SRP: Navigation only |
| `SidebarFooter` | Footer actions | 40 | SRP: Footer only |

**Total Lines**: ~680 lines (vs current 311 lines SharedSidebar + 78 lines layout duplication = 389)
**Code Increase**: +291 lines BUT with much better modularity and maintainability

### 4.3 Data Flow Architecture

```
User Interaction (Touch/Click)
         ↓
┌────────────────────────┐
│  useResponsive Hook    │ ← Window resize events
│  (Breakpoint Detection)│
└────────┬───────────────┘
         ↓ { isMobile, isTablet, isDesktop, breakpoint }
┌────────────────────────┐
│  ResponsiveLayout      │
│  (Strategy Selection)  │
└────────┬───────────────┘
         ↓
    ┌────┴────┐
    ↓         ↓
Mobile    Desktop
Strategy  Strategy
    ↓         ↓
MobileDrawer  DesktopSidebar
    ↓         ↓
Navigation Content
```

---

## 5. Interface Definitions

### 5.1 Core Interfaces

```typescript
/**
 * Responsive breakpoint state
 */
export interface IResponsiveBreakpoint {
  /** Current viewport width in pixels */
  width: number;
  /** Is viewport mobile size (< 768px) */
  isMobile: boolean;
  /** Is viewport tablet size (768px - 1024px) */
  isTablet: boolean;
  /** Is viewport desktop size (> 1024px) */
  isDesktop: boolean;
  /** Current breakpoint name */
  breakpoint: 'mobile' | 'tablet' | 'desktop' | 'wide';
}

/**
 * Navigation component props
 */
export interface INavigationProps {
  /** Layout context (app or admin) */
  context: 'app' | 'admin';
  /** Optional custom navigation items */
  items?: NavigationItem[];
  /** Callback when navigation item clicked */
  onItemClick?: (itemId: string) => void;
  /** Additional className */
  className?: string;
}

/**
 * Responsive layout props
 */
export interface IResponsiveLayoutProps {
  /** Main content */
  children: React.ReactNode;
  /** Layout context */
  context: 'app' | 'admin';
  /** Optional header content (mobile) */
  headerContent?: React.ReactNode;
  /** Optional footer content */
  footerContent?: React.ReactNode;
  /** Custom navigation items */
  navigationItems?: NavigationItem[];
}

/**
 * Responsive container props
 */
export interface IResponsiveContainerProps {
  children: React.ReactNode;
  /** Maximum width (default: responsive) */
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  /** Responsive padding */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Additional className */
  className?: string;
}
```

### 5.2 Dependency Contracts

**useResponsive Hook Contract**:
```typescript
// Input: None (reads from window)
// Output: IResponsiveBreakpoint
// Side Effects: Adds resize listener, cleans up on unmount
// Dependencies: window.matchMedia
```

**ResponsiveLayout Contract**:
```typescript
// Input: IResponsiveLayoutProps
// Output: JSX.Element
// Side Effects: None (pure component)
// Dependencies: useResponsive, MobileStrategy | DesktopStrategy
```

---

## 6. Technical Implementation Details

### 6.1 Breakpoint Detection Strategy

**Approach**: matchMedia API + debounced resize listener

**Why Not Alternatives?**:
- ❌ `window.innerWidth` directly: No SSR support, no media query features
- ❌ `useEffect` + resize: Too many re-renders, performance issues
- ✅ `matchMedia`: Native browser API, optimized, SSR-friendly

**Implementation**:
```typescript
export const useResponsive = (): IResponsiveBreakpoint => {
  const [breakpoint, setBreakpoint] = useState<IResponsiveBreakpoint>(() =>
    getBreakpoint(typeof window !== 'undefined' ? window.innerWidth : 1024)
  );

  useEffect(() => {
    // Use matchMedia for efficient breakpoint detection
    const queries = {
      mobile: window.matchMedia('(max-width: 767px)'),
      tablet: window.matchMedia('(min-width: 768px) and (max-width: 1023px)'),
      desktop: window.matchMedia('(min-width: 1024px)'),
    };

    const updateBreakpoint = () => {
      setBreakpoint({
        width: window.innerWidth,
        isMobile: queries.mobile.matches,
        isTablet: queries.tablet.matches,
        isDesktop: queries.desktop.matches,
        breakpoint: queries.mobile.matches ? 'mobile' :
                    queries.tablet.matches ? 'tablet' : 'desktop',
      });
    };

    // Listen to media query changes
    Object.values(queries).forEach(q => q.addEventListener('change', updateBreakpoint));

    // Cleanup
    return () => {
      Object.values(queries).forEach(q => q.removeEventListener('change', updateBreakpoint));
    };
  }, []);

  return breakpoint;
};
```

### 6.2 Layout Refactoring Strategy

**Current State** (app/layout.tsx and admin/layout.tsx):
- 39 lines each
- 100% duplicate except `context` prop
- Providers mixed with layout structure

**Refactored State**:

**BaseLayout.tsx** (~60 lines):
```typescript
export const BaseLayout: FC<{ context: 'app' | 'admin'; children: ReactNode }> = ({
  context,
  children,
}) => {
  return (
    <LayoutProviders context={context}>
      <ResponsiveLayout context={context}>
        {children}
      </ResponsiveLayout>
    </LayoutProviders>
  );
};
```

**app/layout.tsx** (~10 lines):
```typescript
export default function AppLayout({ children }: AppLayoutProps) {
  return <BaseLayout context="app">{children}</BaseLayout>;
}
```

**admin/layout.tsx** (~10 lines):
```typescript
export default function AdminLayout({ children }: AdminLayoutProps) {
  return <BaseLayout context="admin">{children}</BaseLayout>;
}
```

**Result**: Reduce from 78 total lines to ~80 lines, but eliminate 100% duplication

### 6.3 SharedSidebar Refactoring

**Current**: 311 lines, multiple responsibilities

**Refactored**:

**DesktopSidebar.tsx** (~90 lines):
```typescript
export const DesktopSidebar: FC<INavigationProps> = ({ context, className }) => {
  return (
    <aside className={cn('w-80 h-screen p-3', className)}>
      <Card className="h-full overflow-hidden bg-card border shadow-none">
        <div className="flex flex-col h-full">
          <SidebarHeader context={context} />
          <SidebarContent context={context} />
          <SidebarFooter context={context} />
        </div>
      </Card>
    </aside>
  );
};
```

**SidebarHeader.tsx** (~70 lines):
```typescript
export const SidebarHeader: FC<{ context: string }> = ({ context }) => {
  const user = useAuthStore((state) => state.user);

  return (
    <div className="flex items-center gap-3 p-6 border-b flex-shrink-0">
      {/* User avatar and info */}
    </div>
  );
};
```

**SidebarContent.tsx** (~120 lines):
```typescript
export const SidebarContent: FC<{ context: string }> = ({ context }) => {
  const rooms = useUserRooms();
  const pathname = usePathname();

  return (
    <ScrollArea className="flex-1 min-h-0 -mr-1">
      <div className="pb-2 pr-1.5">
        {/* Navigation items */}
      </div>
    </ScrollArea>
  );
};
```

**SidebarFooter.tsx** (~40 lines):
```typescript
export const SidebarFooter: FC<{ context: string }> = ({ context }) => {
  return (
    <div className="border-t p-4 flex-shrink-0">
      {/* Footer actions */}
    </div>
  );
};
```

---

## 7. Responsive Behavior Specification

### 7.1 Mobile Layout (< 768px)

**Navigation**:
```
┌──────────────────────────┐
│ [☰] Title        [@] [⚙]│ ← MobileHeader (fixed top)
├──────────────────────────┤
│                          │
│   Main Content Area      │
│   (full width)           │
│                          │
│   padding: 16px          │
│                          │
└──────────────────────────┘
```

**Drawer Open**:
```
┌──────────────┐┌──────────┐
│              ││ [✕]      │ ← Drawer header
│  Backdrop    ││──────────│
│  (dimmed)    ││ User     │
│              ││ Info     │
│              ││──────────│
│              ││ Nav      │
│              ││ Items    │
│              ││ (scroll) │
│              ││          │
│              ││──────────│
│              ││ Footer   │
└──────────────┘└──────────┘
  Main Content   Drawer (320px)
```

**Characteristics**:
- Hamburger menu (44x44px minimum)
- Full-height drawer slide from left
- Backdrop with onClick to close
- Drawer width: 320px (80vw max)
- Animation: 300ms ease-out
- Close on navigation item click

### 7.2 Desktop Layout (> 1024px)

```
┌───────┬─────────────────────────┐
│       │                         │
│       │   Main Content Area     │
│ Side  │                         │
│ bar   │   max-width: 1280px     │
│       │   padding: 32px         │
│ 320px │   margin: auto          │
│       │                         │
│ Fixed │                         │
│       │                         │
│       │                         │
└───────┴─────────────────────────┘
```

**Characteristics**:
- Fixed sidebar always visible
- Sidebar width: 320px
- Content: responsive container with max-width
- No hamburger menu
- Vertical scroll on content area only

### 7.3 Tablet Layout (768px - 1024px)

**Option 1**: Behave like desktop (sidebar visible)
**Option 2**: Behave like mobile (drawer navigation)

**Decision**: Use mobile strategy for simplicity (YAGNI principle)
- Can add tablet-specific layout later if user feedback requires it
- Reduces complexity in initial implementation

---

## 8. Component Communication

### 8.1 State Management

**Responsive State**:
- Managed by `useResponsive` hook
- Read-only state exposed to components
- Updates on window resize (debounced)
- SSR-safe with default values

**Navigation State**:
- Drawer open/closed: Local state in MobileDrawer
- Active route: Read from Next.js router (usePathname)
- User data: Zustand authStore (existing)

**No Global State Needed**:
- Responsive state via hook (not context)
- Each component independently responsive
- Avoids unnecessary re-renders

### 8.2 Event Flow

**User Opens Mobile Menu**:
```
User taps hamburger
  → MobileHeader setState(open: true)
  → MobileDrawer renders with open={true}
  → Sheet component slides in (Framer Motion)
  → Backdrop rendered
```

**User Selects Navigation Item**:
```
User taps "Living Room"
  → Next.js router.push('/app/rooms/living-room')
  → MobileDrawer setState(open: false)
  → Sheet slides out
  → Page navigates
```

**Window Resize**:
```
Window resized
  → matchMedia change event fires
  → useResponsive updates breakpoint state
  → ResponsiveLayout re-renders
  → Correct strategy selected
  → No flash/flicker (CSS handles layout)
```

---

## 9. Performance Optimization

### 9.1 Optimization Strategies

**1. Debounced Resize Listener**:
```typescript
// Only update breakpoint on significant changes
const debouncedResize = debounce(updateBreakpoint, 150);
```

**2. CSS-Based Layout Shifts**:
- Use Tailwind responsive classes (`md:flex`, `lg:grid`)
- Browser handles layout, not JavaScript
- Zero re-render overhead for visual changes

**3. Lazy Loading**:
```typescript
// Only load drawer content when opened
const MobileDrawer = lazy(() => import('./MobileDrawer'));

{isOpen && <Suspense fallback={null}><MobileDrawer /></Suspense>}
```

**4. Memoization**:
```typescript
// Prevent re-renders of navigation items
const NavigationItems = React.memo(({ items }) => {
  return items.map(item => <NavItem key={item.id} {...item} />);
});
```

**5. Virtual Scrolling** (if needed):
- For long navigation lists (>50 items)
- Use `react-window` or `react-virtual`
- Only render visible items

### 9.2 Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Drawer Animation | 60fps | Chrome DevTools Performance |
| Layout Shift (CLS) | < 0.1 | Lighthouse |
| Re-render Time | < 16ms | React DevTools Profiler |
| Bundle Size Impact | < 10KB | Webpack Bundle Analyzer |

---

## 10. Testing Strategy

### 10.1 Unit Tests

**useResponsive Hook**:
```typescript
describe('useResponsive', () => {
  it('detects mobile breakpoint', () => {
    window.innerWidth = 375;
    const { result } = renderHook(() => useResponsive());
    expect(result.current.isMobile).toBe(true);
  });

  it('detects desktop breakpoint', () => {
    window.innerWidth = 1440;
    const { result } = renderHook(() => useResponsive());
    expect(result.current.isDesktop).toBe(true);
  });

  it('updates on window resize', () => {
    const { result, rerender } = renderHook(() => useResponsive());
    act(() => {
      window.innerWidth = 375;
      window.dispatchEvent(new Event('resize'));
    });
    rerender();
    expect(result.current.isMobile).toBe(true);
  });
});
```

### 10.2 Component Tests

**ResponsiveLayout**:
```typescript
describe('ResponsiveLayout', () => {
  it('renders mobile strategy on small screens', () => {
    mockUseResponsive({ isMobile: true });
    render(<ResponsiveLayout context="app">Content</ResponsiveLayout>);
    expect(screen.getByRole('button', { name: /menu/i })).toBeInTheDocument();
  });

  it('renders desktop strategy on large screens', () => {
    mockUseResponsive({ isDesktop: true });
    render(<ResponsiveLayout context="app">Content</ResponsiveLayout>);
    expect(screen.queryByRole('button', { name: /menu/i })).not.toBeInTheDocument();
    expect(screen.getByRole('complementary')).toBeInTheDocument(); // sidebar
  });
});
```

### 10.3 Visual Regression Tests

**Breakpoint Snapshots**:
```typescript
// Using Playwright
test('responsive layout - mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/app');
  await expect(page).toHaveScreenshot('mobile-app-layout.png');
});

test('responsive layout - desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/app');
  await expect(page).toHaveScreenshot('desktop-app-layout.png');
});
```

---

## 11. Migration Path

### 11.1 Backward Compatibility

**Requirement**: Zero breaking changes to desktop experience

**Strategy**:
1. Create new components alongside existing ones
2. Use feature flag for gradual rollout
3. Desktop users see identical experience initially
4. Mobile users get new responsive layout

**Feature Flag**:
```typescript
// lib/env/config.ts
export const USE_RESPONSIVE_LAYOUT =
  process.env.NEXT_PUBLIC_USE_RESPONSIVE_LAYOUT === 'true';

// app/layout.tsx
{USE_RESPONSIVE_LAYOUT ? (
  <BaseLayout context="app">{children}</BaseLayout>
) : (
  <LegacyLayout context="app">{children}</BaseLayout>
)}
```

### 11.2 Rollout Phases

**Phase 1**: Foundation (2-3 hours)
- Create useResponsive hook
- Create ResponsiveContainer
- Test on demo page

**Phase 2**: Mobile Navigation (2-3 hours)
- Create MobileHeader
- Create MobileDrawer
- Integrate with Sheet component

**Phase 3**: Layout Refactor (2-3 hours)
- Create BaseLayout
- Refactor app/admin layouts
- Enable feature flag in development

**Phase 4**: Sidebar Split (3-4 hours)
- Extract SidebarHeader/Content/Footer
- Create DesktopSidebar composition
- Update SharedSidebar to use new structure

**Phase 5**: Testing & Polish (2-3 hours)
- Visual regression tests
- Performance testing
- Real device testing
- Bug fixes

---

## 12. Technical Debt and Refactoring Plan

### 12.1 Current Technical Debt

| Issue | Priority | Impact | Effort | Plan |
|-------|----------|--------|--------|------|
| Layout code duplication | HIGH | 78 duplicate lines | 2h | Phase 3: Create BaseLayout |
| SharedSidebar too large (311 lines) | MEDIUM | Maintainability | 3h | Phase 4: Split into 4 components |
| Hard-coded breakpoints | LOW | Flexibility | 1h | Use Tailwind config |
| No responsive utilities | HIGH | Code duplication | 2h | Phase 1: Create ResponsiveContainer |

### 12.2 Debt Elimination Strategy

**Immediate** (Phase 1-2):
- Create responsive foundation (useResponsive, ResponsiveContainer)
- Establishes patterns for future components
- Eliminates need for scattered breakpoint checks

**Short-term** (Phase 3-4):
- Refactor layouts to eliminate duplication
- Split large components
- Achieve <3% code duplication target

**Long-term** (Post-implementation):
- Monitor for new responsive patterns
- Create additional responsive utilities as needed
- Document responsive best practices

### 12.3 Code Quality Maintenance

**Enforcement**:
- ESLint rule: max-lines-per-function = 20
- ESLint rule: max-lines = 200
- Pre-commit hook: Run linter
- CI/CD: Automated code quality checks

**Monitoring**:
- SonarQube code duplication analysis
- Lighthouse performance monitoring
- Bundle size tracking
- Component complexity metrics

---

## 13. Security and Accessibility

### 13.1 Security Considerations

**Responsive Concerns**:
- No sensitive data exposure via responsive behavior
- Drawer state not persisted (security risk if logged out)
- No URL parameters for layout state (prevent manipulation)

**Implementation**:
- Drawer closes on auth state change
- No localStorage for sensitive breakpoint overrides
- Sanitize any user-provided navigation items

### 13.2 Accessibility (A11Y)

**WCAG 2.1 AA Compliance**:

**Keyboard Navigation**:
- Hamburger menu: Enter/Space to open
- Drawer: Escape to close
- Focus trap in drawer when open
- Tab navigation through menu items

**Screen Reader**:
```tsx
<button
  aria-label="Open navigation menu"
  aria-expanded={isOpen}
  aria-controls="mobile-drawer"
>
  <Menu aria-hidden="true" />
</button>

<Sheet
  id="mobile-drawer"
  role="navigation"
  aria-label="Main navigation"
>
  {/* Navigation items */}
</Sheet>
```

**Touch Targets**:
- Minimum 44x44px for all interactive elements
- 8px spacing between touch targets
- Visible focus indicators (outline)

**Color Contrast**:
- All text meets 4.5:1 contrast ratio
- Dark mode maintains contrast
- Focus indicators: 3:1 contrast

---

## 14. Documentation Requirements

### 14.1 Code Documentation

**JSDoc for All Exports**:
```typescript
/**
 * Responsive layout hook
 *
 * Detects current breakpoint and provides responsive state.
 * Uses matchMedia API for efficient breakpoint detection.
 *
 * @returns {IResponsiveBreakpoint} Current breakpoint state
 *
 * @example
 * const { isMobile, isDesktop } = useResponsive();
 * if (isMobile) {
 *   return <MobileLayout />;
 * }
 */
export const useResponsive = (): IResponsiveBreakpoint => {
  // Implementation
};
```

### 14.2 Storybook Stories

**Component Stories**:
```tsx
// ResponsiveLayout.stories.tsx
export default {
  title: 'Layout/ResponsiveLayout',
  component: ResponsiveLayout,
  parameters: {
    viewport: {
      viewports: {
        mobile: { width: 375, height: 667 },
        tablet: { width: 768, height: 1024 },
        desktop: { width: 1440, height: 900 },
      },
    },
  },
};

export const Mobile = () => <ResponsiveLayout context="app">Content</ResponsiveLayout>;
Mobile.parameters = { viewport: { defaultViewport: 'mobile' } };

export const Desktop = () => <ResponsiveLayout context="app">Content</ResponsiveLayout>;
Desktop.parameters = { viewport: { defaultViewport: 'desktop' } };
```

### 14.3 README Updates

**Architecture Diagram**:
```markdown
## Responsive Layout Architecture

├── useResponsive() - Breakpoint detection
├── ResponsiveLayout - Strategy orchestrator
│   ├── Mobile Strategy
│   │   ├── MobileHeader (hamburger menu)
│   │   └── MobileDrawer (navigation)
│   └── Desktop Strategy
│       └── DesktopSidebar
│           ├── SidebarHeader (user info)
│           ├── SidebarContent (navigation)
│           └── SidebarFooter (actions)
└── ResponsiveContainer - Content wrapper
```

---

## 15. Success Metrics and KPIs

### 15.1 Code Quality Metrics

| Metric | Target | Current | Tracking |
|--------|--------|---------|----------|
| Code Duplication | < 3% | ~20% (layouts) | SonarQube |
| Component Size | < 200 lines | 311 lines (SharedSidebar) | ESLint |
| Function Size | < 20 lines | Compliant | ESLint |
| Test Coverage | > 80% | TBD | Jest |

### 15.2 Performance Metrics

| Metric | Target | Measurement Tool |
|--------|--------|------------------|
| Mobile Page Load | < 3s on 3G | Lighthouse |
| Layout Shift (CLS) | < 0.1 | Lighthouse |
| First Contentful Paint | < 1.8s | Lighthouse |
| Drawer Animation | 60fps | Chrome DevTools |

### 15.3 User Experience Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Mobile Task Completion | > 95% | User testing |
| Mobile Error Rate | < 5% | Analytics |
| Mobile Satisfaction | > 4.5/5 | User survey |

---

## 16. Risks and Mitigation

### 16.1 Technical Risks

**Risk: Performance degradation on low-end devices**
- **Probability**: Medium
- **Impact**: High
- **Mitigation**:
  - Performance testing on low-end Android devices
  - Reduce animation complexity if needed
  - Progressive enhancement approach

**Risk: Existing desktop layout breaks**
- **Probability**: Low
- **Impact**: High
- **Mitigation**:
  - Feature flag rollout
  - Comprehensive visual regression tests
  - Gradual rollout strategy

**Risk: Complex controls difficult on small screens**
- **Probability**: High
- **Impact**: Medium
- **Mitigation**:
  - Increase touch target sizes
  - Simplify mobile controls
  - User testing and iteration

---

## 17. Approval and Next Steps

### 17.1 Design Approval Checklist
- [ ] Clean code principles validated (DRY, SOLID, YAGNI)
- [ ] Design pattern analysis complete (Strategy Pattern selected)
- [ ] Architecture quality assessed (separation of concerns, cohesion, coupling)
- [ ] Component breakdown verified (all < 200 lines)
- [ ] Interface definitions complete
- [ ] Performance strategy defined
- [ ] Testing strategy approved
- [ ] Migration path defined

### 17.2 Next Steps
1. **Get user approval** of technical design
2. **Create implementation plan** (implementation.md)
3. **Set up development environment** (feature branch)
4. **Begin Phase 1 implementation** (useResponsive hook)

---

**Document Status**: READY FOR REVIEW
**Created**: 2025-10-04
**Last Updated**: 2025-10-04
**Version**: 1.0
**Next Document**: implementation.md
