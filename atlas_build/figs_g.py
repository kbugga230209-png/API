"""
Plates 32-35 of the CUUV102 Basketball Diagram Atlas.
32 Gather and two steps   33 Foul categories 2026
34 The coach's challenge  35 Common features
"""
import numpy as np
from toolkit import *          # noqa: F401,F403
from matplotlib.patches import Circle, Rectangle, Polygon, Wedge, Ellipse


# ==================================================== 32  Gather and two steps
def fig32(path):
    p = Page(32, "Plate 32 \u2022 FIBA vs NBA", "Gather and Two Steps",
             "Where the dribble ends and the travel begins")
    ax = p.ax

    # ---------- the sequence
    section(ax, 3.0, 57.6, 94.0, "the same three moments, in both codes", color=NAVY)

    def foot(x, y, col=NAVY, r=1.0):
        ax.add_patch(Ellipse((x, y), 2 * r, 0.9 * r, fc=col, ec="none", zorder=6))

    base_y = 46.0
    frames = [(10.0, "dribble", "the ball is still bouncing; no step is counted"),
              (33.0, "gather", "the ball comes to rest in the hands \u2014 this is step zero"),
              (56.0, "step one", "the first foot to land after the gather"),
              (79.0, "step two", "the second foot; the player must now pass or shoot")]

    for i, (cx, head, body) in enumerate(frames):
        # a simple figure
        ax.add_patch(Circle((cx, base_y + 7.4), 1.5, fc=BLUE, ec=WHITE, lw=0.8,
                            zorder=6))
        ax.plot([cx, cx], [base_y + 5.9, base_y + 1.6], color=BLUE, lw=3.2,
                alpha=0.5, zorder=5, solid_capstyle="round")
        if i == 0:
            ax.plot([cx - 0.4, cx + 3.4], [base_y + 4.4, base_y + 2.0], color=BLUE_D,
                    lw=2.0, zorder=6, solid_capstyle="round")
            ball(ax, cx + 4.2, base_y + 1.4, r=0.9)
            dashed(ax, [(cx + 4.2, base_y + 0.5), (cx + 4.2, base_y - 2.2)],
                   color=ORANGE_D, lw=0.7)
        else:
            ax.plot([cx - 0.4, cx + 3.2], [base_y + 4.4, base_y + 3.4], color=BLUE_D,
                    lw=2.0, zorder=6, solid_capstyle="round")
            ball(ax, cx + 3.9, base_y + 3.4, r=0.9)
        # legs
        if i <= 1:
            for s in (-1, 1):
                ax.plot([cx, cx + 1.6 * s], [base_y + 1.6, base_y], color=BLUE_D,
                        lw=2.4, zorder=6, solid_capstyle="round")
        else:
            ax.plot([cx, cx - 2.0], [base_y + 1.6, base_y - 0.4], color=BLUE_D,
                    lw=2.4, zorder=6, solid_capstyle="round")
            ax.plot([cx, cx + 2.4], [base_y + 1.6, base_y + 0.6], color=SLATE,
                    lw=2.4, zorder=5, solid_capstyle="round", alpha=0.55)
            foot(cx - 2.2, base_y - 0.5, GREEN if i == 2 else NAVY)
            foot(cx + 2.6, base_y + 0.7, NAVY if i == 2 else GREEN)

        txt(ax, cx, base_y - 3.4, head, fs=5.0, color=NAVY, weight="bold")
        txt(ax, cx, base_y - 5.6, body, fs=3.7, color=SLATE, lh=1.4)

        if i < 3:
            arrow(ax, (cx + 8.0, base_y + 3.6), (cx + 12.6, base_y + 3.6),
                  color=GREY, lw=0.9, mut=7)

    # ---------- the two readings
    section(ax, 3.0, 33.6, 44.0, "FIBA: two steps after the gather", color=BLUE)
    txt(ax, 3.0, 29.4,
        "The gather counts as zero. The player may take two steps\n"
        "and must then pass or shoot. A third contact with the floor\n"
        "is a travelling violation and the ball goes to the opponent.",
        fs=3.9, color=SLATE, ha="left", lh=1.55)
    rbox(ax, 3.0, 20.6, 44.0, 6.0, fc=PALE_B, ec=BLUE, lw=0.6, r=0.6)
    txt(ax, 5.0, 24.8, "Judged on the floor, by eye, at full speed.", fs=3.9,
        color=BLUE_D, weight="bold", ha="left")
    txt(ax, 5.0, 22.6, "No replay in a normal FIBA game.", fs=3.7, color=SLATE,
        ha="left")

    section(ax, 52.0, 33.6, 45.0, "NBA: the same, read more slowly", color=ORANGE)
    txt(ax, 52.0, 29.4,
        "The NBA also allows two steps after the gather, but its\n"
        "referees are instructed to let the gather settle before\n"
        "counting, and replay can review a marginal call.",
        fs=3.9, color=SLATE, ha="left", lh=1.55)
    rbox(ax, 52.0, 20.6, 45.0, 6.0, fc=PALE_O, ec=ORANGE, lw=0.6, r=0.6)
    txt(ax, 54.0, 24.8, "The difference is enforcement, not arithmetic.", fs=3.9,
        color=ORANGE_D, weight="bold", ha="left")
    txt(ax, 54.0, 22.6, "Both rulebooks count two steps.", fs=3.7, color=SLATE,
        ha="left")

    # ---------- the trap
    section(ax, 3.0, 15.6, 94.0, "the answer that earns marks", color=GOLD)
    rbox(ax, 3.0, 7.4, 94.0, 5.4, fc=PALE_Y, ec=GOLD, lw=0.6, r=0.6)
    txt(ax, 50.0, 10.1, "Say \u201cboth codes allow two steps after the gather; the NBA is simply read more leniently, and it reviews the call\u201d.",
        fs=4.0, color=NAVY, weight="bold")

    p.caption("Two steps after the gather in both codes \u2014 the visible difference is how strictly the gather is judged.")
    p.save(path)


