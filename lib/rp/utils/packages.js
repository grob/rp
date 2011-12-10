var fs = require("fs");
var log = require("ringo/logging").getLogger(module.id);
var compress = require("./compress");
var registry = require("./registry");

export("isActivated", "isInstalled", "install", "uninstall", "activate",
        "deactivate", "getDescriptor", "getPackagesDir", "getInstallDir",
        "resolveDependencies", "getLatestInstalledVersion");

function getInstallDir(name, version) {
    var dir = fs.join(system.prefix, "packages.available/");
    if (name && version) {
        dir = fs.join(dir, name + "-" + version);
    }
    return fs.normal(dir);
}

function getPackagesDir() {
    return fs.normal(fs.join(system.prefix, "packages/"));
}

/**
 * Returns true if a package with the given name is installed. If a version
 * number is specified, this method returns true if the exact package version
 * is installed, otherwise it returns true if at least one version of the
 * named package is installed.
 * @param {String} name The name of the package
 * @param {String} version Optional version number
 * @returns True if the package is installed
 * @type Boolean
 */
function isInstalled(name, version) {
    if (version == undefined) {
        var list = fs.list(getInstallDir()).filter(function(dirName) {
            return dirName.substring(0, dirName.lastIndexOf("-")) == name;
        });
        return list.length > 0;
    }
    return fs.exists(getInstallDir(name, version));
}

function isActivated(name, version) {
    var link = fs.join(getPackagesDir(), name);
    if (fs.exists(link)) {
        if (version == undefined) {
            return true;
        }
        var activePackage = getDescriptor(link);
        if (activePackage != null && activePackage.version != version) {
            // bail out since a different package version is activated
            throw new Error("A different version (" + activePackage.version +
                    ") of package " + name +
                    " is currently active, please clean up manually");
        }
        return true;
    }
    return false;
}

/**
 * Returns the latest installed version of the specified package
 * @param {String} name The package name
 * @returns The latest installed version of the package
 * @type String
 */
function getLatestInstalledVersion(name) {
    var list = fs.list(getInstallDir()).filter(function(dirName) {
        return dirName.substring(0, dirName.lastIndexOf("-")) == name;
    });
    var version = null;
    if (list.length > 0) {
        if (list.length > 1) {
            semver.sort(list, -1);
        }
        version = list[0].substring(list[0].lastIndexOf("-") + 1);
    }
    return version;
}

function getDescriptor(dir) {
    var jsonPath = fs.normal(fs.join(dir, "package.json"));
    if (fs.exists(jsonPath)) {
        return JSON.parse(fs.read(jsonPath));
    }
    return null;
}

function install(archivePath, name, version) {
    var installDir = getInstallDir(name, version);
    log.debug("Installing", fs.base(archivePath), "in", installDir);
    if (!fs.exists(installDir)) {
        fs.makeTree(installDir);
        var fileStream = fs.open(archivePath, {
            "binary": true
        });
        compress.extractStream(fileStream, installDir);
        log.debug("Installed", name, " " + version + " in", fs.absolute(installDir));
    }
    return installDir;
}

function uninstall(name, version) {
    var installDir = getInstallDir(name, version);
    if (!fs.exists(installDir)) {
        throw new Error("The package " + name + " " + version + " isn't installed")
    }
    fs.removeTree(installDir);
    return installDir;
}

function activate(name, version) {
    var installDir = getInstallDir(name, version);
    var packagesDir = getPackagesDir();
    if (!fs.exists(installDir)) {
        throw new Error("The package " + name + " " + version + " isn't installed");
    }
    var src = fs.relative(packagesDir, installDir);
    var dest = fs.join(packagesDir, name);
    if (isActivated(name, version)) {
        throw new Error("The package " + name + " (v" + version + ") is already active");
    }
    fs.symbolicLink(src, dest);
    log.debug("Activated package", name);
    return dest;
}

function deactivate(name) {
    var path = fs.join(getPackagesDir(), name);
    if (!fs.exists(path)) {
        throw new Error("The package " + name + " is not activated");
    } else if (!fs.isLink(path)) {
        throw new Error("Package " + name +
                " has been copied into packages directory, please move it away manually");
    }
    // FIXME: remove() doesn't allow removing symlinks to directories
    fs.removeDirectory(path);
    return;
}

function resolveDependencies(descriptor, queue, map) {
    queue = queue || [];
    map = map || {};
    queue.push(descriptor);
    if (descriptor.dependencies != undefined) {
        var depNames = Object.keys(descriptor.dependencies).sort();
        for each (var depName in depNames) {
            var depVersion = descriptor.dependencies[depName];
            if (map.hasOwnProperty(depName)) {
                if (!semver.satisfies(depVersion, map[depName].version)) {
                    throw new Error("Dependency conflict: " + descriptor.name +
                            " depends on " + depName + " " + depVersion +
                            ", but " + map[depName].requiredBy +
                            " requires version " + map[depName].version);
                } else if (semver.isGreaterOrEqual(map[depName].version, depVersion)) {
                    // we already have a greater or equal version, continue
                    continue;
                }
            }
            var depDescriptor = registry.getPackageDescriptor(depName, depVersion);
            if (!depDescriptor) {
                throw new Error("Required package " + depName + " " +
                        depVersion + " doesn't exist in registry");
            }
            map[depDescriptor.name] = {
                "version": depDescriptor.version,
                "requiredBy": descriptor.name
            };
            resolveDependencies(depDescriptor, queue, map);
        };
    }
    return queue;
}
