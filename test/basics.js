var assert = require('assert');

describe('Basic behaviour', function() {
	this.slow(500);

	it('should require the Beweging namespace', function() {
		global.Beweging = require('../index');

		assert.equal(typeof Beweging.Beweging, 'function');
	});

});