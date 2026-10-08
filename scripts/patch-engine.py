from pathlib import Path
import sys
import re
root=Path(sys.argv[1])
def write_changed(p, text):
    if p.read_text() != text: p.write_text(text)
p=root/'src/spicelib/analysis/cktsopt.c'
s=p.read_text()
s=s.replace('#else\n    case OPT_ENH_RSHUNT:\n        fprintf(stderr, "WARNING - Option Rshunt available only with XSPICE enabled.\\n");\n        break;\n#endif','#endif')
write_changed(p,s)
keep={'asrc','bjt','cap','cccs','ccvs','csw','dio','ind','isrc','jfet','jfet2','mos1','mos2','mos3','mos6','mos9','res','sw','urc','vccs','vcvs','vsrc','vdmos','tra','ltra'}
p=root/'src/spicelib/devices/Makefile.am'
s=p.read_text()
start=s.index('SUBDIRS =')
end=s.index('\n\n',start)
s=s[:start]+'SUBDIRS = '+' '.join(sorted(keep))+s[end:]
write_changed(p,s)
p=root/'src/Makefile.am'
lines=p.read_text().splitlines(True)
write_changed(p,''.join(line for line in lines if not ((m:=re.search(r'spicelib/devices/([^/]+)/lib[^\s]+\.la',line)) and m[1] not in keep and m[1] not in {'ndev','nbjt','nbjt2','numd','numd2','numos'})))
p=root/'src/spicelib/devices/dev.c'
s=p.read_text()
start=s.index('static SPICEdev *(*static_devices[])(void) = {')
end=s.index('\n};',start)
functions=['urc','asrc','bjt','cap','cccs','ccvs','csw','dio','ind','mut','isrc','jfet','jfet2','ltra','mos1','mos2','mos3','mos6','mos9','res','sw','tra','vccs','vcvs','vsrc','vdmos']
block='static SPICEdev *(*static_devices[])(void) = {\n    /* URC must precede R/C. Classic-device build; equations unchanged. */\n'+''.join('    get_'+f+'_info,\n' for f in functions)
s=s[:start]+block+s[end:]
write_changed(p,s)
print('Classic device registration/link subset:',','.join(sorted(keep)))

def replace_once(relative, before, after):
    path = root / relative
    text = path.read_text()
    if after in text:
        return
    if text.count(before) != 1:
        raise RuntimeError('Unexpected ngspice source: ' + relative)
    path.write_text(text.replace(before, after, 1))

# Find exactly the same PWL segment/breakpoint as the upstream linear scans.
# Keep interpolation arithmetic, all samples and solver equations unchanged.
replace_once('src/spicelib/devices/vsrc/vsrcload.c',
    '                        for (i = 2;  i < here->VSRCfunctionOrder; i += 2) {',
    '''                        int low = 1, high = here->VSRCfunctionOrder / 2 - 1;
                        while (here->VSRCpwlMonotone && low < high) {
                            int mid = low + (high - low) / 2;
                            if (here->VSRCcoeffs[2 * mid] < time)
                                low = mid + 1;
                            else
                                high = mid;
                        }
                        for (i = 2 * low; i < here->VSRCfunctionOrder; i += 2) {''')
replace_once('src/spicelib/devices/vsrc/vsrcacct.c',
    '''                            for (i = 0;
                                 i < here->VSRCfunctionOrder;
                                 i += 2) {''',
    '''                            int low = 0, high = here->VSRCfunctionOrder / 2;
                            while (here->VSRCpwlMonotone && low < high) {
                                int mid = low + (high - low) / 2;
                                if (here->VSRCcoeffs[2 * mid] <= atime)
                                    low = mid + 1;
                                else
                                    high = mid;
                            }
                            for (i = 2 * low;
                                 i < here->VSRCfunctionOrder;
                                 i += 2) {''')
print('PWL lookup: exact lower/upper bound binary search')

# PWL_MONOTONE_GUARD: preserve upstream behavior for duplicates/reversed knots.
replace_once('src/spicelib/devices/vsrc/vsrcdefs.h',
    '    int VSRCfunctionOrder;  /* order of the function for the source */',
    '    int VSRCfunctionOrder;  /* order of the function for the source */\n    int VSRCpwlMonotone; /* Binary lookup is valid only for sorted knots. */')
replace_once('src/spicelib/devices/vsrc/vsrcpar.c',
    '            for (i=0; i<(here->VSRCfunctionOrder/2)-1; i++) {\n                  if (*(here->VSRCcoeffs+2*(i+1))<=*(here->VSRCcoeffs+2*i)) {',
    '            here->VSRCpwlMonotone = 1;\n            for (i=0; i<(here->VSRCfunctionOrder/2)-1; i++) {\n                  if (*(here->VSRCcoeffs+2*(i+1))<=*(here->VSRCcoeffs+2*i)) {\n                     here->VSRCpwlMonotone = 0;')
replace_once('src/spicelib/devices/vsrc/vsrcload.c',
    '                        while (here->VSRCpwlMonotone && low < high) {',
    '                        while (here->VSRCpwlMonotone && low < high) {')
replace_once('src/spicelib/devices/vsrc/vsrcacct.c',
    '                            while (here->VSRCpwlMonotone && low < high) {',
    '                            while (here->VSRCpwlMonotone && low < high) {')
print('Non-increasing PWL knots retain upstream linear search')
