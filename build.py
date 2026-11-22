#!/usr/bin/env python3
"""سكربت البناء: يجمع ملفات src/ في ملف dist/index.html واحد.
لا تعدّل dist/index.html يدوياً أبداً؛ عدّل المصدر ثم شغّل: python3 build.py
"""
from pathlib import Path

ROOT = Path(__file__).parent
SRC = ROOT / "src"
DIST = ROOT / "dist"
SCRIPTS = ["i18n.js", "core.js", "editor.js", "cite.js", "quran.js", "islamic.js", "doc97.js", "extras.js", "tables.js", "pages.js", "render.js", "docx.js", "pptx.js", "desktop.js", "fileio.js", "ui.js"]


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
    print(f"built dist/index.html ({len(out.encode('utf-8')) // 1024} KB)")


if __name__ == "__main__":
    build()
