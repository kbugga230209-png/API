"""
Plates 23-30 of the CUUV102 Basketball Diagram Atlas.
23 Two rule systems   24 The court   25 Game duration   26 Shared timing limits
27 Possession   28 Personal foul limits   29 Time-outs   30 Defensive three-second
"""
import numpy as np
from toolkit import *          # noqa: F401,F403
from matplotlib.patches import Circle, Rectangle, Polygon, Wedge


# ---------------------------------------------------------------- helpers
def vs_row(ax, x, y, w, label, fiba, nba, fs=4.2, lw=0.6):
    """One comparison row: label on the left, FIBA value, NBA value."""
    txt(ax, x, y, label, fs=fs, color=SLATE, ha="left")
    txt(ax, x + w * 0.52, y, fiba, fs=fs, color=BLUE, weight="bold", ha="left")
    txt(ax, x + w * 0.80, y, nba, fs=fs, color=ORANGE_D, weight="bold", ha="left")


def col_head(ax, x, y, w, fiba_x, nba_x, fs=4.3):
    txt(ax, fiba_x, y, "FIBA", fs=fs, color=BLUE, weight="bold", ha="left")
    txt(ax, nba_x, y, "NBA", fs=fs, color=ORANGE_D, weight="bold", ha="left")


# ==================================================== 23  Two rule systems
def fig23(path):
    p = Page(23, "Plate 23 \u2022 FIBA vs NBA", "Two Rule Systems",
             "One game, two rulebooks \u2014 and a clear job for each")
    ax = p.ax

    # ---------- centre statement
    ax.add_patch(Polygon([(46.0, 54.0), (54.0, 54.0), (54.0, 45.6), (46.0, 45.6)],
                         closed=True, fc=NAVY, ec="none", zorder=4))
    txt(ax, 50.0, 51.4, "SAME GAME", fs=5.4, color=WHITE, weight="bold", z=6)
    txt(ax, 50.0, 48.0, "two rulebooks", fs=4.4, color=GOLD, z=6)

    # ---------- FIBA card
    rbox(ax, 3.0, 31.2, 40.0, 25.0, fc="#F7FAFD", ec=BLUE, lw=0.8, r=0.9)
    chip(ax, 5.0, 52.2, 20.0, 3.4, "FIBA", BLUE, fs=6.0, r=0.7)
    txt(ax, 27.0, 53.9, "the world rulebook", fs=4.3, color=BLUE_D, ha="left")
    fiba = ["212 national federations play to it",
            "one rulebook for every competition",
            "referees control the game on court",
            "4 \u00d7 10 minutes of play",
            "5 personal fouls and a player is out",
            "the 3-point line is 6.75 m from the ring"]
    for i, line in enumerate(fiba):
        ax.add_patch(Circle((5.6, 48.6 - i * 2.7), 0.32, fc=BLUE, ec="none", zorder=6))
        txt(ax, 6.9, 48.6 - i * 2.7, line, fs=4.1, color=SLATE, ha="left")

    # ---------- NBA card
    rbox(ax, 57.0, 31.2, 40.0, 25.0, fc="#FDF8F3", ec=ORANGE, lw=0.8, r=0.9)
    chip(ax, 59.0, 52.2, 20.0, 3.4, "NBA", ORANGE, fs=6.0, r=0.7)
    txt(ax, 81.0, 53.9, "the league rulebook", fs=4.3, color=ORANGE_D, ha="left")
    nba = ["30 clubs in one league, one country",
           "its own rulebook, revised each season",
           "instant replay supports the referees",
           "4 \u00d7 12 minutes of play",
           "6 personal fouls and a player is out",
           "the 3-point line is 7.24 m from the ring"]
    for i, line in enumerate(nba):
        ax.add_patch(Circle((59.6, 48.6 - i * 2.7), 0.32, fc=ORANGE, ec="none", zorder=6))
        txt(ax, 60.9, 48.6 - i * 2.7, line, fs=4.1, color=SLATE, ha="left")

    # links from the centre statement outwards
    arrow(ax, (45.4, 49.8), (43.4, 49.8), color=NAVY, lw=1.0, mut=7)
    arrow(ax, (54.6, 49.8), (56.6, 49.8), color=NAVY, lw=1.0, mut=7)

    # ---------- why it matters
    section(ax, 3.0, 27.4, 94.0, "why the differences exist", color=NAVY)
    reasons = [("Scope", "FIBA writes for 212 federations; the NBA writes for 30 clubs", BLUE),
               ("Product", "the NBA sells a longer, stoppier game to a paying arena", ORANGE),
               ("Style", "FIBA protects flow; the NBA protects the individual contest", GREEN)]
    x = 3.0
    for head, body, col in reasons:
        rbox(ax, x, 15.6, 30.4, 8.6, fc=WHITE, ec=LINE, lw=0.6, r=0.7)
        ax.add_patch(Rectangle((x + 0.2, 16.2), 0.7, 7.4, fc=col, ec="none", zorder=4))
        txt(ax, x + 2.8, 21.6, head, fs=4.7, color=col, weight="bold", ha="left")
        txt(ax, x + 2.8, 18.4, body, fs=3.8, color=SLATE, ha="left", lh=1.35)
        x += 31.9

    # ---------- how to read the section
    section(ax, 3.0, 12.8, 94.0, "how every plate in this section is laid out", color=NAVY)
    guide = [("Blue means FIBA", "the world rule, from the FIBA Official Rules 2026", BLUE),
             ("Orange means NBA", "the league rule, from the NBA rulebook", ORANGE),
             ("Grey means the reason", "the effect on play, coaching or the exam answer", GREY)]
    x = 3.0
    for head, body, col in guide:
        ax.add_patch(Circle((x + 1.4, 9.6), 0.7, fc=col, ec="none", zorder=5))
        txt(ax, x + 3.0, 10.1, head, fs=4.5, color=col, weight="bold", ha="left")
        txt(ax, x + 3.0, 8.3, body, fs=3.7, color=SLATE, ha="left")
        x += 31.5

    p.caption("A student answers in FIBA terms first, then shows what the NBA changed and why.")
    p.save(path)


