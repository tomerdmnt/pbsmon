from BaseHTTPServer import BaseHTTPRequestHandler, HTTPServer
import SocketServer
import json
import os, sys
from pbsmon import getjobs
from pbsmon import getnodes
from pbsmon import monitor
import threading
import StringIO
import gzip
from time import strftime, localtime 

PATH = os.path.dirname(os.path.abspath(__file__))

class _globals:
	cluster = None
	filecache = {}
	alerts = []

__globals = _globals()

def gzipcompress(data):
	out = StringIO.StringIO()
	with gzip.GzipFile(fileobj=out, mode="wb") as f:
		f.write(data)
	return out.getvalue()

def cachejobs():
	print("caching jobs")
	__globals.jobs = gzipcompress(json.dumps(getjobs(__globals.cluster), default=lambda o: o.__str__()))

def jobs():
	return __globals.jobs

def alerts():
	return gzipcompress(json.dumps(__globals.alerts))

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
	# protocol_version = "HTTP/1.1"

	def _set_headers(self, contenttype='text/html', status=200):
		self.send_response(status)
		self.send_header('Content-Type', contenttype)
		self.send_header('Content-Encoding', 'gzip')
		self.end_headers()

	def _serve_file(self, file, contenttype):
		if file in filecache():
			self._set_headers(contenttype)
			self.wfile.write(filecache()[file])
		else:
			self._set_headers(status=404)
			self.end_headers()
	
	def do_HEAD(self):
		if self.path == '/' or self.path == '//tamir':
			self._set_headers('text/html')
		elif self.path == '/jobs.json' or self.path == '//tamir/jobs.json':
			self._set_headers('application/json')
		elif self.path == '/nodes.json' or self.path == '//tamir/nodes.json':
			self._set_headers('application/json')
		elif self.path == '/alerts.json' or self.path == '//tamir/alerts.json':
			self._set_headers('application/json')
		elif self.path == '/index.js' or self.path == '//tamir/index.js':
			self._set_headers('text/javascript')
		elif self.path == '/style.css' or self.path == '//tamir/style.css':
			self._set_headers('text/css')
		elif self.path == '/favicon.ico' or self.path == '//tamir/favicon.ico':
			self._set_headers('image/x-icon')
		else:
			self.send_response(404)
			self.send_header('Content-Length', 0)
			self.end_headers()

	def do_GET(self):
		if self.path == '/':
			self._serve_file('/index.html', 'text/html')
		elif self.path == '//tamir':
			self._serve_file('/index_tamir.html', 'text/html')
		elif self.path == '/jobs.json' or self.path == '//tamir/jobs.json':
			data = jobs()
			self._set_headers('application/json')
			self.wfile.write(data)
		elif self.path == '/nodes.json' or self.path == '//tamir/nodes.json':
			data = nodes()
			self._set_headers('application/json')
			self.wfile.write(data)
		elif self.path == '/alerts.json' or self.path == '//tamir/alerts.json':
			data = alerts()
			self._set_headers('application/json')
			self.wfile.write(data)
		elif self.path == '/index.js' or self.path == '//tamir/index.js':
			self._serve_file('/index.js', 'text/javascript')
		elif self.path == '/style.css' or self.path == '//tamir/style.css':
			self._serve_file('/style.css', 'text/css')
		elif self.path == '/favicon.ico' or self.path == '//tamir/favicon.ico':
			self._serve_file('/favicon.ico', 'image/x-icon')
		else:
			self.send_response(404)
			self.send_header('Content-Length', 0)
			self.end_headers()

def run_monitor():
	print("running monitor")
	monitor.run(__globals.cluster, alertfn)

def alertfn(user, msg):
	now = strftime("%Y-%m-%d %H:%M:%S", localtime())
	__globals.alerts.insert(0, {"time": now, "user": user, "msg": msg})
	__globals.alerts = __globals.alerts[:2000]

def run(cluster, server_class=HTTPServer, handler_class=S, port=0):
	server_address = ('', port)
	__globals.cluster = cluster

	cachefile('/index.html')
	cachefile('/index_tamir.html')
	cachefile('/index.js')
	cachefile('/style.css')
	cachefile('/favicon.ico')
	cachenodes()
	cachejobs()
	set_interval(cachenodes, 60*3)
	set_interval(cachejobs, 60*3)

	t = threading.Thread(target=run_monitor)
	t.daemon = True
	t.start()

	httpd = server_class(server_address, handler_class)
	print('Starting on http://power8.tau.ac.il:%s' % httpd.socket.getsockname()[1])
	httpd.serve_forever()

if __name__ == "__main__":
	run(None)
