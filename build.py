#!/usr/bin/env python3
"""سكربت البناء: يجمع ملفات src/ في ملف dist/index.html واحد.
لا تعدّل dist/index.html يدوياً أبداً؛ عدّل المصدر ثم شغّل: python3 build.py
"""
import re
from pathlib import Path

ROOT = Path(__file__).parent
SRC = ROOT / "src"
DIST = ROOT / "dist"
SCRIPTS = ["i18n.js", "core.js", "editor.js", "cite.js", "refstyles.js", "quran.js", "islamic.js", "hadith.js", "indexes.js", "tashkeel.js", "doc97.js", "extras.js", "tables.js", "pages.js", "render.js", "docx.js", "pptx.js", "desktop.js", "fileio.js", "ui.js"]


def build():
    tpl = (SRC / "template.html").read_text(encoding="utf-8")
    style = (SRC / "styles.css").read_text(encoding="utf-8")
    logo = (SRC / "logo.svg").read_text(encoding="utf-8").strip()
    scripts = "\n".join((SRC / f).read_text(encoding="utf-8") for f in SCRIPTS)
    out = tpl.replace("%%STYLE%%", style).replace("%%LOGO%%", logo).replace("%%SCRIPTS%%", scripts)
    assert not any(m in out for m in ("%%STYLE%%", "%%LOGO%%", "%%SCRIPTS%%")), "علامة لم تُستبدل"
    DIST.mkdir(exist_ok=True)
    (DIST / "index.html").write_text(out, encoding="utf-8")
    # المكتبات الخارجية (مرخّصة MIT) تُنسخ كما هي
    import shutil
    (DIST / "vendor").mkdir(exist_ok=True)
    for f in (SRC / "vendor").glob("*.js"):
        shutil.copy(f, DIST / "vendor" / f.name)
    # محرك التشكيل: يُجلب من مصادره الأصلية بإصدار ثابت وبصمة SHA-256 (لا يُرفع في المستودع)
    if fetch_tashkeel():
        for sub in ("ort", "tashkeel"):
            (DIST / "vendor" / sub).mkdir(parents=True, exist_ok=True)
            for f in (ASSETS / sub).iterdir():
                shutil.copy(f, DIST / "vendor" / sub / f.name)
    fetch_hadith()
    print(f"built dist/index.html ({len(out.encode('utf-8')) // 1024} KB)")


# ---------- محرك التشكيل (libtashkeel + onnxruntime-web) ----------
ASSETS = ROOT / ".assets"
ORT_VER = "1.31.1"
ORT_TGZ = ("https://registry.npmjs.org/onnxruntime-web/-/onnxruntime-web-" + ORT_VER + ".tgz",
           "bdccdb9fbb9ab537247c0c734e9b1d2b1b338b4f2a09faa58f0dc1cfa27c312c")
