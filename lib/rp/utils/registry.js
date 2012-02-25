var log = require("ringo/logging").getLogger(module.id);
var cache = exports.cache = require("./cache");
var config = require("./config");
var httpclient = require("./httpclient");
var strings = require("ringo/utils/strings");
var crypto = require("./crypto");
var semver = require("../utils/semver");

exports.getPackageDescriptor = function(name, version) {
    var catalog = cache.get();
    if (!catalog.hasOwnProperty(name)) {
        throw new Error("Package '" + name + "' does not exist in registry");
    }
    var descriptor = catalog[name];
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
    var catalog = cache.get();
    if (!catalog.hasOwnProperty(name)) {
        throw new Error("Package '" + name + "' does not exist in registry");
    }
    var descriptor = catalog[name];
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
    log.debug("Retrieving package", url);
    return httpclient.getBinary(url);
};

exports.exists = function(name, version) {
    var catalog = cache.get();
    var pkgInfo = catalog[name];
    return pkgInfo != null && (!version || pkgInfo.versions.some(function(v) {
        return v.version == version;
    }));
};

exports.createUser = function(username, pwd, email) {
    log.debug("Creating user account", username, "...");
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
    log.debug("Changing password of", username, "...");
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
    log.debug("Initializing password reset for", username, "...");
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
    log.debug("Resetting password of", username, "...");
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
    log.debug(descriptor.name, "is published by", username, "...");
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
    log.debug(name, version, "is unpublished by", username, "...");
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
