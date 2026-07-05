#!/usr/bin/env python3
# Regenerate the PetWash master legal manual PDF with CORRECT Hebrew RTL.
# The original (ReportLab) mangled Hebrew. This renders the repo source
# markdown faithfully: logical word-wrap -> bidi per line -> right-aligned,
# embedding Arial Unicode (has Hebrew). Pure-Python (fpdf2 + python-bidi).
import sys, re
from fpdf import FPDF
from bidi.algorithm import get_display

SRC = sys.argv[1]
OUT = sys.argv[2]
FONT = "/Library/Fonts/Arial Unicode.ttf"

GOLD = (154, 123, 46)
GREEN = (20, 64, 45)
INK = (25, 33, 29)

def shape(s):
    # visual (display) order for a single already-wrapped line
    return get_display(s, base_dir='R')

class PDF(FPDF):
    def header(self):
        if self.page_no() == 1:
            return
        self.set_font("AU", size=8)
        self.set_text_color(*GOLD)
        self.set_xy(self.l_margin, 8)
        self.cell(0, 6, shape("Pet Wash Ltd — הסכם מסגרת והגנות משפטיות (טיוטה)"), align="R")
        self.set_draw_color(*GOLD); self.set_line_width(0.3)
        self.line(self.l_margin, 15, self.w - self.r_margin, 15)
    def footer(self):
        self.set_y(-14)
        self.set_font("AU", size=8)
        self.set_text_color(150,150,150)
        self.cell(0, 6, shape("טיוטה לבדיקת עו\"ד — אינה ייעוץ משפטי"), align="R")
        self.set_x(self.l_margin)
        self.cell(0, 6, str(self.page_no()), align="L")

pdf = PDF(format="A4")
pdf.set_auto_page_break(True, margin=18)
pdf.set_margins(20, 18, 20)
pdf.add_font("AU", "", FONT)
pdf.add_page()

W = pdf.w - pdf.l_margin - pdf.r_margin

def wrap(text, size):
    # greedy wrap in LOGICAL order, measuring char widths
    pdf.set_font("AU", size=size)
    words = text.split(" ")
    lines, cur = [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        if pdf.get_string_width(trial) <= W or not cur:
            cur = trial
        else:
            lines.append(cur); cur = w
    if cur:
        lines.append(cur)
    return lines

def write_para(text, size=10.5, gap=1.4, color=INK, bold_line=False, lead=5.2):
    pdf.set_font("AU", size=size)
    pdf.set_text_color(*color)
    for ln in wrap(text, size):
        pdf.set_x(pdf.l_margin)
        pdf.cell(W, lead, shape(ln), align="R")
        pdf.ln(lead)
    pdf.ln(gap)

def section_head(num, title):
    if pdf.get_y() > pdf.h - 40:
        pdf.add_page()
    pdf.ln(2)
    pdf.set_font("AU", size=13)
    pdf.set_text_color(*GREEN)
    for ln in wrap(f"{num}. {title}", 13):
        pdf.set_x(pdf.l_margin)
        pdf.cell(W, 7, shape(ln), align="R"); pdf.ln(7)
    pdf.set_draw_color(*GOLD); pdf.set_line_width(0.4)
    pdf.line(pdf.w - pdf.r_margin - 55, pdf.get_y()+1, pdf.w - pdf.r_margin, pdf.get_y()+1)
    pdf.ln(4)

# ---- Title block ----
lines = open(SRC, encoding="utf-8").read().split("\n")
pdf.set_font("AU", size=18); pdf.set_text_color(*GREEN)
pdf.set_x(pdf.l_margin)
pdf.cell(W, 10, shape("הסכם מסגרת, תנאי שימוש והגנות משפטיות"), align="R"); pdf.ln(10)
pdf.set_font("AU", size=14); pdf.set_text_color(*GOLD)
pdf.set_x(pdf.l_margin); pdf.cell(W, 8, "Pet Wash Ltd", align="R"); pdf.ln(12)
pdf.set_draw_color(*GOLD); pdf.line(pdf.l_margin, pdf.get_y(), pdf.w-pdf.r_margin, pdf.get_y()); pdf.ln(6)

# ---- Parse body: sections between ==== lines, paragraphs, bullets ----
i = 0
n = len(lines)
# skip title (line0) and blockquote intro (>) but keep a short note
while i < n and (lines[i].startswith("#") or lines[i].startswith(">") or lines[i].strip()==""):
    i += 1

def is_sep(s): return set(s.strip()) == {"="} and len(s.strip()) > 5

buf = []
def flush():
    global buf
    text = " ".join(x.strip() for x in buf if x.strip())
    if text:
        write_para(text)
    buf = []

while i < n:
    line = lines[i]
    if is_sep(line):
        # next non-empty line is a section header (num. title), then a closing ====
        flush()
        j = i+1
        while j < n and lines[j].strip()=="" : j += 1
        head = lines[j].strip() if j < n else ""
        m = re.match(r"^(\d+)\.\s*(.*)$", head)
        if m:
            section_head(m.group(1), m.group(2))
        else:
            if head:
                pdf.set_font("AU", size=13); pdf.set_text_color(*GREEN)
                pdf.set_x(pdf.l_margin); pdf.cell(W,7, shape(head), align="R"); pdf.ln(9)
        # advance past the closing ==== after the header
        k = j+1
        while k < n and not is_sep(lines[k]):
            # header might be single line then closing sep; but some headers wrap—collect until sep
            if lines[k].strip()=="":
                k += 1; continue
            break
        # move i to after the closing separator
        p = j+1
        while p < n and not is_sep(lines[p]): p += 1
        i = p+1
        continue
    if line.strip()=="":
        flush()
        pdf.ln(1.4)   # blank line in source = paragraph gap
        i += 1; continue
    if line.lstrip().startswith("- "):
        flush()
        item = line.lstrip()[2:].strip()
        for wln_i, wln in enumerate(wrap(item, 10.5)):
            pdf.set_font("AU", size=10.5); pdf.set_text_color(*INK)
            pdf.set_x(pdf.l_margin)
            txt = (wln + "  •") if wln_i==0 else wln
            pdf.cell(W, 5.2, shape(txt), align="R"); pdf.ln(5.2)
        pdf.ln(1)
        i += 1; continue
    # Each non-empty source line is its own logical unit (the author put one
    # paragraph / list item per line). Render it directly — never merge across
    # lines, which would jumble bidi and collapse numbered lists.
    write_para(line.strip(), gap=0.6)
    i += 1
flush()

pdf.output(OUT)
print("WROTE", OUT, "pages", pdf.page_no())
