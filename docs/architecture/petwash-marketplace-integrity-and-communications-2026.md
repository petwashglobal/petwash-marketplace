# PetWash Marketplace Integrity & Communications Doctrine — 2026

Author: CEO directive 2026-08-29 (Marketplace Protection Doctrine)
Status: DOCTRINE (source of truth for chat, safety, anti-circumvention)
Companion: `petwash-marketplace-business-doctrine-2026.md`
Scope: contracts, chat safety, contact protection, payment control, rebooking
       UX, detection, fair enforcement.

## 0. Business goal (§66)

> We are NOT trying to imprison users. We are protecting the marketplace
> relationship PetWash created.
>
> Best protection = TRUST + CONVENIENCE + SUPPORT + ONE-TAP REBOOKING +
> SAFE PAYMENT + CLEAR RULES.

Enforcement lives behind that stack — never in front of it.

## 1. Fundamental rule (§1)

If PetWash introduced customer ↔ provider, then CURRENT + FUTURE + REPEAT
bookings between that pair remain on PetWash per the applicable Terms /
Provider Agreement.

**Exact wording and duration of any non-circumvention obligation MUST be
approved by Israeli counsel before production activation.** Do NOT invent a
12 / 24-month restriction in code. Duration is POLICY-CONFIGURED (§64, §65).

## 2. Agreements (§2, §3)

### 2.1 Provider Agreement — versioned + counsel-approved

