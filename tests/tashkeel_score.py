# يقيس دقة التشكيل كلمة بكلمة مقارنة بجمل الذهب (tests/tashkeel_gold.txt): البنية، والإعراب (آخر حرف)، وما التقطته علامة المراجعة
# أدوات التقييم المشتركة: مقارنة كلمة بكلمة مع الذهب
import re, unicodedata
H = 'ًٌٍَُِّْ'
def bare(s): return ''.join(c for c in s if c not in H)
def letters(w):
    out=[]; 
    for c in w:
        if c in H:
            if out: out[-1][1]+=c
        else: out.append([c,''])
    return [(c,''.join(sorted(d))) for c,d in out]
def norm(d, lenient):
    if lenient: d=d.replace('ْ','')
    return d
def compare(gold, pred, lenient=False):
    g=gold.split(); p=pred.split()
    if [bare(x) for x in g]!=[bare(x) for x in p]: return None
    res=[]
    for wi,(gw,pw) in enumerate(zip(g,p)):
        gl, pl = letters(gw), letters(pw)
        last = len(gl)-1
        # آخر حرف عربي في الكلمة (الإعراب)
        while last>0 and gl[last][0] in 'اىو' and not gl[last][1]: last-=1
        endOK = norm(gl[last][1],lenient)==norm(pl[last][1],lenient)
        coreOK = all(norm(a[1],lenient)==norm(b[1],lenient) for i,(a,b) in enumerate(zip(gl,pl)) if i!=last and a[0] not in 'اىو')
        if wi==len(g)-1: endOK=True  # آخر كلمة في الجملة: الوقف
        res.append((coreOK,endOK,gw,pw))
    return res
def report(name, pairs):
    W=C=E=0; bad=[]
    for gold,pred in pairs:
        r=compare(gold,pred,True)
        if r is None: bad.append(('MISMATCH',gold,pred)); continue
        for core,end,gw,pw in r:
            W+=1; C+=core; E+=end
            if not (core and end): bad.append((('C' if not core else '')+('E' if not end else ''),gw,pw))
    ok=sum(1 for x in bad if x[0]!='MISMATCH')
    print(f"{name}: words={W}  word-correct={100*(W-ok)/W:.1f}%  core(بنية)={100*C/W:.1f}%  endings(إعراب)={100*E/W:.1f}%")
    return bad

if __name__ == '__main__':
    import re, sys
    gold = [l.strip() for l in open('tests/tashkeel_gold.txt', encoding='utf-8') if l.strip()]
    for m in (sys.argv[1:] or ['full']):
        pred = open('/tmp/tashkeel_pred_' + m + '.txt', encoding='utf-8').read().split('\n')
        clean = [p.replace('⟦', '').replace('⟧', '') for p in pred]
        bad = [x for x in report('warraq ' + m, list(zip(gold, clean))) if x[0] != 'MISMATCH']
        flagged = set(w for p in pred for w in re.findall('⟦([^⟧]+)⟧', p))
        print('   errors=%d caught=%d underlined=%d' % (len(bad), sum(1 for x in bad if x[2] in flagged), sum(p.count('⟦') for p in pred)))
