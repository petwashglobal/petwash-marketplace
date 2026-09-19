/**
 * ⁦PetWash™⁩ logo for email templates.
 *
 * THERE ARE TWO LOGOS AND THE BACKGROUND DECIDES WHICH ONE (CEO, 2026-09-19:
 * "we have two logo black and white against background").
 *
 *   petwash-logo-on-dark.png   — WHITE logo, GENUINELY transparent, 600x240,
 *                                16KB. For DARK headers. (Derived from
 *                                petwash-logo-black-bg.png, whose own
 *                                background is an OPAQUE black matte.)
 *   petwash-logo-white-bg.png  — BLACK logo on solid white, 631x223, 98KB.
 *                                For WHITE / light sections.
 *
 * Every template used to point at petwash-logo-official.png: a 3072x1186,
 * 870KB black logo whose matte renders as a WHITE BOX when it sits on a dark
 * header — which is what almost every PetWash email has. Confirmed by
 * rendering the booking confirmation on 2026-09-19: a white rectangle around
 * the wordmark, centred on the black header.
 *
 * It was also 870KB of logo in an email that is otherwise ~7KB.
 */

/**
 * Use on a dark header. White wordmark, GENUINELY transparent.
 *
 * 2026-09-19: petwash-logo-black-bg.png is RGBA but its background is an
 * OPAQUE BLACK matte (alpha 255, rgb 0,0,0) — verified by decoding the first
 * scanline. On any header that is not exactly #000000 it reads as a black
 * rectangle pasted on the design, which is the "box" the CEO kept pointing at
 * after the white one was removed. petwash-logo-on-dark.png derives its alpha
 * from the wordmark's own luminance, so the matte is fully transparent, the
 * glyph is fully opaque, and the antialiased edge keeps its partial alpha
 * instead of looking cut out. 31KB -> 16KB as a side effect.
 */
export const PETWASH_LOGO_ON_DARK = 'https://petwash.co.il/brand/petwash-logo-on-dark.png';

/** Use on a white or light section. Black wordmark. */
export const PETWASH_LOGO_ON_LIGHT = 'https://petwash.co.il/brand/petwash-logo-white-bg.png';

/**
 * @deprecated Pick PETWASH_LOGO_ON_DARK or PETWASH_LOGO_ON_LIGHT for the
 * background you are actually placing it on. Kept so no template breaks; it
 * now resolves to the dark-header asset, which is the correct one for the
 * large majority of call sites and is 28x smaller than the old file.
 */
export const PETWASH_LOGO_BASE64 = PETWASH_LOGO_ON_DARK;

export const PETWASH_LOGO_FALLBACK = `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxODAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCAxODAgNjAiPjxyZWN0IHdpZHRoPSIxODAiIGhlaWdodD0iNjAiIGZpbGw9IiM3YzNhZWQiIHJ4PSI4Ii8+PHRleHQgeD0iNTAlIiB5PSI1NSUiIGZpbGw9IndoaXRlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjAiIGZvbnQtd2VpZ2h0PSJib2xkIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5QZXQgV2FzaOKEojwvdGV4dD48L3N2Zz4=`;
