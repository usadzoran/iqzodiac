from pathlib import Path
import re

OUT = Path(__file__).resolve().parents[1] / 'assets' / 'gifts'
OUT.mkdir(parents=True, exist_ok=True)
gifts = [
('red-rose','Red Rose','#ff5e83','#ffb2c7'),('little-heart','Little Heart','#ff4f91','#ffb9d8'),('magic-butterfly','Magic Butterfly','#8d7bff','#72e8ff'),
('teddy-bear','Teddy Bear','#c98d68','#f4c49b'),('golden-star','Golden Star','#f4bf3d','#fff2a6'),('love-letter','Love Letter','#ec6683','#ffd1dd'),
('flower-bouquet','Flower Bouquet','#ff7c9b','#ffe3a7'),('birthday-cake','Birthday Cake','#f078d2','#ffd86b'),('diamond-ring','Diamond Ring','#64d8ff','#d8fbff'),
('luxury-perfume','Luxury Perfume','#c49bff','#f5deff'),('golden-trophy','Golden Trophy','#e6a932','#fff3a5'),('love-swan','Love Swan','#9bdcff','#ffffff'),
('blue-diamond','Blue Diamond','#3b9cff','#baf5ff'),('magic-unicorn','Magic Unicorn','#d47aff','#7cddff'),('angel-wings','Angel Wings','#d8e8ff','#ffffff'),
('royal-crown','Royal Crown','#e1ae3b','#fff0a1'),('luxury-yacht','Luxury Yacht','#36c7e8','#c6f9ff'),('golden-phoenix','Golden Phoenix','#ff823e','#ffe48a'),
('sports-car','Sports Car','#f24f68','#ffbd77'),('golden-dragon','Golden Dragon','#e8a937','#ffec91'),('diamond-necklace','Diamond Necklace','#75d8ff','#e4fcff'),
('private-jet','Private Jet','#8fa9ff','#d9e5ff'),('fantasy-castle','Fantasy Castle','#ac84ff','#ffbff0'),('golden-lion','Golden Lion','#e5a52f','#fff2a1'),
('royal-heart','Royal Heart','#ff4f85','#ffd0e0'),('galaxy-planet','Galaxy Planet','#7e66e8','#55e5ff'),('diamond-throne','Diamond Throne','#7edcff','#f1ffff'),
('cosmic-galaxy-portal','Cosmic Galaxy Portal','#7b64ff','#46e6ff'),('legendary-royal-palace','Legendary Royal Palace','#e5a936','#fff0a2'),('celestial-phoenix-wings','Celestial Phoenix Wings','#ff6e45','#d2a2ff'),
]
for code, title, c1, c2 in gifts:
    safe = re.sub(r'[^a-z0-9-]', '-', code)
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" role="img" aria-labelledby="title desc">
<title id="title">{title}</title><desc id="desc">Original glossy 3D-style IQZodiac gift artwork</desc>
<defs><radialGradient id="bg"><stop stop-color="{c2}" stop-opacity=".34"/><stop offset="1" stop-color="#090d27" stop-opacity="0"/></radialGradient><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="{c2}"/><stop offset=".42" stop-color="{c1}"/><stop offset="1" stop-color="#351e83"/></linearGradient><filter id="glow"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
<circle cx="80" cy="80" r="70" fill="url(#bg)"/><g filter="url(#glow)"><path d="M80 20C88 42 112 45 127 64c16 20 2 56-23 66-25 10-58-1-69-25-12-27 7-51 29-60 10-4 12-14 16-25z" fill="url(#g)" stroke="{c2}" stroke-opacity=".7" stroke-width="3"/><path d="M54 91c14-27 38-35 54-22 12 10 12 28 0 40-14 14-39 13-54-18z" fill="#fff" opacity=".2"/><ellipse cx="63" cy="55" rx="13" ry="7" fill="#fff" opacity=".5" transform="rotate(-28 63 55)"/></g><g fill="{c2}"><circle cx="27" cy="42" r="2"/><circle cx="132" cy="39" r="2"/><circle cx="126" cy="125" r="2"/><circle cx="35" cy="117" r="1.7"/></g></svg>'''
    (OUT / f'{safe}.svg').write_text(svg, encoding='utf-8')
print(f'generated {len(gifts)} SVG assets in {OUT}')