# ==================================================== 24  The court
def fig24(path):
    p = Page(24, "Plate 24 \u2022 FIBA vs NBA", "The Court",
             "The same shape, drawn to a different size")
    ax = p.ax

    section(ax, 3.0, 57.0, 44.0, "half court, both markings to scale", color=NAVY)
    ch = 26.4
    cw = ch * 14.0 / 15.0
    x0c, y0c = 3.4, 29.0
    c = Court(ax, x0c, y0c, cw, ch, spec=FIBA, full=False, fc="#FBFDFF", lw=0.7)
    c.halves(1, c2="#EAF2F9", alpha3=0.26, alpha2=1.0)
    c.draw(ends=(1,), lw=0.7)

    # NBA three-point line and key, overlaid
    c2 = Court(ax, x0c, y0c, cw, ch, spec=NBA, full=False, fc="none", ec=SLATE,
               lw=0.85, z=3)
    c2.three(1)
    c2.key(1)

    # legend in the empty top-right of the half court
    for i, (lab, col, dashed_) in enumerate([("FIBA", BLUE, False),
                                             ("NBA", ORANGE, True)]):
        yy = 52.6 - i * 2.6
        ax.plot([31.4, 35.8], [yy, yy], color=col, lw=1.2,
                ls=(0, (3, 2)) if dashed_ else "solid", zorder=6)
        txt(ax, 36.8, yy, lab, fs=3.9, color=col, weight="bold", ha="left")

    txt(ax, 31.4, 45.6, "FIBA arc\n6.75 m", fs=4.0, color=BLUE_D, weight="bold",
        ha="left", lh=1.4)
    txt(ax, 31.4, 39.2, "NBA arc\n7.24 m", fs=4.0, color=ORANGE_D, weight="bold",
        ha="left", lh=1.4)
    txt(ax, 31.4, 34.4, "key 4.90 m FIBA,\n4.88 m NBA", fs=3.7, color=SLATE,
        ha="left", lh=1.45)

    # ---------- the extra arc, at scale
    section(ax, 3.0, 22.6, 44.0, "the extra half-metre, at scale", color=NAVY)
    bx, sp_ = 15.4, 3.3
    bars = [("FIBA arc", 6.75, BLUE), ("NBA arc", 7.24, ORANGE),
            ("FIBA corner", 6.60, BLUE_D), ("NBA corner", 6.70, ORANGE_D)]
    for i, (lab, val, col) in enumerate(bars):
        yy = 18.8 - i * 3.5
        box(ax, bx, yy - 1.0, val * sp_, 2.0, fc=col, ec="none", z=4)
        txt(ax, bx - 1.2, yy, lab, fs=3.8, color=col, weight="bold", ha="right")
        txt(ax, bx + val * sp_ + 1.0, yy, f"{val:.2f} m", fs=3.8, color=col,
            weight="bold", ha="left")
    txt(ax, 3.0, 17.6, "0.49 m\nfurther out\nat the top", fs=3.6, color=GREY,
        ha="left", lh=1.5)
    txt(ax, 3.0, 10.4, "0.10 m\nfurther out\nin the corner", fs=3.6, color=GREY,
        ha="left", lh=1.5)

    # ---------- the numbers
    section(ax, 52.0, 57.0, 45.0, "the measurements", color=NAVY)
    col_head(ax, 52.0, 53.4, 45.0, 71.0, 85.0)
    rows = [("Court length", "28.00 m", "28.65 m"),
            ("Court width", "15.00 m", "15.24 m"),
            ("3-pt arc", "6.75 m", "7.24 m"),
            ("3-pt corner", "6.60 m", "6.70 m"),
            ("Key width", "4.90 m", "4.88 m"),
            ("Free-throw line", "5.80 m", "5.79 m"),
            ("Restricted arc", "1.25 m", "1.22 m")]
    y = 50.8
    for i, (lab, f_, n_) in enumerate(rows):
        if i % 2 == 0:
            box(ax, 52.0, y - 1.2, 45.0, 2.4, fc=WASH, ec="none", z=2)
        txt(ax, 53.0, y, lab, fs=4.0, color=SLATE, ha="left")
        txt(ax, 71.0, y, f_, fs=4.0, color=BLUE, weight="bold", ha="left")
        txt(ax, 85.0, y, n_, fs=4.0, color=ORANGE_D, weight="bold", ha="left")
        y -= 2.4

    section(ax, 52.0, 33.4, 45.0, "identical in both codes", color=GREEN)
    same = ["Ring height 3.05 m \u2014 ten feet above the floor",
            "Free-throw line 5.80 m from the end line, 3.60 m long",
            "Backboard 1.80 m wide, 1.05 m high, 1.20 m out",
            "Centre circle radius 1.80 m; ring 45 cm in diameter"]
    for i, line in enumerate(same):
        ax.add_patch(Circle((53.2, 30.2 - i * 2.6), 0.28, fc=GREEN, ec="none",
                            zorder=6))
        txt(ax, 54.6, 30.2 - i * 2.6, line, fs=3.8, color=SLATE, ha="left")

    rbox(ax, 52.0, 13.0, 45.0, 5.6, fc=PALE_Y, ec=GOLD, lw=0.6, r=0.6)
    txt(ax, 54.0, 17.0, "The metres look small; the arc does not.", fs=4.2,
        color=NAVY, weight="bold", ha="left")
    txt(ax, 54.0, 14.8, "Half a metre more arc is a longer close-out for every defender.",
        fs=3.9, color=NAVY, ha="left")

    p.caption("Draw the FIBA court to scale first: every later comparison then has a reference.")
    p.save(path)


