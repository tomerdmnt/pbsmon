import os
import multiprocessing

def stat(path, res):
	try:
		os.stat(path)
	except:
		res.value = False
	res.value = True

def checknfs(path):
	# first check stat, if stale
	res = multiprocessing.Value('i', False)
	p = multiprocessing.Process(target=stat, args=(path, res))
	p.start()

	# Wait for 10 seconds or until process finishes
	p.join(10)
	if p.is_alive():
		p.terminate()
		p.join()
		return False
	if res.value == False:
		return False
	# check if actually mounted
	return os.path.ismount(path)


