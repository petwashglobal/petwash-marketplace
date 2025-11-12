# Pet Wash™ - Validation Standards Guide
## Comprehensive Validation Rules for Frontend & Backend

**Last Updated**: October 27, 2025  
**Status**: Production Standard  
**Applies To**: All validation schemas across the platform

---

## 🎯 Core Principles

1. **Clear Error Messages**: Never use Zod's default errors
2. **Consistent Patterns**: Same validation = same error message
3. **User-Friendly Language**: Simple, everyday words (not technical jargon)
4. **Bilingual Support**: Hebrew & English for all user-facing errors

---

## 📋 Standard Validation Patterns

### Email Validation
```typescript
// ✅ CORRECT
email: z.string()
  .min(1, { message: "Email is required" })
  .email({ message: "Please enter a valid email address" })

// ❌ WRONG - No custom messages
email: z.string().email()
```

### Phone Number Validation
```typescript
// ✅ CORRECT - Israeli phone validation
phone: z.string()
  .min(10, { message: "Phone number must be at least 10 digits" })
  .regex(/^(\+972|0)([2-9]\d{7,8})$/, { 
    message: "Please enter a valid Israeli phone number" 
  })
  .optional()

// For international
phone: z.string()
  .min(10, { message: "Phone number must be at least 10 digits" })
  .optional()
```

### Required Text Fields
```typescript
// ✅ CORRECT
firstName: z.string()
  .min(1, { message: "First name is required" })
  .max(50, { message: "First name must be less than 50 characters" })

// ❌ WRONG
firstName: z.string().min(1)
```

### Optional Text Fields
```typescript
// ✅ CORRECT
notes: z.string()
  .max(500, { message: "Notes must be less than 500 characters" })
  .optional()
```

### Password Validation
```typescript
// ✅ CORRECT - Strong password
password: z.string()
  .min(8, { message: "Password must be at least 8 characters" })
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: "Password must include uppercase, lowercase, and numbers"
  })

// ✅ ACCEPTABLE - Basic password
password: z.string()
  .min(6, { message: "Password must be at least 6 characters" })
```

### Date Validation
```typescript
// ✅ CORRECT - ISO date format
birthday: z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { 
    message: "Date must be in YYYY-MM-DD format" 
  })
  .optional()

// ✅ CORRECT - Date object
appointmentDate: z.date({
  required_error: "Appointment date is required",
  invalid_type_error: "Please select a valid date"
})
```

### Number Validation
```typescript
// ✅ CORRECT - Positive integer
age: z.number({
  required_error: "Age is required",
  invalid_type_error: "Age must be a number"
})
  .int({ message: "Age must be a whole number" })
  .positive({ message: "Age must be positive" })
  .max(120, { message: "Please enter a valid age" })

// ✅ CORRECT - Decimal/Money
amount: z.number()
  .positive({ message: "Amount must be greater than zero" })
  .multipleOf(0.01, { message: "Amount must have at most 2 decimal places" })
```

### Enum Validation
```typescript
// ✅ CORRECT
status: z.enum(["active", "inactive", "suspended"], {
  errorMap: () => ({ message: "Please select a valid status" })
})

// ✅ ALSO ACCEPTABLE
role: z.enum(["admin", "ops", "manager"], {
  required_error: "Role is required",
  invalid_type_error: "Please select a valid role"
})
```

### Array Validation
```typescript
// ✅ CORRECT
recipients: z.array(z.object({
  email: z.string().email({ message: "Please enter a valid email address" })
}))
  .min(1, { message: "At least one recipient is required" })
  .max(100, { message: "Maximum 100 recipients allowed" })
```

---

## 🔒 Authentication Validation

### Login Form
```typescript
const loginSchema = z.object({
  email: z.string()
    .min(1, { message: "Email is required" })
    .email({ message: "Please enter a valid email address" }),
  password: z.string()
    .min(1, { message: "Password is required" }),
});
```