ORT_FILES = ["ort.wasm.bundle.min.mjs", "ort-wasm-simd-threaded.wasm"]
TK_COMMIT = "9b91c2dbc3dc4085dc4f77a9e250e5dd095d7d0c"
TK_BASE = "https://raw.githubusercontent.com/mush42/libtashkeel/" + TK_COMMIT + "/"
HF = "https://huggingface.co/TigreGotico/"
TK_FILES = {  # الملف المحلي: (الرابط الكامل أو المسار في مستودع libtashkeel، البصمة)
    # libtashkeel — Musharraf Omer، رخصة MIT
    "model.onnx": ("crates/core/data/ort/model.onnx", "52c40d42ca094ff9ff07a091d0a1eafd7baa5cf2388e60a9cc89bacd8e5e955f"),
    "LICENSE.txt": ("LICENSE", "98dbc9a6a01badb391f2b64161742cb9cd8fcdc5cfc97486be0d49c47e98d1a8"),
    # CATT-EO (Abjad AI، رخصة Apache-2.0)، نسخة ONNX int8 من TigreGotico
    "catt.onnx": (HF + "catt-diacritizer/resolve/8ad763613cce96511c099e9943820be7cc80fbc2/catt_eo.int8.onnx",
                  "59ba20d02a4b507a6b816a9b46b1230ba73d341c6731aa48da5de99388a39fca"),
    "LICENSE-Apache-2.0.txt": ("https://raw.githubusercontent.com/abjadai/catt/8d5330499feb85f6625e6af632141ed2ed6065fd/LICENSE",
                               "958c2bbc9350931476edb7d354dfca1e420333ff05bf3bfbc62bc047f6816b3d"),
    # rawi-ensemble (TigreGotico، رخصة Apache-2.0)
    "rawi.onnx": (HF + "rawi-ensemble/resolve/main/rawi_ensemble.int8.onnx",
                  "429333d9825ca70d2482885547a61a41fdcd6f67d7b96bb09e852fdcf3bd266c"),
}
TK_NOTICE = """محركات التشكيل في ورّاق / Diacritization engines bundled with Warraq

1) libtashkeel model — Copyright (c) 2023 Musharraf Omer — MIT License (LICENSE.txt)
   https://github.com/mush42/libtashkeel
2) CATT: Character-based Arabic Tashkeel Transformer (encoder-only) — Copyright Abjad AI
   Apache License 2.0 (LICENSE-Apache-2.0.txt) — https://github.com/abjadai/catt
   ONNX int8 export by TigreGotico — https://huggingface.co/TigreGotico/catt-diacritizer
3) rawi-ensemble Arabic diacritizer — TigreGotico — Apache License 2.0 (LICENSE-Apache-2.0.txt)
   https://huggingface.co/TigreGotico/rawi-ensemble
4) onnxruntime-web — Copyright (c) Microsoft Corporation — MIT License (../ort/LICENSE.txt)

The model files are redistributed unmodified. Warraq combines their outputs by majority vote.
"""
ORT_LICENSE = """MIT License

Copyright (c) Microsoft Corporation

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
"""


def _sha(b):
    import hashlib
    return hashlib.sha256(b).hexdigest()


def _get(url):
    import urllib.request
    with urllib.request.urlopen(url, timeout=120) as r:
        return r.read()


def fetch_tashkeel():
    """يجهّز ملفات التشكيل في .assets (مرة واحدة). في GitHub Actions (CI) أي فشل يوقف البناء."""
    import os, io, tarfile
    ort_dir, tk_dir = ASSETS / "ort", ASSETS / "tashkeel"
    try:
        if not all((ort_dir / f).exists() for f in ORT_FILES):
            data = _get(ORT_TGZ[0])
            assert _sha(data) == ORT_TGZ[1], "بصمة onnxruntime-web غير مطابقة"
            ort_dir.mkdir(parents=True, exist_ok=True)
            with tarfile.open(fileobj=io.BytesIO(data)) as tf:
                for f in ORT_FILES:
                    (ort_dir / f).write_bytes(tf.extractfile("package/dist/" + f).read())
        (ort_dir / "LICENSE.txt").write_text(ORT_LICENSE, encoding="utf-8")
        tk_dir.mkdir(parents=True, exist_ok=True)
        for local, (remote, sha) in TK_FILES.items():
            p = tk_dir / local
            if p.exists() and _sha(p.read_bytes()) == sha:
                continue
            data = _get(remote if remote.startswith("https://") else TK_BASE + remote)
            assert _sha(data) == sha, "بصمة " + local + " غير مطابقة"
            p.write_bytes(data)
        (tk_dir / "NOTICE.txt").write_text(TK_NOTICE, encoding="utf-8")
        return True
    except Exception as e:  # بدون إنترنت محلياً: البرنامج يشتغل والتشكيل يظهر "غير متاح"
        if os.environ.get("CI"):
            raise
        print("تنبيه: محرك التشكيل غير متاح في هذا البناء:", e)
        return False


