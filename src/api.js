var    xml2object = require('xml2object'),
	http = require('http'),
	https = require('https'),
	csv = require('csv'),
	domain = require('domain'),
	Q = require('q');

var API = function(params) {
	params = params || {};

	this.hostname = params.hostname;
	this.secure   = params.secure || false;
	this.port     = params.port || (this.secure?443:80);
	this.format   = params.format || 'json';
	this.method   = params.method || 'GET';
	this.base     = params.base || '/';
	this.cache    = params.cache || false;
    this.root     = params.root || ['body'];
    this.debug    = params.debug || false;

	this.urlTransform = params.urlTransform;
	this.resultTransform = params.resultTransform;
};

API.FORMAT = {
	RAW: 'raw',
	XML: 'xml',
	JSON: 'json',
	CSV: 'csv',
	CSV_HEADER: 'csv_header'
};

function is(type, obj) {
    var clas = Object.prototype.toString.call(obj).slice(8, -1);
    return obj !== undefined && obj !== null && clas === type;
}

API.prototype.send = function(path, data, format) {
	var d = domain.create(),
		deferred = Q.defer(),
		that = this;

	d.on('error', function(err) {
		console.log("Unable to process response from API " + err.message)

		deferred.reject("Error when processing response" + err.message);
	});

	d.run(function() {
		format = format || that.format;

		var url = that.base + path;
		if (that.urlTransform !== undefined) {
			url = that.urlTransform(url);
		}

		var options = {
		  host: that.hostname,
		  port: that.port,
		  path: url,
		  method: 'POST'
		};

		if (that.debug) {
			console.log(options);
		}

		var mode = http;

		if (that.secure)
			mode = https;

		var req = mode.request(options, function(res) {
			that.parseResponse(res, deferred, format);
		});

		req.on('error', function(e) {
			deferred.reject('problem with request: ' + e.message);
		});

		req.write(data + "\n");

		req.end();
	});

	return deferred.promise;
};

API.prototype.call = function(path, params, format) {
	var d = domain.create(),
		deferred = Q.defer(),
		that = this;

	d.on('error', function(err) {
		deferred.reject("Error when processing response" + err.message);
	});

	d.run(function() {
		if (typeof path !== "string") {
			format = params;
			params = path;
			path = "";
		}

		if (typeof params === "string") {
			format = params;
			params = undefined;
		}

		var paramStr = [],
			value;

		if (params) for (var key in params) if (params.hasOwnProperty(key)) {
			value = params[key];
			if (is("Array", value)) {
				for (var i=0;i<value.length;i++) {
					paramStr.push(key + "=" + encodeURIComponent(value[i]));
				}
			} else {
				paramStr.push(key + "=" + encodeURIComponent(value));
			}
		}

		var query = (paramStr.length>0?"?":"") + paramStr.join("&");

		format = format || that.format;

		var url = that.base + path + query;
		if (that.urlTransform !== undefined) {
			url = that.urlTransform(url);
		}

		var options = {
		  host: that.hostname,
		  port: that.port,
		  path: url,
		  method: that.method
		};
        
        if (format === API.FORMAT.JSON) {
            options.headers = {
                "Accept": "application/json,*/*;q=0.8"
            }
        } else if (format === API.FORMAT.XML) {
            options.headers = {
                "Accept": "application/xml,*/*;q=0.8"
            }
        }

		if (that.debug) {
			console.log(options);
		}

		var mode = http;

		if (that.secure)
			mode = https;

		var req = mode.request(options, function(res) {
			that.parseResponse(res, deferred, format);
		});

		req.on('error', function(e) {
			deferred.reject('problem with request: ' + e.message);
		});

		req.end();

	});

	return deferred.promise;
};


function processCSV(header, records) {
	var output = [],
		obj,
		record,
		i,
		l;

	while (records.length > 0) {
		obj = {};
		record = records.shift();

		for (i=0, l=record.length; i<l; i++) {
			obj[header[i]] = record[i];
		}

		output.push(obj);
	}

	return output;
}

API.prototype.parseResponse = function(res, deferred, format) {
	if (format === API.FORMAT.XML) {
		var parser = new xml2object(this.root, res);
		var data = {};

		parser.on('object', function(name, obj) {
			data[name] = obj;
		});

		parser.on('end', function() {
			deferred.resolve(data);
		});

		parser.start();

	} else if (format === API.FORMAT.CSV || format === API.FORMAT.CSV_HEADER) {
		var header,
			records = [];

		csv()
			.from.stream(res)
			.on('record', function(record) {
				if (format === API.FORMAT.CSV_HEADER && header === undefined)
					header = record;
				else
					records.push(record);
			})
			.on('end', function() {
				if (header)
					records = processCSV(header, records);
				deferred.resolve(records);
			});

	} else {
		var output = '';
		res.setEncoding('utf8');
		res.on('data', function (chunk) {
			output += chunk;
		});

		res.on('end', function () {
			if (format === API.FORMAT.JSON) {
				var json = JSON.parse(output);
				deferred.resolve(json);
			} else {
				deferred.resolve(output);
			}
		});
	}
};

exports.API = API;
