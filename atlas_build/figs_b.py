from toolkit import *
import numpy as np


# ==================================================== 07  Court layout
def fig07(path):
    p = Page(7, "Plate 07 \u2022 The playing court", "Basketball Court: Layout and Main Areas",
             "A 28 m \u00d7 15 m rectangle divided by a centre line")
    ax = p.ax

    cw = 62.0
    ch = cw * 15.0 / 28.0            # 33.2
    c = Court(ax, 19.0, 25.0, cw, ch, spec=FIBA, full=True, lw=0.85)
    c.halves(1, c2="#EDF4FA", c3="#FCF0E4", alpha3=1.0, alpha2=1.0)
    c.halves(-1, c2="#EDF4FA", c3="#FCF0E4", alpha3=1.0, alpha2=1.0)
    c.key_fill(1, alpha=0.9); c.key_fill(-1, alpha=0.9)
    c.draw(ends=(1, -1))

    def mark(n, d, y, s=1, lead=None):
        x, yy = c.pt(d, y, s)
        if lead is not None:
            lx, ly = c.pt(lead[0], lead[1], s)
            ax.plot([x, lx], [yy, ly], color=NAVY, lw=0.6, zorder=8)
        ax.add_patch(Circle((x, yy), 1.35, fc=NAVY, ec=WHITE, lw=0.8, zorder=9))
        txt(ax, x, yy - 0.05, str(n), fs=4.2, color=WHITE, weight="bold", z=10)

    mark(1, 17.0, 16.2, 1, lead=(17.0, 15.0))     # above the sideline
    mark(2, -1.6, 2.2, 1, lead=(0.0, 2.2))        # end line
    mark(3, 18.2, 13.4, 1, lead=(14.0, 13.4))     # centre line
    mark(4, 14.0, 7.5, 1)                         # centre circle
    mark(5, 7.35, 10.95, 1)                       # on the three-point arc
    mark(6, 5.8, 9.05, 1)                         # on the free-throw line
    mark(7, 3.5, 5.4, 1)                          # inside the key
    mark(8, -1.6, 7.5, 1, lead=(1.575, 7.5))      # ring
    mark(9, -1.6, 9.9, 1, lead=(1.2, 8.35))       # backboard
    mark(10, -1.6, 5.2, 1, lead=(2.3, 6.6))       # restricted area

    rows_l = [(1, "Sideline \u2014 the long boundary; standing on it is out of bounds"),
              (2, "End line \u2014 the short boundary behind each basket"),
              (3, "Centre line \u2014 divides the court into two halves"),
              (4, "Centre circle \u2014 where the opening jump ball is taken"),
              (5, "Three-point line \u2014 6.75 m arc; straight sections 6.60 m")]
    rows_r = [(6, "Free-throw line \u2014 5.80 m from the end line, 3.60 m long"),
              (7, "Free-throw lane (the key) \u2014 4.90 m wide"),
              (8, "Restricted area \u2014 no-charge semicircle, 1.25 m radius"),
              (9, "Backboard \u2014 1.80 m wide, set 1.20 m from the end line"),
              (10, "Basket ring \u2014 3.05 m above the floor, 45 cm across")]
    for col_x, rows in ((4.0, rows_l), (51.0, rows_r)):
        y = 20.4
        for n, label in rows:
            ax.add_patch(Circle((col_x + 1.0, y), 1.15, fc=NAVY, ec="none", zorder=6))
            txt(ax, col_x + 1.0, y - 0.05, str(n), fs=3.8, color=WHITE, weight="bold", z=7)
            txt(ax, col_x + 2.9, y, label, fs=4.7, color=SLATE, ha="left")
            y -= 2.8

    p.caption("Markings are part of the areas they bound; the NBA court is marginally longer and wider (see Plate 24).")
    p.save(path)


