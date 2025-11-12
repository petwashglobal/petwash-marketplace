import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { auth } from '@/lib/firebase';
import { useLanguage } from '@/lib/languageStore';
import { trackPetAdded, trackPetUpdated, trackPetDeleted } from '@/lib/analytics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  PawPrint, 
  Plus, 
  Edit, 
  Trash2, 
  Calendar,
  Syringe,
  Heart,
  AlertCircle,
  X
} from 'lucide-react';
import { format } from 'date-fns';
import { he, enUS } from 'date-fns/locale';

const petFormSchema = z.object({
  name: z.string().min(1, 'Pet name is required'),
  species: z.enum(['dog', 'cat', 'other']),
  breed: z.string().optional(),
  birthdate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format')
    .refine((date) => {
      const birthDate = new Date(date);
      const today = new Date();
      const minDate = new Date();
      minDate.setFullYear(minDate.getFullYear() - 50);
      return birthDate <= today && birthDate >= minDate;
    }, 'Birthdate must be within the last 50 years and not in the future'),
  weight: z.number().min(0.1, 'Weight must be positive').max(500, 'Weight seems unrealistic').optional(),
  allergies: z.string().optional(),
  medicalNotes: z.string().optional(),
  lastVaccineDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format').optional().or(z.literal('')),
  nextVaccineDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format').optional().or(z.literal('')),
  enableVaccineReminders: z.boolean().default(false),
});

type PetFormData = z.infer<typeof petFormSchema>;

