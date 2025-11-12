# Pet Wash Ltd - UI/UX Specifications

## Overview
7-star luxury design system for a global super-app ecosystem. Pure white minimalist aesthetic with world-class UX across all devices.

---

## Design Philosophy

### Core Principles
1. **Pure White Minimalism** - Clean, spacious, Apple-inspired aesthetics
2. **Luxury First** - Every pixel communicates premium quality
3. **Mobile-First** - 70% of users will be on mobile
4. **Accessible** - WCAG 2.1 AA compliance minimum
5. **Fast** - Perceived performance through smart loading states
6. **Consistent** - Same experience across all 6+ platforms

---

## Color System

### Primary Palette
```css
/* Pure White Base - NO GRADIENTS */
--background: #FFFFFF;
--surface: #FFFFFF;
--card: #FFFFFF;

/* Subtle Grays for Depth */
--border: #E5E7EB;  /* Very light gray */
--border-hover: #D1D5DB;
--text-secondary: #6B7280;
--text-tertiary: #9CA3AF;

/* Black for Primary Text */
--text-primary: #111827;  /* Almost black */

/* Brand Accent (Minimal Use) */
--brand-primary: #2563EB;  /* Modern blue */
--brand-hover: #1D4ED8;

/* Semantic Colors */
--success: #10B981;  /* Green */
--warning: #F59E0B;  /* Amber */
--error: #EF4444;  /* Red */
--info: #3B82F6;  /* Blue */
```

### Usage Rules
- **90% White:** Background, cards, surfaces
- **8% Gray:** Borders, dividers, secondary text
- **2% Color:** CTAs, status indicators, icons

**FORBIDDEN:**
- ❌ No gradients
- ❌ No colored backgrounds (except status badges)
- ❌ No drop shadows (use borders instead)
- ❌ No neon colors
- ❌ No patterns or textures

---

## Typography

### Font Stack
```css
font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", 
             "Helvetica Neue", Arial, sans-serif;
```

### Type Scale
```css
--text-xs: 0.75rem;    /* 12px - Captions, labels */
--text-sm: 0.875rem;   /* 14px - Secondary text */
--text-base: 1rem;     /* 16px - Body text */
--text-lg: 1.125rem;   /* 18px - Subheadings */
--text-xl: 1.25rem;    /* 20px - Section titles */
--text-2xl: 1.5rem;    /* 24px - Page titles */
--text-3xl: 1.875rem;  /* 30px - Hero text */
--text-4xl: 2.25rem;   /* 36px - Marketing headers */
```

### Font Weights
```css
--font-light: 300;     /* Rarely used */
--font-regular: 400;   /* Body text */
--font-medium: 500;    /* Emphasis */
--font-semibold: 600;  /* Headings */
--font-bold: 700;      /* Strong emphasis */
```

### Line Height
```css
--leading-tight: 1.25;   /* Headings */
--leading-normal: 1.5;   /* Body */
--leading-relaxed: 1.75; /* Long-form content */
```

---

## Spacing System

### 8px Base Grid
```css
--space-1: 0.25rem;  /* 4px */
--space-2: 0.5rem;   /* 8px */
--space-3: 0.75rem;  /* 12px */
--space-4: 1rem;     /* 16px */
--space-5: 1.25rem;  /* 20px */
--space-6: 1.5rem;   /* 24px */
--space-8: 2rem;     /* 32px */
--space-10: 2.5rem;  /* 40px */
--space-12: 3rem;    /* 48px */
--space-16: 4rem;    /* 64px */
--space-20: 5rem;    /* 80px */
--space-24: 6rem;    /* 96px */
```

### Responsive Spacing
- **Mobile:** Use smaller increments (space-2 to space-6)
- **Tablet:** Medium spacing (space-4 to space-10)
- **Desktop:** Generous spacing (space-8 to space-24)

---

## Component Library

### Buttons

