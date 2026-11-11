"""Render the Print & Paste Diagram Atlas as a print-ready PDF.

Page 1 is a cover, page 2 the contents, pages 3-40 the plates, page 41 how-to.
Page format 21.7 x 28.8 cm, matching the CUUV102 notebook sheets.
"""
import ast
import os
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.backends.backend_pdf import PdfPages
import matplotlib.image as mpimg
from matplotlib.patches import FancyBboxPatch

from build_docx import NOTES, SHEET, SECTION, plates

HERE = os.path.dirname(os.path.abspath(__file__))
FIGS = os.path.join(HERE, "figs")
OUT = os.path.join(HERE, "Basketball_Diagram_Atlas_38_Plates.pdf")

NAVY = "#12263F"
SLATE = "#41546B"
GREY = "#6B7A8F"
GOLD = "#B8921E"
LINE = "#C9D6E3"
WASH = "#F5F8FB"

W, H = 21.7, 28.8          # cm
M = 1.5                    # side margin


# viva questions, one per plate: (question, crib answer)
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


def page():
    fig = plt.figure(figsize=(W / 2.54, H / 2.54))
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_xlim(0, W)
    ax.set_ylim(0, H)
    ax.axis("off")
    return fig, ax


def t(ax, x, y, s, fs=10, color=SLATE, weight="normal", ha="left", va="baseline",
      style="normal", **kw):
    ax.text(x, y, s, fontsize=fs, color=color, fontweight=weight, ha=ha, va=va,
            style=style, family="DejaVu Sans", **kw)


