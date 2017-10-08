const Blast    = __Protoblast;
const Fn       = Blast.Bound.Function;
const fs       = require('fs');
const net      = require('net');
const Beweging = Fn.getNamespace('Develry.Beweging');
const child_process = require('child_process');
const libpath       = require('path');
var   instance_nr   = 0;

/**
 * The PythonProcess class
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
let Proc = Fn.inherits('Informer', 'Develry.Beweging', function PythonProcess(parent) {

	// Store link to the parent Beweging instance
	this.parent = parent;

	// Create callback listeners
	this.callbacks = {};

	// Create a queue
	this.queue = Fn.createQueue({enabled: true, limit: 1});

	// Store the instance nr
	this.id = ++instance_nr;

	// Actual motion events
	this.motion_count = 0;

	// Actual "jitter"
	this.jitter_count = 0;

	// Consecutive jitter
	this.consecutive_jitter = 0;

	// Consecutive stillness
	this.consecutive_stillness = 0;

	// Start the python process
	this.initProcess();
});

/**
 * Init the process
 *
 * @author    Jelle De Loecker   <jelle@develry.be>
 * @since     0.1.0
 * @version   0.1.0
 */
Proc.setMethod(function initProcess() {

	var that = this;

	if (this._inited) {
		return;
	}

	this._inited = true;

	let path = libpath.resolve(__dirname, '../python/main.py');

	// Create the actual instance
	this.proc = child_process.spawn(this.parent.options.python, ['-u', path]);

	// Make the outputs return text
	this.proc.stderr.setEncoding('utf8');
	this.proc.stdout.setEncoding('utf8');

	// Remember previous unfinished pieces
	let previous_chunk = null;

	// Listen for JSON responses
	this.proc.stdout.on('data', function onOut(chunk) {

		var callback,
		    pieces,
		    piece,
		    data,
		    i;

		if (previous_chunk) {
			chunk = previous_chunk + chunk;
			previous_chunk = null;
		}

		chunk = chunk.trim();

		if (!chunk) {
			return;
		}

		pieces = chunk.split('\n');

		for (i = 0; i < pieces.length; i++) {
			piece = pieces[i];

			try {
				data = JSON.parse(piece);
			} catch (err) {
				previous_chunk = piece;
				return;
			}

			if (data.id && that.callbacks[data.id]) {

				if (data.error) {
					that.callbacks[data.id](data.error);
				} else {
					that.callbacks[data.id](null, data.result);
				}

				delete that.callbacks[data.id];
			} else if (data.log) {
				//console.log('Python log:', data.log);
			} else if (data.locs) {
				that.emit('locs', data);
			}
		}
	});

	// Listen for errors
	this.proc.stderr.on('data', function onErr(chunk) {
		that.emit('error', String(chunk));
	});
});

/**
 * Send message to the process
 *
 * @author    Jelle De Loecker   <jelle@develry.be>
 * @since     0.1.0
 * @version   0.1.0
 *
 * @param     {String}   cmd
 * @param     {Object}   payload
 * @param     {Function} callback
 */
Proc.setMethod(function send(cmd, payload, callback) {

	var that = this,
	    data,
	    id = Blast.Classes.Crypto.uid();

	if (typeof callback == 'function') {
		this.callbacks[id] = callback;
	}

	data = Blast.Bound.Object.assign({}, payload, {
		command : cmd,
		id      : id
	});

	// Send it to the python process
	this.proc.stdin.write(JSON.stringify(data) + '\n');
});

/**
 * Process locs
 *
 * @author    Jelle De Loecker   <jelle@develry.be>
 * @since     0.1.0
 * @version   0.1.0
 *
 * @param     {Object}   data
 */