# ==================================================== 25  Game duration
def fig25(path):
    p = Page(25, "Plate 25 \u2022 FIBA vs NBA", "Game Duration",
             "Four quarters each \u2014 but not the same four")
    ax = p.ax

    # ---------- timeline
    section(ax, 3.0, 57.6, 94.0, "minutes of play", color=NAVY)
    x0, x1 = 12.0, 92.0
    scale = (x1 - x0) / 48.0

    for i in range(4):
        box(ax, x0 + i * 10 * scale, 48.2, 10 * scale - 0.25, 4.2, fc=BLUE,
            ec=WHITE, lw=1.0, z=4)
        txt(ax, x0 + (i + 0.5) * 10 * scale, 50.3, f"Q{i + 1}", fs=4.3,
            color=WHITE, weight="bold", z=6)
    for i in range(4):
        box(ax, x0 + i * 12 * scale, 40.2, 12 * scale - 0.25, 4.2, fc=ORANGE,
            ec=WHITE, lw=1.0, z=4)
        txt(ax, x0 + (i + 0.5) * 12 * scale, 42.3, f"Q{i + 1}", fs=4.3,
            color=WHITE, weight="bold", z=6)

    txt(ax, x0 - 1.2, 50.3, "FIBA", fs=5.0, color=BLUE, weight="bold", ha="right")
    txt(ax, x0 - 1.2, 42.3, "NBA", fs=5.0, color=ORANGE, weight="bold", ha="right")

    # a shared minute axis between the two bars
    for mins in (0, 10, 20, 24, 30, 36, 40, 48):
        xx = x0 + mins * scale
        ax.plot([xx, xx], [46.0, 47.2], color=MIST, lw=0.7, zorder=3)
        txt(ax, xx, 45.0, str(mins), fs=3.7, color=GREY)
    txt(ax, x0 - 1.2, 45.6, "min", fs=3.6, color=GREY, ha="right")

    dim_h(ax, x0, x0 + 40 * scale, 54.4, "40 minutes", color=BLUE_D, fs=4.4,
          offset=1.5)
    dim_h(ax, x0, x0 + 48 * scale, 38.2, "48 minutes", color=ORANGE_D, fs=4.4,
          offset=-1.8)

    # ---------- the clock rules
    section(ax, 3.0, 33.0, 44.0, "what the clock also decides", color=NAVY)
    rules = [("Quarter", "10 minutes", "12 minutes"),
             ("Half-time", "15 minutes", "15 minutes"),
             ("Overtime", "5 minutes", "5 minutes"),
             ("Overtimes", "as many as needed", "as many as needed")]
    txt(ax, 26.0, 30.2, "FIBA", fs=4.0, color=BLUE, weight="bold", ha="left")
    txt(ax, 42.0, 30.2, "NBA", fs=4.0, color=ORANGE_D, weight="bold", ha="left")
    for i, (lab, f_, n_) in enumerate(rules):
        yy = 27.2 - i * 3.2
        if i % 2 == 0:
            box(ax, 3.0, yy - 1.2, 44.0, 2.4, fc=WASH, ec="none", z=2)
        txt(ax, 4.0, yy, lab, fs=4.1, color=SLATE, ha="left")
        txt(ax, 26.0, yy, f_, fs=4.0, color=BLUE, weight="bold", ha="left")
        txt(ax, 42.0, yy, n_, fs=4.0, color=ORANGE_D, weight="bold", ha="left")

    # ---------- consequence
    section(ax, 52.0, 33.0, 45.0, "what eight minutes do", color=NAVY)
    rbox(ax, 52.0, 17.4, 45.0, 12.0, fc=WASH, ec=LINE, lw=0.65, r=0.7)
    txt(ax, 54.0, 27.4, "Eight extra minutes is roughly a quarter more", fs=4.0,
        color=NAVY, weight="bold", ha="left")
    txt(ax, 54.0, 25.2, "basketball: more possessions, a longer rotation, and a", fs=4.0,
        color=NAVY, weight="bold", ha="left")
    txt(ax, 54.0, 23.0, "bigger share of the game decided from the bench.", fs=4.0,
        color=NAVY, weight="bold", ha="left")
    txt(ax, 54.0, 19.8, "Both codes still play five minutes of overtime.", fs=3.9,
        color=SLATE, ha="left", style="italic")

    # ---------- a worked example
    section(ax, 3.0, 13.6, 94.0, "one line of arithmetic worth memorising", color=GOLD)
    rbox(ax, 3.0, 7.4, 94.0, 5.0, fc=PALE_Y, ec=GOLD, lw=0.6, r=0.6)
    txt(ax, 50.0, 9.9, "4 \u00d7 10 = 40 minutes of FIBA play   \u2022   4 \u00d7 12 = 48 minutes of NBA play   \u2022   overtime is 5 minutes in both",
        fs=4.2, color=NAVY, weight="bold")

    p.caption("A FIBA game ends after 40 minutes on the clock; an NBA game needs 48.")
    p.save(path)


