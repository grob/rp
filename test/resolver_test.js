var assert = require("assert");
var {Resolver} = require("../lib/rp/utils/resolver");
var registry = require("../lib/rp/utils/registry");
var semver = require("../lib/rp/utils/semver");

exports.testToVersion = function() {
    var versions = [
        "0.0.0",
        "0.0.1",
        "0.1.0",
        "0.1.1",
        "1.0.0",
        "1.1.0",
        "1.1.1",
        "9999.9999.9999"
    ];
    for each (let version in versions) {
        var [value, tag] = semver.sanitizeVersion(version);
        assert.strictEqual(Resolver.toVersion(value), version, version);
    }
};

exports.testSanitizeRange = function() {
    var tests = [
        ["0.0.1", [">=", "0.0.1", "<=", "0.0.1"]],
        ["0.0.1 0.0.2", [">=", "0.0.1", "<=", "0.0.2"]],
        [">=0.0.1", [">=", "0.0.1", "<=", "9999.9999.9999"]],
        [">=0.0.1 0.0.2", [">=", "0.0.1", "<=", "0.0.2"]],
        ["<0.1", [">=", "0.0.0", "<", "0.1.0"]],
        [">0.0.1 <0.1", [">", "0.0.1", "<", "0.1.0"]]
    ];
    for each (let test in tests) {
        var range = Resolver.sanitizeRange(test[0]);
        assert.deepEqual(range, test[1], test[0]);
    }
};

exports.testGetMaxLow = function() {
    var tests = [
        [[">=", "0.1", ">", "0.2"], [">", "0.2"]],
        [[">", "0.1", ">=", "0.2"], [">=", "0.2"]],
        [[">=", "0.1", ">", "0.2"], [">", "0.2"]],
        [[">=", "0.1alpha1", ">=", "0.1alpha2"], [">=", "0.1alpha2"]],
        [[">", "0.1alpha1", ">=", "0.1alpha2"], [">=", "0.1alpha2"]],
        // equal versions, but different operators
        [[">=", "0.1", ">", "0.1"], [">", "0.1"]],
        [[">", "0.1", ">=", "0.1"], [">", "0.1"]],
        // equal versions, equal operators
        [[">", "0.1", ">", "0.1"], [">", "0.1"]],
    ];
    for each (let test in tests) {
        var ranges = test[0];
        var expected = test[1];
        var result = Resolver.getMaxLow.apply(null, ranges);
        // console.log("RESULT:", result.toSource(), expected.toSource());
        assert.deepEqual(result, expected, ranges.toSource());
    }
};

exports.testGetMinHigh = function() {
    var tests = [
        [["<=", "0.1", "<", "0.2"], ["<=", "0.1"]],
        [["<", "0.1", "<=", "0.2"], ["<", "0.1"]],
        [["<=", "0.2", "<", "0.1"], ["<", "0.1"]],
        [["<=", "0.1alpha1", "<=", "0.1alpha2"], ["<=", "0.1alpha1"]],
        [["<", "0.1alpha2", "<=", "0.1alpha1"], ["<=", "0.1alpha1"]],
        // equal versions, but different operators
        [["<=", "0.1", "<", "0.1"], ["<", "0.1"]],
        [["<", "0.1", "<=", "0.1"], ["<", "0.1"]],
        // equal versions, equal operators
        [["<", "0.1", "<", "0.1"], ["<", "0.1"]],
    ];
    for each (let test in tests) {
        var ranges = test[0];
        var expected = test[1];
        var result = Resolver.getMinHigh.apply(null, ranges);
        // console.log("RESULT:", result.toSource(), expected.toSource());
        assert.deepEqual(result, expected, ranges.toSource());
    }
};

