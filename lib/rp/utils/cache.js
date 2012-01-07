var fs = require("fs");
var config = require("./config");

var cache = {};

var getCacheFile = function(name) {
    return fs.normal(fs.join(config.directory, "/", name));
};

var getValue = exports.get = function(name) {
    if (cache.hasOwnProperty(name) && cache[name] != null) {
        return cache[name];
    }
    var file = getCacheFile(name);
    var value = null;
    if (fs.exists(file)) {
        try {
            value = JSON.parse(fs.read(file, {
                "charset": "UTF-8"
            }));
            if (value != null) {
                cache[name] = value;
            }
        } catch (e) {
            // ignore
        }
    }
    return value;
};

exports.getLastModified = function(name) {
    var file = getCacheFile(name);
    if (fs.exists(file)) {
        return fs.lastModified(file);
    }
    return null;
};

Object.defineProperties(exports, {
    "index": {
        "get": function() {
            return getValue("index.json");
        }
    }
});

exports.write = function(name, obj) {
    fs.write(getCacheFile(name), JSON.stringify(obj), {
        "charset": "UTF-8"
    });
    cache[name] = obj;
};