# ==================================================== 08  Dimensions
def fig08(path):
    p = Page(8, "Plate 08 \u2022 Dimensions", "Important Court Dimensions",
             "The measurements to memorise for a viva")
    ax = p.ax

    # ---------------- plan (half court, to scale)
    S = 2.25
    w, h = 14.0 * S, 15.0 * S          # 31.5 x 33.75
    x0, y0 = 4.0, 20.4
    c = Court(ax, x0, y0, w, h, spec=FIBA, full=False, lw=0.85)
    c.halves(1, c2="#DDEBF7", alpha3=0.55, alpha2=0.95)
    c.key_fill(1, alpha=0.85)
    c.draw(ends=(1,))
    ax.plot([c.X(14.0, 1)] * 2, [c.Y(0), c.Y(15)], color=SLATE, lw=0.85,
            ls=(0, (4, 2.4)), zorder=4)
    txt(ax, c.X(14.0, 1) + 0.8, c.Y(1.4), "half-way\nline", fs=4.0, color=GREY,
        ha="left", lh=1.2)

    arrow(ax, c.pt(1.575, 7.5), c.pt(1.9 + 4.9, 7.5 + 4.0), color=ORANGE_D, lw=0.85,
          mut=6, style="<|-|>")
    txt(ax, c.X(8.4, 1), c.Y(13.1), "R 6.75 m", fs=5.0, color=ORANGE_D, weight="bold")
    dim_h(ax, c.X(0, 1), c.X(6.6, 1), c.Y(0) - 2.6, "6.60 m", color=ORANGE_D, fs=4.8,
          offset=-1.6)
    dim_h(ax, c.X(0, 1), c.X(5.8, 1), c.Y(15) + 2.2, "5.80 m", color=BLUE_D, fs=4.8,
          offset=1.4)
    dim_v(ax, c.Y(5.05), c.Y(9.95), c.X(5.8, 1) + 3.6, "4.90 m", color=BLUE_D, fs=4.8,
          offset=1.2)
    dim_v(ax, c.Y(5.7), c.Y(9.3), c.X(5.8, 1) + 1.6, "3.60 m", color=BLUE_D, fs=4.2,
          offset=1.0)
    txt(ax, c.X(7.0, 1), c.Y(15) + 5.2, "half court, drawn to scale", fs=4.6,
        color=GREY, style="italic")

    # ---------------- side elevation, to scale
    E = 3.3
    fx, fy = 52.0, 12.0
    ax.plot([fx - 1.0, fx + 18.0], [fy, fy], color=INK, lw=1.5, zorder=4)
    txt(ax, fx + 17.6, fy + 1.2, "floor", fs=4.0, color=GREY, ha="right")
    bb_x = fx + 2.4
    ax.plot([bb_x, bb_x], [fy + 2.90 * E, fy + 3.95 * E], color=INK, lw=2.4, zorder=5,
            solid_capstyle="butt")
    ax.plot([bb_x, bb_x + 0.45], [fy + 3.05 * E] * 2, color=ORANGE_D, lw=1.6, zorder=6)
    ax.add_patch(Circle((bb_x + 0.45, fy + 3.05 * E), 0.22 * E, fc="none", ec=ORANGE_D,
                        lw=1.0, zorder=6))
    for k in range(5):
        xx = bb_x + 0.34 + 0.035 * k
        ax.plot([xx, xx + 0.03], [fy + 2.98 * E, fy + 2.48 * E], color=MIST, lw=0.5,
                zorder=5)
    ax.plot([bb_x + 0.32, bb_x + 0.62], [fy + 2.48 * E] * 2, color=MIST, lw=0.6, zorder=5)
    dashed(ax, [(bb_x + 0.45, fy + 3.05 * E), (bb_x + 8.2, fy + 3.05 * E)],
           color=LINE, lw=0.6)
    dim_v(ax, fy, fy + 3.05 * E, bb_x + 8.2, "3.05 m", color=BLUE_D, fs=5.0, offset=1.3)
    dim_v(ax, fy + 2.90 * E, fy + 3.95 * E, bb_x - 1.3, "1.05 m", color=SLATE, fs=4.2,
          offset=-1.2)
    dim_h(ax, bb_x - 0.6, bb_x + 0.6, fy - 1.8, "1.80 m", color=SLATE, fs=4.2,
          offset=-1.5)

    txt(ax, fx + 12.0, fy + 3.9 * E, "SECTION THROUGH A BASKET", fs=5.0, color=NAVY,
        weight="bold", ha="left")
    for i, line in enumerate(["ring 45 cm across; the ball must",
                              "enter it from above to score",
                              "backboard 1.20 m from the end line",
                              "ring 15 cm above the board's base"]):
        ax.add_patch(Circle((fx + 12.2, fy + 3.2 * E - i * 2.6), 0.3, fc=GOLD,
                            ec="none", zorder=6))
        txt(ax, fx + 13.1, fy + 3.2 * E - i * 2.6, line, fs=4.4, color=SLATE, ha="left")

    # ---------------- key numbers
    keys = [("28 \u00d7 15 m", "court"), ("3.05 m", "ring height"),
            ("6.75 m", "three-point arc"), ("4.90 m", "key width")]
    bx = 40.0
    for val, lab in keys:
        rbox(ax, bx, 49.6, 13.8, 7.0, fc=WASH, ec=LINE, lw=0.7, r=0.8)
        txt(ax, bx + 6.9, 54.0, val, fs=6.6, color=NAVY, weight="bold")
        txt(ax, bx + 6.9, 51.5, lab, fs=4.3, color=GREY)
        bx += 14.4

    rbox(ax, 40.0, 41.4, 56.4, 5.2, fc=PALE_Y, ec=GOLD, lw=0.6, r=0.7)
    txt(ax, 42.0, 44.0,
        "Viva shortcut: 28 \u00d7 15 court \u2022 3.05 basket \u2022 6.75 arc \u2022 5.80 free throw",
        fs=4.8, color=NAVY, weight="bold", ha="left")

    p.caption("Dimensions are measured to the inside edge of the lines; FIBA Official Basketball Rules 2026.")
    p.save(path)


