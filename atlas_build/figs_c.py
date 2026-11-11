from toolkit import *
import numpy as np


# ==================================================== 13  Fouls
def fig13(path):
    p = Page(13, "Plate 13 \u2022 Fouls", "Fouls and Their Penalties",
             "Illegal contact, misconduct \u2014 and what the referee awards")
    ax = p.ax

    # ---------- foul family
    rbox(ax, 20.0, 54.2, 60.0, 4.8, fc=NAVY, ec="none", r=0.8)
    txt(ax, 50.0, 56.6, "A FOUL IS AN INFRINGEMENT INVOLVING CONTACT", fs=5.0,
        color=WHITE, weight="bold")
    kids = [("PERSONAL", "contact with an opponent", BLUE, PALE_B),
            ("TECHNICAL", "misconduct, no contact", PURPLE, PALE_P),
            ("UNSPORTSMANLIKE", "not a legitimate play on the ball", RED, PALE_R)]
    xs = [19.0, 50.0, 81.0]
    for (head, body, col, wash), x in zip(kids, xs):
        ax.plot([50.0, x], [54.0, 50.6], color=LINE, lw=0.9, zorder=3)
        rbox(ax, x - 14.0, 44.2, 28.0, 6.2, fc=wash, ec=col, lw=0.8, r=0.8)
        txt(ax, x, 48.2, head, fs=5.3, color=col, weight="bold")
        txt(ax, x, 45.8, body, fs=4.1, color=SLATE)

    # ---------- common personal fouls (left)
    section(ax, 3.0, 39.6, 43.0, "common personal fouls", color=NAVY)
    fouls = [("Blocking", "defender not in a legal guarding position"),
             ("Charging", "attacker runs into a stationary defender"),
             ("Holding", "restricting an opponent's movement"),
             ("Pushing", "displacing an opponent with hands or body"),
             ("Illegal screen", "no space or time given to the opponent"),
             ("Hand checking", "a hand kept on an opponent to slow them")]
    y = 34.8
    for head, body in fouls:
        ax.add_patch(Circle((4.4, y), 0.55, fc=BLUE, ec="none", zorder=5))
        txt(ax, 6.2, y + 0.9, head, fs=4.8, color=NAVY, weight="bold", ha="left")
        txt(ax, 6.2, y - 0.9, body, fs=4.0, color=SLATE, ha="left")
        y -= 4.0

    # ---------- penalty ladder (right)
    section(ax, 52.0, 39.6, 45.0, "the penalty ladder", color=NAVY)
    steps = [("1", "Throw-in", "most fouls below the team-foul limit", MIST),
             ("2", "Two free throws", "foul on a shooter inside the arc", BLUE),
             ("3", "Three free throws", "foul on a shooter beyond the arc", ORANGE),
             ("4", "Bonus", "from the 5th team foul of the quarter", RED)]
    y = 34.2
    for n, head, body, col in steps:
        bg = "#E6EBF1" if col == MIST else col
        rbox(ax, 52.0, y - 1.6, 45.0, 5.2, fc=bg, ec="none", r=0.7)
        ax.add_patch(Circle((54.6, y + 1.0), 1.2, fc=WHITE, ec="none", zorder=6))
        txt(ax, 54.6, y + 0.95, n, fs=4.4, color=NAVY if col == MIST else col,
            weight="bold", z=7)
        txt(ax, 57.4, y + 2.0, head, fs=4.9, color=NAVY if col == MIST else WHITE,
            weight="bold", ha="left")
        txt(ax, 57.4, y + 0.2, body, fs=4.0, color=SLATE if col == MIST else "#EAF1F8",
            ha="left")
        y -= 6.0

    # ---------- note
    rbox(ax, 3.0, 7.6, 94.0, 5.6, fc=WASH, ec=LINE, lw=0.7, r=0.8)
    txt(ax, 5.2, 11.9, "REMEMBER", fs=4.6, color=NAVY, weight="bold", ha="left")
    txt(ax, 5.2, 9.4,
        "Five personal fouls remove a FIBA player (six in the NBA) \u2022 team fouls decide when free throws start \u2022 a foul on a shooter is judged by where the shooter was standing.",
        fs=4.1, color=SLATE, ha="left")

    p.caption("FIBA Official Basketball Rules 2026, Articles 34\u201336; NBA Rulebook Rule 12.")
    p.save(path)


