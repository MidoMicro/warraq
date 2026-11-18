#!/usr/bin/env python3
"""يبني dist/quran.json من ملفات مشروع Tanzil كما هي حرفياً (بدون أي تعديل للنص).
المصدر: data/quran-uthmani.txt و data/quran-data.xml من tanzil.net
"""
import json, xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).parent
txt = (ROOT / "data/quran-uthmani.txt").read_text(encoding="utf-8")
lines = txt.split("\n")
notice = [l for l in lines if l.startswith("#")]
ayas = {}
for l in lines:
    if not l or l.startswith("#"):
        continue
    s, a, text = l.split("|", 2)
    ayas.setdefault(int(s), []).append((int(a), text))

meta = ET.parse(ROOT / "data/quran-data.xml").getroot()
suras = []
for el in meta.find("suras").findall("sura"):
    i = int(el.get("index"))
    suras.append({"n": i, "name": el.get("name"), "tname": el.get("tname"), "ename": el.get("ename"), "ayas": int(el.get("ayas"))})

# فحوص سلامة: عدد السور والآيات وترتيبها مطابق للبيانات
assert len(suras) == 114, len(suras)
total = 0
for s in suras:
    got = ayas[s["n"]]
    assert len(got) == s["ayas"], (s["n"], len(got), s["ayas"])
    assert [a for a, _ in got] == list(range(1, s["ayas"] + 1)), s["n"]
    total += len(got)
assert total == 6236, total

out = {
    "source": "Tanzil Project – https://tanzil.net",
    "textType": "Uthmani",
    "notice": notice,
    "suras": suras,
    "text": [[t for _, t in ayas[s["n"]]] for s in suras],
}
# تحقق إضافي: كل آية في الملف الناتج مطابقة حرفياً للأصل
orig = {f"{s}|{a}": t for s, lst in ayas.items() for a, t in lst}
for si, s in enumerate(out["text"]):
    for ai, t in enumerate(s):
        assert orig[f"{si+1}|{ai+1}"] == t
(ROOT / "dist").mkdir(exist_ok=True)
(ROOT / "dist/quran.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(f"quran.json: {len(suras)} suras, {total} ayas, verbatim check OK, {(ROOT/'dist/quran.json').stat().st_size//1024} KB")
