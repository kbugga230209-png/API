"""
Plates 28-33 of the CUUV102 Basketball Diagram Atlas.
28 Personal foul limits   29 Time-outs   30 Defensive three-second
31 Rim and cylinder       32 Gather and two steps   33 Foul categories 2026
"""
import numpy as np
from toolkit import *          # noqa: F401,F403
from matplotlib.patches import Circle, Rectangle, Polygon, Wedge


# ==================================================== 28  Personal foul limits
def fig28(path):
    p = Page(28, "Plate 28 \u2022 FIBA vs NBA", "Personal Foul Limits",
             "Five fouls or six \u2014 the number that ends a night")
    ax = p.ax

    # ---------- FIBA ladder
    section(ax, 3.0, 57.6, 44.0, "FIBA: five and out", color=BLUE)
    for i in range(5):
        cx = 8.6 + i * 7.6
        ax.add_patch(Circle((cx, 47.6), 2.6, fc=BLUE, ec="none", zorder=4))
        txt(ax, cx, 47.55, str(i + 1), fs=6.2, color=WHITE, weight="bold", z=6)
        txt(ax, cx, 43.4, "foul", fs=3.4, color=BLUE_D)
    ax.add_patch(Circle((44.0, 47.6), 2.6, fc=RED, ec="none", zorder=4))
    txt(ax, 44.0, 47.4, "OUT", fs=4.6, color=WHITE, weight="bold", z=6)
    txt(ax, 44.0, 43.4, "disqualified", fs=3.4, color=RED)

    txt(ax, 3.0, 38.4, "A fifth personal foul ends the player's game.", fs=4.5,
        color=NAVY, weight="bold", ha="left")
    txt(ax, 3.0, 35.8, "Two technical fouls, or one unsportsmanlike and one\ntechnical, also disqualify.",
        fs=4.0, color=SLATE, ha="left", lh=1.5)

    # ---------- NBA ladder
    section(ax, 52.0, 57.6, 45.0, "NBA: six and out", color=ORANGE)
    for i in range(6):
        cx = 56.4 + i * 7.0
        ax.add_patch(Circle((cx, 47.6), 2.4, fc=ORANGE, ec="none", zorder=4))
        txt(ax, cx, 47.55, str(i + 1), fs=5.8, color=WHITE, weight="bold", z=6)
    ax.add_patch(Circle((95.0, 47.6), 0.0, fc="none", ec="none"))
    txt(ax, 94.6, 43.4, "6th = out", fs=3.6, color=RED, weight="bold", ha="right")

    txt(ax, 52.0, 38.4, "A sixth personal foul ends the player's game.", fs=4.5,
        color=NAVY, weight="bold", ha="left")
    txt(ax, 52.0, 35.8, "Two technicals also bring an ejection, and the league\nreviews flagrants after the game.",
        fs=4.0, color=SLATE, ha="left", lh=1.5)

    # ---------- team fouls
    section(ax, 3.0, 31.6, 94.0, "team fouls: when the bonus starts", color=NAVY)
    # FIBA: 5th team foul in the quarter
    box(ax, 3.0, 25.2, 44.0, 3.4, fc=WASH, ec="none", z=2)
    for i in range(5):
        x_ = 3.8 + i * 8.4
        box(ax, x_, 25.6, 7.4, 2.6, fc=BLUE if i < 4 else RED, ec="none", z=4)
        txt(ax, x_ + 3.7, 26.9, f"foul {i + 1}", fs=3.4,
            color=WHITE if i == 4 else BLUE_D, weight="bold", z=6)
    txt(ax, 3.0, 23.2, "FIBA: the fifth team foul of a quarter puts the opponent in the bonus \u2014 two free throws.",
        fs=4.0, color=SLATE, ha="left")

    box(ax, 52.0, 25.2, 45.0, 3.4, fc=WASH, ec="none", z=2)
    for i in range(5):
        x_ = 52.8 + i * 8.6
        box(ax, x_, 25.6, 7.6, 2.6, fc=ORANGE if i < 4 else RED, ec="none", z=4)
        txt(ax, x_ + 3.8, 26.9, f"foul {i + 1}", fs=3.4,
            color=WHITE if i == 4 else ORANGE_D, weight="bold", z=6)
    txt(ax, 52.0, 23.2, "NBA: the fifth team foul of a quarter does the same, and in the last two minutes\nevery foul gives two free throws.",
        fs=4.0, color=SLATE, ha="left", lh=1.45)

    # ---------- consequences
    section(ax, 3.0, 18.6, 94.0, "what a foul limit does to a coach", color=NAVY)
    cards = [("Rotation", "a starter with four fouls sits, so the bench plays earlier", BLUE),
             ("Defence", "hands come down; a defender stops contesting at the rim", ORANGE),
             ("Targeting", "the other team attacks the player in foul trouble", RED)]
    x = 3.0
    for head, body, col in cards:
        rbox(ax, x, 7.6, 30.4, 8.6, fc=WHITE, ec=LINE, lw=0.6, r=0.7)
        ax.add_patch(Rectangle((x + 0.2, 8.2), 0.7, 7.4, fc=col, ec="none", zorder=4))
        txt(ax, x + 2.6, 13.8, head, fs=4.5, color=col, weight="bold", ha="left")
        txt(ax, x + 2.6, 10.6, body, fs=3.8, color=SLATE, ha="left", lh=1.35)
        x += 31.9

    p.caption("Five fouls end a FIBA night, six an NBA night; both codes start the bonus on the fifth team foul.")
    p.save(path)


