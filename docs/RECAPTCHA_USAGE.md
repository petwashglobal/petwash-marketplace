# 🔒 Ultra-Modern reCAPTCHA Integration Guide

## Overview
Pet Wash™️ now features a premium, luxury-styled reCAPTCHA component for bot protection on signin and payment pages. The design matches the "super lux leading brand 2025" aesthetic with advanced glassmorphism, smooth animations, and elegant security badges.

## ✨ Features

### Premium Design (2025 Luxury Standard)
- **Advanced Glassmorphism**: Backdrop-blur-2xl with premium shadows
- **Animated Security Badges**: Shield, Lock, and CheckCircle2 icons with smooth transitions
- **Gradient Glow Effects**: Hover states with primary color gradients
- **Verified State**: Green ring indicator with animated check mark
- **Loading State**: Pulsing animations with security message
- **Premium Typography**: Wide tracking, relaxed spacing, 16px base size

### Security Features
- Standard Google reCAPTCHA v2 integration
- Server-side token verification
- Expired token handling
- Error callback support
- Supports both v2 checkbox and invisible modes

## 🚀 Quick Start

### 1. Environment Setup

Add these secrets to your Replit project (if not already set):

```env
VITE_RECAPTCHA_SITE_KEY=your_site_key_here
RECAPTCHA_SECRET_KEY=your_secret_key_here
```

Get your keys from: https://www.google.com/recaptcha/admin

### 2. Basic Usage

```tsx
import { ReCaptcha } from '@/components/ReCaptcha';

function SignInForm() {
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);

  const handleRecaptchaVerify = (token: string) => {
    console.log('reCAPTCHA verified!', token);
    setRecaptchaToken(token);
    // Now you can submit your form with the token
  };

  const handleRecaptchaError = (error: Error) => {
    console.error('reCAPTCHA error:', error);
    setRecaptchaToken(null);
  };

  return (
    <form>
      {/* Your form fields */}
      <Input type="email" placeholder="Email" />
      <Input type="password" placeholder="Password" />
      
      {/* Premium reCAPTCHA */}
      <ReCaptcha 
        onVerify={handleRecaptchaVerify}
        onError={handleRecaptchaError}
        theme="light" // or "dark"
        size="normal"  // or "compact"
      />
      
      <Button type="submit" disabled={!recaptchaToken}>
        Sign In
      </Button>
    </form>
  );
}
```

### 3. Form Submission with Verification

```tsx
const handleSubmit = async (e: FormEvent) => {
  e.preventDefault();
  
  if (!recaptchaToken) {
    toast.error('Please complete the security verification');
    return;
  }

  try {
    // Verify token on backend
    const verifyResponse = await fetch('/api/recaptcha/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: recaptchaToken })
    });

    const verifyData = await verifyResponse.json();
    
    if (!verifyData.success) {
      toast.error('Security verification failed. Please try again.');
      return;
    }

    // Token is valid, proceed with your form submission
    const response = await fetch('/api/auth/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: formData.email,
        password: formData.password,
        recaptchaToken // Include token in your request
      })
    });

    // Handle response...
  } catch (error) {
    console.error('Error:', error);
  }
};
```

## 🎨 Component Variants

### Standard Visible reCAPTCHA (Recommended for Signin)

```tsx
<ReCaptcha 
  onVerify={handleVerify}
  onError={handleError}
  size="normal"
  theme="light"
/>
```

### Compact Version (For Tight Spaces)

```tsx
<ReCaptcha 
  onVerify={handleVerify}
  onError={handleError}
  size="compact"
  theme="dark"
/>
```

### Invisible reCAPTCHA (Minimal UI)

```tsx
import { InvisibleReCaptcha } from '@/components/ReCaptcha';

<InvisibleReCaptcha 
  onVerify={handleVerify}
  onError={handleError}
/>
```

## 🔐 Backend Verification

The verification endpoint is already set up at `/api/recaptcha/verify`:

```typescript
// POST /api/recaptcha/verify
{
  "token": "03AGdBq25..."
}

// Response (success)
{
  "success": true,
  "score": 0.9, // For v3 only
  "action": "submit", // For v3 only
  "challenge_ts": "2025-10-27T04:00:00Z",
  "hostname": "www.petwash.co.il"
}

// Response (failure)
{
  "success": false,
  "error": "Invalid reCAPTCHA token"
}
```

## 📋 Integration Checklist

### For Signin Page
- [x] Component created with luxury design
- [x] Backend verification endpoint ready
- [ ] Add ReCaptcha to SignIn.tsx form
- [ ] Add recaptchaToken to signin request body
- [ ] Verify token on backend before authentication
- [ ] Handle expired/error states with user-friendly messages

### For Payment Page
- [ ] Import ReCaptcha component
- [ ] Add to payment form
- [ ] Verify token before processing payment
- [ ] Show premium loading state during verification

## 🎯 Best Practices

1. **Always Verify Server-Side**: Never trust client-side validation alone
2. **Handle Expiration**: Tokens expire after 2 minutes - implement retry logic
3. **Error Messages**: Show user-friendly messages for failures
4. **Loading States**: Disable submit button while reCAPTCHA is loading
5. **Dark Mode**: The component auto-adapts to your theme
6. **Accessibility**: Component includes ARIA labels and keyboard support

## 🐛 Troubleshooting

### Token Verification Fails
- Check that VITE_RECAPTCHA_SITE_KEY and RECAPTCHA_SECRET_KEY are from the same reCAPTCHA key pair
- Verify keys are properly set in Replit secrets
- Check browser console for error messages

### Widget Not Appearing
- Ensure Google reCAPTCHA script is loading (check Network tab)
- Verify no ad blockers are blocking the widget
- Check for JavaScript errors in console

### Styling Issues
- Component uses Tailwind CSS - ensure Tailwind is properly configured
- Dark mode requires `darkMode: ["class"]` in tailwind.config.ts
- Check that all required imports are available

## 🚀 Next Steps

1. **Integrate into SignIn.tsx**: Add the component to your signin form
2. **Integrate into Payment Forms**: Add to checkout and payment pages
3. **Test End-to-End**: Verify the full flow works from UI to backend
4. **Monitor**: Check logs for verification attempts and failures
5. **Optimize**: Consider using invisible reCAPTCHA for smoother UX

## 📚 Resources

- [Google reCAPTCHA Documentation](https://developers.google.com/recaptcha/docs/display)
- [Component Source Code](../client/src/components/ReCaptcha.tsx)
- [Backend Verification](../server/routes/recaptcha.ts)
- [Pet Wash™️ Design System](../docs/DESIGN_SYSTEM.md)

---

**Created**: October 27, 2025  
**Status**: ✅ Ready for integration  
**Design**: Premium luxury 2025 standard  
**Security**: Banking-level bot protection
