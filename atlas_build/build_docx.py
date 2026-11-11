"""Assemble the 38 plates into a printable atlas (.docx) that matches the
notebook-sheet placement already written into the CUUV102 Google Doc."""
import ast
import os
from docx import Document
from docx.shared import Cm, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_ALIGN_VERTICAL
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

HERE = os.path.dirname(os.path.abspath(__file__))
FIGS = os.path.join(HERE, "figs")
OUT = os.path.join(HERE, "Basketball_Diagram_Atlas_38_Plates.docx")

NAVY = RGBColor(0x12, 0x26, 0x3F)
SLATE = RGBColor(0x41, 0x54, 0x6B)
GREY = RGBColor(0x6B, 0x7A, 0x8F)
GOLD = RGBColor(0xB8, 0x92, 0x1E)

# plate -> notebook sheet, exactly as the lines in the Google Doc read
SHEET = {1: 5, 2: 6, 3: 7, 4: 8, 5: 9, 6: 10, 7: 11, 8: 12, 9: 13, 10: 14,
         11: 15, 12: 16, 13: 18, 14: 19, 15: 20, 16: 21, 17: 22, 18: 23,
         19: 24, 20: 25, 21: 26, 22: 27}
for _n in range(23, 39):
    SHEET[_n] = _n + 6   # 23 -> 29 ... 38 -> 44

SECTION = {1: "Introduction", 2: "History", 3: "History", 4: "History",
           5: "History", 6: "The game", 7: "Court and equipment",
           8: "Court and equipment", 9: "Court and equipment",
           10: "Rules", 11: "Rules", 12: "Rules", 13: "Rules", 14: "Rules",
           15: "Skills", 16: "Skills", 17: "Skills", 18: "Skills", 19: "Skills",
           20: "Positions and tactics", 21: "Fitness and safety",
           22: "India"}
for _n in range(23, 39):
    SECTION[_n] = "FIBA vs NBA"