# ==================================================== 26  Shared timing limits
def fig26(path):
    p = Page(26, "Plate 26 \u2022 FIBA vs NBA", "Timing Limits",
             "The clocks both rulebooks agree on")
    ax = p.ax

    # ---------- the shot clock
    section(ax, 3.0, 57.6, 44.0, "the shot clock", color=NAVY)
    cx, cy, R = 14.0, 45.0, 8.6
    ax.add_patch(Circle((cx, cy), R + 0.9, fc=NAVY, ec="none", zorder=3))
    ax.add_patch(Circle((cx, cy), R, fc="#1B3350", ec=GOLD, lw=0.8, zorder=4))
    for k in range(24):
        a_ = np.radians(90 - k * 15)
        ax.plot([cx + (R - 0.8) * np.cos(a_), cx + (R - 1.7) * np.cos(a_)],
                [cy + (R - 0.8) * np.sin(a_), cy + (R - 1.7) * np.sin(a_)],
                color=GOLD, lw=0.55, alpha=0.7, zorder=5)
    txt(ax, cx, cy + 0.9, "24", fs=13.0, color=GOLD, weight="bold", z=6)
    txt(ax, cx, cy - 2.4, "seconds", fs=3.6, color="#C7D6E6", z=6)

    # the three numbers, as small dials to the right
    for i, (val, lab, col) in enumerate([("24", "to shoot", GOLD),
                                        ("14", "reset after an\noffensive rebound", GREEN),
                                        ("8", "to cross\nhalf-court", ORANGE)]):
        dx = 30.4
        dy = 47.4 - i * 6.0
        ax.add_patch(Circle((dx, dy), 2.0, fc=col, ec="none", zorder=5))
        txt(ax, dx, dy + 0.05, val, fs=5.6, color=WHITE, weight="bold", z=6)
        txt(ax, dx + 2.9, dy + 0.7, lab.split("\n")[0], fs=4.1, color=col,
            weight="bold", ha="left")
        if "\n" in lab:
            txt(ax, dx + 2.9, dy - 1.2, lab.split("\n")[1], fs=3.8, color=SLATE,
                ha="left")

    txt(ax, 3.0, 30.0, "A team has 24 seconds to put the ball through the ring,\n"
        "14 seconds after it wins an offensive rebound, and 8 seconds\n"
        "to bring the ball across half-court. Both codes agree.",
        fs=4.0, color=SLATE, ha="left", lh=1.55)

    # ---------- the other clocks
    section(ax, 52.0, 57.6, 45.0, "the other clocks", color=NAVY)
    txt(ax, 52.0, 53.8, "", fs=4.2)
    txt(ax, 77.0, 53.8, "FIBA", fs=3.9, color=BLUE, weight="bold", ha="left")
    txt(ax, 88.0, 53.8, "NBA", fs=3.9, color=ORANGE_D, weight="bold", ha="left")
    rows = [("Shot clock", "24 s", "24 s"),
            ("Reset on an offensive rebound", "14 s", "14 s"),
            ("Backcourt count", "8 s", "8 s"),
            ("Closely guarded", "5 s", "no count"),
            ("Throw-in", "5 s", "5 s"),
            ("Three seconds in the key", "yes", "yes")]
    y = 51.0
    for i, (lab, f_, n_) in enumerate(rows):
        if i % 2 == 0:
            box(ax, 52.0, y - 1.15, 45.0, 2.3, fc=WASH, ec="none", z=2)
        txt(ax, 53.0, y, lab, fs=3.9, color=SLATE, ha="left")
        txt(ax, 77.0, y, f_, fs=3.9,
            color=RED if f_ == "no count" else BLUE, weight="bold", ha="left")
        txt(ax, 88.0, y, n_, fs=3.9,
            color=RED if n_ == "no count" else ORANGE_D, weight="bold", ha="left")
        y -= 2.3

    rbox(ax, 52.0, 30.4, 45.0, 5.4, fc=PALE_G, ec=GREEN, lw=0.6, r=0.6)
    txt(ax, 54.0, 34.2, "Five clocks, one rulebook: the shared limits are", fs=4.1,
        color=GREEN_D, weight="bold", ha="left")
    txt(ax, 54.0, 32.0, "the easiest marks in any comparison answer.", fs=4.1,
        color=GREEN_D, ha="left")

    rbox(ax, 52.0, 23.4, 45.0, 5.4, fc=PALE_R, ec=RED, lw=0.6, r=0.6)
    txt(ax, 54.0, 27.2, "The exception: five-second closely guarded.", fs=4.1,
        color=RED, weight="bold", ha="left")
    txt(ax, 54.0, 25.0, "FIBA counts it; the NBA dropped the count in 2001.", fs=3.9,
        color=SLATE, ha="left")

    # ---------- why it is shared
    section(ax, 3.0, 25.4, 44.0, "why the clocks are shared", color=NAVY)
    txt(ax, 3.0, 20.6,
        "The shot clock arrived in 1954 to stop a team holding the ball.\n"
        "Every rulebook since has kept the idea, and the numbers \u2014 24,\n"
        "14 and 8 \u2014 have become part of the game itself.",
        fs=4.0, color=SLATE, ha="left", lh=1.6)
    txt(ax, 3.0, 13.2,
        "When both codes agree, say so plainly: it shows you know which\n"
        "differences are real and which are only assumed.",
        fs=4.0, color=GREY, ha="left", lh=1.6, style="italic")

    p.caption("Both codes share the 24, 14 and 8 second limits; the FIBA five-second count is the one exception.")
    p.save(path)


