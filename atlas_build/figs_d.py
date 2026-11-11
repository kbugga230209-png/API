"""
Plates 19-22 of the CUUV102 Basketball Diagram Atlas.
19 Rebounding and Defence   20 Teamwork and Tactics
21 Fitness, Safety, Sportsmanship   22 Current Status in India
"""
import numpy as np
from toolkit import *          # noqa: F401,F403
from matplotlib.patches import Circle, Rectangle, Polygon


# ==================================================== 19  Rebounding and defence
def fig19(path):
    p = Page(19, "Plate 19 \u2022 Fundamentals", "Rebounding and Defence",
             "Rebounding ends a possession; defending decides how it started")
    ax = p.ax

    section(ax, 3.0, 57.0, 45.0, "boxing out from the free-throw area", color=NAVY)
    ch = 26.4
    cw = ch * 14.0 / 15.0
    c = Court(ax, 5.6, 26.6, cw, ch, spec=FIBA, full=False, fc="#FBFDFF", lw=0.65)
    c.halves(1, c2="#EAF2F9", alpha3=0.26, alpha2=1.0)
    c.draw(ends=(1,), lw=0.65)

    hoop = (c.X(c.spec["basket_d"], 1), c.Y(7.5))
    shooter = c.pt(12.4, 12.2, 1)
    player(ax, shooter[0], shooter[1], "O4", fc=ORANGE, r=1.45, fs=3.9)
    ball(ax, shooter[0] + 2.1, shooter[1] + 2.5, r=0.7)
    arrow(ax, (shooter[0] - 0.3, shooter[1] + 1.7), (hoop[0] + 1.6, hoop[1] + 0.9),
          color=GREY, lw=0.8, rad=-0.30, ls=(0, (3, 2)), mut=6)

    O1 = c.pt(5.2, 4.6, 1)
    O2 = c.pt(5.2, 10.4, 1)
    O3 = c.pt(7.6, 7.5, 1)
    X1 = c.pt(3.2, 5.2, 1)
    X2 = c.pt(3.2, 9.8, 1)
    X3 = c.pt(6.0, 7.5, 1)
    for pt_, tag, col in ((O1, "O1", ORANGE), (O2, "O2", ORANGE), (O3, "O3", ORANGE),
                          (X1, "X1", NAVY), (X2, "X2", NAVY), (X3, "X3", NAVY)):
        player(ax, pt_[0], pt_[1], tag, fc=col, r=1.4, fs=3.7)

    for a_, b_ in ((X1, O1), (X2, O2), (X3, O3)):
        ax.plot([a_[0] + 1.3, b_[0] - 1.3], [a_[1], b_[1]], color=GOLD, lw=2.2,
                zorder=4, solid_capstyle="round")

    # legend in the gap between the court and the right column
    legend = [("X1 takes the inside line first", NAVY),
              ("X2 makes contact before the ball", NAVY),
              ("X3 stays between ball and basket", NAVY),
              ("O1-O3 fight for the space", ORANGE)]
    ly = 49.4
    for text, col in legend:
        ax.add_patch(Circle((32.9, ly), 0.55, fc=col, ec="none", zorder=5))
        txt(ax, 34.4, ly, text, fs=4.0, color=SLATE, ha="left")
        ly -= 4.4

    txt(ax, 32.6, 27.0, "the gold line is body\ncontact: a legal\nbox-out, hip to hip",
        fs=4.0, color=GOLD, weight="bold", ha="left", lh=1.5)

    txt(ax, c.x0 + cw / 2, 24.4,
        "the shot goes up \u2014 find a body before finding the ball",
        fs=4.0, color=GREY, style="italic")

    # ---------- defensive principles
    section(ax, 52.0, 57.0, 45.0, "five defensive principles", color=NAVY)
    rules = [("Ball, you, man", "stand where you can see both the ball and your player", BLUE),
             ("Low stance", "knees bent, chest up, weight on the balls of the feet", GREEN),
             ("Hands active", "one hand up to contest, one low to deflect", ORANGE),
             ("Slide, don't cross", "push off the trailing foot, keep the feet wide", PURPLE),
             ("Talk", "call the screen and the cut before it happens", TEAL)]
    y = 52.8
    for head, body, col in rules:
        ax.add_patch(Circle((53.8, y + 0.9), 0.75, fc=col, ec="none", zorder=5))
        txt(ax, 55.8, y + 1.6, head, fs=4.8, color=NAVY, weight="bold", ha="left")
        txt(ax, 55.8, y - 0.4, body, fs=4.0, color=SLATE, ha="left")
        y -= 5.3

    rbox(ax, 52.0, 22.8, 45.0, 5.8, fc=PALE_Y, ec=GOLD, lw=0.65, r=0.7)
    txt(ax, 54.0, 26.9, "A defensive rebound ends the possession;", fs=4.2, color=NAVY,
        weight="bold", ha="left")
    txt(ax, 54.0, 24.6, "an offensive rebound buys a second chance.", fs=4.2,
        color=NAVY, ha="left")

    # ---------- contact calls
    section(ax, 3.0, 21.4, 94.0, "the three calls that decide contact", color=NAVY)
    calls = [("Legal guarding position",
              "facing the opponent with both feet on the\nfloor; the defender may then move to stay in the path",
              BLUE, "still"),
             ("Blocking foul",
              "the defender is still moving and the contact\nstops the attacker's progress",
              ORANGE, "move"),
             ("Charging foul",
              "the attacker runs into a defender who\nalready holds a legal position",
              RED, "into")]
    x = 3.0
    for head, body, col, kind in calls:
        rbox(ax, x, 7.8, 30.4, 11.6, fc=WHITE, ec=LINE, lw=0.6, r=0.7)
        ax.add_patch(Rectangle((x + 0.2, 8.4), 0.75, 10.4, fc=col, ec="none", zorder=4))
        txt(ax, x + 2.8, 17.0, head, fs=4.8, color=col, weight="bold", ha="left")
        txt(ax, x + 2.8, 12.6, body, fs=3.9, color=SLATE, ha="left", lh=1.45)

        gx, gy = x + 25.6, 16.4
        ax.add_patch(Circle((gx, gy), 1.15, fc=NAVY, ec=WHITE, lw=0.6, zorder=6))
        ax.plot([gx - 0.15, gx - 0.15], [gy - 1.5, gy + 1.5], color=SLATE, lw=0.9,
                zorder=5)
        if kind == "still":
            arrow(ax, (gx - 4.4, gy), (gx - 1.5, gy), color=BLUE, lw=1.0, mut=6)
        elif kind == "move":
            arrow(ax, (gx - 4.4, gy - 0.6), (gx - 1.5, gy - 0.6), color=ORANGE,
                  lw=1.0, mut=6)
            arrow(ax, (gx - 3.2, gy + 0.9), (gx - 1.5, gy + 0.9), color=ORANGE,
                  lw=0.7, mut=5, ls=(0, (2, 1.6)))
        else:
            arrow(ax, (gx - 4.4, gy), (gx - 1.6, gy), color=RED, lw=1.3, mut=7)
        x += 31.9

    p.caption("Rebounding is a contest for space before it is a contest for the ball; defence is legal position, held.")
    p.save(path)


