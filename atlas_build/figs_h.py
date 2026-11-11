"""
Plates 36-38 of the CUUV102 Basketball Diagram Atlas.
36 Game administration   37 Master comparison   38 Four areas for the viva
"""
import numpy as np
from toolkit import *          # noqa: F401,F403
from matplotlib.patches import Circle, Rectangle, Polygon, FancyBboxPatch


# ==================================================== 36  Game administration
def fig36(path):
    p = Page(36, "Plate 36 \u2022 FIBA vs NBA", "Game Administration",
             "Who runs the game, and where the decisions are made")
    ax = p.ax

    # ---------- FIBA crew
    section(ax, 3.0, 57.4, 44.0, "FIBA: the crew on the floor", color=BLUE)
    crew = [("Crew chief", "the senior official; signs the scoresheet", NAVY),
            ("Umpire 1", "leads the trail position", BLUE),
            ("Umpire 2", "leads the lead position", TEAL),
            ("Table crew", "scorer, timer, shot-clock operator", GREY)]
    y = 52.0
    for head, body, col in crew:
        ax.add_patch(Circle((5.0, y + 1.2), 1.3, fc=col, ec="none", zorder=5))
        txt(ax, 5.0, y + 1.15, head[0], fs=4.2, color=WHITE, weight="bold", z=7)
        txt(ax, 8.0, y + 2.0, head, fs=4.5, color=col if col != GREY else NAVY,
            weight="bold", ha="left")
        txt(ax, 8.0, y + 0.1, body, fs=3.7, color=SLATE, ha="left")
        y -= 5.6

    txt(ax, 3.0, 30.2, "Two or three referees, one table crew.", fs=4.0,
        color=NAVY, weight="bold", ha="left")
    txt(ax, 3.0, 28.2, "No replay centre; the crew on the floor decides.", fs=3.8,
        color=SLATE, ha="left")

    # ---------- NBA crew
    section(ax, 52.0, 57.4, 45.0, "NBA: the crew, plus a replay centre", color=ORANGE)
    crew2 = [("Crew chief", "the senior official; speaks for the crew", NAVY),
             ("Two referees", "lead, trail and centre positions", ORANGE),
             ("Alternate", "stands by in case of injury", GREY),
             ("Replay centre", "reviews in Secaucus and advises", PURPLE)]
    y = 52.0
    for head, body, col in crew2:
        ax.add_patch(Circle((54.0, y + 1.2), 1.3, fc=col, ec="none", zorder=5))
        txt(ax, 54.0, y + 1.15, head[0], fs=4.2, color=WHITE, weight="bold", z=7)
        txt(ax, 57.0, y + 2.0, head, fs=4.5, color=col if col != GREY else NAVY,
            weight="bold", ha="left")
        txt(ax, 57.0, y + 0.1, body, fs=3.7, color=SLATE, ha="left")
        y -= 5.6

    txt(ax, 52.0, 30.2, "Three referees on the floor, plus a replay centre.", fs=4.0,
        color=NAVY, weight="bold", ha="left")
    txt(ax, 52.0, 28.2, "The centre advises; the crew chief applies the ruling.", fs=3.8,
        color=SLATE, ha="left")

    # ---------- the scoresheet
    section(ax, 3.0, 24.0, 94.0, "what the scoresheet records, in both codes", color=NAVY)
    txt(ax, 3.0, 21.0, "The scoresheet is the legal record of the game: it is signed by the crew chief and the captain,",
        fs=3.8, color=SLATE, ha="left")
    txt(ax, 3.0, 19.4, "and it decides any protest. Both codes record the same five categories.",
        fs=3.8, color=SLATE, ha="left")
    items = [("Players", "number, name, minutes played", BLUE),
             ("Scoring", "field goals, three-pointers, free throws", GREEN),
             ("Fouls", "personal and team, per quarter", RED),
             ("Time-outs", "used, and when they were taken", ORANGE),
             ("Officials", "names of the crew and the scorer", PURPLE)]
    x = 3.0
    for head, body, col in items:
        rbox(ax, x, 7.6, 17.4, 9.0, fc=WHITE, ec=LINE, lw=0.55, r=0.6)
        ax.add_patch(Rectangle((x + 0.2, 8.2), 0.6, 7.8, fc=col, ec="none", zorder=4))
        txt(ax, x + 2.2, 14.0, head, fs=4.3, color=col, weight="bold", ha="left")
        txt(ax, x + 2.2, 10.6, body, fs=3.4, color=SLATE, ha="left", lh=1.35)
        x += 18.8

    p.caption("FIBA keeps every decision on the floor; the NBA adds a replay centre to support the crew.")
    p.save(path)