# what to say while pointing at each plate
NOTES = {
    1: [
        "Two teams of five; substitutions roll from the bench.",
        "Two points inside the arc, three outside, one from the line.",
    ],
    2: [
        "Naismith, Springfield YMCA, December 1891, thirteen rules.",
        "Peach baskets, closed bottoms, a soccer ball.",
    ],
    3: [
        "FIBA founded 1932; Olympic debut Berlin 1936; women 1976.",
        "The NBA took the game to a global television audience.",
    ],
    4: [
        "The game travelled through schools, colleges and YMCA centres.",
        "First national-level tournaments: 1934.",
    ],
    5: [
        "1934 first national tournaments • 1936 FIBA membership • 1950 BFI formed.",
    ],
    6: [
        "Score more than the opponent within the playing time.",
        "An invasion game: attack one basket, defend the other.",
    ],
    7: [
        "Boundary lines are part of the court they enclose.",
        "Centre line, centre circle, key, arc, restricted area.",
    ],
    8: [
        "Court 28 × 15 m • ring 3.05 m • arc 6.75 m • free-throw line 5.80 m.",
    ],
    9: [
        "Ball size 7; backboard 1.80 m wide; ring 45 cm across.",
        "No jewellery, no hard objects; kit numbered and matching.",
    ],
    10: [
        "Point guard, shooting guard, small forward, power forward, centre.",
        "Roles overlap: spacing and communication matter more than labels.",
    ],
    11: [
        "FIBA: 4 × 10 minutes, five-minute overtimes.",
        "Two points, three points, one point per free throw.",
    ],
    12: [
        "Play starts with a jump ball in the centre circle.",
        "Throw-ins restart play; the arrow decides held ball.",
    ],
    13: [
        "Personal foul — contact; technical — conduct.",
        "Team fouls build to a bonus; the fifth team foul gives free throws.",
    ],
    14: [
        "Crew chief plus two umpires on the floor.",
        "Scorer, assistant scorer, timer, shot-clock operator at the table.",
    ],
    15: [
        "Triple threat, jump stop, stride stop, front and reverse pivot.",
        "Ball first, pivot foot second — never the other way round.",
    ],
    16: [
        "Fingertips, waist height, eyes up; the ball never stops.",
        "Carrying and double dribble are the two calls to avoid.",
    ],
    17: [
        "Chest, bounce, overhead, baseball and outlet passes.",
        "Pass to the hand, not to the body; pass ahead of the runner.",
    ],
    18: [
        "Feet, knees, elbow, eyes, follow-through — held until the ball lands.",
        "Lay-up: right foot, left hand on the right side of the ring.",
    ],
    19: [
        "Box out, then go and get the ball with two hands.",
        "Defend the ball, deny the pass, help and recover.",
    ],
    20: [
        "Pick and roll, spacing, ball reversal, transition.",
        "The ball moves faster than the defence — make it do the work.",
    ],
    21: [
        "Warm up, cool down, hydrate, tape the ankles, respect the officials.",
        "Fair play protects the sport as much as fitness protects the player.",
    ],
    22: [
        "BFI coordinates the national game; leagues and 3x3 are growing.",
        "The pathway runs from school and college to state and national teams.",
    ],
    23: [
        "FIBA writes the international rulebook; the NBA writes its own.",
        "Never mix the two in one answer — name the competition first.",
    ],
    24: [
        "FIBA 28 × 15 m; NBA 94 × 50 ft, or 28.65 × 15.24 m.",
        "The NBA arc is 7.24 m; FIBA 6.75 m, 6.60 m in the corners.",
    ],
    25: [
        "FIBA 4 × 10 = 40 minutes; NBA 4 × 12 = 48.",
        "Overtime is five minutes in both.",
    ],
    26: [
        "24-second clock, 14-second reset, 8 seconds to cross halfway — both codes.",
        "Three seconds in the key applies to the offence in both.",
    ],
    27: [
        "FIBA: alternating-possession arrow. NBA: jump ball at the centre circle.",
        "The arrow also starts the second and later quarters.",
    ],
    28: [
        "Five personal fouls disqualify in FIBA; six in the NBA.",
        "Both reach the team penalty on the fifth team foul of a quarter.",
    ],
    29: [
        "FIBA: two in the first half, three in the second, one per overtime, 30 s.",
        "NBA: seven in regulation, two per overtime, 60 s each.",
    ],
    30: [
        "FIBA has no separate defensive three-second violation.",
        "NBA: a defender may not stand in the key without guarding anyone.",
    ],
    31: [
        "The ring is 3.05 m — exactly ten feet — in both codes.",
        "The cylinder protects the ball on the ring and in the net.",
    ],
    32: [
        "Two steps after the gather is legal in both.",
        "The NBA reads the gather more leniently and reviews the call.",
    ],
    33: [
        "FIBA: personal, team, technical, unsportsmanlike, disqualifying.",
        "NBA: personal, team, technical (including flopping), flagrant 1 and 2.",
    ],
    34: [
        "FIBA: one challenge per game, reviewed at the table.",
        "NBA: one, plus a second if the first is successful.",
    ],
    35: [
        "Shared: 3.05 m ring, 24 seconds, five a side, four quarters.",
        "Different: fouls, time-outs, possession, defensive three seconds.",
    ],
    36: [
        "FIBA keeps every decision on the floor with the crew.",
        "The NBA adds a replay centre that advises the crew.",
    ],
    37: [
        "Learn the fifteen rows in order: court, time, fouls, possession, stoppages.",
    ],
    38: [
        "Rule, contrast, number, reason, effect — five sentences per area.",
    ],
}


