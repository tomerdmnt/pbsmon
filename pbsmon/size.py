import math

class Size():
	def __init__(self, str):
		self._factors =  ('bb', 'kb', 'mb', 'gb')
		size = int(str[:-2])
		mult = str[-2:]
		self._bytes = size*(1024**self._factors.index(mult))

	@classmethod
	def frombytes(cls, bytes):
		return Size('%d%s' % (bytes,'bb'))

	def prettyprint(self):
		i = int(math.floor(math.log(self._bytes, 1024))) if self._bytes > 0 else 1
		i = min(i, 3)
		p = math.pow(1024, i)
		return '%0.1f%s' % (round(self._bytes/p, 1), self._factors[i])
	
	def bytes(self):
		return self._bytes
	
	def __repr__(self):
		return self.prettyprint()

	def __str__(self):
		return self.prettyprint()
	
	def __add__(self, other):
		res = Size.frombytes(self._bytes)
		res._bytes += other._bytes
		return res
