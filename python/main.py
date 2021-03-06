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

	# accumWeight : The floating point value used for the taking the weighted
	#               average between the current frame and the previous set of
	#               frames. A larger accumWeight  will result in the background
	#               model having less “memory” and quickly “forgetting” what
	#               previous frames looked like
	# deltaThresh : Smaller values will detect more motion
	def __init__(self, accumWeight = 0.7, deltaThresh = 6, minArea = 5000):
		# Determine the OpenCV version, followed by storing the the frame accumulation weight, the fixed threshold for
		# the delta image, and finally the minimum area required for "motion" to be reported

		if im_spec:
			self.isv2 = imutils.is_cv2()
		else:
			self.isv2 = False

		self.accumWeight = accumWeight
		self.deltaThresh = deltaThresh
		self.minArea = minArea

		self.count = 0

		# Initialize the average image for motion detection
		self.avg = None

	def update(self, image, depth):
		# Initialize the list of locations containing motion
		locs = []
		rlocs = []
		rects = []

		result = {
			'locs'  : rlocs,
			'rects' : rects
		}

		self.count += 1

		# Convert the image to gray
		if (depth > 1):
			image = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

		# Calculate the average of the image,
		# because it's grayscale it's a lightness-kind of average
		average = np.average(image)
		result['average'] = average

		# Blur the image slightly to reduce high frequency noise
		# This should be done using ffmpeg
		#image = cv2.GaussianBlur(image, (21, 21), 0)

		# If the average image is None, initialize it
		if self.avg is None:
			self.avg = image.astype("float")
			return result

		# If the image is too dark, apply an equilizer
		if average < 60:
			# Simple equilizer
			#image = cv2.equalizeHist(image)

			# Adaptive histogram equilization
			clahe = cv2.createCLAHE(clipLimit=15.0, tileGridSize=(8,8))
			image = clahe.apply(image)

			#cv2.namedWindow('cimage', cv2.WINDOW_NORMAL)
			#cv2.imshow('cimage', image)
			#cv2.waitKey(0)

		# Otherwise, find and accumulate the average (weighted) between consecutive frames
		cv2.accumulateWeighted(image, self.avg, self.accumWeight)

		# Let it accummulate 8 frames for the weighted average
		if (self.count < 8):
			return result

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
				locs.append(c)

		if len(locs) > 0:
			# initialize the minimum and maximum (x, y)-coordinates,
			# respectively
			(minX, minY) = (np.inf, np.inf)
			(maxX, maxY) = (-np.inf, -np.inf)

			# loop over the locations of motion and accumulate the
			# minimum and maximum locations of the bounding boxes
			for l in locs:
				rlocs.append(len(l))
				(x, y, w, h) = cv2.boundingRect(l)
				(minX, maxX) = (min(minX, x), max(maxX, x + w))
				(minY, maxY) = (min(minY, y), max(maxY, y + h))

				rects.append({
					'sx' : minX,
					'dx' : maxX,
					'sy' : minY,
					'dy' : maxY
				})

			#np.average(image, axis=0)

		return result

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

			output = motion.update(image, depth)

			respond(output)

	respond(output)