# ==================================================== 33  Foul categories
def fig33(path):
    p = Page(33, "Plate 33 \u2022 FIBA vs NBA", "Foul Categories, 2026",
             "The same contact, sorted into different boxes")
    ax = p.ax

    # ---------- FIBA column
    section(ax, 3.0, 57.0, 44.0, "FIBA: five names", color=BLUE)
    fiba = [("Personal", "ordinary contact; five and the player is out", BLUE),
            ("Team", "the fifth in a quarter puts the opponent in the bonus", TEAL),
            ("Technical", "unsporting behaviour, no contact; two and out", GOLD),
            ("Unsportsmanlike", "contact outside the spirit of the game", RED),
            ("Disqualifying", "a foul that removes the player at once", PURPLE)]
    y = 50.4
    for head, body, col in fiba:
        rbox(ax, 3.0, y, 44.0, 6.2, fc=WHITE, ec=LINE, lw=0.55, r=0.6)
        ax.add_patch(Rectangle((3.3, y + 0.7), 0.7, 4.8, fc=col, ec="none", zorder=4))
        txt(ax, 5.4, y + 4.2, head, fs=4.5, color=col, weight="bold", ha="left")
        txt(ax, 5.4, y + 1.9, body, fs=3.7, color=SLATE, ha="left")
        y -= 7.0

    # ---------- NBA column
    section(ax, 52.0, 57.0, 45.0, "NBA: five names, plus a review", color=ORANGE)
    nba = [("Personal", "ordinary contact; six and the player is out", ORANGE),
           ("Team", "the fifth in a quarter starts the penalty", TEAL),
           ("Technical", "behaviour, delay or a flopping call", GOLD),
           ("Flagrant 1", "unnecessary contact; two free throws", RED),
           ("Flagrant 2", "unnecessary and excessive; ejection", PURPLE)]
    y = 50.4
    for head, body, col in nba:
        rbox(ax, 52.0, y, 45.0, 6.2, fc=WHITE, ec=LINE, lw=0.55, r=0.6)
        ax.add_patch(Rectangle((52.3, y + 0.7), 0.7, 4.8, fc=col, ec="none", zorder=4))
        txt(ax, 54.4, y + 4.2, head, fs=4.5, color=col, weight="bold", ha="left")
        txt(ax, 54.4, y + 1.9, body, fs=3.7, color=SLATE, ha="left")
        y -= 7.0

    # ---------- the mapping
    section(ax, 3.0, 19.4, 94.0, "how the boxes line up", color=NAVY)
    txt(ax, 3.0, 16.2, "FIBA", fs=4.2, color=BLUE, weight="bold", ha="left")
    txt(ax, 52.0, 16.2, "NBA", fs=4.2, color=ORANGE_D, weight="bold", ha="left")
    pairs = [("Unsportsmanlike", "Flagrant 1", RED),
             ("Disqualifying", "Flagrant 2", PURPLE),
             ("Technical", "Technical, plus the flop call", GOLD)]
    y = 13.4
    for f_, n_, col in pairs:
        txt(ax, 3.0, y, f_, fs=3.9, color=SLATE, ha="left")
        arrow(ax, (38.0, y), (48.0, y), color=col, lw=1.0, mut=7)
        txt(ax, 52.0, y, n_, fs=3.9, color=SLATE, ha="left")
        y -= 2.4

    p.caption("FIBA calls it unsportsmanlike or disqualifying; the NBA calls the same contact flagrant one or two.")
    p.save(path)