Provisions (counsel-approved copy, not this file's copy):

- non-circumvention
- no direct solicitation of PetWash customers
- no off-platform payment solicitation
- no using PetWash customer data for unrelated marketing
- future / repeat services with customers introduced through PetWash
- platform communication rules
- professional conduct
- safety
- privacy
- cancellation
- reviews
- fees / commission
- suspension / enforcement
- dispute process

Acceptance evidence (per acceptance record):

```ts
type ProviderAgreementAcceptance = {
  providerUid: string;
  agreementVersion: string;
  language: 'he' | 'en';
  acceptedAt: string;
  ipMeta?: string;          // hashed / masked per privacy review
  deviceMeta?: string;
  documentHash: string;
  method: 'electronic';
};
```

Store append-only. Never overwrite prior evidence.

### 2.2 Customer Terms

Friendly language; explain WHY:

- secure payment
- booking record
- support
- eligible protections
- service history
- receipts
- reviews
- dispute support
- Prestige benefits
- verified provider relationship

## 3. UX principles

### 3.1 Don't ask them to sign every booking (§4)

- Provider: full agreement once, plus reaccept on material version change.
- Customer: Terms at account activation + booking confirmation incorporates
  Marketplace Terms by reference.
- Higher-risk moments (contact unlock / Meet & Greet): small acknowledgement —
  *"Keep bookings and payments on PetWash to stay protected."*

### 3.2 Sell the benefit (§29, §30)

Every friction step must show the customer or provider what they GET, not
just what they can't do.

## 4. Meet & Greet (§5, §6, §35)

A PetWash event, not a lead export.

```ts
type MeetAndGreet = {
  meetId: string;
  customerUid: string;
  providerUid: string;
  serviceType: ServiceType;
  petIds: string[];
  prospectiveBookingId?: string;
  scheduledAt: string;
  location: BookingLocation;
  status: 'PROPOSED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
};
```

Customer: `[Request Meet & Greet]`. Provider: `[Accept] | [Suggest Another Time]`.

Before the event, both parties acknowledge counsel-approved wording:
*"This introduction was made through PetWash. Future bookings with this
provider / customer must remain on PetWash."*

After the event: customer sees `[Book Maya]`. Provider sees `[Send Availability]`.
Legitimate conversion easier than bypass.

## 5. Contact + call model (§9–§12)

Progressive reveal ladder (mirrors business doctrine §11.1) with policy notes:

| Phase | Contact reveal | Call button | Metadata stored |
| --- | --- | --- | --- |
| PRE-REQUEST | none | none | — |
| REQUESTED | none | none | — |
| MEET_AND_GREET confirmed | masked (if operationally necessary) | none | mask expiry, audit |
| BOOKING CONFIRMED | masked | `Call Provider` enabled | callerUid, recipientUid, bookingId, startedAt, endedAt, result |
| IN_PROGRESS | masked, prominent | `Call Owner`, emergency actions | same + safety flag |
| COMPLETED | masked expires per policy | archive | — |
| CANCELLED / DISPUTED | historical only | — | — |

Never publish provider raw phone. Preferred: PetWash relay / in-app voice.

### 5.1 No default call-audio recording (§12)

Safe metadata only. Any call recording would require separate privacy / legal
review and clear consent.

## 6. Message Policy Engine (§13–§40)

### 6.1 Server is authority (§13)

Every customer ↔ provider message passes SERVER-SIDE through
`MarketplaceMessagePolicyEngine.evaluate()` BEFORE delivery. Client-side
protection can improve UX; it is never the enforcement point.

### 6.2 Categories (§14)

- `OFF_PLATFORM_BOOKING`
- `OFF_PLATFORM_PAYMENT`
- `CONTACT_EXCHANGE`
- `EXTERNAL_MESSAGING_APP`
- `EXTERNAL_LINK`
- `SEXUAL_SOLICITATION`
- `SEXUAL_HARASSMENT`
- `ABUSIVE_LANGUAGE`
- `THREAT`
- `HATE_OR_SLUR`
- `SCAM_OR_FRAUD`
- `SPAM`
- `SENSITIVE_INFORMATION`
- `SELF_HARM_OR_DANGER` (safety escalation)
- `PET_SAFETY_RISK`

### 6.3 Outcomes (§15)

Not binary. `ALLOW | ALLOW_WITH_NOTICE | WARN_BEFORE_SEND | BLOCK |
BLOCK_AND_REVIEW | SAFETY_ESCALATION`.

### 6.4 Context inputs (§20)

Policy uses:

- `threadType`
- `bookingStatus`
- `sender`
- `recipient`
- `workspaceContext`
- `servicePhase`
- structured field (system message vs user message)
- policy version

### 6.5 Sexual content (§16)

BLOCK sexual solicitation / propositions / harassment / explicit content
directed at another human, and requests for sexual services.

**Do NOT use keyword filters.** Pet care legitimately mentions `male`,
`female`, `neutered`, `spayed`, `in heat`, `breeding history`, genitals,
`urination`, reproductive health. Use CONTEXT.

- ✅ `"My dog is not neutered."` → ALLOW
- ⛔ `"Want to come over for sex?"` → BLOCK

### 6.6 Abuse ladder (§17)

Distinguish casual profanity from personal abuse from threats from hate.

- casual frustration → WARN or ALLOW per product policy
- personal insult → WARN or BLOCK
- threat → BLOCK + review
- slur / hate → BLOCK + review

User surface: `[Report]`, `[Block user]` (where appropriate).

### 6.7 Contact / off-platform intent (§18, §19)

Detect basic obfuscation variants. Detect MEANING, not one word:

- ⛔ `"Cancel this and I'll do it cheaper privately."`
- ⛔ `"Pay cash when I arrive."`
- ⛔ `"Next time don't use PetWash."`
- ⛔ `"Message me on WhatsApp and we'll arrange it."`
- ⛔ `"Bank transfer directly to me."`

BLOCK or WARN by confidence + policy version. Do NOT publish detection rules.

### 6.8 Legitimate context (§20, §54)

Confirmed booking may need vet phone number. Active service may need emergency
contact. Household access details are legitimate at the right phase. Filter
knows the CONTEXT before deciding.

### 6.9 Structured contact data (§21)

Emergency contact / vet / access instructions live in the Job Passport — a
structured field, not free chat. That reduces the need for text contact
exchange and reduces false positives.

### 6.10 Blocked-message UX (§22–§24, §39)

Sender sees a policy-neutral message + edit affordance:

- Off-platform booking / payment: *"Keep bookings and payments on PetWash…"*
- Contact block pre-booking: *"For privacy and safety, please keep
  communication in PetWash until the booking reaches the appropriate stage."*
- Sexual harassment: *"This message can't be sent because it appears to
  violate PetWash safety standards."* (recipient never sees the abusive
  content; safety event created)

Buttons: `[Edit Message]` `[Why?]`. Do NOT show the detector's rules.

### 6.11 Enforcement ladder (§25)

`EDUCATION → WARNING → MESSAGE BLOCK → CONTACT RESTRICTION → MANUAL REVIEW →
TEMPORARY MARKETPLACE SUSPENSION → PERMANENT REMOVAL`

Escalation speed depends on confidence, severity, history, context. Sexual
threats / severe abuse / fraud escalate faster.

### 6.12 Moderation audit (§40)

Per attempt:

```ts
type MessageModerationAudit = {
  messageAttemptId: string;
  senderUid: string;
  threadId: string;
  bookingId?: string;
  policyVersion: string;
  decision: PolicyOutcome;
  category: PolicyCategory;
  confidence: number;         // 0..1
  timestamp: string;
  reviewStatus?: 'pending' | 'reviewed' | 'closed';
};
```

