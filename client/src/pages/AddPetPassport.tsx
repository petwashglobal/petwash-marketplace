/**
 * AddPetPassport — the "Add a pet" flow for the Pet Passport.
 *
 * Matches the CEO's 2026-07-07 mockup: a species grid (dog / cat / fish / bird /
 * snake / rabbit / guinea pig / other) → a details form with an optional photo.
 * Same green/gold tokens + RTL as PetPassportHome. Wires to the REAL API:
 *   POST /api/pets/photo (multipart) → { photoUrl }
 *   POST /api/pets       → creates the pet
 *
 * Server truth (shared/firestore-schema.ts): species enum has no "snake" — the
 * mockup's snake maps to the API's "reptile". Date field is `birthday` (YYYY-MM-DD).
 */
import { useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useLanguage } from '@/lib/languageStore';
import { ArrowRight, ArrowLeft, Camera, Loader2 } from 'lucide-react';

const GREEN = '#063B22';
const GOLD = '#D6B56D';

// mockup species → API species (the API enum has turtle/reptile but no snake)
const SPECIES: { key: string; api: string; he: string; en: string; emoji: string }[] = [
  { key: 'dog', api: 'dog', he: 'כלב', en: 'Dog', emoji: '🐕' },
  { key: 'cat', api: 'cat', he: 'חתול', en: 'Cat', emoji: '🐈' },
  { key: 'fish', api: 'fish', he: 'דג', en: 'Fish', emoji: '🐠' },
  { key: 'bird', api: 'bird', he: 'ציפור', en: 'Bird', emoji: '🦜' },
  { key: 'snake', api: 'reptile', he: 'נחש', en: 'Snake', emoji: '🐍' },
  { key: 'rabbit', api: 'rabbit', he: 'ארנב', en: 'Rabbit', emoji: '🐇' },
  { key: 'guinea_pig', api: 'guinea_pig', he: 'שרקן', en: 'Guinea Pig', emoji: '🐹' },
  { key: 'other', api: 'other', he: 'אחר', en: 'Other', emoji: '🐾' },
];

