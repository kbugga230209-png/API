from toolkit import *
import numpy as np

# body band: y 6.2 .. 60.5


# ==================================================== 01  Introduction
def fig01(path):
    p = Page(1, "Plate 01 \u2022 The game in essence", "Introduction to Basketball",
             "Two teams, one ball, two baskets \u2014 and a clock")
    ax = p.ax

    # ---------- concept cards
    cards = [
        ("TWO TEAMS, FIVE ON COURT", "Five players per side on the floor;\nrolling substitutions from the bench.",
         BLUE, PALE_B, WHITE, NAVY),
        ("AN INVASION GAME", "Attack one basket, defend the other,\nand change ends at half-time.",
         ORANGE, PALE_O, WHITE, NAVY),
    ]
    for (head, body, col, wash, bg, tc), (x, w) in zip(cards, [(3.0, 45.0), (51.0, 46.0)]):
        rbox(ax, x, 45.5, w, 14.0, fc=wash, ec=col, lw=0.7, r=1.1)
        ax.add_patch(Rectangle((x, 55.0), w, 4.5, fc=col, ec="none", zorder=3))
        txt(ax, x + 2.2, 57.2, head, fs=6.2, color=WHITE, weight="bold", ha="left", z=7)
        txt(ax, x + 2.2, 50.4, body, fs=5.5, color=SLATE, ha="left", lh=1.4, z=7)
        basketball_icon(ax, x + w - 4.6, 50.2, 2.5, z=5)

    # ---------- full court
    cy, chh = 7.3, 36.2
    c = Court(ax, 3.0, cy, 67.2, chh, spec=FIBA, full=True)
    c.halves(1, c2="#D3E4F4"); c.halves(-1, c2="#D3E4F4")
    c.key_fill(1, alpha=0.85); c.key_fill(-1, alpha=0.85)
    c.draw(ends=(1, -1))

    # attack directions
    arrow(ax, c.pt(9.5, 10.6), c.pt(18.0, 10.6), color=BLUE, lw=1.5, mut=12)
    txt(ax, c.pt(13.7, 12.4)[0], c.pt(13.7, 12.4)[1], "TEAM A ATTACKS", fs=5.2,
        color=BLUE_D, weight="bold")
    arrow(ax, c.pt(18.5, 4.4), c.pt(10.0, 4.4), color=ORANGE, lw=1.5, mut=12)
    txt(ax, c.pt(14.2, 2.7)[0], c.pt(14.2, 2.7)[1], "TEAM B ATTACKS", fs=5.2,
        color=ORANGE_D, weight="bold")

    # three point zone tag
    txt(ax, c.pt(3.5, 12.3)[0], c.pt(3.5, 12.3)[1], "2-POINT ZONE", fs=4.8,
        color=BLUE_D, weight="bold")
    txt(ax, c.pt(19.0, 12.6)[0], c.pt(19.0, 12.6)[1], "3-POINT ZONE", fs=4.8,
        color=ORANGE_D, weight="bold")

    # centre circle label
    txt(ax, c.pt(11.1, 7.5)[0], c.pt(11.1, 7.5)[1], "centre circle \u2014\njump ball", fs=4.4,
        color=GREY, ha="right", lh=1.3)

    txt(ax, 36.6, 7.9, "Full court, FIBA proportions (28 m \u00d7 15 m)", fs=5.0,
        color=GREY, style="italic", ha="center")

    # scoring cards
    rows = [("1", "POINT", "free throw after a\nshooting foul", GREEN, PALE_G),
            ("2", "POINTS", "field goal from inside\nthe 6.75 m arc", ORANGE, PALE_O),
            ("3", "POINTS", "field goal from beyond\nthe arc", BLUE, PALE_B)]
    y = 7.5
    for val, unit, note, col, wash in rows:
        rbox(ax, 72.5, y, 24.5, 11.0, fc=wash, ec=col, lw=0.7, r=1.0)
        ax.add_patch(Circle((77.0, y + 5.5), 2.6, fc=col, ec=WHITE, lw=0.8, zorder=5))
        txt(ax, 77.0, y + 5.45, val, fs=9.6, color=WHITE, weight="bold", z=7)
        txt(ax, 81.2, y + 8.0, unit, fs=5.6, color=col, weight="bold", ha="left")
        txt(ax, 81.2, y + 4.4, note, fs=5.1, color=SLATE, ha="left", lh=1.3)
        y += 12.5

    p.caption("Half-court diagram is to scale; scoring values per FIBA Official Basketball Rules 2026.")
    p.save(path)


