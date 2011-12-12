var log = require("ringo/logging").getLogger(module.id);
var config = require("./config");
var httpclient = require("./httpclient");
var strings = require("ringo/utils/strings");
var crypto = require("./crypto");
var semver = require("ringo-semver");

/**
 * The local registry cache
 * @type Object
 */
var index = {};
var isLoaded = false;

var load = function() {
    if (!isLoaded) {
        // retrieve catalog from remote registry
        var url = httpclient.composeUrl(config.registryUrl, config.catalog);
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
    var descriptor = index[name];
    if (version == undefined || version === "latest") {
        version = descriptor.latest;
    } else {
        var candidates = semver.sort(Object.keys(descriptor.versions));
        var found = null;
        for each (let candidate in candidates) {
            if (semver.satisfies(candidate, version)) {
                found = candidate;
                break;
            }
        }
        if (found === null) {
            throw new Error("Unable to find version " + version + " for package " + name);
        }
        version = found;
    }
    var url = httpclient.composeUrl(config.registryUrl, "packages", name, version);
    var response = httpclient.get(url);
    if (response !== null) {
        return JSON.parse(response);
    }
    return null;
};

exports.getPackage = function(descriptor) {
    var url = httpclient.composeUrl(config.registryUrl, "package/", descriptor.filename);
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
    var url = httpclient.composeUrl(config.registryUrl + "users/");
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
    var url = httpclient.composeUrl(config.registryUrl, "users", username);
    return JSON.parse(httpclient.get(url));
};

exports.getSalt = function(username) {
    var url = httpclient.composeUrl(config.registryUrl, "users", username, "salt");
    var response = httpclient.get(url);
    return JSON.parse(response);
};

exports.changePassword = function(username, password, newPassword) {
    var url = httpclient.composeUrl(config.registryUrl, "password");
    var response = httpclient.post(url, {
        "password": newPassword
    }, username, password);
    return JSON.parse(response);
};

exports.publish = function(username, password, descriptor, archivePath, force) {
    var url = httpclient.composeUrl(config.registryUrl, "packages",
                descriptor.name, descriptor.version);
    return httpclient.post(url, {
        "descriptor": JSON.stringify(descriptor),
        "pkg": archivePath,
        "force": force
    }, username, password);
};

exports.unpublish = function(username, password, name, version) {
    var composeArgs = [config.registryUrl, "packages", name];
    if (version != undefined) {
        composeArgs.push(version);
    }
    return httpclient.del(httpclient.composeUrl.apply(null, composeArgs),
             username, password);
};
