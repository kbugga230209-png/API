"""
Shared design system for the CUUV102 Basketball Diagram Atlas.

Canvas: 7.4 x 5.55 in -> internal units x:0-100, y:0-75 (square units).
Usable body: x 3..97, y 6.2..60.5
"""
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import (FancyBboxPatch, Rectangle, Circle, Arc, Wedge,
                                FancyArrowPatch, Polygon, Ellipse)
import matplotlib.patheffects as pe

# ---------------------------------------------------------------- palette
NAVY   = "#12263F"
INK    = "#1B2A41"
SLATE  = "#41546B"
GREY   = "#6B7A8F"
MIST   = "#98A7B8"
LINE   = "#C9D6E3"
WASH   = "#F4F8FC"

BLUE   = "#1F6FB2"
BLUE_D = "#154E80"
PALE_B = "#DDEAF6"

ORANGE = "#E8731C"
ORANGE_D = "#B4520C"
PALE_O = "#FCE8D6"

GREEN  = "#1B8A5A"
GREEN_D = "#126B45"
PALE_G = "#DDF0E6"

RED    = "#C33B2E"
PALE_R = "#F9E1DE"

GOLD   = "#C9A227"
PALE_Y = "#FBF2D2"

PURPLE = "#59439A"
PALE_P = "#E6E0F4"

TEAL   = "#177E89"
PALE_T = "#D9EDEF"

WHITE  = "#FFFFFF"
FONT = "DejaVu Sans"
DPI = 200

plt.rcParams.update({
    "font.family": FONT, "text.color": INK,
    "savefig.facecolor": WHITE, "pdf.fonttype": 42,
})

X0, X1 = 3.0, 97.0
YB, YT = 6.2, 60.5          # body floor / ceiling
FIGW, FIGH = 7.4, 5.55
H = 100.0 * FIGH / FIGW      # 75.0


# ---------------------------------------------------------------- page
class Page:
    def __init__(self, num, kicker, title, subtitle=None, grid=False):
        self.num = num
        self.fig = plt.figure(figsize=(FIGW, FIGH))
        self.fig.patch.set_facecolor(WHITE)
        self.H = H
        ax = self.fig.add_axes([0, 0, 1, 1])
        ax.set_xlim(0, 100); ax.set_ylim(0, H)
        ax.set_aspect("equal"); ax.axis("off")
        self.ax = ax
        ax.add_patch(Rectangle((0, 0), 100, H, fc=WHITE, ec="none", zorder=0))
        if grid:
            for gx in range(0, 101, 5):
                ax.plot([gx, gx], [0, H], color="#EEF2F6", lw=0.4, zorder=0.2)
            for gy in range(0, int(H) + 1, 5):
                ax.plot([0, 100], [gy, gy], color="#EEF2F6", lw=0.4, zorder=0.2)
        self._band(kicker, title, subtitle)
        ax.add_patch(Rectangle((0.9, 0.9), 98.2, H - 1.8, fc="none", ec=LINE,
                               lw=0.7, zorder=1))
        ax.add_patch(Rectangle((0.9, 0.9), 98.2, 4.4, fc=WASH, ec="none", zorder=1))
        ax.plot([0.9, 99.1], [5.3, 5.3], color=LINE, lw=0.7, zorder=2)
        self.body_top = YT

    def _band(self, kicker, title, subtitle):
        ax = self.ax
        top = H - 0.9
        hgt = 10.4
        y0 = top - hgt
        ax.add_patch(Rectangle((0.9, y0), 98.2, hgt, fc=NAVY, ec="none", zorder=3))
        ax.add_patch(Rectangle((0.9, y0 - 0.45), 98.2, 0.45, fc=GOLD, ec="none", zorder=3))
        bx, by = 7.0, y0 + hgt / 2
        ax.add_patch(Circle((bx, by), 3.4, fc=GOLD, ec="white", lw=0.9, zorder=4))
        ax.text(bx, by + 0.12, f"{self.num:02d}", ha="center", va="center",
                fontsize=9.8, fontweight="bold", color=NAVY, zorder=5)
        ax.text(12.4, y0 + 7.9, kicker.upper(), ha="left", va="center",
                fontsize=5.3, color=GOLD, zorder=5, fontweight="bold")
        ax.text(12.4, y0 + 4.35, title, ha="left", va="center",
                fontsize=11.0, color=WHITE, zorder=5, fontweight="bold")
        if subtitle:
            ax.text(12.4, y0 + 1.55, subtitle, ha="left", va="center",
                    fontsize=5.7, color="#C7D6E6", zorder=5)
        ax.text(97.6, y0 + 7.9, "CUUV102  \u2022  BASKETBALL", ha="right",
                va="center", fontsize=4.9, color="#8FA6C0", zorder=5, fontweight="bold")

    def caption(self, text, tag="DIAGRAM ATLAS"):
        self.ax.text(2.8, 2.95, text, ha="left", va="center", fontsize=5.2,
                     color=SLATE, style="italic")
        self.ax.text(97.4, 2.95, tag, ha="right", va="center", fontsize=5.0,
                     color=MIST, fontweight="bold")

    def save(self, path):
        self.fig.savefig(path, dpi=DPI, facecolor=WHITE)
        plt.close(self.fig)


