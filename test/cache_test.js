var system = require("system");
var assert = require("assert");
var cache = require("../lib/utils/cache");
var fs = require("fs");
var files = require("ringo/utils/files");

var path = null;
var catalog = {
    "A": {
        "name": "A",
        "version": "0.1alpha1"
    },
    "B": {
        "name": "A",
        "version": "0.1alpha1"
    }
};

exports.tearDown = function() {
    if (path !== null && fs.exists(path)) {
        fs.remove(path);
    }
};

exports.testReadFile = function() {
    // cache file doesn't exist
    assert.throws(function() {
        cache.readFile(module.resolve("./nonexisting"));
    });
    path = files.createTempFile("rp-cache", ".json");
    // cache file is empty
    assert.throws(function() {
        cache.readFile(path);
    });
    // cache file is corrupt
    fs.write(path, "{]");
    assert.throws(function() {
        cache.readFile(path);
    });
    var contents = {
        "CATALOG_FORMAT": 0, // invalid
        "catalog": catalog
    };
    fs.write(path, JSON.stringify(contents));
    // wrong catalog format
    assert.throws(function() {
        cache.readFile(path);
    });

    contents.CATALOG_FORMAT = cache.CATALOG_FORMAT;
    fs.write(path, JSON.stringify(contents));
    assert.deepEqual(contents, cache.readFile(path));
};

exports.testWriteFile = function() {
    path = files.createTempFile("rp-cache", ".json");
    cache.set(catalog);
    cache.writeFile(path);
    var cached = JSON.parse(fs.read(path));
    assert.strictEqual(Object.keys(cached).length, 2);
    assert.strictEqual(cached.CATALOG_FORMAT, cache.CATALOG_FORMAT);
    assert.deepEqual(cached.catalog, catalog);
};

//start the test runner if we're called directly from command line
if (require.main == module.id) {
    var {run} = require("test");
    if (system.args.length > 1) {
        system.exit(run(exports, system.args.pop()));
    }
    system.exit(run(exports));
}
