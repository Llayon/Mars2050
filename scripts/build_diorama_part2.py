#!/usr/bin/env python3
"""Часть 2: Сборка диорамы 'Парящий остров' (шаги 8-14) строго по инструкции."""

import sys, random
from pathlib import Path

sys.path.insert(0, str(Path.home() / "AppData/Local/opencode/mcp/magicavoxel-mcp"))
from vox_utils import VoxelModel, write_vox_file, render_model_to_image

random.seed(42)
VOX = Path("D:/Programms/MagicaVoxel-0.99.7.2-win64/MagicaVoxel-0.99.7.2-win64/vox")
EXP = Path("D:/Programms/MagicaVoxel-0.99.7.2-win64/MagicaVoxel-0.99.7.2-win64/export")

# ── Единая палитра (все 28+ цветов) ──────────────────────────────
PAL = [
    (0,0,0,0),
    (139,90,43,255),     # 1 земля база
    (92,58,33,255),      # 2 земля тёмная
    (160,114,69,255),    # 3 земля светлая
    (76,175,80,255),     # 4 трава база
    (129,199,132,255),   # 5 трава блик
    (56,142,60,255),     # 6 трава тень
    (33,150,243,255),    # 7 вода база
    (100,181,246,255),   # 8 вода светлая
    (255,255,255,255),   # 9 белый
    (93,64,55,255),      # 10 ствол
    (62,39,35,255),      # 11 ствол тень
    (67,160,71,255),     # 12 листва
    (102,187,106,255),   # 13 листва блик
    (27,94,32,255),      # 14 листва тень
    (244,67,54,255),     # 15 цветок красный
    (255,235,59,255),    # 16 цветок жёлтый
    (255,255,255,255),   # 17 цветок белый
    (139,195,74,255),    # 18 стебель
    (215,204,200,255),   # 19 дерево светлое
    (141,110,99,255),    # 20 дерево тень
    (93,64,55,255),      # 21 дерево тёмное
    (158,158,158,255),   # 22 камень база
    (189,189,189,255),   # 23 камень светлый
    (117,117,117,255),   # 24 камень тёмный
    (245,124,0,255),     # 25 сундук основа
    (62,39,35,255),      # 26 сундук окантовка
    (255,193,7,255),     # 27 сундук замок
    (33,33,33,255),      # 28 сундук щель
]
while len(PAL) < 256:
    i = len(PAL)
    PAL.append((i,i,i,255))

C = lambda i: i

# ── Сцена ────────────────────────────────────────────────────────
SZ = 126
m = VoxelModel(SZ, SZ, SZ)
m.palette = PAL[:]

# Шаг 8.1: Создано рабочее пространство 126x126x126
print("Шаг 8.1: OK — сцена 126x126x126")

# Шаг 8.2: Нижний ярус — платформа 10x10 тайлов (округлая)
ISLAND_CX, ISLAND_CY = 63, 63
R1 = 50  # радиус нижнего яруса в вокселях (5 тайлов по 10)

for x in range(SZ):
    for y in range(SZ):
        dx, dy = x - ISLAND_CX, y - ISLAND_CY
        dist = (dx*dx + dy*dy)**0.5
        if dist < R1:
            z = 3
            m.set_voxel(x, y, z, C(4))     # трава сверху
            m.set_voxel(x, y, z-1, C(4))
            m.set_voxel(x, y, z-2, C(1))
            m.set_voxel(x, y, z-3, C(1))

print(f"Шаг 8.2: OK — платформа {m.get_voxel_count()}v")

# Шаг 8.3: Средний ярус (6x6 тайлов, смещён)
R2 = 30
MID_CX, MID_CY = ISLAND_CX + 15, ISLAND_CY - 5
for x in range(SZ):
    for y in range(SZ):
        dx, dy = x - MID_CX, y - MID_CY
        if (dx*dx + dy*dy)**0.5 < R2:
            z = 8
            for dz in range(5):
                c = C(4) if dz >= 3 else C(1)
                m.set_voxel(x, y, z + dz, c)

print(f"Шаг 8.3: OK — средний ярус {m.get_voxel_count()}v")