# ==================================================== 14  Officials
def fig14(path):
    p = Page(14, "Plate 14 \u2022 Officiating", "Referees and Table Officials",
             "Three on the floor, four at the table")
    ax = p.ax

    # ---------- crew positions
    cw = 44.0
    ch = cw * 15.0 / 28.0
    c = Court(ax, 3.0, 32.4, cw, ch, spec=FIBA, full=True, fc="#FBFDFF", lw=0.7)
    c.halves(1, c2="#EAF2F9", alpha3=0.4, alpha2=1.0)
    c.halves(-1, c2="#EAF2F9", alpha3=0.4, alpha2=1.0)
    c.draw(ends=(1, -1), lw=0.7)

    refs = [("LEAD", 6.2, 1.6, BLUE), ("TRAIL", 20.0, 12.4, ORANGE),
            ("CENTRE", 13.4, 3.4, GREEN)]
    for tag, d, y, col in refs:
        x, yy = c.pt(d, y, 1)
        ax.add_patch(Circle((x, yy), 1.5, fc=col, ec=WHITE, lw=0.9, zorder=8))
        txt(ax, x, yy - 0.1, "R", fs=4.4, color=WHITE, weight="bold", z=9)
        txt(ax, x, yy + 2.5, tag, fs=4.3, color=col, weight="bold")

    # ---------- table crew
    section(ax, 52.0, 56.4, 45.0, "the table crew", color=NAVY)
    crew = [("Scorer", "records line-ups, points, fouls", BLUE),
            ("Assistant scorer", "operates the possession arrow", TEAL),
            ("Timer", "starts and stops the game clock", ORANGE),
            ("Shot-clock operator", "runs the 24-second clock", PURPLE)]
    y = 53.0
    for head, body, col in crew:
        rbox(ax, 52.0, y - 1.6, 45.0, 5.2, fc=WHITE, ec=LINE, lw=0.6, r=0.6)
        ax.add_patch(Rectangle((52.0, y - 1.6), 1.1, 5.2, fc=col, ec="none", zorder=4))
        txt(ax, 54.4, y + 1.9, head, fs=5.0, color=col, weight="bold", ha="left")
        txt(ax, 54.4, y + 0.2, body, fs=4.2, color=SLATE, ha="left")
        y -= 6.2

    rbox(ax, 52.0, 28.0, 45.0, 8.0, fc=WASH, ec=LINE, lw=0.7, r=0.7)
    txt(ax, 54.0, 34.0, "HOW THE CREW WORKS", fs=4.7, color=NAVY, weight="bold",
        ha="left")
    txt(ax, 54.0, 31.0,
        "The three referees rotate positions on every change of\n"
        "possession, so the lead official is always under the basket\n"
        "and the trail official can watch the play develop.",
        fs=4.3, color=SLATE, ha="left", lh=1.5)

    # ---------- signals
    section(ax, 3.0, 28.4, 94.0, "the hand signals you must recognise", color=NAVY)
    sigs = [("F", "Foul", "raised fist,\nthen point", RED),
            ("V", "Violation", "open hand,\nflat and held", ORANGE),
            ("T", "Time-out", "T made with\nthe hands", BLUE),
            ("S", "Substitution", "forearms\ncrossed", GREEN),
            ("C", "Count", "finger count\nfor 3 s / 5 s", PURPLE),
            ("B", "Basket counts", "fingers pointing\ndown", TEAL)]
    x = 3.0
    for letter, head, body, col in sigs:
        rbox(ax, x, 9.2, 14.6, 15.0, fc=WHITE, ec=col, lw=0.7, r=0.8)
        ax.add_patch(Circle((x + 7.3, 20.0), 2.6, fc=col, ec="none", zorder=5))
        txt(ax, x + 7.3, 19.95, letter, fs=8.0, color=WHITE, weight="bold", z=7)
        txt(ax, x + 7.3, 15.4, head, fs=4.8, color=col, weight="bold")
        txt(ax, x + 7.3, 12.4, body, fs=4.1, color=SLATE, lh=1.3)
        x += 15.4

    p.caption("FIBA Officiating Manual: a crew of three referees supported by the scorer's table.")
    p.save(path)


