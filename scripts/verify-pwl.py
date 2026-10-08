"""Compare actual patched lookup code with the upstream first-match scans."""
from pathlib import Path
import json, os, subprocess, tempfile
root=Path(os.environ.get('PEDAL_ENGINE_CACHE','/home/ho/.cache/pedal-engine-build'))
folder=root/'source/src/spicelib/devices/vsrc'
load=(folder/'vsrcload.c').read_text()
accept=(folder/'vsrcacct.c').read_text()
a=load[load.index('                        int low = 1, high ='):load.index('                        for (i = 2 * low')]
b=accept[accept.index('                            int low = 0, high ='):accept.index('                            for (i = 2 * low')]
code=r"""
#include <stdio.h>
#include <math.h>
#include <assert.h>
typedef struct {int VSRCfunctionOrder,VSRCpwlMonotone;double *VSRCcoeffs;} Source;
int lower(Source *here,double time){int i;
"""+a+r"""
for(i=2*low;i<here->VSRCfunctionOrder;i+=2)
 if(here->VSRCcoeffs[i]>=time)return i;
return here->VSRCfunctionOrder;}
int upper(Source *here,double atime){int i;
"""+b+r"""
for(i=2*low;i<here->VSRCfunctionOrder;i+=2)
 if(here->VSRCcoeffs[i]>atime)return i;
return here->VSRCfunctionOrder;}
int reference(Source *s,double t,int first,int strict){
for(int i=first;i<s->VSRCfunctionOrder;i+=2)
 if(strict?s->VSRCcoeffs[i]>t:s->VSRCcoeffs[i]>=t)return i;
return s->VSRCfunctionOrder;}
int main(){unsigned long long checks=0; double c[1024];
for(int mode=0;mode<4;mode++){
for(int i=0;i<512;i++){c[2*i]=i*.0000208333333333333+(i%7)*1e-9;c[2*i+1]=sin(i*.13);}
if(mode==1)c[256]=c[254];
if(mode==2)c[256]=c[254]-.0001;
Source s={1024,mode==0,c};
if(mode==3){s.VSRCfunctionOrder=2;s.VSRCpwlMonotone=1;}
for(int k=0;k<100000;k++){
double t=(k*729u%110001)*1e-7-1e-4;
if(k<512)t=c[2*k];
if(k>=512&&k<1024)t=nextafter(c[2*(k-512)],INFINITY);
if(k>=1024&&k<1536)t=nextafter(c[2*(k-1024)],-INFINITY);
assert(lower(&s,t)==reference(&s,t,2,0));
assert(upper(&s,t)==reference(&s,t,0,1));checks+=2;
}}
printf("{\"lookupQueries\":%llu,\"mismatches\":0,\"cases\":\"strict,duplicate,reversed,single knot; exact and adjacent knots; nonmonotone time queries\"}\n",checks);}
"""
with tempfile.TemporaryDirectory(dir=root/'tmp',prefix='pwl-lookup-') as d:
 p=Path(d);(p/'lookup.c').write_text(code)
 subprocess.run(['cc','-O2',str(p/'lookup.c'),'-lm','-o',str(p/'lookup')],check=True)
 result=json.loads(subprocess.check_output([str(p/'lookup')]))
out=Path('simulation/evidence/pwl-lookup.json');out.parent.mkdir(parents=True,exist_ok=True)
out.write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result))
