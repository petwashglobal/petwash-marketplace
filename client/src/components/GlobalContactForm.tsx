/**
 * Global Contact Form Component
 * 
 * Reusable across all 8 Pet Wash platforms with Google Sheets integration
 * Supports bilingual (Hebrew/English) and automatically logs to Google Sheets
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Loader2, Send, CheckCircle2 } from 'lucide-react';

const contactFormSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  subject: z.string().min(5, 'Subject must be at least 5 characters'),
  message: z.string().min(10, 'Message must be at least 10 characters'),
});

type ContactFormData = z.infer<typeof contactFormSchema>;

interface GlobalContactFormProps {
  platform: 'K9000' | 'SITTER' | 'WALKER' | 'PETTREK' | 'ACADEMY' | 'PLUSH' | 'WASH' | 'CLUB';
  title?: string;
  description?: string;
  onSuccess?: () => void;
}

export default function GlobalContactForm({
  platform,
  title,
  description,
  onSuccess,
}: GlobalContactFormProps) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [isSubmitted, setIsSubmitted] = useState(false);

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      subject: '',
      message: '',
    },
  });

  const onSubmit = async (data: ContactFormData) => {
    try {
      const response = await apiRequest('/api/forms/contact', {
        method: 'POST',
        body: JSON.stringify({ ...data, platform }),
      });

      setIsSubmitted(true);
      
      toast({
        title: i18n.language === 'he' ? 'תודה על פנייתך!' : 'Thank you for contacting us!',
        description: i18n.language === 'he' 
          ? 'ניצור איתך קשר תוך 24 שעות' 
          : 'We\'ll get back to you within 24 hours',
      });

      form.reset();
      if (onSuccess) onSuccess();
    } catch (error) {
      toast({
        title: i18n.language === 'he' ? 'שגיאה' : 'Error',
        description: i18n.language === 'he'
          ? 'אירעה שגיאה. אנא נסה שוב.'
          : 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    }
  };

  if (isSubmitted) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center text-center space-y-4 py-8">
            <CheckCircle2 className="w-16 h-16 text-green-500" />
            <h3 className="text-2xl font-bold">
              {i18n.language === 'he' ? 'תודה!' : 'Thank You!'}
            </h3>
            <p className="text-muted-foreground">
              {i18n.language === 'he'
                ? 'קיבלנו את הפנייה שלך. נחזור אליך בהקדם האפשרי.'
                : 'We received your message. We\'ll get back to you as soon as possible.'}
            </p>
            <Button
              onClick={() => setIsSubmitted(false)}
              variant="outline"
            >
              {i18n.language === 'he' ? 'שלח הודעה נוספת' : 'Send Another Message'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {title || (i18n.language === 'he' ? 'צור קשר' : 'Contact Us')}
        </CardTitle>
        <CardDescription>
          {description || (i18n.language === 'he'
            ? 'נשמח לענות על כל שאלה. מלא את הפרטים ונחזור אליך בהקדם.'
            : 'We\'d love to hear from you. Fill out the form and we\'ll be in touch soon.')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {i18n.language === 'he' ? 'שם מלא' : 'Full Name'} *
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder={i18n.language === 'he' ? 'הזן את שמך' : 'Enter your name'}
                      {...field}
                      data-testid="input-contact-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {i18n.language === 'he' ? 'אימייל' : 'Email'} *
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder={i18n.language === 'he' ? 'your@email.com' : 'your@email.com'}
                      {...field}
                      data-testid="input-contact-email"
                    />
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
                  <FormLabel>
                    {i18n.language === 'he' ? 'טלפון (אופציונלי)' : 'Phone (Optional)'}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="tel"
                      placeholder={i18n.language === 'he' ? '050-1234567' : '050-1234567'}
                      {...field}
                      data-testid="input-contact-phone"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {i18n.language === 'he' ? 'נושא' : 'Subject'} *
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder={i18n.language === 'he' ? 'במה נוכל לעזור?' : 'How can we help?'}
                      {...field}
                      data-testid="input-contact-subject"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {i18n.language === 'he' ? 'הודעה' : 'Message'} *
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={i18n.language === 'he'
                        ? 'ספר לנו עוד על השירות שאתה מחפש...'
                        : 'Tell us more about what you need...'}
                      className="min-h-[150px]"
                      {...field}
                      data-testid="textarea-contact-message"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full"
              disabled={form.formState.isSubmitting}
              data-testid="button-submit-contact"
            >
              {form.formState.isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {i18n.language === 'he' ? 'שולח...' : 'Sending...'}
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  {i18n.language === 'he' ? 'שלח הודעה' : 'Send Message'}
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