# ==================================================== 02  Origin
def fig02(path):
    p = Page(2, "Plate 02 \u2022 Origin and invention", "How the Game Began",
             "Springfield, Massachusetts \u2014 December 1891")
    ax = p.ax

    # ---------- brief / answer banner
    rbox(ax, 3.0, 49.6, 94.0, 10.4, fc=WASH, ec=LINE, lw=0.7, r=1.0)
    ax.plot([40.0, 40.0], [50.8, 58.8], color=LINE, lw=0.8)
    txt(ax, 5.4, 56.9, "THE BRIEF", fs=5.4, color=BLUE, weight="bold", ha="left")
    txt(ax, 5.4, 53.2, "An indoor winter game that was energetic\nbut less rough than football",
        fs=5.7, color=NAVY, ha="left", lh=1.35)
    txt(ax, 42.4, 56.9, "THE ANSWER", fs=5.4, color=ORANGE, weight="bold", ha="left")
    txt(ax, 42.4, 53.2, "Thirteen rules, a soccer ball and two\npeach baskets at opposite ends of a gym",
        fs=5.7, color=NAVY, ha="left", lh=1.35)
    basketball_icon(ax, 92.4, 54.8, 2.4, z=5)

    # ---------- peach basket scene
    wall_x, wall_y0, wall_y1 = 8.0, 21.0, 43.0
    for yy in np.arange(wall_y0, wall_y1, 3.0):
        ax.plot([wall_x, wall_x + 27.0], [yy, yy], color="#E7DDCB", lw=1.0, zorder=2)
    ax.add_patch(Rectangle((wall_x - 2.0, wall_y0), 2.0, wall_y1 - wall_y0, fc="#EFE6D4",
                           ec="#C9B99B", lw=0.8, zorder=2.6))

    bx, top_y = 27.0, 38.6
    # bracket arm off the wall
    ax.plot([wall_x, bx - 3.2], [top_y + 2.6, top_y + 2.6], color=SLATE, lw=1.8,
            zorder=4, solid_capstyle="round")
    ax.plot([bx - 3.2, bx - 3.2], [top_y + 2.6, top_y], color=SLATE, lw=1.1, zorder=4)
    tw, bw, bh = 6.2, 4.4, 6.4
    ax.add_patch(Polygon([(bx - tw / 2, top_y), (bx + tw / 2, top_y),
                          (bx + bw / 2, top_y - bh), (bx - bw / 2, top_y - bh)],
                         closed=True, fc="#EBD3A8", ec="#A9743C", lw=1.0, zorder=5))
    for k in range(1, 6):
        frac = k / 6
        xl = bx - tw / 2 + (tw - bw) / 2 * frac
        xr = bx + tw / 2 - (tw - bw) / 2 * frac
        ax.plot([xl, xr], [top_y - bh * frac] * 2, color="#B98A4F", lw=0.5, zorder=6)
    for k in range(1, 7):
        xx = bx - tw / 2 + tw * k / 7
        ax.plot([xx, xx - (xx - bx) * 0.30], [top_y, top_y - bh], color="#B98A4F",
                lw=0.45, zorder=6)
    ax.plot([bx - bw / 2, bx + bw / 2], [top_y - bh, top_y - bh], color="#8A5B2B",
            lw=1.7, zorder=7, solid_capstyle="butt")
    ball(ax, bx + 0.2, top_y + 6.4, r=1.3)
    dashed(ax, [(bx + 0.2, top_y + 5.0), (bx + 0.2, top_y + 0.5)], color=ORANGE_D, lw=0.7)

    leader(ax, bx + 2.0, top_y - bh, 46.0, 30.6,
           "the basket was closed at the bottom \u2014 the ball had to be\nretrieved after every score",
           fs=5.1, color="#8A5B2B", ha="left")
    leader(ax, wall_x - 0.8, 23.4, 46.0, 21.6,
           "baskets were fixed to the balcony rail at each end\nof the gymnasium",
           fs=5.1, color=SLATE, ha="left")
    leader(ax, bx + 1.2, top_y + 6.4, 44.0, 44.6,
           "a football (soccer ball) was used", fs=5.1, color=ORANGE_D, ha="left",
           weight="bold")

    # inventor card
    rbox(ax, 44.0, 33.6, 52.6, 7.6, fc=NAVY, ec="none", r=0.9)
    txt(ax, 46.4, 38.6, "Dr James Naismith", fs=6.8, color=WHITE, weight="bold", ha="left")
    txt(ax, 46.4, 35.6, "Physical education instructor, YMCA International Training School, Springfield",
        fs=5.0, color="#C7D6E6", ha="left")

    # ---------- timeline
    ty = 13.4
    ax.plot([3.4, 96.6], [ty, ty], color=NAVY, lw=1.6, zorder=4, solid_capstyle="round")
    nodes = [
        ("1891", "Game invented,\n13 rules", BLUE),
        ("1893", "Metal rings\nreplace baskets", TEAL),
        ("1898", "First pro league\norganised", GREEN),
        ("1932", "FIBA founded\nin Geneva", PURPLE),
        ("1936", "Olympic debut\nBerlin", ORANGE),
        ("1946", "BAA formed \u2014\nlater the NBA", RED),
        ("1976", "Women's Olympic\ntournament", TEAL),
    ]
    xs = np.linspace(10.4, 89.4, len(nodes))
    for x, (yr, lab, col) in zip(xs, nodes):
        ax.add_patch(Circle((x, ty), 1.0, fc=col, ec=WHITE, lw=1.0, zorder=6))
        txt(ax, x, ty + 2.6, yr, fs=6.2, color=col, weight="bold")
        txt(ax, x, ty - 4.6, lab, fs=4.9, color=SLATE, lh=1.3)

    p.caption("The 13 original rules still underpin the modern rulebook; basketball spread through YMCA and college networks.")
    p.save(path)


