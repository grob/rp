var fs = require("fs");
var config = require("./config");
var log = require("ringo/logging").getLogger(module.id);
var registry = require("./registry");

/**
 * A constant indicating the catalog format this version of rp requires
 * @type Number
 */
const CATALOG_FORMAT = exports.CATALOG_FORMAT = 2;

var catalog = null;
var checkForUpdates = true;

exports.get = function() {
    if (catalog === null) {
        load(getCacheFile());
        if (checkForUpdates === true) {
            update();
        }
    }
    return catalog;
};

/**
 * Used in unit tests. Disables update checking too.
 * @param {Object} c The catalog to use
 */
exports.set = function(c) {
    catalog = c;
    checkForUpdates = false;
    return;
};

/**
 * Used in unit tests. Clears the catalog and enables
 * update checking
 */
exports.reset = function() {
    catalog = null;
    checkForUpdates = true;
};

var init = exports.init = function() {
    catalog = {};
    registry.getPackages().forEach(function(pkg) {
        catalog[pkg.name] = pkg;
    });
    writeFile(getCacheFile());
    checkForUpdates = false;
};

var update = exports.update = function() {
    if (catalog === null) {
        load(getCacheFile());
    }
    if (checkForUpdates === true) {
        var updates = registry.getUpdates(getLastModified());
        if (updates !== null) {
            updates.updated.forEach(function(pkg, idx) {
                log.debug(pkg.name, "has changed, updating cache");
                catalog[pkg.name] = pkg;
            });
            updates.removed.forEach(function(packageName) {
                log.debug(packageName, "has been removed, updating cache");
                delete catalog[packageName];
            });
            writeFile(getCacheFile());
        }
    }
};

var verifyCatalogFormat = function(data) {
    return data != null &&
            data.hasOwnProperty("catalog") &&
            data.hasOwnProperty("CATALOG_FORMAT") &&
            data["CATALOG_FORMAT"] === CATALOG_FORMAT;
};

var getLastModified = function() {
    var file = getCacheFile();
    if (fs.exists(file)) {
        return fs.lastModified(file);
    }
    return null;
};

var getCacheFile = function() {
    return fs.normal(fs.join(config.directory, "index"));
};

var load = exports.load = function(path) {
    try {
        catalog = readFile(path).catalog;
    } catch (e) {
        init();
    }
};

var readFile = exports.readFile = function(path) {
    if (!fs.exists(path) || !fs.isReadable(path)) {
        throw new Error("Cache file", path, "doesn't exist or isn't readable");
    }
    var source = fs.read(path, {
        "charset": "UTF-8"
    });
    if (source === null) {
        throw new Error("Cache file", path, "is empty");
    }
    var contents = null;
    try {
        contents = JSON.parse(source);
    } catch (e) {
        throw new Error("Cache file", path, "is corrupt");
    }
    if (!verifyCatalogFormat(contents)) {
        throw new Error("Cache file", path, "has wrong format");
    }
    return contents;
};

var writeFile = exports.writeFile = function(path) {
    if (!fs.isWritable(path)) {
        throw new Error("Can't write file", path);
    }
    fs.write(path, JSON.stringify({
        "CATALOG_FORMAT": CATALOG_FORMAT,
        "catalog": catalog
    }), {
        "charset": "UTF-8"
    });
};
