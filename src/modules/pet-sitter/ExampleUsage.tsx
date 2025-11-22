// Example usage
import PetSitterProfilePage from "./PetSitterProfilePage";

export default function Example() {
  return (
    <PetSitterProfilePage
      sitterName="April K."
      sitterTagline="Caring, energetic and reliable 7-star dog sitter and house guardian"
      locationLabel="Armadale, VIC · Australia"
      ratingAverage={4.98}
      ratingCount={126}
      nightlyPriceFrom="$145"
      dayVisitPriceFrom="$65"
      heroImageUrl="https://images.pexels.com/photos/5731864/pexels-photo-5731864.jpeg"
      galleryImages={[
        "https://images.pexels.com/photos/4587995/pexels-photo-4587995.jpeg",
        "https://images.pexels.com/photos/7210261/pexels-photo-7210261.jpeg",
        "https://images.pexels.com/photos/7210275/pexels-photo-7210275.jpeg",
      ]}
      servicesAtSitterHome={[
        {
          id: "overnight",
          label: "Overnight boutique stay",
          description: "Private home stay with evening walks and full access to living areas.",
          priceFrom: "$145",
        },
        {
          id: "daycare",
          label: "Day care at host home",
          description: "Perfect for work days. Drop off in the morning, pick up in the evening.",
          priceFrom: "$95",
        },
      ]}
      servicesAtOwnerHome={[
        {
          id: "house_sit",
          label: "Full house sitting",
          description: "Host moves into your home to care for all pets and your property.",
          priceFrom: "$165",
        },
        {
          id: "drop_in",
          label: "Premium drop in visit",
          description: "30 to 45 minute visit for feeding, play and property check.",
          priceFrom: "$65",
        },
      ]}
      addOns={[
        {
          id: "plants",
          label: "Plant care and garden check",
          description: "Water indoor plants and outdoor pots as per your instructions.",
        },
        {
          id: "security",
          label: "Extra security rounds",
          description: "Structured security walk through property every evening.",
        },
        {
          id: "laundry",
          label: "Pet linen laundry",
          description: "Wash and refresh pet bedding before you arrive home.",
        },
      ]}
      reviews={[
        {
          id: "1",
          name: "Sarah & Milo",
          date: "October 2025",
          rating: 5,
          text:
            "We felt like we booked a hotel for our dog and our home at the same time. Daily updates, video clips and a spotless house when we returned.",
        },
        {
          id: "2",
          name: "James & Bella",
          date: "September 2025",
          rating: 5,
          text:
            "Best sitter we have ever had. Plants watered, mail collected and a very relaxed dog waiting for us. Felt completely safe the whole trip.",
        },
      ]}
      yearsExperience={10}
      acceptedPetsSummary="Small and medium dogs, indoor cats, calm seniors"
      maxPetsPerBooking={3}
      homeSummary="Calm, minimalist apartment with secure entry, small private courtyard and soft indoor zones for pets to relax."
      highlightBullets={[
        "Only one family hosted at a time so your pets never share with strangers.",
        "Luxury updates: daily photos, videos and clear written summaries in the PetWash app.",
        "Comfortable sleeping setups with memory foam beds and fresh linen for every stay.",
        "Experience with seniors, medication schedules and gentle rehabilitation routines.",
      ]}
      languages={["English", "Hebrew"]}
      responseTimeLabel="Replies within 1 hour on average"
      verifiedBadges={[
        "Government ID verified",
        "Address and phone verified",
        "Background and reference checked",
      ]}
    />
  );
}