# ==================================================== 03  World growth
def fig03(path):
    p = Page(3, "Plate 03 \u2022 Global growth", "Growth of Basketball Around the World",
             "From a school gymnasium to a worldwide federation")
    ax = p.ax

    ty = 39.6
    ax.plot([3.4, 96.6], [ty, ty], color=NAVY, lw=1.8, zorder=4, solid_capstyle="round")
    cards = [
        ("1932", "FIBA founded", "Eight national federations\nmeet in Geneva.", PURPLE),
        ("1936", "Men's Olympic debut", "A full medal sport at the\nBerlin Games.", ORANGE),
        ("1950", "World Championship", "First men's world title\nstaged in Argentina.", BLUE),
        ("1976", "Women's Olympic entry", "Women's tournament\nadded at Montreal.", TEAL),
        ("1989", "Professionals admitted", "FIBA opens its events\nto NBA players.", GREEN),
        ("1992", "The Dream Team", "NBA stars at Barcelona\nlift global interest.", RED),
        ("2019", "3x3 goes Olympic", "Half-court format added\nto the Tokyo programme.", GOLD),
    ]
    xs = np.linspace(9.4, 90.6, len(cards))
    for i, (x, (yr, head, body, col)) in enumerate(zip(xs, cards)):
        up = (i % 2 == 0)
        ax.add_patch(Circle((x, ty), 1.05, fc=col, ec=WHITE, lw=1.0, zorder=6))
        if up:
            ax.plot([x, x], [ty + 1.05, ty + 6.4], color=col, lw=0.75, zorder=4)
            cy, hh = ty + 6.4, 12.4
        else:
            ax.plot([x, x], [ty - 1.05, ty - 8.8], color=col, lw=0.75, zorder=4)
            cy, hh = ty - 8.8 - 12.4, 12.4
        rbox(ax, x - 6.6, cy, 13.2, hh, fc=WHITE, ec=col, lw=0.8, r=0.9)
        ax.add_patch(Rectangle((x - 6.6, cy + hh - 3.4), 13.2, 3.4, fc=col, ec="none",
                               zorder=4))
        txt(ax, x, cy + hh - 1.7, yr, fs=6.6, color=WHITE, weight="bold", z=7)
        txt(ax, x, cy + hh - 5.4, head, fs=5.2, color=col, weight="bold", z=7, lh=1.15)
        txt(ax, x, cy + hh - 8.0, body, fs=4.5, color=SLATE, z=7, lh=1.35, va="top")

    # ---------- reach strip
    stats = [("5v5 + 3x3", "two Olympic formats", BLUE),
             ("212", "national federations", PURPLE),
             ("5 zones", "continental championships", GREEN),
             ("All levels", "school, club and elite", ORANGE)]
    bx = 3.0
    for val, lab, col in stats:
        rbox(ax, bx, 7.2, 22.0, 8.4, fc=WASH, ec=LINE, lw=0.7, r=1.0)
        ax.add_patch(Rectangle((bx, 7.2), 1.1, 8.4, fc=col, ec="none", zorder=4))
        txt(ax, bx + 11.6, 12.2, val, fs=7.4, color=NAVY, weight="bold")
        txt(ax, bx + 11.6, 9.4, lab, fs=4.9, color=GREY)
        bx += 23.5

    p.caption("FIBA coordinates 5v5 and 3x3 worldwide; the NBA became the game's most visible professional league.")
    p.save(path)