exports.testIsValidRange = function() {
    var valid = [
        [">=", "0.1.0", "<", "0.1.1"],
        [">", "0.1.0", "<=", "0.1.1"],
        [">=", "0.1.0", "<=" ,"0.1.1"],
        [">=", "0.1.0", "<", "0.1.1alpha1"],
        [">", "0.1.0alpha1", "<=", "0.1.0"],
        // equal version requires >= and <= operators
        [">=", "0.1.0alpha1", "<=", "0.1.0alpha1"],
    ];
    var invalid = [
        [">=", "0.1.1", "<", "0.1.0"],
        [">", "0.1.1", "<=", "0.1.0"],
        [">=", "0.1.0alpha2", "<=", "0.1.0alpha1"],
        // equal version requires >= and <= operators
        [">", "0.1.0alpha1", "<=", "0.1.0alpha1"],
        [">=", "0.1.0alpha1", "<", "0.1.0alpha1"],
    ];
    for each (let test in valid) {
        assert.isTrue(Resolver.isValidRange.apply(null, test), test.toSource());
    }
    for each (let test in invalid) {
        assert.isFalse(Resolver.isValidRange.apply(null, test), test.toSource());
    }
};

exports.testEngineDependencies = function() {
    registry.cache.set({
       "A": {
           "name": "A",
           "versions": {
               "name": "A",
               "version": "0.1.0",
               "engines": {
                   "ringojs": "0.1"
               }
           }
       }
    });
    var resolver = new Resolver(registry);
    assert.throws(function() {
        resolver.resolve("A", "0.1");
    }, Error);
};

exports.testResolveNoDependencies = function() {
    registry.cache.set({
        "A": {
            "name": "A",
            "versions": [
                {
                    "name": "A",
                    "version": "0.1.0"
                }
            ]
        },
        "B": {
            "name": "B",
            "versions": [
                {
                    "name": "B",
                    "version": "0.1.0"
                }
            ]
        }
    });

    var resolver = new Resolver(registry);
    resolver.resolve("A", "0.1");
    assert.strictEqual(resolver.size(), 1);
    assert.strictEqual(resolver.resolved["A"].countDependants(), 0);
    resolver.resolve("B", "0.1");
    assert.strictEqual(resolver.size(), 2);
    assert.strictEqual(resolver.resolved["B"].countDependants(), 0);
};

exports.testSingleDependency = function() {
    registry.cache.set({
        "A": {
            "name": "A",
            "versions": [
                {
                    "name": "A",
                    "version": "0.1.0",
                    "dependencies": {
                        "B": "0.1.0"
                    }
                }
            ]
        },
        "B": {
            "name": "B",
            "versions": [
                {
                    "name": "B",
                    "version": "0.1.0"
                }
            ]
        }
    });
    var resolver = new Resolver(registry);
    var [name, version] = ["A", "0.1.0"];
    // resolve the same twice - just to be sure nothing breaks
    resolver.resolve(name, version);
    resolver.resolve(name, version);
    var {A, B} = resolver.resolved;
    assert.strictEqual(resolver.size(), 2);
    assert.strictEqual(A.version, version);
    assert.strictEqual(B.version, version);
    assert.strictEqual(A.countDependants(), 0);
    assert.strictEqual(B.countDependants(), 1);

};

exports.testMissingDependency = function() {
    registry.cache.set({
        "A": {
            "name": "A",
            "versions": [
                {
                    "name": "A",
                    "version": "0.1.0",
                    "dependencies": {
                        // there is no greater version than 0.1
                        "B": "> 0.1.0"
                    }
                }
            ]
        },
        "B": {
            "name": "B",
            "versions": [
                {
                    "name": "B",
                    "version": "0.1.0"
                }
            ]
        }
    });
    var resolver = new Resolver(registry);
    assert.throws(function() {
        resolver.resolve("A", "0.1");
    });
};

exports.testSimpleCircular = function() {
    registry.cache.set({
        "A": {
            "name": "A",
            "versions": [
                {
                    "name": "A",
                    "version": "0.1.0",
                    "dependencies": {
                        "B": ">= 0.1.0"
                    }
                }
            ]
        },
        "B": {
            "name": "B",
            "versions": [
                {
                    "name": "B",
                    "version": "0.1.0",
                    "dependencies": {
                        "A": ">= 0.0.5"
                    }
                }
            ]
        }
    });
    var resolver = new Resolver(registry);
    resolver.resolve("A", "0.1");
    var {A, B} = resolver.resolved;
    assert.strictEqual(resolver.size(), 2);
    assert.strictEqual(A.version, "0.1.0");
    assert.strictEqual(B.version, "0.1.0");
    assert.strictEqual(A.countDependants(), 1);
    assert.strictEqual(B.countDependants(), 1);

    resolver = new Resolver(registry, Resolver.MODE_LATEST_COMPATIBLE);
    resolver.resolve("A", "0.1");
    var {A, B} = resolver.resolved;
    assert.strictEqual(resolver.size(), 2);
    assert.strictEqual(A.version, "0.1.0");
    assert.strictEqual(B.version, "0.1.0");
};

