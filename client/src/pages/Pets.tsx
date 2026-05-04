import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { getApiUrl } from "@/lib/apiConfig";
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
  X,
  ChevronDown,
  ChevronUp,
  Stethoscope,
  Pill,
  ExternalLink,
  Download,
  Clock,
  Cake,
} from 'lucide-react';
import { format, differenceInDays, setYear, parseISO } from 'date-fns';
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

// ============================================================
// PetHealthPanel — inline health tracker per pet
// ============================================================
const HEALTH_EVENT_TYPES = [
  { value: 'vaccination', labelHe: 'חיסון', labelEn: 'Vaccination', icon: '💉' },
  { value: 'vet_visit',   labelHe: 'ביקור וטרינר', labelEn: 'Vet Visit', icon: '🏥' },
  { value: 'medication',  labelHe: 'תרופה / טיפול', labelEn: 'Medication', icon: '💊' },
  { value: 'deworming',   labelHe: 'טיפול תולעים', labelEn: 'Deworming', icon: '🐛' },
  { value: 'grooming',    labelHe: 'טיפוח', labelEn: 'Grooming', icon: '✂️' },
  { value: 'reminder',    labelHe: 'תזכורת כללית', labelEn: 'Reminder', icon: '📅' },
];

interface HealthEvent {
  id: string; type: string; title: string; date: string;
  notes?: string; nextDate?: string; calendarLink?: string; icsUrl?: string;
}

