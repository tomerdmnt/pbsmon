import resource
import subprocess
import sets

class Node(resource.Resource):
	def set(self, key, val):
		parser = resource.findparser(val)
		if key == 'resources_available.Qlist':
			parser = resource.parselist
		self[key] = parser(val)
	
	def __hash__(self):
		return hash(self['hostname'])

def getnodes(cluster=None):
	# all nodes
	nodes = _parse_nodes()
	if cluster:
		# filter nodes by qlist
		nodes = [n for n in nodes if cluster in n.get('resources_available.Qlist', [])]
	return nodes

def _parse_nodes():
	p = subprocess.Popen(['pbsnodes', '-a'], stdout=subprocess.PIPE)
	nodes = []
	node = Node()
	for line in p.stdout:
		# end of node
		if line.strip() == "":
			nodes.append(node)
			node = Node()
		else:
			# parse field of node
			field = line.split('=')
			if len(field) > 1:
				key = field[0].strip()
				val = field[1].strip()
				node.set(key, val)
			else:
				node.set('hostname', field[0].strip())
	# last node if not empty
	if node:
		nodes.append(node)
	return nodes

def getclusters():
	nodes = getnodes()
	clusters = sets.Set()
	for node in nodes:
		map(lambda q: clusters.add(q), node.get('resources_available.Qlist', []))
	return list(clusters)