# ==================================================== 09  Equipment
def fig09(path):
    p = Page(9, "Plate 09 \u2022 Equipment and kit", "Equipment and Player Kit",
             "What the game is played with \u2014 and what a player may wear")
    ax = p.ax

    section(ax, 3.0, 59.4, 44.0, "the equipment", color=NAVY)
    section(ax, 55.0, 59.4, 42.0, "the player's kit", color=NAVY)

    # ---- ball
    basketball_side(ax, 16.0, 46.2, 7.2, lw=1.0)
    txt(ax, 16.0, 36.4, "SIZE 7 BALL", fs=6.2, color=NAVY, weight="bold")
    txt(ax, 16.0, 34.0, "circumference 749\u2013780 mm", fs=4.7, color=SLATE)
    txt(ax, 16.0, 31.8, "mass 567\u2013650 g  \u2022  inflated to spec", fs=4.7, color=SLATE)
    txt(ax, 16.0, 29.4, "one ball, two baskets, one clock", fs=4.6, color=GREY,
        style="italic")

    # ---- backboard + ring front view
    bx, by = 34.0, 36.4
    ax.add_patch(Rectangle((bx, by), 12.6, 7.6, fc="#F3F8FD", ec=INK, lw=1.3, zorder=4))
    ax.add_patch(Rectangle((bx + 4.0, by + 1.7), 4.6, 3.5, fc="none", ec=ORANGE_D,
                           lw=0.9, zorder=5))
    ax.add_patch(Circle((bx + 6.3, by + 1.5), 1.35, fc="none", ec=ORANGE_D, lw=1.2,
                        zorder=6))
    for k in range(8):
        ax.plot([bx + 5.0 + 0.32 * k, bx + 5.5 + 0.2 * k], [by + 1.3, by + 0.2],
                color=MIST, lw=0.45, zorder=5)
    ax.plot([bx + 4.9, bx + 7.7], [by + 0.2, by + 0.2], color=MIST, lw=0.6, zorder=5)
    dim_h(ax, bx, bx + 12.6, by + 8.8, "1.80 m", color=BLUE_D, fs=4.6, offset=1.2)
    dim_v(ax, by, by + 7.6, bx - 1.6, "1.05 m", color=BLUE_D, fs=4.6, offset=-1.0)
    txt(ax, bx + 6.3, by - 1.6, "backboard, ring and net", fs=4.6, color=NAVY,
        weight="bold")
    txt(ax, bx + 6.3, by - 3.4, "ring 45 cm \u2022 15 cm above the board's lower edge",
        fs=4.3, color=GREY)

    # ---- checklist
    items = [("Match jersey and shorts", "same colour, legal numbers", BLUE),
             ("Non-marking court shoes", "safety of the surface", GREEN),
             ("No jewellery, watches or caps", "removed before play", RED),
             ("No hard or dangerous objects", "in hair or kit", RED),
             ("Knee/ankle support", "soft, padded, approved", ORANGE),
             ("Team colours", "home and away kit", PURPLE)]
    y = 54.0
    for head, sub, col in items:
        ax.add_patch(Circle((56.6, y + 1.6), 1.15, fc=PALE_G, ec=GREEN, lw=0.6, zorder=5))
        ax.plot([56.2, 56.6, 57.4], [y + 1.65, y + 1.05, y + 2.2], color=GREEN,
                lw=1.0, zorder=6, solid_capstyle="round")
        txt(ax, 59.0, y + 2.3, head, fs=5.4, color=NAVY, weight="bold", ha="left")
        txt(ax, 59.0, y + 0.6, sub, fs=4.5, color=GREY, ha="left")
        y -= 5.6

    # ---- officials' equipment
    rbox(ax, 55.0, 7.4, 42.0, 15.0, fc=WASH, ec=LINE, lw=0.7, r=0.9)
    txt(ax, 57.2, 19.8, "COURT AND TABLE EQUIPMENT", fs=5.2, color=NAVY, weight="bold",
        ha="left")
    gear = [("Scoreboard", "score, period, team fouls"),
            ("Game clock", "counts down each period"),
            ("Shot clock", "24 s, with 14 s resets"),
            ("Scoresheet", "line-ups, fouls, result")]
    yy = 17.8
    for head, sub in gear:
        ax.add_patch(Rectangle((57.0, yy - 0.55), 1.3, 1.3, fc=BLUE, ec="none", zorder=5))
        txt(ax, 59.6, yy + 0.1, head, fs=5.0, color=SLATE, weight="bold", ha="left")
        txt(ax, 71.0, yy + 0.1, sub, fs=4.5, color=GREY, ha="left")
        yy -= 2.7

    # ---- ball pressure/handling note
    rbox(ax, 3.0, 7.4, 48.0, 15.0, fc=PALE_B, ec=BLUE, lw=0.7, r=0.9)
    txt(ax, 5.2, 19.8, "WHY THE EQUIPMENT MATTERS", fs=5.2, color=BLUE_D, weight="bold",
        ha="left")
    txt(ax, 5.4, 16.2,
        "A ball at the correct pressure bounces predictably, so passing\n"
        "and shooting can be taught and judged fairly. A correctly mounted\n"
        "ring protects players and makes rebounds off the rim consistent.\n"
        "Correct kit prevents injury and keeps the game safe to officiate.",
        fs=4.7, color=SLATE, ha="left", lh=1.55)

    p.caption("Equipment specifications follow FIBA Official Basketball Rules 2026 and standard competition practice.")
    p.save(path)