Proc.setMethod(function processLocs(data) {

	var zero_coordinates = 0,
	    certainty = 0,
	    stillness,
	    jitter,
	    rect,
	    co,
	    i;

	// Emit it as jitter
	this.emit('jitter', data);

	// Get the consecutive jitter (1 = first jitter)
	jitter = this.consecutive_jitter;

	// If there were a few frames of non-motion, assume it's the same event
	if (jitter < 2 && this.consecutive_stillness < 3 && this.previous_jitter) {
		jitter += this.previous_jitter;
		this.consecutive_jitter += this.previous_jitter;
	}

	// Accept 2 consecutive frames as movement?
	if (jitter > 1) {
		data.consecutive_jitter = this.consecutive_jitter;

		if (jitter == 2) {
			this.emit('motion_start', data);
		}

		this.emit('motion', data);

		return;
	}

	// Detect "zero coordinates",
	// indicating it might be a big light change
	for (i = 0; i < data.rects.length; i++) {
		rect = data.rects[i];

		for (co in rect) {
			if (rect[co] === 0) {
				zero_coordinates++;
			}
		}
	}

	if (zero_coordinates > 0) {
		if (this.consecutive_jitter) {
			this.consecutive_jitter--;
		}

		this.emit('light', data);
	}
});

/**
 * Send stream
 *
 * @author    Jelle De Loecker   <jelle@develry.be>
 * @since     0.1.0
 * @version   0.1.0
 *
 * @param     {ChunkedStream}   stream
 */
Proc.setMethod(function sendStream(stream, callback) {

	var that = this,
	    last_sent_frame,
	    last_timestamp,
	    motion_count = 0,
	    frame_count = 0,
	    video_info,
	    queue_done,
	    chunk_size,
	    sent_count = 0,
	    client,
	    server,
	    height,
	    width,
	    id;

	if (this._sent_stream) {
		return callback(new Error('Already processing stream'));
	}

	// Indicate we already have a stream
	this._sent_stream = stream;

	// Let the stream flow
	stream.resume();

	// Create the id
	id = '/tmp/beweging_stream_' + Blast.Classes.Crypto.uid();

	server = net.createServer(function onConnection(new_client) {
		if (!client) {
			client = new_client;
		}
	});

	stream.on('data', function onData(chunk) {

		frame_count++;

		if (client == null) {
			return;
		}

		if (that.python_is_waiting) {
			that.python_is_waiting = false;
			last_sent_frame = frame_count;
			last_timestamp = Date.now();
			sent_count++;
			client.write(chunk);
		}
	});

	stream.on('end', function onEnd() {
		that.proc.kill();
		that.emit('end');
	});

	this.on('locs', function onLocs(data) {

		// Changes were detected!
		if (data.rects.length) {

			// Remember the previous stillness count
			if (that.consecutive_stillness) {
				that.previous_stillness = that.consecutive_stillness;
			}

			// Reset the stillness count
			that.consecutive_stillness = 0;

			// Increment the jitter
			that.consecutive_jitter++;

			// Always increment the jitter count
			that.jitter_count++;

			// The jitter count
			data.jitter_count = this.jitter_count;

			// The timestamp when the motion was found
			data.timestamp = last_timestamp;

			// The frame that was sent
			data.frame = last_sent_frame;

			that.processLocs(data);
		} else {
			if (that.consecutive_jitter > 0) {
				that.previous_jitter = that.consecutive_jitter;
			}

			that.consecutive_jitter = 0;
			that.consecutive_stillness++;

			if (that.consecutive_stillness == 3) {
				that.emit('motion_end');
			}
		}

		that.python_is_waiting = true;
	});

	Fn.parallel(false, function makeServerListen(next) {
		server.listen(id, next);
	}, function getChunkSize(next) {
		stream.probeValue('chunk_size', function gotSize(err, info) {

			if (err) {
				return next(err);
			}

			video_info = info;
			chunk_size = info.chunk_size;
			width = info.width;
			height = info.height;
			next();
		});
	}, function done(err) {

		if (err) {
			return callback(err);
		}

		let start = Date.now();

		let payload = {
			path        : id,
			width       : width,
			height      : height,
			depth       : video_info.depth,
			chunk_size  : chunk_size
		};

		that.send('start', payload, function gotResult(err, result) {

			if (err) {
				return callback(err);
			}

			// Indicate python is waiting for us
			that.python_is_waiting = true;

			// Add the time it took to process the stream
			result.duration = Date.now() - start;

			callback(null, result);
		});
	});
});

/**
 * Destroy the process & streams
 *
 * @author    Jelle De Loecker   <jelle@develry.be>
 * @since     0.1.0
 * @version   0.1.0
 */
Proc.setMethod(function destroy() {

	if (this._sent_stream) {
		this._sent_stream.destroy();
	}

	this.proc.kill();
});