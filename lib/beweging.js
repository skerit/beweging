const Blast    = __Protoblast;
const Fn       = Blast.Bound.Function;
const fs       = require('fs');
const Beweging = Fn.getNamespace('Develry.Beweging');
const MC       = require('mediaconversion');

/**
 * The main Beweging class
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
let BewegingClass = Fn.inherits('Informer', 'Develry.Beweging', function Beweging(options) {

	var i;

	// All the available instances
	this.instances = [];

	// Set the options
	this.options = Blast.Bound.Object.assign({}, this.default_options, options);

	for (i = 0; i < this.options.min_instance_count; i++) {
		this.createInstance();
	}
});

/**
 * Set default options
 *
 * @author    Jelle De Loecker   <jelle@develry.be>
 * @since     0.1.0
 * @version   0.1.0
 */
BewegingClass.setProperty('default_options', {
	python              : 'python3',
	min_instance_count  : 1,
	max_instance_count  : 4
});

/**
 * Create an instance
 *
 * @author    Jelle De Loecker   <jelle@develry.be>
 * @since     0.1.0
 * @version   0.1.0
 */
BewegingClass.setMethod(function createInstance() {

	var proc = new Beweging.PythonProcess(this);

	this.instances.push(proc);

	return proc;
});

/**
 * Detect movement in a stream
 *
 * @author    Jelle De Loecker   <jelle@develry.be>
 * @since     0.1.0
 * @version   0.1.0
 */
BewegingClass.setMethod(function detectStream(stream, blur) {

	var that = this,
	    output,
	    input,
	    conv;

	if (blur == null) {
		blur = 10;
	}

	// Create new conversion object
	conv = new MC.MediaConversion();

	// Set the input stream
	input = conv.addInput(stream);

	// Get the (grayscale) output stream
	output = conv.getRawFramesOutput('gray');

	// Apply some blur
	if (blur) {
		output.setFilter('boxblur', blur + ':1');
	}

	// Start the conversion
	conv.start();

	return this.detectRawStream(output);
});

/**
 * Detect movement in a raw stream
 *
 * @author    Jelle De Loecker   <jelle@develry.be>
 * @since     0.1.0
 * @version   0.1.0
 */
BewegingClass.setMethod(function detectRawStream(stream) {

	var that = this,
	    proc = this.createInstance();

	proc.sendStream(stream, function sendStream(err, result) {
		if (err) {
			that.emit('error', err);
		}
	});

	return proc;
});