# ==================================================== 10  Team & roles
def fig10(path):
    p = Page(10, "Plate 10 \u2022 Team composition", "Team Composition and Player Roles",
             "Five on the floor, up to twelve on the team sheet")
    ax = p.ax

    # ---------- half court with the starting five
    ch = 34.0
    cw = ch * 14.0 / 15.0
    c = Court(ax, 4.0, 20.4, cw, ch, spec=FIBA, full=False, fc="#FBFDFF", lw=0.75)
    c.halves(1, c2="#DDEBF7", alpha3=0.5, alpha2=0.95)
    c.key_fill(1, alpha=0.8)
    c.draw(ends=(1,), lw=0.75)

    pos = [(9.9, 7.5, "PG", BLUE), (9.6, 12.6, "SG", ORANGE),
           (9.6, 2.4, "SF", GREEN), (5.4, 10.9, "PF", PURPLE),
           (5.4, 4.1, "C", RED)]
    for d, y, tag, col in pos:
        x, yy = c.pt(d, y, 1)
        player(ax, x, yy, tag, fc=col, r=1.9, fs=4.6)

    txt(ax, c.x0 + cw / 2, 17.6, "A classic starting five in a half-court set",
        fs=4.8, color=GREY, style="italic")
    txt(ax, c.x0 + cw / 2, 51.2, "HALF COURT \u2014 ATTACKING THE BASKET AT THE LEFT",
        fs=4.4, color=SWATCH if False else MIST, weight="bold")

    # ---------- roles
    section(ax, 44.0, 59.4, 53.0, "roles on the floor", color=NAVY)
    roles = [("PG", "Point guard", "runs the offence, controls tempo, starts plays", BLUE),
             ("SG", "Shooting guard", "outside scoring and perimeter defence", ORANGE),
             ("SF", "Small forward", "versatile wing: drive, shoot, defend", GREEN),
             ("PF", "Power forward", "inside scoring, screens, rebounding", PURPLE),
             ("C", "Centre", "rim protection, post play, rebounding", RED)]
    y = 53.0
    for tag, name, job, col in roles:
        player(ax, 46.6, y + 1.6, tag, fc=col, r=1.75, fs=4.2)
        txt(ax, 49.8, y + 2.3, name, fs=5.6, color=NAVY, weight="bold", ha="left")
        txt(ax, 49.8, y + 0.6, job, fs=4.6, color=SLATE, ha="left")
        y -= 5.5

    # ---------- team sheet
    rbox(ax, 44.0, 7.2, 53.0, 18.6, fc=WASH, ec=LINE, lw=0.7, r=0.9)
    txt(ax, 46.2, 23.4, "ON THE TEAM SHEET", fs=5.2, color=NAVY, weight="bold", ha="left")
    facts = [("12", "players may be listed and used in a game"),
             ("5", "players from each team on the court"),
             ("1", "head coach, with assistant coaches allowed"),
             ("any", "number of substitutions from the bench area")]
    yy = 19.6
    for val, lab in facts:
        txt(ax, 48.4, yy, val, fs=6.6, color=GOLD, weight="bold")
        txt(ax, 53.0, yy, lab, fs=4.8, color=SLATE, ha="left")
        yy -= 3.6

    p.caption("Numbers 1 to 5 are positional labels, not fixed jobs \u2014 modern teams share these duties.")
    p.save(path)


