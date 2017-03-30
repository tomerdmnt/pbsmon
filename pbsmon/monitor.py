from job import getjobs
from node import getnodes
from runtime import outliers

# configuration
min_wall_time = 60*5
min_cput_ratio = .5
default_address = 'tomer.dmnt@gmail.com'

alerts = []

def queueAlert(user, msg)
	alerts.append({to: user, msg: msg})

def jobsQueued(jobs):
	return (len([j for j in jobs if j.get('job_state','') == 'Q']) > 0)

def nodesWithUnusedCores(nodes):
	return [n for n in nodes if n.get('resources_assigned.ncpus') < n.get('resources_available.ncpus')]

checkcput(jobs):
	for j in jobs:
		cput = j.get('resources_used.cput).total_seconds()
		wallt = j.get('resources_used.walltime).total_seconds()
		if wallt > min_wall_time:
			if cput/float(walltime) > min_cput_ratio:
				queueAlert(j.get('user'), 'job %s has low cputime' % j.get('id'))

def run():
	jobs = getjobs("tamir-nano4")
	nodes = getnodes("tamir-nano4")
	if jobsQueued(jobs):
		for n in nodesWithUnusedCores(nodes):
			checkmemabused(n)
	checkcput(jobs)
	checkofflinenodes()
	#checkdisktamir1()
	checkoutliers()
	checkclusters()

	sendalerts()
	sleep()
