export default function PaymentMethods() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-4 py-2">
      {/* VISA */}
      <img
        src="/assets/payments/visa-color.svg"
        alt="Visa"
        className="h-8 w-auto opacity-80 hover:opacity-100 transition-opacity"
        data-testid="icon-visa"
      />

      {/* MasterCard */}
      <img
        src="/assets/payments/mastercard-color.svg"
        alt="Mastercard"
        className="h-8 w-auto opacity-80 hover:opacity-100 transition-opacity"
        data-testid="icon-mastercard"
      />

      {/* American Express */}
      <img
        src="/assets/payments/amex-color.svg"
        alt="American Express"
        className="h-8 w-auto opacity-80 hover:opacity-100 transition-opacity"
        data-testid="icon-amex"
      />

      {/* Apple Pay - Official black wordmark */}
      <img
        src="/assets/payments/apple-pay-color.svg"
        alt="Apple Pay"
        className="h-8 w-auto opacity-80 hover:opacity-100 transition-opacity"
        data-testid="icon-apple-pay"
      />

      {/* Google Pay */}
      <img
        src="/assets/payments/google-pay-color.svg"
        alt="Google Pay"
        className="h-8 w-auto opacity-80 hover:opacity-100 transition-opacity"
        data-testid="icon-google-pay"
      />
    </div>
  );
}