# Шаг 8.4: Верхний ярус (3x3 тайла)
R3 = 15
TOP_CX, TOP_CY = MID_CX + 10, MID_CY + 10
for x in range(SZ):
    for y in range(SZ):
        dx, dy = x - TOP_CX, y - TOP_CY
        if (dx*dx + dy*dy)**0.5 < R3:
            z = 16
            for dz in range(5):
                c = C(4) if dz >= 3 else C(1)
                m.set_voxel(x, y, z + dz, c)

print(f"Шаг 8.4: OK — верхняя гора {m.get_voxel_count()}v")

# Шаг 8.5: Сталактиты вниз
for _ in range(30):
    cx = ISLAND_CX + random.randint(-R1+5, R1-5)
    cy = ISLAND_CY + random.randint(-R1+5, R1-5)
    dx, dy = cx - ISLAND_CX, cy - ISLAND_CY
    dist = (dx*dx + dy*dy)**0.5
    if dist > R1 - 5:
        continue
    length = random.randint(5, 15)
    if dist > R1 * 0.7:
        length = random.randint(2, 5)
    for i in range(length):
        rad = max(1, 4 - i // 3)
        for rx in range(-rad, rad+1):
            for ry in range(-rad, rad+1):
                if abs(rx) == rad and abs(ry) == rad and random.random() < 0.3:
                    continue
                m.set_voxel(cx+rx, cy+ry, 2-i, C(2) if random.random() < 0.2 else C(1))

print(f"Шаг 8.5: OK — сталактиты {m.get_voxel_count()}v")

# ── Шаг 9: Водопад ───────────────────────────────────────────────
# Шаг 9.1: Исток на горе
for x in range(TOP_CX-8, TOP_CX+8):
    for y in range(TOP_CY-8, TOP_CY+8):
        dx, dy = x - TOP_CX, y - TOP_CY
        if (dx*dx + dy*dy)**0.5 < 8:
            m.set_voxel(x, y, 20, C(7))   # вода
            m.set_voxel(x, y, 19, C(7))

# Каскад 1: с горы на средний ярус (юго-восточный край)
C1_X, C1_Y = TOP_CX + 12, TOP_CY + 10
for z in range(13, 19):
    for dx in [-2,-1,0,1,2]:
        for dy in [-1,0,1]:
            m.set_voxel(C1_X+dx, C1_Y+dy, z, C(7))
# струи
for _ in range(4):
    xx = C1_X + random.randint(-1,1)
    for z in range(13, 18):
        if random.random() < 0.7:
            m.set_voxel(xx, C1_Y, z, C(8))
# пена
for x in range(C1_X-3, C1_X+4):
    for y in range(C1_Y-2, C1_Y+3):
        for z in range(13, 15):
            if random.random() < 0.3:
                m.set_voxel(x, y, z, C(9))

# Бассейн на среднем ярусе
for x in range(C1_X-8, C1_X+10):
    for y in range(C1_Y-6, C1_Y+8):
        dx, dy = x - C1_X, y - C1_Y
        if (dx*dx + dy*dy)**0.5 < 9:
            for z in range(8, 11):
                m.set_voxel(x, y, z, C(7))
            m.set_voxel(x, y, 11, C(8) if random.random() < 0.2 else C(7))

print(f"Шаг 9.1: OK — исток и каскад 1 {m.get_voxel_count()}v")

# Шаг 9.2: Каскад 2 — с края среднего яруса на нижний
C2_X, C2_Y = C1_X + 14, C1_Y + 10
for z in range(3, 12):
    for dx in [-2,-1,0,1,2]:
        for dy in [-1,0,1]:
            m.set_voxel(C2_X+dx, C2_Y+dy, z, C(7))
# струи
for _ in range(3):
    xx = C2_X + random.randint(-1,1)
    for z in range(3, 11):
        if random.random() < 0.7:
            m.set_voxel(xx, C2_Y, z, C(8))
# нижний бассейн
for x in range(C2_X-8, C2_X+10):
    for y in range(C2_Y-6, C2_Y+8):
        dx, dy = x - C2_X, y - C2_Y
        if (dx*dx + dy*dy)**0.5 < 9:
            for z in range(3, 6):
                m.set_voxel(x, y, z, C(7))

# Шаг 9.3: Главный водопад в пустоту с края острова
C3_X = ISLAND_CX + R1 - 5
C3_Y = ISLAND_CY
for z in range(0, 20):
    for dx in range(-3, 4):
        for dy in range(-1, 2):
            m.set_voxel(C3_X+dx, C3_Y+dy, z, C(7))
for _ in range(3):
    xx = C3_X + random.randint(-1,1)
    for z in range(0, 18):
        if random.random() < 0.6:
            m.set_voxel(xx, C3_Y, z, C(8))
# пена у подножия
for x in range(C3_X-4, C3_X+5):
    for y in range(C3_Y-2, C3_Y+3):
        for z in range(0, 3):
            if random.random() < 0.4:
                m.set_voxel(x, y, z, C(9))

print(f"Шаг 9.2-9.3: OK — каскады и главный водопад {m.get_voxel_count()}v")

# ── Шаг 10: Мосты и лестницы ────────────────────────────────────
# Лестница: нижний → средний ярус
LX1, LY1, LZ1 = MID_CX - 5, MID_CY + R2 - 3, 5
for i in range(5):
    sx = LX1 + i * 2
    sz = LZ1 + i
    for x in range(sx, sx+3):
        for y in range(LY1, LY1+5):
            m.set_voxel(x, y, sz, C(19))
            m.set_voxel(x, y, sz-1, C(20))
    # перила
    m.set_voxel(sx, LY1, sz+1, C(21))
    m.set_voxel(sx, LY1, sz+2, C(21))
    m.set_voxel(sx+2, LY1, sz+1, C(21))
    m.set_voxel(sx+2, LY1, sz+2, C(21))

# Лестница: средний → верх
LX2, LY2, LZ2 = TOP_CX - 8, TOP_CY - 5, 12
for i in range(4):
    sx = LX2 + i * 2
    sz = LZ2 + i
    for x in range(sx, sx+3):
        for y in range(LY2, LY2+4):
            m.set_voxel(x, y, sz, C(19))
            m.set_voxel(x, y, sz-1, C(20))

# Мостик через бассейн 1
MX1, MY1, MZ1 = C1_X - 5, C1_Y - 4, 10
for i in range(10):
    if i % 3 != 2:
        for x in range(3):
            m.set_voxel(MX1+x, MY1+i, MZ1, C(19))
            m.set_voxel(MX1+x, MY1+i, MZ1-1, C(20))
for i in range(10):
    m.set_voxel(MX1, MY1+i, MZ1-2, C(21))
    m.set_voxel(MX1+2, MY1+i, MZ1-2, C(21))
    m.set_voxel(MX1, MY1+i, MZ1+1, C(21))
    m.set_voxel(MX1+2, MY1+i, MZ1+1, C(21))

# Мостик через бассейн 2
MX2, MY2, MZ2 = C2_X - 4, C2_Y + 5, 7
for i in range(8):
    if i % 3 != 2:
        for x in range(3):
            m.set_voxel(MX2+x, MY2+i, MZ2, C(19))
            m.set_voxel(MX2+x, MY2+i, MZ2-1, C(20))
for i in range(8):
    m.set_voxel(MX2, MY2+i, MZ2+1, C(21))
    m.set_voxel(MX2+2, MY2+i, MZ2+1, C(21))

print(f"Шаг 10: OK — мосты и лестницы {m.get_voxel_count()}v")

# ── Шаг 11: Декорирование ────────────────────────────────────────
# Шаг 11.1: Деревья (6 штук)
tree_positions = [
    (ISLAND_CX-25, ISLAND_CY-20, 3, 10),
    (ISLAND_CX+30, ISLAND_CY-15, 3, 12),
    (ISLAND_CX-10, ISLAND_CY+35, 3, 10),
    (MID_CX-12, MID_CY+15, 8, 11),
    (MID_CX+18, MID_CY-18, 8, 12),
    (TOP_CX-5, TOP_CY+8, 16, 10),
]
for tx, ty, tz, th in tree_positions:
    # ствол
    for x in [tx, tx+1]:
        for y in [ty, ty+1]:
            for z in range(th):
                m.set_voxel(x, y, tz+z, C(10))
    # крона (3 яруса)
    layers = [(3, tz+th-4, 5), (2, tz+th-1, 4), (1, tz+th+2, 3)]
    for lw, lz, lh in layers:
        for dx in range(-lw, lw+1):
            for dy in range(-lw, lw+1):
                for dz in range(lh):
                    if abs(dx)==lw and abs(dy)==lw and random.random()<0.3:
                        continue
                    c = C(12)
                    r = random.random()
                    if r < 0.12: c = C(13)
                    elif r < 0.22: c = C(14)
                    m.set_voxel(tx+dx+1, ty+dy+1, lz+dz, c)

# Доп дерево у водопада
m.set_voxel(C1_X+6, C1_Y+5, 10, C(10))
m.set_voxel(C1_X+6, C1_Y+5, 11, C(10))
for lw, lz, lh in [(2, 11, 4)]:
    for dx in range(-lw, lw+1):
        for dy in range(-lw, lw+1):
            for dz in range(lh):
                m.set_voxel(C1_X+6+dx, C1_Y+5+dy, lz+dz, C(12))

print(f"Шаг 11.1: OK — деревья {m.get_voxel_count()}v")

# Шаг 11.2: Камни по берегам
for _ in range(20):
    cx, cy = C2_X + random.randint(-10, 10), C2_Y + random.randint(-10, 10)
    if m.get_voxel(cx, cy, 3) in [C(7), 0]:
        continue
    for x in range(3):
        for y in range(3):
            for z in range(2):
                if random.random() < 0.6:
                    c = C(22)
                    r = random.random()
                    if z == 1 and r < 0.3: c = C(23)
                    elif z == 0 and r < 0.3: c = C(24)
                    m.set_voxel(cx+x, cy+y, 3+z, c)

# Крупные валуны
for bx, by in [(ISLAND_CX-30, ISLAND_CY+25), (TOP_CX-10, TOP_CY-8)]:
    for x in range(4):
        for y in range(4):
            for z in range(3):
                if x in [0,3] and y in [0,3] and random.random() < 0.4:
                    continue
                m.set_voxel(bx+x, by+y, 3+z, C(22) if z==2 else C(23) if random.random()<0.3 else C(22))

print(f"Шаг 11.2: OK — камни {m.get_voxel_count()}v")

# Шаг 11.3: Кусты и цветы
for _ in range(15):
    bx = ISLAND_CX + random.randint(-R1+5, R1-5)
    by = ISLAND_CY + random.randint(-R1+5, R1-5)
    for x in range(3):
        for y in range(3):
            for z in range(2):
                dx, dy, dz = x-1, y-1, z-1
                if (dx*dx+dy*dy+dz*dz)**0.5 < 2:
                    c = C(12)
                    r = random.random()
                    if r < 0.15: c = C(13)
                    elif r < 0.25: c = C(14)
                    m.set_voxel(bx+x, by+y, 3+z, c)

for _ in range(10):
    fx = ISLAND_CX + random.randint(-R1+5, R1-5)
    fy = ISLAND_CY + random.randint(-R1+5, R1-5)
    fc = random.choice([15, 16, 17])
    m.set_voxel(fx, fy, 4, C(18))
    m.set_voxel(fx, fy, 5, C(fc))

print(f"Шаг 11.3: OK — кусты и цветы {m.get_voxel_count()}v")

# ── Шаг 12: Сундук на вершине горы ──────────────────────────────
for x in range(6):
    for y in range(4):
        for z in range(3):
            m.set_voxel(TOP_CX+x, TOP_CY+y, 20+z, C(25))
        m.set_voxel(TOP_CX+x, TOP_CY+y, 23, C(25))
for y in range(1, 3):
    for x in range(6):
        m.set_voxel(TOP_CX+x, TOP_CY+y, 24, C(25))
for x in [0, 5]:
    for y in range(4):
        for z in range(5):
            m.set_voxel(TOP_CX+x, TOP_CY+y, 20+z, C(26))
for y in [0, 3]:
    for x in range(6):
        for z in range(5):
            m.set_voxel(TOP_CX+x, TOP_CY+y, 20+z, C(26))
for x in range(6):
    m.set_voxel(TOP_CX+x, TOP_CY+0, 24, C(26))
    m.set_voxel(TOP_CX+x, TOP_CY+3, 24, C(26))
for x in range(6):
    for y in range(4):
        m.set_voxel(TOP_CX+x, TOP_CY+y, 23, C(28))
m.set_voxel(TOP_CX+3, TOP_CY+2, 23, C(27))
m.set_voxel(TOP_CX+2, TOP_CY+2, 23, C(27))

print(f"Шаг 12: OK — сундук на вершине {m.get_voxel_count()}v")

# ── Шаг 13: Финальные штрихи ────────────────────────────────────
# Шаг 13.1: Малые острова
for sx, sy, sz, has_tree in [(ISLAND_CX+55, ISLAND_CY+20, 8, True), (ISLAND_CX-50, ISLAND_CY-30, 5, False)]:
    for x in range(5):
        for y in range(5):
            for z in range(3):
                m.set_voxel(sx+x, sy+y, sz+z, C(1))
            m.set_voxel(sx+x, sy+y, sz+3, C(4))
    if has_tree:
        for x in [sx+1, sx+2]:
            for y in [sy+1, sy+2]:
                for z in range(5):
                    m.set_voxel(x, y, sz+3+z, C(10))

# Шаг 13.2: Облака
cloud_configs = [
    (15, 15, 40, 8, 5, 3),
    (95, 20, 45, 10, 4, 2),
    (40, 100, 50, 7, 4, 3),
    (110, 80, 38, 6, 3, 2),
    (20, 105, 55, 9, 5, 3),
    (80, 110, 35, 5, 4, 2),
    (105, 10, 50, 8, 4, 2),
    (5, 60, 45, 7, 3, 2),
    (60, 5, 42, 6, 4, 2),
]
for cx, cy, cz, cw, cd, ch in cloud_configs:
    for x in range(cw):
        for y in range(cd):
            m.set_voxel(cx+x, cy+y, cz, C(9))
            r = random.random()
            if r < 0.4: m.set_voxel(cx+x, cy+y, cz+1, C(9))
            if r < 0.15: m.set_voxel(cx+x, cy+y, cz+2, C(9))
    for _ in range(4):
        if cw > 4:
            rx = cx + random.randint(2, cw-2)
        else:
            rx = cx + random.randint(0, cw-1)
        if cd > 4:
            ry = cy + random.randint(2, cd-2)
        else:
            ry = cy + random.randint(0, cd-1)
        for dz in range(1, ch):
            m.set_voxel(rx, ry, cz+dz, C(9))

print(f"Шаг 13: OK — облака и малые острова {m.get_voxel_count()}v")

# ── Сохранение ───────────────────────────────────────────────────
vox_path = VOX / "floating_island_diorama.vox"
write_vox_file(vox_path, m)
bounds = m.get_bounds()
print(f"\nДиорама сохранена: {vox_path}")
print(f"Всего вокселей: {m.get_voxel_count()}, границы: {bounds}")

# Рендер (уменьшенный scale из-за большого размера)
from PIL import Image
for angle in ["front", "top"]:
    raw = EXP / f"diorama_{angle}_raw.png"
    out = EXP / f"diorama_{angle}.png"
    ok = render_model_to_image(m, angle, raw)
    if ok:
        img = Image.open(raw).convert("RGBA")
        scale = 2
        scaled = img.resize((img.width*scale, img.height*scale), Image.NEAREST)
        scaled.save(out, "PNG")
        raw.unlink()
        print(f"Рендер {angle}: {out} ({img.width*scale}x{img.height*scale})")
    else:
        print(f"Рендер {angle} FAILED", file=sys.stderr)

print("\nШаг 14: Открой .vox в MagicaVoxel → вкладка Render")
print("Настрой: Orthographic камера 45°, Sun 60°, мягкие тени")
print("Дождись Accumulation → сохрани PNG")
