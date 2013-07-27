var system = require("system");
var assert = require("assert");
var registry = require("../lib/utils/registry");
var files = require("../lib/utils/files");
var {WebServer} = require("./mock/webserver");
var config = require("../lib/utils/config");
var fs = require("fs");
var response = require("ringo/jsgi/response");
var {Application} = require("stick");
var base64 = require("ringo/base64");

var server, app;

var getCredentials = function(request) {
    return base64.decode(request.headers.authorization.replace(/^Basic /, "")).split(":");
};

exports.setUp = function() {
    app = new Application();
    app.configure("params", "upload", "route");
    server = new WebServer(app, 8082);
    server.start();
    config.setRegistryUrl(server.getUrl());
};

exports.tearDown = function() {
    config.reset();
    registry.cache.reset();
    server.stop();
};

exports.testExists = function() {
    registry.cache.set({
        "A": {
            "name": "A",
            "versions": [
                {
                    "name": "A",
                    "version": "1.0.0"
                },
                {
                    "name": "A",
                    "version": "0.1.0"
                }
            ]
        }
    });
    assert.isTrue(registry.exists("A"));
    assert.isTrue(registry.exists("A", "0.1.0"));
    assert.isTrue(registry.exists("A", "1.0.0"));
    // exists expects clean semver versions
    assert.isFalse(registry.exists("A", "0.1"));
    assert.isFalse(registry.exists("A", "0.1.1"));
    assert.isFalse(registry.exists("B"));
};

exports.testGetPackageDescriptor = function() {
    var catalog = {
        "A": {
            "name": "A",
            "versions": [
                {
                    "name": "A",
                    "version": "1.0.0"
                },
                {
                    "name": "A",
                    "version": "0.1.0"
                }
            ]
        }
    };
    registry.cache.set(catalog);
    assert.isNotNull(registry.getPackageDescriptor("A"));
    // returns latest version if no version specified
    assert.strictEqual(registry.getPackageDescriptor("A"),
            catalog["A"].versions[0]);
    assert.strictEqual(registry.getPackageDescriptor("A", "0.1.0"),
            catalog["A"].versions[1]);
    assert.throws(function() {
        registry.getPackageDescriptor("A", "0.1.1");
    }, Error);
};

exports.testIsLatest = function() {
    registry.cache.set({
        "A":{
            "name":"A",
            "versions": [
                {
                    "name":"A",
                    "latest": "1.0.0",
                    "version":"1.0.0"
                },
                {
                    "name":"A",
                    "latest": "1.0.0",
                    "version":"0.1.0"
                }
            ]
        }
    });
    // version argument is mandatory
    assert.throws(function() {
        registry.isLatest("A");
    });
    assert.isTrue(registry.isLatest("A", "1.0.0"));
    assert.isFalse(registry.isLatest("A", "0.1.0"));
};

exports.testGetLatestCompatible = function() {
    registry.cache.set({
        "A": {
            "name": "A",
            "versions": [
                {
                    "name": "A",
                    "version": "1.0.0"
                },
                {
                    "name": "A",
                    "version": "0.2.1"
                },
                {
                    "name": "A",
                    "version": "0.2.0"
                },
                {
                    "name": "A",
                    "version": "0.1.0"
                }
            ]
        }
    });
    assert.strictEqual(registry.getLatestCompatible("A", "0.1.0").version, "0.2.1");
    assert.strictEqual(registry.getLatestCompatible("A", "1.0.0").version, "1.0.0");
    assert.throws(function() {
        registry.getLatestCompatible("A", "2.0.0");
    }, Error);
};

exports.testGetPackage = function() {
    var zipFile = module.resolve("./testpackage.zip");
    app.get("/download/:filename", function(request) {
        return response.static(zipFile);
    });
    var checksums = files.getChecksums(zipFile);
    var descriptor = {
        "filename": "testpackage.zip",
        "checksums": checksums
    };
    var received = registry.getPackage(descriptor);
    assert.isNotNull(received);
    assert.strictEqual(fs.size(received), fs.size(zipFile));
    assert.isUndefined(files.verifyChecksums(received, checksums));
    // cleanup
    fs.remove(received);
};

exports.testGetPackageOwners = function() {
    var catalog = {
        "A":{
            "name":"A",
            "owners": [
                {
                    "name": "johndoe",
                    "email": "johndoe@example.org"
                }
            ]
        }
    };
    registry.cache.set(catalog);
    var owners = registry.getPackageOwners("A");
    assert.isNotNull(owners);
    assert.strictEqual(owners.length, 1);
    assert.strictEqual(owners[0].name, catalog.A.owners[0].name);
};

exports.testCreateUser = function() {
    app.post("/api/users/", function(request) {
        return response.json({
            "postParams": request.postParams
        });
    });
    var name = "johndoe";
    var password = "secret";
    var email = "johndoe@example.org";
    var result = registry.createUser(name, password, email);
    assert.isNotNull(result);
    assert.strictEqual(result.postParams.username, name);
    assert.strictEqual(result.postParams.email, email);
    // can't test for password equality because createUser uses its own salt
    // which is unaccessible here
    assert.isNotUndefined(result.postParams.password);
};

exports.testUserExists = function() {
    app.get("/api/users/:username", function(request, username) {
        return response[(username === "johndoe") ? "ok" : "notFound"]();
    });
    assert.isTrue(registry.userExists("johndoe"));
    assert.isFalse(registry.userExists("janedoe"));
};

exports.testGetSalt = function() {
    app.get("/api/users/:username/salt", function(request, username) {
        if (username === "johndoe") {
            return response.json("salt");
        }
        return response.notFound();
    });
    assert.strictEqual(registry.getSalt("johndoe"), "salt");
    assert.isNull(registry.getSalt("janedoe"));
};

