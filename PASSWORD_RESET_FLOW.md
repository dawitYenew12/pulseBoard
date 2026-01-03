# Password Reset Flow - Email-Based Implementation

## Overview
This document describes the password reset flow implementation using email verification. The flow consists of two main endpoints:
1. **Forgot Password** - Request a password reset
2. **Reset Password** - Actually reset the password using a token

## Flow Diagram

```
User                    Frontend                Backend                 Email Service
│                           │                       │                         │
│  Forgot password          │                       │                         │
├──────────────────────────>│                       │                         │
│                           │  POST /forgot-password│                         │
│                           ├──────────────────────>│                         │
│                           │                       │                         │
│                           │                       │ Generate reset token    │
│                           │                       ├─────────────┐           │
│                           │                       │             │           │
│                           │                       │<────────────┘           │
│                           │                       │                         │
│                           │                       │  Send reset email       │
│                           │                       ├────────────────────────>│
│                           │                       │                         │
│                           │  Success message      │                         │
│  "Check your email"       │<──────────────────────┤                         │
│<──────────────────────────┤                       │                         │
│                           │                       │                         │
│                                                    │    Email with token     │
│<───────────────────────────────────────────────────┴─────────────────────────┤
│                                                                               │
│  Click reset link                                                            │
├──────────────────────────>│                                                  │
│                           │                                                  │
│  Enter new password       │                                                  │
├──────────────────────────>│                                                  │
│                           │  POST /reset-password                            │
│                           │  {token, password}                               │
│                           ├──────────────────────>│                          │
│                           │                       │                          │
│                           │                       │ Verify token             │
│                           │                       ├──────────────┐           │
│                           │                       │              │           │
│                           │                       │<─────────────┘           │
│                           │                       │                          │
│                           │                       │ Hash new password        │
│                           │                       ├──────────────┐           │
│                           │                       │              │           │
│                           │                       │<─────────────┘           │
│                           │                       │                          │
│                           │                       │ Update user password     │
│                           │                       ├──────────────┐           │
│                           │                       │              │           │
│                           │                       │<─────────────┘           │
│                           │                       │                          │
│                           │                       │ Delete reset token       │
│                           │                       ├──────────────┐           │
│                           │                       │              │           │
│                           │                       │<─────────────┘           │
│                           │                       │                          │
│  "Password reset          │  Success message      │                          │
│   successfully"           │<──────────────────────┤                          │
│<──────────────────────────┤                       │                          │
│                           │                       │                          │
```

## Endpoints

### 1. Request Password Reset

**Endpoint:** `POST /api/v1/auth/forgot-password`

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "message": "If the email exists, a password reset link has been sent"
}
```

**Status Codes:**
- `200 OK` - Request processed (whether email exists or not)
- `422 Unprocessable Entity` - Invalid email format

**Security Notes:**
- Returns the same success message regardless of whether the email exists to prevent email enumeration attacks
- Token expires in 10 minutes (configurable via `JWT_RESET_PASSWORD_EXPIRATION_MINUTES`)

### 2. Reset Password

**Endpoint:** `POST /api/v1/auth/reset-password`

**Request Body:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "password": "NewSecureP@ssw0rd!"
}
```

**Response:**
```json
{
  "message": "Password reset successfully. You can now log in."
}
```

**Status Codes:**
- `200 OK` - Password reset successfully
- `400 Bad Request` - Invalid or expired token
- `404 Not Found` - User not found
- `422 Unprocessable Entity` - Missing required fields or password doesn't meet requirements

## Implementation Details

### Token Generation and Storage

1. **Token Type:** `RESET_PASSWORD` (added to `TokenType` enum in Prisma schema)
2. **Expiration:** 10 minutes (default, configurable)
3. **Storage:** Tokens are stored in the `Token` table with:
   - `token`: JWT string
   - `userId`: Reference to user
   - `type`: `RESET_PASSWORD`
   - `expires`: Expiration timestamp
   - `revoked`: Boolean flag

### Password Reset Process

1. User requests password reset via `/forgot-password`
2. System checks if email exists (silently fails if not)
3. Generate reset token with `TokenType.RESET_PASSWORD`
4. Send email with reset link containing token
5. User clicks link and is directed to frontend reset password page
6. Frontend submits new password with token to `/reset-password`
7. Backend verifies token validity and expiration
8. Hash new password with bcrypt (salt rounds: 10)
9. Update user's password in database
10. Delete the used reset token (one-time use)
11. User can now log in with new password

### Email Template

Template file: `src/templates/password-reset.hbs`

The email includes:
- Clear subject line: "Password Reset Request - PulseBoard"
- Reset link button
- Plain text link as fallback
- Expiration warning (10 minutes)
- Security reminder about not sharing the email
- Clear instructions for those who didn't request the reset

### Security Features

