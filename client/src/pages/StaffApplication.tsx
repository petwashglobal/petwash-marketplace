/**
 * Public Staff Application Portal
 * 
 * Allows candidates to apply for positions:
 * - Pet Sitters
 * - Dog Walkers
 * - Pet Transport Drivers
 * - Pet Trainers
 * - Station Hosts
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, Loader2, Briefcase, DogIcon, Car, GraduationCap, Home } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

const applicationSchema = z.object({
  applicationType: z.enum(['sitter', 'walker', 'driver', 'trainer', 'host']),
  firstName: z.string().min(2, 'First name is required'),
  lastName: z.string().min(2, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(10, 'Phone number is required'),
  dateOfBirth: z.string(),
  address: z.string().min(5, 'Address is required'),
  city: z.string().min(2, 'City is required'),
  state: z.string().optional(),
  country: z.string().min(2, 'Country is required'),
  postalCode: z.string().optional(),
  referralSource: z.string().optional(),
  notes: z.string().optional(),
});

type ApplicationFormData = z.infer<typeof applicationSchema>;

const positionTypes = [
  {
    value: 'sitter',
    label: 'Pet Sitter',
    icon: Briefcase,
    description: 'Provide in-home pet sitting services',
  },
  {
    value: 'walker',
    label: 'Dog Walker',
    icon: DogIcon,
    description: 'GPS-tracked dog walking services',
  },
  {
    value: 'driver',
    label: 'Pet Transport Driver',
    icon: Car,
    description: 'Safe pet transportation services',
  },
  {
    value: 'trainer',
    label: 'Pet Trainer',
    icon: GraduationCap,
    description: 'Professional pet training services',
  },
  {
    value: 'host',
    label: 'Station Host',
    icon: Home,
    description: 'Operate a Pet Wash™ station',
  },
];

export default function StaffApplication() {
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [applicationId, setApplicationId] = useState<number | null>(null);

  const form = useForm<ApplicationFormData>({
    resolver: zodResolver(applicationSchema),
    defaultValues: {
      applicationType: 'sitter',
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      dateOfBirth: '',
      address: '',
      city: '',
      state: '',
      country: 'Israel',
      postalCode: '',
      referralSource: '',
      notes: '',
    },
  });

  const submitApplication = useMutation({
    mutationFn: async (data: ApplicationFormData) => {
      return apiRequest('/api/staff/applications', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: (response: any) => {
      setSubmitted(true);
      setApplicationId(response.application.id);
      toast({
        title: 'Application Submitted! 🎉',
        description: 'We\'ll review your application and contact you soon.',
      });
    },
    onError: () => {
      toast({
        title: 'Submission Failed',
        description: 'Please check your information and try again.',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: ApplicationFormData) => {
    submitApplication.mutate(data);
  };

  if (submitted) {
    return (
      <div className="container mx-auto py-16 max-w-2xl" data-testid="success-screen">
        <Card className="border-green-500 bg-green-50 dark:bg-green-950">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle className="h-16 w-16 text-green-500" />
            </div>
            <CardTitle className="text-2xl" data-testid="success-title">
              Application Submitted Successfully!
            </CardTitle>
            <CardDescription className="text-base" data-testid="success-message">
              Thank you for applying to join Pet Wash™!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-white dark:bg-gray-900 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">Your Application ID:</p>
              <p className="text-2xl font-mono font-bold" data-testid="application-id">
                #{applicationId}
              </p>
            </div>

            <div className="space-y-2 text-sm">
              <h4 className="font-semibold">What's Next?</h4>
              <ul className="space-y-2 list-disc list-inside text-muted-foreground">
                <li>Our team will review your application within 2-3 business days</li>
                <li>You'll receive an email with next steps including:
                  <ul className="ml-6 mt-1 space-y-1">
                    <li>• Document upload instructions (ID, insurance, certifications)</li>
                    <li>• E-signature legal documents</li>
                    <li>• Biometric verification (ID + selfie)</li>
                    <li>• Background check authorization (if applicable)</li>
                  </ul>
                </li>
                <li>Check your spam folder for emails from Pet Wash™</li>
              </ul>
            </div>

            <Button
              onClick={() => window.location.href = '/'}
              className="w-full"
              data-testid="back-home-button"
            >
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-4xl" data-testid="application-form">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold mb-2" data-testid="page-title">
          Join Pet Wash™ Team
        </h1>
        <p className="text-muted-foreground text-lg" data-testid="page-subtitle">
          Apply to become a contractor for premium pet care services
        </p>
      </div>

      {/* Position Selection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {positionTypes.map((position) => {
          const Icon = position.icon;
          const isSelected = form.watch('applicationType') === position.value;
          
          return (
            <Card
              key={position.value}
              className={`cursor-pointer transition-all ${
                isSelected ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
              }`}
              onClick={() => form.setValue('applicationType', position.value as any)}
              data-testid={`position-card-${position.value}`}
            >
              <CardHeader className="text-center">
                <Icon className={`h-12 w-12 mx-auto mb-2 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                <CardTitle className="text-lg">{position.label}</CardTitle>
                <CardDescription className="text-sm">{position.description}</CardDescription>
              </CardHeader>
            </Card>
          );
        })}
      </div>

      {/* Application Form */}
      <Card>
        <CardHeader>
          <CardTitle>Application Form</CardTitle>
          <CardDescription>
            All fields are required unless marked as optional. We review all applications carefully.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" data-testid="staff-application-form">
              {/* Position Type (Hidden - Selected Above) */}
              <input type="hidden" {...form.register('applicationType')} />

              {/* Personal Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Personal Information</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="John" {...field} data-testid="input-first-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Doe" {...field} data-testid="input-last-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address *</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="john@example.com" {...field} data-testid="input-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number *</FormLabel>
                        <FormControl>
                          <Input placeholder="+972-XX-XXX-XXXX" {...field} data-testid="input-phone" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="dateOfBirth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of Birth *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-dob" />
                      </FormControl>
                      <FormDescription>You must be 18+ to apply</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Address Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Address</h3>
                
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Street Address *</FormLabel>
                      <FormControl>
                        <Input placeholder="123 Main St, Apt 4B" {...field} data-testid="input-address" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="city"
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
                    name="state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State/Province</FormLabel>
                        <FormControl>
                          <Input placeholder="Optional" {...field} data-testid="input-state" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="postalCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Postal Code</FormLabel>
                        <FormControl>
                          <Input placeholder="12345" {...field} data-testid="input-postal" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Country *</FormLabel>
                      <FormControl>
                        <Input placeholder="Israel" {...field} data-testid="input-country" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Additional Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Additional Information</h3>
                
                <FormField
                  control={form.control}
                  name="referralSource"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>How did you hear about us?</FormLabel>
                      <FormControl>
                        <Input placeholder="Friend, Google, Social Media, etc." {...field} data-testid="input-referral" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Why do you want to join Pet Wash™?</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Tell us about your experience with pets, why you're interested in this position, and what makes you a great fit..."
                          className="min-h-[120px]"
                          {...field}
                          data-testid="input-notes"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={submitApplication.isPending}
                data-testid="submit-application-button"
              >
                {submitApplication.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting Application...
                  </>
                ) : (
                  'Submit Application'
                )}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                By submitting this application, you agree to undergo background checks,
                biometric verification, and e-signature of legal documents as part of the onboarding process.
              </p>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
