# Pet Wash Ltd - User Flows & Journey Maps

## Overview
Complete user flow documentation for all user types across all 6+ platforms. Each flow designed to match Uber/Airbnb/Booking.com quality standards.

---

## User Types

### 1. Customers
End users booking services for their pets

### 2. Service Providers
- Dog Walkers
- Pet Sitters/Hosts
- Drivers (PetTrek)
- Groomers
- Veterinarians

### 3. Partners
- Franchise Owners
- Station Operators
- Corporate Clients

### 4. Admin/Operations
- Customer Support
- Platform Administrators
- Finance Team
- Compliance Officers

---

## 🏠 PetWash Hub (K9000) User Flows

### Customer Flow: Book a Wash

**Entry Points:**
- Homepage "Find a Station" CTA
- Navigation menu → PetWash Hub → Locations
- GPS auto-detect nearest station
- QR code scan at physical station

**Flow Steps:**

1. **Location Selection**
   ```
   User Action: Click "Find Nearest Station"
   ↓
   System: Request GPS permission
   ↓
   Display: Map with all stations in 25km radius
   ↓
   Filter Options:
   - Distance
   - Currently Available
   - Features (self-service, full-service, grooming add-on)
   - Rating
   ↓
   User: Select Station
   ```

2. **Package Selection**
   ```
   Display: Pricing options
   - Individual Wash ($15)
   - 3-Pack ($40 - save $5)
   - 5-Pack ($65 - save $10)
   - 10-Pack ($120 - save $30)
   - Monthly Unlimited ($99/month)
   ↓
   User: Select package
   ↓
   System: Show loyalty tier discount (5-20% off)
   ```

3. **Add-ons Selection**
   ```
   Optional add-ons:
   □ Premium Shampoo (+$3)
   □ Flea Treatment (+$5)
   □ De-shedding (+$5)
   □ Nail Trim (+$8)
   □ Teeth Brushing (+$6)
   ↓
   User: Select add-ons (optional)
   ```

4. **Time Selection** (for reservations)
   ```
   Options:
   - Wash Now (if available)
   - Reserve Time Slot
     ↓ Calendar picker
     ↓ Available times shown
     ↓ Select date/time
   ↓
   Show live queue status (3 people ahead)
   ```

5. **Payment**
   ```
   Payment Options:
   - Saved Card (if exists)
   - New Card
   - Wallet Balance
   - Apple Pay / Google Pay
   - Gift Card
   ↓
   User: Select payment method
   ↓
   Apply Coupon Code (optional)
   ↓
   Review Total
   ↓
   Confirm & Pay
   ```

6. **Confirmation**
   ```
   Display:
   ✓ Booking Confirmed
   - QR Code (for station check-in)
   - Reservation Details
   - Station Address & Directions
   - Add to Calendar button
   - Share with Family
   ↓
   Notifications:
   - SMS confirmation
   - Email receipt
   - Push notification
   - Apple Wallet/Google Wallet pass added
   ```

7. **Day-of Experience**
   ```
   30 min before:
   → Push notification: "Your wash slot is coming up"
   ↓
   Arrival at station:
   → Scan QR code to start wash
   ↓
   During wash:
   → Timer displayed in app
   → Instructions shown step-by-step
   ↓
   Completion:
   → "Wash Complete" notification
   → Prompt to rate experience
   → Earn loyalty points automatically
   ```

### Partner Flow: Franchise Owner Dashboard

**Entry Points:**
- Login as franchise owner
- Navigation → Enterprise → Franchise Dashboard

**Dashboard Sections:**

1. **Real-time Operations**
   ```
   Display:
   - All stations under management
   - Current queue at each station
   - Today's revenue (real-time)
   - Active washes in progress
   - Equipment status alerts
   - Water/chemical levels
   ```