exports.testCircularMultipleVersions = function() {
    registry.cache.set({
        "A": {
            "name": "A",
            "versions": [
                {
                    "name": "A",
                    "version": "0.2.0",
                    "dependencies": {
                        "B": ">= 0.2.0"
                    }
                },
                {
                    "name": "A",
                    "version": "0.1.0",
                    "dependencies": {
                        "B": ">= 0.1.0"
                    }
                }
            ]
        },
        "B": {
            "name": "B",
            "versions": [
                {
                    "name": "B",
                    "version": "0.2.0",
                    "dependencies": {
                        "A": ">= 0.1.0"
                    }
                },
                {
                    "name": "B",
                    "version": "0.1.0",
                    "dependencies": {
                        "A": ">= 0.1.0"
                    }
                }
            ]
        }
    });
    var resolver = new Resolver(registry);
    resolver.resolve("A", "0.1");
    var {A, B} = resolver.resolved;
    assert.strictEqual(resolver.size(), 2);
    assert.strictEqual(A.version, "0.2.0");
    assert.strictEqual(B.version, "0.2.0");
    assert.strictEqual(A.countDependants(), 1);
    assert.strictEqual(B.countDependants(), 1);

    resolver = new Resolver(registry, Resolver.MODE_LATEST_COMPATIBLE);
    resolver.resolve("A", "0.1");
    var {A, B} = resolver.resolved;
    assert.strictEqual(resolver.size(), 2);
    assert.strictEqual(A.version, "0.2.0");
    assert.strictEqual(B.version, "0.2.0");
};

exports.testCircularCompatible = function() {
    registry.cache.set({
        "A": {
            "name": "A",
            "versions": [
                {
                    "name": "A",
                    "version": "0.2.0",
                    "dependencies": {
                        "B": "0.1.0"
                    }
                },
                {
                    "name": "A",
                    "version": "0.1.0",
                    "dependencies": {
                        "B": "0.1.0"
                    }
                }
            ]
        },
        "B": {
            "name": "B",
            "versions": [
                {
                    "name": "B",
                    "version": "0.1.0",
                    "dependencies": {
                        "A": "0.2.0"
                    }
                }
            ]
        }
    });
    var resolver = new Resolver(registry);
    resolver.resolve("A", "0.1");
    var {A, B} = resolver.resolved;
    assert.strictEqual(resolver.size(), 2);
    assert.strictEqual(A.countDependants(), 1);
    assert.strictEqual(A.version, "0.2.0");
    assert.strictEqual(B.countDependants(), 1);

    resolver = new Resolver(registry, Resolver.MODE_LATEST_COMPATIBLE);
    resolver.resolve("A", "0.1");
    var {A, B} = resolver.resolved;
    assert.strictEqual(resolver.size(), 2);
    assert.strictEqual(A.version, "0.2.0");
};

exports.testCircularUpgrade = function() {
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
                    "version": "0.1.0",
                    "dependencies": {
                        "B": "0.1.0"
                    }
                }
            ]
        },
        "B": {
            "name": "B",
            "versions": [
                {
                    "name": "B",
                    "version": "0.1.0",
                    "dependencies": {
                        "A": ">= 1.0"
                    }
                }
            ]
        }
    });
    var resolver = new Resolver(registry);
    resolver.resolve("A", "0.1");
    var {A, B} = resolver.resolved;
    assert.strictEqual(resolver.size(), 2);
    assert.strictEqual(A.countDependants(), 1);
    assert.strictEqual(A.version, "1.0.0");
    assert.strictEqual(B.countDependants(), 1);
    assert.strictEqual(B.version, "0.1.0");

    resolver = new Resolver(registry, Resolver.MODE_LATEST_COMPATIBLE);
    assert.throws(function() {
        resolver.resolve("A", "0.1");
    });
};

