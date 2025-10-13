import { renderHook, act } from '@testing-library/react';
import { useMobileBackButton } from '../useMobileBackButton';

// Mock Next.js router
const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
  }),
  usePathname: () => '/test-path',
}));

// Mock window.history
const mockHistoryPushState = jest.fn();
const mockHistoryBack = jest.fn();

Object.defineProperty(window, 'history', {
  value: {
    pushState: mockHistoryPushState,
    back: mockHistoryBack,
    length: 2,
  },
  writable: true,
});

describe('useMobileBackButton', () => {
  let mockAddEventListener: jest.SpyInstance;
  let mockRemoveEventListener: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockAddEventListener = jest.spyOn(window, 'addEventListener');
    mockRemoveEventListener = jest.spyOn(window, 'removeEventListener');
  });

  afterEach(() => {
    mockAddEventListener.mockRestore();
    mockRemoveEventListener.mockRestore();
  });

  it('should add history entry and event listener when enabled', () => {
    const { result } = renderHook(() => 
      useMobileBackButton({ enabled: true })
    );

    expect(mockHistoryPushState).toHaveBeenCalledWith(
      { interceptBack: true, originalPath: '/test-path' },
      '',
      '/test-path'
    );
    
    expect(mockAddEventListener).toHaveBeenCalledWith('popstate', expect.any(Function));
    expect(result.current.isActive).toBe(true);
  });

  it('should not add history entry when disabled', () => {
    renderHook(() => useMobileBackButton({ enabled: false }));

    expect(mockHistoryPushState).not.toHaveBeenCalled();
    expect(mockAddEventListener).not.toHaveBeenCalled();
  });

  it('should call custom onBackPressed handler when back button is pressed', () => {
    const mockOnBackPressed = jest.fn();
    
    renderHook(() => 
      useMobileBackButton({ 
        enabled: true, 
        onBackPressed: mockOnBackPressed 
      })
    );

    // Get the popstate handler
    const popstateHandler = mockAddEventListener.mock.calls.find(
      call => call[0] === 'popstate'
    )?.[1];

    expect(popstateHandler).toBeDefined();

    // Simulate popstate event with our intercepted state
    act(() => {
      popstateHandler({
        state: { interceptBack: true }
      });
    });

    expect(mockOnBackPressed).toHaveBeenCalledTimes(1);
  });

  it('should navigate back when no custom handler is provided', async () => {
    renderHook(() => 
      useMobileBackButton({ enabled: true })
    );

    // Get the popstate handler
    const popstateHandler = mockAddEventListener.mock.calls.find(
      call => call[0] === 'popstate'
    )?.[1];

    expect(popstateHandler).toBeDefined();

    // Simulate popstate event
    await act(async () => {
      await popstateHandler({
        state: { interceptBack: true }
      });
    });

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('should navigate to fallback route when no history available', async () => {
    // Mock history with length 1 (no previous pages)
    Object.defineProperty(window, 'history', {
      value: {
        pushState: mockHistoryPushState,
        back: mockHistoryBack,
        length: 1,
      },
      writable: true,
    });

    renderHook(() => 
      useMobileBackButton({ 
        enabled: true, 
        fallbackRoute: '/custom-fallback'
      })
    );

    // Get the popstate handler
    const popstateHandler = mockAddEventListener.mock.calls.find(
      call => call[0] === 'popstate'
    )?.[1];

    // Simulate popstate event
    await act(async () => {
      await popstateHandler({
        state: { interceptBack: true }
      });
    });

    expect(mockPush).toHaveBeenCalledWith('/custom-fallback');
  });

  it('should prevent default navigation when preventDefault is true', () => {
    renderHook(() => 
      useMobileBackButton({ 
        enabled: true, 
        preventDefault: true 
      })
    );

    // Get the popstate handler
    const popstateHandler = mockAddEventListener.mock.calls.find(
      call => call[0] === 'popstate'
    )?.[1];

    // Clear previous calls
    mockHistoryPushState.mockClear();

    // Simulate popstate event
    act(() => {
      popstateHandler({
        state: { interceptBack: true }
      });
    });

    // Should re-add history entry to prevent navigation
    expect(mockHistoryPushState).toHaveBeenCalledTimes(1);
  });

  it('should not handle popstate events when not intercepted', () => {
    const mockOnBackPressed = jest.fn();
    
    renderHook(() => 
      useMobileBackButton({ 
        enabled: true, 
        onBackPressed: mockOnBackPressed 
      })
    );

    const popstateHandler = mockAddEventListener.mock.calls.find(
      call => call[0] === 'popstate'
    )?.[1];

    // Simulate regular popstate event (not intercepted)
    act(() => {
      popstateHandler({
        state: { someOtherState: true }
      });
    });

    expect(mockOnBackPressed).not.toHaveBeenCalled();
  });

  it('should provide manual goBack function', async () => {
    const mockOnBackPressed = jest.fn();
    
    const { result } = renderHook(() => 
      useMobileBackButton({ 
        enabled: true, 
        onBackPressed: mockOnBackPressed 
      })
    );

    await act(async () => {
      await result.current.goBack();
    });

    expect(mockOnBackPressed).toHaveBeenCalledTimes(1);
  });

  it('should provide enable/disable functions', () => {
    const { result } = renderHook(() => 
      useMobileBackButton({ enabled: false })
    );

    // Initially disabled
    expect(mockHistoryPushState).not.toHaveBeenCalled();

    // Enable
    act(() => {
      result.current.enable();
    });

    // Should add history entry
    expect(mockHistoryPushState).toHaveBeenCalled();

    // Disable
    act(() => {
      result.current.disable();
    });

    // Should remove history entry
    expect(mockHistoryBack).toHaveBeenCalled();
  });

  it('should clean up event listeners on unmount', () => {
    const { unmount } = renderHook(() => 
      useMobileBackButton({ enabled: true })
    );

    expect(mockAddEventListener).toHaveBeenCalledWith('popstate', expect.any(Function));

    unmount();

    expect(mockRemoveEventListener).toHaveBeenCalledWith('popstate', expect.any(Function));
    expect(mockHistoryBack).toHaveBeenCalled(); // Clean up history entry
  });

  it('should handle errors gracefully', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    mockBack.mockImplementation(() => {
      throw new Error('Navigation error');
    });

    renderHook(() => 
      useMobileBackButton({ enabled: true })
    );

    const popstateHandler = mockAddEventListener.mock.calls.find(
      call => call[0] === 'popstate'
    )?.[1];

    await act(async () => {
      await popstateHandler({
        state: { interceptBack: true }
      });
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error handling back button press:',
      expect.any(Error)
    );
    expect(mockPush).toHaveBeenCalledWith('/'); // Fallback to default route

    consoleErrorSpy.mockRestore();
  });
});