2. **Analytics & Reporting**
   ```
   Views:
   - Revenue by station
   - Peak hours heatmap
   - Customer retention rate
   - Package vs individual mix
   - Loyalty tier breakdown
   - Month-over-month growth
   ↓
   Export:
   - Excel reports
   - PDF dashboards
   - Tax-ready summaries
   ```

3. **Inventory Management**
   ```
   Features:
   - Shampoo levels
   - Chemical inventory
   - Equipment maintenance schedule
   - Auto-reorder alerts
   - Supplier management
   ```

4. **Staff Management**
   ```
   Functions:
   - Employee roster
   - Shift scheduling
   - Access control (who can manage what)
   - Performance tracking
   ```

---

## 🐕 Walk My Pet™ User Flows

### Customer Flow: Book a Dog Walker

**Entry Points:**
- Homepage "Book a Walker" CTA
- Navigation → Walk My Pet → Book
- Recurring walk reminder

**Flow Steps:**

1. **Pet Selection**
   ```
   If first time:
   → Create Pet Profile
     - Name, breed, age, weight
     - Photo upload
     - Medical notes
     - Behavioral notes
     - Walking preferences
   ↓
   If returning:
   → Select existing pet(s)
   → Can select multiple pets for group walk
   ```

2. **Walk Details**
   ```
   Select:
   - Walk Duration
     ○ 15 minutes ($12)
     ○ 30 minutes ($20)
     ○ 60 minutes ($35)
     ○ 90 minutes ($50)
   - Walk Type
     ○ Solo walk
     ○ Group walk (discount available)
   - Special Requests (text field)
   ```

3. **Schedule Selection**
   ```
   Options:
   - Walk Now (if walkers available)
   - Schedule Future Walk
     ↓ Date picker
     ↓ Time slots (30-min intervals)
   - Recurring Walks
     ↓ Days of week selector
     ↓ Same time each day
   ```

4. **Walker Selection**
   ```
   Display: Available walkers (sorted by rating, proximity)
   ↓
   Each walker card shows:
   - Photo
   - Name & Rating (4.9★)
   - Years of experience
   - # of walks completed
   - Certifications (Pet First Aid, Dog Behavior)
   - Price (standard or premium)
   - Distance from you
   - Availability indicator
   ↓
   Filter options:
   - Experience level
   - Rating (4.5+ only)
   - Certified only
   - Female walkers only
   - Speaks [Language]
   ↓
   User: Tap walker card to see full profile
   ↓
   Profile shows:
   - Bio
   - Photos from past walks
   - Reviews (with photos)
   - Background check badge
   - Insurance coverage
   ↓
   User: Select walker or "Auto-assign best available"
   ```

5. **Pickup/Dropoff**
   ```
   Pickup Location:
   - Use current location (GPS)
   - Home address (saved)
   - Custom address
   ↓
   Special Instructions:
   - Gate code
   - Parking notes
   - Pet pickup notes ("He hides under the bed")
   ↓
   Dropoff Location:
   - Same as pickup
   - Different address (e.g., daycare, friend's house)
   ```

6. **Payment & Confirmation**
   ```
   Payment Summary:
   - Base rate: $20
   - Additional pet: +$10
   - Premium walker: +$5
   - Service fee: $2.50
   - Total: $37.50
   ↓
   Payment Method:
   - Saved card
   - New card
   - Wallet balance
   - Apple Pay / Google Pay
   ↓
   Apply:
   - Promo code
   - Subscription credit (if active)
   ↓
   User: Confirm Booking
   ```

7. **Live Walk Experience**
   ```
   Walker assigned:
   → Notification: "Sarah is on her way! ETA 8 minutes"
   ↓
   En route to pickup:
   → Live GPS tracking on map
   → Walker's photo & contact info
   → Can message walker
   ↓
   Pickup:
   → Notification: "Sarah has picked up Max!"
   → Photo confirmation
   ↓
   During walk:
   → Live GPS trail shown on map
   → Photo updates every 10 minutes
   → Route traveled
   → Distance walked
   ↓
   Dropoff:
   → Notification: "Max is home safe!"
   → Final photos
   → Walk summary:
     - Total distance: 1.8 miles
     - Duration: 32 minutes
     - Bathroom breaks: 2
     - Walker notes: "Max did great! Very friendly with other dogs."
   ↓
   Post-walk:
   → Rate walker (1-5 stars)
   → Leave review
   → Tip walker (suggested 15%, 20%, 25%, custom)
   → Save as favorite walker
   ```