exports.testComplexSolvable = function() {
    registry.cache.set({
        "A": {
            "name": "A",
            "versions": [
                {
                    "name": "A",
                    "version": "0.1.0",
                    "dependencies": {
                        "B": "0.1.0",
                        "C": "> 0.7"
                    }
                }
            ]
        },
        "B": {
            "name": "B",
            "versions": [
                {
                    "name": "B",
                    "version": "0.1.0",
                    "dependencies": {
                        "C": ">= 1.0 < 2.0"
                    }
                }
            ]
        },
        "C": {
            "name": "C",
            "versions": [
                {
                    "name": "C",
                    "version": "1.1.0"
                },
                {
                    "name": "C",
                    "version": "0.7.0"
                }
            ]
        }
    });
    var resolver = new Resolver(registry);
    resolver.resolve("A", "0.1");
    var {A, B, C} = resolver.resolved;
    assert.strictEqual(resolver.size(), 3);
    assert.strictEqual(A.countDependants(), 0);
    assert.strictEqual(B.countDependants(), 1);
    assert.strictEqual(C.countDependants(), 2);
    assert.strictEqual(A.version, "0.1.0");
    assert.strictEqual(B.version, "0.1.0");
    assert.strictEqual(C.version, "1.1.0");

    resolver = new Resolver(registry, Resolver.MODE_LATEST_COMPATIBLE);
    resolver.resolve("A", "0.1");
    var {A, B, C} = resolver.resolved;
    assert.strictEqual(A.version, "0.1.0");
    assert.strictEqual(B.version, "0.1.0");
    assert.strictEqual(C.version, "1.1.0");
};

exports.testComplex3unsolvable = function() {
    registry.cache.set({
        "A": {
            "name": "A",
            "versions": [
                {
                    "name": "A",
                    "version": "0.1.0",
                    "dependencies": {
                        "B": "0.1.0",
                        "C": "0.7"
                    }
                }
            ]
        },
        "B": {
            "name": "B",
            "versions": [
                {
                    "name": "B",
                    "version": "0.1.0",
                    "dependencies": {
                        "C": ">= 1.0 < 2.0"
                    }
                }
            ]
        },
        "C": {
            "name": "C",
            "versions": [
                {
                    "name": "C",
                    "version": "1.1.0"
                },
                {
                    "name": "C",
                    "version": "0.7.0"
                }
            ]
        }
    });
    var resolver = new Resolver(registry);
    assert.throws(function() {
        resolver.resolve("A", "0.1");
    });

    resolver = new Resolver(registry, Resolver.MODE_LATEST_COMPATIBLE);
    assert.throws(function() {
        resolver.resolve("A", "0.1");
    });
};

exports.testCircular3 = function() {
    registry.cache.set({
        "A": {
            "name": "A",
            "versions": [
                {
                    "name": "A",
                    "version": "0.1.0",
                    "dependencies": {
                        "B": "0.1.0"
                    }
                }
            ]
        },
        "B": {
            "name": "B",
            "versions": [
                {
                    "name": "B",
                    "version": "0.1.0",
                    "dependencies": {
                        "C": ">= 0.1.0"
                    }
                }
            ]
        },
        "C": {
            "name": "C",
            "versions": [
                {
                    "name": "C",
                    "version": "0.1.1",
                    "dependencies": {
                        "A": ">= 0.1.0"
                    }
                }
            ]
        }
    });
    var resolver = new Resolver(registry);
    resolver.resolve("A", "0.1");
    var {A, B, C} = resolver.resolved;
    assert.strictEqual(resolver.size(), 3);
    assert.strictEqual(A.version, "0.1.0");
    assert.strictEqual(B.version, "0.1.0");
    assert.strictEqual(C.version, "0.1.1");
    [A, B, C].forEach(function(pkg) {
        assert.strictEqual(pkg.countDependants(), 1);
    });

    resolver = new Resolver(registry, Resolver.MODE_LATEST_COMPATIBLE);
    resolver.resolve("A", "0.1");
    var {A, B, C} = resolver.resolved;
    assert.strictEqual(A.version, "0.1.0");
    assert.strictEqual(B.version, "0.1.0");
    assert.strictEqual(C.version, "0.1.1");
};

