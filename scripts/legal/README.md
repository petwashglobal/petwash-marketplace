# Legal-pack PDF generator

`gen_legal_pdf.py` renders a Hebrew legal document to PDF with **correct RTL
shaping**. The original pack (`client/public/documents/legal/legal-protection-pack-2026/`)
was produced by a tool that mangled Hebrew (letters reversed / not selectable).
This regenerates from the repo's markdown source with proper bidi.

## Why
Pure-Python, no native deps (`fpdf2` + `python-bidi`), embeds
`/Library/Fonts/Arial Unicode.ttf` (has Hebrew). Each source line is wrapped in
logical order, then reordered per line with the Unicode bidi algorithm and
right-aligned — so mixed Hebrew + English (Pet Wash, K9000, QR…) + numbers all
read correctly.

## Use
```
pip3 install --user fpdf2 python-bidi
python3 scripts/legal/gen_legal_pdf.py <source.md> <out.pdf>
```

Document 00 (master framework) source:
`docs/legal/petwash-master-legal-framework-he-2026-06-23.md`

The other 11 pack documents can be regenerated the same way once each one's
clean Hebrew source is confirmed.

> Draft pack for Israeli lawyer review — not legal advice.
