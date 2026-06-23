# PetWash Israel — Provider Insurance Logic (CEO spec, 2026-06-23)

> Canonical reference for how PetWash handles provider insurance in Israel.
> Machine-readable matrix: `shared/providerInsuranceRequirements.ts`.
> **Nothing here is legal advice. Final policy wording + required/recommended split
> + all customer-facing copy must be confirmed by an Israeli insurance broker AND
> lawyer before launch.**

## Main rule (non-negotiable)

- PetWash Ltd **is not an insurance company**. It does **not** sell insurance and
  does **not** replace provider insurance.
- PetWash may offer support / review / goodwill / a limited, rule-based protection
  process **only after lawyer review**, and it must **never be marketed as insurance**.
- Every provider declares the services they provide → PetWash decides which
  insurance documents are required **before approval**.

## Operating model (CEO clarifications, 2026-06-23)

- **Online, independent-contractor marketplace** — same concept as Wolt Israel /
  Rover / MadPaws.
- Providers are **independent subcontractors (עוסק), NOT employees**. PetWash is
  **not the employer** and does not carry their liability. (So no employer layer for
  PetWash over the providers; employer_liability only applies to a provider who
  themselves employs staff.)
- Providers **set their own rates, but not below a minimum floor** (like the
  Rover/MadPaws minimum-rate model).
- Two layers: **(1)** each provider carries insurance suitable for their service;
  **(2)** PetWash may run a discretionary/rule-based incident-support process —
  limited, terms apply, only for in-platform paid bookings, only if rules followed —
  **explicitly not insurance**.

## Insurance types (Israel)

A. **Public / third-party liability** (ביטוח צד שלישי) — basic minimum for most
   providers. Covers third-party injury / property damage from the provider's activity.
B. **Professional / service liability** (אחריות מקצועית) — grooming, training,
   medication handling, advice. Covers professional mistake / negligence.
C. **Care, custody & control** (כיסוי לבעל חיים בהשגחת הספק) — injury/loss to the
   pet while in the provider's care. Ask broker if it's inside a business/public
   liability policy or a special extension.
D. **Home / premises liability** — provider hosting pets at their own place. Normal
   home insurance may NOT cover business pet hosting — provider must confirm.
E. **Motor / pet-transport** — vehicle insurance + business/pet-transport use
   confirmation + restraint/crate declaration. PetWash does NOT cover automotive
   liability (Rover excludes it too).
F. **Product liability** — mobile grooming, station chemicals, products sold/applied.
   PetWash itself likely needs product liability for the shampoos/oils/treats it supplies.
G. **Employer liability** — only if the provider employs staff. Only an approved
   provider or approved staff member may perform a service.
H. **Property / equipment** — station operators, Smart Hub owners, grooming vans.
I. **Cyber / payment / data** — mostly PetWash Ltd (ID docs, tax, payments, wallet,
   customer/pet data). Check with broker as PetWash grows.

## Per-service requirements

Encoded in `SERVICE_INSURANCE` (`shared/providerInsuranceRequirements.ts`). Summary:

| Service | Required | Recommended/conditional |
|---|---|---|
| Dog walking | public liability | care/custody/control |
| Pet sitting (customer home) | public liability, care/custody/control | professional liability |
| Pet hosting (provider home) | public liability, care/custody/control, premises liability | — |
| Grooming | public liability, professional liability, care/custody/control | product liability (if applying products) |
| Mobile grooming | + product liability, vehicle | property/equipment |
| Pet transport | public liability, care/custody/control, vehicle+transport | — |
| Training | public liability, professional liability | care/custody/control |
| Station operator / Smart Hub | public liability, product liability, property/equipment | employer liability (if staff) |

## PetWash Ltd's own insurance (ask an Israeli broker)

Public liability; professional/tech E&O; product liability (shampoos/oils/treats/
collars); cyber/data; D&O (if raising money/appointing directors); employer liability
(if PetWash has employees); station/operator liability; equipment/property; legal
expenses / claims handling.

## Onboarding presentation

- Show the disclaimer (`INSURANCE_DISCLAIMER`, lawyer-approve first).
- Ask: "Do you currently have business insurance? Yes / No / Not sure."
- Upload: certificate, policy schedule, expiry, covered services, insurer, policy number.
  (Schema already has: `insuranceCertUrl`, `insurancePolicyNumber`, `insuranceProvider`,
  `insuranceExpiresAt`, `insuranceCoverageAmount`, `insuranceLastVerified`.)
- Ask which services the policy covers (checkbox per service).
- Admin review: approve / approve-limited / request-clarification / reject-document /
  ask-provider-to-speak-to-broker.

## Rules

- Never use the forbidden claims (`FORBIDDEN_INSURANCE_CLAIMS`): "fully insured by
  PetWash", "all damages covered", "guaranteed compensation", "we cover everything",
  "no risk".
- Show insurance badges **only when documents are verified**.
- **Block the service when insurance expires.**
- For low-risk services, "insurance pending" allowed **only if lawyer/broker approves**.
- For higher-risk services (home hosting, customer-home sitting, grooming, transport,
  station operation), require insurance **before approval**.
- Put everything in the provider contract; lawyer + broker approve final wording.

## Build sequencing (what's done / next)

- ✅ DONE: schema insurance fields + cert upload (`provider-onboarding.ts`); this
  canonical matrix + disclaimer + forbidden-claims config.
- NEXT [code, low legal risk]: onboarding "which services does your policy cover"
  checkbox → use `requiredInsuranceForServices()` to show the provider exactly what
  they need; admin review actions (approve-limited/clarify/reject); badge-on-verified;
  expiry-block cron (block service when `insuranceExpiresAt` passes).
- BLOCKED ON CEO/legal: final required-vs-recommended split, disclaimer + contract
  wording, the "care/custody/control" policy wording — broker + lawyer.

## Broker questions

The 15 questions in the CEO spec (platform package, per-service provider cover, hosting,
customer-home, walkers, groomers, transport, station operators, product liability,
cyber, pet-injured-in-care, dog-bite-third-party, provider-damages-customer-property,
customer-pet-damages-provider, and whether "care, custody & control" wording exists in
Israel) — carry verbatim to the Israeli broker.