Raw blocked-message body is stored only as long as needed for safety /
dispute / legal evidence under the retention policy. Privacy review required.

### 6.13 Reporting (§42)

Every message menu offers `Report` with reasons:

- Trying to arrange payment outside PetWash
- Harassment / sexual content
- Abusive language
- Threat
- Spam / scam
- Unsafe pet care
- Other

## 7. Anti-circumvention risk engine (§26, §27, §43, §44)

### 7.1 Signals

```ts
type MarketplaceIntegritySignal = {
  signalId: string;
  signalType:
    | 'OFF_PLATFORM_MESSAGE_ATTEMPT'
    | 'PAYMENT_DETAIL_ATTEMPT'
    | 'CONTACT_EXCHANGE_ATTEMPT'
    | 'REPEATED_CANCEL_AFTER_CONTACT'
    | 'EXTERNAL_LINK_ATTEMPT'
    | 'DIRECT_SOLICITATION';
  customerUid: string;
  providerUid: string;
  bookingId?: string;
  threadId?: string;
  confidence: number;
  detectedAt: string;
  resolution?: 'AUTO_BLOCK' | 'WARN' | 'PENDING_REVIEW' | 'DISMISSED' | 'ACTIONED';
};
```

Risk information — NOT automatic financial guilt.

### 7.2 No auto-ban on one ambiguous message (§25, §43)

Multi-signal review. Provider integrity signals are EXPLAINABLE — no
mysterious "AI punishment score". Provider retains appeal / review path where
required.

### 7.3 Both sides can violate (§44)

Customer soliciting off-platform is a violation just like provider soliciting.
Protect provider from pressure to bypass with `[Keep this on PetWash]` (§45)
— a friendly system-generated response that does NOT count against the
provider.

### 7.4 Off-platform effect on Prestige / reviews (§46, §47)

Off-platform activity produces no Prestige points, no booking history, no
review eligibility, no verified provider completion history. Explain that;
don't threaten.

## 8. Payment controls (§31–§34)

- Bank account / PayPal link / payment QR / crypto address / wallet handle
  MUST NOT be pastable into customer booking chat (`MessagePolicyEngine`
  hard-block).
- Add-ons / extra work / extra pet / extend booking → structured actions:
  `[Request Booking Change] | [Add Pet / Care Requirement] | [Extend Booking]`.
  Server prices per business rules; customer accepts explicitly; payment
  adjustment through PetWash.

## 9. Repeat + rebook UX (§7, §8, §28, §36, §37, §57, §60, §61)

### 9.1 One-tap rebook

Post-completion the customer sees `[Book Maya Again]`. Prefill: provider,
service, pets, address, care profile. Customer picks new date, confirms
current availability + current price. If rebooking takes 15 seconds, there's
less pull toward WhatsApp negotiation.

### 9.2 Provider past-clients surface (§8)

Structured `[Offer Availability]` + `[Message]` + `[View Previous Booking]`.
Not a private direct-sales CRM export.

### 9.3 Relationship record (§36)

```ts
type MarketplaceRelationship = {
  relationshipId: string;
  customerUid: string;
  providerUid: string;
  introducedAt: string;
  source: 'SEARCH' | 'RECOMMENDATION' | 'MEET_AND_GREET' | 'REBOOK' | 'ADMIN';
  firstBookingId?: string;
  lastBookingId?: string;
  status: 'ACTIVE' | 'DORMANT' | 'CLOSED';
};
```

Purpose: rebook, integrity signals, support, context. NOT a permission grant
— per-booking phase permissions still apply (§37).

### 9.4 Favourites per human/provider/service (§60)

"Favourite Maya for Walking" ≠ "Favourite Maya for Daycare". Favourites are
edges keyed by `(customerUid, providerUid, serviceType)`.

## 10. Structured actions inside chat (§62)

Chat UI SHOULD render these business actions inline:

- `Request booking`
- `Accept booking`
- `Suggest change`
- `Send revised quote`
- `Extend booking`
- `Add pet`
- `Schedule Meet & Greet`
- `Call`
- `Report`
- `Cancel`
- `Contact support`

Each mutates state through the domain endpoint — the free-text message beside
it does NOT.

## 11. Determinism vs LLM (§63)

- **First layer — deterministic:** links, contact patterns, payment
  identifiers, known prohibited destinations, structured field checks.
- **Second layer — moderation / classifier:** contextual categories, sexual
  vs medical, threat vs frustration.
- **Decision:** the deterministic policy engine is authoritative. The
  classifier PROPOSES categorisation; policy version + threshold decides
  action. High-risk enforcement can require human review.

Never let the LLM directly change money, cancel, refund, mark complete,
approve provider, or accept a quote (business doctrine §59).

