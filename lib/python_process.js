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
				console.log('Python log:', data.log);
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
			sent_count++;
			client.write(chunk);
		}
	});

	this.on('locs', function onLocs(data) {

		if (data.locs.length) {
			motion_count++;
			that.emit('motion', data, last_sent_frame, motion_count);
			console.log('Found motion on frame', last_sent_frame, 'Total count:', motion_count);
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