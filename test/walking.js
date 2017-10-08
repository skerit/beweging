var assert = require('assert'),
    libpath = require('path');

if (!global.Beweging) {
	global.Beweging = require('../index');
}

describe('Walking', function() {
	this.slow(2500);
	this.timeout(0);

	let beweging = new Beweging.Beweging();

	it('should detect people walking by camera', function walkingBy(done) {

		var source = libpath.resolve(__dirname, '..', 'samples', 'walking-by.h264'),
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

	it('should detect people walking towards camera', function walkingTo(done) {

		var source = libpath.resolve(__dirname, '..', 'samples', 'walking-to.h264'),
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
			assert.equal(walk > 2, true, 'No movement was detected');
			assert.equal(lights, 0, 'Non-existing light changes were detected');
			done();
		});
	});

});