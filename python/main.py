import numpy as np
from importlib import util
import socket
import time
import json
import sys
import os
import cv2

im_spec = util.find_spec("imutils")

if im_spec:
	import imutils

def convertToNumpy(bytes, width, height, depth):
	return np.array(bytes).reshape((height, width, depth))

def respond(data):
	print(json.dumps(data), flush=True)

def log(message):
	respond({'log': message})

class BasicMotionDetector:
	def __init__(self, accumWeight = 0.5, deltaThresh = 5, minArea = 5000):
		# Determine the OpenCV version, followed by storing the the frame accumulation weight, the fixed threshold for
		# the delta image, and finally the minimum area required for "motion" to be reported

		if im_spec:
			self.isv2 = imutils.is_cv2()
		else:
			self.isv2 = False

		self.accumWeight = accumWeight
		self.deltaThresh = deltaThresh
		self.minArea = minArea

		# Initialize the average image for motion detection
		self.avg = None

	def update(self, image, depth):
		# Initialize the list of locations containing motion
		locs = []

		# Convert the image to gray
		if (depth > 1):
			image = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

		# If the average image is None, initialize it
		if self.avg is None:
			self.avg = image.astype("float")
			return locs

		# Otherwise, find and accumulate the average (weighted) between consecutive frames
		cv2.accumulateWeighted(image, self.avg, self.accumWeight)

		# Compute the pixelwise difference between the current frame and the accumulated average
		frameDelta = cv2.absdiff(image, cv2.convertScaleAbs(self.avg))

		# Threshold the delta image and apply a series of dilations to help fill in holes
		thresh = cv2.threshold(frameDelta, self.deltaThresh, 255, cv2.THRESH_BINARY)[1]
		thresh = cv2.dilate(thresh, None, iterations = 2)

		# Find contours in the thresholded image
		cnts = cv2.findContours(thresh, cv2.RETR_EXTERNAL,
			cv2.CHAIN_APPROX_SIMPLE)
		cnts = cnts[0] if self.isv2 else cnts[1]

		for c in cnts:
			# Add the contour to the locations list if it exceeds the minimum area
			if cv2.contourArea(c) > self.minArea:
				locs.append(c.tolist())

		return locs

# The resolution of the image will go here
width = 0
height = 0
depth = 0
framesize = 0
socketpath = False
sock = False

# Create a new motion detector
motion = BasicMotionDetector()

# Start listening to input commands
while 1:
	line = sys.stdin.readline()
	req = json.loads(line)
	cmd = req.get('command')
	output = {}
	result = {}
	output['id'] = req.get('id')
	output['result'] = result;

	if cmd == 'start':
		width = req.get('width')
		height = req.get('height')
		framesize = req.get('chunk_size', width * height * 3)
		socketpath = req.get('path')
		depth = req.get('depth')
		output['starting'] = True

		respond(output)

		log('Chunksize ' + str(framesize) + ' - ' + str(width) + 'x' + str(height))

		sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)

		log('Connecting to socket at ' + socketpath)

		sock.connect(socketpath)

		packet_count = 0

		while True:
			buf = sock.recv(framesize, socket.MSG_WAITALL)
			packet_count += 1

			if not buf:
				continue

			# Convert the bytes into a numpy image array
			image = convertToNumpy(bytearray(buf), width, height, depth)

			locs = motion.update(image, depth)

			output = {}
			output['locs'] = locs
			respond(output)

	respond(output)