# ==================================================== 20  Teamwork and tactics
def fig20(path):
    p = Page(20, "Plate 20 \u2022 Fundamentals", "Teamwork and Tactics",
             "Five players, one ball, a shared idea of where to be")
    ax = p.ax

    section(ax, 3.0, 57.0, 43.0, "the pick and roll", color=NAVY)
    ch = 26.4
    cw = ch * 14.0 / 15.0
    c = Court(ax, 4.4, 26.0, cw, ch, spec=FIBA, full=False, fc="#FBFDFF", lw=0.65)
    c.halves(1, c2="#EAF2F9", alpha3=0.24, alpha2=1.0)
    c.draw(ends=(1,), lw=0.65)

    G = c.pt(12.2, 9.4, 1)       # ball handler, top of the key
    S = c.pt(11.0, 6.6, 1)       # screener
    G2 = c.pt(8.0, 6.0, 1)       # handler after using the screen
    R = c.pt(3.2, 5.4, 1)        # screener rolling to the rim
    D1 = c.pt(10.6, 9.4, 1)      # on-ball defender
    D2 = c.pt(9.4, 7.9, 1)       # screener's defender

    for pt_, tag, col in ((G, "1", BLUE), (S, "5", ORANGE), (D1, "X1", NAVY),
                          (D2, "X2", NAVY)):
        player(ax, pt_[0], pt_[1], tag, fc=col, r=1.3, fs=3.4)
    ball(ax, G[0] + 1.9, G[1] - 1.7, r=0.66)

    # the screen itself: a gold bar, feet set, between 5 and X2
    ax.plot([S[0] - 0.7, S[0] - 1.6], [S[1] + 0.4, S[1] + 1.4], color=GOLD, lw=2.6,
            zorder=4, solid_capstyle="round")

    # ghost positions after the action
    for pt_, tag, col in ((G2, "1", BLUE), (R, "5", ORANGE)):
        ax.add_patch(Circle(pt_, 1.3, fc=WHITE, ec=col, lw=0.8, ls=(0, (2, 1.6)),
                            zorder=5))
        txt(ax, pt_[0], pt_[1], tag, fs=3.4, color=col, weight="bold", z=6)

    arrow(ax, (G[0] - 1.5, G[1] - 0.9), (G2[0] + 1.1, G2[1] + 1.0), color=BLUE,
          lw=1.0, rad=0.24, mut=7)
    arrow(ax, (S[0] - 1.0, S[1] - 0.7), (R[0] + 1.6, R[1] + 0.4), color=ORANGE,
          lw=1.1, rad=0.24, mut=7)
    arrow(ax, (G2[0] - 0.9, G2[1] - 0.8), (R[0] + 1.7, R[1] - 0.6), color=GREY,
          lw=0.9, rad=-0.16, ls=(0, (3, 2)), mut=6)

    # numbered action keys in the gap right of the court
    steps = [("1", "the screen", "5 sets a legal screen on X2, feet still, arms in", ORANGE),
             ("2", "the drive", "1 dribbles off the screen, shoulder to hip", BLUE),
             ("3", "the roll", "5 turns and dives to the rim, sealing X2", ORANGE),
             ("4", "the read", "1 passes to the roll, or keeps the shot", GREY)]
    ly = 50.4
    for n, head, body, col in steps:
        ax.add_patch(Circle((31.4, ly + 1.4), 1.25, fc=col, ec="none", zorder=5))
        txt(ax, 31.4, ly + 1.35, n, fs=4.3, color=WHITE, weight="bold", z=7)
        txt(ax, 33.4, ly + 1.9, head, fs=4.4, color=col, weight="bold", ha="left")
        txt(ax, 33.4, ly + 0.1, body, fs=3.7, color=SLATE, ha="left")
        ly -= 5.9

    txt(ax, 4.4 + cw / 2, 23.8, "one action creates two problems",
        fs=4.0, color=GREY, style="italic")

    # ---------- what good teams do
    section(ax, 52.0, 57.0, 45.0, "what good teams do", color=NAVY)
    ideas = [("Space the floor", "keep the lanes open so a drive is not into traffic", BLUE),
             ("Move the ball", "a pass is faster than a dribble; two beat one", GREEN),
             ("Move without it", "cut, screen and replace \u2014 the ball finds movement", ORANGE),
             ("Play in roles", "every player knows the job on both ends", PURPLE),
             ("Communicate", "call the screen and the switch before contact", TEAL)]
    y = 52.8
    for head, body, col in ideas:
        ax.add_patch(Circle((53.8, y + 0.9), 0.75, fc=col, ec="none", zorder=5))
        txt(ax, 55.8, y + 1.6, head, fs=4.8, color=NAVY, weight="bold", ha="left")
        txt(ax, 55.8, y - 0.2, body, fs=4.0, color=SLATE, ha="left")
        y -= 5.0

    rbox(ax, 52.0, 23.0, 45.0, 5.8, fc=WASH, ec=LINE, lw=0.7, r=0.7)
    txt(ax, 54.0, 27.1, "Man-to-man or zone?", fs=4.4, color=NAVY, weight="bold",
        ha="left")
    txt(ax, 54.0, 24.8, "Man-to-man marks a player; a zone guards an area.\nThe choice sets the whole tempo of the game.",
        fs=4.0, color=SLATE, ha="left", lh=1.45)

    # ---------- transition
    section(ax, 3.0, 21.4, 94.0, "from defence to attack", color=NAVY)
    stages = [("1", "Defensive rebound", "the first pass is the most valuable one"),
              ("2", "Outlet pass", "to the sideline, ahead of the dribbler"),
              ("3", "Fill the lanes", "two wings sprint wide, one trails"),
              ("4", "Attack the rim", "decide in three seconds, before the defence sets")]
    x = 3.0
    for i, (n, head, body) in enumerate(stages):
        rbox(ax, x, 7.8, 21.4, 10.6, fc=WHITE, ec=LINE, lw=0.6, r=0.7)
        ax.add_patch(Circle((x + 3.0, 16.0), 1.4, fc=BLUE, ec="none", zorder=5))
        txt(ax, x + 3.0, 15.95, n, fs=4.8, color=WHITE, weight="bold", z=7)
        txt(ax, x + 1.6, 13.2, head, fs=4.6, color=NAVY, weight="bold", ha="left")
        txt(ax, x + 1.6, 10.4, body, fs=3.8, color=SLATE, ha="left")
        if i < 3:
            arrow(ax, (x + 21.6, 13.1), (x + 24.4, 13.1), color=GREY, lw=1.0, mut=7)
        x += 23.7

    p.caption("Basketball is five decisions made at once: the team that shares the idea shares the ball.")
    p.save(path)


