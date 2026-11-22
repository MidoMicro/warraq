# تشغيل CATT وrawi للمقارنة على امتحان التشكيل (يحتاج ملفاتهما من Hugging Face في _tashkeel-test)
import sys, json, unicodedata, numpy as np, onnxruntime as ort
D='/mnt/user-data/uploads/Documents/Warraq/_tashkeel-test/'
sys.path.insert(0, D)
from tashkeel_tokenizer_onnx import TashkeelTokenizer
import bw2ar
H=set('ًٌٍَُِّْ')
# ---------- CATT ----------
tok=TashkeelTokenizer(); catt=ort.InferenceSession(D+'catt_eo.int8.onnx')
def catt_run(text):
    words=text.split(); src=np.array([[tok.letters_map[c] for c in bw2ar.transliterate_text(text,'ar2bw')]],dtype=np.int64)
    n=src.shape[1]; mask=np.ones((1,1,n,n),dtype=bool)
    lg=catt.run(None,{'src':src,'src_mask':mask})[0][0]
    p=np.exp(lg-lg.max(-1,keepdims=True)); p/=p.sum(-1,keepdims=True)
    pred=p.argmax(-1); conf=p.max(-1)
    out=''; confs=[]
    for i,c in enumerate(text):
        tag=tok.tashkeel_list[pred[i]] if c!=' ' else '<NT>'
        out+=c
        if tag in tok.tags: out+=bw2ar.transliterate_text(tok.tags[tag],'bw2ar')
        elif tag not in ('<NT>','<PAD>','<BOS>','<EOS>'): out+=bw2ar.transliterate_text(tag,'bw2ar')
        confs.append(float(conf[i]))
    return out, confs
# ---------- rawi ----------
v=json.load(open(D+'vocab.json')); c2i=v['char_to_idx']; i2d={i:d for d,i in v['diac_to_idx'].items()}
rawi=ort.InferenceSession(D+'rawi_ensemble.int8.onnx')
def rawi_run(text):
    nfd=unicodedata.normalize('NFD',text)
    base=''.join(ch for ch in nfd if not unicodedata.combining(ch))
    ids=np.array([[c2i.get(ch,c2i['<UNK>']) for ch in base]],dtype=np.int64)
    cls=rawi.run(None,{'input':ids})[0][0]
    out=''.join(ch+i2d.get(int(k),'') for ch,k in zip(base,cls))
    return unicodedata.normalize('NFC',out)
