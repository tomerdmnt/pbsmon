#!/usr/bin/python

import argparse
import sys
import math
from node import getnodes, getclusters
from job import getjobs
from queue import getqueues

def _ls_cmd(args):
	if args.cluster:
		nodes = getnodes(args.cluster)
		# print nodes in cluster
		for node in nodes:
			print(node.get('hostname'))
	else:
		# print all clusters
		clusters = getclusters()
		for c in clusters:
			print(c)

def _queues_cmd(args):
	queues = getqueues(args.cluster)
	for q in queues:
		print(q)

def _cpuutil_cmd(args):
	nodes = getnodes(args.cluster)
	fmt = '{0:<20} {1:>10}/{2:<10} {3:>20}'
	total_used = total_available = 0
	for node in nodes:
		total_used += node.get('resources_assigned.ncpus')
		total_available += node.get('resources_available.ncpus')
		print fmt.format(
			node.get('hostname'),
			node.get('resources_assigned.ncpus'),
			node.get('resources_available.ncpus'),
			node.get('comment', ''))
	print('-----------------------------')
	print(fmt.format('total:', total_used, total_available, ''))

def _memutil_cmd(args):
	nodes = getnodes(args.cluster)
	fmt = '{0:<20} {1:>10}/{2:<10} {3:>20}'
	total_used = total_available = 0

	factors = ('b', 'kb', 'mb', 'gb')
	sizeinbytes = lambda sz: sz[0]*(1024**factors.index(sz[1]))
	def prettyprint(bytes):
		i = int(math.floor(math.log(bytes, 1024))) if bytes > 0 else 1
		i = min(i, 3)
		p = math.pow(1024, i)
		return '%d%s' % (round(bytes/p, 2), factors[i])

	for node in nodes:
		used = sizeinbytes(node.get('resources_assigned.mem'))
		available = sizeinbytes(node.get('resources_available.mem'))
		total_used += used
		total_available += available
		print fmt.format(
			node.get('hostname'),
			prettyprint(used),
			prettyprint(available),
			node.get('comment', ''))
	print('-----------------------------')
	print(fmt.format('total:', prettyprint(total_used), prettyprint(total_available), ''))

def _walltime0_cmd(args):
	jobs = getjobs(args.cluster)
	for j in jobs:
		if j.get('job_state') == 'R' and j.get('resources_used.walltime').total_seconds() == 0:
			print j.get('Id')

def _cputime0_cmd(args):
	jobs = getjobs(args.cluster)
	for j in jobs:
		if j.get('job_state') == 'R' and j.get('resources_used.cput').total_seconds() == 0 and j.get('resources_used.walltime').total_seconds() > 0:
			print j.get('Id')

def _main():
	# command arguments parsers
	parser = argparse.ArgumentParser(prog='pbsmon')
	parser._positionals.title = 'commands'
	parser._optionals.title = 'flags'
	subparsers = parser.add_subparsers()

	# ls sub command
	ls_description="""List all nodes in cluster (i.e. tamir-short).
	If cluster is omitted, List all clusters"""

	ls_parser = subparsers.add_parser('ls', help="List clusters and nodes in cluster", description=ls_description)
	ls_parser.add_argument('cluster', help='cluster name (i.e. tamir-short)', default='', nargs='?')
	ls_parser.set_defaults(func=_ls_cmd)

	ls_parser._positionals.title = 'arguments'
	ls_parser._optionals.title = 'flags'

	# queues sub command
	queues_description="""List all queues in cluster (i.e. tamir-short).
	If cluster is omitted, List all queues"""

	queues_parser = subparsers.add_parser('queues', help="List queues in cluster", description=queues_description)
	queues_parser.add_argument('cluster', help='cluster name (i.e. tamir-short)', default='', nargs='?')
	queues_parser.set_defaults(func=_queues_cmd)

	queues_parser._positionals.title = 'arguments'
	queues_parser._optionals.title = 'flags'

	# cpuutil sub command
	cpuutil_description="""Display CPU utilization info for nodes in cluster (i.e. tamir-short).
	If cluster is omitted, display CPU utilization for all nodes"""

	cpuutil_parser = subparsers.add_parser('cpuutil', help="Display cluster's CPU utilization",
						description=cpuutil_description)
	cpuutil_parser.add_argument('cluster', help='cluster name (i.e. tamir-short)', default='', nargs='?')
	cpuutil_parser.set_defaults(func=_cpuutil_cmd)

	cpuutil_parser._positionals.title = 'arguments'
	cpuutil_parser._optionals.title = 'flags'

	# memutil sub command
	memutil_description="""Display Memory utilization info for nodes in cluster (i.e. tamir-short).
	If cluster is omitted, display Memory utilization for all nodes"""

	memutil_parser = subparsers.add_parser('memutil', help="Display cluster's Memory utilization",
						description=memutil_description)
	memutil_parser.add_argument('cluster', help='cluster name (i.e. tamir-short)', default='', nargs='?')
	memutil_parser.set_defaults(func=_memutil_cmd)

	memutil_parser._positionals.title = 'arguments'
	memutil_parser._optionals.title = 'flags'

	# walltime0 sub command
	walltime0_description="""List jobs with status R and Walltime 00:00:00"""

	walltime0_parser = subparsers.add_parser('walltime0', help="List running jobs with walltime 0",
						description=walltime0_description)
	walltime0_parser.add_argument('cluster', help='cluster name (i.e. tamir-short)', default='', nargs='?')
	walltime0_parser.set_defaults(func=_walltime0_cmd)

	walltime0_parser._positionals.title = 'arguments'
	walltime0_parser._optionals.title = 'flags'

	# cputime0 sub command
	cputime0_description="""List jobs with status R and cpu 00:00:00"""

	cputime0_parser = subparsers.add_parser('cputime0', help="List running jobs with cpu 0",
						description=cputime0_description)
	cputime0_parser.add_argument('cluster', help='cluster name (i.e. tamir-short)', default='', nargs='?')
	cputime0_parser.set_defaults(func=_cputime0_cmd)

	cputime0_parser._positionals.title = 'arguments'
	cputime0_parser._optionals.title = 'flags'

	# print help when no arguments supplied
	if len(sys.argv) == 1:
		parser.print_help()
		sys.exit(1)

	# execute
	args = parser.parse_args()
	args.func(args)

if __name__ == "__main__":
	_main()
