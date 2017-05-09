import sys, os
path = os.path.abspath(__file__)
dir_path = os.path.dirname(path)
sys.path.append(dir_path)
print(path)
print(dir_path)