# ---------------------------------------------------------------- primitives
def rbox(ax, x, y, w, h, fc=WHITE, ec=LINE, lw=0.8, r=1.2, z=2, ls="solid", alpha=1.0):
    ax.add_patch(FancyBboxPatch((x + r, y + r), max(w - 2 * r, 0.02),
                                max(h - 2 * r, 0.02),
                                boxstyle=f"round,pad={r},rounding_size={r}",
                                fc=fc, ec=ec, lw=lw, zorder=z, linestyle=ls,
                                alpha=alpha))


def box(ax, x, y, w, h, fc=WHITE, ec=LINE, lw=0.8, z=2, alpha=1.0, ls="solid"):
    ax.add_patch(Rectangle((x, y), w, h, fc=fc, ec=ec, lw=lw, zorder=z,
                           alpha=alpha, linestyle=ls))


def txt(ax, x, y, s, fs=7.0, color=INK, weight="normal", ha="center", va="center",
        z=6, style="normal", rot=0, lh=1.2):
    ax.text(x, y, s, ha=ha, va=va, fontsize=fs, color=color, fontweight=weight,
            zorder=z, style=style, rotation=rot, linespacing=lh)


def chip(ax, x, y, w, h, s, fc, tc=WHITE, ec="none", fs=5.8, weight="bold", r=1.0,
         z=4, lw=0.7):
    rbox(ax, x, y, w, h, fc=fc, ec=ec, lw=lw, r=r, z=z)
    txt(ax, x + w / 2, y + h / 2 - 0.06, s, fs=fs, color=tc, weight=weight, z=z + 1)


def arrow(ax, p0, p1, color=INK, lw=1.1, style="-|>", rad=0.0, z=5, ls="solid",
          mut=8, shrinkA=0, shrinkB=0, alpha=1.0):
    ax.add_patch(FancyArrowPatch(p0, p1, arrowstyle=style, mutation_scale=mut,
                                 color=color, lw=lw, zorder=z, linestyle=ls,
                                 connectionstyle=f"arc3,rad={rad}",
                                 shrinkA=shrinkA, shrinkB=shrinkB, alpha=alpha))


def dashed(ax, pts, color=SLATE, lw=0.9, ls=(0, (3.0, 2.0)), z=4, alpha=1.0):
    pts = np.asarray(pts, float)
    ax.plot(pts[:, 0], pts[:, 1], color=color, lw=lw, ls=ls, zorder=z, alpha=alpha,
            solid_capstyle="round")


def dim_h(ax, x0, x1, y, label, color=BLUE_D, fs=5.8, tick=0.8, offset=1.4,
          weight="bold", z=5):
    ax.annotate("", (x0, y), (x1, y),
                arrowprops=dict(arrowstyle="<|-|>", color=color, lw=0.8,
                                mutation_scale=6, shrinkA=0, shrinkB=0), zorder=z)
    for xx in (x0, x1):
        ax.plot([xx, xx], [y - tick, y + tick], color=color, lw=0.8, zorder=z)
    txt(ax, (x0 + x1) / 2, y + offset, label, fs=fs, color=color, weight=weight, z=z)