exports.testComplex3solvable = function() {
    registry.cache.set({
        "A": {
            "name": "A",
            "versions": [
                {
                    "name": "A",
                    "version": "0.3.0",
                    "dependencies": {
                        "B": ">= 0.1 <= 0.3",
                        "C": ">= 0.1.0"
                    }
                },
                {
                    "name": "A",
                    "version": "0.1.0",
                    "dependencies": {
                        "B": ">= 0.1 <= 0.2",
                        "C": ">= 0.1.0"
                    }
                }
            ]
        },
        "B": {
            "name": "B",
            "versions": [
                {
                    "name": "B",
                    "version": "0.2beta3",
                    "dependencies": {
                        "C": ">= 0.2",
                        "A": "0.1"
                    }
                },
                {
                    "name": "B",
                    "version": "0.1.0"
                }
            ]
        },
        "C": {
            "name": "C",
            "versions": [
                {
                    "name": "C",
                    "version": "0.2",
                    "dependencies": {
                        "A": ">= 0.1",
                        "B": "< 0.3"
                    }
                }
            ]
        }
    });
    var resolver = new Resolver(registry);
    resolver.resolve("A", "0.1");
    var {A, B, C} = resolver.resolved;
    assert.strictEqual(resolver.size(), 3);
    assert.strictEqual(A.version, "0.1.0");
    assert.strictEqual(B.version, "0.2beta3");
    assert.strictEqual(C.version, "0.2");
    [A, B, C].forEach(function(pkg) {
        assert.strictEqual(pkg.countDependants(), 2);
    });

    resolver = new Resolver(registry, Resolver.MODE_LATEST_COMPATIBLE);
    resolver.resolve("A", "0.1");
    var {A, B, C} = resolver.resolved;
    assert.strictEqual(A.version, "0.3.0");
    assert.strictEqual(B.version, "0.2beta3");
    assert.strictEqual(C.version, "0.2");
};

exports.testComplex3solvable2 = function() {
    registry.cache.set({
        "A": {
            "name": "A",
            "versions": [
                {
                    "name": "A",
                    "version": "0.1.0",
                    "dependencies": {
                        "B": ">= 0.1 <= 0.2",
                        "C": ">= 0.1.0 <= 0.2"
                    }
                }
            ]
        },
        "B": {
            "name": "B",
            "versions": [
                {
                    "name": "B",
                    "version": "0.2beta3",
                    "dependencies": {
                        "C": ">= 0.2"
                    }
                }
            ]
        },
        "C": {
            "name": "C",
            "versions": [
                {
                    "name": "C",
                    "version": "0.3",
                    "dependencies": {}
                },
                {
                    "name": "C",
                    "version": "0.2",
                    "dependencies": {
                        "A": ">= 0.1",
                        "B": "< 0.3"
                    }
                }
            ]
        }
    });
    var resolver = new Resolver(registry);
    resolver.resolve("A", "0.1");
    var {A, B, C} = resolver.resolved;
    assert.strictEqual(resolver.size(), 3);
    assert.strictEqual(A.version, "0.1.0");
    assert.strictEqual(B.version, "0.2beta3");
    assert.strictEqual(C.version, "0.2");

    resolver = new Resolver(registry, Resolver.MODE_LATEST_COMPATIBLE);
    resolver.resolve("A", "0.1");
    var {A, B, C} = resolver.resolved;
    assert.strictEqual(A.version, "0.1.0");
    assert.strictEqual(B.version, "0.2beta3");
    assert.strictEqual(C.version, "0.3");
};



//start the test runner if we're called directly from command line
if (require.main == module.id) {
    var {run} = require("test");
    if (system.args.length > 1) {
        system.exit(run(exports, system.args.pop()));
    }
    system.exit(run(exports));
}
