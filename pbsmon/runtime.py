
import math
from job import getjobs

jobsbyexe = {}
stats = {}

def check_ended_jobs(cluster, user, no_stdin):
	jobs = getjobs(cluster)
	if user:
		jobs = [j for j in jobs if j.get('user') == user]
	if no_stdin:
		jobs = [j for j in jobs if j.get('job_name') != 'STDIN']
	# switch running flag off
	for k, v in jobsbyexe.items():
		for jid, job in v.items():
			job['running'] = False

	# fill in jobsbyexe dictionary 
	for j in jobs:
		jobname = j.get('job_name')
		jobid = j.get('id')
		jobwtime = j.get('resources_used.walltime')
		if jobwtime:
			if jobname in jobsbyexe:
				jobsbyexe[jobname][jobid] = { 'job': j, 'running': True }
			else:
				jobsbyexe[jobname] = { jobid: { 'job': j, 'running': True } }
	
	# use the running flag to find finished jobs
	for jobname, jobs in jobsbyexe.items():
		for jobid, j in jobs.items():
			if j['running'] == False:
				yield j['job']

def addstat(job):
	jobname = job.get('job_name')
	user = job.get('user')
	jobwalltime = job.get('resources_used.walltime')
	if user not in stats:
		stats[user] = {}
	if jobname in stats[user]:
		stats[user][jobname].append(jobwalltime)
	else:
		stats[user][jobname] = [jobwalltime]

def percentile(lst, percent, key=lambda x:x):
	k = (len(lst)-1)*percent
	i = int(math.floor(k))
	if i == k:
		return key(lst[i])
	return (key(lst[i]) + key(lst[i+1]))/2.0

def isoutlier(data, x, k=1.5):
	data = sorted(data)
	totalsecs = lambda x: x.total_seconds()
	Q1 = percentile(data, 0.25, totalsecs)
	Q3 = percentile(data, 0.75, totalsecs)
	IQR = Q3-Q1
	if totalsecs(x) > Q3 + k*IQR:
		return True
	if totalsecs(x) < Q1 - k*IQR:
		return True
	return False

def outliers(cluster, user=None, k=1.5, no_stdin=True):
	while True:
		for j in check_ended_jobs(cluster, user, no_stdin):
			addstat(j)
			jobname = j.get('job_name')
			user = j.get('user')
			if isoutlier(stats[user][jobname], j.get('resources_used.walltime'), k):
				yield (j, stats[user][jobname])
		yield (None, None)
