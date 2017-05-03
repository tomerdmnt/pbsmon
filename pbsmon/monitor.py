import time
from job import getjobs
from node import getnodes
from runtime import outliers
from size import Size
from datetime import timedelta
from sets import Set
import runtime
import traceback

# configuration
SLEEP_TIME = 60*10
MIN_WALL_TIME = 60*5
MIN_CPUT_RATIO = .5

def jobsQueued(jobs):
	return (len([j for j in jobs if j.get('job_state','') == 'Q']) > 0)

def nodesWithUnusedCores(nodes):
	return [n for n in nodes if n.get('resources_assigned.ncpus') < n.get('resources_available.ncpus')]

def checkmemabuse(node, jobs, alertfn):
	# calculate the average memory each job takes
	memory_sum = 0
	memory_avg = 0
	njobs = 0
	users = []
	node_host = node.get('hostname', 'n/a')
	available = node.get('resources_available.mem', Size.frombytes(0))
	used = node.get('resources_used.mem', Size.frombytes(0))
	for j in jobs:
		if j.get('exec_host', '').split('/')[0] == node_host:
			memory_sum += j.get('resource_list.mem', Size.frombytes(0)).bytes()
			njobs += 1
			users.append(j.get('user', ''))
	if njobs > 0:
		memory_avg = memory_sum/float(njobs)
	if memory_sum + memory_avg > available.bytes():
		for u in Set(users):
			alertfn(u, 'memory abuse (unused cores) on node %s, memory usage: %s/%s, average job memory: %s' %
				(node_host, used, available, Size.frombytes(memory_avg)))

def timedelta_str(td):
	s = td.total_seconds()
	hours, remainder = divmod(s, 3600)
	minutes, seconds = divmod(remainder, 60)
	return '%02d:%02d:%02d' % (hours, minutes, seconds)

def checkcput(jobs, alertfn):
	for j in jobs:
		cput = j.get('resources_used.cput', timedelta(0))
		wallt = j.get('resources_used.walltime', timedelta(0))
		if wallt.total_seconds() > MIN_WALL_TIME:
			if cput.total_seconds()/float(wallt.total_seconds()) < MIN_CPUT_RATIO:
				alertfn(j.get('user', ''), 'job {0} has low cputime {1} / {2}'.format(
					j.get('id', ''),
					timedelta_str(cput),
					timedelta_str(wallt)))

def checkclusters(alertfn):
	gethostname = lambda x: x.get('hostname', '')
	tamirnano4 = Set(map(gethostname, getnodes('tamir-nano4')))
	nano4 = Set(map(gethostname, getnodes('nano')))
	tamirshort = Set(map(gethostname, getnodes('tamir-short')))
	
	diff = (tamirnano4.difference(nano4)).difference(tamirshort)
	for server in diff:
		alertfn("system", "%s in tamir-nano4 and not in nano or tamir-short" % server)

	diff = nano4.difference(tamirnano4)
	for server in diff:
		alertfn("system", "%s in nano4 and not in tamir-nano4" % server)

	diff = tamirshort.difference(tamirnano4)
	for server in diff:
		alertfn("system", "%s in tamir-short and not in tamir-nano4" % server)

def checkoutliers(cluster, alertfn):
	for job, stats in runtime.outliers(cluster):
		if job == None:
			return
		user = job.get('user', '')
		id = job.get('id', '')
		jobname = job.get('job_name', '')
		walltime = job.get('resources_used.walltime', timedelta(0))
		stats = map(lambda x: x.total_seconds(), stats)
		msg = '{0}: {1}: ended in {2} seconds, similar jobs ended in {3}'.format(
			jobname, id,
			walltime.total_seconds(),
			stats)
		alertfn(user, msg)

def run(cluster, alertfn):
	try:
		while True:
			jobs = getjobs(cluster)
			nodes = getnodes(cluster)
			if jobsQueued(jobs):
				for n in nodesWithUnusedCores(nodes):
					checkmemabuse(n, jobs, alertfn)
			checkcput(jobs, alertfn)
			#checkofflinenodes()
			#checkdisktamir1()
			checkoutliers(cluster, alertfn)
			checkclusters(alertfn)

			time.sleep(SLEEP_TIME)
	except Exception as e:
		traceback.print_exc()