function PetHealthPanel({ petId, petName, petBirthdate, language, authToken, userId }: {
  petId: string; petName: string; petBirthdate?: string; language: string; authToken: string | null; userId?: string;
}) {
  const { toast } = useToast();
  const qc = queryClient;
  const isHe = language === 'he';
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ type: 'vaccination', title: '', date: '', notes: '' });

  const { data, isLoading } = useQuery<{ events: HealthEvent[] }>({
    queryKey: [`/api/pets/${petId}/health-events`],
    enabled: !!authToken,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/pets/${petId}/health-events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
        credentials: 'include',
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: isHe ? '✅ האירוע נשמר!' : '✅ Event saved!' });
      setForm({ type: 'vaccination', title: '', date: '', notes: '' });
      setAdding(false);
      qc.invalidateQueries({ queryKey: [`/api/pets/${petId}/health-events`] });
    },
    onError: (e: any) => toast({ variant: 'destructive', title: e.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const res = await fetch(`/api/pets/${petId}/health-events/${eventId}`, {
        method: 'DELETE',
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to delete');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [`/api/pets/${petId}/health-events`] }),
  });

  // Birthday countdown
  const birthdayCountdown = (() => {
    if (!petBirthdate) return null;
    try {
      const today = new Date(); today.setHours(0,0,0,0);
      const dob = parseISO(petBirthdate);
      let next = setYear(dob, today.getFullYear());
      if (next < today) next = setYear(dob, today.getFullYear() + 1);
      const days = differenceInDays(next, today);
      return days;
    } catch { return null; }
  })();

  const events = data?.events || [];

  return (
    <div className="border-t border-slate-100 pt-3 mt-1">
      {/* Birthday countdown */}
      {petBirthdate && birthdayCountdown !== null && birthdayCountdown <= 30 && (
        <div className="mx-4 mb-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 p-3 flex items-center gap-2">
          <Cake className="w-5 h-5 text-amber-500 shrink-0" />
          <div className="text-sm">
            <span className="font-semibold text-amber-800">
              {birthdayCountdown === 0
                ? (isHe ? `🎂 יום הולדת שמח, ${petName}!` : `🎂 Happy Birthday, ${petName}!`)
                : isHe ? `יום הולדת בעוד ${birthdayCountdown} ימים 🎉`
                        : `Birthday in ${birthdayCountdown} days 🎉`}
            </span>
            {birthdayCountdown <= 7 && (
              <span className="block text-xs text-amber-600 mt-0.5">
                {isHe ? 'תקבל SMS עם קוד הנחה מיוחד 10% 🎁' : 'You\'ll get an SMS with a special 10% discount code 🎁'}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Events list */}
      <div className="px-4 pb-1">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            {isHe ? 'יומן בריאות' : 'Health Journal'}
          </span>
          <button
            onClick={() => setAdding(v => !v)}
            className="text-xs flex items-center gap-1 text-violet-600 hover:text-violet-700 font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            {isHe ? 'הוסף' : 'Add'}
          </button>
        </div>

        {/* Add form */}
        {adding && (
          <div className="bg-violet-50 border border-violet-100 rounded-xl p-3 mb-3 space-y-2">
            <select
              value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              className="w-full text-sm rounded-lg border border-slate-200 p-1.5 bg-white"
            >
              {HEALTH_EVENT_TYPES.map(t => (
                <option key={t.value} value={t.value}>
                  {t.icon} {isHe ? t.labelHe : t.labelEn}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder={isHe ? 'כותרת (למשל: חיסון כלבת)' : 'Title (e.g. Rabies shot)'}
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full text-sm rounded-lg border border-slate-200 p-1.5"
            />
            <input
              type="date"
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              className="w-full text-sm rounded-lg border border-slate-200 p-1.5"
            />
            <textarea
              placeholder={isHe ? 'הערות (רופא, מינון, תכשיר...)' : 'Notes (vet, dose, product...)'}
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full text-sm rounded-lg border border-slate-200 p-1.5 resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => addMutation.mutate()}
                disabled={!form.title || !form.date || addMutation.isPending}
                className="flex-1 text-sm py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-medium disabled:opacity-50"
              >
                {addMutation.isPending ? '...' : (isHe ? 'שמור' : 'Save')}
              </button>
              <button
                onClick={() => setAdding(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-600"
              >
                {isHe ? 'ביטול' : 'Cancel'}
              </button>
            </div>
          </div>
        )}

        {/* Events list */}
        {isLoading ? (
          <div className="text-center py-2 text-xs text-slate-400">{isHe ? 'טוען...' : 'Loading...'}</div>
        ) : events.length === 0 ? (
          <div className="text-center py-3 text-xs text-slate-400">
            {isHe ? 'אין אירועי בריאות. לחץ + הוסף להתחיל.' : 'No health events. Press + Add to start.'}
          </div>
        ) : (
          <div className="space-y-2">
            {events.slice(0, 5).map((ev) => {
              const typeInfo = HEALTH_EVENT_TYPES.find(t => t.value === ev.type);
              const icon = typeInfo?.icon || '📅';
              const calUrl = ev.calendarLink ||
                `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`${icon} ${petName} — ${ev.title}`)}&dates=${ev.date.replace(/-/g,'')}/${ev.date.replace(/-/g,'')}`;
              const icsUrl = `/api/pets/${petId}/health-events/${ev.id}/ics?uid=${userId || ''}`;
              return (
                <div key={ev.id} className="flex items-start gap-2 text-sm group">
                  <span className="mt-0.5 shrink-0">{icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-800 truncate">{ev.title}</div>
                    <div className="text-xs text-slate-500">
                      {ev.date ? format(parseISO(ev.date), 'd/M/yyyy') : ''}
                      {ev.notes && <span className="mx-1">·</span>}
                      {ev.notes && <span className="truncate">{ev.notes}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <a
                      href={calUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={isHe ? 'Google Calendar' : 'Google Calendar'}
                      className="p-1 rounded hover:bg-white text-slate-500 hover:text-violet-600"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <a
                      href={icsUrl}
                      download={`${petName}-health.ics`}
                      title={isHe ? 'הורד לאייפון (.ics)' : 'Download for iPhone (.ics)'}
                      className="p-1 rounded hover:bg-white text-slate-500 hover:text-blue-600"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                    <button
                      onClick={() => deleteMutation.mutate(ev.id)}
                      className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Pets() {
  const { t, language, dir } = useLanguage();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPet, setEditingPet] = useState<Pet | null>(null);
  const [deletingPet, setDeletingPet] = useState<Pet | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [expandedHealthPet, setExpandedHealthPet] = useState<string | null>(null);

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
    mode: 'onChange',
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
      const response = await fetch(getApiUrl('/api/pets'), {
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
        title: t('pets.addedSuccess'),
        description: t('pets.addedDescription'),
      });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: t('pets.error'),
        description: error.message || t('pets.errorAddingPet'),
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
        title: t('pets.updatedSuccess'),
        description: t('pets.updatedDescription'),
      });
      setIsDialogOpen(false);
      setEditingPet(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: t('pets.error'),
        description: error.message || t('pets.errorUpdatingPet'),
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
        title: t('pets.deletedSuccess'),
        description: t('pets.deletedDescription'),
      });
      setDeletingPet(null);
    },
    onError: (error: any) => {
      toast({
        title: t('pets.error'),
        description: error.message || t('pets.errorDeletingPet'),
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
        return t('pets.invalidDate');
      }
      
      const years = today.getFullYear() - birth.getFullYear();
      const months = today.getMonth() - birth.getMonth();
      
      if (years > 0) {
        return t('pets.yearsOld').replace('{years}', years.toString());
      }
      return t('pets.monthsOld').replace('{months}', Math.max(1, months).toString());
    } catch (error) {
      return t('pets.error');
    }
  };

  return (
    <div className="min-h-screen luxury-bg-mesh p-4 md:p-6" dir={dir}>
      <div className="max-w-7xl mx-auto luxury-animate-fade-in">
        {/* Hero Section */}
        <div className="text-center mb-8 luxury-animate-slide-up">
          <h1 className="luxury-heading-xl mb-4">
            {t('pets.title')}
          </h1>
          <p className="luxury-text-body max-w-2xl mx-auto mb-6">
            {language === 'he' 
              ? 'נהל את כל פרטי חיות המחמד שלך במקום אחד. מעקב אחר חיסונים, בריאות ותזכורות טיפול.'
              : 'Manage all your pet details in one place. Track vaccinations, health, and care reminders.'}
          </p>
          <Button 
            onClick={handleAddPet}
            data-testid="button-add-pet"
            className="luxury-btn-primary"
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('pets.addPet')}
          </Button>
        </div>

        <div className="luxury-glass-card luxury-shadow-xl mb-6">
          <CardContent className="p-6">
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : pets.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                <PawPrint className="h-16 w-16 mb-4 opacity-20" />
                <p className="text-lg font-medium mb-2">
                  {t('pets.noPets')}
                </p>
                <p className="text-sm text-gray-400">
                  {t('pets.addFirstPet')}
                </p>
              </div>
            ) : (
              <div className="luxury-grid-3 luxury-gap-lg">
                {pets.map((pet, index) => (
                  <div key={pet.id} className={`luxury-glass-card luxury-hover-lift luxury-delay-${Math.min(index + 1, 10)}`} data-testid={`card-pet-${pet.id}`}>
                    <CardHeader className="bg-gradient-to-r from-purple-50/50 to-blue-50/50 dark:from-purple-900/10 dark:to-blue-900/10 pb-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-14 w-14 rounded-full bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/50 dark:to-blue-900/50 flex items-center justify-center shadow-lg">
                            <PawPrint className="h-7 w-7 text-purple-600 dark:text-purple-400" />
                          </div>
                          <div>
                            <h3 className="luxury-heading-sm luxury-text-gradient">{pet.name}</h3>
                            <p className="luxury-text-small">
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
                        <span className="text-gray-700 dark:text-black">
                          {t('pets.age')} {getAge(pet.birthdate)}
                        </span>
                      </div>
                      {pet.weight && (
                        <div className="flex items-center gap-2 text-sm">
                          <Heart className="h-4 w-4 text-gray-500" />
                          <span className="text-gray-700 dark:text-black">
                            {t('pets.weightLabel')} {pet.weight} kg
                          </span>
                        </div>
                      )}
                      {pet.nextVaccineDate && (
                        <div className="flex items-center gap-2 text-sm">
                          <Syringe className="h-4 w-4 text-gray-500" />
                          <span className="text-gray-700 dark:text-black">
                            {t('pets.nextVaccineLabel')}
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
                          <span className="text-gray-700 dark:text-black">
                            {t('pets.allergiesLabel')} {pet.allergies}
                          </span>
                        </div>
                      )}
                    </CardContent>

                    {/* Health Journal toggle */}
                    <button
                      onClick={() => setExpandedHealthPet(expandedHealthPet === pet.id ? null : pet.id)}
                      className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-violet-600 hover:bg-violet-50 transition-colors border-t border-slate-100 rounded-b-xl"
                    >
                      <span className="flex items-center gap-1.5">
                        <Stethoscope className="w-3.5 h-3.5" />
                        {language === 'he' ? 'יומן בריאות 🏥' : 'Health Journal 🏥'}
                      </span>
                      {expandedHealthPet === pet.id
                        ? <ChevronUp className="w-3.5 h-3.5" />
                        : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                    {expandedHealthPet === pet.id && (
                      <PetHealthPanel
                        petId={pet.id}
                        petName={pet.name}
                        petBirthdate={pet.birthdate}
                        language={language}
                        authToken={authToken}
                        userId={auth.currentUser?.uid}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir={dir}>
          <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 z-50">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogClose>
          <DialogHeader>
            <DialogTitle>
              {editingPet ? t('pets.editProfile') : t('pets.addNewPet')}
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
                    <FormLabel>{t('pets.name')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('pets.namePlaceholder')} {...field} data-testid="input-pet-name" />
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
                      <FormLabel>{t('pets.species')}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-species">
                            <SelectValue placeholder={t('pets.selectSpecies')} />
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
                      <FormLabel>{t('pets.breed')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('pets.breedPlaceholder')} {...field} data-testid="input-breed" />
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
                      <FormLabel>{t('pets.birthdate')}</FormLabel>
                      <FormControl>
                        <DatePicker
                          value={field.value}
                          onChange={field.onChange}
                          placeholder={t('pets.birthdate')}
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
                      <FormLabel>{t('pets.weight')}</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.1"
                          min="0.1"
                          max="500"
                          placeholder={t('pets.weightPlaceholder')} 
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
                    <FormLabel>{t('pets.allergies')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('pets.allergiesPlaceholder')} {...field} data-testid="input-allergies" />
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
                    <FormLabel>{t('pets.medicalNotes')}</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder={t('pets.medicalNotesPlaceholder')} 
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
                      <FormLabel>{t('pets.lastVaccine')}</FormLabel>
                      <FormControl>
                        <DatePicker
                          value={field.value || ''}
                          onChange={field.onChange}
                          placeholder={t('pets.lastVaccine')}
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
                      <FormLabel>{t('pets.nextVaccine')}</FormLabel>
                      <FormControl>
                        <DatePicker
                          value={field.value || ''}
                          onChange={field.onChange}
                          placeholder={t('pets.nextVaccine')}
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
                  {t('pets.cancel')}
                </Button>
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-save-pet"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {(createMutation.isPending || updateMutation.isPending) 
                    ? t('pets.saving') 
                    : t('pets.save')
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
            <DialogTitle>{t('pets.deleteTitle')}</DialogTitle>
            <DialogDescription>
              {t('pets.deleteConfirm').replace('{name}', deletingPet?.name || '')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingPet(null)}>
              {t('pets.cancel')}
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => deletingPet && deleteMutation.mutate(deletingPet.id)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending 
                ? t('pets.deleting') 
                : t('pets.delete')
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
