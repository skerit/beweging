const Blast    = __Protoblast;
const Fn       = Blast.Bound.Function;
const Beweging = Fn.getNamespace('Develry.Beweging');

/**
 * The Calculator class
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
let Calculator = Fn.inherits('Informer', 'Develry.Beweging', function Calculator() {

	// Array where the values are stored
	this.values = [];

	// Array where the values are stored in reverse order
	this.reverse_values = [];

});

/**
 * Default number of values to keep
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 *
 * @type     {Number}
 */
Calculator.setProperty('values_to_keep', 25);

/**
 * Value caster
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
Calculator.setMethod(function cast(value) {
	return Number(value);
});

/**
 * Add new value
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
Calculator.setMethod(function add(value) {

	var count;

	value = this.cast(value);

	count = this.values.unshift(value);
	this.reverse_values.push(value);

	if (count > this.values_to_keep) {
		this.values.pop();
		this.reverse_values.shift();
	}
});

/**
 * Get a value by its index (0 = last added)
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
Calculator.setMethod(function getValue(index) {
	return this.values[index];
});

/**
 * Get consecutive sameness
 * (1 = 2 frames the same, 2 = 3 frames, ...)
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
Calculator.setMethod(function getSameness() {

	var result = 0,
	    prev = this.values[0],
	    i;

	for (i = 1; i < this.values.length; i++) {
		if (prev == this.values[i]) {
			result++;
			prev = this.values[i];
		} else {
			break;
		}
	}

	return result;
});

/**
 * Are we in a trend?
 *
 * @author   Jelle De Loecker <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
Calculator.setMethod(function getTrend(amount) {

	var passed,
	    result = 0,
	    down,
	    diff,
	    prev,
	    val,
	    up,
	    i;

	if (this.reverse_values.length < 1) {
		return 0;
	}

	down = 0;
	up = 0;
	let x = [];
	let t = [];

	if (amount == null) {
		amount = 3;
	}

	// Apply lowpass filter to the values
	passed = Blast.Bound.Math.lowpass(this.reverse_values, 0.7).slice(-1 - amount);

	for (i = 1; i < passed.length; i++) {
		prev = ~~(passed[i - 1] / 15) * 15;
		val = ~~(passed[i] / 15) * 15;

		x.push(val);

		if (val < prev) {
			down++;
			t.push(-1);
		} else if (val > prev) {
			up++;
			t.push(1);
		} else {
			t.push(0);
		}
	}

	// console.log('')
	// console.log(x);
	// console.log(t);
	// console.log('--')

	return t[t.length - 1] || 0;
});