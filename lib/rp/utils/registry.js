var log = require("ringo/logging").getLogger(module.id);
var cache = require("./cache");
var config = require("./config");
var httpclient = require("./httpclient");
var strings = require("ringo/utils/strings");
var dates = require("ringo/utils/dates");
var crypto = require("./crypto");
var semver = require("ringo-semver");
var {DateUtils} = org.apache.http.impl.cookie;

var needsIndexUpdate = true;

var getIndex = function() {
    if (!cache.get("index")) {
        getAll();
    } else if (needsIndexUpdate) {
        getUpdates();
        needsIndexUpdate = false;
    }
    return cache.get("index");
};

var updateIndex = function(index, response) {
    try {
        JSON.parse(response).forEach(function(pkg, idx) {
            index[pkg.name] = pkg;
        });
        cache.write("index", index);
    } catch (e) {
        throw new Error("Unable to parse registry catalog");
    }
}

var getAll = exports.initIndex = function() {
    // retrieve catalog from remote registry
    var url = httpclient.composeUrl(config.registryUrl, "packages");
    log.debug("Retrieving registry catalog " + url);
    var response = httpclient.get(url);
    if (response !== null) {
        updateIndex({}, response);
    } else {
        throw new Error("Unable to retrieve package catalog");
    }
};

var getUpdates = exports.updateIndex = function() {
    var lastUpdate = cache.getLastModified("index");
    var url = httpclient.composeUrl(config.registryUrl, "updates");
    log.debug("Retrieving package updates " + url);
    var response = httpclient.get(url, null, {
        "if-modified-since": DateUtils.formatDate(lastUpdate)
    });
    if (response !== null) {
        updateIndex(cache.get("index"), response);
    } else {
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
    } else {
        var found = null;
        for each (let candidate in descriptor.versions) {
            if (semver.satisfies(candidate.version, version)) {
                found = candidate.version;
                break;
            }
        }
        if (found === null) {
            throw new Error("Unable to find version " + version + " for package " + name);
        }
        version = found;
    }
    var url = httpclient.composeUrl(config.registryUrl, "packages", name, version);
    try {
        return JSON.parse(httpclient.get(url));
    } catch (e) {
        // ignore
    }
    return null;
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

exports.search = function(query) {
    var url = httpclient.composeUrl(config.registryUrl, "search");
    var response = httpclient.get(url, {
        "q": query
    });
    return JSON.parse(response);
};