# ==================================================== 37  Master comparison
def fig37(path):
    p = Page(37, "Plate 37 \u2022 FIBA vs NBA", "Master Comparison",
             "One table to revise from")
    ax = p.ax

    txt(ax, 3.0, 56.4, "AREA", fs=4.2, color=NAVY, weight="bold", ha="left")
    txt(ax, 45.0, 56.4, "FIBA", fs=4.2, color=BLUE, weight="bold", ha="left")
    txt(ax, 72.0, 56.4, "NBA", fs=4.2, color=ORANGE_D, weight="bold", ha="left")

    rows = [("Court", "28.00 \u00d7 15.00 m", "28.65 \u00d7 15.24 m"),
            ("3-point line", "6.75 m arc, 6.60 m corner", "7.24 m arc, 6.70 m corner"),
            ("Playing time", "4 \u00d7 10 min = 40", "4 \u00d7 12 min = 48"),
            ("Overtime", "5 min, repeated", "5 min, repeated"),
            ("Shot clock", "24 s, 14 s reset, 8 s", "24 s, 14 s reset, 8 s"),
            ("Foul limit", "5 personal", "6 personal"),
            ("Team fouls", "5th in a quarter \u2192 bonus", "5th in a quarter \u2192 penalty"),
            ("Held ball", "possession arrow", "jump ball"),
            ("Defensive 3 s", "no separate rule", "applies"),
            ("Time-outs", "2 + 3; 1 per overtime", "7; 2 per overtime"),
            ("Length of time-out", "30 seconds", "60 seconds"),
            ("Coach's challenge", "1", "1, plus a second if it works"),
            ("Ring height", "3.05 m", "3.05 m"),
            ("Free-throw line", "5.80 m from the end line", "5.79 m from the end line"),
            ("Key width", "4.90 m", "4.88 m")]

    y = 53.0
    for i, (area, f_, n_) in enumerate(rows):
        if i % 2 == 0:
            box(ax, 3.0, y - 1.25, 94.0, 2.5, fc=WASH, ec="none", z=2)
        txt(ax, 4.0, y, area, fs=3.7, color=NAVY, weight="bold", ha="left")
        txt(ax, 45.0, y, f_, fs=3.6, color=BLUE, ha="left")
        txt(ax, 72.0, y, n_, fs=3.6, color=ORANGE_D, ha="left")
        ax.plot([3.0, 97.0], [y - 1.25, y - 1.25], color=LINE, lw=0.35, zorder=3)
        y -= 2.5

    rbox(ax, 3.0, 6.8, 94.0, 4.2, fc=PALE_Y, ec=GOLD, lw=0.6, r=0.5)
    txt(ax, 50.0, 8.9, "Fifteen rows: learn them in this order \u2014 court, time, fouls, possession, stoppages.",
        fs=3.9, color=NAVY, weight="bold")

    p.caption("The master table: every difference on one page, with the shared numbers left unmarked.")
    p.save(path)


