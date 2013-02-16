var	xml2object = require('xml2object'),
	http = require('http'),
	csv = require('csv'),
	Q = require('q');

var API = function(params) {
	params = params || {};

	this.hostname = params.hostname;
	this.port     = params.port || 80;
	this.format   = params.format || 'json';
	this.method   = params.method || 'GET';
	this.base     = params.base || '/';

        this.urlTransform = params.urlTransform;
        this.resultTransform = params.resultTransform;
};

API.FORMAT = {
	XML: 'xml',
	JSON: 'json',
	CSV: 'csv',
	CSV_HEADER: 'csv_header'
};

function is(type, obj) {
    var clas = Object.prototype.toString.call(obj).slice(8, -1);
    return obj !== undefined && obj !== null && clas === type;
}

API.prototype.call = function(path, params, format) {
	var deferred = Q.defer();

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
			for (var i=0;i<value.length;i++)
				paramStr.push(key + "=" + value[i]);
		} else {
			paramStr.push(key + "=" + value);
		}
	}

	var query = (paramStr.length>0?"?":"") + paramStr.join("&");

	format = format || this.format;

        var url = this.base + path + query;
        if (this.urlTransform !== undefined) {
            url = this.urlTransform(url)
        }

	var options = {
	  host: this.hostname,
	  port: this.port,
	  path: url,
	  method: this.method
	};

	var req = http.request(options, function(res) {
		if (format == API.FORMAT.XML) {
			var parser = new xml2object(['body'], res);
			var data = {};

			parser.on('object', function(name, obj) {
				data[name] = obj;
			});

			parser.on('end', function() {
				deferred.resolve(data);
			});

			parser.start();

		} else if (format == API.FORMAT.CSV || format == API.FORMAT.CSV_HEADER) {
			var header,
				records = [];

			csv()
				.from.stream(res)
				.on('record', function(record) {
					if (format == API.FORMAT.CSV_HEADER && header === undefined)
						header = record;
					else
						records.push(record);
				})
				.on('end', function() {
					if (header)
						records = processCSV(header, records);
					deferred.resolve(records);
				})

		} else {
			var output = '';
			res.setEncoding('utf8');
			res.on('data', function (chunk) {
				output += chunk;
			});

			res.on('end', function () {
				if (format == API.FORMAT.JSON) {
					var json = JSON.parse(output);
					deferred.resolve(json);
				} else {
					deferred.resolve(output);
				}
			});
		}
	});

	req.on('error', function(e) {
	  	deferred.reject('problem with request: ' + e.message);
	});

	req.end();

	return deferred.promise;
};

function processCSV(header, records) {
	var output = [],
		obj,
		record;

	while (records.length > 0) {
		obj = {};
		record = records.shift();

		for (i=0,l=record.length;i<l;i++)
			obj[header[i]] = record[i];

		output.push(obj);
	}

	return output;
}

exports.API = API;