# ==================================================== 29  Time-outs
def fig29(path):
    p = Page(29, "Plate 29 \u2022 FIBA vs NBA", "Time-outs",
             "The same pause, a different allowance")
    ax = p.ax

    # ---------- FIBA
    section(ax, 3.0, 57.6, 44.0, "FIBA: two and three", color=BLUE)
    groups = [("first half", 2, BLUE), ("second half", 3, BLUE_D), ("each overtime", 1, TEAL)]
    y = 50.4
    for lab, n, col in groups:
        txt(ax, 3.0, y, lab, fs=4.1, color=SLATE, ha="left")
        for i in range(n):
            box(ax, 20.6 + i * 6.4, y - 1.5, 5.4, 3.0, fc=col, ec="none", z=4)
            txt(ax, 23.3 + i * 6.4, y, "T", fs=4.2, color=WHITE, weight="bold", z=6)
        txt(ax, 20.6 + n * 6.4 + 0.6, y, f"{n}", fs=4.2, color=col, weight="bold",
            ha="left")
        y -= 6.0

    txt(ax, 3.0, 32.4, "Each time-out lasts 30 seconds. A team may use no more than\ntwo of them in the last two minutes of the fourth quarter.",
        fs=4.0, color=SLATE, ha="left", lh=1.5)
    rbox(ax, 3.0, 24.6, 44.0, 5.0, fc=PALE_B, ec=BLUE, lw=0.6, r=0.6)
    txt(ax, 5.0, 28.0, "Unused time-outs do not carry over to the next half.", fs=3.9,
        color=BLUE_D, weight="bold", ha="left")

    # ---------- NBA
    section(ax, 52.0, 57.6, 45.0, "the NBA: seven and two", color=ORANGE)
    txt(ax, 52.0, 50.4, "regulation", fs=4.1, color=SLATE, ha="left")
    for i in range(7):
        box(ax, 64.0 + i * 4.2, 48.9, 3.6, 3.0, fc=ORANGE, ec="none", z=4)
        txt(ax, 65.8 + i * 4.2, 50.4, "T", fs=3.8, color=WHITE, weight="bold", z=6)
    txt(ax, 94.6, 50.4, "7", fs=4.2, color=ORANGE_D, weight="bold", ha="left")

    txt(ax, 52.0, 44.4, "each overtime", fs=4.1, color=SLATE, ha="left")
    for i in range(2):
        box(ax, 64.0 + i * 4.2, 42.9, 3.6, 3.0, fc=ORANGE_D, ec="none", z=4)
        txt(ax, 65.8 + i * 4.2, 44.4, "T", fs=3.8, color=WHITE, weight="bold", z=6)
    txt(ax, 73.4, 44.4, "2", fs=4.2, color=ORANGE_D, weight="bold", ha="left")

    txt(ax, 52.0, 37.4, "A time-out lasts 60 seconds, and each team must use two\nin each half \u2014 the mandatory breaks that sell the ads.",
        fs=4.0, color=SLATE, ha="left", lh=1.5)
    rbox(ax, 52.0, 30.0, 45.0, 5.0, fc=PALE_O, ec=ORANGE, lw=0.6, r=0.6)
    txt(ax, 54.0, 33.4, "In the last two minutes a team may keep only two.", fs=3.9,
        color=ORANGE_D, weight="bold", ha="left")

    # ---------- comparison strip
    section(ax, 3.0, 20.6, 94.0, "at a glance", color=NAVY)
    rows = [("Time-outs in regulation", "5 (2 + 3)", "7", BLUE, ORANGE),
            ("Length of each", "30 seconds", "60 seconds", BLUE, ORANGE),
            ("Extra time-outs per overtime", "1", "2", BLUE, ORANGE),
            ("Carry over between halves", "no", "no", BLUE, ORANGE)]
    txt(ax, 52.0, 17.6, "FIBA", fs=4.0, color=BLUE, weight="bold", ha="left")
    txt(ax, 74.0, 17.6, "NBA", fs=4.0, color=ORANGE_D, weight="bold", ha="left")
    for i, (lab, f_, n_, c1, c2) in enumerate(rows):
        yy = 14.8 - i * 2.3
        if i % 2 == 0:
            box(ax, 3.0, yy - 1.1, 94.0, 2.2, fc=WASH, ec="none", z=2)
        txt(ax, 4.0, yy, lab, fs=3.9, color=SLATE, ha="left")
        txt(ax, 52.0, yy, f_, fs=3.9, color=c1, weight="bold", ha="left")
        txt(ax, 74.0, yy, n_, fs=3.9, color=c2, weight="bold", ha="left")

    p.caption("A FIBA coach has five 30-second pauses; an NBA coach has seven of a minute, plus two per overtime.")
    p.save(path)