# ==================================================== 34  Coach's challenge
def fig34(path):
    p = Page(34, "Plate 34 \u2022 FIBA vs NBA", "The Coach's Challenge",
             "One replay request, two rulebooks")
    ax = p.ax

    # ---------- FIBA
    section(ax, 3.0, 57.4, 44.0, "FIBA: one challenge", color=BLUE)
    box(ax, 3.0, 46.4, 17.0, 8.6, fc=PALE_B, ec=BLUE, lw=0.7, z=3)
    txt(ax, 11.5, 51.6, "1", fs=12.0, color=BLUE, weight="bold", z=6)
    txt(ax, 11.5, 48.2, "per game", fs=4.0, color=BLUE_D, weight="bold", z=6)
    txt(ax, 22.4, 53.6, "The head coach asks the crew to review", fs=3.9, color=SLATE,
        ha="left")
    txt(ax, 22.4, 51.6, "one decision, late in the game: a foul,", fs=3.9, color=SLATE,
        ha="left")
    txt(ax, 22.4, 49.6, "a two-or-three, a clock error.", fs=3.9, color=SLATE,
        ha="left")

    txt(ax, 3.0, 42.6, "If the challenge succeeds the call is corrected and the team\nkeeps the ball; if it fails the team loses a time-out.",
        fs=3.9, color=SLATE, ha="left", lh=1.5)

    txt(ax, 3.0, 34.6, "WHAT MAY BE CHALLENGED", fs=4.2, color=BLUE_D, weight="bold",
        ha="left")
    fiba_list = ["whether a foul was committed", "two or three points on a shot",
                 "whether the ball left the hand in time", "a clock or shot-clock error"]
    for i, line in enumerate(fiba_list):
        ax.add_patch(Circle((4.0, 31.4 - i * 2.5), 0.28, fc=BLUE, ec="none",
                            zorder=6))
        txt(ax, 5.4, 31.4 - i * 2.5, line, fs=3.8, color=SLATE, ha="left")

    rbox(ax, 3.0, 15.4, 44.0, 5.4, fc=PALE_B, ec=BLUE, lw=0.6, r=0.6)
    txt(ax, 5.0, 19.2, "Decisions are reviewed at the table, not remotely.", fs=3.8,
        color=BLUE_D, weight="bold", ha="left")
    txt(ax, 5.0, 17.2, "The crew chief announces the outcome to the arena.", fs=3.6,
        color=SLATE, ha="left")

    # ---------- NBA
    section(ax, 52.0, 57.4, 45.0, "NBA: one, then maybe two", color=ORANGE)
    box(ax, 52.0, 46.4, 17.0, 8.6, fc=PALE_O, ec=ORANGE, lw=0.7, z=3)
    txt(ax, 60.5, 51.9, "1 + 1", fs=10.6, color=ORANGE, weight="bold", z=6)
    txt(ax, 60.5, 48.2, "per game", fs=4.0, color=ORANGE_D, weight="bold", z=6)
    txt(ax, 71.4, 53.6, "One challenge. If it succeeds the coach", fs=3.9, color=SLATE,
        ha="left")
    txt(ax, 71.4, 51.6, "keeps the time-out and gains a second", fs=3.9, color=SLATE,
        ha="left")
    txt(ax, 71.4, 49.6, "challenge.", fs=3.9, color=SLATE, ha="left")

    txt(ax, 52.0, 42.6, "The replay centre reviews the play and returns the decision\nto the crew chief, who applies it on the floor.",
        fs=3.9, color=SLATE, ha="left", lh=1.5)

    txt(ax, 52.0, 34.6, "WHAT MAY BE CHALLENGED", fs=4.2, color=ORANGE_D,
        weight="bold", ha="left")
    nba_list = ["a foul called on the wrong player", "a block or charge",
                "goaltending and basket interference", "out-of-bounds and the clock"]
    for i, line in enumerate(nba_list):
        ax.add_patch(Circle((53.0, 31.4 - i * 2.5), 0.28, fc=ORANGE, ec="none",
                            zorder=6))
        txt(ax, 54.4, 31.4 - i * 2.5, line, fs=3.8, color=SLATE, ha="left")

    rbox(ax, 52.0, 15.4, 45.0, 5.4, fc=PALE_O, ec=ORANGE, lw=0.6, r=0.6)
    txt(ax, 54.0, 19.2, "A failed challenge costs a time-out.", fs=3.8,
        color=ORANGE_D, weight="bold", ha="left")
    txt(ax, 54.0, 17.2, "Coaches save it for the last two minutes.", fs=3.6,
        color=SLATE, ha="left")

    # ---------- flow
    section(ax, 3.0, 12.6, 94.0, "the same flow, both codes", color=NAVY)
    steps = [("1", "A call is questioned", "the coach signals before play restarts"),
             ("2", "The crew reviews", "courtside monitor or replay centre"),
             ("3", "The call stands or changes", "the clock is reset if needed"),
             ("4", "The cost is paid", "a time-out is lost when it fails")]
    x = 3.0
    for i, (n, head, body) in enumerate(steps):
        rbox(ax, x, 6.4, 21.4, 4.6, fc=WHITE, ec=LINE, lw=0.55, r=0.5)
        ax.add_patch(Circle((x + 2.4, 8.7), 1.1, fc=NAVY, ec="none", zorder=5))
        txt(ax, x + 2.4, 8.65, n, fs=4.2, color=WHITE, weight="bold", z=7)
        txt(ax, x + 4.4, 9.4, head, fs=3.7, color=NAVY, weight="bold", ha="left")
        txt(ax, x + 4.4, 7.6, body, fs=3.4, color=SLATE, ha="left")
        x += 23.7

    p.caption("Both codes give the head coach one challenge; the NBA grants a second if the first is successful.")
    p.save(path)