### Provider Flow: Dog Walker Onboarding

**Entry Points:**
- Homepage "Become a Walker" CTA
- Navigation → Walk My Pet → Become a Walker

**Onboarding Steps:**

1. **Application**
   ```
   Form Fields:
   - Personal Information
     - Full name
     - Email, phone
     - Date of birth (18+ verification)
     - Address
   - Experience
     - Years walking dogs
     - Types of pets handled
     - Professional experience
     - References (3 required)
   - Availability
     - Days of week
     - Time slots
     - Max walks per day
   - Service Area
     - Primary location
     - Willing to travel (radius)
   ```

2. **Background Check** (Automated via integration)
   ```
   Consent form:
   → User signs digitally
   ↓
   Identity Verification:
   → Upload government ID (passport/driver's license)
   → Selfie for face match
   ↓
   Background Check:
   → Criminal record check (via Checkr or similar)
   → Processing time: 2-5 business days
   ↓
   Status: "Under Review"
   ```

3. **Certifications** (Optional but increases bookings)
   ```
   Upload certificates:
   □ Pet First Aid
   □ Dog Behavior Training
   □ Canine CPR
   ↓
   Or take online courses:
   → Pet Wash Academy links to courses
   → Earn certification through platform
   ```

4. **Insurance & Liability**
   ```
   Options:
   - Upload existing pet care liability insurance
   - Purchase through platform ($15/month)
   ↓
   Agreement:
   → Read and accept platform insurance policy
   → Understand liability coverage ($1M coverage)
   ```

5. **Payment Setup**
   ```
   Bank Account:
   - Add bank account for direct deposit
   - Verify with micro-deposits (2-3 days)
   ↓
   Tax Information:
   - W-9 form (for US)
   - Tax ID or SSN
   ↓
   Payout Schedule:
   - Weekly (default)
   - Instant payout (for fee)
   ```

6. **Profile Creation**
   ```
   Upload:
   - Profile photo (professional)
   - Photos with pets you've walked
   - Bio (250 words max)
   ↓
   Set Rates:
   - Standard walker: Platform rate
   - Premium walker: +$5-10 (after 50 walks, 4.8+ rating)
   ```

7. **Approval & Go Live**
   ```
   Admin Review:
   → Background check complete
   → Insurance verified
   → Profile reviewed
   ↓
   Approval:
   → Email: "Congratulations! You're approved."
   → SMS notification
   ↓
   Onboarding Tutorial:
   → Video walkthrough
   → How to accept bookings
   → How to use GPS tracking
   → Best practices
   ↓
   Status: Active Walker
   ```

### Provider Flow: Accept & Complete Walk

**Steps:**

1. **Receive Booking Request**
   ```
   Push notification: "New walk request!"
   ↓
   Display:
   - Pet details (name, breed, photo)
   - Owner rating
   - Walk duration & pay
   - Pickup location (distance from you)
   - Special requests
   ↓
   Action:
   - Accept (15 seconds to respond)
   - Decline (no penalty for first 2/day)
   ↓
   Auto-decline after 15 seconds if no response
   ```

2. **Pre-Walk Preparation**
   ```
   View:
   - Full pet profile
   - Medical notes (allergies, medications)
   - Behavioral notes
   - Emergency contacts
   - Vet information
   ↓
   Navigate:
   → Turn-by-turn directions to pickup
   ```

