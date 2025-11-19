/**
 * Payment Icons - Ultra-Modern 2025 Luxury Design with Official Brand Logos
 * Responsive grid layout with glassmorphism effects
 */

interface PaymentIconsProps {
  variant?: 'default' | 'compact';
  showTitle?: boolean;
}

export default function PaymentIcons({ variant = 'default', showTitle = false }: PaymentIconsProps) {
  const isCompact = variant === 'compact';
  const tileHeight = isCompact ? 'h-14' : 'h-16 sm:h-20';
  
  return (
    <div className="w-full max-w-5xl mx-auto px-4" data-testid="payment-icons-container">
      {/* Ultra-Modern Responsive Grid - Never Breaks Layout */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 md:gap-6">
        
        {/* Visa - Official Blue */}
        <div 
          className={`
            group relative ${tileHeight} aspect-[3/2]
            bg-gradient-to-br from-[#1A1F71] to-[#0D1347]
            rounded-2xl shadow-lg hover:shadow-2xl
            border border-white/10
            transition-all duration-500 ease-out
            hover:scale-105 hover:-translate-y-1
            overflow-hidden cursor-default
          `}
          title="Visa"
          data-testid="payment-icon-visa"
        >
          <div className="absolute inset-0 bg-white/5 group-hover:bg-white/10 transition-all" />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <svg viewBox="0 0 141.732 141.732" className="w-full h-full max-w-[80px]" aria-label="Visa">
              <g>
                <rect y="0" fill="transparent" width="141.732" height="141.732"/>
                <g>
                  <path fill="#FFFFFF" d="M62.935,89.571h-9.733l6.083-37.384h9.734L62.935,89.571z"/>
                  <path fill="#FFFFFF" d="M45.014,52.187L35.735,77.9l-1.098-5.537l-0.001,0.002c-1.858-6.296-7.663-13.108-14.158-16.513l8.712,33.717h10.126l15.072-37.382H45.014z"/>
                  <path fill="#FFFFFF" d="M121.569,89.571h8.937l-7.792-37.385h-7.824c-1.764,0-3.252,1.026-3.91,2.606l-13.77,34.779h10.124l2.012-5.565h12.385L121.569,89.571z M111.234,76.031l5.104-14.045l2.938,14.045H111.234z"/>
                  <path fill="#FFFFFF" d="M96.422,68.307c-0.04-9.895-13.71-10.444-13.613-14.88c0.031-1.35,1.316-2.789,4.131-3.157c1.396-0.184,5.25-0.326,9.619,1.69l1.713-7.993c-2.349-0.855-5.373-1.676-9.136-1.676c-9.651,0-16.446,5.13-16.512,12.48c-0.063,5.434,4.847,8.463,8.545,10.269c3.801,1.854,5.076,3.042,5.061,4.699c-0.024,2.535-3.038,3.658-5.849,3.701c-4.915,0.074-7.76-1.327-10.029-2.388l-1.771,8.27c2.281,1.049,6.496,1.962,10.868,2.008C94.164,81.33,96.462,76.349,96.422,68.307"/>
                </g>
                <path fill="#F7B600" d="M34.638,72.364l-1.098-5.537l-0.001,0.002c-1.858-6.296-7.663-13.108-14.158-16.513l8.712,33.717h10.126l15.072-37.382h-10.126L34.638,72.364z"/>
              </g>
            </svg>
          </div>
        </div>

        {/* Mastercard - Official Red/Orange */}
        <div 
          className={`
            group relative ${tileHeight} aspect-[3/2]
            bg-gradient-to-br from-black to-gray-900
            rounded-2xl shadow-lg hover:shadow-2xl
            border border-white/10
            transition-all duration-500 ease-out
            hover:scale-105 hover:-translate-y-1
            overflow-hidden cursor-default
          `}
          title="Mastercard"
          data-testid="payment-icon-mastercard"
        >
          <div className="absolute inset-0 bg-white/5 group-hover:bg-white/10 transition-all" />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <svg viewBox="0 0 131.39 86.9" className="w-full h-full max-w-[90px]" aria-label="Mastercard">
              <g>
                <rect fill="none" width="131.39" height="86.9"/>
                <circle fill="#EB001B" cx="48.37" cy="43.45" r="33.4"/>
                <circle fill="#FF5F00" cx="65.52" cy="43.45" r="33.4"/>
                <circle fill="#F79E1B" cx="82.67" cy="43.45" r="33.4"/>
                <path fill="#EB001B" d="M65.52,76.85c-8.18,0-15.68-2.95-21.48-7.83c5.8-4.88,9.48-12.13,9.48-20.32s-3.68-15.44-9.48-20.32c5.8-4.88,13.3-7.83,21.48-7.83V76.85z"/>
                <path fill="#F79E1B" d="M65.52,76.85V20.55c8.18,0,15.68,2.95,21.48,7.83c-5.8,4.88-9.48,12.13-9.48,20.32s3.68,15.44,9.48,20.32C81.2,73.9,73.7,76.85,65.52,76.85z"/>
              </g>
            </svg>
          </div>
        </div>

        {/* American Express - Official Blue */}
        <div 
          className={`
            group relative ${tileHeight} aspect-[3/2]
            bg-gradient-to-br from-[#006FCF] to-[#0047AB]
            rounded-2xl shadow-lg hover:shadow-2xl
            border border-white/10
            transition-all duration-500 ease-out
            hover:scale-105 hover:-translate-y-1
            overflow-hidden cursor-default
          `}
          title="American Express"
          data-testid="payment-icon-amex"
        >
          <div className="absolute inset-0 bg-white/5 group-hover:bg-white/10 transition-all" />
          <div className="absolute inset-0 flex items-center justify-center p-3">
            <svg viewBox="0 0 152.4 152.4" className="w-full h-full max-w-[70px]" aria-label="American Express">
              <g>
                <rect fill="transparent" width="152.4" height="152.4"/>
                <polygon fill="#FFFFFF" points="34.3,49.7 27.5,49.7 31.5,40.6"/>
                <path fill="#FFFFFF" d="M152.4,93.7c0,0-4.3-10.5-4.9-11.9h-10.1c0,2.7,0,8.1,0,11.9h-8.5V62.1h18.7c3.6,0,6.9,0.8,9.1,2.9c1.8,1.7,2.9,4.2,2.9,7.5c0,5-2.7,8.1-6.4,9.5c1.4,0.4,2.5,1.3,3.3,2.9c0.8,1.6,4.8,11.4,5.1,12.1c-3.1,0-9.1,0-9.1,0V93.7z M142.9,74.3c0-2.9-2.2-4-4.8-4h-9.5c0,2.8,0,5.7,0,8h9.5C140.7,78.3,142.9,77.2,142.9,74.3 M113.6,49.7l-3.6-8.8l-3.6,8.8H113.6z M88.5,81.7h14.9l2.3-5.8h-19.5c0,1.9,0,3.9,0,5.8H88.5z M119.5,96.7l-13.3-32.8l-13.4,32.8h8.2l2.1-5.2h16.1l2.1,5.2H119.5z M67.2,71c3.2,0,6.3-0.1,9.5,0c3.4,0.1,5.8,2.3,5.8,5.7c0,3.5-2.3,5.8-5.8,5.9c-3.2,0.1-6.3,0-9.5,0V71z M67.2,88.5c3.9,0,7.8-0.1,11.7,0c3.7,0.1,6.5,3,6.5,6.6c0,3.6-2.8,6.5-6.5,6.6c-3.9,0.1-7.8,0-11.7,0V88.5z M56.8,104.6h23.9c6.6,0,12.1-5.2,12.1-11.6c0-3.2-1.3-6.1-3.5-8.3c1.6-2.1,2.6-4.7,2.6-7.6c0-6.8-5.5-12.3-12.3-12.3H56.8V104.6z M43.5,96.7l-2.1-5.2H25.3l-2.1,5.2h-8.8l13.4-32.8l13.3,32.8H43.5z M88.5,64.8h14.9l2.3-5.8h-19.5c0,1.9,0,3.9,0,5.8H88.5z"/>
              </g>
            </svg>
          </div>
        </div>

        {/* Diners Club - Official Blue */}
        <div 
          className={`
            group relative ${tileHeight} aspect-[3/2]
            bg-gradient-to-br from-[#0079BE] to-[#005C8F]
            rounded-2xl shadow-lg hover:shadow-2xl
            border border-white/10
            transition-all duration-500 ease-out
            hover:scale-105 hover:-translate-y-1
            overflow-hidden cursor-default
          `}
          title="Diners Club"
          data-testid="payment-icon-diners"
        >
          <div className="absolute inset-0 bg-white/5 group-hover:bg-white/10 transition-all" />
          <div className="absolute inset-0 flex items-center justify-center p-3">
            <svg viewBox="0 0 780 500" className="w-full h-full max-w-[85px]" aria-label="Diners Club">
              <rect width="780" height="500" rx="40" fill="transparent"/>
              <circle cx="267" cy="250" r="150" fill="white"/>
              <circle cx="513" cy="250" r="150" fill="white"/>
              <path d="M267 100C183.203 100 117 166.203 117 250C117 333.797 183.203 400 267 400V100Z" fill="#0079BE"/>
              <path d="M513 100V400C596.797 400 663 333.797 663 250C663 166.203 596.797 100 513 100Z" fill="#0079BE"/>
            </svg>
          </div>
        </div>

        {/* Apple Pay - Official Black */}
        <div 
          className={`
            group relative ${tileHeight} aspect-[3/2]
            bg-gradient-to-br from-black to-gray-900
            rounded-2xl shadow-lg hover:shadow-2xl
            border border-white/10
            transition-all duration-500 ease-out
            hover:scale-105 hover:-translate-y-1
            overflow-hidden cursor-default
          `}
          title="Apple Pay"
          data-testid="payment-icon-applepay"
        >
          <div className="absolute inset-0 bg-white/5 group-hover:bg-white/10 transition-all" />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <svg viewBox="0 0 165.52 105.97" className="w-full h-full max-w-[90px]" aria-label="Apple Pay">
              <g>
                <g>
                  <path fill="#FFFFFF" d="M35.35,0c-0.91,0-1.85,0.11-2.83,0.34c-1.28,0.3-2.48,0.81-3.6,1.51c-1.12,0.71-2.09,1.58-2.92,2.62c-0.82,1.04-1.44,2.2-1.85,3.48c-0.36,1.12-0.54,2.28-0.54,3.48c0,2.43,0.71,4.64,2.12,6.64c1.42,2,3.27,3.45,5.56,4.36c0.5,0.2,1.01,0.35,1.54,0.46c0.53,0.11,1.06,0.16,1.59,0.16c2.43,0,4.64-0.71,6.64-2.12c2-1.42,3.45-3.27,4.36-5.56c0.2-0.5,0.35-1.01,0.46-1.54c0.11-0.53,0.16-1.06,0.16-1.59C45.04,5.83,40.76,0,35.35,0z"/>
                  <path fill="#FFFFFF" d="M46.45,24.29c-1.42-1.71-3.27-2.92-5.56-3.64c-2.29-0.71-4.64-0.71-7.05,0c-2.41,0.71-4.42,1.99-6.04,3.83c-1.62,1.85-2.75,4-3.37,6.45c-0.31,1.22-0.46,2.48-0.46,3.78c0,5.41,1.99,10.01,5.97,13.81l21.95,22.95c1.62,1.71,3.57,2.56,5.85,2.56c2.29,0,4.24-0.85,5.85-2.56l21.95-22.95c3.98-3.8,5.97-8.4,5.97-13.81c0-1.3-0.15-2.56-0.46-3.78c-0.62-2.45-1.75-4.6-3.37-6.45c-1.62-1.85-3.63-3.12-6.04-3.83c-2.41-0.71-4.76-0.71-7.05,0c-2.29,0.71-4.14,1.93-5.56,3.64c-1.42,1.71-2.26,3.73-2.51,6.06l-0.15,1.42l-0.15-1.42C48.71,28.02,47.87,26,46.45,24.29z"/>
                </g>
                <g>
                  <path fill="#FFFFFF" d="M114.19,35.21c0-4.92,3.98-8.9,8.9-8.9h13.29c2.75,0,4.98,2.23,4.98,4.98v37.85c0,2.75-2.23,4.98-4.98,4.98h-13.29c-4.92,0-8.9-3.98-8.9-8.9V35.21z"/>
                  <path fill="#FFFFFF" d="M88.73,52.98c0-2.75,2.23-4.98,4.98-4.98h37.85c2.75,0,4.98,2.23,4.98,4.98v11.25c0,4.92-3.98,8.9-8.9,8.9h-29.01c-4.92,0-8.9-3.98-8.9-8.9V52.98z"/>
                </g>
              </g>
            </svg>
          </div>
        </div>

        {/* Google Pay - Official Colors */}
        <div 
          className={`
            group relative ${tileHeight} aspect-[3/2]
            bg-white
            rounded-2xl shadow-lg hover:shadow-2xl
            border border-gray-200
            transition-all duration-500 ease-out
            hover:scale-105 hover:-translate-y-1
            overflow-hidden cursor-default
          `}
          title="Google Pay"
          data-testid="payment-icon-googlepay"
        >
          <div className="absolute inset-0 bg-gray-50 group-hover:bg-gray-100 transition-all" />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <svg viewBox="0 0 512 244" className="w-full h-full max-w-[100px]" aria-label="Google Pay">
              <g>
                <path fill="#5F6368" d="M216.18,139.08h-23.2V84.92c0-1.6-.2-3.1-.7-4.5c-1.5-5.6-6.5-9.7-12.5-9.7s-11,4.1-12.5,9.7c-.5,1.4-.7,2.9-.7,4.5v54.16h-23.2V42.73h23.2v12.53c4.8-7.8,13.5-13.03,23.4-13.03c15.3,0,27.7,12.43,27.7,27.73v69.12h1.5Z"/>
                <path fill="#5F6368" d="M336.38,97.03v42.05h-23.2v-39.05c0-10.6-8.6-19.2-19.2-19.2s-19.2,8.6-19.2,19.2v39.05h-23.2V84.92c0-1.6-.2-3.1-.7-4.5c-1.5-5.6-6.5-9.7-12.5-9.7s-11,4.1-12.5,9.7c-.5,1.4-.7,2.9-.7,4.5v54.16h-23.2V42.73h23.2v12.53c4.8-7.8,13.5-13.03,23.4-13.03c10.3,0,19.3,5.03,24.9,12.73c5.6-7.7,14.6-12.73,24.9-12.73c17,0,30.8,13.83,30.8,30.83v65.92h1.9Z"/>
                <path fill="#4285F4" d="M113.28,97.03c0,23.23-18.85,42.08-42.08,42.08s-42.08-18.85-42.08-42.08s18.85-42.08,42.08-42.08s42.08,18.85,42.08,42.08Zm-21.04,0c0-11.6-9.44-21.04-21.04-21.04s-21.04,9.44-21.04,21.04s9.44,21.04,21.04,21.04s21.04-9.44,21.04-21.04Z"/>
                <path fill="#34A853" d="M405.28,97.03v42.05h-21.04v-11.62c-5.8,8.2-15.2,13.65-25.9,13.65c-17.7,0-32.05-14.35-32.05-32.05s14.35-32.05,32.05-32.05c10.7,0,20.1,5.45,25.9,13.65v-11.62c0-11.6-9.44-21.04-21.04-21.04c-8.5,0-15.8,5.05-19.1,12.33l-18.3-7.63c6.2-14.87,20.7-25.3,37.4-25.3c22.36,0,40.49,18.13,40.49,40.49v19.14h1.6Zm-21.04,0c0-11.6-9.44-21.04-21.04-21.04s-21.04,9.44-21.04,21.04s9.44,21.04,21.04,21.04s21.04-9.44,21.04-21.04Z"/>
                <path fill="#FBBC04" d="M463.28,139.08v-96.35h21.04v96.35h-21.04Z"/>
                <path fill="#EA4335" d="M511.28,97.03c0,23.23-18.35,42.08-41.08,42.08c-9.9,0-19-3.5-26.1-9.35l14.9-14.9c4.3,3.5,9.8,5.6,15.8,5.6c11.6,0,21.04-9.44,21.04-21.04s-9.44-21.04-21.04-21.04c-6,0-11.5,2.1-15.8,5.6l-14.9-14.9c7.1-5.85,16.2-9.35,26.1-9.35c22.73,0,41.08,18.85,41.08,42.08Z"/>
              </g>
            </svg>
          </div>
        </div>

      </div>

      {/* Nayax Payment Gateway Badge */}
      <div className="mt-8 flex justify-center">
        <div 
          className="group cursor-default inline-flex items-center gap-3 bg-gradient-to-r from-emerald-500 via-teal-600 to-cyan-600 px-6 py-3 rounded-xl shadow-lg hover:shadow-2xl transition-all duration-500 hover:scale-105 border border-white/20"
          title="Nayax Mobile Payment Gateway"
          data-testid="payment-badge-nayax"
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <span className="text-white text-base font-semibold tracking-wide drop-shadow-md">
            Nayax Payment Gateway
          </span>
        </div>
      </div>
    </div>
  );
}