# ==================================================== 15  Stance & footwork
def fig15(path):
    p = Page(15, "Plate 15 \u2022 Fundamentals", "Stance and Footwork",
             "The base for every dribble, pass and shot")
    ax = p.ax

    # ---------- triple threat stance
    cx = 13.0
    hip, sh, head = 24.0, 32.0, 35.4
    # legs
    for s in (-1, 1):
        ax.plot([cx, cx + 3.2 * s, cx + 3.8 * s], [hip, 20.0, 16.0],
                color=BLUE_D, lw=3.0, zorder=5, solid_capstyle="round",
                solid_joinstyle="round")
        ax.plot([cx + 3.8 * s - 1.0, cx + 3.8 * s + 1.0], [15.8, 15.8], color=INK,
                lw=2.0, zorder=5, solid_capstyle="round")
    # torso
    ax.plot([cx, cx], [hip, sh], color=BLUE, lw=3.4, zorder=4, solid_capstyle="round",
            alpha=0.55)
    # arms to the ball at chest height
    for s in (-1, 1):
        ax.plot([cx + 2.8 * s, cx + 3.6 * s, cx + 1.5 * s], [sh - 0.6, 28.2, 30.9],
                color=BLUE_D, lw=2.2, zorder=5, solid_capstyle="round",
                solid_joinstyle="round")
    ball(ax, cx, 31.0, r=1.6)
    ax.add_patch(Circle((cx, head), 1.55, fc=BLUE, ec=WHITE, lw=1.0, zorder=6))

    labels = [("ball held at chest, elbows in", (cx + 1.6, 31.2), 33.6),
              ("eyes on the court, not the ball", (cx + 1.7, head), 36.6),
              ("knees bent, hips low, weight forward", (cx + 3.4, 20.2), 23.0),
              ("feet a little wider than the shoulders", (cx + 4.6, 16.2), 18.4)]
    for text, pt, ly in labels:
        leader(ax, pt[0], pt[1], cx + 11.0, ly, text, fs=4.4, ha="left")

    txt(ax, cx + 4.0, 12.6, "TRIPLE-THREAT STANCE", fs=5.6, color=NAVY, weight="bold")
    txt(ax, cx + 4.0, 10.2, "from here a player can shoot, pass or drive",
        fs=4.4, color=GREY)

    # ---------- pivots
    section(ax, 46.0, 56.4, 51.0, "pivoting on the back foot", color=NAVY)
    for i, (label, ang, col, note) in enumerate(
            [("FRONT PIVOT", 62, BLUE, "turn toward the basket"),
             ("REVERSE PIVOT", 128, ORANGE, "turn away from the defender")]):
        pcx, pcy = 60.0 + i * 23.0, 47.0
        ax.add_patch(Circle((pcx, pcy), 5.6, fc="#F4F8FC", ec=LINE, lw=0.7, zorder=3))
        ax.add_patch(Circle((pcx, pcy), 0.85, fc=SLATE, ec="none", zorder=6))
        ax.plot([pcx, pcx + 4.6], [pcy, pcy], color=MIST, lw=0.8, ls=(0, (2, 2)),
                zorder=4)
        a = np.radians(np.linspace(-8, ang, 50))
        ax.plot(pcx + 4.2 * np.cos(a), pcy + 4.2 * np.sin(a), color=col, lw=1.4,
                zorder=5)
        arrow(ax, (pcx + 4.2 * np.cos(a[-3]), pcy + 4.2 * np.sin(a[-3])),
              (pcx + 4.2 * np.cos(a[-1]), pcy + 4.2 * np.sin(a[-1])), color=col,
              lw=1.4, mut=9)
        txt(ax, pcx, pcy + 6.6, label, fs=5.0, color=col, weight="bold")
        txt(ax, pcx, pcy - 6.8, note, fs=4.2, color=SLATE)

    # ---------- stopping legally
    section(ax, 46.0, 35.4, 51.0, "stopping legally", color=NAVY)
    stops = [("JUMP STOP", "land on both feet at the same time \u2014 either foot\nmay then become the pivot foot", BLUE),
             ("STRIDE STOP", "land on one foot, then the other \u2014 the first foot\nto touch the floor is the pivot foot", GREEN)]
    y = 30.0
    for head, body, col in stops:
        rbox(ax, 46.0, y - 1.6, 51.0, 5.4, fc=WHITE, ec=col, lw=0.65, r=0.6)
        txt(ax, 48.0, y + 2.4, head, fs=4.9, color=col, weight="bold", ha="left")
        txt(ax, 48.0, y + 0.1, body, fs=4.3, color=SLATE, ha="left", lh=1.35)
        y -= 6.6

    # ---------- pivot foot rules
    rbox(ax, 46.0, 8.0, 51.0, 11.8, fc=WASH, ec=LINE, lw=0.7, r=0.7)
    txt(ax, 48.0, 18.2, "CHOOSING THE PIVOT FOOT", fs=4.7, color=NAVY, weight="bold",
        ha="left")
    rules = ["Both feet on the floor when caught \u2014 either may pivot",
             "Caught while moving \u2014 the first foot down is the pivot",
             "Caught in the air \u2014 land on both feet, then choose",
             "Once chosen, it stays put until the ball is released"]
    for i, line in enumerate(rules):
        ax.add_patch(Circle((48.2, 15.6 - i * 2.2), 0.32, fc=GOLD, ec="none", zorder=6))
        txt(ax, 49.4, 15.6 - i * 2.2, line, fs=4.1, color=SLATE, ha="left")

    p.caption("Travelling means moving the pivot foot without dribbling, passing or shooting; footwork is coached first.")
    p.save(path)


