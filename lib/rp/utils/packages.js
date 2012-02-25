var fs = require("fs");
var log = require("ringo/logging").getLogger(module.id);
var compress = require("./compress");
var registry = require("./registry");
var config = require("./config");
var semver = require("./semver");
var os = require("./os");
var strings = require("ringo/utils/strings");
var descriptors = require("./descriptors");
var engine = require("ringo/engine");

export("isActivated", "isInstalled", "install", "uninstall", "activate",
        "deactivate", "getDescriptor", "getPackagesDir", "getInstallDir",
        "getInstalledVersions", "getLatestInstalledVersion", "getActivatedVersions",
        "getLatestInstalledVersions", "getActivatedVersion", "isManaged",
        "checkEngineDependencies");

function getInstallDir(name, version) {
    var dir = fs.join(config.ringoHome, "/packages.available/");
    if (name && version) {
        dir = fs.join(dir, name + "-" + version);
    }
    return fs.normal(dir);
}

function getPackagesDir() {
    return fs.normal(fs.join(config.ringoHome, "/packages/"));
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
        return getInstalledVersions(name).length > 0;
    }
    return fs.exists(getInstallDir(name, version));
}

/**
 * Returns true if the link in package directory points to a module
 * installed in packages.available
 * @param {String} path The directory containing the module
 * @returns True if the package seems to be installed by rp, false otherwise
 * @type Boolean
 */
function isManaged(path) {
    var linkTarget = fs.resolve(getPackagesDir(), fs.readLink(path));
    return strings.startsWith(linkTarget, getInstallDir());
}

function isActivated(name, version) {
    var activatedVersion = getActivatedVersion(name);
    if (activatedVersion !== null) {
        if (version == undefined) {
            return true;
        }
        return activatedVersion == version;
    }
    return false;
}

function getInstalledVersions(name) {
    var list = fs.list(getInstallDir()).filter(function(dirName) {
        return dirName.substring(0, dirName.lastIndexOf("-")) == name;
    }).map(function(dirName) {
        return dirName.substring(dirName.lastIndexOf("-") + 1);
    });
    if (list.length > 1) {
        semver.sort(list, -1);
    }
    return list;
}

/**
 * Returns the latest installed version of the specified package
 * @param {String} name The package name
 * @returns The latest installed version of the package
 * @type String
 */
function getLatestInstalledVersion(name) {
    return getInstalledVersions(name)[0] || null;
}

function getLatestInstalledVersions() {
    var result = {};
    var list = fs.list(getInstallDir());
    for each (let dirName in list) {
        if (strings.startsWith(dirName, ".")) {
            continue;
        }
        var descriptor = getDescriptor(fs.join(getInstallDir(), dirName));
        if (descriptor === null) {
            continue;
        }
        if (!Object.hasOwnProperty(result, descriptor.name) ||
                !semver.isGreater(descriptor.version, result[descriptor.name])) {
            result[descriptor.name] = descriptor.version;
        }
    }
    return result;
}

function getActivatedVersion(name) {
    var link = fs.join(getPackagesDir(), name);
    if (fs.exists(link)) {
        var activePackage = getDescriptor(link);
        if (activePackage != null) {
            return activePackage.version;
        }
    }
    return null;
}

function getActivatedVersions() {
    var result = {};
    var list = fs.list(getPackagesDir());
    for each (let name in list) {
        var version = getActivatedVersion(name);
        if (version !== null) {
            result[name] = version;
        }
    }
    return result;
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
        // make all files in "bin" directory of installed package executable
        var binDir = fs.join(installDir, "bin");
        if (fs.exists(binDir)) {
            for each (var fileName in fs.list(binDir)) {
                var binFile = fs.join(binDir, fileName);
                log.debug("Changing permissions of", binFile, "to 0755");
                fs.changePermissions(binFile, 0755);
            }
        }
        log.debug("Installed", name, version, "in", installDir);
    }
    return installDir;
}

function uninstall(name, version) {
    var installDir = getInstallDir(name, version);
    if (!fs.exists(installDir)) {
        throw new Error("The package " + name + " " + version + " isn't installed")
    }
    fs.removeTree(installDir);
    log.debug("Uninstalled", name, version, "in", installDir);
    return installDir;
}

function activate(name, version) {
    if (os.isWindows()) {
        throw new Error("Package activation isn't supported on Windows. Please do it manually.");
    }
    var installDir = getInstallDir(name, version);
    var packagesDir = getPackagesDir();
    if (!fs.exists(installDir)) {
        throw new Error("The package " + name + " " + version + " isn't installed");
    }
    var src = fs.relative(packagesDir, installDir);
    var dest = fs.join(packagesDir, name);
    if (fs.exists(dest)) {
        if (!fs.isLink(dest)) {
            throw new Error("Package " + name +
                    " has been copied into packages directory, please move it away manually");
        } else if (!isManaged(dest)) {
            throw new Error(name + " wasn't installed by rp, please deactivate manually");
        }
        fs.removeDirectory(dest);
    }
    if (fs.symbolicLink(src, dest) < 0) {
        throw new Error("Unable to activate the package " + name);
    }
    log.debug("Activated", name, version, "in", packagesDir);
    return dest;
}

function deactivate(name) {
    if (os.isWindows()) {
        throw new Error("Package deactivation isn't supported on Windows. Please do it manually.");
    }
    var path = fs.normal(fs.join(getPackagesDir(), name));
    if (!fs.exists(path)) {
        throw new Error("The package " + name + " is not activated");
    } else if (!fs.isLink(path)) {
        throw new Error("Package " + name +
                " has been copied into packages directory, please move it away manually");
    } else if (!isManaged(path)) {
        throw new Error(name + " wasn't installed by rp, please deactivate manually");
    }
    // FIXME: remove() doesn't allow removing symlinks to directories
    fs.removeDirectory(path);
    log.debug("Deactivated", path);
    return;
}