export default function AddPetPassport() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { language } = useLanguage();
  const isHe = language === 'he';
  const tr = (he: string, en: string) => (isHe ? he : en);
  const Back = isHe ? ArrowRight : ArrowLeft;

  const [species, setSpecies] = useState<typeof SPECIES[number] | null>(null);
  const [name, setName] = useState('');
  const [breed, setBreed] = useState('');
  const [birthday, setBirthday] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'unknown'>('unknown');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Only ever feed the preview <img> our own object URL (blob:) — captured into a
  // definite local and scheme-guarded so no arbitrary string can reach the src.
  const previewSrc = photoPreview.startsWith('blob:') ? photoPreview : '';

  function pickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { setError(tr('התמונה גדולה מדי (עד 5MB)', 'Photo too large (max 5MB)')); return; }
    setError('');
    setPhotoFile(f);
    setPhotoPreview(URL.createObjectURL(f));
  }

  async function save() {
    if (!name.trim()) { setError(tr('נא להזין שם', 'Please enter a name')); return; }
    if (!species) return;
    setSaving(true);
    setError('');
    try {
      let photoUrl: string | undefined;
      if (photoFile) {
        const fd = new FormData();
        fd.append('photo', photoFile);
        const pr = await apiRequest('POST', '/api/pets/photo', fd);
        if (pr.ok) photoUrl = (await pr.json())?.photoUrl;
      }
      const body: Record<string, unknown> = {
        name: name.trim(),
        species: species.api,
        gender,
        ...(breed.trim() ? { breed: breed.trim() } : {}),
        ...(birthday ? { birthday } : {}),
        ...(photoUrl ? { photoUrl } : {}),
      };
      const r = await apiRequest('POST', '/api/pets', body);
      if (!r.ok) {
        setError(tr('שמירה נכשלה, נסו שוב', 'Save failed, please try again'));
        setSaving(false);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['/api/pets'] });
      navigate('/pet-passport');
    } catch {
      setError(tr('שמירה נכשלה, נסו שוב', 'Save failed, please try again'));
      setSaving(false);
    }
  }

  return (
    <div dir={isHe ? 'rtl' : 'ltr'} className="min-h-screen w-full bg-[#FAFAF7]">
      <div className="mx-auto w-full max-w-[440px] px-5 pb-16 pt-5">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => (species ? setSpecies(null) : navigate('/pet-passport'))}
            className="h-9 w-9 rounded-full flex items-center justify-center bg-white border border-[#ECE6D8]"
            aria-label={tr('חזרה', 'Back')}
          >
            <Back className="h-5 w-5" style={{ color: GREEN }} />
          </button>
          <div className="text-[22px] font-extrabold" style={{ color: '#121212' }}>
            {tr('הוסף חיית מחמד', 'Add a pet')}
          </div>
        </div>

        {/* Step 1 — species grid */}
        {!species && (
          <>
            <p className="mt-4 text-[15px] text-[#555]">
              {tr('איזו חיה תרצו להוסיף?', 'What kind of pet are you adding?')}
            </p>
            <div className="mt-4 grid grid-cols-4 gap-3">
              {SPECIES.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setSpecies(s)}
                  className="flex flex-col items-center gap-1.5 rounded-2xl border border-[#ECE6D8] bg-white py-4 transition-transform active:scale-[0.97]"
                >
                  <span className="text-3xl leading-none">{s.emoji}</span>
                  <span className="text-[12px] font-bold leading-tight" style={{ color: GREEN }}>{isHe ? s.he : s.en}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Step 2 — details */}
        {species && (
          <>
            {/* Photo */}
            <div className="mt-6 flex flex-col items-center">
              <button
                onClick={() => fileRef.current?.click()}
                className="relative h-28 w-28 rounded-full overflow-hidden flex items-center justify-center bg-[#EEF3EC] border-2"
                style={{ borderColor: GOLD }}
              >
                {previewSrc ? (
                  // previewSrc is a definite local guarded to the blob: scheme (our own
                  // object URL) — the img src can never receive an arbitrary string.
                  <img src={previewSrc} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-5xl">{species.emoji}</span>
                )}
                <span className="absolute bottom-0 inset-x-0 flex items-center justify-center gap-1 bg-black/45 py-1 text-[11px] font-semibold text-white">
                  <Camera className="h-3.5 w-3.5" /> {tr('תמונה', 'Photo')}
                </span>
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickPhoto} />
              <div className="mt-1 text-[13px] font-bold" style={{ color: GREEN }}>{isHe ? species.he : species.en}</div>
            </div>

            {/* Fields */}
            <div className="mt-5 space-y-3">
              <Field label={tr('שם', 'Name')} required>
                <input
                  value={name} onChange={(e) => setName(e.target.value)}
                  placeholder={tr('לדוגמה: באדי', 'e.g. Buddy')}
                  className="w-full rounded-xl border border-[#ECE6D8] bg-white px-4 py-3 text-[15px] outline-none focus:border-[#D6B56D]"
                />
              </Field>
              <Field label={tr('גזע', 'Breed')}>
                <input
                  value={breed} onChange={(e) => setBreed(e.target.value)}
                  placeholder={tr('לדוגמה: גולדן רטריבר', 'e.g. Golden Retriever')}
                  className="w-full rounded-xl border border-[#ECE6D8] bg-white px-4 py-3 text-[15px] outline-none focus:border-[#D6B56D]"
                />
              </Field>
              <Field label={tr('תאריך לידה', 'Birthday')}>
                <input
                  type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)}
                  max={new Date().toISOString().slice(0, 10)}
                  className="w-full rounded-xl border border-[#ECE6D8] bg-white px-4 py-3 text-[15px] outline-none focus:border-[#D6B56D]"
                />
              </Field>
              <Field label={tr('מין', 'Gender')}>
                <div className="flex gap-2">
                  {([['male', tr('זכר', 'Male')], ['female', tr('נקבה', 'Female')], ['unknown', tr('לא ידוע', 'Unknown')]] as const).map(([g, lbl]) => (
                    <button
                      key={g} onClick={() => setGender(g)}
                      className="flex-1 rounded-xl border px-2 py-2.5 text-[14px] font-semibold transition-colors"
                      style={gender === g
                        ? { backgroundColor: GREEN, color: 'white', borderColor: GREEN }
                        : { backgroundColor: 'white', color: '#333', borderColor: '#ECE6D8' }}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </Field>
            </div>

            {error && <p className="mt-3 text-[13px] font-semibold text-red-600">{error}</p>}

            <button
              onClick={save} disabled={saving}
              className="mt-6 w-full rounded-2xl py-4 text-[16px] font-bold text-white disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ backgroundColor: GREEN }}
            >
              {saving && <Loader2 className="h-5 w-5 animate-spin" />}
              {tr('שמירה', 'Save pet')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[13px] font-bold" style={{ color: '#121212' }}>
        {label}{required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  );
}
