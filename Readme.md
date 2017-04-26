
# pbsmon

pbsmon is a command-line utility, python module and monitoring daemon for the PBS cluster.

[toc]

## installation

git clone
```
power8$ git clone https://gitlab.com/tomerdmnt/pbsmon
```
install on the head node. use the **--user flag** to install locally without root permissions
```
power8$ cd pbsmon && python setup.py install --user
```
if **--user flag** was used add bin directory to $PATH variable
```
power8$ export PATH=$PATH:~/.local/bin/
```

### installation one-liner

```
git clone https://gitlab.com/tomerdmnt/pbsmon && cd pbsmon && python setup.py install --user && echo "export PATH=\$PATH:~/.local/bin/" >> ~/.bashrc && . ~/.bashrc
```

## command-line usage

pbsmon is a collection of sub commands. You can view a help message corresponding to each subcommand by adding an -h flag, for example:

```
$ pbsmon cpuutil -h
usage: pbsmon cpuutil [-h] [-u] [cluster]
...
```

or the general help message
```
$ pbsmon -h
usage: pbsmon [-h]
              {ls,queues,cpuutil,memutil,walltime0,cputime0,runtime-outliers}
              ...

commands:
  {ls,queues,cpuutil,memutil,walltime0,cputime0,runtime-outliers}
    ls                  List clusters and nodes in cluster
    queues              List queues in cluster
    cpuutil             Display cluster's CPU utilization
    memutil             Display cluster's Memory utilization
    walltime0           List running jobs with walltime 0
    cputime0            List running jobs insufficient cputime
    runtime-outliers    List jobs with unlikely runtime

flags:
  -h, --help            show this help message and exit 
```

### pbsmon ls

List all the different qlist clusters (i.e. tamir-short, tamir-nano4, ...)

```
$ pbsmon ls
tamir-short
tamir-nano4
...
```

List all nodes (server names) belonging to a cluster

```
$ pbsmon ls tamir-short
compute-0-46
compute-0-45
...
```

### pbsmon queues

List all queues pointing to a cluster

```
$ pbsmon queues nano
nano3
nano2
nano1
nano5
nano4
```

### pbsmon cpuutil

Display CPU utilization info for all nodes in cluster

```
$ pbsmon cpuutil tamir-nano4
...
compute-0-232                23/24         free                
compute-0-233                24/24         job-busy            
compute-0-234                 0/24         down,offline        
compute-0-235                 0/24         offline             
-----------------------------
total:                      860/932 
```

Display CPUUtilization per user for all nodes in cluster
```
$ pbsmon cpuutil -u tamir-nano4
...
giladshaham                  52
dalon                         1
zurhadas2                   780
wengenouyang                  8
...
```

### pbsmon memutil

Display memory utilization info for all nodes in cluster:

```
$ pbsmon memutil tamir-nano4
...
ompute-0-233              70gb/94gb                   job-busy
compute-0-234               0kb/94gb               down,offline
compute-0-235               0kb/94gb                    offline
-----------------------------
total:                   2619gb/4482gb  
```

Display CPUUtilization per user for all nodes in cluster

```
$ pbsmon memutil -u tamir-nano4
...
giladshaham               124gb/253gb
dalon                     269mb/3gb
zurhadas2                 269gb/2313gb
wengenouyang              210mb/23gb
...
```

### pbsmon runtime-outliers

The runtime-outliers command will run indefinitely and monitor jobs that ended. Each job's wall-time will be compared to other job's wall-time with the same executable name. It outputs job IDs of jobs that ended too soon, or ran for an unusual period of time. It uses the following calculation to determine weather a job is an outlier:
$$
Q1 = walltime\ 25th\ percentile\\
Q3 = walltime\ 75th\ percentile\\
IQR = Q3 - Q1\\
if\ walltime(job) > Q3 + k*IQR \\or\ walltime(job) < Q1 - k*IQR
$$

You can determine the constant $k$ with the -k flag (default 1.5), and monitor only after certain user's job using -u [user] flag.

```
$ pbsmon runtime-outliers -k=2 tamir-nano4
...
```

### pbsmon monitor
Monitoring simulation, where the alerts and recepients are written to stdout, and no emails are sent.

```
$ pbsmon monitor tamir-nano4
```

## python module usage

As a module pbsmon imports the methods: getjobs(), getnodes(), getqueues() and getclusters().

Each one of these returns a list of object of type Resource, which are dictionaries with the followin methods:

```python
>>> resource.get('field_name') # returns the value of the field with key 'field_name'
>>> resource.get('field_name', 'default') # returns the value of the field with field_name if it exists, otherwise return 'default'
>>> resource.find('time') # returns a dictionary of all key value pairs where key is of *time* 
```

Values are parsed according to their type, for example:

```python
>>> job.get('resources_used.walltime').total_seconds() # time intervals are parsed as time.timedelta types
684397.0
>>> job.get('resources_used.mem').nodes[0].get('resources_assigned.mem').bytes() # use .bytes() to get #bytes in a memory field
37748736000
```

### getjobs()

Gets all jobs which are currently running, or might run on the specified cluster. If the cluster argument is omitted, the function will return all jobs on the server.

```python
>>> from pbsmon import getjobs
>>> 
>>> jobs = getjobs('tamir-nano4')
>>> running_jobs = [j for j in jobs if j.get('job_state','Q') == 'R'] # filter for running jobs
>>> 
>>> running_jobs[0].get('resources_used.walltime').total_seconds() # get walltime in seconds
684397.0
```

### getnodes()

Get all nodes which mapped through Qlist to the specified cluster.

```python
>>> from pbsmon import getnodes
>>> 
>>> nodes = getnodes('tamir-nano4')
>>> nodes[0].get('resources_assigned.ncpus') # nodes currently used CPUs
12
```

### getqueues()
...

## monitoring daemon

The monitoring daemon runs indefinitely and monitors for the system's health. It aggregates alerts for either job owners, or people specified in the System group, and sends these alerts every 60 minutes.

The following chart specifies the different tests the daemon performs, and all conditions for all alerts: 

```flow
st=>start: Start
e=>end
checkqueued=>operation: Check queued jobs on tamir-nano4 and nano4
isqueued=>condition: Queued jobs?
checkunusedcores=>operation: Check nodes with unused cores
isunusedcores=>condition: Node has unused cores? 
checkmemabuse=>operation: Check node for memory abuse
ismemabuse=>condition: Memory abuse?
alertmemabuse=>subroutine: Queue alert on memory abuse on node to all users running on this node
alertcputunderutil=>subroutine: Queue alert on CPU under-utilization to group system
checkratio=>operation: Check for cputime/walltime ratio for jobs running over 5 minutes
isratio=>condition: Is ratio below .5?
alertratio=>subroutine: Queue alert about under utilized CPU to job owner
checktamirnano4=>operation: Check nano and tamir-short nodes equal to tamir-nano4
istamirnano4=>condition: equal?
alerttamirnano4=>subroutine: Queue alert to system
checkoffline=>operation: Check for offline nodes in tamir-nano4
isoffline=>condition: Offline?
alertoffline=>subroutine: Queue alert to system
checkdisk=>operation: Check access to /tamir1
isdisk=>condition: Ok?
alertdisk=>subroutine: Queue alert to system
checkruntimeoutliers=>operation: Check for jobs that ended too quickly
isruntimeoutliers=>condition: Job Ended too quickly?
alertruntimeoutliers=>subroutine: Queue alert to job owner
aggregatealerts=>operation: aggregate alerts and send alerts every 60 minutes
sleep=>operation: sleep for 10 minutes

st->checkqueued->isqueued
isqueued(yes)->checkunusedcores
isqueued(no)->cputwalltimeratio
checkunusedcores->isunusedcores
isunusedcores(yes)->checkmemabuse
isunusedcores(no)->checkratio
isqueued(no)->checkratio
checkmemabuse->ismemabuse
ismemabuse(yes)->alertmemabuse
ismemabuse(no)->checkratio
alertmemabuse->checkratio->isratio
isratio(no)->checktamirnano4
isratio(yes)->alertratio->checktamirnano4
checktamirnano4->istamirnano4
istamirnano4(yes)->alerttamirnano4->checkoffline
istamirnano4(no)->checkoffline
checkoffline->isoffline
isoffline(yes)->alertoffline->checkdisk
isoffline(no)->checkdisk
checkdisk->isdisk
isdisk(yes)->alertdisk->checkruntimeoutliers
isdisk(no)->checkruntimeoutliers
checkruntimeoutliers->isruntimeoutliers
isruntimeoutliers(yes)->alertruntimeoutliers->aggregatealerts
isruntimeoutliers(no)->aggregatealerts
aggregatealerts->sleep->checkqueued
```