def para(ax, x, y, width_cm, s, fs=9.5, color=SLATE, lh=1.55,
         weight="normal", style="normal"):
    """Very small word wrapper: DejaVu Sans averages ~0.52 fs per character."""
    factor = 0.0198 if weight == "bold" else 0.0176
    per_line = max(8, int(width_cm / (fs * factor)))
    words, lines, cur = s.split(), [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        if len(trial) <= per_line:
            cur = trial
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    step = fs * 0.0353 * lh
    for i, line in enumerate(lines):
        t(ax, x, y - i * step, line, fs=fs, color=color, weight=weight, style=style)
    return y - len(lines) * step


def footer(ax, left="CUUV102  \u2022  Basketball  \u2022  Print & Paste Diagram Atlas"):
    ax.plot([M, W - M], [1.55, 1.55], lw=0.6, color=LINE)
    t(ax, M, 1.05, left, fs=6.5, color=GREY)
    t(ax, W - M, 1.05, "DIAGRAM ATLAS", fs=6.5, color=GREY, ha="right", weight="bold")


def cover(pdf):
    fig, ax = page()
    ax.add_patch(plt.Rectangle((0, H - 7.0), W, 7.0, fc=NAVY, ec="none"))
    ax.add_patch(plt.Rectangle((0, H - 7.45), W, 0.45, fc=GOLD, ec="none"))
    t(ax, M + 0.2, H - 1.6, "CUUV102   \u2022   BASKETBALL", fs=10.5, color=GOLD,
      weight="bold")
    t(ax, M + 0.2, H - 3.5, "Print & Paste", fs=26, color="#9FB6CE")
    t(ax, M + 0.2, H - 5.9, "Diagram Atlas", fs=42, color="white", weight="bold")

    y = H - 9.0
    t(ax, M + 0.2, y, "THIRTY-EIGHT PLATES", fs=19, color=NAVY, weight="bold")
    t(ax, M + 0.2, y - 1.5, "TOPIC 22   \u2022   FIBA RULES vs NBA RULES", fs=10,
      color=GOLD, weight="bold")
    para(ax, M + 0.2, y - 3.6, 17.6,
         "History, rules and regulations, the current status of basketball in India, and "
         "the key differences between the FIBA and the NBA rulebooks \u2014 drawn as a set "
         "of figures that can be pasted straight onto the notebook sheets.",
         fs=10.2, lh=1.6)

    y = 12.9
    t(ax, M + 0.2, y, "THE SET AT A GLANCE", fs=7.2, color=GREY, weight="bold")
    ax.plot([M + 0.2, W - M - 0.2], [y - 0.4, y - 0.4], lw=0.7, color=LINE)
    rows = [("Plates", "38, one to a page, each numbered and titled"),
            ("Matches", "Every plate names the notebook sheet it belongs on, 05 to 44"),
            ("Rules used", "FIBA Official Basketball Rules 2026 \u2013 v1.1, and the NBA rulebook"),
            ("Printing", "Colour, one plate per page, no scaling, 21.7 \u00d7 28.8 cm"),
            ("Prepared", "11 November 2026")]
    yy = y - 1.7
    for k, v in rows:
        t(ax, M + 0.2, yy, k.upper(), fs=6.6, color=GREY, weight="bold")
        t(ax, M + 4.4, yy, v, fs=9.2, color=SLATE)
        yy -= 1.0

    ax.add_patch(FancyBboxPatch((M + 0.2, 3.2), W - 2 * M - 0.4, 3.6,
                                boxstyle="round,pad=0.02,rounding_size=0.3",
                                fc=WASH, ec=LINE, lw=0.7))
    t(ax, M + 1.1, 5.9, "Blue is FIBA, orange is the NBA, grey is the reason why.",
      fs=8.4, color=NAVY, weight="bold")
    para(ax, M + 1.1, 4.8, 16.2,
         "Every plate carries its number in the gold badge at the top left, so a page can "
         "be matched to its sheet at a glance. The caption under each title states the "
         "one idea the diagram has to teach.", fs=8.2, lh=1.55)

    footer(ax)
    pdf.savefig(fig)
    plt.close(fig)


def contents(pdf, meta):
    fig, ax = page()
    t(ax, M, H - 2.2, "Contents", fs=23, color=NAVY, weight="bold")
    ax.plot([M, W - M], [H - 3.0, H - 3.0], lw=1.0, color=LINE)
    para(ax, M, H - 4.2, 17.6,
         "Thirty-eight plates in notebook order. The last column of each block is the "
         "notebook sheet on which the plate is pasted.", fs=8.4, color=GREY,
         style="italic")

    blocks = [(M, 1, 19), (M + 9.1, 20, 38)]
    for x0, first, last in blocks:
        w = 8.4
        y = H - 6.6
        t(ax, x0, y, "NO.", fs=6.2, color=NAVY, weight="bold")
        t(ax, x0 + 1.3, y, "PLATE", fs=6.2, color=NAVY, weight="bold")
        t(ax, x0 + w, y, "SHEET", fs=6.2, color=NAVY, weight="bold", ha="right")
        ax.plot([x0, x0 + w], [y - 0.5, y - 0.5], lw=0.8, color=NAVY)

        step = 0.98
        y -= 1.5
        for n in range(first, last + 1):
            if (n - first) % 2 == 1:
                ax.add_patch(plt.Rectangle((x0 - 0.3, y - 0.32), w + 0.6, step,
                                           fc=WASH, ec="none"))
            t(ax, x0, y, f"{n:02d}", fs=7.2, color=NAVY, weight="bold")
            t(ax, x0 + 1.3, y, meta[n][0], fs=7.2, color=SLATE)
            t(ax, x0 + w, y, str(SHEET[n]), fs=7.2, color=SLATE, ha="right")
            y -= step

    footer(ax)
    pdf.savefig(fig)
    plt.close(fig)


def plate_page(pdf, meta, n):
    title, sub = meta[n]
    fig, ax = page()
    t(ax, M, H - 1.8, f"PLATE {n:02d}", fs=8.6, color=GOLD, weight="bold")
    t(ax, M + 3.0, H - 1.8, f"\u2022   {SECTION[n].upper()}", fs=7.4, color=GREY,
      weight="bold")
    t(ax, W - M, H - 1.8, f"NOTEBOOK SHEET {SHEET[n]}", fs=7.4, color=GREY,
      weight="bold", ha="right")
    t(ax, M, H - 3.5, title, fs=15.5, color=NAVY, weight="bold")
    t(ax, M, H - 4.4, sub, fs=8.4, color=SLATE, style="italic")
    ax.plot([M, W - M], [H - 5.0, H - 5.0], lw=0.8, color=LINE)

    img = mpimg.imread(os.path.join(FIGS, f"plate{n:02d}.png"))
    h_px, w_px = img.shape[:2]
    iw = W - 2 * M
    ih = iw * h_px / w_px
    y0 = H - 5.4 - ih
    ax.imshow(img, extent=[M, M + iw, y0, y0 + ih], aspect="auto", zorder=2)

    # ---- revision band: viva question and short answer, then the spoken lines
    top = y0 - 1.2
    ax.plot([M, W - M], [top + 0.45, top + 0.45], lw=0.6, color=LINE)
    q, a = VIVA[n]

    t(ax, M, top - 0.6, "VIVA QUESTION", fs=5.8, color=GOLD, weight="bold")
    qend = para(ax, M, top - 2.0, 8.2, q, fs=7.6, color=NAVY, lh=1.5, weight="bold")
    t(ax, M, qend - 0.7, "SHORT ANSWER", fs=5.8, color=GOLD, weight="bold")
    para(ax, M, qend - 2.0, 8.2, a, fs=7.2, color=SLATE, lh=1.5)

    ax.plot([M + 8.7, M + 8.7], [top - 0.1, 2.6], lw=0.6, color=LINE)
    t(ax, M + 9.3, top - 0.6, "SAY THIS WHILE POINTING AT THE PLATE", fs=5.8,
      color=GOLD, weight="bold")
    yy = top - 2.0
    for i, line in enumerate(NOTES[n]):
        ax.add_patch(plt.Circle((M + 9.42, yy + 0.35), 0.08, fc=GOLD, ec="none"))
        yy = para(ax, M + 9.9, yy, 6.9, line, fs=7.2, color=SLATE, lh=1.5) - 0.9

    footer(ax)
    pdf.savefig(fig)
    plt.close(fig)
    return ih


def howto(pdf):
    fig, ax = page()
    t(ax, M, H - 2.2, "How to Print and Paste", fs=23, color=NAVY, weight="bold")
    ax.plot([M, W - M], [H - 3.0, H - 3.0], lw=1.0, color=LINE)
    para(ax, M, H - 4.2, 17.6,
         "Five steps, then a note on where the numbers come from.", fs=8.6,
         color=GREY, style="italic")

    steps = [
        ("01  PRINT", "Print the plates single-sided in colour and turn off \u2018fit to "
                      "page\u2019. The pages are already 21.7 \u00d7 28.8 cm, the size of "
                      "the assignment sheets, so no scaling is needed."),
        ("02  TRIM", "The caption band under each diagram repeats the plate number. Trim "
                     "to the band for a flush paste, or keep it so the number stays "
                     "visible."),
        ("03  MATCH", "Each plate names its notebook sheet: Plate 01 goes on sheet 05, "
                      "Plate 23 on sheet 29, and so on. The contents page lists all "
                      "thirty-eight."),
        ("04  PASTE", "Use a glue stick and press from the centre outwards so the drawing "
                      "does not crease. Leave the ruled area free where you still have "
                      "paragraphs to write."),
        ("05  REVISE", "Cover the question and the two spoken lines, name the plate, and "
                       "say the difference out loud. If you can do that for all "
                       "thirty-eight, you can answer the viva."),
    ]
    cols = [(M, 8.3, steps[:3]), (M + 9.4, 8.3, steps[3:])]
    for x0, w, group in cols:
        y = H - 6.4
        for head, body in group:
            t(ax, x0, y, head, fs=8.2, color=GOLD, weight="bold")
            y = para(ax, x0, y - 1.15, w, body, fs=8.4, lh=1.55) - 1.9

    ax.add_patch(FancyBboxPatch((M, 3.4), W - 2 * M, 5.6,
                                boxstyle="round,pad=0.02,rounding_size=0.3",
                                fc=WASH, ec=LINE, lw=0.7))
    t(ax, M + 1.0, 8.0, "A note on the numbers", fs=8.6, color=NAVY, weight="bold")
    para(ax, M + 1.0, 6.9, 16.4,
         "Court and equipment figures follow the FIBA rulebook and are converted from the "
         "imperial NBA figures at 1 ft = 0.3048 m, so 94 \u00d7 50 ft reads 28.65 \u00d7 "
         "15.24 m and a 3.05 m ring is exactly ten feet. Where the two rulebooks agree "
         "\u2014 ring height, shot clock, overtime length, five players a side \u2014 the "
         "plate says so instead of inventing a difference, because a viva will test exactly "
         "that point. Rules change, so check the current rulebook before a competition: the "
         "comparison here reflects the material published on 11 November 2026.",
         fs=8.0, lh=1.55)

    footer(ax)
    pdf.savefig(fig)
    plt.close(fig)


def main():
    meta = plates()
    with PdfPages(OUT, metadata={"Title": "CUUV102 Basketball Print & Paste Diagram Atlas",
                                 "Author": "CUUV102 Sports Assignment",
                                 "Subject": "38 plates: history, rules, India, FIBA vs NBA"}) as pdf:
        cover(pdf)
        contents(pdf, meta)
        for n in range(1, 39):
            ih = plate_page(pdf, meta, n)
            if ih > 19.4:
                print("warn", n, round(ih, 2))
        howto(pdf)
    print("wrote", OUT, os.path.getsize(OUT) // 1024, "KB")


if __name__ == "__main__":
    main()
