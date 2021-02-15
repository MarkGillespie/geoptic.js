# Samples from a matplotlib colormap and writes a ppm, which can then be converted to a png and used as an OpenGL texture
# If you have imagemagick, you can batch-convert ppm to png via:
# mogrify -format png *.ppm

import numpy as np
import matplotlib.cm
import matplotlib.colors

nValues = 500;

def write_map(name):
    # get a matplotlib colormap
    cmapName = name
    cmap = matplotlib.cm.get_cmap(cmapName)

    # get a cmocean colormap
    # import cmocean
    # cmapName = 'phase'
    # cmap = cmocean.cm.phase

    with open(name + ".ppm", "w") as f:
        f.write("P3\n")
        f.write(f"{nValues} 1\n")
        f.write("255\n")
        for i in range(nValues):

            floatInd = float(i) / (nValues-1)
            color = cmap(floatInd)

            f.write(f"{int(color[0]*255)} {int(color[1]*255)} {int(color[2]*255)}\n")

cmaps = ['viridis', 'plasma', 'magma', 'inferno', 'bwr', 'Blues', 'PiYG', 'Spectral', 'rainbow', 'jet', 'Reds', 'hsv', 'RdPu']

for cm in cmaps:
    write_map(cm)