# ==================================================== 21  Fitness, safety
def fig21(path):
    p = Page(21, "Plate 21 \u2022 Preparation", "Fitness, Safety and Sportsmanship",
             "The body is trained, protected and then respected")
    ax = p.ax

    # ---------- session shape
    section(ax, 3.0, 57.0, 44.0, "the shape of a session", color=NAVY)
    bar = [("Warm-up", 18, PALE_O, ORANGE_D), ("Skills and tactics", 57, PALE_B, BLUE_D),
           ("Cool-down", 25, PALE_G, GREEN_D)]
    x = 3.0
    for head, pct, fc_, tc_ in bar:
        w = 44.0 * pct / 100.0
        box(ax, x, 47.4, w, 6.0, fc=fc_, ec=WHITE, lw=1.0, z=3)
        txt(ax, x + w / 2, 51.0, head, fs=4.5, color=tc_, weight="bold")
        txt(ax, x + w / 2, 49.0, f"{pct}% of the time", fs=3.8, color=tc_)
        x += w

    sub = ["raise", "mobilise", "activate", "skill"]
    cw_ = 10.4
    for i, s_ in enumerate(sub):
        chip(ax, 3.0 + i * 11.0, 41.0, cw_, 3.6, s_, WHITE, tc=ORANGE_D, ec=ORANGE,
             fs=4.0, r=0.6)
    txt(ax, 3.0, 38.0, "Warm-up: raise the pulse, mobilise the joints, activate the hips and shoulders, then touch the ball.",
        fs=4.0, color=SLATE, ha="left")
    txt(ax, 3.0, 35.2, "Cool-down: easy jog, static stretch of calves and hamstrings, water and food within the hour.",
        fs=4.0, color=SLATE, ha="left")

    rbox(ax, 3.0, 24.0, 44.0, 8.4, fc=WASH, ec=LINE, lw=0.7, r=0.7)
    txt(ax, 5.0, 30.2, "The rule of the session", fs=4.4, color=NAVY, weight="bold",
        ha="left")
    txt(ax, 5.0, 27.0, "Quality before quantity: a tired player rehearses\nbad habits. Stop the drill while it is still sharp.",
        fs=4.0, color=SLATE, ha="left", lh=1.45)

    # ---------- fitness components
    section(ax, 52.0, 57.0, 45.0, "the five components", color=NAVY)
    comps = [("Speed", "first step, close-out, fast break", BLUE),
             ("Agility", "stop, pivot and change direction", GREEN),
             ("Endurance", "repeat sprints for four quarters", ORANGE),
             ("Strength", "hold position, absorb contact", PURPLE),
             ("Mobility", "ankles, hips and shoulders stay free", TEAL)]
    y = 53.0
    for head, body, col in comps:
        ax.add_patch(Circle((53.8, y + 0.7), 0.7, fc=col, ec="none", zorder=5))
        txt(ax, 55.8, y + 1.4, head, fs=4.6, color=NAVY, weight="bold", ha="left")
        txt(ax, 55.8, y - 0.5, body, fs=3.9, color=SLATE, ha="left")
        y -= 4.6

    # ---------- injuries
    section(ax, 52.0, 31.8, 45.0, "injuries you will see", color=NAVY)
    inj = [("Ankle sprain", "off the court, ice, compress, elevate", RED),
           ("Jammed finger", "tape it to its neighbour, ice after", ORANGE),
           ("Cramp", "stretch the muscle, sip fluids slowly", TEAL),
           ("Knee twist", "stop playing; a professional assesses it", PURPLE)]
    for i, (head, body, col) in enumerate(inj):
        cx = 52.0 + (i % 2) * 22.8
        cy = 27.2 - (i // 2) * 4.2
        txt(ax, cx, cy + 1.9, head, fs=4.2, color=col, weight="bold", ha="left")
        txt(ax, cx, cy + 0.3, body, fs=3.7, color=SLATE, ha="left")

    # ---------- fair play / safety
    section(ax, 3.0, 21.2, 44.0, "fair play", color=NAVY)
    rbox(ax, 3.0, 7.6, 44.0, 12.0, fc=PALE_G, ec=GREEN, lw=0.65, r=0.7)
    fair = ["Shake hands before and after the game",
            "Respect the referee's call, even when it is wrong",
            "Help an opponent up; never mock a mistake",
            "Credit a teammate's pass as loudly as a score"]
    for i, line in enumerate(fair):
        ax.add_patch(Circle((4.6, 17.0 - i * 2.6), 0.28, fc=GREEN, ec="none", zorder=6))
        txt(ax, 5.8, 17.0 - i * 2.6, line, fs=3.9, color=SLATE, ha="left")

    section(ax, 52.0, 21.2, 45.0, "safety on court", color=NAVY)
    rbox(ax, 52.0, 7.6, 45.0, 12.0, fc=PALE_R, ec=RED, lw=0.65, r=0.7)
    safe = ["No jewellery, watches or loose hair ties",
            "Nails cut short; ankles taped or braced",
            "Water at every break, not only at half-time",
            "Land on two feet, and never on a foot"]
    for i, line in enumerate(safe):
        ax.add_patch(Circle((53.6, 17.0 - i * 2.6), 0.28, fc=RED, ec="none", zorder=6))
        txt(ax, 54.8, 17.0 - i * 2.6, line, fs=3.9, color=SLATE, ha="left")

    p.caption("Fitness protects performance, safety protects the player, and sportsmanship protects the game.")
    p.save(path)


# ==================================================== 22  Status in India
def fig22(path):
    p = Page(22, "Plate 22 \u2022 The Game in India", "Current Status in India",
             "A long history, a large base, a pathway still being built")
    ax = p.ax

    # ---------- pathway pyramid
    section(ax, 3.0, 57.0, 44.0, "the pathway", color=NAVY)
    tiers = [("Grassroots", "school and club coaching, inter-school meets", GREEN, 42.0),
             ("District and state", "selection trials, state championships", TEAL, 34.0),
             ("National", "senior and junior nationals run by the BFI", BLUE, 26.0),
             ("International", "FIBA Asia and world qualifying events", NAVY, 18.0)]
    ybase = 51.4
    for i, (head, body, col, w) in enumerate(tiers):
        y0 = ybase - (i + 1) * 6.4
        pts = [(25.0 - w / 2, y0), (25.0 + w / 2, y0),
               (25.0 + w / 2 - 1.6, y0 + 6.0), (25.0 - w / 2 + 1.6, y0 + 6.0)]
        ax.add_patch(Polygon(pts, closed=True, fc=col, ec=WHITE, lw=1.2, zorder=4))
        txt(ax, 25.0, y0 + 3.8, head, fs=4.8, color=WHITE, weight="bold", z=6)
        txt(ax, 25.0, y0 + 2.0, body, fs=3.7, color="#EAF1F8", z=6)

    txt(ax, 25.0, 24.4, "Each tier depends on the one beneath it", fs=4.1, color=GREY,
        style="italic")

    # ---------- the numbers
    section(ax, 3.0, 21.6, 44.0, "the numbers", color=NAVY)
    nums = [("1936", "India joins FIBA,\nthe year of the\nBerlin Olympics"),
            ("1950", "the Basketball\nFederation of India\nis founded"),
            ("212", "national federations\nnow play under the\nFIBA rulebook")]
    x = 3.0
    for big, small in nums:
        rbox(ax, x, 8.2, 13.6, 11.0, fc=WASH, ec=LINE, lw=0.6, r=0.6)
        txt(ax, x + 6.8, 16.0, big, fs=10.2, color=BLUE, weight="bold")
        txt(ax, x + 6.8, 11.4, small, fs=3.6, color=SLATE, lh=1.45)
        x += 15.2

    # ---------- who runs the game
    section(ax, 52.0, 57.0, 45.0, "who runs the game", color=NAVY)
    who = [("Basketball Federation of India",
            "founded 1950; runs the national championships", BLUE),
           ("State associations",
            "affiliated units that run leagues and selections", GREEN),
           ("Sports Authority and academies",
            "infrastructure, scholarships, elite training", ORANGE),
           ("Leagues and 3x3",
            "city leagues, college circuits, half-court events", PURPLE)]
    y = 49.4
    for head, body, col in who:
        rbox(ax, 52.0, y, 45.0, 6.0, fc=WHITE, ec=LINE, lw=0.6, r=0.6)
        ax.add_patch(Rectangle((52.5, y + 0.7), 0.7, 4.6, fc=col, ec="none", zorder=4))
        txt(ax, 54.8, y + 4.0, head, fs=4.4, color=col, weight="bold", ha="left")
        txt(ax, 54.8, y + 1.8, body, fs=3.9, color=SLATE, ha="left")
        y -= 6.8

    # ---------- the challenge
    section(ax, 52.0, 24.6, 45.0, "the challenge", color=NAVY)
    rbox(ax, 52.0, 8.2, 45.0, 14.4, fc=PALE_Y, ec=GOLD, lw=0.65, r=0.7)
    pts = ["Few full-size indoor courts outside the big cities",
           "School competition is uneven and often ends early",
           "Coaching qualifications are still being formalised",
           "3x3, school leagues and academies are widening the base",
           "More Indian players now train abroad in college systems"]
    for i, line in enumerate(pts):
        col = GOLD if i < 3 else GREEN
        ax.add_patch(Circle((53.8, 20.4 - i * 2.5), 0.28, fc=col, ec="none", zorder=6))
        txt(ax, 55.2, 20.4 - i * 2.5, line, fs=3.9, color=SLATE, ha="left")

    p.caption("The game in India grows where school and college competition is organised, not only where a court exists.")
    p.save(path)


if __name__ == "__main__":
    import sys, os
    out = sys.argv[1] if len(sys.argv) > 1 else "figs"
    os.makedirs(out, exist_ok=True)
    for i, f in zip(range(19, 23), [fig19, fig20, fig21, fig22]):
        f(f"{out}/plate{i:02d}.png")
        print("ok", i)
