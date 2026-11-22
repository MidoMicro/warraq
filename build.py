#!/usr/bin/env python3
"""سكربت البناء: يجمع ملفات src/ في ملف dist/index.html واحد.
لا تعدّل dist/index.html يدوياً أبداً؛ عدّل المصدر ثم شغّل: python3 build.py
"""
from pathlib import Path

ROOT = Path(__file__).parent
SRC = ROOT / "src"
DIST = ROOT / "dist"
SCRIPTS = ["i18n.js", "core.js", "editor.js", "cite.js", "quran.js", "islamic.js", "tashkeel.js", "doc97.js", "extras.js", "tables.js", "pages.js", "render.js", "docx.js", "pptx.js", "desktop.js", "fileio.js", "ui.js"]


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


if __name__ == "__main__":
    build()