# ==================================================== 30  Defensive three-second
def fig30(path):
    p = Page(30, "Plate 30 \u2022 FIBA vs NBA", "Defensive Three Seconds",
             "The rule that exists in one rulebook only")
    ax = p.ax

    # ---------- the lane, both codes
    section(ax, 3.0, 57.6, 30.0, "the lane, drawn to scale", color=NAVY)
    ch = 28.4
    cw = ch * 14.0 / 15.0
    c = Court(ax, 3.6, 27.2, cw, ch, spec=FIBA, full=False, fc="#FBFDFF", lw=0.65)
    c.halves(1, c2="#EAF2F9", alpha3=0.22, alpha2=1.0)
    c.draw(ends=(1,), lw=0.65)
    c.key_fill(1, fc=PALE_R, alpha=0.85)

    D = c.pt(3.6, 6.2, 1)
    player(ax, D[0], D[1], "X", fc=NAVY, r=1.5, fs=3.8)
    for k in range(3):
        ax.add_patch(Circle((D[0] + 2.4, D[1] + 2.2 - k * 1.9), 0.55, fc="none",
                            ec=RED, lw=0.7, zorder=6, alpha=0.85))
    txt(ax, D[0] - 1.0, D[1] - 3.0, "1 \u2022 2 \u2022 3", fs=4.2, color=RED,
        weight="bold", ha="left")
    txt(ax, 3.6, 24.4, "the red area is the lane \u2014 the key", fs=3.8, color=GREY,
        style="italic", ha="left")

    # ---------- the rule
    section(ax, 33.0, 57.6, 64.0, "what the rule says", color=NAVY)
    rbox(ax, 33.0, 42.6, 64.0, 13.0, fc="#FDF7F1", ec=ORANGE, lw=0.7, r=0.7)
    txt(ax, 35.0, 53.8, "NBA: a defender may not stay in the lane for more than",
        fs=4.2, color=ORANGE_D, weight="bold", ha="left")
    txt(ax, 35.0, 51.6, "three seconds unless he is actively guarding an opponent.",
        fs=4.2, color=ORANGE_D, weight="bold", ha="left")
    txt(ax, 35.0, 48.4, "Penalty: one free throw for the offence, and the ball out of",
        fs=3.9, color=SLATE, ha="left")
    txt(ax, 35.0, 46.4, "bounds at the free-throw line extended.", fs=3.9,
        color=SLATE, ha="left")
    txt(ax, 35.0, 44.4, "The count restarts when the defender leaves the lane or contests a shot.",
        fs=3.8, color=GREY, ha="left", style="italic")

    rbox(ax, 33.0, 32.4, 64.0, 8.4, fc=PALE_B, ec=BLUE, lw=0.7, r=0.7)
    txt(ax, 35.0, 39.0, "FIBA: no separate defensive three-second rule",
        fs=4.2, color=BLUE_D, weight="bold", ha="left")
    txt(ax, 35.0, 36.4, "Only the offensive count applies: an attacker may not live in",
        fs=3.9, color=SLATE, ha="left")
    txt(ax, 35.0, 34.4, "the lane for more than three seconds.", fs=3.9, color=SLATE,
        ha="left")

    # ---------- who counts it
    section(ax, 33.0, 29.4, 64.0, "how the count is kept", color=NAVY)
    steps = [("1 s", "the referee sees a defender with both feet in the lane", NAVY),
             ("2 s", "the referee keeps the count silent and watches the ball", ORANGE),
             ("3 s", "the whistle; the offence gets the ball back", RED)]
    x = 33.0
    for lab, body, col in steps:
        txt(ax, x, 25.4, lab, fs=5.0, color=col, weight="bold", ha="left")
        txt(ax, x, 23.2, body, fs=3.7, color=SLATE, ha="left")
        x += 21.6

    # ---------- what it changes
    section(ax, 3.0, 20.2, 94.0, "what it changes on the floor", color=NAVY)
    cards = [("A zone is legal in FIBA", "a defender may sit in the lane and wait, so zone defence is easier",
              BLUE),
             ("The NBA keeps the lane open", "one-on-one play has room, and the drive is not walled off",
              ORANGE),
             ("The call needs an official", "in the NBA one referee watches the lane, not the ball",
              RED)]
    x = 3.0
    for head, body, col in cards:
        rbox(ax, x, 7.6, 30.4, 9.6, fc=WHITE, ec=LINE, lw=0.6, r=0.7)
        ax.add_patch(Rectangle((x + 0.2, 8.2), 0.7, 8.4, fc=col, ec="none", zorder=4))
        txt(ax, x + 2.6, 14.8, head, fs=4.4, color=col, weight="bold", ha="left")
        txt(ax, x + 2.6, 11.4, body, fs=3.8, color=SLATE, ha="left", lh=1.4)
        x += 31.9

    p.caption("Defensive three seconds is an NBA rule; in FIBA only the attacker is counted in the lane.")
    p.save(path)