interface Pet {
  id: string;
  name: string;
  species: 'dog' | 'cat' | 'other';
  breed?: string;
  birthdate: string;
  weight?: number;
  allergies?: string;
  medicalNotes?: string;
  lastVaccineDate?: string;
  nextVaccineDate?: string;
  enableVaccineReminders: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function Pets() {
  const { t, language, dir } = useLanguage();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPet, setEditingPet] = useState<Pet | null>(null);
  const [deletingPet, setDeletingPet] = useState<Pet | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);

  useEffect(() => {
    const getToken = async () => {
      const user = auth.currentUser;
      if (user) {
        const token = await user.getIdToken();
        setAuthToken(token);
      }
    };
    getToken();
  }, []);

  const form = useForm<PetFormData>({
    resolver: zodResolver(petFormSchema),
    defaultValues: {
      name: '',
      species: 'dog',
      breed: '',
      birthdate: '',
      weight: undefined,
      allergies: '',
      medicalNotes: '',
      lastVaccineDate: '',
      nextVaccineDate: '',
      enableVaccineReminders: false,
    },
  });

  const { data: pets = [], isLoading } = useQuery<Pet[]>({
    queryKey: ['/api/pets'],
    enabled: !!authToken,
    queryFn: async () => {
      const response = await fetch('/api/pets', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch pets');
      const data = await response.json();
      return data.pets || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: PetFormData) => {
      if (!authToken) throw new Error('Not authenticated');
      return apiRequest('/api/pets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
    },
    onSuccess: (response: any, variables: PetFormData) => {
      queryClient.invalidateQueries({ queryKey: ['/api/pets'] });
      
      // Track pet added event
      const user = auth.currentUser;
      if (user && response?.pet) {
        trackPetAdded(user.uid, response.pet.id, variables.species, variables.name);
      }
      
      toast({
        title: t('pets.addedSuccess', language),
        description: t('pets.addedDescription', language),
      });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: t('pets.error', language),
        description: error.message || t('pets.errorAddingPet', language),
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: PetFormData }) => {
      if (!authToken) throw new Error('Not authenticated');
      return apiRequest(`/api/pets/${id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
    },
    onSuccess: (_response: any, variables: { id: string; data: PetFormData }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/pets'] });
      
      // Track pet updated event
      const user = auth.currentUser;
      if (user) {
        trackPetUpdated(user.uid, variables.id);
      }
      
      toast({
        title: t('pets.updatedSuccess', language),
        description: t('pets.updatedDescription', language),
      });
      setIsDialogOpen(false);
      setEditingPet(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: t('pets.error', language),
        description: error.message || t('pets.errorUpdatingPet', language),
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!authToken) throw new Error('Not authenticated');
      return apiRequest(`/api/pets/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
    },
    onSuccess: (_response: any, petId: string) => {
      queryClient.invalidateQueries({ queryKey: ['/api/pets'] });
      
      // Track pet deleted event
      const user = auth.currentUser;
      if (user) {
        trackPetDeleted(user.uid, petId);
      }
      
      toast({
        title: t('pets.deletedSuccess', language),
        description: t('pets.deletedDescription', language),
      });
      setDeletingPet(null);
    },
    onError: (error: any) => {
      toast({
        title: t('pets.error', language),
        description: error.message || t('pets.errorDeletingPet', language),
        variant: 'destructive',
      });
    },
  });

  const handleAddPet = () => {
    setEditingPet(null);
    form.reset({
      name: '',
      species: 'dog',
      breed: '',
      birthdate: '',
      weight: undefined,
      allergies: '',
      medicalNotes: '',
      lastVaccineDate: '',
      nextVaccineDate: '',
      enableVaccineReminders: false,
    });
    setIsDialogOpen(true);
  };

  const handleEditPet = (pet: Pet) => {
    setEditingPet(pet);
    form.reset({
      name: pet.name,
      species: pet.species,
      breed: pet.breed || '',
      birthdate: pet.birthdate,
      weight: pet.weight,
      allergies: pet.allergies || '',
      medicalNotes: pet.medicalNotes || '',
      lastVaccineDate: pet.lastVaccineDate || '',
      nextVaccineDate: pet.nextVaccineDate || '',
      enableVaccineReminders: pet.enableVaccineReminders,
    });
    setIsDialogOpen(true);
  };

  const onSubmit = (data: PetFormData) => {
    if (editingPet) {
      updateMutation.mutate({ id: editingPet.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const getSpeciesLabel = (species: string) => {
    const labels = {
      he: { dog: 'כלב', cat: 'חתול', other: 'אחר' },
      en: { dog: 'Dog', cat: 'Cat', other: 'Other' },
    };
    return labels[language as 'he' | 'en'][species as keyof typeof labels.he];
  };

  const getAge = (birthdate: string) => {
    try {
      const birth = new Date(birthdate);
      const today = new Date();
      
      // Validate that birthdate is a valid date and not in the future
      if (isNaN(birth.getTime()) || birth > today) {
        return t('pets.invalidDate', language);
      }
      
      const years = today.getFullYear() - birth.getFullYear();
      const months = today.getMonth() - birth.getMonth();
      
      if (years > 0) {
        return t('pets.yearsOld', language).replace('{years}', years.toString());
      }
      return t('pets.monthsOld', language).replace('{months}', Math.max(1, months).toString());
    } catch (error) {
      return t('pets.error', language);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4 md:p-6" dir={dir}>
      <div className="max-w-7xl mx-auto">
        <Card className="backdrop-blur-sm bg-white/80 dark:bg-gray-800/80 shadow-xl border-0 mb-6">
          <CardHeader className="border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <PawPrint className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                <CardTitle className="text-2xl">
                  {t('pets.title', language)}
                </CardTitle>
              </div>
              <Button 
                onClick={handleAddPet}
                data-testid="button-add-pet"
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                {t('pets.addPet', language)}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : pets.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                <PawPrint className="h-16 w-16 mb-4 opacity-20" />
                <p className="text-lg font-medium mb-2">
                  {t('pets.noPets', language)}
                </p>
                <p className="text-sm text-gray-400">
                  {t('pets.addFirstPet', language)}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {pets.map((pet) => (
                  <Card key={pet.id} className="overflow-hidden hover:shadow-lg transition-shadow" data-testid={`card-pet-${pet.id}`}>
                    <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 pb-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center shadow-sm">
                            <PawPrint className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div>
                            <h3 className="font-bold text-lg">{pet.name}</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {getSpeciesLabel(pet.species)}
                              {pet.breed && ` • ${pet.breed}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditPet(pet)}
                            data-testid={`button-edit-${pet.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeletingPet(pet)}
                            data-testid={`button-delete-${pet.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-gray-500" />
                        <span className="text-gray-700 dark:text-gray-300">
                          {t('pets.age', language)} {getAge(pet.birthdate)}
                        </span>
                      </div>
                      {pet.weight && (
                        <div className="flex items-center gap-2 text-sm">
                          <Heart className="h-4 w-4 text-gray-500" />
                          <span className="text-gray-700 dark:text-gray-300">
                            {t('pets.weightLabel', language)} {pet.weight} kg
                          </span>
                        </div>
                      )}
                      {pet.nextVaccineDate && (
                        <div className="flex items-center gap-2 text-sm">
                          <Syringe className="h-4 w-4 text-gray-500" />
                          <span className="text-gray-700 dark:text-gray-300">
                            {t('pets.nextVaccineLabel', language)}
                            {' '}
                            {format(new Date(pet.nextVaccineDate), 'PP', {
                              locale: language === 'he' ? he : enUS,
                            })}
                          </span>
                        </div>
                      )}
                      {pet.allergies && (
                        <div className="flex items-start gap-2 text-sm">
                          <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5" />
                          <span className="text-gray-700 dark:text-gray-300">
                            {t('pets.allergiesLabel', language)} {pet.allergies}
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir={dir}>
          <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 z-50">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogClose>
          <DialogHeader>
            <DialogTitle>
              {editingPet ? t('pets.editProfile', language) : t('pets.addNewPet', language)}
            </DialogTitle>
            <DialogDescription>
              {language === 'he' 
                ? 'מלא את פרטי חיית המחמד שלך. שדות המסומנים בכוכבית (*) הם חובה.'
                : 'Fill in your pet details. Fields marked with (*) are required.'
              }
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('pets.name', language)}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('pets.namePlaceholder', language)} {...field} data-testid="input-pet-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="species"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('pets.species', language)}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-species">
                            <SelectValue placeholder={t('pets.selectSpecies', language)} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="dog">{getSpeciesLabel('dog')}</SelectItem>
                          <SelectItem value="cat">{getSpeciesLabel('cat')}</SelectItem>
                          <SelectItem value="other">{getSpeciesLabel('other')}</SelectItem>
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
                      <FormLabel>{t('pets.breed', language)}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('pets.breedPlaceholder', language)} {...field} data-testid="input-breed" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="birthdate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('pets.birthdate', language)}</FormLabel>
                      <FormControl>
                        <DatePicker
                          value={field.value}
                          onChange={field.onChange}
                          placeholder={t('pets.birthdate', language)}
                          maxDate={new Date()}
                          minDate={new Date(new Date().setFullYear(new Date().getFullYear() - 50))}
                          language={language}
                          testId="input-birthdate"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="weight"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('pets.weight', language)}</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.1"
                          min="0.1"
                          max="500"
                          placeholder={t('pets.weightPlaceholder', language)} 
                          {...field}
                          onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                          value={field.value || ''}
                          data-testid="input-weight"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="allergies"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('pets.allergies', language)}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('pets.allergiesPlaceholder', language)} {...field} data-testid="input-allergies" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="medicalNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('pets.medicalNotes', language)}</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder={t('pets.medicalNotesPlaceholder', language)} 
                        {...field} 
                        data-testid="input-medical-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="lastVaccineDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('pets.lastVaccine', language)}</FormLabel>
                      <FormControl>
                        <DatePicker
                          value={field.value || ''}
                          onChange={field.onChange}
                          placeholder={t('pets.lastVaccine', language)}
                          language={language}
                          testId="input-last-vaccine"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="nextVaccineDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('pets.nextVaccine', language)}</FormLabel>
                      <FormControl>
                        <DatePicker
                          value={field.value || ''}
                          onChange={field.onChange}
                          placeholder={t('pets.nextVaccine', language)}
                          language={language}
                          testId="input-next-vaccine"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  {t('pets.cancel', language)}
                </Button>
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-save-pet"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {(createMutation.isPending || updateMutation.isPending) 
                    ? t('pets.saving', language) 
                    : t('pets.save', language)
                  }
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deletingPet} onOpenChange={() => setDeletingPet(null)}>
        <DialogContent dir={dir}>
          <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogClose>
          <DialogHeader>
            <DialogTitle>{t('pets.deleteTitle', language)}</DialogTitle>
            <DialogDescription>
              {t('pets.deleteConfirm', language).replace('{name}', deletingPet?.name || '')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingPet(null)}>
              {t('pets.cancel', language)}
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => deletingPet && deleteMutation.mutate(deletingPet.id)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending 
                ? t('pets.deleting', language) 
                : t('pets.delete', language)
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
