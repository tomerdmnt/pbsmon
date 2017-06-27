PYTHON=python2
PORT=39063

setup:
	$(PYTHON) setup.py install --user	

run:
	nohup pbsmon web -p $(PORT)

.PHONY: setup run
	
