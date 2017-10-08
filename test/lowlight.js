var assert = require('assert'),
    libpath = require('path');

if (!global.Beweging) {
	global.Beweging = require('../index');
}

describe('Low light', function() {
	this.slow(2500);
	this.timeout(0);

	let beweging = new Beweging.Beweging();

	it('should detect people walking by camera in low light', function walkingByLowLight(done) {

		var source = libpath.resolve(__dirname, '..', 'samples', 'dark-stand.h264'),
		    proc   = beweging.detectStream(source),
		    lights = 0,
		    walk   = 0;

		proc.on('motion', function gotMotion(motion) {
			walk++;
		});

		proc.on('light', function gotLights() {
			lights++;
		});

		proc.on('end', function onEnd() {
			assert.equal(walk > 1, true, 'No movement was detected: ' + walk + ' motion events');
			assert.equal(lights, 0, 'Non-existing light changes were detected: ' + lights);
			done();
		});
	});

});