# ==================================================== 11  Playing time
def fig11(path):
    p = Page(11, "Plate 11 \u2022 Timing", "Playing Time and Scoring",
             "Four periods of ten minutes under FIBA rules")
    ax = p.ax

    # ---------- period bar
    bx, bw, by, bh = 3.0, 74.0, 42.4, 10.6
    segs = [("Q1", 10, BLUE), ("Q2", 10, BLUE_D), ("HALF-TIME", 0, GREY),
            ("Q3", 10, BLUE_D), ("Q4", 10, BLUE)]
    weights = [10, 10, 6.5, 10, 10]
    tot = sum(weights)
    x = bx
    for (label, mins, col), wt in zip(segs, weights):
        w = bw * wt / tot
        fc = "#E9EEF4" if mins == 0 else col
        ax.add_patch(Rectangle((x, by), w, bh, fc=fc, ec=WHITE, lw=1.2, zorder=4))
        txt(ax, x + w / 2, by + bh / 2 + (1.2 if mins == 0 else 1.0),
            label, fs=7.2 if mins else 5.4, color=NAVY if mins == 0 else WHITE,
            weight="bold", z=6)
        if mins == 0:
            txt(ax, x + w / 2, by + bh / 2 - 2.0, "15 min break", fs=4.4,
                color=SLATE, z=6)
        else:
            txt(ax, x + w / 2, by + bh / 2 - 2.1, f"{mins} min", fs=4.9,
                color="#D6E4F2", z=6)
        x += w
    dim_h(ax, bx, bx + bw * 26.5 / tot, by + bh + 2.8, "first half", color=NAVY,
          fs=5.0, offset=1.4)
    dim_h(ax, bx + bw * 33 / tot, bx + bw, by + bh + 2.8, "second half", color=NAVY,
          fs=5.0, offset=1.4)
    txt(ax, bx + bw / 2, by - 2.4,
        "40 minutes of playing time \u2014 the clock stops for fouls, time-outs and stoppages",
        fs=4.9, color=SLATE, style="italic")

    # ---------- overtime
    rbox(ax, 3.0, 26.0, 34.0, 10.6, fc=PALE_Y, ec=GOLD, lw=0.7, r=0.8)
    txt(ax, 5.2, 34.2, "IF THE SCORE IS TIED", fs=4.9, color=NAVY, weight="bold",
        ha="left")
    txt(ax, 5.2, 30.6, "5 extra minutes, repeated as needed,\nafter a 2-minute break.",
        fs=4.7, color=SLATE, ha="left", lh=1.4)
    txt(ax, 5.2, 27.6, "Teams keep the same basket as in Q4.", fs=4.7, color=SLATE,
        ha="left")

    # ---------- shot clock
    cx, cy, r = 52.0, 31.4, 8.2
    ax.add_patch(Circle((cx, cy), r, fc=WHITE, ec=LINE, lw=0.8, zorder=4))
    ax.add_patch(Wedge((cx, cy), r - 1.0, 90, -180, width=1.7, fc=ORANGE, ec="none",
                       zorder=5, alpha=0.92))
    ax.add_patch(Wedge((cx, cy), r - 1.0, -180, -270, width=1.7, fc=PALE_O, ec="none",
                       zorder=5))
    txt(ax, cx, cy + 1.0, "24", fs=14.0, color=NAVY, weight="bold", z=7)
    txt(ax, cx, cy - 2.6, "seconds", fs=4.4, color=GREY, z=7)
    txt(ax, cx, cy - r - 2.8, "SHOT CLOCK", fs=5.2, color=ORANGE_D, weight="bold")
    txt(ax, cx, cy - r - 5.2, "a shot must leave the hand\nbefore it reaches zero",
        fs=4.4, color=SLATE, lh=1.3)

    # ---------- 14 s resets
    rbox(ax, 71.0, 23.4, 26.0, 15.2, fc=WASH, ec=LINE, lw=0.7, r=0.9)
    txt(ax, 73.0, 36.2, "RESETS TO 14 s WHEN", fs=4.8, color=NAVY, weight="bold",
        ha="left")
    for i, line in enumerate(["the defence gains control",
                              "a foul stops play in the",
                              "frontcourt",
                              "the ball is awarded in the",
                              "frontcourt after a stoppage"]):
        txt(ax, 73.0, 33.2 - i * 2.1, line, fs=4.4, color=SLATE, ha="left")

    # ---------- scoring
    section(ax, 3.0, 20.2, 94.0, "how the score is built", color=NAVY)
    rows = [("Free throw", "1 point", "after a foul on a shooter", GREEN, PALE_G),
            ("Field goal inside the arc", "2 points", "the standard basket", ORANGE, PALE_O),
            ("Field goal beyond the arc", "3 points", "long-range shooting", BLUE, PALE_B)]
    y = 14.6
    for name, val, note, col, wash in rows:
        rbox(ax, 3.0, y, 94.0, 3.0, fc=wash, ec="none", r=0.5)
        txt(ax, 5.2, y + 1.5, name, fs=4.9, color=NAVY, weight="bold", ha="left")
        txt(ax, 42.0, y + 1.5, val, fs=4.9, color=col, weight="bold", ha="left")
        txt(ax, 58.0, y + 1.5, note, fs=4.6, color=SLATE, ha="left")
        y -= 3.3

    p.caption("A FIBA game is 4 \u00d7 10 minutes; the NBA plays 4 \u00d7 12 (Plate 25). A field goal counts only if the ball drops through the basket from above.")
    p.save(path)