# ==================================================== 27  Possession
def fig27(path):
    p = Page(27, "Plate 27 \u2022 FIBA vs NBA", "Held Ball and Possession",
             "Who gets the ball when two players grab it")
    ax = p.ax

    # ---------- FIBA: alternating arrow
    section(ax, 3.0, 57.6, 44.0, "FIBA: the alternating arrow", color=BLUE)
    cx, cy, R = 20.0, 43.2, 7.9
    ax.add_patch(Circle((cx, cy), R, fc="#F2F7FC", ec=BLUE, lw=0.9, zorder=3))
    ax.plot([cx - R, cx + R], [cy, cy], color=BLUE, lw=0.6, ls=(0, (3, 2)),
            zorder=4, alpha=0.6)
    ax.add_patch(Circle((cx, cy), 0.55, fc=BLUE, ec="none", zorder=6))
    # the arrow itself
    arrow(ax, (cx - 4.6, cy + 2.2), (cx + 4.6, cy + 2.2), color=RED, lw=1.6,
          mut=10)
    txt(ax, cx, 53.2, "the arrow decides who throws the ball in", fs=3.9, color=RED,
        weight="bold")
    txt(ax, cx, cy - 2.6, "held ball", fs=4.2, color=BLUE, weight="bold")
    txt(ax, cx, cy - 4.8, "no jump ball at all", fs=3.8, color=SLATE)

    # the arrow board at the table
    rbox(ax, 3.0, 28.2, 20.0, 4.4, fc=WHITE, ec=LINE, lw=0.6, r=0.5)
    txt(ax, 6.2, 30.4, "arrow board", fs=3.8, color=SLATE, ha="left")
    ax.plot([13.4, 19.0], [30.4, 30.4], color=RED, lw=1.3, zorder=5)
    ax.plot([19.0, 18.3], [30.4, 31.0], color=RED, lw=1.3, zorder=5)
    ax.plot([19.0, 18.3], [30.4, 29.8], color=RED, lw=1.3, zorder=5)

    txt(ax, 3.0, 24.6, "The scorer's table flips the arrow after every\n"
        "throw-in. Possession alternates for the whole game,\n"
        "including the start of each extra period.",
        fs=4.0, color=SLATE, ha="left", lh=1.55)

    # ---------- NBA: jump ball
    section(ax, 52.0, 57.6, 45.0, "NBA: the jump ball", color=ORANGE)
    cx2, cy2, R2 = 63.0, 45.2, 7.9
    ax.add_patch(Circle((cx2, cy2), R2, fc="#FDF7F1", ec=ORANGE, lw=0.9, zorder=3))
    ax.plot([cx2 - R2, cx2 + R2], [cy2, cy2], color=ORANGE, lw=0.6, ls=(0, (3, 2)),
            zorder=4, alpha=0.6)
    for sx in (-1, 1):
        player(ax, cx2 + 3.0 * sx, cy2 - 0.5, "", fc=BLUE if sx < 0 else ORANGE,
               r=1.3)
        ax.plot([cx2 + 3.0 * sx, cx2 + 2.2 * sx], [cy2 + 0.9, cy2 + 2.7],
                color=SLATE, lw=1.4, zorder=6, solid_capstyle="round")
    ball(ax, cx2, cy2 + 3.8, r=0.95)
    arrow(ax, (cx2, cy2 + 5.9), (cx2, cy2 + 4.8), color=GREY, lw=1.0, mut=7)
    txt(ax, cx2, cy2 - 2.8, "held ball", fs=4.2, color=ORANGE_D, weight="bold")
    txt(ax, cx2, cy2 - 4.6, "the referees toss it up", fs=3.8, color=SLATE)

    rbox(ax, 52.0, 29.8, 45.0, 6.4, fc=PALE_O, ec=ORANGE, lw=0.6, r=0.6)
    txt(ax, 54.0, 35.4, "Only the opening tip uses the circle in FIBA.", fs=4.0,
        color=ORANGE_D, weight="bold", ha="left")
    txt(ax, 54.0, 33.0, "After that, every held ball belongs to the arrow.", fs=3.9,
        color=SLATE, ha="left")

    txt(ax, 52.0, 23.4,
        "Two opponents face the circle, the referee tosses the ball\n"
        "straight up, and each may tap it once it reaches its highest\n"
        "point. The NBA keeps the jump ball for the start of the game\n"
        "and for held balls; FIBA keeps it only for the start.",
        fs=4.0, color=SLATE, ha="left", lh=1.55)

    # ---------- what it changes
    section(ax, 3.0, 19.6, 94.0, "what the difference changes", color=NAVY)
    cards = [("No jump balls in FIBA", "a held ball is settled in a second, so play never stops for a toss",
              BLUE),
             ("Fairness is procedural", "the arrow shares possession evenly without a height contest",
              GREEN),
             ("Height matters in the NBA", "a taller centre can win the opening tip and every held ball",
              ORANGE)]
    x = 3.0
    for head, body, col in cards:
        rbox(ax, x, 7.6, 30.4, 9.4, fc=WHITE, ec=LINE, lw=0.6, r=0.7)
        ax.add_patch(Rectangle((x + 0.2, 8.2), 0.7, 8.2, fc=col, ec="none", zorder=4))
        txt(ax, x + 2.6, 14.6, head, fs=4.5, color=col, weight="bold", ha="left")
        txt(ax, x + 2.6, 11.2, body, fs=3.8, color=SLATE, ha="left", lh=1.4)
        x += 31.9

    p.caption("FIBA settles a held ball with the possession arrow; the NBA still throws it up.")
    p.save(path)


if __name__ == "__main__":
    import sys, os
    out = sys.argv[1] if len(sys.argv) > 1 else "figs"
    os.makedirs(out, exist_ok=True)
    for i, f in zip(range(23, 28), [fig23, fig24, fig25, fig26, fig27]):
        f(f"{out}/plate{i:02d}.png")
        print("ok", i)
