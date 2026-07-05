"""Génère app.ico (multi-tailles) et le favicon à partir du design K-éclair.
Dessin vectoriel via Pillow en haute résolution puis réduction propre.
"""
from PIL import Image, ImageDraw, ImageFont
import os

S = 1024  # canevas de travail (4x 256 pour l'anticrénelage)
K = S / 256.0

NIGHT = (10, 15, 20, 255)      # #0a0f14
IVORY = (234, 255, 246, 255)   # #eafff6
EM_A = (52, 211, 153)          # #34d399
EM_B = (13, 148, 136)          # #0d9488


def rounded_rect(draw, box, radius, fill):
    draw.rounded_rectangle(box, radius=radius, fill=fill)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def draw_gradient_polygon(img, points, c1, c2):
    """Polygone rempli d'un dégradé diagonal (masque + bandes)."""
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).polygon(points, fill=255)
    grad = Image.new("RGBA", img.size)
    gd = ImageDraw.Draw(grad)
    w, h = img.size
    for y in range(h):
        t = y / h
        gd.line([(0, y), (w, y)], fill=lerp(c1, c2, t) + (255,))
    img.paste(grad, (0, 0), mask)


def build_icon():
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    rounded_rect(d, [0, 0, S - 1, S - 1], int(58 * K), NIGHT)

    # Barre verticale du K (extrémités arrondies)
    x, y1, y2, w = 82 * K, 48 * K, 208 * K, 21 * K
    d.line([(x, y1), (x, y2)], fill=IVORY, width=int(w))
    r = w / 2
    d.ellipse([x - r, y1 - r, x + r, y1 + r], fill=IVORY)
    d.ellipse([x - r, y2 - r, x + r, y2 + r], fill=IVORY)

    # Éclair (bras du K) en dégradé émeraude
    bolt = [(179, 35), (102, 134), (141, 134), (115, 221), (198, 109), (157, 109)]
    bolt = [(int(px * K), int(py * K)) for px, py in bolt]
    draw_gradient_polygon(img, bolt, EM_A, EM_B)

    # "2M" en bas à droite (Consolas si dispo)
    font = None
    for cand in (r"C:\Windows\Fonts\consolab.ttf", r"C:\Windows\Fonts\consola.ttf",
                 r"C:\Windows\Fonts\CascadiaMono.ttf", r"C:\Windows\Fonts\cour.ttf"):
        if os.path.exists(cand):
            font = ImageFont.truetype(cand, int(46 * K))
            break
    if font:
        d.text((196 * K, 196 * K), "2M", font=font, fill=EM_A + (255,), anchor="mm")

    return img


def main():
    art = build_icon()
    base = os.path.dirname(os.path.abspath(__file__))

    art.resize((256, 256), Image.LANCZOS).save(os.path.join(base, "icon_256.png"))

    sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)]
    art.resize((256, 256), Image.LANCZOS).save(
        os.path.join(base, "app.ico"), format="ICO", sizes=sizes
    )

    # Favicon du frontend (= icône de la fenêtre de l'appli)
    fav = os.path.join(base, "frontend", "app", "favicon.ico")
    art.resize((256, 256), Image.LANCZOS).save(
        fav, format="ICO", sizes=[(48, 48), (32, 32), (16, 16)]
    )

    print("OK : app.ico, icon_256.png et frontend/app/favicon.ico generes.")


if __name__ == "__main__":
    main()
