/**
 * /adoption/new — list a pet that needs a permanent new family.
 * Not a lost/found notice: no last-seen place, no date, no reward.
 * Every listing is reviewed by support before it is public.
 */
import { useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/lib/languageStore';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { AuthGateCard } from '@/components/AuthGateCard';
import { useSEO, pageSEO } from '@/lib/seo';
import {
  AdoptionShell, PrimaryButton, QuietLink, HAIRLINE, PAPER,
  adoptionApi, errorText, fieldCls, fieldStyle, labelCls,
} from './adoptionUi';

type Photo = { filePath: string; hash?: string; preview: string };

const EMPTY = {
  listerType: 'private', petType: 'dog', petName: '', breed: '', sex: 'unknown', ageGroup: 'unknown',
  sizeCategory: 'unknown', color: '', description: '', temperament: '', healthNotes: '', specialNeeds: '',
  vaccinated: 'unknown', neutered: 'unknown', microchipped: 'unknown',
  goodWithChildren: 'unknown', goodWithDogs: 'unknown', goodWithCats: 'unknown',
  city: '', area: '', contactPhone: '',
};
type Form = typeof EMPTY;

/* Defined outside the page so typing never remounts the fields inside them. */
function Select({ k, label, options, value, onChange }: {
  k: string; label: string; options: [string, string][]; value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <select value={value} onChange={onChange} className={fieldCls} style={fieldStyle} data-testid={`select-${k}`}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="pt-6" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
      <h2 className="font-serif text-lg mb-4">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export default function AdoptionCreate() {
  useSEO(pageSEO.adoption);
  const { language } = useLanguage();
  const isHe = language === 'he';
  const { user, loading } = useFirebaseAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [form, setForm] = useState<Form>(EMPTY);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const shell = (children: React.ReactNode) => (
    <AdoptionShell
      isHe={isHe}
      title={isHe ? 'פרסום חיה לאימוץ' : 'List a pet for adoption'}
      subtitle={isHe ? 'לחיות שצריכות בית קבוע ומשפחה חדשה. לחיה שאבדה או נמצאה — PawFinder™‎.' : 'For pets who need a permanent new family. For a lost or found pet — use PawFinder™‎.'}
      back={{ href: '/adoption', label: isHe ? '→ חזרה לאימוץ' : '← Back to adoption' }}
    >
      {children}
    </AdoptionShell>
  );

  if (loading) return shell(<div />);
  if (!user) {
    return shell(
      <AuthGateCard
        language={language}
        redirectTo="/adoption/new"
        message={isHe ? 'פרסום לאימוץ פתוח לחברי PetWash ללא עלות. התחברו או הצטרפו — תחזרו לכאן מיד.' : 'Listing is free for PetWash members. Sign in or join — you will come right back here.'}
      />,
    );
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 15 * 1024 * 1024) {
      toast({ variant: 'destructive', title: isHe ? 'תמונה לא תקינה' : 'Invalid photo', description: isHe ? 'JPEG / PNG / WebP / HEIC עד 15MB.' : 'JPEG / PNG / WebP / HEIC up to 15MB.' });
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('photo', file);
      const j = await adoptionApi<{ filePath: string; hash?: string; identification?: any }>('/api/adoption/upload', { form: fd });
      setPhotos((p) => [...p, { filePath: j.filePath, hash: j.hash, preview: URL.createObjectURL(file) }]);
      const ident = j.identification;
      if (photos.length === 0 && ident && !ident.degraded && (ident.confidence ?? 0) >= 0.35) {
        setForm((f) => ({
          ...f,
          petType: f.petType === EMPTY.petType && ['dog', 'cat', 'bird', 'other'].includes(ident.species) ? ident.species : f.petType,
          breed: f.breed || String(ident.breedGuess || '').slice(0, 100),
          color: f.color || String(ident.primaryColor || '').slice(0, 60),
        }));
      }
    } catch (err) {
      toast({ variant: 'destructive', title: isHe ? 'ההעלאה נכשלה' : 'Upload failed', description: errorText(isHe, err) });
    } finally {
      setUploading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const missing =
      !photos.length ? (isHe ? 'יש להוסיף לפחות תמונה אחת.' : 'Add at least one photo.') :
      !form.petName.trim() ? (isHe ? 'מה שם החיה?' : 'What is the pet’s name?') :
      form.description.trim().length < 20 ? (isHe ? 'ספרו על החיה — לפחות 20 תווים.' : 'Describe the pet — at least 20 characters.') :
      !form.city.trim() ? (isHe ? 'באיזו עיר?' : 'Which city?') :
      !form.contactPhone.trim() ? (isHe ? 'טלפון לתיאום היכרות (לא יפורסם).' : 'A phone to arrange meetings (never published).') : '';
    if (missing) {
      toast({ variant: 'destructive', title: isHe ? 'חסרים פרטים' : 'Missing details', description: missing });
      return;
    }
    setSubmitting(true);
    try {
      const opt = (v: string) => (v.trim() ? v.trim() : undefined);
      const result = await adoptionApi<{ status: string }>('/api/adoption/listings', {
        json: {
          ...form,
          petName: form.petName.trim(), description: form.description.trim(), city: form.city.trim(), contactPhone: form.contactPhone.trim(),
          breed: opt(form.breed), color: opt(form.color), temperament: opt(form.temperament), healthNotes: opt(form.healthNotes),
          specialNeeds: opt(form.specialNeeds), area: opt(form.area),
          mediaFiles: photos.map((p, i) => ({ filePath: p.filePath, mediaRole: i === 0 ? 'primary' : 'extra', ...(p.hash ? { hash: p.hash } : {}) })),
        },
      });
      toast({
        title: isHe ? 'המודעה נשלחה לבדיקה' : 'Sent for review',
        description: isHe ? 'נעדכן אתכם ברגע שהמודעה תאושר ותעלה לעמוד האימוץ.' : 'We will let you know as soon as it is approved and live.',
      });
      if (result.status !== 'rejected') navigate('/adoption/my');
    } catch (err: any) {
      if (err?.status === 422) {
        toast({ variant: 'destructive', title: isHe ? 'המודעה לא עברה את בדיקת הבטיחות' : 'Listing did not pass the safety check', description: isHe ? 'אין לפרסם מכירה, מחיר או תוכן לא הולם.' : 'No sales, prices or inappropriate content.' });
      } else {
        toast({ variant: 'destructive', title: isHe ? 'הפרסום נכשל' : 'Could not publish', description: errorText(isHe, err) });
      }
    } finally {
      setSubmitting(false);
    }
  }

  const yesNo: [string, string][] = [['unknown', isHe ? 'לא ידוע' : 'Unknown'], ['yes', isHe ? 'כן' : 'Yes'], ['no', isHe ? 'לא' : 'No']];
  const sel = (k: keyof Form) => ({ k, value: form[k], onChange: set(k) });

  return shell(
    <form onSubmit={submit} className="space-y-8" data-testid="adoption-create-form">
      <section>
        <h2 className="font-serif text-lg mb-4">{isHe ? 'תמונות' : 'Photos'}</h2>
        <div className="grid grid-cols-3 gap-3">
          {photos.map((p, i) => (
            <div key={p.filePath} className="relative aspect-square overflow-hidden rounded-xl" style={{ border: `1px solid ${HAIRLINE}` }}>
              <img src={p.preview} alt="" className="h-full w-full object-cover" />
              <button type="button" onClick={() => setPhotos((all) => all.filter((_, j) => j !== i))}
                className="absolute top-1.5 end-1.5 rounded-full bg-white/90 px-2 text-xs text-black" aria-label={isHe ? 'הסרה' : 'Remove'}>×</button>
            </div>
          ))}
          {photos.length < 6 && (
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
              className="aspect-square rounded-xl text-xs text-black/55" style={{ border: `1px dashed ${HAIRLINE}`, background: PAPER }} data-testid="button-add-photo">
              {uploading ? (isHe ? 'מעלה…' : 'Uploading…') : (isHe ? '+ הוספת תמונה' : '+ Add photo')}
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="hidden" onChange={onFile} />
      </section>

      <Section title={isHe ? 'החיה' : 'The pet'}>
        <div>
          <label className={labelCls}>{isHe ? 'שם' : 'Name'}</label>
          <input value={form.petName} onChange={set('petName')} maxLength={100} className={fieldCls} style={fieldStyle} data-testid="input-petName" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select {...sel('petType')} label={isHe ? 'סוג' : 'Type'} options={[['dog', isHe ? 'כלב' : 'Dog'], ['cat', isHe ? 'חתול' : 'Cat'], ['rabbit', isHe ? 'ארנב' : 'Rabbit'], ['bird', isHe ? 'ציפור' : 'Bird'], ['other', isHe ? 'אחר' : 'Other']]} />
          <div>
            <label className={labelCls}>{isHe ? 'גזע' : 'Breed'}</label>
            <input value={form.breed} onChange={set('breed')} maxLength={100} className={fieldCls} style={fieldStyle} />
          </div>
          <Select {...sel('ageGroup')} label={isHe ? 'גיל' : 'Age'} options={[['unknown', isHe ? 'לא ידוע' : 'Unknown'], ['baby', isHe ? 'גור' : 'Baby'], ['young', isHe ? 'צעיר/ה' : 'Young'], ['adult', isHe ? 'בוגר/ת' : 'Adult'], ['senior', isHe ? 'מבוגר/ת' : 'Senior']]} />
          <Select {...sel('sex')} label={isHe ? 'מין' : 'Sex'} options={[['unknown', isHe ? 'לא ידוע' : 'Unknown'], ['male', isHe ? 'זכר' : 'Male'], ['female', isHe ? 'נקבה' : 'Female']]} />
          <Select {...sel('sizeCategory')} label={isHe ? 'גודל' : 'Size'} options={[['unknown', isHe ? 'לא ידוע' : 'Unknown'], ['tiny', isHe ? 'זעיר' : 'Tiny'], ['small', isHe ? 'קטן' : 'Small'], ['medium', isHe ? 'בינוני' : 'Medium'], ['large', isHe ? 'גדול' : 'Large'], ['giant', isHe ? 'ענק' : 'Giant']]} />
          <div>
            <label className={labelCls}>{isHe ? 'צבע' : 'Colour'}</label>
            <input value={form.color} onChange={set('color')} maxLength={60} className={fieldCls} style={fieldStyle} />
          </div>
        </div>
        <div>
          <label className={labelCls}>{isHe ? 'ספרו עליו/ה — אופי, הרגלים, למה מחפשים בית' : 'About — personality, habits, why a new home is needed'}</label>
          <textarea rows={5} value={form.description} onChange={set('description')} maxLength={2000} className={fieldCls} style={fieldStyle} data-testid="input-description" />
        </div>
        <div>
          <label className={labelCls}>{isHe ? 'מזג (רשות)' : 'Temperament (optional)'}</label>
          <textarea rows={2} value={form.temperament} onChange={set('temperament')} maxLength={1000} className={fieldCls} style={fieldStyle} />
        </div>
      </Section>

      <Section title={isHe ? 'בריאות והתאמה' : 'Health & compatibility'}>
        <div className="grid grid-cols-3 gap-3">
          <Select {...sel('vaccinated')} label={isHe ? 'חיסונים' : 'Vaccinated'} options={yesNo} />
          <Select {...sel('neutered')} label={isHe ? 'עיקור/סירוס' : 'Neutered'} options={yesNo} />
          <Select {...sel('microchipped')} label={isHe ? 'שבב' : 'Microchip'} options={yesNo} />
          <Select {...sel('goodWithChildren')} label={isHe ? 'עם ילדים' : 'Children'} options={yesNo} />
          <Select {...sel('goodWithDogs')} label={isHe ? 'עם כלבים' : 'Dogs'} options={yesNo} />
          <Select {...sel('goodWithCats')} label={isHe ? 'עם חתולים' : 'Cats'} options={yesNo} />
        </div>
        <div>
          <label className={labelCls}>{isHe ? 'הערות בריאות (רשות)' : 'Health notes (optional)'}</label>
          <textarea rows={2} value={form.healthNotes} onChange={set('healthNotes')} maxLength={1000} className={fieldCls} style={fieldStyle} />
        </div>
        <div>
          <label className={labelCls}>{isHe ? 'צרכים מיוחדים (רשות)' : 'Special needs (optional)'}</label>
          <textarea rows={2} value={form.specialNeeds} onChange={set('specialNeeds')} maxLength={1000} className={fieldCls} style={fieldStyle} />
        </div>
      </Section>

      <Section title={isHe ? 'מיקום ויצירת קשר' : 'Location & contact'}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>{isHe ? 'עיר' : 'City'}</label>
            <input value={form.city} onChange={set('city')} maxLength={100} className={fieldCls} style={fieldStyle} data-testid="input-city" />
          </div>
          <div>
            <label className={labelCls}>{isHe ? 'אזור / שכונה (רשות)' : 'Area (optional)'}</label>
            <input value={form.area} onChange={set('area')} maxLength={100} className={fieldCls} style={fieldStyle} />
          </div>
        </div>
        <Select {...sel('listerType')} label={isHe ? 'מי מפרסם/ת' : 'Listed by'} options={[['private', isHe ? 'בעלים פרטיים' : 'Private owner'], ['rescue', isHe ? 'עמותת הצלה' : 'Rescue'], ['shelter', isHe ? 'מקלט' : 'Shelter']]} />
        <div>
          <label className={labelCls}>{isHe ? 'טלפון לתיאום היכרות — לא יפורסם, יוצג רק למי שתאשרו' : 'Phone to arrange meetings — never published, shown only to applicants you accept'}</label>
          <input type="tel" inputMode="tel" dir="ltr" value={form.contactPhone} onChange={set('contactPhone')} className={fieldCls} style={fieldStyle} data-testid="input-contactPhone" />
        </div>
      </Section>

      <p className="text-xs leading-relaxed text-black/55">
        {isHe
          ? 'אימוץ ב-PetWash הוא ללא מכירה וללא מחיר. כל מודעה נבדקת לפני פרסום.'
          : 'Adoption on PetWash is never a sale and carries no price. Every listing is checked before it goes live.'}
      </p>

      <PrimaryButton type="submit" disabled={submitting || uploading} testId="button-submit-adoption">
        {submitting ? (isHe ? 'שולח…' : 'Sending…') : (isHe ? 'שליחה לבדיקה' : 'Send for review')}
      </PrimaryButton>
      <div style={{ textAlign: 'center' }}>
        <QuietLink href="/adoption/my">{isHe ? 'המודעות שלי ←' : 'My listings →'}</QuietLink>
      </div>
    </form>,
  );
}
