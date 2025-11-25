export default function PaymentMethods() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-4 py-2">
      {/* VISA */}
      <img
        src="https://upload.wikimedia.org/wikipedia/commons/4/41/Visa_2021.svg"
        alt="Visa"
        className="h-8 w-auto opacity-80 hover:opacity-100 transition-opacity"
        data-testid="icon-visa"
      />

      {/* MasterCard */}
      <img
        src="https://upload.wikimedia.org/wikipedia/commons/0/04/Mastercard-logo.png"
        alt="Mastercard"
        className="h-8 w-auto opacity-80 hover:opacity-100 transition-opacity"
        data-testid="icon-mastercard"
      />

      {/* American Express */}
      <img
        src="https://upload.wikimedia.org/wikipedia/commons/3/30/American_Express_logo_%282018%29.svg"
        alt="American Express"
        className="h-8 w-auto opacity-80 hover:opacity-100 transition-opacity"
        data-testid="icon-amex"
      />

      {/* Apple Pay */}
      <img
        src="https://upload.wikimedia.org/wikipedia/commons/b/b9/Apple_Pay_logo.svg"
        alt="Apple Pay"
        className="h-8 w-auto opacity-80 hover:opacity-100 transition-opacity"
        data-testid="icon-apple-pay"
      />

      {/* Google Pay */}
      <img
        src="https://upload.wikimedia.org/wikipedia/commons/5/5b/Google_Pay_Logo.svg"
        alt="Google Pay"
        className="h-8 w-auto opacity-80 hover:opacity-100 transition-opacity"
        data-testid="icon-google-pay"
      />
    </div>
  );
}
