var fs = require("fs");
var log = require("ringo/logging").getLogger(module.id);
var compress = require("./compress");
var registry = require("./registry");
var config = require("./config");
var semver = require("./semver");
var os = require("./os");
var strings = require("ringo/utils/strings");

const PACKAGES_DIR = exports.PACKAGES_DIR = "packages";
const PACKAGE_JSON = exports.PACKAGE_JSON = "package.json";

const ERR_GONE = exports.ERR_GONE = "gone";
const ERR_ISLINK = exports.ERR_ISLINK = "islink";
const ERR_ISFILE = exports.ERR_ISFILE = "isfile";
const ERR_NOPACKAGE = exports.ERR_NOPACKAGE = "not a package";
const ERR_EXISTS = exports.ERR_EXISTS = "exists";
const ERR_RENAMED = exports.ERR_RENAMED = "renamed";
const ERR_SAMEVERSION = exports.ERR_SAMEVERSION = "same version";

const OK = exports.OK = "ok";


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
 * Returns true if a package is installed. This method accepts multiple
 * arguments, which are all joined to the package path used to check.
 * @param {String} path The path to the package
 * @returns True if the package is installed
 * @type Boolean
 */
exports.isInstalled = function(path) {
    return fs.exists(fs.join.apply(null, Array.prototype.slice.call(arguments)));
};

/**
 * Returns the installed version of the package in path
 * @param {String} path The path to the director containing the package
 * @returns {String} The version of the installed package, or null
 */
exports.getInstalledVersion = function(path) {
    var descriptor = exports.getDescriptor.apply(null, arguments);
    if (descriptor !== null) {
        return descriptor.version;
    }
    return null;
};

exports.getDescriptor = function(path) {
    path = fs.join.apply(null, Array.prototype.slice.call(arguments));
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
        compress.extractArchive(archivePath, installDir);
        // make all files in "bin" directory of installed package executable
        var binDir = fs.join(installDir, "bin");
        if (fs.exists(binDir)) {
            var ringoBin = fs.join(config.ringoHome, "bin");
            for each (let name in fs.list(binDir)) {
                let binFile = fs.join(binDir, name);
                log.debug("Changing permissions of", binFile, "to 0755");
                fs.changePermissions(binFile, 0755);
                let dest = fs.join(ringoBin, name);
                if (os.isWindows()) {
                    log.debug("Copying", binFile, "to", dest);
                    fs.copy(binFile, dest);
                } else {
                    log.debug("Linking", binFile, "to", dest);
                    fs.symbolicLink(binFile, dest);
                }
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
    // remove symlinks to binaries, if any
    var packageBinDir = fs.join(installDir, "bin");
    if (fs.isDirectory(packageBinDir)) {
        var ringoBinDir = fs.join(config.ringoHome, "bin");
        for each (let name in fs.list(packageBinDir)) {
            let binLink = fs.join(ringoBinDir, name);
            let binFile = fs.join(packageBinDir, name);
            if (fs.isLink(binLink) && fs.same(binLink, binFile)) {
                log.debug("Removing", binLink, "->", binFile);
                fs.remove(binLink);
            }
        }
    }
    fs.removeTree(installDir);
    log.debug("Uninstalled package", name, "(" + installDir + ")");
    return installDir;
};

exports.isInstallable = function(parentDir, name, version) {
    log.debug("Checking if", name, "is installable in", parentDir, "...");
    var dir = fs.join(parentDir, name);
    if (!fs.exists(dir)) {
        log.debug(name, "can be installed in", dir);
        return OK;
    } else if (fs.isFile(dir)) {
        log.debug("A file", name, "exists in", parentDir);
        return ERR_ISFILE;
    } else if (fs.isLink(dir)) {
        log.debug(name, "is a symlink to", fs.readLink(dir));
        return ERR_ISLINK;
    }
    var installed = exports.getDescriptor(dir);
    if (installed === null) {
        log.debug(dir, "does not contain the package", name);
        return ERR_NOPACKAGE;
    } else if (installed.name !== name) {
        log.debug(dir, "contains a different package:", installed.name);
        return ERR_RENAMED;
    } else if (!semver.isEqual(version, installed.version)) {
        log.debug(name, installed.version, "is installed in", dir);
        return ERR_EXISTS;
    } else {
        log.debug(name, installed.version, "is already installed in", dir);
        return ERR_SAMEVERSION;
    }
    throw new Error("Unknown condition");
};

exports.isUpdateable = function(parentDir, name, version) {
    log.debug("Checking if", name, version, "is updateable in", parentDir, "...");
    let dir = fs.join(parentDir, name);
    if (!fs.exists(dir)) {
        log.debug(name, "can be installed in", dir);
        return OK;
    } else if (fs.isFile(dir)) {
        log.debug("A file", name, "exists in", parentDir);
        return ERR_ISFILE;
    } else if (fs.isLink(dir)) {
        log.debug(name, "is a symlink to", fs.readLink(dir));
        return ERR_ISLINK;
    }
    var installed = exports.getDescriptor(dir);
    if (installed === null) {
        log.debug(dir, "does not contain the package", name);
        return ERR_NOPACKAGE;
    } else if (installed.name !== name) {
        log.debug(dir, "contains a different package:", installed.name);
        return ERR_RENAMED;
    } else if (semver.isGreater(version, installed.version)) {
        log.debug(name, "can be updated from", installed.version, "to", version);
        return OK;
    } else {
        log.debug(name, "is up-to-date (" + installed.version + ")");
        return ERR_SAMEVERSION;
    }
    throw new Error("Unknown condition");
};

exports.isUninstallable = function(parentDir, name) {
    var dir = fs.join(parentDir, name);
    log.debug("Checking if", dir, "is uninstallable ...");
    if (!fs.exists(dir)) {
        log.debug(dir, "does not exist");
        return ERR_GONE;
    } else if (fs.isFile(dir)) {
        log.debug(dir, "is a file, not a package directory");
        return ERR_ISFILE;
    } else if (fs.isLink(dir)) {
        log.debug(dir, "is a symlink to", fs.readLink(dir));
        return ERR_ISLINK;
    }
    var installed = exports.getDescriptor(dir);
    if (installed === null) {
        log.debug(dir, "does not contain the package", name);
        return ERR_NOPACKAGE;
    } else if (installed.name !== name) {
        log.debug(dir, "contains a different package:", installed.name);
        return ERR_RENAMED;
    }
    return OK;
};
