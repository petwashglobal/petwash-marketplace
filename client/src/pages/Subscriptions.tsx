import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Check, Package, Sparkles, Crown, Heart } from "lucide-react";
import { GooglePlacesAutocomplete, PlaceDetails } from "@/components/ui/google-places-autocomplete";
import { useLocation } from "wouter";

const petProfileSchema = z.object({
  petName: z.string().min(1, "Pet name is required"),
  petType: z.enum(["dog", "cat"]),
  age: z.enum(["puppy", "adult", "senior"]),
  size: z.enum(["small", "medium", "large"]),
  breed: z.string().optional(),
  preferences: z.string().optional(),
  allergies: z.string().optional(),
  deliveryAddress: z.string().min(1, "Delivery address is required"),
  deliveryCity: z.string().min(1, "City is required"),
  deliveryPostalCode: z.string().min(1, "Postal code is required"),
  frequency: z.enum(["monthly", "bimonthly", "quarterly"]).default("monthly"),
});

type PetProfile = z.infer<typeof petProfileSchema>;

interface SubscriptionBoxType {
  id: number;
  name: string;
  nameHe: string;
  description: string;
  descriptionHe: string;
  monthlyPrice: string;
  itemCount: number;
  estimatedValue: string;
  features: string[];
  featuresHe: string[];
  displayOrder: number;
}

