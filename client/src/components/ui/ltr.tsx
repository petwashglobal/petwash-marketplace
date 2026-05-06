import type { ReactNode, HTMLAttributes } from 'react';

/**
 * Force LTR rendering inside an RTL parent (Hebrew page).
 *
 * Use this for any string that is REORDERED INCORRECTLY when the page
 * direction is RTL — phone numbers, emails, URLs, IDs, mixed digits,
 * SHA / IBAN / ח.פ. / VAT-number, anything where the order matters.
 *
 * In Hebrew RTL containers the browser bidi algorithm splits "+972 54..."
 * into LTR + RTL runs and reorders, producing strings like "972-54-...+"
 * (the leading "+" jumps to the end).
 *
 * `dir="ltr"` alone is NOT enough — the parent's bidi context can still
 * leak. `unicode-bidi: isolate` creates an isolation boundary so the
 * outer page direction never reorders the inner text.
 *
 * Usage:
 *   <Ltr>+972 54-983-3355</Ltr>
 *   <Ltr as="span" className="font-mono">{voucherCode}</Ltr>
 *   <Ltr as="a" href={SUPPORT_TEL_URL}>{SUPPORT_PHONE_DISPLAY}</Ltr>
 *
 * The `as` prop lets us preserve semantics (span / a / strong / code)
 * without nesting an extra wrapper.
 */
type AsTag = 'span' | 'a' | 'strong' | 'code' | 'div' | 'em' | 'p' | 'bdi';

type LtrProps<T extends AsTag = 'span'> = {
  children: ReactNode;
  as?: T;
} & HTMLAttributes<HTMLElement> & { href?: string };

export function Ltr<T extends AsTag = 'span'>({
  children,
  as,
  className,
  ...rest
}: LtrProps<T>) {
  const Tag = (as ?? 'span') as any;
  const cls = ['ltr-inline', className].filter(Boolean).join(' ');
  return (
    <Tag {...rest} dir="ltr" className={cls}>
      {children}
    </Tag>
  );
}

export default Ltr;