1. **Email Enumeration Prevention:** Same response whether email exists or not
2. **Token Expiration:** Short-lived tokens (10 minutes)
3. **One-Time Use:** Tokens are deleted after successful password reset
4. **Password Requirements:** Enforced via Zod validation schema
5. **Secure Password Storage:** bcrypt hashing with salt
6. **HTTPS in Production:** Reset URLs use HTTPS in production environment

## Configuration

### Environment Variables

Add to `.env` file:

```env
# JWT Reset Password Token Expiration (in minutes)
JWT_RESET_PASSWORD_EXPIRATION_MINUTES=10
```

### Files Modified/Created

1. **Schema Changes:**
   - `prisma/schema.prisma` - Added `RESET_PASSWORD` to `TokenType` enum

2. **Configuration:**
   - `src/config/config.ts` - Added `resetPasswordTokenMinutes`
   - `src/config/token.ts` - Added `RESET_PASSWORD` token type
   - `src/validations/env.validation.ts` - Added validation for reset token expiration

3. **Services:**
   - `src/services/token.service.ts` - Added `generateResetPasswordToken()`
   - `src/services/email.service.ts` - Added `sendPasswordResetEmail()` and `resetPassword()`
   - `src/services/auth.service.ts` - Added `forgotPassword()`

4. **Controllers:**
   - `src/controllers/auth.controller.ts` - Added `forgotPassword()` and updated `resetPassword()`

5. **Validation:**
   - `src/validations/user.validation.ts` - Added `forgotPasswordSchema` and `resetPasswordSchema`

6. **Routes:**
   - `src/routes/auth.route.ts` - Added `/forgot-password` and `/reset-password` routes

7. **Templates:**
   - `src/templates/password-reset.hbs` - New password reset email template

## Testing the Flow

### Step 1: Request Password Reset

```bash
curl -X POST http://localhost:5000/api/v1/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com"
  }'
```

### Step 2: Check Email

Check your email inbox for the password reset email. Copy the token from the URL.

### Step 3: Reset Password

```bash
curl -X POST http://localhost:5000/api/v1/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "YOUR_RESET_TOKEN_HERE",
    "password": "NewSecureP@ssw0rd!"
  }'
```

### Step 4: Login with New Password

```bash
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "NewSecureP@ssw0rd!"
  }'
```

## Error Handling

### Common Errors

1. **Invalid Token:**
   ```json
   {
     "code": 400,
     "message": "Invalid or expired reset token"
   }
   ```

2. **Expired Token:**
   Same as invalid token (for security, we don't differentiate)

3. **Invalid Email Format:**
   ```json
   {
     "code": 422,
     "message": "Must be a valid email address"
   }
   ```

4. **Weak Password:**
   Password must meet the requirements defined in `src/validations/custom.validation.ts`

## Frontend Integration

### Example React Implementation

```typescript
// Request password reset
const requestPasswordReset = async (email: string) => {
  const response = await fetch('/api/v1/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  
  const data = await response.json();
  return data;
};

// Reset password
const resetPassword = async (token: string, password: string) => {
  const response = await fetch('/api/v1/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
  });
  
  const data = await response.json();
  return data;
};

// Usage in component
const handleForgotPassword = async (e: FormEvent) => {
  e.preventDefault();
  try {
    await requestPasswordReset(email);
    setMessage('Check your email for password reset instructions');
  } catch (error) {
    setError('Failed to send reset email');
  }
};

const handleResetPassword = async (e: FormEvent) => {
  e.preventDefault();
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  
  try {
    await resetPassword(token!, newPassword);
    setMessage('Password reset successfully! You can now log in.');
    // Redirect to login page
    navigate('/login');
  } catch (error) {
    setError('Failed to reset password. Token may be invalid or expired.');
  }
};
```

## Best Practices

1. **Token Expiration:** Keep reset tokens short-lived (10-15 minutes recommended)
2. **One-Time Use:** Always delete tokens after successful use
3. **Email Verification:** Only send reset emails to verified email addresses (optional enhancement)
4. **Rate Limiting:** Consider implementing rate limiting on forgot password endpoint
5. **Audit Logging:** Log password reset attempts for security monitoring
6. **Notification:** Send confirmation email after successful password reset (optional enhancement)

## Future Enhancements

1. Add rate limiting to prevent abuse
2. Send confirmation email after password reset
3. Require email verification before allowing password reset
4. Add support for security questions as an alternative
5. Implement password reset history tracking
6. Add option to invalidate all sessions after password reset
7. Support for magic links (passwordless authentication)

## Related Documentation

- [Email Verification Flow](./EMAIL_VERIFICATION_FLOW.md)
- [Refresh Token Flow](./REFRESH_TOKEN_FLOW.md)
- [Authentication Overview](./AUTHENTICATION.md)