3. **Pickup**
   ```
   Arrive at location:
   → Tap "I've Arrived"
   → Notification sent to owner
   ↓
   Meet owner or use lockbox code
   ↓
   Confirm pickup:
   → Take photo of pet
   → Tap "Start Walk"
   → GPS tracking starts automatically
   ```

4. **During Walk**
   ```
   App features:
   - Live GPS tracking (visible to owner)
   - Auto photo prompts (every 10 min)
   - Walk stats (distance, time)
   - Emergency button
   ↓
   If incident:
   → Stop walk
   → Call emergency hotline
   → Document with photos
   → Fill incident report
   ```

5. **Dropoff**
   ```
   Return to owner:
   → Tap "Complete Walk"
   → Take final photo
   → Add notes for owner
   ↓
   Submit walk report:
   - Bathroom breaks: 2
   - Behavior: Excellent
   - Interactions: Friendly with 3 other dogs
   - Notes: "Max loved the park!"
   ```

6. **Post-Walk**
   ```
   Earnings:
   - Base pay: $20
   - Tip: $5 (owner adds after)
   - Total: $25
   ↓
   Next booking auto-suggested if available in area
   ```

---

## 🏡 The Sitter Suite™ User Flows

### Customer Flow: Book a Pet Sitter

**Flow Steps:**

1. **Search & Discovery**
   ```
   Search inputs:
   - Location (city, ZIP, or GPS)
   - Dates (check-in, check-out)
   - Number of pets
   - Pet type (dog, cat, bird, exotic)
   ↓
   Results page:
   - Grid/list view of available hosts
   - Map view with pins
   ↓
   Each listing shows:
   - Host photo
   - Home photo
   - Price per night
   - Rating & review count
   - Instant Book badge
   - Amenities icons (yard, pet camera, etc.)
   ```

2. **Filters**
   ```
   Advanced filters:
   - Price range
   - Home type (house, apartment, farm)
   - Yard/garden available
   - Other pets in home (yes/no)
   - Experience level (beginner, intermediate, expert)
   - Certifications only
   - Cancellation policy (flexible, moderate, strict)
   - Pet size accepted (small, medium, large)
   ```

3. **Host Profile View**
   ```
   Sections:
   - About the Host
     - Bio
     - Experience (5 years, 200+ sits)
     - Response time (avg 2 hours)
   - The Home
     - Photo gallery (10+ photos)
     - Virtual tour video
     - Amenities checklist
     - Fenced yard dimensions
   - Reviews (4.9★ from 87 reviews)
     - Filter by pet type
     - Sort by recent, helpful, rating
   - House Rules
     - Max pets: 2
     - Pet sizes accepted: All
     - Destructive pets: No
     - Indoor/outdoor: Both
   - Availability Calendar
     - Blocked dates shown
     - Minimum stay: 1 night
   ```

4. **Request to Book** (or Instant Book)
   ```
   Enter details:
   - Exact check-in/out times
   - Pet information (select from profile)
   - Special requests
   ↓
   If Instant Book:
   → Book immediately, payment charged
   ↓
   If Request to Book:
   → Host has 24 hours to accept/decline
   → Payment holds, not charged until accepted
   ```

5. **Pre-Arrival Communication**
   ```
   Messaging:
   - Introduce your pet
   - Share photos/videos
   - Discuss routine, diet, medications
   - Schedule meet & greet (optional)
   ↓
   Upload documents:
   - Vaccination records
   - Vet authorization
   - Emergency contacts
   ```

6. **Check-In**
   ```
   Day of arrival:
   → Reminder notification
   ↓
   Drop off pet:
   → Host confirms check-in
   → Photo confirmation
   ↓
   During stay:
   → Daily photo updates from host
   → Message anytime
   → Host logs meals, walks, playtime
   ```

7. **Check-Out & Review**
   ```
   Pick up pet:
   → Host confirms check-out
   → Final report from host
   ↓
   Rate & review:
   - Overall rating (1-5 stars)
   - Breakdown (cleanliness, communication, care)
   - Write review
   - Upload photos from stay
   ↓
   Payment released to host (24 hours after checkout)
   ```

