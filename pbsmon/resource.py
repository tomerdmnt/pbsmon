
from size import Size
from datetime import datetime, timedelta
import re

class Resource(dict):
	def __setitem__(self, key, val):
		return super(Resource, self).__setitem__(key.lower(), val)
	
	def __getitem__(self, key):
		return super(Resource, self).__getitem__(key.lower())

	def get(self, key, default=None):
		return super(Resource, self).get(key.lower(), default)

	def find(self, substr):
		fields = {}
		for key in self:
			if key.find(substr) != -1:
				fields[key] = self[key]
		return fields

def parsetimedelta(val):
	val = [int(x) for x in val.split(':')]
	return timedelta(hours=val[0], minutes=val[1], seconds=val[2])

def parsedatetime(val):
	return datetime.strptime(val, '%a %b %d %H:%M:%S %Y')

def parsesize(val):
	return Size(val)

def parselist(val):
	return [v.strip() for v in val.split(',')]
	
_parsers = [
	(re.compile('^\d+(kb|mb|gb)$'), parsesize),
	(re.compile('^\w{3} \w{3} +\d{1,2} \d{2}:\d{2}:\d{2} \d{4}$'), parsedatetime),
	(re.compile('^\d{0,6}:\d{2}:\d{2}$'), parsetimedelta),
	(re.compile('^\d+$'), int),
	(re.compile('^(True|False)$'), bool),
	(re.compile('^([a-zA-Z0-9_-]+,)+[a-zA-Z0-9_-]+$'), parselist),
]

def findparser(val):
	for p in _parsers:
		if p[0].match(val):
			return p[1]
	return lambda val: val
