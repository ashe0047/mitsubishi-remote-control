import { renderHook, act, waitFor } from '@testing-library/react';
import { useNavigateBack } from '../useNavigateBack';

// Mock Next.js navigation hooks
const mockPush = jest.fn();
const mockBack = jest.fn();
const mockPathname = '/rooms/test-room';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
  }),
  usePathname: () => mockPathname,
}));

// Mock custom hooks
jest.mock('@/hooks/use-haptic', () => ({
  useHaptic: () => jest.fn(),
}));

jest.mock('@/hooks/use-mobile', () => ({
  useMobile: () => ({ isMobile: false }),
}));

// Mock window.confirm
const mockConfirm = jest.fn();
Object.defineProperty(window, 'confirm', {
  value: mockConfirm,
  writable: true,
});

// Mock window.history
Object.defineProperty(window, 'history', {
  value: { length: 2 },
  writable: true,
});

describe('useNavigateBack', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConfirm.mockReturnValue(true);
  });

  describe('canGoBack logic', () => {
    it('should determine canGoBack based on history and pathname', () => {
      const { result } = renderHook(() => useNavigateBack());
      
      expect(result.current.canGoBack).toBe(true);
    });

    it('should set canGoBack to false for home page', () => {
      jest.doMock('next/navigation', () => ({
        useRouter: () => ({ push: mockPush, back: mockBack }),
        usePathname: () => '/',
      }));
      
      const { result } = renderHook(() => useNavigateBack());
      expect(result.current.canGoBack).toBe(false);
    });
  });

  describe('navigateBack function', () => {
    it('should call router.back() when canGoBack is true', async () => {
      const { result } = renderHook(() => useNavigateBack());
      
      await act(async () => {
        result.current.navigateBack();
      });
      
      expect(mockBack).toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('should call router.push with fallback route when canGoBack is false', async () => {
      // Mock canGoBack as false
      Object.defineProperty(window, 'history', {
        value: { length: 1 },
        writable: true,
      });
      
      const fallbackRoute = '/custom-home';
      const { result } = renderHook(() => 
        useNavigateBack({ fallbackRoute })
      );
      
      await act(async () => {
        result.current.navigateBack();
      });
      
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(fallbackRoute);
      });
    });

    it('should prevent duplicate navigation attempts', async () => {
      const { result } = renderHook(() => useNavigateBack());
      
      // Start first navigation
      act(() => {
        result.current.navigateBack();
      });
      
      // Attempt second navigation while first is in progress
      act(() => {
        result.current.navigateBack();
      });
      
      // Should only call back once
      expect(mockBack).toHaveBeenCalledTimes(1);
    });

    it('should handle confirmation dialog', async () => {
      mockConfirm.mockReturnValue(false);
      
      const { result } = renderHook(() => 
        useNavigateBack({ confirmNavigation: true })
      );
      
      await act(async () => {
        result.current.navigateBack();
      });
      
      expect(mockConfirm).toHaveBeenCalled();
      expect(mockBack).not.toHaveBeenCalled();
      expect(result.current.isNavigating).toBe(false);
    });

    it('should handle navigation errors with fallback', async () => {
      mockBack.mockRejectedValue(new Error('Navigation failed'));
      
      const { result } = renderHook(() => useNavigateBack());
      
      await act(async () => {
        result.current.navigateBack();
      });
      
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/');
      });
    });

    it('should set and reset isNavigating state', async () => {
      const { result } = renderHook(() => useNavigateBack());
      
      expect(result.current.isNavigating).toBe(false);
      
      act(() => {
        result.current.navigateBack();
      });
      
      expect(result.current.isNavigating).toBe(true);
      
      // Wait for navigation to complete
      await waitFor(() => {
        expect(result.current.isNavigating).toBe(false);
      }, { timeout: 500 });
    });
  });

  describe('event listeners', () => {
    it('should add and remove popstate event listener', () => {
      const addEventListenerSpy = jest.spyOn(window, 'addEventListener');
      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');
      
      const { unmount } = renderHook(() => useNavigateBack());
      
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'popstate',
        expect.any(Function)
      );
      
      unmount();
      
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'popstate',
        expect.any(Function)
      );
    });
  });
});