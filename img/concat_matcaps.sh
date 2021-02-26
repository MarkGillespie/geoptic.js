#!/bin/bash

# Assumes argument is, e.g. clay_r.png, and the other files
# end in _g.png, _b.png, and _k.png
matcap_file=$1
rp=${matcap_file%_*} # Trim everything after last _ to obtain a raw prefix

matcap_r="${rp}_r.png"
matcap_g="${rp}_g.png"
matcap_b="${rp}_b.png"
matcap_k="${rp}_k.png"
matcap_rgbk="${rp}_rgbk.png"

# lay all of the images out in a grid with no spacing between them
montage $matcap_r $matcap_g $matcap_b $matcap_k -geometry +0+0 $matcap_rgbk