#### Primary Button (CTA)
```jsx
<button className="
  bg-brand-primary text-white
  px-6 py-3 rounded-lg
  font-medium text-base
  hover:bg-brand-hover
  active:scale-95
  transition-all duration-200
  disabled:opacity-50 disabled:cursor-not-allowed
">
  Book Now
</button>
```

#### Secondary Button
```jsx
<button className="
  bg-white text-brand-primary
  border border-brand-primary
  px-6 py-3 rounded-lg
  font-medium text-base
  hover:bg-gray-50
  active:scale-95
  transition-all duration-200
">
  Learn More
</button>
```

#### Ghost Button
```jsx
<button className="
  bg-transparent text-text-primary
  px-4 py-2
  font-medium text-sm
  hover:bg-gray-50 rounded-lg
  transition-colors duration-200
">
  Cancel
</button>
```

**Touch Targets:**
- Minimum height: 44px (iOS guideline)
- Minimum width: 44px for icon-only buttons
- Padding: 12px vertical, 24px horizontal

---

### Cards

#### Standard Card
```jsx
<div className="
  bg-white
  border border-border rounded-xl
  p-6
  hover:border-border-hover
  transition-colors duration-200
">
  {/* Content */}
</div>
```

#### Elevated Card (Rare Use)
```jsx
<div className="
  bg-white
  border-2 border-brand-primary rounded-xl
  p-6
">
  {/* Featured content */}
</div>
```

**Rules:**
- Max width: 600px for readability
- Border radius: 12px (rounded-xl)
- Padding: 24px on all sides
- Spacing between cards: 16px mobile, 24px desktop

---

### Forms

#### Input Field
```jsx
<div className="space-y-2">
  <label className="block text-sm font-medium text-text-primary">
    Email Address
  </label>
  <input 
    type="email"
    className="
      w-full px-4 py-3
      border border-border rounded-lg
      text-base
      placeholder:text-text-tertiary
      focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20
      transition-all duration-200
    "
    placeholder="you@example.com"
  />
  <p className="text-xs text-text-secondary">We'll never share your email</p>
</div>
```

#### Select Dropdown
```jsx
<select className="
  w-full px-4 py-3
  border border-border rounded-lg
  text-base
  focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20
  transition-all duration-200
">
  <option>Select an option</option>
</select>
```

**Form Validation:**
- Show errors below field in red (`--error`)
- Show success with green checkmark icon
- Real-time validation as user types (debounced)

---

### Navigation

#### Mobile Hamburger Menu
```jsx
{/* Hamburger Icon - Top Right */}
<button className="
  fixed top-4 right-4 z-50
  w-12 h-12
  flex items-center justify-center
  bg-white border border-border rounded-full
  hover:bg-gray-50
  transition-colors duration-200
">
  <MenuIcon className="w-6 h-6" />
</button>

{/* Menu Drawer - Slides from Right */}
<div className="
  fixed inset-y-0 right-0 z-40
  w-80 bg-white
  border-l border-border
  overflow-y-auto
  transform transition-transform duration-300
  {isOpen ? 'translate-x-0' : 'translate-x-full'}
">
  <nav className="p-6 space-y-2">
    {menuItems.map(item => (
      <a href={item.path} className="
        block px-4 py-3 rounded-lg
        text-base font-medium
        hover:bg-gray-50
        transition-colors duration-200
      ">
        {item.label}
      </a>
    ))}
  </nav>
</div>
```

**Mobile Menu Rules:**
- Always slides from RIGHT (even in Hebrew RTL)
- Hamburger icon always in top-right corner
- Full-height drawer
- Close on navigation
- Backdrop overlay with opacity

#### Desktop Top Navigation
```jsx
<header className="
  sticky top-0 z-40
  bg-white border-b border-border
">
  <div className="max-w-7xl mx-auto px-6 py-4">
    <nav className="flex items-center justify-between">
      {/* Logo */}
      <img src={logo} alt="Pet Wash" className="h-10" />
      
      {/* Main Nav */}
      <div className="flex items-center gap-8">
        {navItems.map(item => (
          <a href={item.path} className="
            text-base font-medium text-text-primary
            hover:text-brand-primary
            transition-colors duration-200
          ">
            {item.label}
          </a>
        ))}
      </div>
      
      {/* CTA */}
      <button className="primary-button">Book Now</button>
    </nav>
  </div>
</header>
```

