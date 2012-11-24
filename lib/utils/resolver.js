var semver = require("./semver");
var descriptors = require("./descriptors");
var log = require("ringo/logging").getLogger(module.id);
var {version} = require("ringo/engine");

const ENGINE_VERSION = semver.cleanVersion(version.join("."));

var Resolver = exports.Resolver = function(registry, mode) {

    var resolved = {};
    var visited = {};

    Object.defineProperties(this, {
        "resolved": {
            "get": function() {
                return resolved;
            }
        },
        "visited": {
            "get": function() {
                return visited;
            }
        },
        "registry": {
            "get": function() {
                return registry;
            }
        },
        "mode": {
            "get": function() {
                return mode || Resolver.MODE_STRICT;
            }
        }
    });

    return this;
};

Resolver.MODE_STRICT = "resolveStrict";
Resolver.MODE_LATEST_COMPATIBLE = "resolveLatestCompatible";

Resolver.toVersion = function(nr) {
    var base = 10000;
   	var arr = [0, 0, 0];
   	while (nr > 0) {
   		var exp = Math.floor(Math.log(nr) / Math.log(base));
   		var fact = Math.pow(base, exp);
   		var value = arr[arr.length - exp - 1] = Math.floor(nr / fact);
   		nr -= value * fact;
   	}
   	return arr.join(".");
};

Resolver.sanitizeRange = function(range) {
    var [opLow, versionLow, opHigh, versionHigh] = semver.parseRange(range);
    if (opLow === null) {
        // exact version dependency, convert into range
        opLow = ">=";
        opHigh = "<=";
        versionHigh = versionHigh || versionLow;
    } else if (opLow.charAt(0) === "<") {
        // missing lower border
        opHigh = opLow;
        versionHigh = versionLow;
        opLow = ">=";
        versionLow = "0"
    } else if (versionHigh == null) {
        opHigh = "<=";
        versionHigh = "9999.9999.9999";
    } else {
        opHigh = opHigh || "<=";
        versionHigh = versionHigh || versionLow;
    }
    return [opLow, semver.cleanVersion(versionLow), opHigh, semver.cleanVersion(versionHigh)];
};

Resolver.adjustRange = function(range1, range2) {
    var [opLowA, versionLowA, opHighA, versionHighA] = Resolver.sanitizeRange(range1);
    var [opLowB, versionLowB, opHighB, versionHighB] = Resolver.sanitizeRange(range2);
    var [opLow, versionLow] = Resolver.getMaxLow(opLowA, versionLowA, opLowB, versionLowB);
    var [opHigh, versionHigh] = Resolver.getMinHigh(opHighA, versionHighA, opHighB, versionHighB);
    var range = [opLow, versionLow, opHigh, versionHigh];
    if (!Resolver.isValidRange(range)) {
        throw new Error("Invalid range: " + range.join(" "));
    }
    return range;
};

Resolver.isValidRange = function(opLow, versionLow, opHigh, versionHigh) {
    return semver.isLower(versionLow, versionHigh) ||
            (semver.isEqual(versionLow, versionHigh) && (opLow === ">=" && opHigh === "<="));
};

Resolver.getMaxLow = function(opA, versionA, opB, versionB) {
    if (semver.isEqual(versionA, versionB)) {
        return (opA === ">=") ? [opB, versionB] : [opA, versionA];
    } else if (semver.isGreater(versionA, versionB)) {
        return [opA, versionA];
    }
    return [opB, versionB];
};

Resolver.getMinHigh = function(opA, versionA, opB, versionB) {
    if (semver.isEqual(versionA, versionB)) {
        return (opA === "<=") ? [opB, versionB] : [opA, versionA];
    } else if (semver.isLower(versionA, versionB)) {
        return [opA, versionA];
    }
    return [opB, versionB];
};

Resolver.isExact = function(range) {
    var [opLow, versionLow, opHigh, versionHigh] = semver.parseRange(range);
    return opLow == null && opHigh == null && versionHigh == null;
};

Resolver.prototype.isStrict = function() {
    return this.mode === Resolver.MODE_STRICT;
};

Resolver.prototype.hasResolved = function(name) {
    return this.resolved.hasOwnProperty(name) && this.resolved[name] != null;
};

Resolver.prototype.getResolved = function(name) {
    if (this.hasResolved(name)) {
        return this.resolved[name]
    }
    return null;
};

Resolver.prototype.addResolved = function(pkg) {
    log.debug("Adding", pkg.name, pkg.version, "to resolved packages");
    this.resolved[pkg.name] = pkg;
};

Resolver.prototype.hasVisited = function(name, version) {
    return this.visited.hasOwnProperty(name) && this.visited[name] === version;
};

Resolver.prototype.visit = function(name, version) {
    this.visited[name] = version;
    return;
};

Resolver.prototype.size = function() {
    return Object.keys(this.resolved).length;
};

Resolver.prototype.getDescriptors = function() {
    return Object.keys(this.resolved).map(function(name) {
        return this.resolved[name].descriptor;
    }, this);
};

