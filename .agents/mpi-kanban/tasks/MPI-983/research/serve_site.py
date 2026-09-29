import functools, http.server, os

ROOT = 'C:/AI/Mpi/Cubric Studio (Website)'


class Server(http.server.ThreadingHTTPServer):
    allow_reuse_address = os.name != 'nt'  # on Windows True silently hijacks a live port


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      '.webm': 'video/webm', '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp4': 'video/mp4'}

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


Server(('127.0.0.1', 8743), functools.partial(Handler, directory=ROOT)).serve_forever()