# ==================================================== 35  Common features
def fig35(path):
    p = Page(35, "Plate 35 \u2022 FIBA vs NBA", "Common Features",
             "The rules that do not change when you cross an ocean")
    ax = p.ax

    # ---------- venn: two circles
    cx1, cx2, cy, rx, ry = 37.0, 63.0, 38.4, 24.0, 14.6
    ax.add_patch(Ellipse((cx1, cy), 2 * rx, 2 * ry, fc=BLUE, ec=BLUE, lw=0.9,
                         alpha=0.10, zorder=3))
    ax.add_patch(Ellipse((cx2, cy), 2 * rx, 2 * ry, fc=ORANGE, ec=ORANGE, lw=0.9,
                         alpha=0.10, zorder=3))
    txt(ax, 22.0, 49.0, "FIBA ONLY", fs=4.6, color=BLUE, weight="bold")
    txt(ax, 78.0, 49.0, "NBA ONLY", fs=4.6, color=ORANGE, weight="bold")
    txt(ax, 50.0, 50.2, "SHARED", fs=5.0, color=GREEN_D, weight="bold")

    fiba_only = ["five fouls and out", "no defensive three seconds",
                 "possession arrow, not a jump ball", "30-second time-outs"]
    nba_only = ["six fouls and out", "defensive three seconds",
                "jump ball for held balls", "60-second time-outs"]
    shared = ["ring at 3.05 m", "24-second shot clock", "five players a side",
              "four quarters of play"]

    for i, s_ in enumerate(fiba_only):
        txt(ax, 21.0, 43.0 - i * 4.0, s_, fs=3.9, color=BLUE_D, ha="center")
    for i, s_ in enumerate(nba_only):
        txt(ax, 79.0, 43.0 - i * 4.0, s_, fs=3.9, color=ORANGE_D, ha="center")
    for i, s_ in enumerate(shared):
        txt(ax, 50.0, 43.0 - i * 4.0, s_, fs=3.8, color=GREEN_D, ha="center",
            weight="bold")

    # ---------- the five constants
    section(ax, 3.0, 20.6, 94.0, "five constants worth quoting in any answer", color=GREEN)
    facts = [("5", "players a side"), ("3.05 m", "ring height"),
             ("24 s", "shot clock"), ("4", "quarters, in both codes"),
             ("2 / 3 / 1", "points for a field goal, beyond the arc, a free throw")]
    x = 3.0
    for i, (big, small) in enumerate(facts):
        rbox(ax, x, 7.0, 17.4, 11.2, fc=WHITE, ec=LINE, lw=0.55, r=0.6)
        txt(ax, x + 8.7, 14.6, big, fs=8.4, color=GREEN_D, weight="bold")
        txt(ax, x + 8.7, 9.8, small, fs=3.4, color=SLATE, lh=1.3)
        x += 18.8

    p.caption("Most of what a beginner learns is shared; only a short list actually changes between the two codes.")
    p.save(path)


if __name__ == "__main__":
    import sys, os
    out = sys.argv[1] if len(sys.argv) > 1 else "figs"
    os.makedirs(out, exist_ok=True)
    for i, f in zip(range(32, 36), [fig32, fig33, fig34, fig35]):
        f(f"{out}/plate{i:02d}.png")
        print("ok", i)
