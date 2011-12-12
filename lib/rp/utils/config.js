var fs = require("fs");
var objects = require("ringo/utils/objects");

var configFile = fs.normal(fs.join(system.env.HOME, "/.rp_config"));

var DEFAULTS = {
    "baseDir": system.prefix,
    "registryUrl": "http://localhost:8080/"
};

var config = null;

var read = exports.read = function() {
    if (config != null) {
        return config;
    }
    var conf = {};
    if (fs.exists(configFile)) {
        try {
            conf = JSON.parse(fs.read(configFile, {
                "charset": "UTF-8"
            }));
        } catch (e) {
            // ignore
        }
    }
    return config = objects.merge(conf, DEFAULTS);
};

var write = exports.write = function(conf) {
    config = objects.merge(conf, config, DEFAULTS);
    fs.write(configFile, JSON.stringify(config), {
        "charset": "UTF-8"
    });
};

Object.defineProperties(exports, {
    "baseDir": {
        "get": function() {
            return read()["baseDir"];
        }
    },
    "registryUrl": {
        "get": function() {
            return read()["registryUrl"];
        }
    },
    "catalog": {
        "value": "packages.json"
    },
    "file": {
        "get": function() {
            return configFile;
        }
    }
});
