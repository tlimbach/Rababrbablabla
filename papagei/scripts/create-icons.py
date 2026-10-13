"""Render the code-native Plapperwurm icon with no external dependencies."""
from pathlib import Path
import math, struct, zlib, random
ROOT = Path(__file__).resolve().parents[1] / 'dist'
SIZE = 512
pixels = [[2., 6., 10.] for _ in range(SIZE * SIZE)]
def blend(x, y, color, alpha):
    if 0 <= x < SIZE and 0 <= y < SIZE:
        p = pixels[y * SIZE + x]
        for c in range(3): p[c] = p[c] * (1-alpha) + color[c] * alpha
rng = random.Random(42)
for _ in range(42):
    x,y = rng.randrange(20,492),rng.randrange(20,492)
    blend(x,y,(190,199,220),rng.uniform(.2,.65))
# Dotted rings taper into the lower-left corner; the large head stays legible.
for i in range(12):
    t = i / 11
    cx,cy = 88 + 225*t, 400 - 172*t + 20*math.sin(t*math.pi)
    radius = 9 + 115*t
    opacity = .2 + .7*t
    for y in range(max(0,int(cy-radius-25)),min(SIZE,int(cy+radius+26))):
        for x in range(max(0,int(cx-radius-25)),min(SIZE,int(cx+radius+26))):
            angle = math.atan2(y-cy,x-cx)
            contour = radius + (2+4*t)*math.sin(3*angle+.4) + 2*t*math.sin(5*angle)
            distance = abs(math.hypot(x-cx,y-cy)-contour)
            if i == 11:
                alpha = min(.98, .7*math.exp(-(distance/2.5)**2)+.3*math.exp(-(distance/11)**2))
                color=(143,255,203)
            else:
                dots = max(12,round(radius*.9))
                along = abs(((angle*dots/(2*math.pi)+.5)%1)-.5)*2*math.pi*radius/dots
                alpha = opacity*math.exp(-((distance/1.65)**2+(along/1.65)**2))
                color=(106,213,176)
            if alpha > .002: blend(x,y,color,alpha)
def write_png(size, filename):
    rows=bytearray()
    for y in range(size):
        rows.append(0)
        for x in range(size):
            # Area average gives crisp small Home Screen icons.
            x0,x1=int(x*SIZE/size),max(int(x*SIZE/size)+1,int((x+1)*SIZE/size))
            y0,y1=int(y*SIZE/size),max(int(y*SIZE/size)+1,int((y+1)*SIZE/size))
            count=(x1-x0)*(y1-y0)
            for c in range(3): rows.append(round(sum(pixels[yy*SIZE+xx][c] for yy in range(y0,y1) for xx in range(x0,x1))/count))
    def chunk(tag,data): return struct.pack('!I',len(data))+tag+data+struct.pack('!I',zlib.crc32(tag+data)&0xffffffff)
    data=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('!2I5B',size,size,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(rows))+chunk(b'IEND',b'')
    (ROOT/filename).write_bytes(data)
for size,name in [(180,'apple-touch-icon.png'),(192,'icon-192.png'),(512,'icon-512.png'),(32,'favicon.png')]: write_png(size,name)