### Provider Flow: Become a Host

**Onboarding:**

1. **Host Application**
   ```
   Step 1: About You
   - Name, contact info
   - Experience with pets
   - Why do you want to host?
   ↓
   Step 2: Your Home
   - Home type (house, apartment, farm)
   - Square footage
   - Yard size & fencing
   - Photos (minimum 5)
   - Video tour (optional, recommended)
   ↓
   Step 3: Amenities
   □ Fenced yard
   □ Pet camera
   □ Dog bed/crate
   □ Toys available
   □ Climate control
   □ Emergency vet nearby (<10 miles)
   ↓
   Step 4: Capacity & Rules
   - Max pets at once: __
   - Pet sizes accepted: □ Small □ Medium □ Large
   - Pet types accepted: □ Dogs □ Cats □ Birds □ Exotic
   - Other pets in home: Yes/No
   - House rules (text field)
   ```

2. **Verification**
   ```
   Identity:
   → Upload government ID
   → Selfie verification
   ↓
   Home Verification:
   → Schedule video inspection (live with admin)
   → Or self-guided video tour submission
   ↓
   Background Check:
   → Criminal record check
   → Animal abuse registry check
   ```

3. **Certifications**
   ```
   Required:
   □ Pet First Aid (take course or upload cert)
   ↓
   Optional (increases bookings):
   □ Animal Behavior
   □ Dog Training
   □ Exotic Pet Care
   ```

4. **Pricing Setup**
   ```
   Set nightly rate:
   - Platform suggests rate based on:
     - Location
     - Amenities
     - Comparable hosts
   ↓
   Additional fees:
   - Extra pet: $__/night
   - Holiday pricing: +__%
   - Cleaning fee: $__ (one-time)
   ```

5. **Calendar & Availability**
   ```
   Block unavailable dates
   ↓
   Set minimum/maximum stay
   ↓
   Instant Book settings:
   - Enable/disable
   - Auto-accept criteria (e.g., 4.5+ guest rating)
   ```

6. **Go Live**
   ```
   Admin approval:
   → Profile reviewed
   → Home verified
   → Certifications checked
   ↓
   Status: Active Host
   ↓
   First booking incentive: 20% off platform fee
   ```

---

## 🚗 PetTrek™ User Flows

### Customer Flow: Book Pet Transport

**Flow Steps:**

1. **Ride Type Selection**
   ```
   Options:
   - Ride Now
   - Schedule Ride
   - Recurring Ride (e.g., daycare Mon-Fri)
   ```

2. **Pickup & Dropoff**
   ```
   Pickup:
   - Current location (GPS)
   - Saved location (home, work)
   - Enter address
   ↓
   Dropoff:
   - Enter destination
   - Common destinations shown (vet, groomer, daycare)
   ↓
   Additional stops: +$5/stop
   ```

3. **Pet Selection**
   ```
   Select pet(s):
   - Checkbox for each pet in profile
   - Multiple pets allowed (pricing adjusts)
   ↓
   Pet size affects pricing:
   - Small (<20 lbs): Base rate
   - Medium (20-50 lbs): +$3
   - Large (50-80 lbs): +$5
   - XL (80+ lbs): +$8
   ```

4. **Vehicle Selection**
   ```
   Options:
   - Standard (sedan, climate control)
   - Premium (SUV, extra space, water bowl)
   - XL (van, for multiple large pets)
   ↓
   Shows estimated price for each
   ```

5. **Special Requests**
   ```
   Text field:
   - Temperature preferences
   - Music preferences
   - Carrier requirements
   - Anxiety notes
   - Pickup instructions
   ```

6. **Fare Estimate & Booking**
   ```
   Fare breakdown:
   - Base fare: $12
   - Distance (3.2 miles): $8
   - Medium pet fee: +$3
   - Service fee: $2
   - Total: $25
   ↓
   User: Confirm Booking
   ```

