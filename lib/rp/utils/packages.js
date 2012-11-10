var fs = require("fs");
var log = require("ringo/logging").getLogger(module.id);
var compress = require("./compress");
var registry = require("./registry");
var config = require("./config");
var semver = require("./semver");
var strings = require("ringo/utils/strings");

const PACKAGES_DIR = exports.PACKAGES_DIR = "packages";
const PACKAGE_JSON = exports.PACKAGE_JSON = "package.json";

exports.getGlobalDir = function getGlobalDir() {
    return fs.normal(config.ringoHome);
};

exports.getLocalDir = function() {
    var dir = fs.workingDirectory();
    do {
        if (fs.exists(fs.join(dir, PACKAGE_JSON)) ||
                fs.exists(fs.join(dir, PACKAGES_DIR))) {
            return fs.canonical(dir);
        }
        dir = fs.directory(dir);
    } while (dir !== ".");
    return fs.canonical(fs.workingDirectory());
};

exports.getPackagesDir = function(dir) {
    return fs.normal(fs.join(dir, PACKAGES_DIR));
};


exports.isZipFile = function(path) {
    return fs.extension(path) === ".zip";
};

exports.isUrl = function(path) {
    return /^http(?:s)?:\/{2}/.test(path);
};

/**
 * Returns true if a package with the given name is installed.
 * @param {String} name The name of the package
 * @returns True if the package is installed
 * @type Boolean
 */
exports.isInstalled = function(parentDir, name) {
    return fs.exists(fs.join(parentDir, name));
};

exports.getDescriptor = function(path) {
    if (fs.isDirectory(path)) {
        path = fs.join(path, PACKAGE_JSON);
    }
    if (fs.exists(path)) {
        return JSON.parse(fs.read(path));
    }
    return null;
};

exports.install = function(archivePath, dir, name, version) {
    var installDir = fs.normal(fs.join(dir, name));
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
};

exports.uninstall = function(dir, name) {
    var installDir = fs.canonical(fs.join(dir, name));
    if (!fs.exists(installDir)) {
        throw new Error("The package " + name + " isn't installed")
    }
    fs.removeTree(installDir);
    log.debug("Uninstalled package", name, "(" + installDir + ")");
    return installDir;
};