VIVA = {
    1: ("How many players start, and what is the ball worth inside and outside the arc?",
        "Five a side; two points inside the arc, three outside, one per free throw."),
    2: ("Who invented the game, where, and in which month and year?",
        "James Naismith, Springfield YMCA, December 1891."),
    3: ("In which years was FIBA founded and did basketball first appear at the Olympics?",
        "FIBA 1932; Olympic debut 1936; women 1976."),
    4: ("Which year does the BFI give for the first national-level tournaments in India?",
        "1934, per the Basketball Federation of India."),
    5: ("Name the three milestone years of Indian basketball and what each one marks.",
        "1934 first national tournaments, 1936 FIBA membership, 1950 BFI formed."),
    6: ("What makes basketball an invasion game, and when do teams change ends?",
        "Each team attacks one basket and defends the other; ends change at half-time."),
    7: ("Name the five main areas marked inside a FIBA court.",
        "Centre circle, key, free-throw circle, restricted area, three-point line."),
    8: ("Give four dimensions: court, ring height, arc radius, free-throw line.",
        "28 × 15 m; ring 3.05 m; arc 6.75 m; free-throw line 5.80 m from the end line."),
    9: ("How wide is the backboard, and what size ball is used in senior men’s play?",
        "1.80 m wide; size 7 ball, about 24 cm across."),
    10: ("Name the five positions and one job for each.",
        "Point guard, shooting guard, small forward, power forward, centre."),
    11: ("How long is a FIBA game, and what is a basket worth from each zone?",
        "4 × 10 minutes; two points mid-range, three beyond the arc, one per free throw."),
    12: ("How does play start, and what decides possession when the ball is held?",
        "A jump ball in the centre circle; the alternating-possession arrow decides held ball."),
    13: ("What is the difference between a personal foul and a technical foul?",
        "A personal foul is illegal contact; a technical foul is misconduct, not contact."),
    14: ("Who makes up the crew on the floor, and who sits at the table?",
        "Crew chief and two umpires; scorer, assistant scorer, timer, shot-clock operator."),
    15: ("What is the pivot, and which foot may you move first?",
        "The pivot is turning on one foot; the pivot foot stays down, the other foot moves."),
    16: ("Which two violations does a dribbler have to avoid?",
        "Carrying (palming) and the double dribble."),
    17: ("Name four passes and the situation each one suits.",
        "Chest for pace, bounce past a defender’s hands, overhead over a press, outlet after a rebound."),
    18: ("What are the five checkpoints of a shot, in order from the feet up?",
        "Feet and balance, knees and hips, elbow under the ball, eyes on the ring, follow-through."),
    19: ("What is boxing out, and what are the three defensive principles?",
        "Boxing out is blocking a rebounder with the body; defend the ball, deny the pass, help and recover."),
    20: ("Explain the pick and roll in one sentence.",
        "A screen on the ball, then the screener rolls to the ring while the ball handler attacks."),
    21: ("Give three things a player should do before and after a session.",
        "Warm up and tape ankles before; cool down and hydrate after."),
    22: ("Which body runs the national game in India, and what does the pathway look like?",
        "The Basketball Federation of India; school and college to state, then national teams."),
    23: ("Who writes each of the two rulebooks, and why does that matter in a viva?",
        "FIBA writes the international rules, the NBA its own; name the competition before quoting a rule."),
    24: ("Give the court size and the three-point distances in both codes.",
        "FIBA 28 × 15 m, arc 6.75 m; NBA 28.65 × 15.24 m, arc 7.24 m."),
    25: ("How long is each game, and how long is overtime in both?",
        "FIBA 40 minutes in four quarters, NBA 48; overtime is five minutes in both."),
    26: ("Which three timing limits are identical in FIBA and the NBA?",
        "The 24-second clock, the 14-second reset and the 8-second backcourt limit."),
    27: ("What happens on a held ball in FIBA, and what happens in the NBA?",
        "FIBA gives the ball by the arrow; the NBA jumps the ball up again."),
    28: ("How many personal fouls end a player’s night in each code?",
        "Five in FIBA, six in the NBA."),
    29: ("How many time-outs, and how long is each, in FIBA and in the NBA?",
        "FIBA two plus three plus one per overtime, 30 s; NBA seven plus two per overtime, 60 s."),
    30: ("Which code has a defensive three-second rule, and what does it stop?",
        "Only the NBA; it stops a defender parking in the key without guarding anyone."),
    31: ("At what height is the ring in both codes, in metres and in feet?",
        "3.05 m, which is exactly ten feet, in both codes."),
    32: ("How many steps after the gather are legal, and where do the codes differ?",
        "Two steps after the gather in both; the NBA reads the gather more leniently."),
    33: ("Name the five foul categories in each rulebook.",
        "FIBA: personal, team, technical, unsportsmanlike, disqualifying. NBA: personal, team, technical, flagrant 1, flagrant 2."),
    34: ("How many challenges does a coach get in each code, and who reviews them?",
        "One each; FIBA reviews at the table, the NBA at the replay centre, plus a second if the first succeeds."),
    35: ("Name four rules that are the same on both sides of the Atlantic.",
        "3.05 m ring, 24-second clock, five a side, four quarters."),
    36: ("Who keeps every decision on the floor, and who advises in the NBA?",
        "FIBA leaves every decision with the crew on the floor; the NBA’s replay centre advises."),
    37: ("Which of the fifteen rows surprise an examiner most? Say why.",
        "The free-throw line and key width, because they differ by centimetres, not metres."),
    38: ("Give the five-sentence structure of a safe answer, in order.",
        "Rule, then contrast, then the number, then the reason, then the effect on the floor."),
}


