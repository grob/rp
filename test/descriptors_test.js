var assert = require("assert");
var descriptors = require("../lib/rp/utils/descriptors");

exports.testCheckName = function() {
    assert.throws(function() {
        descriptors.checkName(null);
    });
    assert.throws(function() {
        descriptors.checkName(undefined);
    });
    assert.throws(function() {
        descriptors.checkName("invalid?");
    });
    descriptors.checkName("abc0123456789._- ");
};

exports.testCheckVersion = function() {
    assert.throws(function() {
        descriptors.checkVersion(null);
    });
    assert.throws(function() {
        descriptors.checkVersion(undefined);
    });
    assert.throws(function() {
        descriptors.checkVersion("<> 1.2.3.4");
    });
};

exports.testCheckKeywords = function() {
    assert.throws(function() {
        descriptors.checkKeywords();
    });
    assert.throws(function() {
        descriptors.checkKeywords(null);
    });
    assert.throws(function() {
        descriptors.checkKeywords({});
    });
    assert.throws(function() {
        descriptors.checkKeywords([]);
    });
};

exports.testCheckEngines = function() {
    assert.throws(function() {
        descriptors.checkEngines();
    });
    assert.throws(function() {
        descriptors.checkEngines(null);
    });
    assert.throws(function() {
        descriptors.checkEngines(["ringojs", "rhino"]);
    });
};

exports.testCheckDependencies = function() {
    assert.throws(function() {
        descriptors.checkDependencies();
    });
    assert.throws(function() {
        descriptors.checkDependencies(null);
    });
    // invalid version number
    assert.throws(function() {
        descriptors.checkDependencies({
            "rp": "!= 1.2.3.4."
        });
    });
    assert.isTrue(descriptors.checkDependencies({
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
        descriptors.checkEngineDependency({
            "name": "test",
            "engines": {
                "ringojs": ">= 0.8"
            }
        }, "0.7");
    });
    assert.isTrue(descriptors.checkEngineDependency({
        "name": "test",
        "engines": {
            "ringojs": ">= 0.8"
        }
    }, "0.8"));
};

exports.testCheckAuthorData = function() {
    assert.throws(function() {
        descriptors.checkAuthorData();
    });
    assert.throws(function() {
        descriptors.checkAuthorData(null);
    });
    assert.throws(function() {
        descriptors.checkAuthorData({
            "noname": "no name"
        });
    });
    assert.isTrue(descriptors.checkAuthorData("John Doe"));
    assert.isTrue(descriptors.checkAuthorData({
        "name": "John Doe"
    }));
};

exports.testCheckAuthor = function() {
    assert.throws(function() {
        descriptors.checkAuthor();
    });
    assert.throws(function() {
        descriptors.checkAuthor(null);
    });
    assert.throws(function() {
        descriptors.checkAuthor({});
    });
    assert.isTrue(descriptors.checkAuthor({
        "author": "John Doe"
    }));
    assert.isTrue(descriptors.checkAuthor({
        "contributors": ["John Doe"]
    }));
};

exports.testCheckHashList = function() {
    assert.throws(function() {
        descriptors.checkHashList();
    });
    assert.throws(function() {
        descriptors.checkHashList(null);
    });
    assert.throws(function() {
        descriptors.checkHashList([]);
    });
    assert.throws(function() {
        descriptors.checkHashList([{}]);
    });
    assert.throws(function() {
        descriptors.checkHashList([{"prop": "value"}], "test", ["nonexisting"]);
    });
    assert.isTrue(descriptors.checkHashList([{"prop": "value"}], "test", ["prop"]));
};

exports.testCheckRepositories = function() {
    assert.throws(function() {
        descriptors.checkRepositories([{"type": "git"}]);
    });
    assert.throws(function() {
        descriptors.checkRepositories([{"url": "somewhere"}]);
    });
    assert.isTrue(descriptors.checkRepositories([{
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
        descriptors.checkLicenses([{"type": "git"}]);
    });
    assert.throws(function() {
        descriptors.checkLicenses([{"url": "somewhere"}]);
    });
    assert.isTrue(descriptors.checkLicenses([{
            "type": "git",
            "url": "somewhere"
        },
        {
            "type": "svn",
            "url": "somewhere"
        }
    ]));
};

//start the test runner if we're called directly from command line
if (require.main == module.id) {
    system.exit(require('test').run(exports));
}
