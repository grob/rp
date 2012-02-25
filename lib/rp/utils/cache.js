var fs = require("fs");
var config = require("./config");
var httpclient = require("./httpclient");
var {DateUtils} = org.apache.http.impl.cookie;
var log = require("ringo/logging").getLogger(module.id);

/**
 * A constant indicating the catalog format this version of rp requires
 * @type Number
 */
const CATALOG_FORMAT = 2;

var catalog = null;
var checkForUpdates = true;

export("get", "set", "init", "update");

var get = function() {
    if (catalog === null) {
        readCacheFile();
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
var set = function(c) {
    catalog = c;
    checkForUpdates = false;
    return;
};

var checkCatalogFormat = function(data) {
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

var readCacheFile = function() {
    var file = getCacheFile();
    if (fs.exists(file)) {
        var cached;
        try {
            cached = JSON.parse(fs.read(file, {
                "charset": "UTF-8"
            }));
            if (checkCatalogFormat(cached)) {
                log.debug("Loaded cached catalog in", file);
                return catalog = cached.catalog;
            } else {
                log.debug("Cache file", file, "has wrong format");
            }
        } catch (e) {
            log.debug("Cache file", file, "is corrupt");
        }
    }
    init();
};

var writeCacheFile = function() {
    fs.write(getCacheFile(), JSON.stringify({
        "CATALOG_FORMAT": CATALOG_FORMAT,
        "catalog": catalog
    }), {
        "charset": "UTF-8"
    });
};

var init = function() {
    // retrieve catalog from remote registry
    var url = httpclient.composeUrl(config.registryUrl, "packages");
    log.debug("Retrieving registry catalog", url);
    var response = httpclient.get(url);
    if (response.statusCode === 200) {
        try {
            catalog = {};
            response.body.forEach(function(pkg) {
                catalog[pkg.name] = pkg;
            });
            writeCacheFile();
            checkForUpdates = false;
        } catch (e) {
            throw new Error("Unable to parse package catalog");
        }
    } else {
        throw new Error("Unable to retrieve package catalog");
    }
};

var update = function() {
    if (catalog === null) {
        readCacheFile();
    }
    if (checkForUpdates === true) {
        var lastUpdate = getLastModified();
        var url = httpclient.composeUrl(config.registryUrl, "updates");
        log.debug("Retrieving catalog updates", url);
        var response = httpclient.get(url, null, {
            "if-modified-since": DateUtils.formatDate(lastUpdate)
        });
        if (response.statusCode === 200) {
            try {
                response.body.updated.forEach(function(pkg, idx) {
                    log.debug(pkg.name, "has changed, updating cache");
                    catalog[pkg.name] = pkg;
                });
                response.body.removed.forEach(function(packageName) {
                    log.debug(pkg.name, "has been removed, updating cache");
                    delete catalog[packageName];
                });
                writeCacheFile();
            } catch (e) {
                log.error(e);
                throw new Error("Unable to parse catalog updates");
            }
        } else if (response.statusCode !== 304) {
            log.warn("Unable to retrieve catalog updates, status code",
                    response.statusCode);
            throw new Error("Unable to retrieve catalog updates");
        }
    }
};