# ==================================================== 12  Starting / restarting
def fig12(path):
    p = Page(12, "Plate 12 \u2022 Starting and restarting", "How Play Starts and Restarts",
             "Jump ball, throw-ins and the alternating-possession arrow")
    ax = p.ax

    # ---------- opening jump ball
    cx, cy, r = 21.0, 52.8, 6.4
    ax.add_patch(Circle((cx, cy), r, fc="#F7FBFE", ec=SLATE, lw=0.8, zorder=3))
    ax.plot([cx - r - 2.6, cx + r + 2.6], [cy, cy], color=SLATE, lw=0.8, zorder=3)
    ax.plot([cx, cx], [cy - r - 2.6, cy + r + 2.6], color=SLATE, lw=0.8, zorder=3)
    ball(ax, cx, cy, r=1.6)
    player(ax, cx - 3.4, cy - 1.7, "A", fc=BLUE, r=1.7, fs=5.8)
    player(ax, cx + 3.4, cy + 1.7, "B", fc=ORANGE, r=1.7, fs=5.8)
    arrow(ax, (cx - 2.3, cy + 1.5), (cx + 1.5, cy + 2.9), color=BLUE, lw=1.0, mut=8,
          rad=-0.3)
    arrow(ax, (cx + 2.5, cy - 1.3), (cx - 1.1, cy - 2.9), color=ORANGE, lw=1.0, mut=8,
          rad=-0.3)
    txt(ax, cx, cy - r - 3.0, "OPENING JUMP BALL", fs=5.6, color=NAVY, weight="bold")
    txt(ax, cx, cy - r - 5.2, "the referee tosses the ball between two\nopponents in the centre circle",
        fs=4.5, color=SLATE, lh=1.3)

    # ---------- possession arrow
    apx, apy = 50.0, 51.4
    ax.add_patch(Rectangle((apx - 1.5, apy - 4.4), 3.0, 8.8, fc="#E9EEF4", ec=SLATE,
                           lw=0.8, zorder=4))
    ax.add_patch(Polygon([(apx - 1.1, apy + 1.7), (apx + 1.1, apy + 1.7),
                          (apx, apy + 3.8)], closed=True, fc=RED, ec="none", zorder=6))
    ax.add_patch(Polygon([(apx - 1.1, apy - 1.7), (apx + 1.1, apy - 1.7),
                          (apx, apy - 3.8)], closed=True, fc=PALE_R, ec=RED, lw=0.6,
                         zorder=6))
    txt(ax, apx, apy + 6.1, "POSSESSION ARROW", fs=4.9, color=RED, weight="bold")
    for i, line in enumerate(["the table points the arrow toward",
                              "the team that takes the next",
                              "alternating throw-in; it flips",
                              "each time that throw-in is used"]):
        txt(ax, apx + 4.4, apy + 2.4 - i * 2.5, line, fs=4.5, color=SLATE, ha="left")

    # ---------- held ball: FIBA vs NBA
    rbox(ax, 3.0, 28.0, 94.0, 11.2, fc=PALE_Y, ec=GOLD, lw=0.7, r=0.9)
    txt(ax, 5.4, 36.8, "AT A HELD BALL \u2014 TWO PLAYERS GRIPPING THE BALL", fs=5.1,
        color=NAVY, weight="bold", ha="left")
    txt(ax, 5.4, 33.0, "FIBA", fs=5.0, color=BLUE, weight="bold", ha="left")
    txt(ax, 15.0, 33.0, "a throw-in, awarded by the alternating-possession arrow",
        fs=4.7, color=SLATE, ha="left")
    txt(ax, 5.4, 29.9, "NBA", fs=5.0, color=ORANGE, weight="bold", ha="left")
    txt(ax, 15.0, 29.9, "a jump ball between the two players at the nearest circle",
        fs=4.7, color=SLATE, ha="left")

    # ---------- restart flow
    section(ax, 3.0, 25.2, 94.0, "how play restarts", color=NAVY)
    flows = [("Ball goes out of bounds", "throw-in from the nearest point\noutside the line", BLUE),
             ("Basket scored", "throw-in from behind the end line\nby the conceding team", GREEN),
             ("Violation", "throw-in from the sideline nearest\nthe infringement", ORANGE),
             ("Foul", "free throws, or a throw-in if the\nfoul is not a shooting foul", RED)]
    x = 3.0
    for head, body, col in flows:
        rbox(ax, x, 13.2, 22.2, 9.0, fc=WHITE, ec=col, lw=0.7, r=0.8)
        txt(ax, x + 11.1, 19.9, head, fs=5.2, color=col, weight="bold")
        txt(ax, x + 11.1, 16.5, body, fs=4.4, color=SLATE, lh=1.35)
        x += 23.4

    # ---------- throw-in rules
    rbox(ax, 3.0, 7.0, 94.0, 5.6, fc=WASH, ec=LINE, lw=0.7, r=0.8)
    txt(ax, 5.2, 11.2, "THROW-IN RULES", fs=4.9, color=NAVY, weight="bold", ha="left")
    txt(ax, 5.2, 8.8,
        "5 seconds to release the ball  \u2022  the thrower must not step on the line  \u2022  a throw-in straight into the basket does not count",
        fs=4.6, color=SLATE, ha="left")

    p.caption("FIBA uses an alternating-possession arrow where the NBA still uses a jump ball.")
    p.save(path)


if __name__ == "__main__":
    import sys, os
    out = sys.argv[1] if len(sys.argv) > 1 else "figs"
    os.makedirs(out, exist_ok=True)
    for i, f in zip(range(7, 13), [fig07, fig08, fig09, fig10, fig11, fig12]):
        f(f"{out}/plate{i:02d}.png")
        print("ok", i)