def dim_v(ax, y0, y1, x, label, color=BLUE_D, fs=5.8, tick=0.8, offset=1.1,
          weight="bold", z=5, rot=90):
    ax.annotate("", (x, y0), (x, y1),
                arrowprops=dict(arrowstyle="<|-|>", color=color, lw=0.8,
                                mutation_scale=6, shrinkA=0, shrinkB=0), zorder=z)
    for yy in (y0, y1):
        ax.plot([x - tick, x + tick], [yy, yy], color=color, lw=0.8, zorder=z)
    txt(ax, x + offset, (y0 + y1) / 2, label, fs=fs, color=color, weight=weight,
        z=z, rot=rot)


def leader(ax, x0, y0, x1, y1, label, fs=5.8, color=INK, ha="left", va="center",
           weight="normal", dot=True, z=6, lw=0.7):
    ax.annotate(label, xy=(x0, y0), xytext=(x1, y1), fontsize=fs, color=color,
                ha=ha, va=va, zorder=z, fontweight=weight,
                arrowprops=dict(arrowstyle="-", color=color, lw=lw, shrinkA=0,
                                shrinkB=3))
    if dot:
        ax.add_patch(Circle((x0, y0), 0.26, fc=color, ec="none", zorder=z))


def player(ax, x, y, label="", fc=BLUE, r=1.25, tc=WHITE, fs=5.0, ec=WHITE,
           lw=0.8, z=6, shadow=True):
    if shadow:
        ax.add_patch(Circle((x + 0.16, y - 0.2), r, fc="#000000", ec="none",
                            alpha=0.10, zorder=z - 1))
    ax.add_patch(Circle((x, y), r, fc=fc, ec=ec, lw=lw, zorder=z))
    if label:
        txt(ax, x, y - 0.04, str(label), fs=fs, color=tc, weight="bold", z=z + 1)


def ball(ax, x, y, r=0.8, z=7):
    ax.add_patch(Circle((x, y), r, fc=ORANGE, ec=ORANGE_D, lw=0.6, zorder=z))
    ax.plot([x - r, x + r], [y, y], color=ORANGE_D, lw=0.5, zorder=z + 1)
    ax.plot([x, x], [y - r, y + r], color=ORANGE_D, lw=0.5, zorder=z + 1)
    ax.add_patch(Arc((x, y), 1.4 * r, 2 * r, theta1=58, theta2=302, lw=0.45,
                     color=ORANGE_D, zorder=z + 1))
    ax.add_patch(Arc((x, y), 1.4 * r, 2 * r, theta1=-122, theta2=122, lw=0.45,
                     color=ORANGE_D, zorder=z + 1))


def wavy(ax, p0, p1, color=SLATE, lw=0.9, n=8, amp=0.5, z=5):
    p0 = np.array(p0, float); p1 = np.array(p1, float)
    d = p1 - p0; L = np.linalg.norm(d)
    if L == 0:
        return
    u = d / L; nrm = np.array([-u[1], u[0]])
    t = np.linspace(0, 1, 240)
    off = amp * np.sin(2 * np.pi * n * t) * np.sin(np.pi * t)
    pts = p0[None, :] + t[:, None] * d[None, :] + off[:, None] * nrm[None, :]
    ax.plot(pts[:, 0], pts[:, 1], color=color, lw=lw, zorder=z, solid_capstyle="round")


def ell_wedge(ax, xc, yc, rx, ry, a1, a2, fc, ec="none", alpha=1.0, z=2.4, n=90):
    a = np.radians(np.linspace(a1, a2, n))
    pts = [(xc + rx * np.cos(t), yc + ry * np.sin(t)) for t in a] + [(xc, yc)]
    ax.add_patch(Polygon(pts, closed=True, fc=fc, ec=ec, alpha=alpha, zorder=z))


def ell_band(ax, xc, yc, rx, ry, a1, a2, fc, alpha=1.0, z=2.4, n=120):
    a = np.radians(np.linspace(a1, a2, n))
    ax.add_patch(Polygon([(xc + rx * np.cos(t), yc + ry * np.sin(t)) for t in a],
                         closed=False, fill=False, ec=fc, lw=0.0, zorder=z))


