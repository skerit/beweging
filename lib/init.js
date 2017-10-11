var libpath = require('path'),
    fs = require('fs'),
    old_blast,
    files,
    i;

// Store old protoblast version
if (typeof __Protoblast != 'undefined') {
	old_blast = __Protoblast;
}

global.__Protoblast = require('protoblast')(false);

// Require protoblast (without native mods) if it isn't loaded yet

// Get the Beweging namespace
const Beweging = __Protoblast.Bound.Function.getNamespace('Develry.Beweging');

// Require the main files
require('./beweging');
require('./calculator');
require('./python_process');

// If there was another protoblast version, restore it
if (old_blast) {
	global.__Protoblast = old_blast;
}

module.exports = Beweging;