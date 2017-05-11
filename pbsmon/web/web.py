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
	
	def do_GET(self):
		if self.path == '/':
			self._set_headers('text/html')
			ifd = open(PATH + '/index.html', 'r')
			self.wfile.write(ifd.read())
			ifd.close()
		elif self.path == '/jobs.json':
			self._set_headers('application/json')
			jobs = getjobs(getCluster())
			json.dump(jobs, self.wfile, default=lambda o: o.__str__())
		elif self.path == '/nodes.json':
			self._set_headers('application/json')
			nodes = getnodes(getCluster())
			json.dump(nodes, self.wfile, default=lambda o: o.__str__())
#		elif self.path == '/jobs.json':
#			self._set_headers('application/json')
#			ifd = open(PATH + '/jobs.json', 'r')
#			self.wfile.write(ifd.read())
#			ifd.close()
#		elif self.path == '/nodes.json':
#			self._set_headers('application/json')
#			ifd = open(PATH + '/nodes.json', 'r')
#			self.wfile.write(ifd.read())
#			ifd.close()
		elif self.path == '/index.js':
			self._set_headers('text/javascript')
			ifd = open(PATH + '/index.js', 'r')
			self.wfile.write(ifd.read())
			ifd.close()
		elif self.path == '/style.css':
			self._set_headers('text/css')
			ifd = open(PATH + '/style.css', 'r')
			self.wfile.write(ifd.read())
			ifd.close()

	def do_POST(self):
		# Doesn't do anything with posted data
		self._set_headers()
		self.wfile.write("<html><body><h1>POST!</h1></body></html>")

def run(cluster, server_class=HTTPServer, handler_class=S, port=0):
	server_address = ('', port)
	setCluster(cluster)
	print("cluster = %s" % getCluster())
	httpd = server_class(server_address, handler_class)
	print('Starting on http://power8.tau.ac.il:%s' % httpd.socket.getsockname()[1])
	httpd.serve_forever()

if __name__ == "__main__":
	run()
