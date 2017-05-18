from BaseHTTPServer import BaseHTTPRequestHandler, HTTPServer
import SocketServer
import json
import os, sys
from pbsmon import getjobs
from pbsmon import getnodes
import threading
import StringIO
import gzip

PATH = os.path.dirname(os.path.abspath(__file__))

def gzipcompress(data):
	out = StringIO.StringIO()
	with gzip.GzipFile(fileobj=out, mode="wb") as f:
		f.write(data)
	return out.getvalue()

class _globals:
    pass

__globals = _globals()
__globals.cluster = None
__globals.filecache = {}

def cachejobs():
	print("caching jobs")
	__globals.jobs = gzipcompress(json.dumps(getjobs(__globals.cluster), default=lambda o: o.__str__()))

def jobs():
	return __globals.jobs

def cachenodes():
	print("caching nodes")
	__globals.nodes = gzipcompress(json.dumps(getnodes(__globals.cluster), default=lambda o: o.__str__()))

def nodes():
	return __globals.nodes

def filecache():
	return __globals.filecache

def cachefile(file):
	with open(PATH + file, 'rb') as f:
		__globals.filecache[file] = gzipcompress(f.read())

def set_interval(func, sec):
	def func_wrapper():
		set_interval(func, sec)
		func()
	t = threading.Timer(sec, func_wrapper)
	t.daemon = True
	t.start()
	return t

class S(BaseHTTPRequestHandler):
	def _set_headers(self, contenttype='text/html'):
		self.send_response(200)
		self.send_header('Content-type', contenttype)
		self.send_header('Content-Encoding', 'gzip')
		self.end_headers()

	def _serve_file(self, file, contenttype):
		self._set_headers(contenttype)
		if file in filecache():
			self.wfile.write(filecache()[file])
		else: 
			with open(PATH + file, 'rb') as f:
				data = f.read(2048)
				while data:
					self.wfile.write(data)
					data = f.read(2048)
	
	def do_HEAD(self):
		if self.path == '/':
			self._set_headers('text/html')
		elif self.path == '/jobs.json':
			self._set_headers('application/json')
		elif self.path == '/nodes.json':
			self._set_headers('application/json')
		elif self.path == '/index.js':
			self._set_headers('text/javascript')
		elif self.path == '/style.css':
			self._set_headers('text/css')
		else:
			self.send_response(404)
			self.end_headers()

	def do_GET(self):
		if self.path == '/':
			self._serve_file('/index.html', 'text/html')
		elif self.path == '/jobs.json':
			self._set_headers('application/json')
			self.wfile.write(jobs())
		elif self.path == '/nodes.json':
			self._set_headers('application/json')
			self.wfile.write(nodes())
		elif self.path == '/index.js':
			self._serve_file('/index.js', 'text/javascript')
		elif self.path == '/style.css':
			self._serve_file('/style.css', 'text/css')
		else:
			self.send_response(404)
			self.end_headers()
		self.finish()


def run(cluster, server_class=HTTPServer, handler_class=S, port=0):
	server_address = ('', port)
	__globals.cluster = cluster

	cachefile('/index.html')
	cachefile('/index.js')
	cachefile('/style.css')
	cachenodes()
	cachejobs()
	set_interval(cachenodes, 60*10)
	set_interval(cachejobs, 60*10)

	httpd = server_class(server_address, handler_class)
	print('Starting on http://power8.tau.ac.il:%s' % httpd.socket.getsockname()[1])
	httpd.serve_forever()

if __name__ == "__main__":
	run(None)
