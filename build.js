#!/usr/bin/env node

var fs = require('fs')
  , path = require('path')
  , lp = path.join.bind(path, __dirname)
  , util = require('util')
  , f = util.format

  , BUSTER_CORE_PATH = 'node_modules/buster-format/node_modules/buster-core/lib/buster-core.js'
  , BUSTER_FORMAT_PATH = 'node_modules/buster-format/lib/buster-format.js'

build();

function build() {
	var version = readFile('package.json').match(/"version":\s+"(.*)"/)[1]
	  , versionString = false ? '' : '-' + version
	  , output = f('pkg/sinon%s.js', versionString)

	if(!fs.existsSync(lp('pkg'))) {
		fs.mkdirSync(lp('pkg'))
	}

	merge(lp('lib/sinon/test_case.js'), lp('lib/sinon/assert.js'))
		.save(lp(output))
	addLicense(addBusterFormat(output), version)

	writeIE(versionString, version)

	cp('lib/sinon/util/fake_timers.js', 'pkg/sinon-timers%s.js', versionString)
	cp('lib/sinon/util/timers_ie.js', 'pkg/sinon-timers-ie%s.js', versionString)

	merge(lp('lib/sinon/util/fake_server_with_clock.js'))
		.save(lp(f('pkg/sinon-server%s.js', versionString)))
	addLicense(f('pkg/sinon-server%s.js', versionString), version)

	cp(output, 'pkg/sinon.js')
	cp(f('pkg/sinon-ie%s.js', versionString), 'pkg/sinon-ie.js')

	console.log('Built Sinon.JS %s', version)
}

function merge() {
	var files = Array.prototype.slice.call(arguments)
	  , content = files.map(readFile).join(';\n')

	function readFile(filename) {
		return fs.readFileSync(filename, 'utf8')
	}

	return { save: function(name) {
		fs.writeFileSync(name, content)
	} }
}

function cp(from, to, version) {
	if(version) {
		to = f(to, version)
	}

	writeFile(to, readFile(from))

	if(version) {
		addLicense(to, version)
	}
}

function writeIE(versionString, version) {
	var content = f(
	      '%s\n%s'
	    , readFile('lib/sinon/util/timers_ie.js')
	    , readFile('lib/sinon/util/xhr_ie.js')
	    )
	  , filename = f('pkg/sinon-ie%s.js', versionString)

	writeFile(filename, content)
	addLicense(filename, version)
}

function addLicense(file, version) {
	var content = readFile(file)
	  , blurp =
'/**\n\
 * Sinon.JS {{version}}, {{now}}\n\
 *\n\
 * @author Christian Johansen (christian@cjohansen.no)\n\
 * @author Contributors: https://github.com/cjohansen/Sinon.JS/blob/master/AUTHORS\n\
 *\n\
 * {{license}}\n\
 */\n\
\n\
"use strict";\n'

	  , tmpl = compile(blurp)
	  , out = tmpl.render(
	      { version: version
	      , license: readFile('LICENSE').trim().split('\n').join('\n * ')
	      , now: formatDate()
	      }
	    )

	writeFile(file, out + content.replace('"use strict";', ''))

	return file
}

function addBusterFormat(file) {
	var format =
'var sinon = (function () {\n\
%s\n\
%s\n\
%s\n\
return sinon;}.call(typeof window != \'undefined\' && window || {}));\n'

	  , busterCore = readFile(BUSTER_CORE_PATH)
	  , busterFormat = readFile(BUSTER_FORMAT_PATH).replace('var buster = this.buster || {};', '')
	  , content = readFile(file)
	  , out = f(format, busterCore, busterFormat, content)

	writeFile(file, out)

	return file
}

function formatDate() {
	var now = new Date()

	return f('%s/%s/%s'
	       , now.getFullYear()
	       , pad(now.getMonth()+1)
	       , pad(now.getDate()))

	function pad(num) {
		return (num < 10 ? '0' : '') + num
	}
}

function compile(text) {
	return {
		render: render
	}

	function render(obj) {
		return text.replace(/\{\{(.+?)\}\}/g, function(match, key) {
			return obj[key];
		});
	}
}

/**
 * Reads and returns the file
 *
 * ASSUMPTIONS:
 * - path is relative to current dir
 * - file is encoded in utf-8
 */
function readFile(file) {
	return fs.readFileSync(lp(file), 'utf8')
}

/**
 * Writes the file
 *
 * ASSUMPTIONS:
 * - path is relative to current dir
 */
function writeFile(file, content) {
	return fs.writeFileSync(lp(file), content)
}