def hoop_top(ax, x, y, r=1.1, z=6):
    ax.add_patch(Circle((x, y), r, fc="none", ec="#D94D1E", lw=1.1, zorder=z))


def basketball_icon(ax, x, y, r, z=6, lw=0.7, fc=PALE_O, ec=ORANGE):
    ax.add_patch(Circle((x, y), r, fc=fc, ec=ec, lw=lw, zorder=z))
    ax.plot([x - r, x + r], [y, y], color=ec, lw=lw * 0.8, zorder=z + 1)
    ax.add_patch(Arc((x, y), 1.3 * r, 2 * r, theta1=90, theta2=270, lw=lw * 0.8,
                     color=ec, zorder=z + 1))
    ax.add_patch(Arc((x, y), 1.3 * r, 2 * r, theta1=-90, theta2=90, lw=lw * 0.8,
                     color=ec, zorder=z + 1))


def basketball_side(ax, x, y, r, z=6, lw=0.8):
    ax.add_patch(Circle((x, y), r, fc=ORANGE, ec=ORANGE_D, lw=lw, zorder=z))
    ax.add_patch(Arc((x, y), 2 * r, 2 * r, theta1=0, theta2=360, lw=lw * 0.6,
                     color=ORANGE_D, zorder=z + 1))
    ax.plot([x - r, x + r], [y, y], color=ORANGE_D, lw=lw * 0.6, zorder=z + 1)
    ax.plot([x, x], [y - r, y + r], color=ORANGE_D, lw=lw * 0.6, zorder=z + 1)
    ax.add_patch(Arc((x, y), 1.5 * r, 2 * r, theta1=60, theta2=300, lw=lw * 0.55,
                     color=ORANGE_D, zorder=z + 1))
    ax.add_patch(Arc((x, y), 1.5 * r, 2 * r, theta1=-120, theta2=120, lw=lw * 0.55,
                     color=ORANGE_D, zorder=z + 1))


# ---------------------------------------------------------------- court
FIBA = dict(L=28.0, Wd=15.0, key_w=4.9, ft=5.8, ft_len=3.6, ft_r=1.8,
            three_r=6.75, corner_y=6.6, basket_d=1.575, bb_d=1.2,
            nc_r=1.25, centre_r=1.8, name="FIBA", col=BLUE)

NBA = dict(L=28.65, Wd=15.24, key_w=4.88, ft=5.79, ft_len=3.6, ft_r=1.83,
           three_r=7.24, corner_y=6.7, basket_d=1.6, bb_d=1.22,
           nc_r=1.22, centre_r=1.83, name="NBA", col=ORANGE)


# ---------------------------------------------------------------- court
FIBA = dict(L=28.0, Wd=15.0, key_w=4.9, ft=5.8, ft_len=3.6, ft_r=1.8,
            three_r=6.75, corner_y=6.6, basket_d=1.575, bb_d=1.2,
            nc_r=1.25, centre_r=1.8, name="FIBA", col=BLUE)

NBA = dict(L=28.65, Wd=15.24, key_w=4.88, ft=5.79, ft_len=3.6, ft_r=1.83,
           three_r=7.24, corner_y=6.7, basket_d=1.6, bb_d=1.22,
           nc_r=1.22, centre_r=1.83, name="NBA", col=ORANGE)


