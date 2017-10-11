var assert = require('assert'),
    libpath = require('path');

if (!global.Beweging) {
	global.Beweging = require('../index');
}

describe('Lights', function() {
	this.slow(2500);
	this.timeout(0);

	let beweging = new Beweging.Beweging();

	it('should not emit motion when lights go out after movement', function lightoutAfterMotion(done) {

		var source = libpath.resolve(__dirname, '..', 'samples', 'lightout-after-movement.h264'),
		    proc,
		    lights = 0,
		    movement = 0,
		    motion_end = 0,
		    first_movement = null,
		    last_movement = null,
		    first_light = null,
		    last_light = null;

		proc = beweging.detectStream(source);

		proc.on('motion', function gotMotion(motion) {
			if (first_movement == null) {
				first_movement = motion.frame;
			} else {
				last_movement = motion.frame;
			}
			movement++;
			//console.log('Motion on frame', motion.frame, 'Lightness:', ~~motion.average);
			//throw new Error('Light was detected as motion');
		});

		proc.on('light', function gotLights(jitter) {
			if (first_light == null) {
				first_light = jitter.frame;
			} else {
				last_light = jitter.frame;
			}

			lights++;
		});

		proc.on('motion_end', function gotEnd(end) {
			motion_end++;
		});

		proc.on('end', function onEnd() {
			assert.equal(movement > 0, true, 'No movement was detected');
			assert.equal(first_movement > 40 && first_movement < 45, true, 'First movement was not when expected. Should be around frame 40, but was: ' + first_movement);
			assert.equal(last_movement < 85, true, 'Last movement was not when expected. Should be before frame 85, but was: ' + last_movement);
			assert.equal(motion_end > 0, true, 'No motion_end event was emitted');

			// The first light event is actually just after the first movement event (when the door opens, the light goes on)
			// but by 'lights' we actually mean 'only lights', so ...
			assert.equal(first_light > 85, true, 'First light should have been after frame 85, but was ' + first_light);
			assert.equal(lights > 2, true, 'No lights were detected');
			done();
		});
	});

	it('should not emit motion when lights alternate from light to dark', function lightOn(done) {

		var source = libpath.resolve(__dirname, '..', 'samples', 'alternating-light2.h264'),
		    proc,
		    lights = 0;

		proc = beweging.detectStream(source);

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

	it('should not emit motion when lights alternate from dark to light', function lightOn(done) {

		var source = libpath.resolve(__dirname, '..', 'samples', 'alternating-light.h264'),
		    proc   = beweging.detectStream(source),
		    lights = 0;

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

	it('should not emit motion when lights go on from full darkness', function lightOn(done) {

		var source = libpath.resolve(__dirname, '..', 'samples', 'total-darkness-to-light.h264'),
		    proc   = beweging.detectStream(source),
		    lights = 0;

		proc.on('motion', function gotMotion(motion) {
			throw new Error('Light was detected as motion');
		});

		proc.on('light', function gotLights() {
			lights++;
		});

		proc.on('end', function onEnd() {
			assert.equal(lights > 0, true, 'No lights were detected, expected: ' + lights);
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