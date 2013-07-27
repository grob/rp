var system = require("system");
var assert = require("assert");
var descriptors = require("../lib/utils/descriptors");

exports.testCheckName = function() {
    assert.throws(function() {
        descriptors.verifyName(null);
    });
    assert.throws(function() {
        descriptors.verifyName(undefined);
    });
    assert.throws(function() {
        descriptors.verifyName("invalid?");
    });
    descriptors.verifyName("abc0123456789._- ");
};

exports.testCheckVersion = function() {
    assert.throws(function() {
        descriptors.verifyVersion(null);
    });
    assert.throws(function() {
        descriptors.verifyVersion(undefined);
    });
    assert.throws(function() {
        descriptors.verifyVersion("<> 1.2.3.4");
    });
};

exports.testCheckKeywords = function() {
    assert.throws(function() {
        descriptors.verifyKeywords();
    });
    assert.throws(function() {
        descriptors.verifyKeywords(null);
    });
    assert.throws(function() {
        descriptors.verifyKeywords({});
    });
    assert.throws(function() {
        descriptors.verifyKeywords([]);
    });
};

exports.testCheckEngines = function() {
    assert.throws(function() {
        descriptors.verifyEngines();
    });
    assert.throws(function() {
        descriptors.verifyEngines(null);
    });
    assert.throws(function() {
        descriptors.verifyEngines(["ringojs", "rhino"]);
    });
};

exports.testCheckDependencies = function() {
    assert.throws(function() {
        descriptors.verifyDependencies();
    });
    assert.throws(function() {
        descriptors.verifyDependencies(null);
    });
    // invalid version number
    assert.throws(function() {
        descriptors.verifyDependencies({
            "rp": "!= 1.2.3.4."
        });
    });
    assert.isTrue(descriptors.verifyDependencies({
        "rp": ">= 0.1"
    }));
};

exports.testHasEngineDependency = function() {
    assert.isFalse(descriptors.hasEngineDependency({}));
    assert.isFalse(descriptors.hasEngineDependency({
        "engines": {
            "node": ">= 0.4"
        }
    }));
    assert.isFalse(descriptors.hasEngineDependency({
        "engines": {
            "ringojs": "!= 1.2.3.4."
        }
    }));
    assert.isTrue(descriptors.hasEngineDependency({
        "engines": {
            "ringojs": "0.8"
        }
    }));
};

exports.testCheckEngineDependency = function() {
    assert.throws(function() {
        descriptors.verifyEngineDependency({
            "name": "test",
            "engines": {
                "ringojs": ">= 0.8"
            }
        }, "0.7");
    });
    assert.isTrue(descriptors.verifyEngineDependency({
        "name": "test",
        "engines": {
            "ringojs": ">= 0.8"
        }
    }, "0.8"));
};

exports.testCheckAuthorData = function() {
    assert.throws(function() {
        descriptors.verifyAuthorData();
    });
    assert.throws(function() {
        descriptors.verifyAuthorData(null);
    });
    assert.throws(function() {
        descriptors.verifyAuthorData({
            "noname": "no name"
        });
    });
    assert.isTrue(descriptors.verifyAuthorData("John Doe"));
    assert.isTrue(descriptors.verifyAuthorData({
        "name": "John Doe"
    }));
};

exports.testCheckAuthor = function() {
    assert.throws(function() {
        descriptors.verifyAuthor();
    });
    assert.throws(function() {
        descriptors.verifyAuthor(null);
    });
    assert.throws(function() {
        descriptors.verifyAuthor({});
    });
    assert.isTrue(descriptors.verifyAuthor({
        "author": "John Doe"
    }));
    assert.isTrue(descriptors.verifyAuthor({
        "contributors": ["John Doe"]
    }));
};

exports.testCheckHashList = function() {
    assert.throws(function() {
        descriptors.verifyHashList();
    });
    assert.throws(function() {
        descriptors.verifyHashList(null);
    });
    assert.throws(function() {
        descriptors.verifyHashList([]);
    });
    assert.throws(function() {
        descriptors.verifyHashList([{}]);
    });
    assert.throws(function() {
        descriptors.verifyHashList([{"prop": "value"}], "test", ["nonexisting"]);
    });
    assert.isTrue(descriptors.verifyHashList([{"prop": "value"}], "test", ["prop"]));
};

exports.testCheckRepositories = function() {
    assert.throws(function() {
        descriptors.verifyRepositories([{"type": "git"}]);
    });
    assert.throws(function() {
        descriptors.verifyRepositories([{"url": "somewhere"}]);
    });
    assert.isTrue(descriptors.verifyRepositories([{
            "type": "git",
            "url": "somewhere"
        },
        {
            "type": "svn",
            "url": "somewhere"
        }
    ]));
};

exports.testCheckLicenses = function() {
    assert.throws(function() {
        descriptors.verifyLicenses([{"type": "git"}]);
    });
    assert.throws(function() {
        descriptors.verifyLicenses([{"url": "somewhere"}]);
    });
    assert.isTrue(descriptors.verifyLicenses([{
            "type": "git",
            "url": "somewhere"
        },
        {
            "type": "svn",
            "url": "somewhere"
        }
    ]));
};

exports.testSanitizeHashList = function() {
    var arr = [{"one": " one ", "two": 2, "three": "3"}];
    descriptors.sanitizeHashList(arr, ["one"]);
    assert.strictEqual(arr.length, 1);
    assert.strictEqual(Object.keys(arr[0]).length, 1);
    assert.strictEqual(Object.keys(arr[0])[0], "one");
    // string values are trimmed
    assert.strictEqual(arr[0]["one"], "one");
};

exports.testVerifyAuthor = function() {
    assert.throws(function() {
        descriptors.verifyAuthor({});
    });
    assert.throws(function() {
        descriptors.verifyAuthor({
            "author": ""
        });
    });
    assert.throws(function() {
        descriptors.verifyAuthor({
            "author": null
        });
    });
    assert.throws(function() {
        descriptors.verifyAuthor({
            "contributors": []
        });
    });
};

//start the test runner if we're called directly from command line
if (require.main == module.id) {
    var {run} = require("test");
    if (system.args.length > 1) {
        system.exit(run(exports, system.args.pop()));
    }
    system.exit(run(exports));
}
