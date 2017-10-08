var assert = require('assert'),
    libpath = require('path');

if (!global.Beweging) {
	global.Beweging = require('../index');
}

describe('Lights', function() {
	this.slow(2500);
	this.timeout(0);

	let beweging = new Beweging.Beweging();

	it('should not emit motion when lights go on', function lightOn(done) {

		var source = libpath.resolve(__dirname, '..', 'samples', 'dark-light.h264'),
		    proc   = beweging.detectStream(source),
		    lights = 0;

		// At 3FPS: 3 events of (86,139) - (87,199) - (126,287) locs
		proc.on('motion', function gotMotion(motion) {
			throw new Error('Light was detected as motion');
		});

		proc.on('light', function gotLights() {
			lights++;
		});

		proc.on('end', function onEnd() {
			assert.equal(lights > 2, true, 'No lights were detected');
			done();
		});
	});

	it('should not emit motion when lights go off', function lightOn(done) {

		var source = libpath.resolve(__dirname, '..', 'samples', 'light-dark.h264'),
		    proc   = beweging.detectStream(source),
		    lights = 0;

		// At 3FPS: 3 events of (86,139) - (87,199) - (126,287) locs
		proc.on('motion', function gotMotion(motion) {
			throw new Error('Light was detected as motion');
		});

		proc.on('light', function gotLights() {
			lights++;
		});

		proc.on('end', function onEnd() {
			assert.equal(lights > 2, true, 'No lights were detected');
			done();
		});
	});
});