7. **Driver Assignment & Tracking**
   ```
   Driver assigned:
   → Notification with driver details
   → Photo, name, rating
   → Vehicle make/model, license plate
   ↓
   En route to pickup:
   → Live GPS tracking
   → ETA countdown
   → Can call/text driver
   ↓
   Pickup:
   → Notification: "Driver arrived"
   → Photo of pet in vehicle
   ↓
   During ride:
   → Live GPS tracking
   → Route map
   → ETA to destination
   ↓
   Dropoff:
   → Notification: "Trip complete"
   → Photo of pet at destination
   → Trip summary (distance, time, route)
   ```

8. **Post-Ride**
   ```
   Receipt:
   - Fare breakdown
   - Distance traveled
   - Trip duration
   ↓
   Rate driver:
   - 1-5 stars
   - Review (optional)
   - Tip (15%, 20%, 25%, custom)
   ↓
   Save as favorite driver (auto-request next time)
   ```

---

## ✂️ Grooming Services User Flows

### Customer Flow: Book Grooming Appointment

**Flow Steps:**

1. **Service Selection**
   ```
   Choose service:
   - Bath & Brush ($30-80)
   - Full Groom ($50-150)
   - Nail Trim Only ($15)
   - Teeth Cleaning ($25)
   - De-shedding Treatment ($35-65)
   - Breed-Specific Cut ($60-120)
   ↓
   Add-ons:
   □ Flea treatment (+$15)
   □ Ear cleaning (+$10)
   □ Anal gland expression (+$12)
   □ Blueberry facial (+$8)
   ```

2. **Pet Selection**
   ```
   Select pet
   ↓
   Auto-fill:
   - Breed (affects pricing)
   - Weight (small, medium, large, XL)
   - Coat type (affects service recommendations)
   ↓
   Special notes:
   - Matting issues
   - Sensitive skin
   - Anxious behavior
   - Previous groom notes shown
   ```

3. **Location Selection**
   ```
   Options:
   - In-salon grooming (30+ locations)
   - Mobile grooming (van comes to you, +$25)
   ↓
   If in-salon:
   → Select location from map/list
   ↓
   If mobile:
   → Enter address
   → Select service area
   ```

4. **Groomer Selection**
   ```
   Display available groomers:
   - Photo & name
   - Certifications (Certified Master Groomer, Breed Specialist)
   - Years of experience
   - Rating & review count
   - Portfolio (before/after photos)
   - Next available time slot
   ↓
   Or: "Auto-assign next available"
   ```

5. **Date & Time**
   ```
   Calendar view:
   → Select date
   ↓
   Time slots (30-min intervals):
   → 9:00 AM - Available
   → 9:30 AM - Booked
   → 10:00 AM - Available
   ↓
   Select time
   ```

6. **Review & Confirm**
   ```
   Summary:
   - Service: Full Groom
   - Pet: Max (Golden Retriever, 70 lbs)
   - Groomer: Sarah (4.9★, Certified)
   - Location: Downtown Salon
   - Date: Sat, Nov 16, 10:00 AM
   - Price: $85 + $10 (ear cleaning)
   - Total: $95
   ↓
   Payment:
   - Pay now (5% discount)
   - Pay at salon
   ↓
   Confirm Booking
   ```

7. **Reminders & Day-Of**
   ```
   1 day before:
   → Reminder notification
   ↓
   2 hours before:
   → "Appointment today at 10 AM!"
   ↓
   Check-in:
   → Drop off pet at salon
   → Groomer notes pre-groom condition
   ↓
   During grooming:
   → Progress updates (optional text photos)
   ↓
   Ready for pickup:
   → "Max is ready! Looking fabulous 🐾"
   → Before/after photos
   ↓
   Pickup:
   → Review groomer notes
   → Pay (if not prepaid)
   → Rate & review
   ```

