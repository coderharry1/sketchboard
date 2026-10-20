"""Inline rough.js and the Virgil font into one self-contained, offline HTML file."""
import base64
import pathlib

root = pathlib.Path(__file__).resolve().parent
html = (root / "src" / "index.html").read_text(encoding="utf-8")
rough_tag = '<script src="https://cdn.jsdelivr.net/npm/roughjs@4.6.6/bundled/rough.js"></script>'
font_url = "https://cdn.jsdelivr.net/npm/@excalidraw/excalidraw@0.18.1/dist/prod/fonts/Virgil/Virgil-Regular.woff2"
assert rough_tag in html and font_url in html, "CDN references changed; update build.py"

rough_js = (root / "vendor" / "rough.js").read_text(encoding="utf-8")
font_b64 = base64.b64encode((root / "vendor" / "Virgil-Regular.woff2").read_bytes()).decode()
html = html.replace(rough_tag, "<script>\n" + rough_js.replace("</script", "<\\/script") + "\n</script>")
html = html.replace(font_url, "data:font/woff2;base64," + font_b64)
# index.html is the copy GitHub Pages serves at the site root
for name in ("Sketchboard.html", "index.html"):
    (root / name).write_text(html, encoding="utf-8")
print("wrote Sketchboard.html and index.html", len(html) // 1024, "KB")
