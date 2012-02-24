var log = require("ringo/logging").getLogger(module.id);
var cache = require("./cache");
var config = require("./config");
var httpclient = require("./httpclient");
var strings = require("ringo/utils/strings");
var dates = require("ringo/utils/dates");
var crypto = require("./crypto");
var semver = require("../utils/semver");
var {DateUtils} = org.apache.http.impl.cookie;

var needsIndexUpdate = true;

var getIndex = exports.getIndex = function() {
    if (!cache.get("index")) {
        getAll();
    } else if (needsIndexUpdate) {
        log.debug("Retrieving catalog updates...");
        updateIndex();
        needsIndexUpdate = false;
    }
    return cache.get("index");
};

/**
 * Only used for unit tests
 */
exports.setCache = function(mock) {
    cache = mock;
    needsIndexUpdate = false;
};

var getAll = exports.initIndex = function() {
    // retrieve catalog from remote registry
    var url = httpclient.composeUrl(config.registryUrl, "packages");
    log.debug("Retrieving registry catalog " + url);
    var response = httpclient.get(url);
    if (response.statusCode === 200) {
        var index = {};
        try {
            response.body.forEach(function(pkg) {
                index[pkg.name] = pkg;
            });
            cache.write("index", index);
        } catch (e) {
            throw new Error("Unable to parse registry catalog");
        }
    } else {
        throw new Error("Unable to retrieve package catalog");
    }
};

var updateIndex = exports.updateIndex = function() {
    var lastUpdate = cache.getLastModified("index");
    var url = httpclient.composeUrl(config.registryUrl, "updates");
    log.debug("Retrieving package updates " + url);
    var response = httpclient.get(url, null, {
        "if-modified-since": DateUtils.formatDate(lastUpdate)
    });
    if (response.statusCode === 200) {
        var index = cache.get("index");
        try {
            response.body.updated.forEach(function(pkg, idx) {
                index[pkg.name] = pkg;
            });
            response.body.removed.forEach(function(packageName) {
                delete index[packageName];
            });
            cache.write("index", index);
        } catch (e) {
            log.error(e);
            throw new Error("Unable to parse registry catalog");
        }
    } else if (response.statusCode !== 304) {
        throw new Error("Unable to retrieve package catalog updates");
    }
};

Object.defineProperty(exports, "packages", {
    "get": function() {
        return getIndex();
    },
    "enumerable": true
});

exports.getPackageDescriptor = function(name, version) {
    var index = getIndex();
    if (!index.hasOwnProperty(name)) {
        throw new Error("Package '" + name + "' does not exist in registry");
    }
    var descriptor = index[name];
    if (version == undefined || version === "latest") {
        version = descriptor.latest;
    }
    for each (let candidate in descriptor.versions) {
        if (semver.satisfies(candidate.version, version)) {
            return candidate;
        }
    }
    throw new Error("Unable to find version " + version + " for package " + name);
};

exports.getLatestCompatible = function(name, version) {
    var index = getIndex();
    if (!index.hasOwnProperty(name)) {
        throw new Error("Package '" + name + "' does not exist in registry");
    }
    var descriptor = index[name];
    for each (let candidate in descriptor.versions) {
        if (semver.isCompatible(candidate.version, version)) {
            return candidate;
        }
    }
    throw new Error("Unable to find latest compatible version for package " +
            name + " " + version);
};

exports.isLatest = function(name, version) {
    var descriptor = this.getPackageDescriptor(name);
    return semver.isGreater(descriptor.latest, version) === false;
};

exports.getPackage = function(descriptor) {
    var url = httpclient.composeUrl(config.registryUrl, "download/", descriptor.filename);
    log.debug("Retrieving package " + url);
    return httpclient.getBinary(url);
};

exports.exists = function(name, version) {
    var index = getIndex();
    var pkgInfo = index[name];
    return pkgInfo != null && (!version || pkgInfo.versions.some(function(v) {
        return v.version == version;
    }));
};

exports.createUser = function(username, pwd, email) {
    var salt = crypto.createSalt();
    var digest = crypto.createDigest(pwd, salt);
    var url = httpclient.composeUrl(config.registryUrl, "users/");
    var response = httpclient.post(url, {
        "username": username,
        "salt": strings.b64encode(salt),
        "password": strings.b64encode(digest),
        "email": email
    });
    if (response.statusCode !== 200) {
        throw new Error(response.body.message);
    }
    return response.body;
};

exports.userExists = function(username) {
    var url = httpclient.composeUrl(config.registryUrl, "users", username);
    var response = httpclient.get(url);
    return response.statusCode === 200;
};

exports.getSalt = function(username) {
    var url = httpclient.composeUrl(config.registryUrl, "users", username, "salt");
    var response = httpclient.get(url);
    if (response.statusCode === 200) {
        return response.body;
    }
    return null;
};

exports.changePassword = function(username, password, newPassword) {
    var url = httpclient.composeUrl(config.registryUrl, "password");
    var response = httpclient.post(url, {
        "password": newPassword
    }, username, password);
    if (response.statusCode !== 200) {
        throw new Error(response.body.message);
    }
    return response.body;
};

exports.initPasswordReset = function(username, email) {
    var url = httpclient.composeUrl(config.registryUrl, "users", username, "reset");
    var response = httpclient.post(url, {
        "email": email
    });
    if (response.statusCode !== 200) {
        throw new Error(response.body.message);
    }
    return response.body;
};

exports.resetPassword = function(username, token, password) {
    var url = httpclient.composeUrl(config.registryUrl, "users", username, "password");
    var response = httpclient.post(url, {
        "token": token,
        "password": password
    });
    if (response.statusCode !== 200) {
        throw new Error(response.body.message);
    }
    return response.body;
};

exports.publish = function(username, password, descriptor, archivePath, force) {
    var url = httpclient.composeUrl(config.registryUrl, "packages",
                descriptor.name, descriptor.version);
    var response = httpclient.post(url, {
        "descriptor": JSON.stringify(descriptor),
        "pkg": archivePath,
        "force": force
    }, username, password);
    if (response.statusCode !== 200) {
        throw new Error(response.body.message);
    }
    return response.body;
};

exports.unpublish = function(username, password, name, version) {
    var composeArgs = [config.registryUrl, "packages", name];
    if (version != undefined) {
        composeArgs.push(version);
    }
    var response = httpclient.del(httpclient.composeUrl.apply(null, composeArgs),
             username, password);
    if (response.statusCode !== 200) {
        throw new Error(response.body.message);
    }
    return response.body;
};

exports.search = function(query) {
    var url = httpclient.composeUrl(config.registryUrl, "search");
    var response = httpclient.get(url, {
        "q": query
    });
    return response.body;
};
