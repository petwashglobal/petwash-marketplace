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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Heart className="w-16 h-16 text-pink-500 animate-pulse mx-auto mb-4" />
          <p className="text-lg text-gray-600 dark:text-gray-300">Loading subscription options...</p>
        </div>
      </div>
    );
  }

  const boxTypes = boxTypesData?.boxTypes || [];

  if (showForm && selectedTier) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => setShowForm(false)}
            className="mb-6"
            data-testid="button-back-to-tiers"
          >
            ← Back to Tiers
          </Button>

          <Card className="backdrop-blur-sm bg-white/90 dark:bg-gray-800/90 shadow-2xl">
            <CardHeader>
              <CardTitle className="text-3xl">Complete Your Subscription</CardTitle>
              <CardDescription className="text-lg">
                Tell us about your pet to get personalized product recommendations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6 p-4 bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 rounded-lg">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Selected Plan</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{selectedTier.name}</p>
                <p className="text-lg text-gray-600 dark:text-gray-400">₪{selectedTier.monthlyPrice}/month</p>
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
                            <Input placeholder="123 Main Street, Apt 4" {...field} data-testid="input-address" />
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
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Pet Subscription Boxes
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Curated monthly boxes filled with premium treats, toys, and supplies for your furry friend
          </p>
          <Badge className="mt-4 bg-gradient-to-r from-pink-500 to-rose-500 text-white" data-testid="badge-ai-powered">
            <Sparkles className="w-4 h-4 mr-1" />
            AI-Powered Product Selection
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {boxTypes.map((tier) => {
            const Icon = getTierIcon(tier.name);
            const colorClass = getTierColor(tier.name);
            const isPopular = tier.name.toLowerCase().includes("premium");

            return (
              <Card 
                key={tier.id} 
                className={`relative backdrop-blur-sm bg-white/90 dark:bg-gray-800/90 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 ${
                  isPopular ? "border-2 border-purple-500" : ""
                }`}
                data-testid={`card-tier-${tier.name.toLowerCase()}`}
              >
                {isPopular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-1">
                      Most Popular
                    </Badge>
                  </div>
                )}

                <CardHeader className="text-center">
                  <div className={`mx-auto mb-4 ${colorClass}`}>
                    <Icon className="w-16 h-16" />
                  </div>
                  <CardTitle className="text-3xl">{tier.name}</CardTitle>
                  <CardDescription className="text-base">{tier.description}</CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold text-gray-900 dark:text-white">₪{tier.monthlyPrice}</span>
                    <span className="text-gray-600 dark:text-gray-400">/month</span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
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
                    className={`w-full ${
                      isPopular
                        ? "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                        : "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                    }`}
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

        <div className="mt-16 text-center">
          <h2 className="text-3xl font-bold mb-6">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
            {[
              { step: 1, title: "Choose Your Tier", desc: "Select the perfect box for your pet" },
              { step: 2, title: "Tell Us About Your Pet", desc: "Share your pet's preferences and allergies" },
              { step: 3, title: "AI Curates Your Box", desc: "Our AI selects products tailored to your pet" },
              { step: 4, title: "Delivered Monthly", desc: "Fresh surprises at your doorstep" },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-3">
                  {item.step}
                </div>
                <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
