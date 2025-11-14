/**
 * Database Error Handler
 * Converts database constraint violations into user-friendly error messages
 */

interface DbError {
  code?: string;
  message?: string;
  constraint?: string;
  detail?: string;
}

export function getUserFriendlyDbError(error: unknown): string {
  const dbError = error as DbError;
  
  // PostgreSQL unique constraint violation
  if (dbError.code === '23505' || dbError.message?.includes('unique constraint')) {
    const constraint = dbError.constraint || '';
    
    // Common unique constraint patterns
    if (constraint.includes('email') || dbError.detail?.includes('email')) {
      return 'This email address is already registered. Please use a different email or try logging in.';
    }
    if (constraint.includes('phone')) {
      return 'This phone number is already registered.';
    }
    if (constraint.includes('employee_label')) {
      return 'This employee ID number is already in use.';
    }
    if (constraint.includes('invoice_number')) {
      return 'This invoice number already exists.';
    }
    if (constraint.includes('transaction_id')) {
      return 'This transaction ID is duplicated. Please contact support.';
    }
    
    return 'This record already exists. Please check your input.';
  }
  
  // Foreign key constraint violation
  if (dbError.code === '23503' || dbError.message?.includes('foreign key')) {
    return 'Cannot save: referenced record not found. Please refresh and try again.';
  }
  
  // Not null constraint violation
  if (dbError.code === '23502' || dbError.message?.includes('not null')) {
    const column = dbError.message?.match(/column "(\w+)"/)?.[1];
    return column 
      ? `Required field missing: ${column}. Please fill in all required fields.`
      : 'Required field missing. Please fill in all required fields.';
  }
  
  // Check constraint violation
  if (dbError.code === '23514' || dbError.message?.includes('check constraint')) {
    return 'Invalid data format. Please check your input and try again.';
  }
  
  // Generic database error
  return 'Unable to save data. Please check your input and try again.';
}

/**
 * Logs database error with context for debugging
 */
export function logDbError(error: unknown, context: Record<string, any>) {
  const dbError = error as DbError;
  console.error('[DB Error]', {
    code: dbError.code,
    message: dbError.message,
    constraint: dbError.constraint,
    detail: dbError.detail,
    context
  });
}