# ---------- مكتبة الأحاديث (تُجلب بإصدار ثابت وبصمة SHA-256، وتُحوّل إلى dist/hadith) ----------
# القاعدة: البرنامج لا يحكم على حديث أبداً؛ يعرض أحكام العلماء منسوبة لأصحابها كما في المصدر.
HD_FAWAZ = "https://raw.githubusercontent.com/fawazahmed0/hadith-api/df57907be35291c91ad6a6691180e22ca9920784/editions/ara-{}.min.json"
HD_OHD = "https://raw.githubusercontent.com/mhashim6/Open-Hadith-Data/1515f6cba21efed20d8916bf55acef1dffa0d2d5/"
HD_FILES = {  # الملف المحلي: (الرابط، البصمة)
    "ara-bukhari.json": (HD_FAWAZ.format("bukhari"), "f887d8724f75fb6e1d5d29342a173af5346ad9b933173c85e6e3cb570063ea33"),
    "ara-muslim.json": (HD_FAWAZ.format("muslim"), "2cb296f3455ff8a3da9f6a0ca3de75da675788b2fb446ad316df297838e48217"),
    "ara-abudawud.json": (HD_FAWAZ.format("abudawud"), "30dd3792ea65abe7fd0be8d568809d4eac04e38cbbd588b9c6055218fe43675f"),
    "ara-tirmidhi.json": (HD_FAWAZ.format("tirmidhi"), "22b7ffbbca9beb5d4f108cc0389a3cd16917876b3ceb32993c46e1554afd871b"),
    "ara-nasai.json": (HD_FAWAZ.format("nasai"), "18294d8da9ec9a735719f26709858ac30657c1122f6a39d179f128bfc59ecb80"),
    "ara-ibnmajah.json": (HD_FAWAZ.format("ibnmajah"), "495fcccdea5f2d157794d2b1bd1eaa0e0a5ff5aeb6be2d7817de8f25e3b3349c"),
    "ara-malik.json": (HD_FAWAZ.format("malik"), "8bcc8001df35cfff1697f792d99d9fa5a865e7d89734ff8a77bd49d12f7465b7"),
    "ahmad.csv": (HD_OHD + "Musnad_Ahmad_Ibn-Hanbal/musnad_ahmad_ibn-hanbal_ahadith_mushakkala.utf8.csv",
                  "41553fee47fe582a8d0b60fbea1f71b867df44d40adac94dcfe742571a8bce24"),
    "darimi.csv": (HD_OHD + "Sunan_Al-Darimi/sunan_al-darimi_ahadith_mushakkala_mufassala.utf8.csv",
                   "bb995abb07a513cf76743e9580787e80c7ce5bd08dd6108c13e01d936a048327"),
}
# id، الاسم، اسم التخريج، الملف، ملاحظة الترقيم
HD_BOOKS = [
    ("bukhari", "صحيح البخاري", "البخاري", "Sahih al-Bukhari", "al-Bukhari", "ara-bukhari.json", "ترقيم محمد فؤاد عبد الباقي (فتح الباري)"),
    ("muslim", "صحيح مسلم", "مسلم", "Sahih Muslim", "Muslim", "ara-muslim.json", "ترقيم محمد فؤاد عبد الباقي"),
    ("abudawud", "سنن أبي داود", "أبو داود", "Sunan Abi Dawud", "Abu Dawud", "ara-abudawud.json", "الترقيم المتداول"),
    ("tirmidhi", "جامع الترمذي", "الترمذي", "Jami' al-Tirmidhi", "al-Tirmidhi", "ara-tirmidhi.json", "الترقيم المتداول"),
    ("nasai", "سنن النسائي", "النسائي", "Sunan al-Nasa'i", "al-Nasa'i", "ara-nasai.json", "الترقيم المتداول"),
    ("ibnmajah", "سنن ابن ماجه", "ابن ماجه", "Sunan Ibn Majah", "Ibn Majah", "ara-ibnmajah.json", "ترقيم محمد فؤاد عبد الباقي"),
    ("malik", "موطأ مالك", "مالك", "Muwatta Malik", "Malik", "ara-malik.json", "ترقيم مصدر البيانات"),
    ("ahmad", "مسند أحمد", "أحمد", "Musnad Ahmad", "Ahmad", "ahmad.csv", "ترقيم مصدر البيانات (قد يختلف عن الطبعات المحققة)"),
    ("darimi", "سنن الدارمي", "الدارمي", "Sunan al-Darimi", "al-Darimi", "darimi.csv", "ترقيم مصدر البيانات (قد يختلف عن الطبعات المحققة)"),
]
HD_GRADERS = {"Al-Albani": "الألباني", "Zubair Ali Zai": "زبير علي زئي", "Shuaib Al Arnaut": "شعيب الأرناؤوط",
              "Abu Ghuddah": "عبد الفتاح أبو غدة", "Muhammad Muhyi Al-Din Abdul Hamid": "محمد محيي الدين عبد الحميد",
              "Muhammad Fouad Abd al-Baqi": "محمد فؤاد عبد الباقي", "Ahmad Muhammad Shakir": "أحمد محمد شاكر",
              "Bashar Awad Maarouf": "بشار عواد معروف", "Salim al-Hilali": "سليم الهلالي"}
