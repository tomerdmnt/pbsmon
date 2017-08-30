import resource
import subprocess

class Queue(resource.Resource):
	def __init__(self, name):
		self._name = name
		self.set('name', name)

	def __hash__(self):
		return hash(self._name)

def getqueues(cluster=None):
	queues = _parse_queues()
	if cluster:
		queues = {q:queues[q] for q in queues if queues[q].get('default_chunk.Qlist') == cluster}
	return queues

def _parse_queues():
	p = subprocess.Popen(['qmgr', '-c', 'p s'], stdout=subprocess.PIPE)
	queues = {}
	for line in p.stdout:
		line = line.strip().split(' ')
		if line[0] == 'create' and line[1] == 'queue':
			queues[line[2]] = Queue(line[2])
		if line[0] == 'set' and line[1] == 'queue':
			queue = queues[line[2]]
			key = line[3]
			val = line[5]
			if line[4] == '=':
				queue.set(key, val)
			elif line[4] == '+=':
				queue.append(key, val)
	for k in queues.keys():
		queues[k].finish()
	return queues