# ==================================================== 04  India early
def fig04(path):
    p = Page(4, "Plate 04 \u2022 India \u2014 the early years", "How Basketball Reached India",
             "Education, physical training and YMCA networks carried the game inland")
    ax = p.ax

    section(ax, 3.0, 59.6, 94.0, "four routes, one destination", color=NAVY)

    chain = [("YMCA and\nmission\nnetworks", TEAL),
             ("Schools and\ncolleges", BLUE),
             ("Physical\neducation\ndepartments", PURPLE),
             ("Local sports\nassociations", GREEN)]
    x, w, gap = 3.0, 21.4, 2.9
    for i, (label, col) in enumerate(chain):
        rbox(ax, x, 44.6, w, 11.6, fc=WHITE, ec=col, lw=0.9, r=0.9)
        ax.add_patch(Rectangle((x, 52.6), w, 3.6, fc=col, ec="none", zorder=4))
        txt(ax, x + w / 2, 54.4, f"STAGE {i+1}", fs=4.9, color=WHITE, weight="bold", z=7)
        txt(ax, x + w / 2, 48.4, label, fs=5.8, color=NAVY, weight="bold", lh=1.3, z=7)
        if i < 3:
            arrow(ax, (x + w + 0.3, 50.4), (x + w + gap - 0.5, 50.4), color=MIST,
                  lw=1.2, mut=8)
        x += w + gap

    # converging band
    ax.add_patch(Polygon([(3.0, 41.6), (96.6, 41.6), (72.0, 36.2), (27.6, 36.2)],
                         closed=True, fc=PALE_B, ec=BLUE, lw=0.7, zorder=3))
    txt(ax, 49.8, 39.4, "State and city tournaments build a competitive base",
        fs=6.0, color=BLUE_D, weight="bold")
    arrow(ax, (49.8, 35.8), (49.8, 32.4), color=BLUE_D, lw=1.3, mut=10)

    # 1934 milestone
    rbox(ax, 14.0, 22.0, 72.0, 11.4, fc=NAVY, ec="none", r=1.2)
    txt(ax, 22.6, 27.7, "1934", fs=12.0, color=GOLD, weight="bold")
    ax.plot([30.2, 30.2], [23.8, 31.4], color="#3A5273", lw=0.8)
    txt(ax, 32.8, 29.4, "First national-level basketball tournaments", fs=6.2,
        color=WHITE, weight="bold", ha="left")
    txt(ax, 32.8, 25.6, "The game moves beyond isolated local play and\ngains a national competition structure.",
        fs=5.1, color="#C7D6E6", ha="left", lh=1.35)

    # why it suited PE
    rbox(ax, 3.0, 7.6, 94.0, 10.2, fc=WASH, ec=LINE, lw=0.7, r=0.9)
    txt(ax, 5.4, 14.9, "WHY IT SUITED PHYSICAL EDUCATION", fs=5.2, color=SLATE,
        weight="bold", ha="left")
    tags = [("fitness", BLUE), ("coordination", ORANGE), ("discipline", GREEN),
            ("cooperation", PURPLE), ("teamwork", RED)]
    cx = 5.4
    for t, col in tags:
        ww = len(t) * 0.55 + 3.6
        chip(ax, cx, 9.2, ww, 3.0, t, WHITE, tc=col, ec=col, fs=5.2, lw=0.6)
        cx += ww + 1.7
    txt(ax, 92.0, 10.7, "one lesson,\nmany outcomes", fs=4.8, color=MIST,
        ha="right", lh=1.3, style="italic")

    p.caption("The Basketball Federation of India records 1934 as the year of the first national-level tournaments.")
    p.save(path)


