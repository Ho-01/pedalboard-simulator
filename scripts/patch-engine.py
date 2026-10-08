from pathlib import Path
import sys
import re
root=Path(sys.argv[1])
p=root/'src/spicelib/analysis/cktsopt.c'
s=p.read_text()
s=s.replace('#else\n    case OPT_ENH_RSHUNT:\n        fprintf(stderr, "WARNING - Option Rshunt available only with XSPICE enabled.\\n");\n        break;\n#endif','#endif')
p.write_text(s)
keep={'asrc','bjt','cap','cccs','ccvs','csw','dio','ind','isrc','jfet','jfet2','mos1','mos2','mos3','mos6','mos9','res','sw','urc','vccs','vcvs','vsrc','vdmos','tra','ltra'}
p=root/'src/spicelib/devices/Makefile.am'
s=p.read_text()
start=s.index('SUBDIRS =')
end=s.index('\n\n',start)
s=s[:start]+'SUBDIRS = '+' '.join(sorted(keep))+s[end:]
p.write_text(s)
p=root/'src/Makefile.am'
lines=p.read_text().splitlines(True)
p.write_text(''.join(line for line in lines if not ((m:=re.search(r'spicelib/devices/([^/]+)/lib[^\s]+\.la',line)) and m[1] not in keep and m[1] not in {'ndev','nbjt','nbjt2','numd','numd2','numos'})))
p=root/'src/spicelib/devices/dev.c'
s=p.read_text()
start=s.index('static SPICEdev *(*static_devices[])(void) = {')
end=s.index('\n};',start)
functions=['urc','asrc','bjt','cap','cccs','ccvs','csw','dio','ind','mut','isrc','jfet','jfet2','ltra','mos1','mos2','mos3','mos6','mos9','res','sw','tra','vccs','vcvs','vsrc','vdmos']
block='static SPICEdev *(*static_devices[])(void) = {\n    /* URC must precede R/C. Classic-device build; equations unchanged. */\n'+''.join('    get_'+f+'_info,\n' for f in functions)
s=s[:start]+block+s[end:]
p.write_text(s)
print('Classic device registration/link subset:',','.join(sorted(keep)))