HD_NOTICE = """مكتبة الأحاديث في ورّاق / Hadith library bundled with Warraq

1) الكتب السبعة (البخاري، مسلم، أبو داود، الترمذي، النسائي، ابن ماجه، الموطأ) مع أحكام العلماء:
   fawazahmed0/hadith-api — The Unlicense (public domain) — https://github.com/fawazahmed0/hadith-api
2) مسند أحمد وسنن الدارمي: Open-Hadith-Data — https://github.com/mhashim6/Open-Hadith-Data
   Open Database License (ODbL 1.0); contents under the Database Contents License (DbCL 1.0).
   The converted files ahmad.json and darimi.json are a derivative database made available under ODbL 1.0.

التحويل: حذف العلامات الخفية والمسافات الزائدة فقط؛ النص المشكول كما هو. أحكام العلماء منقولة منسوبة لأصحابها
مع ترجمة عربية لمصطلح الحكم، والأصل الإنجليزي محفوظ. ورّاق لا يصدر حكماً على أي حديث.
"""
HD_TOK = {'sahih': 'صحيح', 'daif': 'ضعيف', 'hasan': 'حسن', 'lighairihi': 'لغيره', 'mauquf': 'موقوف', 'muquf': 'موقوف',
       'maqtu': 'مقطوع', 'mursal': 'مرسل', 'shadh': 'شاذ', 'munkar': 'منكر', 'mawdu': 'موضوع', 'batil': 'باطل',
       'mutawatir': 'متواتر', 'malool': 'معلول', 'matn': 'المتن', 'mukhtasar': 'مختصرًا', 'after': 'بعد', 'witness': 'شاهد',
       'and': 'و'}
HD_GBOOKS = {'bukhari': 'البخاري', 'muslim': 'مسلم'}
def hd_grade_ar(g):
    s = re.sub(r'\s+', ' ', g).strip()
    if not s or s == '-': return None
    s = s.replace('،', ',')
    s = re.sub(r'(?i)\bsahih\s*-\s*agreed upon\b', 'صحيح متفق عليه', s)
    s = re.sub(r'(?i)\bagreed upon\b', 'متفق عليه', s)
    s = re.sub(r'(?i)\bsahih\s*-\s*bukhari and muslim\b', 'صحيح، رواه البخاري ومسلم', s)
    s = re.sub(r'(?i)\bsahih (bukhari|muslim)\b(\s*\()', lambda m: 'رواه ' + HD_GBOOKS[m.group(1).lower()] + m.group(2), s)
    s = re.sub(r'(?i)\bsahih (bukhari|muslim)\b(?!\s+and)', lambda m: 'رواه ' + HD_GBOOKS[m.group(1).lower()], s)
    s = re.sub(r'(?i)\bvery daif\b', 'ضعيف جدًا', s)
    s = re.sub(r'(?i)\bsahih hadith\b', 'حديث صحيح', s)
    s = re.sub(r'(?i)^(isnaad|sanad)\b', 'إسناده', s)
    s = re.sub(r'(?i)\b(isnaad|sanad)\b', 'الإسناد', s)
    s = re.sub(r"[A-Za-z']+", lambda m: HD_TOK.get(m.group(0).lower(), '\0'), s)
    if '\0' in s: return None   # كلمة غير معروفة: نعرض الحكم الأصلي كما هو
    s = re.sub(r'\bو ', 'و', s)
    s = re.sub(r'\) رواه (البخاري|مسلم)', r')، و\1', s)
    s = re.sub(r'([^\s،]) رواه', r'\1، رواه', s)
    s = s.replace(',', '،').translate(str.maketrans('0123456789', '٠١٢٣٤٥٦٧٨٩'))
    return re.sub(r'\s+', ' ', s).strip()