# ==================================================== 05  India milestones
def fig05(path):
    p = Page(5, "Plate 05 \u2022 India \u2014 milestones", "Three Milestones of Indian Basketball",
             "From first competitions to a national federation")
    ax = p.ax

    blocks = [
        ("1934", "First national-level tournaments",
         "Competition begins to be organised nationally rather than city by\ncity, and state teams start to emerge.",
         "COMPETITION", BLUE, PALE_B),
        ("1936", "India joins FIBA",
         "Indian basketball is linked to the international governing body and\nbecomes eligible for world competition.",
         "AFFILIATION", PURPLE, PALE_P),
        ("1950", "Basketball Federation of India formed",
         "One national body now coordinates competitions, national teams,\ncoaching and development.",
         "GOVERNANCE", GREEN, PALE_G),
    ]
    y = 46.4
    for i, (yr, head, body, tag, col, wash) in enumerate(blocks):
        rbox(ax, 3.0, y, 94.0, 12.6, fc=wash, ec=col, lw=0.8, r=1.1)
        rbox(ax, 4.6, y + 1.8, 17.0, 9.0, fc=col, ec="none", r=0.9)
        txt(ax, 13.1, y + 7.4, yr, fs=11.4, color=WHITE, weight="bold")
        txt(ax, 13.1, y + 3.4, tag, fs=4.5, color=WHITE, weight="bold")
        txt(ax, 24.2, y + 8.9, head, fs=7.0, color=NAVY, weight="bold", ha="left")
        txt(ax, 24.2, y + 4.3, body, fs=5.1, color=SLATE, ha="left", lh=1.45)
        ax.add_patch(Circle((93.2, y + 10.6), 1.8, fc=WHITE, ec=col, lw=0.9, zorder=6))
        txt(ax, 93.2, y + 10.5, str(i + 1), fs=5.8, color=col, weight="bold", z=7)
        if i < 2:
            arrow(ax, (49.8, y - 0.3), (49.8, y - 2.7), color=MIST, lw=1.1, mut=8)
        y -= 15.6

    rbox(ax, 3.0, 7.4, 94.0, 6.6, fc=WASH, ec=LINE, lw=0.7, r=0.9)
    basketball_icon(ax, 6.4, 10.7, 1.8, z=5)
    txt(ax, 9.8, 10.7,
        "Outcome: men's, women's, age-group and 3x3 competitions now run through state units affiliated to the BFI.",
        fs=5.3, color=SLATE, ha="left", style="italic")

    p.caption("Dates as recorded by the Basketball Federation of India (basketballfederationindia.org).")
    p.save(path)