class Court:
    """To-scale renderer. d = metres measured from the baseline (X axis),
    y = metres across the court width (Y axis), s = +1 right / -1 left."""

    def __init__(self, ax, x0, y0, w, h, spec=FIBA, full=True,
                 fc="#FBFDFF", ec=SLATE, lw=0.8, z=3):
        self.ax, self.spec, self.full = ax, spec, full
        self.Lvis = spec["L"] if full else spec["L"] / 2.0
        self.x0, self.y0, self.w, self.h = x0, y0, w, h
        self.sx = w / self.Lvis
        self.sy = h / spec["Wd"]
        self.ec, self.lw, self.z = ec, lw, z
        ax.add_patch(Rectangle((x0, y0), w, h, fc=fc, ec="none", zorder=z))

    # ---- helpers
    def X(self, d, s=1):
        return self.x0 + (d if s > 0 else self.Lvis - d) * self.sx

    def Y(self, y):
        return self.y0 + y * self.sy

    def pt(self, d, y, s=1):
        return (self.X(d, s), self.Y(y))

    def _arc(self, dc, yc, r, a1, a2, s, **kw):
        ang = (a1, a2) if s > 0 else (180 - a2, 180 - a1)
        self.ax.add_patch(Arc((self.X(dc, s), self.Y(yc)), 2 * r * self.sx,
                              2 * r * self.sy, theta1=ang[0], theta2=ang[1], **kw))

    def _h(self, d0, d1, y, s, **kw):
        self.ax.plot([self.X(d0, s), self.X(d1, s)], [self.Y(y), self.Y(y)], **kw)

    def _v(self, d, y0_, y1_, s, **kw):
        self.ax.plot([self.X(d, s), self.X(d, s)], [self.Y(y0_), self.Y(y1_)], **kw)

    # ---- fills
    def _arcpts(self, s=1, n=110):
        sp = self.spec
        r, cy, Wd, bx = sp["three_r"], sp["corner_y"], sp["Wd"], sp["basket_d"]
        th = np.degrees(np.arcsin((Wd / 2 - cy) / r))
        dx = np.sqrt(r * r - (Wd / 2 - cy) ** 2)
        a = np.radians(np.linspace(-th, th, n))
        pts = [(self.X(bx + r * np.cos(t), s), self.Y(Wd / 2 + r * np.sin(t))) for t in a]
        return pts, dx, cy, Wd

    def zone2(self, s=1, fc="none", alpha=0.9, z=None):
        """The two-point area: corner lines + the arc, closed on the baseline."""
        pts, dx, cy, Wd = self._arcpts(s)
        poly = [(self.X(0, s), self.Y(cy))] + pts + \
               [(self.X(dx, s), self.Y(Wd - cy)), (self.X(0, s), self.Y(Wd - cy))]
        self.ax.add_patch(Polygon(poly, closed=True, fc=fc, ec="none", alpha=alpha,
                                  zorder=(z or self.z + 0.2)))

    def halves(self, s=1, c3=PALE_O, c2="#EAF3FA", alpha3=0.95, alpha2=1.0):
        """Wash the whole half-court as three-point area, then overlay the arc area."""
        sp = self.spec
        xa, xb = self.X(0, s), self.X(sp["L"] / 2, s)
        self.ax.add_patch(Rectangle((min(xa, xb), self.Y(0)), abs(xb - xa),
                                    sp["Wd"] * self.sy, fc=c3, ec="none",
                                    alpha=alpha3, zorder=self.z + 0.15))
        self.zone2(s, fc=c2, alpha=alpha2, z=self.z + 0.22)

    def key_fill(self, s=1, fc=PALE_B, alpha=0.6, z=None):
        sp = self.spec
        ylo = sp["Wd"] / 2 - sp["key_w"] / 2
        xa, xb = self.X(0, s), self.X(sp["ft"], s)
        self.ax.add_patch(Rectangle((min(xa, xb), self.Y(ylo)), abs(xb - xa),
                                    sp["key_w"] * self.sy, fc=fc, ec="none",
                                    alpha=alpha, zorder=(z or self.z + 0.3)))

    def naismith_fill(self, s=1, fc="#EAF3FA", alpha=1.0, z=None):
        """The old 'key' shape fans out below the free-throw circle."""
        sp = self.spec
        xa, xb = self.X(0, s), self.X(sp["ft"], s)
        self.ax.add_patch(Polygon([(xa, self.Y(0.9)), (xb, self.Y(sp["Wd"] / 2 - sp["ft_r"])),
                                   (xb, self.Y(sp["Wd"] / 2 + sp["ft_r"])),
                                   (xa, self.Y(sp["Wd"] - 0.9))],
                                  closed=True, fc=fc, ec="none", alpha=alpha,
                                  zorder=(z or self.z + 0.3)))

    # ---- lines
    def outline(self, lw=None):
        ax, z = self.ax, self.z
        ax.add_patch(Rectangle((self.x0, self.y0), self.w, self.h, fc="none",
                               ec=self.ec, lw=(lw or self.lw * 1.2), zorder=z + 0.6))

    def key(self, s=1, lw=None, ft_line=True):
        sp, lw = self.spec, lw or self.lw
        ylo, yhi = sp["Wd"] / 2 - sp["key_w"] / 2, sp["Wd"] / 2 + sp["key_w"] / 2
        self._v(sp["ft"], ylo, yhi, s, color=self.ec, lw=lw, zorder=self.z + 1)
        for yy in (ylo, yhi):
            self._h(0, sp["ft"], yy, s, color=self.ec, lw=lw, zorder=self.z + 1)
        # free-throw circle: far half solid, near half dashed
        if s > 0:
            solid, dash = (-90, 90), (90, 270)
        else:
            solid, dash = (90, 270), (-90, 90)
        self._arc(sp["ft"], sp["Wd"] / 2, sp["ft_r"], *solid, s, color=self.ec,
                  lw=lw, zorder=self.z + 1)
        self._arc(sp["ft"], sp["Wd"] / 2, sp["ft_r"], *dash, s, color=self.ec,
                  lw=lw, ls=(0, (2.0, 1.7)), zorder=self.z + 1)

    def board(self, s=1, lw_ring=1.0):
        sp = self.spec
        # backboard
        self.ax.plot([self.X(sp["bb_d"], s)] * 2,
                     [self.Y(sp["Wd"] / 2 - 0.9), self.Y(sp["Wd"] / 2 + 0.9)],
                     color=INK, lw=1.5, zorder=self.z + 2, solid_capstyle="butt")
        # ring
        self.ax.add_patch(Circle((self.X(sp["basket_d"], s), self.Y(sp["Wd"] / 2)),
                                 0.225 * self.sx, fc="none", ec=ORANGE_D,
                                 lw=lw_ring, zorder=self.z + 2))
        # restricted area arc (bulges away from baseline)
        self._arc(sp["basket_d"], sp["Wd"] / 2, sp["nc_r"], -90, 90, s,
                  color=self.ec, lw=self.lw * 0.85, zorder=self.z + 1)

    def three(self, s=1, lw=None):
        sp, lw = self.spec, lw or self.lw
        r = sp["three_r"]
        dy = sp["Wd"] / 2 - sp["corner_y"]
        dx = np.sqrt(r * r - dy * dy)
        th = np.degrees(np.arcsin(dy / r))
        for yy in (sp["corner_y"], sp["Wd"] - sp["corner_y"]):
            self._h(0, dx, yy, s, color=self.ec, lw=lw, zorder=self.z + 1)
        self._arc(sp["basket_d"], sp["Wd"] / 2, r, -th, th, s, color=self.ec,
                  lw=lw, zorder=self.z + 1)

    def centre(self, lw=None):
        sp, lw = self.spec, lw or self.lw
        self._v(sp["L"] / 2, 0, sp["Wd"], 1, color=self.ec, lw=lw, zorder=self.z + 1)
        self.ax.add_patch(Circle((self.X(sp["L"] / 2), self.Y(sp["Wd"] / 2)),
                                 sp["centre_r"] * self.sx, fc="none", ec=self.ec,
                                 lw=lw, zorder=self.z + 1))

    def free_throw_circle(self, s=1, lw=None, fc=None, alpha=0.4):
        sp, lw = self.spec, lw or self.lw
        if fc:
            self.ax.add_patch(Circle((self.X(sp["ft"], s), self.Y(sp["Wd"] / 2)),
                                     sp["ft_r"] * self.sx, fc=fc, ec="none",
                                     alpha=alpha, zorder=self.z + 0.4))

    def draw(self, ends=(1,), lw=None):
        for s in ends:
            self.key(s, lw)
            self.board(s)
            self.three(s)
        if self.full:
            self.centre(lw)
        self.outline()
        return self


def section(ax, x, y, w, title, color=BLUE, fs=5.6, ha="left"):
    txt(ax, x, y, title.upper(), fs=fs, color=color, weight="bold", ha=ha)
    if ha == "left":
        ax.plot([x, x + w], [y - 1.15, y - 1.15], color=color, lw=0.7, alpha=0.4, zorder=3)
