from BaseHTTPServer import BaseHTTPRequestHandler, HTTPServer
import SocketServer
import json
import os, sys
from pbsmon import getjobs
from pbsmon import getnodes
import threading

PATH = os.path.dirname(os.path.abspath(__file__))

class _globals:
    pass

__globals = _globals()
__globals.cluster = None
__globals.filecache = {}

def cachejobs():
	print("caching jobs")
	__globals.jobs = getjobs(__globals.cluster)

def jobs():
	return __globals.jobs

def cachenodes():
	print("caching nodes")
	__globals.nodes = getnodes(__globals.cluster)

def nodes():
	return __globals.nodes

def filecache():
	return __globals.filecache

def cachefile(file):
	with open(PATH + file, 'r') as f:
		__globals.filecache[file] = f.read()

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
		self.end_headers()

	def _serve_file(self, file, contenttype):
		self._set_headers(contenttype)
		if file in filecache():
			self.wfile.write(filecache()[file])
		else: 
			with open(PATH + file, 'r') as f:
				data = f.read(2048)
				while data:
					self.wfile.write(data)
					data = f.read(2048)

	def do_GET(self):
		if self.path == '/':
			self._serve_file('/index.html', 'text/html')
		elif self.path == '/jobs.json':
			self._set_headers('application/json')
			json.dump(jobs(), self.wfile, default=lambda o: o.__str__())
		elif self.path == '/nodes.json':
			self._set_headers('application/json')
			json.dump(nodes(), self.wfile, default=lambda o: o.__str__())
		elif self.path == '/index.js':
			self._serve_file('/index.js', 'text/javascript')
		elif self.path == '/style.css':
			self._serve_file('/style.css', 'text/css')
		else:
			self.send_response(404)
			self.end_headers()


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
