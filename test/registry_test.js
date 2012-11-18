var system = require("system");
var assert = require("assert");
var registry = require("../lib/rp/utils/registry");

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
            "versions":[
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

//start the test runner if we're called directly from command line
if (require.main == module.id) {
    var {run} = require("test");
    if (system.args.length > 1) {
        system.exit(run(exports, system.args.pop()));
    }
    system.exit(run(exports));
}