# ==================================================== 31  Rim and cylinder
def fig31(path):
    p = Page(31, "Plate 31 \u2022 FIBA vs NBA", "Rim and Cylinder",
             "The same ten feet, the same imaginary cylinder")
    ax = p.ax

    # ---------- side elevation, left column, full height
    section(ax, 3.0, 57.4, 44.0, "side view, drawn to scale", color=NAVY)
    floor_y, sc = 11.0, 10.4
    ring_y = floor_y + 3.05 * sc
    bx = 16.0

    ax.plot([5.0, 42.0], [floor_y, floor_y], color=INK, lw=1.4, zorder=6)
    # backboard: 1.80 wide, 1.05 high, its lower edge 2.90 m up
    bb_bot = floor_y + 2.90 * sc
    bb_top = floor_y + 3.95 * sc
    ax.plot([bx, bx], [bb_bot, bb_top], color=INK, lw=3.4, zorder=6,
            solid_capstyle="butt")
    # ring, 0.15 m out from the board face
    ax.plot([bx, bx + 0.45 * sc], [ring_y, ring_y], color=ORANGE_D, lw=2.8,
            zorder=7, solid_capstyle="round")
    # net
    for k, dy in enumerate((0.22, 0.40, 0.56)):
        w = 0.45 - k * 0.10
        ax.plot([bx + 0.02 * sc, bx + w * sc], [ring_y - dy * sc, ring_y - dy * sc],
                color=SLATE, lw=0.6, zorder=5)

    # the cylinder above the ring
    ax.add_patch(Rectangle((bx, ring_y), 0.45 * sc, 0.62 * sc, fc=BLUE, ec=BLUE,
                           lw=0.8, ls=(0, (3, 2)), alpha=0.14, zorder=4))
    txt(ax, bx + 0.75 * sc, ring_y + 0.30 * sc,
        "the cylinder:\nno hand may\nenter it", fs=3.8, color=BLUE_D,
        weight="bold", ha="left", lh=1.45)

    dim_v(ax, floor_y, ring_y, bx - 3.2, "3.05 m", color=BLUE_D, fs=4.4,
          offset=-2.0, rot=90)
    txt(ax, bx - 2.0, floor_y + 0.6, "floor", fs=3.6, color=GREY, ha="left")
    txt(ax, bx + 0.9 * sc, floor_y + 1.2,
        "the ring sits 0.15 m out from the board\nand is 45 cm across",
        fs=3.7, color=SLATE, ha="left", lh=1.5)
    txt(ax, bx - 0.8, bb_top - 0.6, "backboard 1.80 m wide, 1.05 m high",
        fs=3.6, color=SLATE, ha="right")

    # ---------- shared numbers
    section(ax, 52.0, 57.4, 45.0, "shared in both codes", color=GREEN)
    facts = [("Ring height", "3.05 m (10 ft)"),
             ("Ring diameter", "45 cm"),
             ("Backboard", "1.80 \u00d7 1.05 m"),
             ("Board from end line", "1.20 m")]
    y = 53.6
    for lab, val in facts:
        txt(ax, 52.0, y, lab, fs=3.9, color=SLATE, ha="left")
        txt(ax, 97.0, y, val, fs=3.9, color=GREEN_D, weight="bold", ha="right")
        y -= 2.8

    # ---------- four numbers, large
    section(ax, 52.0, 43.2, 45.0, "four numbers to memorise", color=NAVY)
    nums = [("3.05 m", "ring height", 52.0, 38.6),
            ("45 cm", "ring diameter", 75.0, 38.6),
            ("1.20 m", "board to end line", 52.0, 32.4),
            ("0.15 m", "ring to board", 75.0, 32.4)]
    for big, small, cx, cy in nums:
        txt(ax, cx, cy, big, fs=7.6, color=BLUE, weight="bold", ha="left")
        txt(ax, cx, cy - 2.0, small, fs=3.6, color=GREY, ha="left")

    # ---------- goaltending
    section(ax, 52.0, 27.2, 45.0, "goaltending", color=NAVY)
    rbox(ax, 52.0, 15.4, 45.0, 9.8, fc=WHITE, ec=RED, lw=0.65, r=0.7)
    txt(ax, 54.0, 22.8, "Illegal in both codes", fs=4.3, color=RED, weight="bold",
        ha="left")
    txt(ax, 54.0, 20.0, "Touching a shot on its downward flight, or a\nball inside the cylinder.",
        fs=3.8, color=SLATE, ha="left", lh=1.45)
    txt(ax, 54.0, 17.2, "The penalty is the same: the basket counts.", fs=3.8,
        color=SLATE, ha="left", style="italic")

    rbox(ax, 52.0, 7.4, 45.0, 6.4, fc=WHITE, ec=ORANGE, lw=0.65, r=0.7)
    txt(ax, 54.0, 11.6, "Where the NBA adds a layer", fs=4.2, color=ORANGE_D,
        weight="bold", ha="left")
    txt(ax, 54.0, 9.2, "replay review of the call, and fines after it.", fs=3.8,
        color=SLATE, ha="left")

    p.caption("The ring is ten feet up in both codes; the cylinder above it belongs to nobody's hand.")
    p.save(path)


if __name__ == "__main__":
    import sys, os
    out = sys.argv[1] if len(sys.argv) > 1 else "figs"
    os.makedirs(out, exist_ok=True)
    for i, f in zip(range(28, 32), [fig28, fig29, fig30, fig31]):
        f(f"{out}/plate{i:02d}.png")
        print("ok", i)
