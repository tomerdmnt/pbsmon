#!/usr/bin/env python

from distutils.core import setup

setup(name='pbsmon',
		version='1.0',
		description='PBS monitoring utilities',
		author='Tomer Diament',
		author_email='tomer.dmnt@gmail.com',
		packages=['pbsmon', 'pbsmon/web'],
		package_data={'': ['*.css','*.html','*.js', '*.ico']},
		scripts=['bin/pbsmon']
	 )
