from BaseHTTPServer import BaseHTTPRequestHandler, HTTPServer
import SocketServer
import json
import os, sys
from pbsmon import getjobs
from pbsmon import getnodes

PATH = os.path.dirname(os.path.abspath(__file__))

class _globals:
    pass

__globals = _globals()
__globals.cluster = None

def setCluster(cluster):
	__globals.cluster = cluster

def getCluster():
	return __globals.cluster

class S(BaseHTTPRequestHandler):
	def _set_headers(self, contenttype='text/html'):
		self.send_response(200)
		self.send_header('Content-type', contenttype)
		self.end_headers()
	
	def _serve_file(self, file, contenttype):
		self._set_headers(contenttype)
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
			jobs = getjobs(getCluster())
			json.dump(jobs, self.wfile, default=lambda o: o.__str__())
		elif self.path == '/nodes.json':
			self._set_headers('application/json')
			nodes = getnodes(getCluster())
			json.dump(nodes, self.wfile, default=lambda o: o.__str__())
		elif self.path == '/index.js':
			self._serve_file('/index.js', 'text/javascript')
		elif self.path == '/style.css':
			self._serve_file('/style.css', 'text/css')
		else:
			self.send_response(404)
			self.end_headers()


def run(cluster, server_class=HTTPServer, handler_class=S, port=0):
	server_address = ('', port)
	setCluster(cluster)
	print("cluster = %s" % getCluster())
	httpd = server_class(server_address, handler_class)
	print('Starting on http://power8.tau.ac.il:%s' % httpd.socket.getsockname()[1])
	httpd.serve_forever()

if __name__ == "__main__":
	run()
