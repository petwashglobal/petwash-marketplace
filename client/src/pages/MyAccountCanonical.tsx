/**
 * MyAccountCanonical — CEO P0-MY-ACCOUNT task #162.
 *
 * A slug-only, doctrine-clean rewrite of the My Account page,
 * mounted at /my-account/canonical so it co-exists with the
 * legacy /my-account until the CEO flips the default.
 *
 * Sections: PERSONAL / CONTACT / ADDRESS / PREFERENCES
 * + link tiles to MY_PETS / PRESTIGE / PROVIDER_SETTINGS / PAYMENTS / DOCUMENTS.
 *
 * Doctrine:
 *   • Per-section Edit → Save/Cancel. Editing one section does not
 *     force the user to fill everything else again.
 *   • Dirty-state prompt (beforeunload) only when material edits
 *     exist — never annoy the user on a clean form.
 *   • No false success — the page re-renders the SERVER snapshot
 *     the PATCH mutation returned, not the local input.
 *   • 501 not_ready state (server effects wire still landing) is
 *     surfaced honestly as a disabled EDIT + status pill.
 *   • Every visible label is a stable slug; the parent app
 *     translates. Page contract is source-anchored testable.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import {
  useMyAccountSnapshot,
  useMyAccountPatch,
  type DirectPatchField,
  type MyAccountSnapshot,
} from '@/hooks/useMyAccountSnapshot';
import { useProfileCompleteness } from '@/hooks/useProfileCompleteness';

type SectionCode = 'PERSONAL' | 'CONTACT' | 'ADDRESS' | 'PREFERENCES';

const PERSONAL_FIELDS: DirectPatchField[] = ['firstName', 'lastName', 'dateOfBirth', 'profileImageUrl'];
const ADDRESS_FIELDS: DirectPatchField[] = ['address', 'city', 'postalCode', 'country'];
const PREFERENCES_FIELDS: DirectPatchField[] = ['language'];

function fieldsForSection(section: SectionCode): DirectPatchField[] {
  switch (section) {
    case 'PERSONAL':    return PERSONAL_FIELDS;
    case 'ADDRESS':     return ADDRESS_FIELDS;
    case 'PREFERENCES': return PREFERENCES_FIELDS;
    case 'CONTACT':     return [];
  }
}

function isDirty(section: SectionCode, snapshot: MyAccountSnapshot | undefined, draft: Partial<Record<DirectPatchField, string | null>>): boolean {
  if (!snapshot) return false;
  for (const f of fieldsForSection(section)) {
    const persisted = (snapshot as any)[f] ?? null;
    const proposed = f in draft ? (draft[f] ?? null) : persisted;
    if ((persisted ?? '') !== (proposed ?? '')) return true;
  }
  return false;
}

export default function MyAccountCanonical() {
  const [, navigate] = useLocation();
  const { snapshot, outcome, isLoading, refetch } = useMyAccountSnapshot();
  const { completeness } = useProfileCompleteness();
  const { save, isSaving, lastOutcome, reset } = useMyAccountPatch();
  const [editing, setEditing] = useState<SectionCode | null>(null);
  const [draft, setDraft] = useState<Partial<Record<DirectPatchField, string | null>>>({});

  const serverReady = outcome?.status !== 'not_ready';
  const dirty = editing ? isDirty(editing, snapshot, draft) : false;

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  function beginEdit(section: SectionCode) {
    const seed: Partial<Record<DirectPatchField, string | null>> = {};
    if (snapshot) {
      for (const f of fieldsForSection(section)) seed[f] = (snapshot as any)[f] ?? null;
    }
    setEditing(section);
    setDraft(seed);
    reset();
  }
  function cancelEdit() { setEditing(null); setDraft({}); reset(); }

  async function saveEdit() {
    if (!editing) return;
    const patch: Partial<Record<DirectPatchField, string | null>> = {};
    for (const f of fieldsForSection(editing)) {
      const persisted = (snapshot as any)?.[f] ?? null;
      const proposed = f in draft ? (draft[f] ?? null) : persisted;
      if ((persisted ?? '') !== (proposed ?? '')) patch[f] = proposed as string | null;
    }
    if (Object.keys(patch).length === 0) { cancelEdit(); return; }
    save(patch);
  }

  // On successful save, close the editor and re-read.
  useEffect(() => {
    if (lastOutcome?.status === 'ok') {
      setEditing(null);
      setDraft({});
      refetch();
    }
  }, [lastOutcome?.status, refetch]);

  const completenessSummary = useMemo(() => {
    if (!completeness) return null;
    return `${completeness.profileState}${completeness.missingFields.length ? ` — missing ${completeness.missingFields.length}` : ''}`;
  }, [completeness]);

  return (
    <div data-testid="my-account-canonical-page" className="max-w-2xl mx-auto px-3 py-4">
      <div className="mb-3 flex items-baseline gap-2 flex-wrap">
        <h1 className="text-2xl font-semibold">MY_ACCOUNT_TITLE</h1>
        {completenessSummary && (
          <span data-testid="completeness-pill" className="text-xs text-gray-500">{completenessSummary}</span>
        )}
        {!serverReady && (
          <span data-testid="server-not-ready-pill" className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-800">
            SERVER_NOT_READY
          </span>
        )}
      </div>

      {(['PERSONAL', 'ADDRESS', 'PREFERENCES'] as const).map((section) => (
        <SectionCard
          key={section}
          code={section}
          editing={editing === section}
          onEdit={() => beginEdit(section)}
          onCancel={cancelEdit}
          onSave={saveEdit}
          isSaving={isSaving}
          serverReady={serverReady}
          dirty={dirty && editing === section}
          lastOutcome={lastOutcome}
        >
          {fieldsForSection(section).map((f) => (
            <FieldRow
              key={f}
              field={f}
              editing={editing === section}
              value={editing === section ? String(draft[f] ?? '') : String((snapshot as any)?.[f] ?? '')}
              onChange={(v) => setDraft((d) => ({ ...d, [f]: v }))}
            />
          ))}
        </SectionCard>
      ))}

      <div data-testid="section-CONTACT" className="border-b border-gray-100 py-3">
        <div className="text-sm font-semibold uppercase tracking-wider text-gray-600 mb-1">SECTION_CONTACT</div>
        <ReadOnlyRow field="email" value={snapshot?.email ?? ''} verified={!!snapshot?.emailVerified} onChange={() => navigate('/my-account/canonical?change=email')} />
        <ReadOnlyRow field="phone" value={snapshot?.phone ?? ''} verified={!!snapshot?.phoneVerified} onChange={() => navigate('/my-account/canonical?change=mobile')} />
      </div>

      <LinkTile code="MY_PETS" href="/pets" />
      <LinkTile code="PRESTIGE" href="/prestige-club" />
      <LinkTile code="PROVIDER_SETTINGS" href="/provider/settings" />
      <LinkTile code="PAYMENTS" href="/my-account/canonical?section=payments" />
      <LinkTile code="DOCUMENTS" href="/documents" />

      {isLoading && <div data-testid="loading" className="text-xs text-gray-500 mt-3">LOADING</div>}
    </div>
  );
}

function SectionCard(props: {
  code: SectionCode;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  isSaving: boolean;
  serverReady: boolean;
  dirty: boolean;
  lastOutcome: ReturnType<typeof useMyAccountPatch>['lastOutcome'];
  children: React.ReactNode;
}) {
  return (
    <div data-testid={`section-${props.code}`} className="border-b border-gray-100 py-3">
      <div className="flex items-baseline justify-between mb-1">
        <div className="text-sm font-semibold uppercase tracking-wider text-gray-600">SECTION_{props.code}</div>
        {!props.editing ? (
          <button type="button" data-testid={`edit-${props.code}`} onClick={props.onEdit} disabled={!props.serverReady} className="text-xs underline text-emerald-700 disabled:text-gray-400">
            EDIT
          </button>
        ) : (
          <div className="flex gap-2 items-center">
            {props.isSaving && <span data-testid="saving-pill" className="text-xs text-gray-500">SAVING…</span>}
            {props.lastOutcome?.status === 'ok' && <span data-testid="saved-pill" className="text-xs text-emerald-700">SAVED_✓</span>}
            {props.lastOutcome?.status === 'partial_rollback' && (
              <span data-testid="partial-pill" className="text-xs text-amber-700">PARTIAL_ROLLBACK_{props.lastOutcome.reasonCode}</span>
            )}
            {props.lastOutcome?.status === 'rejected' && (
              <span data-testid="rejected-pill" className="text-xs text-red-700">REJECTED_{props.lastOutcome.reasonCode}</span>
            )}
            <button type="button" data-testid={`cancel-${props.code}`} onClick={props.onCancel} className="text-xs text-gray-600">CANCEL</button>
            <button type="button" data-testid={`save-${props.code}`} onClick={props.onSave} disabled={props.isSaving || !props.dirty} className="text-xs font-semibold text-white bg-emerald-600 rounded px-2 py-1 disabled:bg-gray-300">
              SAVE_CHANGES
            </button>
          </div>
        )}
      </div>
      <div className="space-y-1">{props.children}</div>
    </div>
  );
}

function FieldRow(props: { field: DirectPatchField; editing: boolean; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <label className="w-32 text-xs text-gray-500 uppercase tracking-wider">FIELD_{props.field}</label>
      {props.editing ? (
        <input
          data-testid={`input-${props.field}`}
          className="flex-1 border border-gray-300 rounded px-2 py-1"
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
        />
      ) : (
        <span data-testid={`value-${props.field}`} className="flex-1 text-gray-800">{props.value || '—'}</span>
      )}
    </div>
  );
}

function ReadOnlyRow(props: { field: string; value: string; verified: boolean; onChange: () => void }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <label className="w-32 text-xs text-gray-500 uppercase tracking-wider">FIELD_{props.field}</label>
      <span data-testid={`value-${props.field}`} className="flex-1 text-gray-800">{props.value || '—'}</span>
      <span data-testid={`verified-${props.field}`} className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${props.verified ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>
        {props.verified ? 'VERIFIED' : 'NOT_VERIFIED'}
      </span>
      <button type="button" data-testid={`change-${props.field}`} onClick={props.onChange} className="text-xs underline text-emerald-700">CHANGE</button>
    </div>
  );
}

function LinkTile(props: { code: string; href: string }) {
  const [, navigate] = useLocation();
  return (
    <button type="button" data-testid={`tile-${props.code}`} onClick={() => navigate(props.href)} className="w-full text-left border-b border-gray-100 py-3 flex items-center justify-between">
      <span className="text-sm font-semibold uppercase tracking-wider text-gray-600">SECTION_{props.code}</span>
      <span className="text-xs text-gray-400">OPEN →</span>
    </button>
  );
}