---

### Loading States

#### Skeleton Loader
```jsx
<div className="animate-pulse space-y-4">
  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
  <div className="h-4 bg-gray-200 rounded w-5/6"></div>
</div>
```

#### Spinner
```jsx
<div className="
  w-8 h-8 border-4 border-gray-200
  border-t-brand-primary rounded-full
  animate-spin
">
</div>
```

**Loading Principles:**
- Show skeleton loaders for content (cards, lists)
- Show spinners for actions (button clicks, form submissions)
- Optimistic updates where possible
- Progressive rendering (show what's ready)

---

### Feedback

#### Success Toast
```jsx
<div className="
  bg-white border-l-4 border-success
  p-4 rounded-lg
  flex items-start gap-3
">
  <CheckCircleIcon className="w-5 h-5 text-success flex-shrink-0" />
  <div>
    <p className="font-medium text-text-primary">Success!</p>
    <p className="text-sm text-text-secondary">Your booking has been confirmed.</p>
  </div>
</div>
```

#### Error Alert
```jsx
<div className="
  bg-white border-l-4 border-error
  p-4 rounded-lg
  flex items-start gap-3
">
  <XCircleIcon className="w-5 h-5 text-error flex-shrink-0" />
  <div>
    <p className="font-medium text-text-primary">Error</p>
    <p className="text-sm text-text-secondary">Payment failed. Please try again.</p>
  </div>
</div>
```

---

## Responsive Design

### Breakpoints
```css
/* Mobile First */
@media (min-width: 640px) {  /* sm - Large phones */}
@media (min-width: 768px) {  /* md - Tablets */}
@media (min-width: 1024px) { /* lg - Desktop */}
@media (min-width: 1280px) { /* xl - Large Desktop */}
@media (min-width: 1536px) { /* 2xl - Extra Large */}
```

### Layout Grid
```jsx
{/* Mobile: 1 column */}
{/* Tablet: 2 columns */}
{/* Desktop: 3-4 columns */}
<div className="
  grid gap-6
  grid-cols-1
  md:grid-cols-2
  lg:grid-cols-3
  xl:grid-cols-4
">
  {items.map(item => <Card key={item.id} {...item} />)}
</div>
```

### Container Widths
```css
--container-sm: 640px;   /* Forms, small content */
--container-md: 768px;   /* Articles, medium content */
--container-lg: 1024px;  /* Standard pages */
--container-xl: 1280px;  /* Wide layouts */
```

---

## Platform-Specific UI Patterns

### K9000 Wash Stations
**UI Focus:** Station selection, queue status, payment

```jsx
{/* Station Card */}
<div className="card">
  {/* Station Photo */}
  <img src={station.photo} className="w-full h-48 object-cover rounded-t-xl" />
  
  {/* Info */}
  <div className="p-6 space-y-4">
    <div className="flex justify-between items-start">
      <div>
        <h3 className="font-semibold text-lg">{station.name}</h3>
        <p className="text-sm text-text-secondary">{station.address}</p>
      </div>
      <span className="px-3 py-1 bg-success/10 text-success text-sm font-medium rounded-full">
        Available
      </span>
    </div>
    
    {/* Queue Status */}
    <div className="flex items-center gap-2">
      <UsersIcon className="w-4 h-4 text-text-secondary" />
      <span className="text-sm">3 people in queue (15 min wait)</span>
    </div>
    
    {/* CTA */}
    <button className="primary-button w-full">Reserve Now</button>
  </div>
</div>
```

---

### Walk My Pet™
**UI Focus:** Walker profiles, live tracking, booking flow

```jsx
{/* Walker Card */}
<div className="card flex gap-4">
  {/* Avatar */}
  <img src={walker.photo} className="w-20 h-20 rounded-full object-cover" />
  
  {/* Info */}
  <div className="flex-1 space-y-2">
    <div className="flex items-center gap-2">
      <h3 className="font-semibold">{walker.name}</h3>
      <span className="flex items-center gap-1 text-sm">
        <StarIcon className="w-4 h-4 text-warning fill-warning" />
        <span>4.9</span>
      </span>
    </div>
    
    <p className="text-sm text-text-secondary">
      {walker.completedWalks} walks • {walker.yearsExperience} years exp
    </p>
    
    {/* Badges */}
    <div className="flex gap-2">
      <span className="badge">Certified</span>
      <span className="badge">Pet First Aid</span>
    </div>
  </div>
  
  {/* Price */}
  <div className="text-right">
    <p className="text-2xl font-semibold">₪{walker.rate}</p>
    <p className="text-sm text-text-secondary">/30 min</p>
  </div>
</div>

{/* Live Tracking Map */}
<div className="card p-0 overflow-hidden">
  <div className="h-96 bg-gray-100">
    {/* Map component here */}
  </div>
  
  {/* Status Bar */}
  <div className="p-4 border-t border-border">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 bg-success rounded-full animate-pulse"></div>
        <span className="font-medium">Walk in progress</span>
      </div>
      <span className="text-sm text-text-secondary">18 min remaining</span>
    </div>
  </div>
</div>
```

---

### The Sitter Suite™
**UI Focus:** Host homes, calendar booking, photo gallery

```jsx
{/* Host Home Listing */}
<div className="card p-0 overflow-hidden">
  {/* Photo Gallery */}
  <div className="relative h-64">
    <img src={home.primaryPhoto} className="w-full h-full object-cover" />
    <button className="absolute bottom-4 right-4 bg-white px-3 py-2 rounded-lg text-sm font-medium">
      View all {home.photoCount} photos
    </button>
  </div>
  
  {/* Details */}
  <div className="p-6 space-y-4">
    <div>
      <h3 className="font-semibold text-xl">{home.title}</h3>
      <p className="text-sm text-text-secondary">{home.location}</p>
    </div>
    
    {/* Amenities */}
    <div className="grid grid-cols-2 gap-3">
      {home.amenities.map(amenity => (
        <div className="flex items-center gap-2 text-sm">
          <CheckIcon className="w-4 h-4 text-success" />
          <span>{amenity}</span>
        </div>
      ))}
    </div>
    
    {/* Pricing */}
    <div className="flex items-end justify-between pt-4 border-t border-border">
      <div>
        <p className="text-2xl font-semibold">₪{home.nightlyRate}</p>
        <p className="text-sm text-text-secondary">per night</p>
      </div>
      <button className="primary-button">Request to Book</button>
    </div>
  </div>
</div>
```

---

### PetTrek™
**UI Focus:** Ride booking, driver tracking, fare estimate

```jsx
{/* Ride Booking Form */}
<div className="card space-y-6">
  {/* Pickup/Dropoff */}
  <div className="space-y-3">
    <div className="flex items-center gap-3">
      <div className="w-3 h-3 bg-brand-primary rounded-full"></div>
      <input 
        type="text" 
        placeholder="Pickup location" 
        className="flex-1 input"
      />
    </div>
    
    <div className="w-px h-6 bg-border ml-1.5"></div>
    
    <div className="flex items-center gap-3">
      <div className="w-3 h-3 border-2 border-brand-primary rounded-full"></div>
      <input 
        type="text" 
        placeholder="Dropoff location" 
        className="flex-1 input"
      />
    </div>
  </div>
  
  {/* Fare Estimate */}
  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
    <div className="flex justify-between text-sm">
      <span className="text-text-secondary">Base fare</span>
      <span>₪12</span>
    </div>
    <div className="flex justify-between text-sm">
      <span className="text-text-secondary">Distance (3.2 km)</span>
      <span>₪8</span>
    </div>
    <div className="flex justify-between text-sm">
      <span className="text-text-secondary">Service fee</span>
      <span>₪2</span>
    </div>
    <div className="flex justify-between font-semibold text-lg pt-2 border-t border-border">
      <span>Total</span>
      <span>₪22</span>
    </div>
  </div>
  
  <button className="primary-button w-full">Request Ride</button>
</div>
```

---

## Animations

### Micro-interactions
```css
/* Button Press */
.button-press {
  transition: transform 0.1s ease;
}
.button-press:active {
  transform: scale(0.95);
}

/* Fade In */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Slide In from Right */
@keyframes slideInRight {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

/* Spring Animation (Menu Open) */
@keyframes spring {
  0% { transform: scale(0.9); opacity: 0; }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); opacity: 1; }
}
```

### Performance Rules
- Use `transform` and `opacity` only (GPU-accelerated)
- Avoid animating `width`, `height`, `top`, `left`
- Duration: 150-300ms for UI, 500ms max
- Easing: `ease-out` for entrances, `ease-in` for exits

---

## Accessibility (WCAG 2.1 AA)

### Color Contrast
- Text on white: Minimum 4.5:1 (AA)
- Large text (18pt+): Minimum 3:1
- Use tools: Contrast Checker, Stark plugin

### Keyboard Navigation
- All interactive elements must be focusable
- Visible focus indicator (2px brand-primary ring)
- Logical tab order
- Escape key closes modals/menus

### Screen Readers
```jsx
{/* Proper labels */}
<button aria-label="Close menu">
  <XIcon className="w-6 h-6" />
</button>

{/* Skip to main content */}
<a href="#main-content" className="sr-only focus:not-sr-only">
  Skip to main content
</a>

{/* Loading states */}
<div role="status" aria-live="polite">
  <span className="sr-only">Loading...</span>
  <Spinner />
</div>
```

### ARIA Landmarks
```html
<header role="banner">...</header>
<nav role="navigation">...</nav>
<main role="main" id="main-content">...</main>
<footer role="contentinfo">...</footer>
```

---

## RTL (Right-to-Left) Support

### Hebrew/Arabic Layout
```jsx
{/* Automatic RTL via dir attribute */}
<html dir="rtl" lang="he">

{/* CSS for RTL */}
.container {
  padding-inline-start: 1rem;  /* Becomes padding-right in RTL */
  margin-inline-end: 2rem;     /* Becomes margin-left in RTL */
}

{/* Icons that should NOT flip */}
<ChevronRightIcon className="ltr:rotate-0 rtl:rotate-180" />
```

**CRITICAL RULE:** Layout must remain IDENTICAL across all languages. Only text direction changes, NOT positioning.

---

## Image Guidelines

### Photo Quality
- **Minimum resolution:** 2x viewport size (Retina displays)
- **Format:** WebP with JPEG fallback
- **Compression:** 80-85% quality
- **Lazy loading:** `loading="lazy"` for below-fold images

### Placeholder Images
```jsx
{/* Blurred placeholder while loading */}
<img 
  src={lowQualityDataURL} 
  data-src={highQualityURL}
  className="blur-sm transition-all duration-300"
  onLoad={(e) => {
    e.target.src = e.target.dataset.src;
    e.target.classList.remove('blur-sm');
  }}
/>
```

---

## Performance Budget

### Page Load Targets
- **First Contentful Paint:** < 1.5s
- **Time to Interactive:** < 3.5s
- **Total Page Size:** < 2MB
- **JavaScript Bundle:** < 300KB (gzipped)
- **CSS:** < 50KB (gzipped)

### Optimization Strategies
- Code splitting per route
- Tree shaking
- Image optimization (WebP, lazy load)
- CDN for static assets
- Brotli compression

---

**Status:** UI/UX Specifications Complete ✅  
**Design System:** Pure white luxury minimalism  
**Responsiveness:** Mobile-first, 4 breakpoints  
**Accessibility:** WCAG 2.1 AA compliant  
**RTL Support:** Full Hebrew/Arabic support  
**Performance:** Sub-3s load times