## 12. Policy versioning (§64)

- `MarketplacePolicyVersion` is stamped on every moderation audit + every
  Provider Agreement acceptance.
- No hidden constantly-changing rules.
- Version diff is reviewable by counsel + safety team.

## 13. Legal gate (§65)

Prepare the technical framework and draft policy language. DO NOT activate,
without Israeli counsel review:

- non-circumvention duration
- penalties
- liquidated damages
- termination rights
- specific Israel contractual remedies

Configure via `MarketplacePolicyConfig`; keep production defaults conservative
until counsel signs off.

## 14. Overrides — safety beats leakage (§48–§50)

- Confirmed Meet & Greet needs date, time, PetWash-arranged location — do NOT
  make product unusable in the name of anti-circumvention (§48).
- Active service: authorized structured access to owner, emergency contact,
  vet, service address (§49).
- Threats / sexual harassment / stalking: allow reporting + support
  escalation; restrict contact immediately when appropriate. Never require
  the victim to continue the booking to preserve commission (§50).

## 15. Storage architecture (§61)

DO NOT build a second chat system. Reuse:

- current booking-chat storage (legacy `booking_messages` etc.)
- `chat_threads` spine

Build ONE shared engine:

```ts
class MarketplaceMessagePolicyEngine {
  evaluate(input: MessageEvalInput): PolicyResult;
}
```

Called from both surfaces + future Meet & Greet messaging. Storage
convergence can come later; policy sharing cannot wait.

## 16. E2E matrix (§51–§60)

| # | Scenario | Expected |
| --- | --- | --- |
| I1 | Pre-book contact exchange | BLOCK; no message delivered; integrity event |
| I2 | Direct payment attempt | BLOCK; customer never sees payment instructions |
| I3 | High-confidence sexual solicitation | BLOCK; safety event; recipient protected |
| I4 | Pet medical context (`"in heat" / "not spayed"`) | ALLOW; no keyword false positive |
| I5 | Casual profanity | WARN or ALLOW per policy |
| I6 | Directed abuse | BLOCK or WARN |
| I7 | Threat | BLOCK + review |
| I8 | Hate / slur | BLOCK + review |
| I9 | Meet & Greet completion → book | Introduction persists; no post-M&G payment-instructions message allowed |
| I10 | Repeat booking (§57) | One-tap; current price shown; PetWash payment; no full search |
| I11 | Extra night mid-booking (§58) | `Request Change` → customer accepts → new snapshot + payment update |
| I12 | Active-service emergency (§59) | Owner call / emergency contact / vet accessible even though general sharing is restricted |
| I13 | Multi-role (§60) | As customer → customer policy; as provider → provider policy; same UID, different transaction relationship |
| I14 | Repeated cancel-after-contact pattern | Integrity signal; NOT auto-ban; enters review |
| I15 | Provider `[Keep this on PetWash]` reply | System message allowed; no penalty to provider |
| I16 | Off-platform user cannot leave review | Review submission rejected; explained |

## 17. Deliverables (per CEO §A–§I)

- **A** `docs/architecture/petwash-marketplace-integrity-and-communications-2026.md` — this file
- **B** `MarketplaceMessagePolicyEngine` — pure evaluator, versioned, deterministic-first + classifier hook
- **C** `MarketplaceRelationshipService` — introduction / relationship read model
- **D** `MeetAndGreetService` — CRUD + status transitions + acknowledgement recording
- **E** Masked / in-app call design + `CallSession` metadata store
- **F** Structured chat action system — one component library rendered inside both chat surfaces
- **G** Moderation audit / event model — append-only `MessageModerationAudit` + `MarketplaceIntegritySignal`
- **H** Customer / provider policy UX — friendly copy, acknowledgement moments, [Report] / [Block] / [Keep on PetWash]
- **I** Real E2E matrix — the 16 scenarios above wired as Playwright specs

## 18. Non-goals

- No production activation of non-circumvention penalties without counsel
- No call-audio recording without dedicated privacy / legal analysis
- No second chat storage universe
- No LLM-decided enforcement
- No punitive action from a single ambiguous signal

## 19. Continue directive (§66, §100)

Doctrine is the map — not the finish line. After this document, execute:

1. Audit repo for §18.4 bug shapes (business doctrine)
2. Build `MarketplaceMessagePolicyEngine` skeleton (pure, unit-tested)
3. Build `MarketplaceRelationshipService` + `MeetAndGreetService` scaffolds
4. Build behavioral E2Es around I1..I16
5. Wire `Keep on PetWash` UX in the existing chat surfaces
6. Do not stop.
