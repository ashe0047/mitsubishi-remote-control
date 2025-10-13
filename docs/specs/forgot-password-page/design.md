# Forgot Password Page - Technical Design

## Architecture Overview

### Component Structure
```
/src/app/forgot-password/
├── page.tsx                 # Main page component
└── loading.tsx             # Loading state (optional)

/src/components/auth/
├── ForgotPasswordForm.tsx   # Reset form component
└── ForgotPasswordForm.test.tsx # Component tests
```

### Integration Points
- **Auth Store**: `useAuthStore()` for state management
- **API Client**: Password reset endpoint integration
- **Toast System**: User feedback notifications
- **Router**: Navigation back to login

## Design Patterns

### 1. Form Architecture
Following existing auth form patterns from `LoginForm.tsx` and `RegisterForm.tsx`:

```typescript
interface ForgotPasswordFormState {
  email: string;
  isLoading: boolean;
  isSubmitted: boolean;
  errors: Record<string, string>;
}
```

### 2. API Integration
Extend existing auth API client:

```typescript
// /src/lib/api/auth-client.ts
export const authApi = {
  // ... existing methods
  requestPasswordReset: async (email: string): Promise<void> => {
    const response = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    if (!response.ok) {
      throw new Error('Failed to send reset email');
    }
  }
};
```

### 3. State Management
Utilize existing auth store patterns:

```typescript
// /src/stores/auth-store.ts
interface AuthStore {
  // ... existing state
  requestPasswordReset: (email: string) => Promise<void>;
  resetPasswordState: {
    isLoading: boolean;
    isSubmitted: boolean;
    error: string | null;
  };
}
```

## Component Design

### ForgotPasswordForm Component

**Props Interface**:
```typescript
interface ForgotPasswordFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}
```

**State Management**:
```typescript
const [formState, setFormState] = useState<ForgotPasswordFormState>({
  email: '',
  isLoading: false,
  isSubmitted: false,
  errors: {}
});
```

**Validation Logic**:
```typescript
const validateEmail = (email: string): string | null => {
  if (!email) return 'Email is required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'Please enter a valid email address';
  }
  return null;
};
```

## UI/UX Design

### Layout Structure
```jsx
<div className="min-h-screen flex items-center justify-center">
  <Card className="w-full max-w-md">
    <CardHeader>
      <BackButton />
      <CardTitle>Reset Password</CardTitle>
      <CardDescription>
        Enter your email to receive reset instructions
      </CardDescription>
    </CardHeader>
    <CardContent>
      <ForgotPasswordForm />
    </CardContent>
  </Card>
</div>
```

### Form States

**Initial State**:
- Email input field
- Submit button enabled
- Clear instructions

**Loading State**:
- Disabled form inputs
- Loading spinner on submit button
- "Sending..." text

**Success State**:
- Success message with check icon
- "Return to Login" button
- Email confirmation text

**Error State**:
- Error message display
- Form remains editable
- Retry capability

## Security Considerations

### Rate Limiting
```typescript
// Client-side rate limiting
const RATE_LIMIT = {
  maxAttempts: 3,
  windowMs: 15 * 60 * 1000, // 15 minutes
};

const checkRateLimit = (email: string): boolean => {
  const attempts = getStoredAttempts(email);
  return attempts.length < RATE_LIMIT.maxAttempts;
};
```

### Input Sanitization
```typescript
const sanitizeEmail = (email: string): string => {
  return email.trim().toLowerCase();
};
```

### CSRF Protection
- Use existing CSRF token patterns
- Validate referrer headers
- Implement double-submit cookies

## Error Handling

### Error Categories
1. **Validation Errors**: Client-side form validation
2. **Network Errors**: Connection or timeout issues
3. **Server Errors**: Backend processing failures
4. **Rate Limit Errors**: Too many requests

### Error Display Strategy
```typescript
const errorMessages = {
  'EMAIL_NOT_FOUND': 'If this email is registered, you will receive reset instructions.',
  'RATE_LIMITED': 'Too many requests. Please try again in 15 minutes.',
  'NETWORK_ERROR': 'Connection failed. Please check your internet and try again.',
  'SERVER_ERROR': 'Service temporarily unavailable. Please try again later.',
  'INVALID_EMAIL': 'Please enter a valid email address.'
};
```

## Performance Optimization

### Code Splitting
```typescript
// Lazy load the form component
const ForgotPasswordForm = lazy(() => import('@/components/auth/ForgotPasswordForm'));
```

### Debounced Validation
```typescript
const debouncedValidation = useCallback(
  debounce((email: string) => {
    const error = validateEmail(email);
    setErrors(prev => ({ ...prev, email: error }));
  }, 300),
  []
);
```

## Testing Strategy

### Unit Tests
```typescript
describe('ForgotPasswordForm', () => {
  it('validates email format correctly');
  it('displays loading state during submission');
  it('shows success message after successful submission');
  it('handles rate limiting appropriately');
  it('displays appropriate error messages');
});
```

### Integration Tests
```typescript
describe('Forgot Password Flow', () => {
  it('navigates from login to forgot password page');
  it('sends reset email and shows confirmation');
  it('handles backend errors gracefully');
  it('respects rate limiting rules');
});
```

## Accessibility Implementation

### ARIA Labels
```jsx
<form aria-label="Password reset form">
  <Input
    aria-label="Email address"
    aria-describedby="email-error"
    aria-invalid={!!errors.email}
  />
  <div id="email-error" role="alert">
    {errors.email}
  </div>
</form>
```

### Keyboard Navigation
- Tab order follows logical flow
- Enter key submits form
- Escape key cancels/returns to login
- Focus management for error states

### Screen Reader Support
- Proper heading hierarchy
- Status announcements for form submission
- Error message associations
- Loading state announcements

## Backend Integration

### API Endpoint Design
```typescript
// POST /api/auth/forgot-password
interface ForgotPasswordRequest {
  email: string;
}

interface ForgotPasswordResponse {
  success: boolean;
  message: string;
}
```

### Expected Backend Behavior
1. **Email Validation**: Verify format and domain
2. **User Lookup**: Check if email exists (don't reveal if not)
3. **Token Generation**: Create secure reset token
4. **Email Sending**: Queue reset email
5. **Rate Limiting**: Enforce request limits
6. **Logging**: Security event logging

## Future Enhancements

### Potential Improvements
1. **Magic Link**: Alternative to traditional password reset
2. **SMS Reset**: Phone number verification option
3. **Social Recovery**: OAuth provider password reset
4. **Security Questions**: Additional verification layer

### Metrics and Analytics
- Track reset request volume
- Monitor success/failure rates
- Measure user flow completion
- Identify common error patterns