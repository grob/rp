var log = require("ringo/logging").getLogger(module.id);
var cache = exports.cache = require("./cache");
var config = require("./config");
var httpclient = require("./httpclient");
var strings = require("ringo/utils/strings");
var crypto = require("./crypto");
var semver = require("./semver");
var files = require("./files");
var {Path} = require("fs");

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
    var url = httpclient.composeUrl(config.registryUrl, "download", descriptor.filename);
    log.debug("Retrieving package", url);
    var file = httpclient.getBinary(url);
    files.verifyChecksums(file, descriptor.checksums);
    return file;
};

exports.getPackageOwners = function(name) {
    var catalog = cache.get();
    if (!catalog.hasOwnProperty(name)) {
        throw new Error("Package '" + name + "' does not exist in registry");
    }
    return catalog[name].owners;
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
    var url = httpclient.composeUrl(config.registryUrl, "api/users/");
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
    var url = httpclient.composeUrl(config.registryUrl, "api/users", username);
    var response = httpclient.get(url);
    return response.statusCode === 200;
};

exports.getSalt = function(username) {
    var url = httpclient.composeUrl(config.registryUrl, "api/users", username, "salt");
    var response = httpclient.get(url);
    if (response.statusCode === 200) {
        return response.body;
    }
    return null;
};

exports.changePassword = function(username, password, newPassword) {
    log.debug("Changing password of", username, "...");
    var url = httpclient.composeUrl(config.registryUrl, "api/users/password");
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
    var url = httpclient.composeUrl(config.registryUrl, "api/users", username, "reset");
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
    var url = httpclient.composeUrl(config.registryUrl, "api/users", username, "password");
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
    var url = httpclient.composeUrl(config.registryUrl, "api/packages",
                descriptor.name, descriptor.version);
    var response = httpclient.post(url, {
        "descriptor": JSON.stringify(descriptor),
        "pkg": new Path(archivePath),
        "force": force === true
    }, username, password);
    if (response.statusCode !== 200) {
        throw new Error(response.body.message);
    }
    return response.body;
};

exports.unpublish = function(username, password, name, version) {
    var composeArgs = [config.registryUrl, "api/packages", name];
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
    var url = httpclient.composeUrl(config.registryUrl, "api/search");
    var response = httpclient.get(url, {
        "q": query
    });
    return response.body;
};

exports.addOwner = function(username, password, pkgName, ownerName) {
    log.debug(ownerName, "is added to list of owners of", pkgName, "by",
            username, "...");
    var url = httpclient.composeUrl(config.registryUrl, "api/owners", pkgName, ownerName);
    var response = httpclient.put(url, username, password);
    if (response.statusCode !== 200) {
        throw new Error(response.body.message);
    }
    return response.body;
};

exports.removeOwner = function(username, password, pkgName, ownerName) {
    log.debug(ownerName, "is removed from list of owners of", pkgName, "by",
            username, "...");
    var url = httpclient.composeUrl(config.registryUrl, "api/owners", pkgName, ownerName);
    var response = httpclient.del(url, username, password);
    if (response.statusCode !== 200) {
        throw new Error(response.body.message);
    }
    return response.body;
};
