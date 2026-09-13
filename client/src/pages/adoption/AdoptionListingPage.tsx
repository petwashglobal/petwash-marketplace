/**
 * /adoption/:id — one pet's adoption profile and the enquiry form.
 * The lister's phone is never shown here; it is shared only with an applicant
 * the lister accepts (see /adoption/my).
 */
import { sanitizeUrl } from '@/lib/utils';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/lib/languageStore';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { AuthGateCard } from '@/components/AuthGateCard';
import { PetWashIcon } from '@/components/PetWashIcon';
import { useSEO, pageSEO } from '@/lib/seo';
import {
  AdoptionShell, PrimaryButton, StatusChip, HAIRLINE, PAPER, GOLD,
  ageLabel, sexLabel, petLabel, yesNoLabel, listerLabel,
  adoptionApi, errorText, fieldCls, fieldStyle, labelCls, type AdoptionListing,
} from './adoptionUi';

interface Media { id: number; file_path: string; media_role: string }

function Fact({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
      <span className="text-xs text-black/50">{label}</span>
      <span className="text-sm text-black">{value}</span>
    </div>
  );
}

function EnquiryForm({ listing, isHe }: { listing: AdoptionListing; isHe: boolean }) {
  const { toast } = useToast();
  const [messageText, setMessageText] = useState('');
  const [applicantPhone, setApplicantPhone] = useState('');
  const [homeType, setHomeType] = useState('unspecified');
  const [hasChildren, setHasChildren] = useState('unknown');
  const [hasOtherPets, setHasOtherPets] = useState('unknown');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (messageText.trim().length < 20) {
      toast({ variant: 'destructive', title: isHe ? 'ספרו לנו עוד קצת' : 'Tell us a little more', description: isHe ? 'לפחות 20 תווים.' : 'At least 20 characters.' });
      return;
    }
    setSending(true);
    try {
      await adoptionApi(`/api/adoption/listings/${listing.id}/enquiries`, {
        json: { messageText: messageText.trim(), applicantPhone: applicantPhone.trim() || undefined, homeType, hasChildren, hasOtherPets },
      });
      setSent(true);
    } catch (err) {
      toast({ variant: 'destructive', title: isHe ? 'הפנייה לא נשלחה' : 'Enquiry not sent', description: errorText(isHe, err) });
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-2xl p-6" style={{ border: `1px solid ${HAIRLINE}`, textAlign: 'center' }} data-testid="adoption-enquiry-sent">
        <div className="font-serif text-lg">{isHe ? 'הפנייה נשלחה' : 'Enquiry sent'}</div>
        <p className="mt-2 text-sm text-black/60">
          {isHe ? 'המפרסם/ת יקבל/ו את הפנייה. אם תתקבל — תקבלו התראה ופרטי קשר לתיאום היכרות.' : 'The lister will receive it. If accepted, you will be notified with contact details to arrange a meeting.'}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" data-testid="adoption-enquiry-form">
      <div>
        <label className={labelCls}>{isHe ? `למה ${listing.pet_name || 'החיה'} מתאים/ה לבית שלכם?` : `Why is ${listing.pet_name || 'this pet'} right for your home?`}</label>
        <textarea rows={4} value={messageText} onChange={(e) => setMessageText(e.target.value)} className={fieldCls} style={fieldStyle} data-testid="input-enquiry-message" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className={labelCls}>{isHe ? 'סוג בית' : 'Home'}</label>
          <select value={homeType} onChange={(e) => setHomeType(e.target.value)} className={fieldCls} style={fieldStyle}>
            <option value="unspecified">{isHe ? 'לא צוין' : 'Not specified'}</option>
            <option value="apartment">{isHe ? 'דירה' : 'Apartment'}</option>
            <option value="house">{isHe ? 'בית' : 'House'}</option>
            <option value="house_with_yard">{isHe ? 'בית עם חצר' : 'House with yard'}</option>
            <option value="other">{isHe ? 'אחר' : 'Other'}</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>{isHe ? 'ילדים בבית' : 'Children at home'}</label>
          <select value={hasChildren} onChange={(e) => setHasChildren(e.target.value)} className={fieldCls} style={fieldStyle}>
            <option value="unknown">{isHe ? 'לא צוין' : 'Not specified'}</option>
            <option value="yes">{isHe ? 'כן' : 'Yes'}</option>
            <option value="no">{isHe ? 'לא' : 'No'}</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>{isHe ? 'חיות נוספות' : 'Other pets'}</label>
          <select value={hasOtherPets} onChange={(e) => setHasOtherPets(e.target.value)} className={fieldCls} style={fieldStyle}>
            <option value="unknown">{isHe ? 'לא צוין' : 'Not specified'}</option>
            <option value="yes">{isHe ? 'כן' : 'Yes'}</option>
            <option value="no">{isHe ? 'לא' : 'No'}</option>
          </select>
        </div>
      </div>
      <div>
        <label className={labelCls}>{isHe ? 'טלפון (רשות — יוצג רק למפרסם/ת)' : 'Phone (optional — shown to the lister only)'}</label>
        <input type="tel" inputMode="tel" dir="ltr" value={applicantPhone} onChange={(e) => setApplicantPhone(e.target.value)} className={fieldCls} style={fieldStyle} />
      </div>
      <PrimaryButton type="submit" disabled={sending} testId="button-send-enquiry">
        {sending ? (isHe ? 'שולח…' : 'Sending…') : (isHe ? 'שליחת פנייה לאימוץ' : 'Send adoption enquiry')}
      </PrimaryButton>
    </form>
  );
}

