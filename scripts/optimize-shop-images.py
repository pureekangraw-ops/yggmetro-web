"""Generate display-sized WebP copies; preserve original Sites19 PNG bytes.

Run with Python + Pillow. Outputs and input/output hashes are committed, so neither
deployment nor browser tests need an image processor or new dependency.
"""
import hashlib
import json
from pathlib import Path

from PIL import Image, __version__

root = Path(__file__).resolve().parents[1]
assets = root / 'public/assets/shop/studio/assets'
outputs = []
for name, max_size in [('brand-wordmark', (1040, 1040)), ('nav-shop', (384, 384)),
                       ('nav-gallery', (384, 384)), ('nav-custom-order', (384, 384))]:
    source = assets / f'{name}.png'
    target = assets / f'{name}.webp'
    with Image.open(source) as image:
        original_size = image.size
        image.thumbnail(max_size, Image.Resampling.LANCZOS)
        image.save(target, 'WEBP', quality=90, method=6)
        output_size = image.size
    outputs.append({
        'source': str(source.relative_to(root)),
        'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
        'sourceBytes': source.stat().st_size, 'sourceDimensions': original_size,
        'output': str(target.relative_to(root)),
        'outputSha256': hashlib.sha256(target.read_bytes()).hexdigest(),
        'outputBytes': target.stat().st_size, 'outputDimensions': output_size,
    })
manifest = {'generator': 'scripts/optimize-shop-images.py', 'pillow': __version__,
            'quality': 90, 'method': 6, 'outputs': outputs}
(root / 'docs/sites19/optimized-assets.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps({'originalBytes': sum(x['sourceBytes'] for x in outputs),
                  'derivedBytes': sum(x['outputBytes'] for x in outputs)}))
