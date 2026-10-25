"""Run bench graphs on the Pod one at a time and log seconds, VRAM peak, RAM peak, file size.

  python run_graphs.py <comfy base url> <clip dir> <graph.json> [<graph.json> ...]

Uploads the Shot C / D inputs first (from Fabio's project, never via git), queues one graph,
samples /system_stats every 2 s while it runs, downloads the clip it saved, appends a row to
../results.md. Clip dir stays outside every git root (the clips show Fabio's characters).
"""
import json
import mimetypes
import os
import sys
import time
import urllib.parse
import urllib.request
import uuid

MEDIA = r"C:\Users\Fabio\Documents\Cubric Studio\Projects\Qwen 2.1\Media"
UPLOADS = {"ref_087.png": "flowCharacterSheet_087.png", "ref_084.png": "flowCharacterSheet_084.png",
           "start_011.png": "t2i_011.png"}
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120"  # the RunPod proxy 403s urllib's own
RESULTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "results.md")


opener = urllib.request.build_opener()
opener.addheaders = [("User-Agent", UA)]
urllib.request.install_opener(opener)


def get(url, timeout=60):
    return json.load(urllib.request.urlopen(url, timeout=timeout))


def upload(base, name, path):
    boundary = uuid.uuid4().hex
    body = b"".join([
        ("--%s\r\nContent-Disposition: form-data; name=\"subfolder\"\r\n\r\nmpi1135\r\n" % boundary).encode(),
        ("--%s\r\nContent-Disposition: form-data; name=\"overwrite\"\r\n\r\ntrue\r\n" % boundary).encode(),
        ("--%s\r\nContent-Disposition: form-data; name=\"image\"; filename=\"%s\"\r\nContent-Type: %s\r\n\r\n"
         % (boundary, name, mimetypes.guess_type(name)[0])).encode(),
        open(path, "rb").read(), ("\r\n--%s--\r\n" % boundary).encode()])
    req = urllib.request.Request(base + "/upload/image", body,
                                 {"Content-Type": "multipart/form-data; boundary=" + boundary})
    print("uploaded", json.load(urllib.request.urlopen(req, timeout=120)))


def run(base, clips, path):
    name = os.path.splitext(os.path.basename(path))[0]
    prompt = json.load(open(path, encoding="utf-8"))
    req = urllib.request.Request(base + "/prompt", json.dumps({"prompt": prompt}).encode(),
                                 {"Content-Type": "application/json"})
    pid = json.load(urllib.request.urlopen(req, timeout=60))["prompt_id"]
    t0, vram_min, ram_min, total_vram, total_ram = time.time(), None, None, 0, 0
    while True:
        try:
            s = get(base + "/system_stats", 20)
            dev = s["devices"][0]
            total_vram, total_ram = dev["vram_total"], s["system"]["ram_total"]
            vram_min = min(dev["vram_free"], vram_min if vram_min is not None else dev["vram_free"])
            ram_min = min(s["system"]["ram_free"], ram_min if ram_min is not None else s["system"]["ram_free"])
            h = get(base + "/history/" + pid, 20)
        except Exception as e:  # the proxy drops a request now and then; keep polling
            print("  poll error:", e)
            time.sleep(2)
            continue
        if pid in h:  # a prompt enters /history only once it has finished, ok or not
            break
        time.sleep(2)
    entry = h[pid]
    msgs = {m[0]: m[1] for m in entry["status"].get("messages", [])}
    ok = entry["status"].get("status_str") == "success"
    secs = (msgs["execution_success"]["timestamp"] - msgs["execution_start"]["timestamp"]) / 1000 if ok else time.time() - t0
    size, saved = 0, ""
    for out in entry.get("outputs", {}).values():
        for item in out.get("gifs", []) + out.get("videos", []) + out.get("images", []):
            fn = item["filename"]
            if not fn.endswith(".mp4"):
                continue
            q = urllib.parse.urlencode({"filename": fn, "subfolder": item.get("subfolder", ""), "type": item.get("type", "output")})
            data = urllib.request.urlopen(base + "/view?" + q, timeout=600).read()
            saved = os.path.join(clips, name + ".mp4")
            open(saved, "wb").write(data)
            size = len(data)
    err = "" if ok else json.dumps(msgs.get("execution_error", {}))[:300]
    row = "| %s | %s | %.0f | %.1f | %.1f | %.1f | %s |" % (
        name, "ok" if ok and saved else "FAIL", secs,
        (total_vram - (vram_min or total_vram)) / 2**30, (total_ram - (ram_min or total_ram)) / 2**30,
        size / 2**20, err)
    print(row)
    with open(RESULTS, "a", encoding="utf-8") as f:
        f.write(row + "\n")


def main():
    base, clips, graphs = sys.argv[1].rstrip("/"), sys.argv[2], sys.argv[3:]
    os.makedirs(clips, exist_ok=True)
    for name, src in UPLOADS.items():
        upload(base, name, os.path.join(MEDIA, src))
    for g in graphs:
        run(base, clips, g)


if __name__ == "__main__":
    main()
