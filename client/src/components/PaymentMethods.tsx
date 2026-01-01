export default function PaymentMethods() {
  return (
    <div 
      className="flex flex-wrap items-center justify-center gap-3 py-2"
      data-testid="payment-icons-container"
    >
      <img
        src="/assets/payments/visa-mono.svg"
        alt="Visa"
        className="h-6 w-auto grayscale hover:grayscale-0 transition-all duration-300"
        data-testid="icon-visa"
      />

      <img
        src="/assets/payments/mastercard-mono.svg"
        alt="Mastercard"
        className="h-6 w-auto grayscale hover:grayscale-0 transition-all duration-300"
        data-testid="icon-mastercard"
      />

      <img
        src="/assets/payments/amex-mono.svg"
        alt="American Express"
        className="h-6 w-auto grayscale hover:grayscale-0 transition-all duration-300"
        data-testid="icon-amex"
      />

      <img
        src="/assets/payments/apple-pay-mono.svg"
        alt="Apple Pay"
        className="h-6 w-auto grayscale hover:grayscale-0 transition-all duration-300"
        data-testid="icon-apple-pay"
      />

      <img
        src="/assets/payments/google-pay-mono.svg"
        alt="Google Pay"
        className="h-6 w-auto grayscale hover:grayscale-0 transition-all duration-300"
        data-testid="icon-google-pay"
      />
    </div>
  );
}