def plates():
    out = {}
    for fname in ("figs_a.py", "figs_b.py", "figs_c.py", "figs_d.py",
                  "figs_e.py", "figs_f.py", "figs_g.py", "figs_h.py"):
        tree = ast.parse(open(os.path.join(HERE, fname), encoding="utf-8").read())
        for node in ast.walk(tree):
            if isinstance(node, ast.Call) and getattr(node.func, "id", "") == "Page":
                args = node.args
                num = args[0].value
                title = args[2].value
                sub = args[3].value if len(args) > 3 else ""
                out[num] = (title, sub)
    return out


def set_cell_bg(cell, hexcolor):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:fill"), hexcolor)
    tcPr.append(shd)


def bottom_rule(paragraph, color="C9D6E3", size=8):
    pPr = paragraph._p.get_or_add_pPr()
    bdr = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), str(size))
    bottom.set(qn("w:space"), "4")
    bottom.set(qn("w:color"), color)
    bdr.append(bottom)
    pPr.append(bdr)


def style_doc(doc):
    normal = doc.styles["Normal"]
    normal.font.name = "Calibri"
    normal.font.size = Pt(10.5)
    normal.font.color.rgb = SLATE
    normal.paragraph_format.space_after = Pt(4)


def page_setup(section, top=1.6, bottom=1.4, left=1.5, right=1.5):
    section.page_width = Cm(21.7)
    section.page_height = Cm(28.8)
    section.top_margin = Cm(top)
    section.bottom_margin = Cm(bottom)
    section.left_margin = Cm(left)
    section.right_margin = Cm(right)


def footer(section, text):
    p = section.footer.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    run = p.add_run(text)
    run.font.size = Pt(8)
    run.font.color.rgb = GREY


