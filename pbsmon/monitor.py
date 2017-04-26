import time
from job import getjobs
from node import getnodes
from runtime import outliers
from size import Size
from datetime import timedelta
from sets import Set
import runtime

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
	njobs = 0
	users = []
	node_host = node.get('host', 'n/a')
	for j in jobs:
		if j.get('exec_host', '').split('/')[0] == node_host:
			memory_sum += j.get('resource_list.mem', Size.frombytes(0)).bytes()
			njobs += 1
			users.append(j.get('user', ''))
	memory_avg = memory_sum/float(njobs)
	if memory_sum + memory_avg > j.get('resources_available.mem', Size.frombytes(0)).bytes():
		for u in Set(users):
			alertfn(u, 'memory abuse on node %s, check jobs running' % node_host)

def checkcput(jobs, alertfn):
	for j in jobs:
		cput = j.get('resources_used.cput', timedelta(0)).total_seconds()
		wallt = j.get('resources_used.walltime', timedelta(0)).total_seconds()
		if wallt > MIN_WALL_TIME:
			if cput/float(wallt) > MIN_CPUT_RATIO:
				alertfn(j.get('user', ''), 'job %s has low cputime' % j.get('id', ''))

def checkclusters(alertfn):
	tamirnano4 = Set(getnodes('tamir-nano4'))
	nano4 = Set(getnodes('nano'))
	tamirshort = Set(getnodes('tamir-short'))
	
	diff = tamirnano4.difference(nano4).difference(tamirshort)
	for server in diff:
		alertfn("system", "%s in tamir-nano4 and not in nano or tamir-short")

	diff = nano4.difference(tamirnano4)
	for server in diff:
		alertfn("system", "%s in nano4 and not in tamir-nano4")

	diff = tamirshort.difference(tamirnano4)
	for server in diff:
		alertfn("system", "%s in tamir-short and not in tamir-nano4")

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
	jobs = getjobs(cluster)
	nodes = getnodes(cluster)
	if jobsQueued(jobs):
		for n in nodesWithUnusedCores(nodes):
			checkmemabused(n, alertfn)
	checkcput(jobs, alertfn)
	#checkofflinenodes()
	#checkdisktamir1()
	checkoutliers(cluster, alertfn)
	checkclusters(alertfn)

	time.sleep(SLEEP_TIME)