def hd_clean(t):
    import re
    t = re.sub("[‎‏﻿￼�‪-‮]", "", t)
    return re.sub(r"\s+", " ", t).strip()


def hd_convert(src, out):
    """يحوّل الملفات الخام إلى ملف لكل كتاب: {"g": جدول الأحكام، "h": [[المفتاح، النص، [أرقام الأحكام]]...]}"""
    import json, csv
    out.mkdir(parents=True, exist_ok=True)
    index = {"books": [], "graders": HD_GRADERS}
    for bid, name, short, en, en_short, fname, numbering in HD_BOOKS:
        gtab, gidx, items = [], {}, []
        if fname.endswith(".json"):
            for x in json.loads((src / fname).read_text(encoding="utf-8"))["hadiths"]:
                text = hd_clean(x["text"])
                key = x.get("arabicnumber")
                if not text or key is None:  # مقدمة صحيح مسلم بلا ترقيم: غير مشمولة
                    continue
                key = str(key)
                if key.endswith(".0"):
                    key = key[:-2]
                gl = []
                for g in x.get("grades") or []:
                    en_g = " ".join(g["grade"].split())
                    if not en_g or en_g == "-":
                        continue
                    k = (g["name"], en_g)
                    if k not in gidx:
                        gidx[k] = len(gtab)
                        gtab.append([g["name"], hd_grade_ar(en_g) or "", en_g])
                    gl.append(gidx[k])
                items.append([key, text, gl] if gl else [key, text])
        else:
            rows = list(csv.reader((src / fname).read_text(encoding="utf-8").splitlines()))
            for i, r in enumerate(rows):
                assert r[0].strip() == str(i + 1), (fname, i, r[0])  # الترقيم متصل
                text = hd_clean(r[1])
                if text:
                    items.append([str(i + 1), text])
        keys = [it[0] for it in items]
        assert len(keys) == len(set(keys)), bid + ": مفاتيح مكررة"
        (out / (bid + ".json")).write_text(json.dumps({"g": gtab, "h": items}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        index["books"].append({"id": bid, "name": name, "short": short, "en": en, "enShort": en_short,
                               "numbering": numbering, "count": len(items)})
    (out / "index.json").write_text(json.dumps(index, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (out / "NOTICE.txt").write_text(HD_NOTICE, encoding="utf-8")
    return sum(b["count"] for b in index["books"])


def fetch_hadith():
    """يجهّز مكتبة الأحاديث في dist/hadith. في GitHub Actions (CI) أي فشل يوقف البناء."""
    import os
    src = ASSETS / "hadith"
    try:
        src.mkdir(parents=True, exist_ok=True)
        for local, (url, sha) in HD_FILES.items():
            p = src / local
            if p.exists() and _sha(p.read_bytes()) == sha:
                continue
            data = _get(url)
            assert _sha(data) == sha, "بصمة " + local + " غير مطابقة"
            p.write_bytes(data)
        n = hd_convert(src, DIST / "hadith")
        print(f"hadith: {n} hadiths in {len(HD_BOOKS)} books")
        return True
    except Exception as e:
        if os.environ.get("CI"):
            raise
        print("تنبيه: مكتبة الأحاديث غير متاحة في هذا البناء:", e)
        return False


if __name__ == "__main__":
    import sys
    try:  # ويندوز: مخرجات الطرفية cp1252 وتفشل مع الحروف العربية
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    build()