Resolver.prototype.resolve = function(name, range, dependant) {
    // get package descriptor from registry - if range is not specified,
    // this will return the latest version of the package
    log.debug("Resolving", name, "(" + range + "), dependant:", dependant);
    var descriptor = this.registry.getPackageDescriptor(name, range);
    var resolved = this.getResolved(name);
    if (this.hasVisited(descriptor.name, descriptor.version)) {
        if (dependant) {
            resolved.addDependant(name, range, dependant);
        }
        return;
    }
    // check if engine requirements are specified and met
    if (descriptors.hasEngineDependency(descriptor)) {
        descriptors.verifyEngineDependency(descriptor, ENGINE_VERSION);
    }

	if (resolved === null) {
		// package wasn't required until now - add it to resolved ones
        resolved = new Resolved(descriptor);
		// add the resolved package to the resolver
		this.addResolved(resolved);
	} else {
		// package was already required by another package
        if (this.isStrict()) {
            descriptor = this.resolveStrict(resolved, descriptor, range);
        } else {
            descriptor = this.resolveLatestCompatible(resolved, descriptor, range);
        }
	}
    resolved.addDependant(name, range, dependant);
    // add this package to the visited ones - needed to detect circular dependencies
    this.visit(descriptor.name, descriptor.version);
    // resolve the dependencies of the newly added package
    this.resolveDependencies(resolved);
};

Resolver.prototype.resolveDependencies = function(resolved) {
    var dependencies = resolved.descriptor.dependencies;
    if (dependencies != null) {
        log.debug("Resolving dependencies of", resolved.name,
                resolved.version, "...");
        for (let [depName, depRange] in Iterator(dependencies)) {
            log.debug("Package", resolved.name, resolved.version, "requires",
                    depName, depRange + ", resolving...");
       		this.resolve(depName, depRange, resolved);
       	}
    }
};

Resolver.prototype.resolveStrict = function(resolved, descriptor, range) {
    // loop over all dependants of the until-now resolved package and check
    // if their range matches the descriptor received - if so we can safely
    // use this one
    log.debug("-- Strategy: STRICT");
    log.debug("Trying to resolve package", descriptor.name, descriptor.version);
    log.debug("Currently resolved package", resolved.name, resolved.version);
    if (resolved.countDependants() > 0) {
        for each (var dep in resolved.requiredBy) {
            log.debug("Checking dependency", dep);
            if (!semver.satisfies(descriptor.version, dep.range)) {
                // TODO: list dependants/dependencies
                throw new Error("Unsolvable dependency");
            }
        }
    }
    // check which package version is higher, and add the higher one to the resolved ones
    if (!semver.isEqual(descriptor.version, resolved.version)) {
        log.debug("Up/downgrading", resolved.name, resolved.version, "to", descriptor.version);
        resolved.resetTo(descriptor);
    }
    return descriptor;
};

Resolver.prototype.resolveLatestCompatible = function(resolved, descriptor, range) {
    log.debug("-- Strategy: LATEST COMPATIBLE");
    log.debug("Trying to resolve package", descriptor.name, descriptor.version);
    log.debug("Currently resolved package", resolved.name, resolved.version);
    if (!semver.isCompatible(resolved.version, descriptor.version)) {
        // the highest version according to dependency range isn't compatible
        // with the one already registered - get the highest version compatible
        // to the registered one and check if it's still satisfied by the
        // dependency range
        descriptor = this.registry.getLatestCompatible(descriptor.name, resolved.version);
        if (!semver.satisfies(descriptor.version, range)) {
            // the highest compatible version of the resolved dep isn't within
            // the range bail out, since this isn't resolvable
            // TODO: list dependants/dependencies
            throw new Error("Unsolvable dependency");
        }
    }
    // check which package version is higher, and add the higher one to the resolved ones
    if (semver.isGreater(descriptor.version, resolved.version)) {
        log.debug("Upgrading", resolved.name, resolved.version, "to", descriptor.version);
        resolved.resetTo(descriptor);
    }
    return descriptor;
};





var Resolved = exports.Resolved = function(descriptor) {

    var requiredBy = {};

    this.resetTo = function(d) {
        descriptor = d;
    };

    Object.defineProperties(this, {
        "name": {
            "get": function() {
                return descriptor.name;
            }
        },
        "version": {
            "get": function() {
                return descriptor.version;
            }
        },
        "descriptor": {
            "get": function() {
                return descriptor;
            }
        },
        "requiredBy": {
            "get": function() {
                return requiredBy;
            }
        }
    });

    return this;
};

/** @ignore */
Resolved.prototype.toString = function() {
    return "[Resolved (" + this.name + " " + this.version + ")]";
};

Resolved.prototype.countDependants = function() {
    return Object.keys(this.requiredBy).length;
};

Resolved.prototype.hasDependants = function() {
    return this.countDependants() > 0;
};

Resolved.prototype.addDependant = function(name, range, dependant) {
    if (!dependant) {
        return;
    }
    var dependency = new Dependency(dependant.name, dependant.version,
            name, range);
    log.debug("Adding dependency", dependency, "to dependants of", this.name);
    this.requiredBy[dependency.from] = dependency;
};






var Dependency = function(from, fromVersion, to, range) {

    Object.defineProperties(this, {
        "from": {
            "value": from
        },
        "fromVersion": {
            "value": fromVersion
        },
        "to": {
            "value": to
        },
        "range": {
            "value": range
        }
    });

    return this;
};

Dependency.prototype.toString = function() {
    return ["[" + this.from, this.fromVersion, "->", this.to,
        this.range + "]"].join(" ");
};