export default function AdoptionListingPage({ listingId }: { listingId: number }) {
  useSEO(pageSEO.adoption);
  const { language } = useLanguage();
  const isHe = language === 'he';
  const { user } = useFirebaseAuth();
  const [activePhoto, setActivePhoto] = useState(0);

  const { data, isLoading, isError } = useQuery<{ listing: AdoptionListing; media: Media[] }>({
    queryKey: ['/api/adoption/listings', listingId],
    enabled: Number.isInteger(listingId) && listingId > 0,
    retry: false,
    queryFn: async () => {
      const r = await fetch(`/api/adoption/listings/${listingId}`, { credentials: 'include' });
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    },
  });

  const back = { href: '/adoption', label: isHe ? '→ לכל החיות לאימוץ' : '← All pets for adoption' };

  if (isLoading) {
    return <AdoptionShell isHe={isHe} title={isHe ? 'טוען…' : 'Loading…'} back={back}><div /></AdoptionShell>;
  }
  if (isError || !data?.listing) {
    return (
      <AdoptionShell isHe={isHe} title={isHe ? 'המודעה לא נמצאה' : 'Listing not found'} subtitle={isHe ? 'ייתכן שהמודעה הוסרה או עדיין בבדיקה.' : 'It may have been removed or is still in review.'} back={back}>
        <div />
      </AdoptionShell>
    );
  }

  const l = data.listing;
  const photos = data.media.length ? data.media : [];
  const current = photos[Math.min(activePhoto, Math.max(photos.length - 1, 0))];
  const subtitle = [l.breed || petLabel(isHe, l.pet_type), ageLabel(isHe, l.age_group), sexLabel(isHe, l.sex), l.area ? `${l.city} · ${l.area}` : l.city]
    .filter(Boolean).join(' · ');
  const open = l.status === 'available' || l.status === 'pending';

  return (
    <AdoptionShell isHe={isHe} title={l.pet_name || (isHe ? 'חיה לאימוץ' : 'For adoption')} subtitle={subtitle} back={back}>
      <article data-testid={`adoption-listing-${l.id}`}>
        <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${HAIRLINE}` }}>
          <div className="aspect-[4/3] flex items-center justify-center overflow-hidden" style={{ background: PAPER }}>
            {current
              ? <img src={sanitizeUrl(current.file_path)} alt={l.pet_name || ''} className="w-full h-full object-cover" />
              : <PetWashIcon name="brand_paw" size={48} label={l.pet_name || 'Pet'} />}
          </div>
          {photos.length > 1 && (
            <div className="flex gap-2 p-3 overflow-x-auto">
              {photos.map((m, i) => (
                <button key={m.id} type="button" onClick={() => setActivePhoto(i)} className="h-14 w-14 shrink-0 overflow-hidden rounded-lg"
                  style={{ border: `1px solid ${i === activePhoto ? GOLD : HAIRLINE}` }} aria-label={`${i + 1}`}>
                  <img src={sanitizeUrl(m.file_path)} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <StatusChip isHe={isHe} status={l.status} />
          <span className="text-xs text-black/50">{listerLabel(isHe, l.lister_type)}</span>
        </div>

        <section className="mt-8">
          <h2 className="font-serif text-xl">{isHe ? 'להכיר' : 'About'}</h2>
          <p className="mt-3 text-sm leading-relaxed text-black/75 whitespace-pre-line">{l.description}</p>
          {l.temperament && <p className="mt-3 text-sm leading-relaxed text-black/75 whitespace-pre-line">{l.temperament}</p>}
        </section>

        <section className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-x-10">
          <div>
            <h3 className="font-serif text-lg mb-1">{isHe ? 'בריאות' : 'Health'}</h3>
            <Fact label={isHe ? 'חיסונים' : 'Vaccinated'} value={yesNoLabel(isHe, l.vaccinated)} />
            <Fact label={isHe ? 'עיקור / סירוס' : 'Spayed / neutered'} value={yesNoLabel(isHe, l.neutered)} />
            <Fact label={isHe ? 'שבב' : 'Microchipped'} value={yesNoLabel(isHe, l.microchipped)} />
            {l.health_notes && <p className="mt-3 text-xs leading-relaxed text-black/60 whitespace-pre-line">{l.health_notes}</p>}
          </div>
          <div className="mt-6 sm:mt-0">
            <h3 className="font-serif text-lg mb-1">{isHe ? 'מתאים/ה ל…' : 'Good with'}</h3>
            <Fact label={isHe ? 'ילדים' : 'Children'} value={yesNoLabel(isHe, l.good_with_children)} />
            <Fact label={isHe ? 'כלבים' : 'Dogs'} value={yesNoLabel(isHe, l.good_with_dogs)} />
            <Fact label={isHe ? 'חתולים' : 'Cats'} value={yesNoLabel(isHe, l.good_with_cats)} />
            <Fact label={isHe ? 'מתאים לדירה' : 'Apartment friendly'} value={yesNoLabel(isHe, (l as any).apartment_friendly)} />
            <Fact label={isHe ? 'נשירה נמוכה' : 'Low shedding'} value={yesNoLabel(isHe, (l as any).low_shedding)} />
          </div>
        </section>

        {l.special_needs && (
          <section className="mt-8">
            <h3 className="font-serif text-lg">{isHe ? 'צרכים מיוחדים' : 'Special needs'}</h3>
            <p className="mt-2 text-sm leading-relaxed text-black/75 whitespace-pre-line">{l.special_needs}</p>
          </section>
        )}

        <div className="mx-auto my-10 h-px w-12" style={{ backgroundColor: GOLD }} />

        <section id="enquire">
          <h2 className="font-serif text-xl mb-4">{isHe ? 'רוצים לאמץ?' : 'Would you like to adopt?'}</h2>
          {!open ? (
            <p className="text-sm text-black/60">{isHe ? 'החיה הזו כבר מצאה בית. תודה שבאתם.' : 'This pet has found a home. Thank you for visiting.'}</p>
          ) : !user ? (
            <AuthGateCard
              language={language}
              redirectTo={`/adoption/${l.id}`}
              message={isHe ? 'התחברו או הצטרפו ל-PetWash כדי לשלוח פנייה לאימוץ — תחזרו לכאן מיד.' : 'Sign in or join PetWash to send an adoption enquiry — you will come right back here.'}
            />
          ) : (
            <EnquiryForm listing={l} isHe={isHe} />
          )}
        </section>

        <p className="mt-12 text-[11px] tracking-[1px] text-black/45" style={{ textAlign: 'center' }}>
          {isHe ? 'אימוץ אחראי · ללא מכירה · מבית PetWash™‎' : 'Responsible adoption · Never a sale · By PetWash™‎'}
        </p>
      </article>
    </AdoptionShell>
  );
}
