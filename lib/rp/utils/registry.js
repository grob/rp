var log = require("ringo/logging").getLogger(module.id);
var config = require("../config");
var httpclient = require("./httpclient");
var strings = require("ringo/utils/strings");
var crypto = require("./crypto");

/**
 * The local registry cache
 * @type Object
 */
var index = {};
var isLoaded = false;

var load = function() {
    if (!isLoaded) {
        // retrieve catalog from remote registry
        var url = httpclient.composeUrl(config.registry.url, config.registry.catalog);
        log.debug("Retrieving registry catalog " + url);
        var response = httpclient.get(url);
        if (response !== null) {
            try {
                JSON.parse(response).forEach(function(pkg, idx) {
                    index[pkg.name] = pkg;
                });
                isLoaded = true;
                log.debug("Parsed registry catalog");
            } catch (e) {
                throw new Error("Unable to parse registry catalog");
            } 
        } else {
            throw new Error("Unable to retrieve package catalog");
        }
    }
    return;
};

Object.defineProperty(exports, "packages", {
    "get": function() {
        load();
        return index;
    },
    "enumerable": true
});

exports.getPackageDescriptor = function(name, version) {
    load();
    if (!index.hasOwnProperty(name)) {
        throw new Error("Package '" + name + "' does not exist in registry");
    }
    var url = httpclient.composeUrl(config.registry.url, "packages", name, version || "latest");
    var response = httpclient.get(url);
    if (response !== null) {
        return JSON.parse(response);
    }
    return null;
};

exports.getPackage = function(descriptor) {
    var url = httpclient.composeUrl(config.registry.url, descriptor.filename);
    log.debug("Retrieving package " + url);
    return httpclient.getBinary(url);
};

exports.exists = function(name, version) {
    load();
    var pkgInfo = index[name];
    return pkgInfo != null && (!version || pkgInfo.versions.hasOwnProperty(version));
};

exports.createUser = function(username, pwd, email) {
    var salt = crypto.createSalt();
    var digest = crypto.createDigest(pwd, salt);
    var url = httpclient.composeUrl(config.registry.url + "users/");
    var response = httpclient.post(url, {
        "username": username,
        "salt": strings.b64encode(salt),
        "password": strings.b64encode(digest),
        "email": email
    });
    if (response !== null) {
        return JSON.parse(response);
    }
    return null;
};

exports.userExists = function(username) {
    var url = httpclient.composeUrl(config.registry.url, "users", username);
    return JSON.parse(httpclient.get(url));
};

exports.getSalt = function(username) {
    var url = httpclient.composeUrl(config.registry.url, "users", username, "salt");
    var response = httpclient.get(url);
    return JSON.parse(response);
};

exports.changePassword = function(username, oldPassword, newPassword) {
    var url = httpclient.composeUrl(config.registry.url, "users", username, "password");
    var response = httpclient.post(url, {
        "oldPassword": oldPassword,
        "newPassword": newPassword
    });
    return JSON.parse(response);
};

exports.publish = function(username, password, descriptor, archivePath, force) {
    var url = httpclient.composeUrl(config.registry.url, "packages",
                descriptor.name, descriptor.version);
    return httpclient.post(url, {
        "descriptor": JSON.stringify(descriptor),
        "pkg": archivePath,
        "force": force,
        "username": username,
        "password": password
    });
};
