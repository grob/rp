var fs = require("fs");
var objects = require("ringo/utils/objects");
var os = require("./os");

const DEFAULTS = {
    "ringoHome": system.prefix,
    "registryUrl": "https://rpr.nomatic.org/"
};

var config = null;

var getDirectoryName = function() {
    if (os.isWindows()) {
        return "rp";
    }
    return ".rp"
};

var getConfigDirectory = function() {
    var homeDir = java.lang.System.getProperty("user.home");
    var dir = fs.normal(fs.join(homeDir, getDirectoryName()));
    if (!fs.exists(dir)) {
        fs.makeDirectory(dir);
    }
    return dir;
};

var getConfigFile = function() {
    return fs.normal(fs.join(getConfigDirectory(), "/config"));
};

var read = exports.read = function() {
    if (config == null) {
        config = {};
        var configFile = getConfigFile();
        if (fs.exists(configFile)) {
            try {
                config = JSON.parse(fs.read(configFile, {
                    "charset": "UTF-8"
                }));
            } catch (e) {
                // ignore
            }
        }
    }
    return config;
};

exports.write = function(conf) {
    var configFile = getConfigFile();
    fs.write(configFile, JSON.stringify(objects.merge(conf, config)), {
        "charset": "UTF-8"
    });
};

/**
 * Only for use in unit tests
 * @param c
 */
exports.setConfig = function(c) {
    config = c;
};

Object.defineProperties(exports, {
    "ringoHome": {
        "get": function() {
            return read()["ringoHome"] || DEFAULTS.ringoHome;
        }
    },
    "registryUrl": {
        "get": function() {
            return read()["registryUrl"] || DEFAULTS.registryUrl;
        }
    },
    "directory": {
        "get": getConfigDirectory
    },
    "file": {
        "get": getConfigFile
    }
});