def build():
    meta = plates()
    missing = [n for n in range(1, 39) if n not in meta]
    if missing:
        raise SystemExit(f"no Page() metadata for plates {missing}")

    doc = Document()
    style_doc(doc)
    sec = doc.sections[0]
    page_setup(sec)
    footer(sec, "CUUV102  \u2022  Basketball  \u2022  Print & Paste Diagram Atlas")

    # ------------------------------------------------ cover
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(58)
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("CUUV102   \u2022   BASKETBALL")
    r.font.size = Pt(11)
    r.font.bold = True
    r.font.color.rgb = GOLD

    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("Print & Paste")
    r.font.size = Pt(26)
    r.font.color.rgb = SLATE

    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("Diagram Atlas")
    r.font.size = Pt(44)
    r.font.bold = True
    r.font.color.rgb = NAVY

    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("THIRTY-EIGHT PLATES  \u2022  TOPIC 22: FIBA RULES vs NBA RULES")
    r.font.size = Pt(10.5)
    r.font.bold = True
    r.font.color.rgb = GOLD

    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(8)
    r = p.add_run("History, rules and regulations, the game in India, and the "
                  "differences between the FIBA and NBA rulebooks")
    r.font.size = Pt(11)
    r.font.italic = True
    r.font.color.rgb = SLATE

    # fact strip
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(26)
    r = p.add_run("The set at a glance")
    r.font.size = Pt(9)
    r.font.bold = True
    r.font.color.rgb = NAVY
    bottom_rule(p)

    tb = doc.add_table(rows=5, cols=2)
    facts = [
        ("Plates", "38, one to a page, each with its number and heading"),
        ("Matches", "Every plate is placed on a named notebook sheet, 05 to 44"),
        ("Rules used", "FIBA Official Basketball Rules 2026 \u2013 v1.1, and the NBA rulebook"),
        ("Printing", "A4 or Letter, colour, one plate per page, no scaling"),
        ("Prepared", "11 November 2026"),
    ]
    for i, (k, v) in enumerate(facts):
        c0, c1 = tb.rows[i].cells
        c0.width, c1.width = Cm(3.4), Cm(14.8)
        c0.text = ""
        rr = c0.paragraphs[0].add_run(k.upper())
        rr.font.size = Pt(8)
        rr.font.bold = True
        rr.font.color.rgb = GREY
        c1.text = ""
        rr = c1.paragraphs[0].add_run(v)
        rr.font.size = Pt(10)
        rr.font.color.rgb = SLATE

    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(22)
    r = p.add_run("Design key.  ")
    r.font.size = Pt(10)
    r.font.bold = True
    r.font.color.rgb = NAVY
    r = p.add_run("Blue is always FIBA, orange is always the NBA, and grey is the "
                  "commentary that explains why a difference exists. Every page carries "
                  "its plate number in the gold badge at the top left, so a plate can be "
                  "matched to its sheet at a glance. The caption under the title states "
                  "the single idea the diagram is meant to teach.")
    r.font.size = Pt(10)
    r.font.color.rgb = SLATE

    # ------------------------------------------------ contents
    doc.add_page_break()
    h = doc.add_paragraph()
    r = h.add_run("Contents")
    r.font.size = Pt(22)
    r.font.bold = True
    r.font.color.rgb = NAVY
    bottom_rule(h)

    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(10)
    r = p.add_run("Thirty-eight plates, grouped in the same order as the notebook. "
                  "The sheet column is the notebook sheet on which each plate is pasted.")
    r.font.size = Pt(9.5)
    r.font.italic = True
    r.font.color.rgb = GREY

    tbl = doc.add_table(rows=1, cols=4)
    tbl.style = "Table Grid"
    widths = (Cm(1.5), Cm(9.4), Cm(5.4), Cm(1.9))
    heads = ("No.", "Plate", "Section", "Sheet")
    for cell, text, w in zip(tbl.rows[0].cells, heads, widths):
        cell.width = w
        cell.text = ""
        rr = cell.paragraphs[0].add_run(text.upper())
        rr.font.size = Pt(8)
        rr.font.bold = True
        rr.font.color.rgb = NAVY
        set_cell_bg(cell, "E8EEF6")
    for num in range(1, 39):
        title, _sub = meta[num]
        row = tbl.add_row().cells
        vals = (f"{num:02d}", title, SECTION[num], str(SHEET[num]))
        for i, (cell, text, w) in enumerate(zip(row, vals, widths)):
            cell.width = w
            cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
            cell.text = ""
            rr = cell.paragraphs[0].add_run(text)
            rr.font.size = Pt(8.5)
            rr.font.bold = i == 0
            rr.font.color.rgb = NAVY if i == 0 else SLATE
            if i in (0, 3):
                cell.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
            if num % 2 == 0:
                set_cell_bg(cell, "F5F8FB")

    # ------------------------------------------------ plates
    for num in range(1, 39):
        title, sub = meta[num]
        doc.add_page_break()

        p = doc.add_paragraph()
        r = p.add_run(f"PLATE {num:02d}")
        r.font.size = Pt(9)
        r.font.bold = True
        r.font.color.rgb = GOLD
        r = p.add_run(f"    \u2022    {SECTION[num].upper()}")
        r.font.size = Pt(9)
        r.font.bold = True
        r.font.color.rgb = GREY
        r = p.add_run(f"    \u2022    NOTEBOOK SHEET {SHEET[num]}")
        r.font.size = Pt(9)
        r.font.bold = True
        r.font.color.rgb = GREY

        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(1)
        p.paragraph_format.space_after = Pt(1)
        r = p.add_run(title)
        r.font.size = Pt(18)
        r.font.bold = True
        r.font.color.rgb = NAVY

        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(9)
        r = p.add_run(sub)
        r.font.size = Pt(9.5)
        r.font.italic = True
        r.font.color.rgb = SLATE
        bottom_rule(p)

        img = os.path.join(FIGS, f"plate{num:02d}.png")
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_before = Pt(8)
        p.add_run().add_picture(img, width=Cm(17.8))

        q, a = VIVA[num]
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(9)
        r = p.add_run("VIVA QUESTION   ")
        r.font.size = Pt(7.5)
        r.font.bold = True
        r.font.color.rgb = GOLD
        r = p.add_run(q)
        r.font.size = Pt(9)
        r.font.bold = True
        r.font.color.rgb = NAVY

        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(1)
        r = p.add_run("SHORT ANSWER   ")
        r.font.size = Pt(7.5)
        r.font.bold = True
        r.font.color.rgb = GOLD
        r = p.add_run(a)
        r.font.size = Pt(9)
        r.font.color.rgb = SLATE

        for line in NOTES[num]:
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(1)
            p.paragraph_format.left_indent = Cm(0.4)
            r = p.add_run("\u2022  " + line)
            r.font.size = Pt(8.5)
            r.font.color.rgb = SLATE

    # ------------------------------------------------ how to use
    doc.add_page_break()
    h = doc.add_paragraph()
    r = h.add_run("How to Print and Paste")
    r.font.size = Pt(22)
    r.font.bold = True
    r.font.color.rgb = NAVY
    bottom_rule(h)

    steps = [
        ("Print", "Print the plates single-sided in colour. Turn off \u2018fit to page\u2019 "
                  "and any automatic scaling: the plates are drawn to a 21.7 \u00d7 28.8 cm "
                  "page, the same size as the assignment sheets."),
        ("Trim", "The caption band under each diagram repeats the plate number. Trim to "
                 "the band if you want the pasted figure to sit flush with a ruled page; "
                 "keep it if you want the number visible on the sheet. The two spoken lines under each plate are for revision — cut them off before pasting."),
        ("Match", "Each plate is labelled with its notebook sheet. Paste Plate 01 on "
                  "sheet 05, Plate 23 on sheet 29, and so on: the Contents table is the "
                  "full list."),
        ("Paste", "Use a glue stick and press from the centre outwards so the drawing "
                  "does not crease or bubble. Keep the labels readable and do not paste "
                  "over the ruled writing area you still need."),
        ("Reference", "If a viva asks for the rule behind a plate, quote the FIBA "
                      "Official Basketball Rules 2026 (v1.1, effective 1 October 2026) "
                      "for the international position and the NBA rulebook for the "
                      "league position. References [11] to [14] on sheet 45 carry the "
                      "full citations."),
    ]
    for name, body in steps:
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(10)
        r = p.add_run(name.upper())
        r.font.size = Pt(9)
        r.font.bold = True
        r.font.color.rgb = GOLD
        p = doc.add_paragraph()
        r = p.add_run(body)
        r.font.size = Pt(10)
        r.font.color.rgb = SLATE

    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(18)
    r = p.add_run("A note on the numbers")
    r.font.size = Pt(10)
    r.font.bold = True
    r.font.color.rgb = NAVY
    p = doc.add_paragraph()
    r = p.add_run("Court and equipment figures follow the FIBA rulebook and are converted "
                  "from imperial NBA figures at 1 ft = 0.3048 m, so 94 \u00d7 50 ft reads "
                  "28.65 \u00d7 15.24 m and a 3.05 m ring is exactly ten feet. Where the two "
                  "rulebooks agree \u2014 ring height, shot clock, overtime length, five "
                  "players a side \u2014 the plate says so instead of inventing a difference, "
                  "because a viva will test exactly that point. Rules change: the comparison "
                  "reflects the rule material published on 11 November 2026.")
    r.font.size = Pt(9.5)
    r.font.color.rgb = SLATE

    doc.save(OUT)
    print("wrote", OUT, os.path.getsize(OUT) // 1024, "KB")


if __name__ == "__main__":
    build()