exports.testChangePassword = function() {
    var username = "johndoe";
    var password = "secret";
    var newPassword = "moresecret";
    app.post("/api/users/password", function(request) {
        var [username, password] = getCredentials(request);
        return response.json({
            "postParams": request.postParams,
            "credentials": {
                "username": username,
                "password": password
            }
        });
    });
    var result = registry.changePassword(username, password, newPassword);
    assert.strictEqual(result.credentials.username, username);
    assert.strictEqual(result.credentials.password, password);
    assert.strictEqual(result.postParams.password, newPassword);
};

exports.testInitPasswordReset = function() {
    var username = "johndoe";
    var email = "john.doe@example.com";
    app.post("/api/users/:username/reset", function(request, username) {
        return response.json({
            "postParams": request.postParams,
            "username": username
        });
    });
    var result = registry.initPasswordReset(username, email);
    assert.strictEqual(result.username, username);
    assert.strictEqual(result.postParams.email, email);
};

exports.testResetPassword = function() {
    var username = "johndoe";
    var token = "token";
    var password = "secret";
    app.post("/api/users/:username/password", function(request, username) {
        return response.json({
            "postParams": request.postParams
        });
    });
    var result = registry.resetPassword(username, token, password);
    assert.strictEqual(result.postParams.token, token);
    assert.strictEqual(result.postParams.password, password);
};

exports.testPublish = function() {
    app.post("/api/packages/:name/:version", function(request, name, version) {
        var [username, password] = getCredentials(request);
        return response.json({
            "postParams": request.postParams,
            "credentials": {
                "username": username,
                "password": password
            }
        });
    });
    var username = "johndoe";
    var password = "secret";
    var descriptor = {
        "name": "testpackage",
        "version": "0.1beta1"
    };
    var archivePath = module.resolve("./testpackage.zip");
    var force = true;
    var result = registry.publish(username, password, descriptor, archivePath, force);
    assert.strictEqual(result.credentials.username, username);
    assert.strictEqual(result.credentials.password, password);
    assert.deepEqual(JSON.parse(result.postParams.descriptor), descriptor);
    assert.strictEqual(JSON.parse(result.postParams.force), force);
    assert.strictEqual(result.postParams.pkg.filename, fs.base(archivePath));
};

exports.testUnpublish = function() {
    app.del("/api/packages/:name/:version", function(request, name, version) {
        var [username, password] = getCredentials(request);
        return response.json({
            "name": name,
            "version": version,
            "credentials": {
                "username": username,
                "password": password
            }
        });
    });
    var name = "testpackage";
    var version = "0.1beta1";
    var username = "johndoe";
    var password = "secret";
    var result = registry.unpublish(username, password, name, version);
    assert.strictEqual(result.credentials.username, username);
    assert.strictEqual(result.credentials.password, password);
    assert.strictEqual(result.name, name);
    assert.strictEqual(result.version, version);
};

exports.testSearch = function() {
    app.get("/api/search", function(request) {
        return response.json(request.queryParams);
    });
    var query = "ringojs";
    var result = registry.search(query);
    assert.strictEqual(result.q, query);
};

exports.testAddOwner = function() {
    app.put("/api/owners/:pkgName/:ownerName", function(request, pkgName, ownerName) {
        var [username, password] = getCredentials(request);
        return response.json({
            "pkgName": pkgName,
            "ownerName": ownerName,
            "credentials": {
                "username": username,
                "password": password
            }
        });
    });
    var pkgName = "testpackage";
    var ownerName = "janedoe";
    var username = "johndoe";
    var password = "secret";
    var result = registry.addOwner(username, password, pkgName, ownerName);
    assert.strictEqual(result.credentials.username, username);
    assert.strictEqual(result.credentials.password, password);
    assert.strictEqual(result.pkgName, pkgName);
    assert.strictEqual(result.ownerName, ownerName);
};

exports.testRemoveOwner = function() {
    app.del("/api/owners/:pkgName/:ownerName", function(request, pkgName, ownerName) {
        var [username, password] = getCredentials(request);
        return response.json({
            "pkgName": pkgName,
            "ownerName": ownerName,
            "credentials": {
                "username": username,
                "password": password
            }
        });
    });
    var pkgName = "testpackage";
    var ownerName = "janedoe";
    var username = "johndoe";
    var password = "secret";
    var result = registry.removeOwner(username, password, pkgName, ownerName);
    assert.strictEqual(result.credentials.username, username);
    assert.strictEqual(result.credentials.password, password);
    assert.strictEqual(result.pkgName, pkgName);
    assert.strictEqual(result.ownerName, ownerName);
};

exports.testGetPackages = function() {
    app.get("/api/packages", function(request) {
        return response.json([]);
    });
    var result = registry.getPackages();
    assert.isTrue(Array.isArray(result));
    assert.strictEqual(result.length, 0);
};

exports.testGetUpdates = function() {
    app.get("/api/updates", function(request) {
        return response.json(request.headers["if-modified-since"]);
    });
    var lastUpdate = new Date(Date.now());
    lastUpdate.setMilliseconds(0);
    var result = registry.getUpdates(lastUpdate);
    var sdf = new java.text.SimpleDateFormat("EEE, dd MMM yyyy HH:mm:ss zz");
    sdf.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
    var ifModifiedSince = new Date(sdf.parse(result).getTime());
    assert.strictEqual(lastUpdate.getTime(), ifModifiedSince.getTime());
    assert.strictEqual(lastUpdate.toString(), ifModifiedSince.toString());
};

//start the test runner if we're called directly from command line
if (require.main == module.id) {
    var {run} = require("test");
    if (system.args.length > 1) {
        system.exit(run(exports, system.args.pop()));
    }
    system.exit(run(exports));
}
