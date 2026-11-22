import sys
from PIL import Image
Image.MAX_IMAGE_PIXELS=None
d, name, chunk, scale = sys.argv[1], sys.argv[2], int(sys.argv[3]), float(sys.argv[4])
maxchunks = int(sys.argv[5]) if len(sys.argv) > 5 else 99
im=Image.open(f"{d}/{name}.png").convert("RGB"); W,H=im.size; n=0
for y in range(0,H,chunk):
    if n >= maxchunks: break
    p=im.crop((0,y,W,min(H,y+chunk))); p=p.resize((int(p.width*scale),int(p.height*scale))); p.save(f"{d}/{name}-{n:02d}.jpg",quality=70); n+=1
print(name,W,H,n)