# ==================================================== 16  Dribbling
def fig16(path):
    p = Page(16, "Plate 16 \u2022 Fundamentals", "Dribbling",
             "Controlled bouncing that lets a player move with the ball")
    ax = p.ax

    # ---------- why dribble
    section(ax, 3.0, 55.4, 28.0, "why players dribble", color=NAVY)
    why = [("Advance", "move the ball up the court\nwithout giving up a pass", BLUE),
           ("Escape", "get out of pressure, traps\nand double teams", GREEN),
           ("Attack", "beat a defender and get\nto the rim or a pull-up", ORANGE)]
    for i, (head, body, col) in enumerate(why):
        y = 51.4 - i * 5.0
        ax.add_patch(Circle((4.6, y + 1.2), 0.85, fc=col, ec="none", zorder=5))
        txt(ax, 4.6, y + 1.15, str(i + 1), fs=4.4, color=WHITE, weight="bold", z=7)
        txt(ax, 6.6, y + 2.2, head, fs=4.8, color=NAVY, weight="bold", ha="left")
        txt(ax, 6.6, y + 0.2, body, fs=4.0, color=SLATE, ha="left", lh=1.4)

    # ---------- mechanics figure
    fx, fy = 14.0, 13.6          # feet / floor
    hip, sh, head = 24.6, 31.6, 34.0
    section(ax, 3.0, 39.4, 28.0, "ball control: the stance", color=NAVY)
    ax.plot([fx - 7.0, fx + 7.0], [fy, fy], color=INK, lw=1.1, zorder=3)
    for s in (-1, 1):
        ax.plot([fx, fx + 2.4 * s, fx + 3.0 * s], [hip, 19.4, fy],
                color=BLUE_D, lw=3.0, zorder=5, solid_capstyle="round",
                solid_joinstyle="round")
    ax.plot([fx, fx], [hip, sh], color=BLUE, lw=5.0, zorder=4, alpha=0.45,
            solid_capstyle="round")
    ax.add_patch(Circle((fx, head), 1.6, fc=BLUE, ec=WHITE, lw=1.0, zorder=6))
    # dribbling arm (right side of the figure) and guide arm
    ax.plot([fx + 1.2, fx + 5.0, fx + 5.6], [sh - 0.8, 26.6, 22.4],
            color=BLUE_D, lw=2.2, zorder=5, solid_capstyle="round",
            solid_joinstyle="round")
    ax.plot([fx - 1.2, fx - 4.0], [sh - 0.8, 27.6], color=BLUE_D, lw=2.2, zorder=5,
            solid_capstyle="round")
    ball(ax, fx + 5.7, 20.6, r=1.5)
    # bounce path
    dashed(ax, [(fx + 5.7, 18.9), (fx + 5.7, fy)], color=ORANGE_D, lw=0.7)
    for k, yy in enumerate(np.linspace(17.6, fy + 0.8, 5)):
        ax.add_patch(Circle((fx + 5.7, yy), 1.35 - k * 0.2, fc="none", ec=PALE_O,
                            lw=0.9, zorder=3))
    # waist dimension
    dim_v(ax, hip, fx, fx + 10.4, "waist", color=BLUE_D, fs=4.2, offset=1.5)
    txt(ax, fx + 3.2, head - 0.3, "head up,\n eyes level", fs=4.0, color=GREY,
        style="italic", ha="left")

    txt(ax, fx - 4.0, 10.4,
        "push with the fingers, not the palm;\nkeep the bounce low and the elbow close",
        fs=4.2, color=SLATE, lh=1.4)

    # ---------- dribble types
    section(ax, 34.0, 56.4, 63.0, "the dribbles you need", color=NAVY)
    moves = [("Speed dribble", "ball pushed out in front, high bounce,\nfor open-court running", BLUE),
             ("Control dribble", "lower bounce, ball kept near the body,\nprotecting it from a defender", GREEN),
             ("Crossover", "ball switched quickly from one hand\nto the other in front of the body", ORANGE),
             ("Between the legs", "the same change of direction, played\nunder the hips to beat a close defender", PURPLE),
             ("Behind the back", "a change of hand behind the body,\nuseful when the defender cuts the lane", TEAL),
             ("Hesitation", "a pause and a change of pace that\nfreezes the defender for a moment", RED)]
    for i, (head, body, col) in enumerate(moves):
        colx = 34.0 + (i % 2) * 31.4
        rowy = 43.6 - (i // 2) * 12.0
        rbox(ax, colx, rowy, 30.4, 10.6, fc=WHITE, ec=LINE, lw=0.6, r=0.7)
        ax.add_patch(Rectangle((colx + 0.6, rowy + 1.0), 0.7, 8.6, fc=col, ec="none",
                               zorder=4))
        txt(ax, colx + 3.0, rowy + 7.6, head, fs=5.0, color=col, weight="bold", ha="left")
        txt(ax, colx + 3.0, rowy + 3.8, body, fs=4.1, color=SLATE, ha="left", lh=1.4)

    # ---------- illegal
    rbox(ax, 34.0, 7.4, 62.8, 6.4, fc=PALE_R, ec=RED, lw=0.65, r=0.7)
    txt(ax, 36.0, 11.9, "ILLEGAL DRIBBLING", fs=4.7, color=RED, weight="bold", ha="left")
    txt(ax, 36.0, 9.3,
        "Double dribble \u2014 dribbling again after the ball rests in the hands  \u2022  Carrying \u2014 letting the ball rest on the palm",
        fs=4.1, color=SLATE, ha="left")

    p.caption("A dribble ends the moment the ball rests in one or both hands; play resumes with a pass or a shot.")
    p.save(path)


# ==================================================== 17  Passing
def fig17(path):
    p = Page(17, "Plate 17 \u2022 Fundamentals", "Passing",
             "Moving the ball faster than any defender can run")
    ax = p.ax

    section(ax, 3.0, 57.0, 46.0, "one stance, three passes", color=NAVY)

    # ---------- half court with three pass options
    ch = 28.6
    cw = ch * 14.0 / 15.0
    c = Court(ax, 5.0, 24.6, cw, ch, spec=FIBA, full=False, fc="#FBFDFF", lw=0.65)
    c.halves(1, c2="#EAF2F9", alpha3=0.35, alpha2=1.0)
    c.draw(ends=(1,), lw=0.65)

    A = c.pt(8.6, 7.5, 1)
    B = c.pt(7.2, 12.6, 1)
    C = c.pt(3.0, 2.4, 1)
    D = c.pt(4.6, 8.8, 1)
    for pt, tag, col in ((A, "A", BLUE), (B, "B", GREEN), (C, "C", PURPLE),
                         (D, "D", ORANGE)):
        player(ax, pt[0], pt[1], tag, fc=col, r=1.6, fs=4.8)

    arrow(ax, (A[0] - 0.9, A[1] + 1.3), (B[0] + 1.1, B[1] - 1.2), color=GREEN,
          lw=1.1, mut=8, rad=-0.08)
    arrow(ax, (A[0] - 1.3, A[1] - 1.1), (C[0] + 1.3, C[1] + 1.3), color=PURPLE,
          lw=1.1, mut=8, rad=-0.10)
    arrow(ax, (A[0] - 1.5, A[1] + 0.1), (D[0] + 1.4, D[1] + 0.6), color=ORANGE,
          lw=1.1, mut=8, rad=0.10)

    txt(ax, B[0] - 2.4, B[1] + 2.6, "chest pass", fs=4.3, color=GREEN,
        weight="bold", ha="left")
    txt(ax, C[0] + 1.8, C[1] - 1.9, "bounce pass", fs=4.3, color=PURPLE,
        weight="bold", ha="left")
    txt(ax, D[0] - 1.6, D[1] + 2.7, "overhead pass", fs=4.3, color=ORANGE_D,
        weight="bold", ha="left")

    txt(ax, c.x0 + cw / 2, 23.2, "A can hit any of the three from the same stance",
        fs=4.3, color=GREY, style="italic")

    # ---------- mechanics band
    section(ax, 3.0, 21.0, 46.0, "the chest pass, step by step", color=NAVY)
    steps = [("1", "Hold", "ball at the chest, fingers\nspread, elbows tucked in"),
             ("2", "Step", "step toward the receiver,\nweight moving forward"),
             ("3", "Push", "extend both arms, snap\nthe wrists, thumbs down")]
    x = 3.0
    for n, head, body in steps:
        rbox(ax, x, 8.4, 14.4, 9.4, fc=WHITE, ec=BLUE, lw=0.65, r=0.7)
        ax.add_patch(Circle((x + 2.2, 15.4), 1.3, fc=BLUE, ec="none", zorder=5))
        txt(ax, x + 2.2, 15.35, n, fs=4.6, color=WHITE, weight="bold", z=7)
        txt(ax, x + 4.4, 15.5, head, fs=5.0, color=BLUE, weight="bold", ha="left")
        txt(ax, x + 1.4, 11.7, body, fs=3.9, color=SLATE, ha="left", lh=1.5)
        x += 15.8

    # ---------- when to use each
    section(ax, 54.0, 57.0, 43.0, "when to use each", color=NAVY)
    table = [("Chest pass", "quick and flat over short distances", BLUE),
             ("Bounce pass", "under a defender's hands to a cutter", GREEN),
             ("Overhead pass", "over a defender, after a rebound", ORANGE),
             ("Baseball pass", "the long outlet down the court", TEAL),
             ("Hand-off", "close-range give-and-go with a teammate", PURPLE)]
    y = 53.0
    for head, body, col in table:
        ax.add_patch(Circle((55.2, y + 1.0), 0.7, fc=col, ec="none", zorder=5))
        txt(ax, 57.2, y + 1.7, head, fs=4.8, color=NAVY, weight="bold", ha="left")
        txt(ax, 57.2, y - 0.3, body, fs=4.1, color=SLATE, ha="left")
        y -= 4.7

    # ---------- coaching points
    section(ax, 54.0, 27.6, 43.0, "coaching points", color=NAVY)
    rbox(ax, 54.0, 9.6, 43.0, 16.0, fc=WASH, ec=LINE, lw=0.7, r=0.8)
    txt(ax, 56.0, 23.0, "What to say at practice", fs=4.6, color=NAVY, weight="bold", ha="left")
    pts = ["Step toward the target as the ball leaves the hands",
           "Push through the ball with both hands together",
           "Pass to the receiver's hands, not to their feet",
           "Follow through with thumbs pointing down",
           "Call for the ball, then meet the pass in stride"]
    for i, line in enumerate(pts):
        ax.add_patch(Circle((56.2, 20.2 - i * 2.2), 0.3, fc=GOLD, ec="none", zorder=6))
        txt(ax, 57.4, 20.2 - i * 2.2, line, fs=4.0, color=SLATE, ha="left")

    p.caption("The ball travels faster than any player can run: sharp passing beats pressure without extra dribbling.")
    p.save(path)


# ==================================================== 18  Shooting
def fig18(path):
    p = Page(18, "Plate 18 \u2022 Fundamentals", "Shooting and Lay-ups",
             "A repeatable technique, then the easiest two points in the game")
    ax = p.ax

    # ---------- flight paths
    section(ax, 3.0, 57.0, 44.0, "flight path of the ball", color=NAVY)
    ox, oy = 5.0, 41.5
    ax.plot([ox, ox + 40.0], [oy, oy], color=INK, lw=1.1, zorder=4)
    bx = ox + 36.5
    ax.plot([bx, bx], [oy, oy + 7.6], color=SLATE, lw=1.3, zorder=4)
    ax.add_patch(Circle((bx - 0.7, oy + 7.4), 0.55, fc="none", ec=ORANGE_D, lw=1.0,
                        zorder=5))
    for label, x0, peak, col in (("lay-up", 3.0, 3.2, GREEN),
                                 ("free throw", 9.0, 7.4, BLUE),
                                 ("three-pointer", 2.0, 10.6, ORANGE)):
        t = np.linspace(0, 1, 140)
        xs = ox + x0 + (bx - 0.7 - ox - x0) * t
        ys = oy + 2.0 * (1 - t) + 7.4 * t + (peak - 4.0) * 4 * t * (1 - t) * 1.35
        ax.plot(xs, ys, color=col, lw=1.3, zorder=5)
        txt(ax, ox + x0 + 6.0, oy + peak + 1.4, label, fs=4.5, color=col,
            weight="bold")
    txt(ax, ox + 20.0, 39.4, "distance from the basket", fs=4.0, color=GREY)
    txt(ax, ox + 0.4, 34.6,
        "A higher, softer arc gives a bigger target: the ball can\n"
        "drop through the ring from above instead of arriving flat,\n"
        "which is why coaches teach arc before distance.",
        fs=4.3, color=SLATE, ha="left", lh=1.6)

    # ---------- checklist
    section(ax, 52.0, 57.0, 45.0, "the shooting checklist", color=NAVY)
    beef = [("B", "Balance", "feet shoulder-width, square to the basket", BLUE),
            ("E", "Eyes", "fix on the rim, not on the ball", GREEN),
            ("E", "Elbow", "shooting elbow under the ball, in line", ORANGE),
            ("F", "Follow-through", "wrist breaks; the hand hangs in the net", PURPLE)]
    y = 53.0
    for letter, head, body, col in beef:
        ax.add_patch(Circle((54.6, y + 1.2), 2.0, fc=col, ec=WHITE, lw=0.8, zorder=6))
        txt(ax, 54.6, y + 1.15, letter, fs=6.4, color=WHITE, weight="bold", z=7)
        txt(ax, 58.2, y + 2.1, head, fs=5.1, color=NAVY, weight="bold", ha="left")
        txt(ax, 58.2, y + 0.3, body, fs=4.2, color=SLATE, ha="left")
        y -= 5.3

    rbox(ax, 52.0, 30.4, 45.0, 7.0, fc=PALE_Y, ec=GOLD, lw=0.65, r=0.7)
    txt(ax, 54.0, 35.2, "The shot starts in the legs.", fs=4.4, color=NAVY,
        weight="bold", ha="left")
    txt(ax, 54.0, 32.2, "Power flows floor \u2192 knees \u2192 hips \u2192 elbow \u2192 wrist;\nthe arm only guides the ball on its way.",
        fs=4.1, color=NAVY, ha="left", lh=1.5)

    txt(ax, 52.0, 26.4, "SHOT SELECTION: a good shot is open, in range and taken in rhythm \u2014 a forced shot is a pass to the other team.",
        fs=4.1, color=GREY, ha="left", style="italic")

    # ---------- lay-up steps
    section(ax, 3.0, 27.4, 94.0, "the right-handed lay-up, step by step", color=NAVY)
    steps = [("1", "Dribble in", "approach at speed,\nunder control", BLUE),
             ("2", "Left foot", "the take-off foot lands\nand drives upward", GREEN),
             ("3", "Right knee", "drives up as the shooting\nhand lifts the ball", ORANGE),
             ("4", "Release", "off the backboard,\nsoft touch, high", PURPLE),
             ("5", "Land", "on both feet,\nbalanced and ready", RED)]
    x = 3.0
    for n, head, body, col in steps:
        rbox(ax, x, 12.4, 17.4, 11.6, fc=WHITE, ec=col, lw=0.7, r=0.8)
        ax.add_patch(Circle((x + 8.7, 21.0), 1.9, fc=col, ec="none", zorder=5))
        txt(ax, x + 8.7, 20.95, n, fs=5.6, color=WHITE, weight="bold", z=7)
        txt(ax, x + 8.7, 17.4, head, fs=4.9, color=col, weight="bold")
        txt(ax, x + 8.7, 14.6, body, fs=4.0, color=SLATE, lh=1.35)
        x += 18.7

    p.caption("A left-handed lay-up mirrors the pattern: right foot takes off, left knee drives up, left hand releases.")
    p.save(path)


if __name__ == "__main__":
    import sys, os
    out = sys.argv[1] if len(sys.argv) > 1 else "figs"
    os.makedirs(out, exist_ok=True)
    for i, f in zip(range(13, 19), [fig13, fig14, fig15, fig16, fig17, fig18]):
        f(f"{out}/plate{i:02d}.png")
        print("ok", i)