# ==================================================== 06  Objective
def fig06(path):
    p = Page(6, "Plate 06 \u2022 Objectives", "The Objective and Nature of Play",
             "An invasion game \u2014 attack one basket, defend the other, switch at half-time")
    ax = p.ax

    # ---------- court
    cy, chh = 27.2, 27.0
    c = Court(ax, 3.0, cy, 56.7, chh, spec=FIBA, full=True)
    c.halves(1, c2="#D3E4F4", alpha3=0.75); c.halves(-1, c2="#D3E4F4", alpha3=0.75)
    c.key_fill(1, alpha=0.85); c.key_fill(-1, alpha=0.85)
    c.draw(ends=(1, -1))

    arrow(ax, c.pt(7.6, 9.5), c.pt(18.6, 9.5), color=BLUE, lw=1.5, mut=11)
    arrow(ax, c.pt(20.4, 5.5), c.pt(9.4, 5.5), color=ORANGE, lw=1.5, mut=11)
    txt(ax, c.pt(13.1, 11.0)[0], c.pt(13.1, 11.0)[1], "TEAM A ATTACKS", fs=4.7,
        color=BLUE_D, weight="bold")
    txt(ax, c.pt(14.9, 4.0)[0], c.pt(14.9, 4.0)[1], "TEAM B ATTACKS", fs=4.7,
        color=ORANGE_D, weight="bold")
    txt(ax, c.pt(3.4, 13.2)[0], c.pt(3.4, 13.2)[1], "3-pt", fs=4.6, color=ORANGE_D,
        weight="bold", ha="left")
    txt(ax, c.pt(25.6, 13.2)[0], c.pt(25.6, 13.2)[1], "3-pt", fs=4.6, color=ORANGE_D,
        weight="bold", ha="right")
    txt(ax, c.pt(12.2, 7.5)[0], c.pt(12.2, 7.5)[1], "2-pt", fs=4.6, color=BLUE_D,
        weight="bold")

    txt(ax, 31.4, cy + chh + 2.2,
        "Both baskets stay live: each team defends the one it faces.",
        fs=4.9, color=GREY, style="italic")
    txt(ax, 31.4, cy - 2.4,
        "At half-time the teams change ends \u2014 the arrows reverse.",
        fs=4.9, color=GREY, style="italic")

    # ---------- scoring column
    section(ax, 63.0, 57.6, 34.0, "how points are scored", color=NAVY)
    rows = [("3", "Field goal from beyond\nthe 6.75 m arc", BLUE, PALE_B),
            ("2", "Field goal from inside\nthe arc", ORANGE, PALE_O),
            ("1", "Free throw, awarded after\na shooting foul", GREEN, PALE_G)]
    y = 46.2
    for val, note, col, wash in rows:
        rbox(ax, 63.0, y, 34.0, 9.0, fc=wash, ec="none", r=0.9)
        ax.add_patch(Circle((67.0, y + 4.5), 2.3, fc=col, ec=WHITE, lw=0.8, zorder=5))
        txt(ax, 67.0, y + 4.45, val, fs=8.4, color=WHITE, weight="bold", z=7)
        txt(ax, 70.8, y + 4.5, note, fs=5.2, color=NAVY, ha="left", lh=1.35)
        y -= 10.2

    rbox(ax, 63.0, 7.0, 34.0, 17.4, fc=WHITE, ec=LINE, lw=0.7, r=0.9)
    txt(ax, 65.0, 21.6, "REMEMBER", fs=5.0, color=MIST, weight="bold", ha="left")
    for i, line in enumerate([
            "The ball must enter the basket\nfrom above to count.",
            "The clock, not the scoreboard,\nends the game.",
            "A shot released before the\nbuzzer still counts."]):
        ax.add_patch(Circle((65.4, 17.6 - i * 4.6), 0.34, fc=GOLD, ec="none", zorder=6))
        txt(ax, 66.9, 17.6 - i * 4.6, line, fs=4.9, color=SLATE, ha="left", lh=1.4)

    # ---------- success factors
    rbox(ax, 3.0, 7.0, 57.0, 15.6, fc=WASH, ec=LINE, lw=0.7, r=1.0)
    txt(ax, 5.4, 19.9, "SUCCESS NEEDS MORE THAN SHOOTING", fs=5.4, color=NAVY,
        weight="bold", ha="left")
    factors = [("Spacing", BLUE), ("Timing", ORANGE), ("Communication", GREEN),
               ("Unselfish play", PURPLE), ("Balance", RED)]
    cx = 5.4
    for label, col in factors:
        ww = len(label) * 0.62 + 3.4
        chip(ax, cx, 12.4, ww, 3.4, label, WHITE, tc=col, ec=col, fs=5.0, lw=0.6)
        cx += ww + 1.2
    txt(ax, 5.4, 9.4,
        "Skill gets a player on the floor; spacing, timing, talk and the extra pass win games.",
        fs=4.9, color=SLATE, ha="left", style="italic")

    p.caption("Scoring values and the invasion structure are common to FIBA and NBA basketball.")
    p.save(path)


if __name__ == "__main__":
    import sys, os
    out = sys.argv[1] if len(sys.argv) > 1 else "figs"
    os.makedirs(out, exist_ok=True)
    for i, f in enumerate([fig01, fig02, fig03, fig04, fig05, fig06], start=1):
        f(f"{out}/plate{i:02d}.png")
        print("ok", i)