export default function Subscriptions() {
  const [, navigate] = useLocation();
  const [selectedTier, setSelectedTier] = useState<SubscriptionBoxType | null>(null);
  const [showForm, setShowForm] = useState(false);
  const { toast } = useToast();

  // Fetch subscription box types
  const { data: boxTypesData, isLoading } = useQuery<{ success: boolean; boxTypes: SubscriptionBoxType[] }>({
    queryKey: ["/api/subscription-box-types"],
  });

  const form = useForm<PetProfile>({
    resolver: zodResolver(petProfileSchema),
    mode: 'onChange',
    defaultValues: {
      petName: "",
      petType: "dog",
      age: "adult",
      size: "medium",
      breed: "",
      preferences: "",
      allergies: "",
      deliveryAddress: "",
      deliveryCity: "",
      deliveryPostalCode: "",
      frequency: "monthly",
    },
  });

  const createSubscriptionMutation = useMutation({
    mutationFn: async (data: PetProfile) => {
      if (!selectedTier) throw new Error("No tier selected");
      
      const response = await apiRequest("POST", "/api/subscriptions", {
        boxTypeId: selectedTier.id,
        frequency: data.frequency,
        petProfile: {
          petName: data.petName,
          petType: data.petType,
          age: data.age,
          size: data.size,
          breed: data.breed,
          preferences: data.preferences,
          allergies: data.allergies,
        },
        deliveryAddress: {
          address: data.deliveryAddress,
          city: data.deliveryCity,
          postalCode: data.deliveryPostalCode,
        },
      });
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions/my"] });
      toast({
        title: "Subscription Created! 🎉",
        description: "Your pet subscription box is on its way!",
      });
      navigate("/dashboard");
    },
    onError: (error: any) => {
      toast({
        title: "Subscription Failed",
        description: error.message || "Failed to create subscription",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: PetProfile) => {
    createSubscriptionMutation.mutate(data);
  };

  const handleSelectTier = (tier: SubscriptionBoxType) => {
    setSelectedTier(tier);
    setShowForm(true);
  };

  const getTierIcon = (tierName: string) => {
    if (tierName.toLowerCase().includes("deluxe")) return Crown;
    if (tierName.toLowerCase().includes("premium")) return Sparkles;
    return Package;
  };

  const getTierColor = (tierName: string) => {
    if (tierName.toLowerCase().includes("deluxe")) return "text-yellow-500";
    if (tierName.toLowerCase().includes("premium")) return "text-purple-500";
    return "text-blue-500";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen luxury-bg-mesh flex items-center justify-center">
        <div className="text-center luxury-animate-fade-in">
          <Heart className="w-16 h-16 text-pink-500 animate-pulse mx-auto mb-4" />
          <p className="text-lg luxury-text-body">Loading subscription options...</p>
        </div>
      </div>
    );
  }

  const boxTypes = boxTypesData?.boxTypes || [];

  if (showForm && selectedTier) {
    return (
      <div className="min-h-screen luxury-bg-mesh py-12 px-4">
        <div className="max-w-2xl mx-auto luxury-animate-fade-in">
          <Button
            variant="ghost"
            onClick={() => setShowForm(false)}
            className="mb-6 luxury-btn-ghost"
            data-testid="button-back-to-tiers"
          >
            ← Back to Tiers
          </Button>

          <Card className="luxury-glass-card luxury-shadow-xl">
            <CardHeader>
              <CardTitle className="luxury-heading-md">Complete Your Subscription</CardTitle>
              <CardDescription className="luxury-text-body">
                Tell us about your pet to get personalized product recommendations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6 p-4 luxury-glass-panel">
                <p className="text-sm font-medium luxury-text-small">Selected Plan</p>
                <p className="luxury-heading-sm">{selectedTier.name}</p>
                <p className="text-lg luxury-text-gradient font-bold">₪{selectedTier.monthlyPrice}/month</p>
              </div>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="petName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pet's Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Max" {...field} data-testid="input-pet-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="petType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Pet Type *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-pet-type">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="dog">Dog</SelectItem>
                              <SelectItem value="cat">Cat</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="age"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Age Group *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-age">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="puppy">Puppy/Kitten</SelectItem>
                              <SelectItem value="adult">Adult</SelectItem>
                              <SelectItem value="senior">Senior</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="size"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Size *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-size">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="small">Small</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="large">Large</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="breed"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Breed (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="Golden Retriever" {...field} data-testid="input-breed" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="preferences"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Food Preferences (Optional)</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="e.g., grain-free, organic, chicken-flavored" 
                            {...field} 
                            data-testid="textarea-preferences"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="allergies"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Allergies (Optional)</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="e.g., dairy, wheat, beef" 
                            {...field} 
                            data-testid="textarea-allergies"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Delivery Information</h3>

                    <FormField
                      control={form.control}
                      name="deliveryAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Street Address *</FormLabel>
                          <FormControl>
                            <GooglePlacesAutocomplete
                              value={field.value}
                              onChange={(value, details) => {
                                field.onChange(value);
                                if (details?.city) {
                                  form.setValue('deliveryCity', details.city);
                                }
                                if (details?.postalCode) {
                                  form.setValue('deliveryPostalCode', details.postalCode);
                                }
                              }}
                              onPlaceSelected={(place: PlaceDetails) => {
                                field.onChange(place.formattedAddress);
                                if (place.city) form.setValue('deliveryCity', place.city);
                                if (place.postalCode) form.setValue('deliveryPostalCode', place.postalCode);
                              }}
                              placeholder="Start typing your address..."
                              country={['il', 'us', 'gb', 'au', 'ca']}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="deliveryCity"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>City *</FormLabel>
                            <FormControl>
                              <Input placeholder="Tel Aviv" {...field} data-testid="input-city" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="deliveryPostalCode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Postal Code *</FormLabel>
                            <FormControl>
                              <Input placeholder="12345" {...field} data-testid="input-postal-code" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="frequency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Delivery Frequency *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-frequency">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="monthly">Monthly</SelectItem>
                              <SelectItem value="bimonthly">Every 2 Months</SelectItem>
                              <SelectItem value="quarterly">Quarterly</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full luxury-btn-primary luxury-shadow-xl"
                    disabled={createSubscriptionMutation.isPending}
                    data-testid="button-create-subscription"
                  >
                    {createSubscriptionMutation.isPending ? "Creating..." : "Create Subscription"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen luxury-bg-mesh py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12 luxury-animate-fade-in">
          <h1 className="luxury-heading-xl mb-4">
            Pet Subscription Boxes
          </h1>
          <p className="luxury-text-body max-w-2xl mx-auto">
            Curated monthly boxes filled with premium treats, toys, and supplies for your furry friend
          </p>
          <Badge className="mt-4 luxury-badge-gold luxury-shadow-md" data-testid="badge-ai-powered">
            <Sparkles className="w-4 h-4 mr-1" />
            AI-Powered Product Selection
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {boxTypes.map((tier, index) => {
            const Icon = getTierIcon(tier.name);
            const colorClass = getTierColor(tier.name);
            const isPopular = tier.name.toLowerCase().includes("premium");

            return (
              <Card 
                key={tier.id} 
                className={`relative luxury-glass-card luxury-hover-glow luxury-shadow-xl luxury-animate-fade-in luxury-delay-${index + 1} ${
                  isPopular ? "border-2 border-purple-500" : ""
                }`}
                data-testid={`card-tier-${tier.name.toLowerCase()}`}
              >
                {isPopular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <Badge className="luxury-badge-gold px-4 py-1">
                      Most Popular
                    </Badge>
                  </div>
                )}

                <CardHeader className="text-center">
                  <div className={`mx-auto mb-4 ${colorClass}`}>
                    <Icon className="w-16 h-16" />
                  </div>
                  <CardTitle className="luxury-heading-md">{tier.name}</CardTitle>
                  <CardDescription className="luxury-text-body">{tier.description}</CardDescription>
                  <div className="mt-4">
                    <span className="luxury-heading-lg luxury-text-gradient">₪{tier.monthlyPrice}</span>
                    <span className="luxury-text-small">/month</span>
                  </div>
                  <p className="luxury-text-small mt-2">
                    Value: ₪{tier.estimatedValue}
                  </p>
                </CardHeader>

                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Check className="w-5 h-5 text-green-500" />
                      <span className="text-gray-700 dark:text-gray-300">{tier.itemCount} curated items</span>
                    </div>
                    {tier.features.map((feature, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Check className="w-5 h-5 text-green-500" />
                        <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>

                <CardFooter>
                  <Button
                    onClick={() => handleSelectTier(tier)}
                    className="w-full luxury-btn-primary luxury-shadow-xl"
                    size="lg"
                    data-testid={`button-select-${tier.name.toLowerCase()}`}
                  >
                    Select {tier.name}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        <div className="mt-16 text-center luxury-animate-fade-in luxury-delay-4">
          <h2 className="luxury-heading-lg mb-6">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
            {[
              { step: 1, title: "Choose Your Tier", desc: "Select the perfect box for your pet" },
              { step: 2, title: "Tell Us About Your Pet", desc: "Share your pet's preferences and allergies" },
              { step: 3, title: "AI Curates Your Box", desc: "Our AI selects products tailored to your pet" },
              { step: 4, title: "Delivered Monthly", desc: "Fresh surprises at your doorstep" },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-16 h-16 luxury-btn-primary text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-3 luxury-shadow-md">
                  {item.step}
                </div>
                <h3 className="luxury-heading-sm mb-2">{item.title}</h3>
                <p className="luxury-text-small">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
