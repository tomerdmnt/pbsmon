import resource
import subprocess
from queue import getqueues
from node import getnodes

class Job(resource.Resource):
	def set(self, key, val):
		parser = resource.findparser(val)
		self[key] = parser(val)
		if key == 'Job_Owner':
			self['user'] = val.split('@')[0]
	
	def __hash__(self):
		return hash(self['id'])

def getjobs(cluster=None):
	alljobs = _parse_jobs()
	jobs = alljobs
	if cluster:
		jobs = []
		queues = getqueues()
		nodes = getnodes()
		clusternodes = [n.get('hostname') for n in  getnodes(cluster)]

		# check if the nodes in each job's cluster (denoted by qlist)
		# is a subset of the cluster (parameter)
		# i.e. all nodes that the job may run on are in cluster
		for j in alljobs:
			# if we know where the job is running
			exechosts = j.get('exec_host')
			if exechosts: 
				for exechost in exechosts.split("+"):
					exechost = exechost.split('/')[0]
					if exechost in clusternodes:
						jobs.append(j)
			else:
				q = j.get('queue')
				qlist = queues.get(q, {}).get('default_chunk.Qlist', [])
				jobnodes = [n.get('hostname') for n in nodes if qlist in n.get('resources_available.Qlist', [])]
				if set(jobnodes).issubset(clusternodes):
					jobs.append(j)
	return jobs

def _parse_jobs():
	p = subprocess.Popen(['qstat', '-f'], stdout=subprocess.PIPE)
	jobs = []
	job = Job()
	key = ""
	for line in p.stdout:
		# end of job 
		if line.strip() == "":
			jobs.append(job)
			job = Job()
		else:
			# parse field of job
			if line.startswith('Job Id:'):
				id = line.split(':')[1].strip()
				job.set('Id', id)
				continue
			field = line.split(' = ')
			if len(field) > 1:
				key = field[0].strip()
				val = field[1].strip()
				job.set(key, val)
			else:
				# append to last field
				job.append(key, line.strip())
	# last node if not empty
	if job:
		jobs.append(job)
	return jobs