# ==================================================== 38  Four key areas
def fig38(path):
    p = Page(38, "Plate 38 \u2022 FIBA vs NBA", "Four Areas for the Viva",
             "What an examiner is likely to ask, and how to answer")
    ax = p.ax

    areas = [("1", "The court", "28 \u00d7 15 m against 28.65 \u00d7 15.24 m; the arc is\n0.49 m further out in the NBA, the corner 0.10 m",
              BLUE),
             ("2", "Time", "40 minutes against 48; both play 5-minute overtimes\nand both use a 24-second clock",
              GREEN),
             ("3", "Fouls and stoppages", "five against six; both start the bonus on the fifth\nteam foul; 30-second against 60-second time-outs",
              ORANGE),
             ("4", "Possession and review", "the arrow against the jump ball; the defensive\nthree-second rule; one challenge, two in the NBA",
              PURPLE)]

    y = 50.4
    for n, head, body, col in areas:
        rbox(ax, 3.0, y, 60.0, 10.4, fc=WHITE, ec=LINE, lw=0.6, r=0.7)
        ax.add_patch(Rectangle((3.25, y + 0.6), 0.75, 9.2, fc=col, ec="none", zorder=4))
        ax.add_patch(Circle((8.6, y + 7.4), 2.0, fc=col, ec="none", zorder=5))
        txt(ax, 8.6, y + 7.35, n, fs=6.2, color=WHITE, weight="bold", z=7)
        txt(ax, 12.4, y + 7.6, head, fs=5.2, color=col, weight="bold", ha="left")
        txt(ax, 12.4, y + 3.6, body, fs=3.8, color=SLATE, ha="left", lh=1.6)
        y -= 11.6

    # ---------- how to answer
    section(ax, 66.0, 53.4, 31.0, "how to answer", color=NAVY)
    steps = ["Name the rule in FIBA terms first.",
             "State the NBA position in one sentence.",
             "Give the number that proves it.",
             "One line on why the difference exists.",
             "Finish with what it changes on the floor."]
    for i, line in enumerate(steps):
        yy = 49.8 - i * 4.0
        ax.add_patch(Circle((67.4, yy), 0.95, fc=GOLD, ec="none", zorder=6))
        txt(ax, 67.4, yy - 0.05, str(i + 1), fs=3.8, color=NAVY, weight="bold", z=7)
        txt(ax, 69.4, yy, line, fs=3.6, color=SLATE, ha="left")

    rbox(ax, 66.0, 26.4, 31.0, 6.0, fc=PALE_Y, ec=GOLD, lw=0.6, r=0.6)
    txt(ax, 67.6, 30.6, "Five sentences is a full answer:", fs=3.9, color=NAVY,
        weight="bold", ha="left")
    txt(ax, 67.6, 28.4, "rule, contrast, number, reason, effect.", fs=3.7,
        color=SLATE, ha="left")

    rbox(ax, 66.0, 12.6, 31.0, 11.8, fc=WASH, ec=LINE, lw=0.6, r=0.6)
    txt(ax, 67.6, 22.4, "Three traps to avoid", fs=4.0, color=NAVY, weight="bold",
        ha="left")
    traps = ["Saying the courts are the same size",
             "Claiming different ring heights",
             "Forgetting overtime is 5 min in both"]
    for i, line in enumerate(traps):
        yy = 19.6 - i * 3.2
        ax.add_patch(Circle((67.9, yy), 0.26, fc=GOLD, ec="none", zorder=6))
        txt(ax, 69.1, yy, line, fs=3.4, color=SLATE, ha="left")

    p.caption("Four areas, five sentences each: the whole comparison can be answered in four short paragraphs.")
    p.save(path)


if __name__ == "__main__":
    import sys, os
    out = sys.argv[1] if len(sys.argv) > 1 else "figs"
    os.makedirs(out, exist_ok=True)
    for i, f in zip(range(36, 39), [fig36, fig37, fig38]):
        f(f"{out}/plate{i:02d}.png")
        print("ok", i)
