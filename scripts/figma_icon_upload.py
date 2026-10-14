#!/usr/bin/env python3
"""Upload a single PNG from a private Drive ZIP into an existing Figma node.

Credentials are read only from environment variables. Never print secrets or
upload URLs; Figma upload URLs are single-use and short-lived.
"""
import io, json, os, sys, urllib.request, zipfile
from urllib.parse import urlparse

def required(name):
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required secret: {name}")
    return value

def main():
    token = required("GOOGLE_DRIVE_ACCESS_TOKEN")
    file_id = required("GOOGLE_DRIVE_ZIP_FILE_ID")
    url = required("FIGMA_SUBMIT_URL")
    icon = os.getenv("ICON_FILENAME", "01_home.png")
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.hostname != "mcp.figma.com" or not parsed.path.startswith("/mcp/upload/"):
        raise RuntimeError("Refusing upload to non-Figma URL")
    if "/" in icon or "\\" in icon or not icon.lower().endswith(".png"):
        raise RuntimeError("ICON_FILENAME must be a single PNG basename")
    req = urllib.request.Request(
        f"https://www.googleapis.com/drive/v3/files/{file_id}?alt=media",
        headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req, timeout=60) as response:
        blob = response.read(30 * 1024 * 1024 + 1)
    if len(blob) > 30 * 1024 * 1024:
        raise RuntimeError("Drive archive exceeds 30 MiB")
    with zipfile.ZipFile(io.BytesIO(blob)) as z:
        matches = [n for n in z.namelist() if n.split("/")[-1] == icon and not n.endswith("/")]
        if len(matches) != 1:
            raise RuntimeError("Expected exactly one matching icon in ZIP")
        data = z.read(matches[0])
    if not data.startswith(b"\x89PNG\r\n\x1a\n") or len(data) > 10 * 1024 * 1024:
        raise RuntimeError("Invalid PNG or exceeds Figma's 10 MiB asset limit")
    req = urllib.request.Request(url, data=data, headers={"Content-Type":"image/png"}, method="POST")
    with urllib.request.urlopen(req, timeout=60) as response:
        status = response.status
        result = json.loads(response.read())
    if not (200 <= status < 300):
        raise RuntimeError("Figma rejected upload")
    print(json.dumps({"status":"submitted","icon":icon,"targetNodeId":result.get("targetNodeId"),"imageHashPresent":bool(result.get("imageHash"))}))

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        # Never echo HTTP exception bodies: they may contain upload URLs.
        print("Upload failed. Check secrets, URL expiry, Drive permissions and target node.", file=sys.stderr)
        sys.exit(1)
