#!/usr/bin/env node

var fs = require('fs')
  , path = require('path')
  , lp = path.join.bind(path, __dirname)
  , util = require('util')
  , f = util.format

  , BUSTER_CORE_PATH = 'node_modules/buster-format/node_modules/buster-core/lib/buster-core.js'
  , BUSTER_FORMAT_PATH = 'node_modules/buster-format/lib/buster-format.js'

build()

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

	cp('lib/sinon/util/fake_timers.js', 'pkg/sinon-timers%s.js', versionString, version)
	cp('lib/sinon/util/timers_ie.js', 'pkg/sinon-timers-ie%s.js', versionString, version)

	merge(lp('lib/sinon/util/fake_server_with_clock.js'))
		.save(lp(f('pkg/sinon-server%s.js', versionString)))
	addLicense(f('pkg/sinon-server%s.js', versionString), version)

	cp(output, 'pkg/sinon.js')
	cp(f('pkg/sinon-ie%s.js', versionString), 'pkg/sinon-ie.js')

	console.log('Built Sinon.JS %s', version)
}

function merge() {
	var files = Array.prototype.slice.call(arguments)
	  , content = files
	      .map(resolveDependencies)
	      .reduce(flatten, [])
	      .filter(uniq)
	      .map(readFile)
	      .join('\n')
	      + '\n'

	return {
		save: function(name) {
			fs.writeFileSync(name, content)
		}
	}

	function uniq(filename) {
		var used = uniq.used || {}

		if(used[filename]) {
			return false
		}

		used[filename] = true
		uniq.used = used

		return true;
	}

	function readFile(filename) {
		return fs.readFileSync(filename, 'utf8')
	}
}

function cp(from, to, versionString, version) {
	if(versionString) {
		to = f(to, versionString)
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

	writeFile(file, out + content.replace(/"use strict";\n/g, ''))

	return file
}

function addBusterFormat(file) {
	var format =
'var sinon = (function () {\n\
%s\
%s\
%s\
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
			return obj[key]
		})
	}
}

/**
 * Takes a filename (fully qualified) and returns a list of dependencies
 * for that file.
 *
 * The given file will be the last in the returned array.
 *
 * If any of the dependencies have dependencies, they will also be added.
 */
function resolveDependencies(filename) {
	var contents = fs.readFileSync(filename, 'utf8')
	  , base = path.dirname(filename)
	  , lines = contents.split(/\r?\n/g)
	  , files = []
	  , dependencyChecker = /@depends?\s+([^\s'";]+)/

	lines.some(function(line) {
		var dep = line.match(dependencyChecker)

		if(dep) {
			files.push(dep[1])
		}

		return line.indexOf('*/') > -1
	})

	return files
		.map(function(file) {
			return resolveDependencies(path.join(base, file))
		})
		.concat(filename)
		.reduce(flatten, [])
}

function flatten(array, file) {
	return array.concat(file)
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
