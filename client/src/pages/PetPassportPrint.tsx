/**
 * PetPassportPrint — print / save-as-PDF cover of the Pet Passport.
 *
 * Route: /pets/:petId/passport/print. Uses the same green-marble tokens as
 * PetPassportHome + PetPassport (memory pet-passport-canonical-spec-2026-07-07):
 *   page bg  #FAFAF7   hero card  #063B22   gold  #D6B56D
 *   ink      #121212   border     #ECE6D8   muted #6B6E6A
 *
 * READ-ONLY. Data comes from GET /api/pets/:petId. Fits ONE A4/Letter page
 * when printed. Uses only base CSS + inline styles — no Tailwind classes
 * that would break under user-agent print stylesheets.
 */
import { useEffect } from 'react';
import { useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '@/lib/languageStore';

const GREEN = '#063B22';
const GOLD = '#D6B56D';
const MARBLE = '#FAFAF7';
const BORDER = '#ECE6D8';
const INK = '#121212';
const MUTED = '#6B6E6A';

interface Pet {
  id: string;
  name: string;
  species?: string;
  breed?: string;
  gender?: 'male' | 'female' | 'unknown';
  birthday?: string;
  weightKg?: number;
  microchip?: string;
  vetName?: string;
  photoUrl?: string;
  vaccineDates?: { rabies?: string; dhpp?: string; lepto?: string };
}

const SPECIES_HE: Record<string, string> = {
  dog: 'כלב', cat: 'חתול', bird: 'ציפור', rabbit: 'ארנב', guinea_pig: 'שרקן',
  hamster: 'אוגר', reptile: 'זוחל', fish: 'דג', other: 'חיה',
};
const SPECIES_EN: Record<string, string> = {
  dog: 'Dog', cat: 'Cat', bird: 'Bird', rabbit: 'Rabbit', guinea_pig: 'Guinea Pig',
  hamster: 'Hamster', reptile: 'Reptile', fish: 'Fish', other: 'Pet',
};

function fmtDate(iso: string | undefined, isHe: boolean): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(isHe ? 'he-IL' : 'en-GB', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function nextDue(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

export default function PetPassportPrint() {
  const { petId } = useParams<{ petId: string }>();
  const { language } = useLanguage();
  const isHe = language === 'he';
  const tr = (en: string, he: string) => (isHe ? he : en);

  const { data: pet, isLoading, isError } = useQuery<Pet>({
    queryKey: [`/api/pets/${petId}`],
    enabled: !!petId,
  });

  // Auto-open the print dialog once the passport is loaded — the caller may
  // deep-link into this route to hand the user a printable/PDF-savable page.
  useEffect(() => {
    if (pet && typeof window !== 'undefined') {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [pet]);

  if (isLoading) {
    return <div style={{ padding: 40, textAlign: 'center', color: MUTED }}>Loading…</div>;
  }
  if (isError || !pet) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: INK }}>
        {tr('Pet not found', 'חיית המחמד לא נמצאה')}
      </div>
    );
  }

  const speciesLabel = (isHe ? SPECIES_HE : SPECIES_EN)[pet.species || 'other'] || (isHe ? 'חיה' : 'Pet');
  const vaccines = Object.entries(pet.vaccineDates ?? {})
    .filter(([, v]) => !!v) as Array<[string, string]>;
  const genderLabel = pet.gender
    ? tr(pet.gender === 'male' ? 'Male' : pet.gender === 'female' ? 'Female' : 'Unknown',
         pet.gender === 'male' ? 'זכר' : pet.gender === 'female' ? 'נקבה' : 'לא ידוע')
    : '—';

  return (
    <>
      {/* Print stylesheet — one A4/Letter page. body already has a CSS reset
          from the app shell, but print mode ignores much of it, so we set
          margins + colour behaviour here explicitly. */}
      <style>{`
        @page { size: A4; margin: 14mm; }
        @media print {
          html, body { background: white !important; }
          .no-print { display: none !important; }
          .pw-print-passport { box-shadow: none !important; }
          /* Force colour rendering — Safari and Chrome respect this to keep
             the green hero + gold ink from being flattened to grey. */
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
        @media (max-width: 640px) {
          .pw-print-page { padding: 16px !important; }
        }
      `}</style>

      <div
        className="pw-print-page"
        dir={isHe ? 'rtl' : 'ltr'}
        style={{
          minHeight: '100vh',
          background: MARBLE,
          padding: 32,
          fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Hebrew", sans-serif',
          color: INK,
        }}
      >
        <div
          className="pw-print-passport"
          style={{
            margin: '0 auto',
            maxWidth: 720,
            background: 'white',
            borderRadius: 22,
            border: `1px solid ${BORDER}`,
            boxShadow: '0 6px 30px rgba(6, 59, 34, 0.06)',
            overflow: 'hidden',
          }}
        >
          {/* Green hero band with gold rule */}
          <div style={{ background: GREEN, padding: '20px 28px', borderBottom: `2px solid ${GOLD}` }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              color: GOLD, fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase',
              fontWeight: 700,
            }}>
              <span>PetWash™ · {tr('Pet Passport', 'דרכון חיה')}</span>
              <span dir="ltr">{pet.id.slice(-8).toUpperCase()}</span>
            </div>
            <div style={{
              display: 'flex', gap: 20, alignItems: 'center', marginTop: 16,
            }}>
              <div style={{
                width: 108, height: 108, borderRadius: '50%',
                boxShadow: `0 0 0 3px ${GOLD}`,
                overflow: 'hidden', background: '#0a4b2c', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {pet.photoUrl
                  ? <img src={pet.photoUrl} alt={pet.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: 44 }}>🐾</span>}
              </div>
              <div style={{ minWidth: 0, textAlign: isHe ? 'right' : 'left' }}>
                <div style={{ color: GOLD, fontSize: 34, fontWeight: 800, lineHeight: 1.1 }}>{pet.name}</div>
                <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: 15, marginTop: 4 }}>
                  {speciesLabel}{pet.breed ? ` · ${pet.breed}` : ''}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 2 }} dir={isHe ? 'rtl' : 'ltr'}>
                  {tr('Born', 'תאריך לידה')}: {fmtDate(pet.birthday, isHe)}
                </div>
              </div>
            </div>
          </div>

          {/* Details grid */}
          <div style={{ padding: '24px 28px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <PrintField label={tr('Gender', 'מין')} value={genderLabel} />
            <PrintField label={tr('Weight', 'משקל')} value={pet.weightKg ? `${pet.weightKg} kg` : '—'} />
            <PrintField label={tr('Microchip', 'שבב')} value={pet.microchip || '—'} mono />
            <PrintField label={tr('Vet', 'וטרינר')} value={pet.vetName || '—'} />
          </div>

          {/* Vaccinations table */}
          {vaccines.length > 0 && (
            <div style={{ padding: '0 28px 24px' }}>
              <div style={{
                color: GREEN, fontWeight: 800, fontSize: 11, letterSpacing: '0.18em',
                textTransform: 'uppercase', marginBottom: 10,
              }}>
                {tr('Vaccinations', 'חיסונים')}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ color: MUTED, textAlign: isHe ? 'right' : 'left' }}>
                    <th style={{ padding: '8px 10px', borderBottom: `1px solid ${BORDER}` }}>{tr('Vaccine', 'חיסון')}</th>
                    <th style={{ padding: '8px 10px', borderBottom: `1px solid ${BORDER}` }}>{tr('Given', 'ניתן')}</th>
                    <th style={{ padding: '8px 10px', borderBottom: `1px solid ${BORDER}` }}>{tr('Next due', 'חידוש')}</th>
                  </tr>
                </thead>
                <tbody>
                  {vaccines.map(([k, v]) => (
                    <tr key={k}>
                      <td style={{ padding: '8px 10px', borderBottom: `1px solid ${BORDER}`, color: INK, fontWeight: 600 }}>
                        {k === 'rabies' ? tr('Rabies', 'כלבת') : k === 'dhpp' ? tr('DHPP', 'משושה DHPP') : tr('Lepto', 'לפטו')}
                      </td>
                      <td style={{ padding: '8px 10px', borderBottom: `1px solid ${BORDER}`, color: INK }}>
                        {fmtDate(v, isHe)}
                      </td>
                      <td style={{ padding: '8px 10px', borderBottom: `1px solid ${BORDER}`, color: GREEN, fontWeight: 700 }}>
                        {fmtDate(nextDue(v), isHe)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer strip */}
          <div style={{
            padding: '12px 28px', borderTop: `1px solid ${BORDER}`, background: MARBLE,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            color: MUTED, fontSize: 11,
          }}>
            <span dir="ltr" style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>{pet.id}</span>
            <span>PetWash.co.il</span>
          </div>
        </div>

        <div className="no-print" style={{ textAlign: 'center', marginTop: 20 }}>
          <button
            onClick={() => window.print()}
            style={{
              background: GREEN, color: GOLD, fontWeight: 700,
              padding: '10px 20px', borderRadius: 999, border: 'none', cursor: 'pointer',
            }}
          >
            {tr('Print / Save as PDF', 'הדפסה / שמירה כ־PDF')}
          </button>
        </div>
      </div>
    </>
  );
}

function PrintField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ border: `1px solid ${BORDER}`, borderRadius: 12, padding: '10px 12px', background: MARBLE }}>
      <div style={{ color: MUTED, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600 }}>
        {label}
      </div>
      <div
        style={{
          color: INK, fontSize: 14, fontWeight: 600, marginTop: 3,
          fontFamily: mono ? 'ui-monospace, SFMono-Regular, monospace' : undefined,
          wordBreak: 'break-word',
        }}
        dir="auto"
      >
        {value}
      </div>
    </div>
  );
}
