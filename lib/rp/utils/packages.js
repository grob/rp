var fs = require("fs");
var log = require("ringo/logging").getLogger(module.id);
var compress = require("./compress");
var registry = require("./registry");

export("isActivated", "isInstalled", "install", "uninstall", "activate",
        "deactivate", "getDescriptor", "getPackagesDir", "getInstallDir",
        "resolveDependencies");

function getInstallDir(name, version) {
    var dir = fs.join(system.prefix, "packages.available");
    if (name && version) {
        dir = fs.join(dir, name + "-" + version);
    }
    return dir;
}

function getPackagesDir() {
    return fs.join(system.prefix, "packages");
}

function isInstalled(name, version) {
    return fs.exists(getInstallDir(name, version));
}

function isActivated(name) {
    return fs.exists(fs.join(getPackagesDir(), name));
}

function getDescriptor(dir) {
    var jsonPath = fs.join(dir, "package.json");
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
    if (!fs.exists(installDir)) {
        throw new Error("The package " + name + " " + version + " isn't installed");
    }
    var src = fs.relative(fs.join(system.prefix, "packages/"), installDir);
    var dest = fs.join(getPackagesDir(), name);
    if (fs.exists(dest)) {
        // bail out if link points to a different package version
        var activePackage = getDescriptor(fs.readLink(dest));
        if (activePackage != null && activePackage.version != version) {
            throw new Error("A different version (" + activePackage.version +
                    ") of package " + name +
                    " is currently active, please clean up manually");
        }
        fs.remove(dest);
    }
    fs.symbolicLink(src, dest);
    log.debug("Activated package", name);
    return dest;
}

function deactivate(name) {
    var path = fs.join(getPackagesDir(), name);
    if (!fs.exists(path)) {
        throw new Error("The package" + name + " is not activated");
    } else if (!fs.isLink(path)) {
        throw new Error("Package " + name +
                " has been copied into packages directory, please move it away manually");
    }
    fs.remove(path);
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
            // FIXME: getPackageDescriptor does semver.satisfies() again ...
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