---

## 🏥 Vet On Demand User Flows

### Customer Flow: Telemedicine Consultation

**Flow Steps:**

1. **Consultation Type**
   ```
   Options:
   - Immediate (connect within 5 min)
   - Schedule Appointment
   - Urgent Care (24/7)
   - Follow-up Visit
   - Prescription Refill
   ```

2. **Pet Selection & Symptoms**
   ```
   Select pet
   ↓
   Primary concern:
   - Dropdown categories (skin, digestive, behavior, etc.)
   ↓
   Symptom details:
   - Text description
   - Upload photos/videos (optional)
   - Duration of symptoms
   - Severity (mild, moderate, severe, emergency)
   ```

3. **Vet Selection** (or Auto-assign)
   ```
   If specialist needed:
   → Filter vets by specialty
   ↓
   Display available vets:
   - Photo & credentials
   - Specializations
   - Years of experience
   - Rating
   - Next available time
   - Consultation fee
   ↓
   Or: "Next available vet" for fastest service
   ```

4. **Video Consultation**
   ```
   Pre-call:
   → Test camera/microphone
   → Review pet medical history (visible to vet)
   ↓
   During call:
   → Live video with vet
   → Screen sharing (vet can annotate)
   → Vet takes notes (visible after call)
   ↓
   Vet may request:
   → Close-up photos
   → Videos of behavior
   → Temperature reading
   ```

5. **Diagnosis & Treatment Plan**
   ```
   Vet provides:
   - Diagnosis
   - Treatment recommendations
   - Prescription (if needed)
   - Follow-up instructions
   - When to seek in-person care
   ↓
   Visit summary sent to:
   - App (saved in medical records)
   - Email (PDF)
   - Can share with regular vet
   ```

6. **Prescription Fulfillment**
   ```
   If prescription issued:
   ↓
   Options:
   - Deliver to home (1-2 days)
   - Pickup at partner pharmacy
   - Send to existing pharmacy
   ↓
   Track prescription delivery
   ```

7. **Follow-Up**
   ```
   24 hours later:
   → "How is Max feeling?" survey
   ↓
   If needed:
   → Schedule follow-up call (discounted)
   ```

---

## Admin/Support Flows

### Customer Support: Handle Ticket

**Flow:**

1. **Ticket Creation** (from customer)
   ```
   Customer submits:
   - Issue category
   - Description
   - Attachments (screenshots)
   - Priority (auto-detected or manual)
   ```

2. **Assignment**
   ```
   Auto-assign to:
   - Available agent
   - Specialist (if needed)
   - Escalation queue (if urgent)
   ```

3. **Response**
   ```
   Agent views:
   - Customer profile
   - Order/booking history
   - Past tickets
   - Loyalty tier
   ↓
   Agent responds:
   - Via chat
   - Via email
   - Via phone call
   ↓
   Actions:
   - Issue refund
   - Reschedule booking
   - Apply credit
   - Escalate to manager
   ```

4. **Resolution & Feedback**
   ```
   Mark ticket resolved
   ↓
   Customer receives:
   → "Your issue has been resolved"
   → Rate support experience (1-5 stars)
   ```

---

## KYC/Verification Flows

### Provider Verification (All Platforms)

**Steps:**

1. **Identity Verification**
   ```
   Upload:
   - Government-issued ID (passport, driver's license)
   - Selfie for face match
   ↓
   Automated verification via Google Cloud Vision API
   ↓
   Result: Approved or Needs Manual Review
   ```

2. **Background Check**
   ```
   Consent form signed
   ↓
   Integration with Checkr/similar service
   ↓
   Checks:
   - Criminal record
   - Sex offender registry
   - Animal abuse registry
   ↓
   Processing: 2-5 business days
   ```

3. **Insurance Verification**
   ```
   Upload:
   - Liability insurance policy
   ↓
   Verification:
   - Policy number
   - Coverage amount ($1M minimum)
   - Expiration date
   ↓
   Set reminders 30 days before expiration
   ```

