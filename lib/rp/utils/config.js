var fs = require("fs");
var objects = require("ringo/utils/objects");
var os = require("./os");

const DEFAULTS = {
    "ringoHome": system.prefix,
    "registryUrl": "http://rpr.nomatic.org/"
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
    if (config != null) {
        return config;
    }
    var conf = {};
    var configFile = getConfigFile();
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

exports.write = function(conf) {
    var configFile = getConfigFile();
    fs.write(configFile, JSON.stringify(objects.merge(conf, config, DEFAULTS)), {
        "charset": "UTF-8"
    });
};

Object.defineProperties(exports, {
    "ringoHome": {
        "get": function() {
            return read()["ringoHome"] || DEFAULTS.ringoHome;
        }
    },
    "registryUrl": {
        "get": function() {
            return read()["registryUrl"];
        }
    },
    "directory": {
        "get": getConfigDirectory
    },
    "file": {
        "get": getConfigFile
    }
});
