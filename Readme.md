
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
              
              {ls,queues,cpuutil,memutil,walltime0,cputime,runtime-outliers,memabuse,monitor,web,checknfs}
              ...

commands:
  {ls,queues,cpuutil,memutil,walltime0,cputime,runtime-outliers,memabuse,monitor,web,checknfs}
    ls                  List clusters and nodes in cluster
    queues              List queues in cluster
    cpuutil             Display cluster's CPU utilization
    memutil             Display cluster's Memory utilization
    walltime0           List running jobs with walltime 0
    cputime             List running jobs low cputime
    runtime-outliers    List jobs with unlikely runtime
    memabuse            List servers with memory abuse
    monitor             monitor simulation
    web                 web monitor
    checknfs            check an nfs mount is up

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

### pbsmon cputime
List running jobs low cputime, i.e. find jobs with a ratio between walltime and cputime lower than k.
k defaults to .5

```
$ pbsmon cputime -k .2
4231056.power8.tau.ac.il              02:05:27 / 908:09:22       zurhadas2 
4374513.power8.tau.ac.il              05:27:45 / 496:23:16       mich1     
4580742.power8.tau.ac.il              04:14:27 / 185:15:01       mich1     
4912946.power8.tau.ac.il              00:01:04 / 00:38:50        renanaco  
4229855.power8.tau.ac.il              01:57:57 / 953:43:57       zurhadas2 
4345069.power8.tau.ac.il              01:04:29 / 528:58:27       zurhadas2 
4384536.power8.tau.ac.il              00:00:07 / 435:11:40       okushnir  
4384634.power8.tau.ac.il              01:06:27 / 431:29:52       okushnir  
4415841.power8.tau.ac.il              09:24:48 / 382:05:39       zoharzaf  
4417436.power8.tau.ac.il              02:40:16 / 360:28:58       shimshi   
4569304.power8.tau.ac.il              02:53:31 / 241:28:10       zoharzaf  
4595657.power8.tau.ac.il              00:07:02 / 164:37:34       zurhadas2 
```

### pbsmon memabuse
List servers with memory abuse. memory abuse occurs when jobs on a certain node takes enough memory so that
the server won't be able to run jobs on all of its cpus during a load, because the memory will become the
limiting factor

```
$ pbsmon memabuse
compute-0-80        5 jobs   251.9gb/252.4gb    talimc,renanaco
compute-0-211       23 jobs    61.5gb/62.3gb     zurhadas2,xpxu2010,mich1,renanaco
compute-0-214       1 jobs   248.0gb/248.0gb    talimc
```

### pbsmon checknfs
check an nfs mount is up.

```
$pbsmon checknfs /tamir
/tamir is down
$ pbsmon checknfs /tamir1
/tamir1 is up
```

### pbsmon web
Starts the web monitoring application.

If no port is included, a port is chosen by the system

```
$ pbsmon web tamir-nano4
```

However you can choose a specific port

```
$ pbsmon web -p 39063 tamir-nano4
```

The apache server maps /tamir on power8 server to port 39063 using these lines in /etc/httpd/conf/httpd.conf:
```
ProxyPassMatch    ^/tamir http://power8.tau.ac.il:39063/
ProxyPassReverse  ^/tamir http://power8.tau.ac.il:39063/
```

To start the server and disconnect it from the current ssh session, i.e. we use the nohup unix utility:
```
nohup pbsmon web -p 39063 tamir-nano4 &
```

So if the server is down, this command should be ran.

## monitoring daemon (alerts)

The monitoring daemon runs indefinitely and monitors for the system's health. the alerts can be viewed in the web monitoring page under alerts.

### Types of alerts

#### memabuse

Only while there are queued jobs waiting to be run, issues a warning for each user on each node that has unused cores, but not enough
memory to run another job

```
memory abuse (unused cores) on node <hostname>, memory usage: <memory used>/<memory available>, average job memory: <avg job mem>
```

#### low cputime

Warning for each job when its cputime is less than half of its walltime

```
job <job id> has low cputime <cputime> / <walltime>
```

#### nfs

Checks /tamir1 is mounted on power8

```
/tamir1 is stale or unmounted
```

#### nano + tamir-short = tamir-nano4

```
<node name> in tamir-nano4 and not in nano or tamir-short
<node name> in nano4 and not in tamir-nano4
<node name> in tamir-short and not in tamir-nano4
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

```python
>>> from pbsmon import getqueues
>>>
>>> getqueues('tamir-nano4')
...
```