4. **Payment Verification**
   ```
   Bank account:
   - Routing & account numbers
   - Micro-deposit verification (2-3 days)
   ↓
   Tax info:
   - W-9 form (US)
   - Tax ID/SSN
   - EIN (if business)
   ```

---

## Payment & Refund Flows

### Customer: Request Refund

**Flow:**

1. **Initiate Refund Request**
   ```
   From order history:
   → Select transaction
   → Tap "Request Refund"
   ```

2. **Reason Selection**
   ```
   Dropdown:
   - Service not provided
   - Quality issues
   - Provider no-show
   - Changed plans
   - Other (text field)
   ```

3. **Evidence Upload**
   ```
   Optional:
   - Photos
   - Screenshots
   - Messages with provider
   ```

4. **Automated Decision** (if applicable)
   ```
   Instant approval if:
   - Provider cancelled
   - No-show confirmed
   - Service < $50 and first refund
   ↓
   Otherwise:
   → Escalate to support team
   ```

5. **Refund Processing**
   ```
   Approved:
   → Refund to original payment method (3-5 business days)
   → Or instant refund to wallet balance
   ↓
   Denied:
   → Explanation provided
   → Option to appeal
   ```

---

## Loyalty & Rewards Flow

### Customer: Earn & Redeem Points

**Earning:**

```
Points earned automatically on:
- Every wash: 10 points per $1 spent
- Refer a friend: 500 points (when they complete first booking)
- Write a review: 50 points
- Complete profile: 100 points
- Social media share: 25 points
- Birthday month: 2x points
↓
Notifications:
→ "+120 points earned!" after each transaction
```

**Redeeming:**

```
View points balance
↓
Browse rewards catalog:
- $5 off (500 points)
- $10 off (950 points)
- Free individual wash (1,200 points)
- Free grooming add-on (800 points)
- Partner rewards (varies)
↓
Select reward
↓
Apply to next booking or generate voucher code
```

---

## Dispute Resolution Flow

### Customer vs Provider Dispute

**Trigger:**
- Customer claims service issue
- Provider disputes claim

**Flow:**

1. **Dispute Initiated**
   ```
   Customer:
   → "Report an Issue" on completed booking
   → Select issue type
   → Provide evidence
   ```

2. **Provider Notified**
   ```
   Provider receives:
   → Notification of dispute
   → 48 hours to respond
   → Upload counter-evidence
   ```

3. **Automated Resolution** (if clear-cut)
   ```
   System analyzes:
   - GPS data (walker/driver)
   - Timestamps
   - Photos
   - Messages
   ↓
   If decisive evidence:
   → Auto-resolve in favor of one party
   ```

4. **Manual Review** (if needed)
   ```
   Escalated to support team
   ↓
   Support reviews:
   - Both sides' evidence
   - Platform data
   - History of both users
   ↓
   Decision made within 3 business days
   ```

5. **Resolution**
   ```
   Outcomes:
   - Full refund to customer
   - Partial refund
   - No refund, issue dismissed
   - Provider warning/suspension
   ↓
   Both parties notified
   ↓
   Can appeal within 7 days
   ```

---

## Notification Strategy

### Push Notifications

**Transactional:**
- Booking confirmed
- Provider assigned
- Service starting soon
- Service in progress
- Service completed
- Payment processed

**Engagement:**
- Loyalty tier upgrade
- Points expiring soon
- Personalized recommendations
- Re-engagement (inactive 30 days)

**Operational:**
- Schedule changes
- Cancellations
- Refunds processed
- Account security alerts

**Frequency Limits:**
- Max 3 marketing notifications per week
- Transactional: unlimited
- User can customize in settings

---

**Status:** User Flows Complete ✅  
**Coverage:** All 6+ platforms, 4 user types, 20+ major flows  
**Ready for Development:** Yes