### Signup Form
```typescript
const signupSchema = z.object({
  firstName: z.string()
    .min(1, { message: "First name is required" })
    .max(50, { message: "First name must be less than 50 characters" }),
  lastName: z.string()
    .min(1, { message: "Last name is required" })
    .max(50, { message: "Last name must be less than 50 characters" }),
  email: z.string()
    .min(1, { message: "Email is required" })
    .email({ message: "Please enter a valid email address" }),
  password: z.string()
    .min(8, { message: "Password must be at least 8 characters" }),
  phone: z.string()
    .min(10, { message: "Phone number must be at least 10 digits" })
    .optional(),
  acceptedTerms: z.boolean()
    .refine(val => val === true, {
      message: "You must accept the Terms & Conditions"
    }),
});
```

---

## 📊 Backend API Validation

### Request Body Validation
```typescript
// ✅ CORRECT - Always validate with safeParse
app.post('/api/example', async (req, res) => {
  const schema = z.object({
    name: z.string().min(1, { message: "Name is required" }),
    email: z.string().email({ message: "Please enter a valid email address" }),
  });
  
  const validation = schema.safeParse(req.body);
  
  if (!validation.success) {
    return res.status(400).json({
      error: "Validation failed",
      details: validation.error.errors
    });
  }
  
  const { name, email } = validation.data;
  // ... rest of logic
});

// ❌ WRONG - No validation
app.post('/api/example', async (req, res) => {
  const { name, email } = req.body; // DANGEROUS!
});
```

---

## 🌍 Bilingual Error Messages

For Hebrew support, use i18n library:

```typescript
// English + Hebrew validation
const schema = z.object({
  email: z.string()
    .min(1, { message: language === 'he' ? "נדרש כתובת אימייל" : "Email is required" })
    .email({ message: language === 'he' ? "נא להזין כתובת אימייל תקינה" : "Please enter a valid email address" })
});
```

---

## 🚫 Common Mistakes to Avoid

### 1. Missing Error Messages
```typescript
// ❌ BAD
email: z.string().email()

// ✅ GOOD
email: z.string().email({ message: "Please enter a valid email address" })
```

### 2. Generic Error Messages
```typescript
// ❌ BAD
name: z.string().min(1, "Invalid input")

// ✅ GOOD
name: z.string().min(1, { message: "Name is required" })
```

### 3. Not Using safeParse on Backend
```typescript
// ❌ BAD - Will throw error and crash
const data = schema.parse(req.body);

// ✅ GOOD - Handles errors gracefully
const validation = schema.safeParse(req.body);
if (!validation.success) {
  return res.status(400).json({ error: validation.error });
}
```

### 4. Inconsistent Validation Rules
```typescript
// ❌ BAD - Different rules for same field
// In one place:
email: z.string().email()
// In another:
email: z.string().min(1).email({ message: "Invalid" })

// ✅ GOOD - Same pattern everywhere
email: z.string()
  .min(1, { message: "Email is required" })
  .email({ message: "Please enter a valid email address" })
```

---

## 📝 File-Specific Rules

### Shared Schemas (`shared/schema.ts`, `shared/firestore-schema.ts`)
- Use for database models and reusable types
- Must have insert/update schemas with validation
- All validation messages must be clear

### Backend Routes (`server/routes/*.ts`)
- Always use `safeParse` for request validation
- Return 400 status with clear error messages
- Log validation failures for debugging

### Frontend Forms (`client/src/pages/*.tsx`)
- Use `zodResolver` from `@hookform/resolvers/zod`
- Show field-level validation errors
- Validate on blur for better UX

---

## ✅ Testing Checklist

Before deploying validation changes:

- [ ] All email fields use proper `.email()` with message
- [ ] All required text fields have `.min(1)` with message
- [ ] All password fields have minimum length requirement
- [ ] Phone validation matches Israeli format
- [ ] Date fields use proper format validation
- [ ] Backend routes use `safeParse` not `parse`
- [ ] Error messages are user-friendly (not technical)
- [ ] Bilingual support added where needed
- [ ] No default Zod error messages appear
- [ ] Test actual form submission with invalid data

---

## 📞 Support

For questions about validation standards:
- **Documentation**: This file
- **Examples**: See `client/src/pages/AdminLogin.tsx` for reference implementation
- **Code Review**: Run architect tool for validation audit

---

**✅ Status**: Production Standard  
**Version**: 1.0  
**Last Audit**: October 27, 2025
