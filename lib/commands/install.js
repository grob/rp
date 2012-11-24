var term = require("ringo/term");
var shell = require("ringo/shell");
var fs = require("fs");
var log = require("ringo/logging").getLogger(module.id);
var semver = require("../utils/semver");
var registry = require("../utils/registry");
var packages = require("../utils/packages");
var {Resolver, Resolved} = require("../utils/resolver");
var {Parser} = require("ringo/args");
var {indent} = require("../utils/strings");
var compress = require("../utils/compress");
var httpclient = require("../utils/httpclient");

// argument parser
var parser = new Parser();
parser.addOption("g", "global", null, "Install package globally");

exports.description = "Install a package or package dependencies";

var help = exports.help = function() {
    term.writeln("\n" + exports.description, "\n");
    term.writeln("Usage:");
    term.writeln("  rp install");
    term.writeln("  rp install <name> [version]");
    term.writeln("  rp install <zipball file>");
    term.writeln("  rp install <zipball url>");
    term.writeln("\nOptions:");
    term.writeln(parser.help());
    term.writeln();
};

exports.install = function(args) {
    var opts = {};
    try {
        parser.parse(args, opts);
    } catch (e) {
        term.writeln(term.RED, e.message, term.RESET);
        term.writeln("Available options:");
        term.writeln(parser.help());
        return;
    }
    var dir = (opts.global === true) ? packages.getGlobalDir() :
            packages.getLocalDir();
    var packagesDir = packages.getPackagesDir(dir);
    if (args.length === 0) {
        var descriptor = packages.getDescriptor(dir);
        if (!descriptor) {
            throw new Error("No package.json file found in " + dir);
        }
        installDependencies(packagesDir, descriptor);
    } else {
        var [name, version] = args;
        if (packages.isUrl(name)) {
            var file = httpclient.getBinary(name);
            try {
                installZipFile(packagesDir, file);
            } finally {
                if (file !== null && fs.exists(file)) {
                    log.debug("Removing temporary file", file);
                    fs.remove(file);
                }
            }
        } else if (packages.isZipFile(name)) {
            installZipFile(packagesDir, name);
        } else {
            var resolver = new Resolver(registry);
            resolver.resolve(name, version);
            var toInstall = filterInstallable(packagesDir, resolver.getDescriptors());
            if (toInstall.length > 0 && confirmInstall(packagesDir, toInstall)) {
                installPackages(packagesDir, toInstall);
            }
        }
    }
};

var installPackage = function(packagesDir, descriptor) {
    var file;
    try {
        file = registry.getPackage(descriptor);
        var installDir = packages.install(file, packagesDir, descriptor.name,
                descriptor.version);
        term.writeln(term.GREEN, "Installed", descriptor.name, descriptor.version,
                "in", installDir, term.RESET);
    } finally {
        // cleanup: remove temporary package archive file
        if (file && fs.exists(file)) {
            fs.remove(file);
        }
    }
};

var installPackages = function(packagesDir, descriptors) {
    for each (let descriptor in descriptors) {
        installPackage(packagesDir, descriptor);
    }
    term.writeln(term.GREEN, "Finished", term.RESET);
};

var confirmInstall = function(packagesDir, descriptors) {
    term.writeln(term.BOLD, "\nAbout to install in", packagesDir + ":", term.RESET);
    for each (let {name, version} in descriptors) {
        term.writeln(indent(name, 1), version);
    }
    return confirm("\nDo you want to proceed?");
};

var installDependencies = function(packagesDir, descriptor) {
    var resolver = new Resolver(registry);
    term.writeln("Resolving dependencies of", descriptor.name, "...");
    for each (let [name, range] in Iterator(descriptor.dependencies)) {
        resolver.resolve(name, range);
    }
    var descriptors = filterInstallable(packagesDir, resolver.getDescriptors());
    if (descriptors.length > 0 && confirmInstall(packagesDir, descriptors)) {
        installPackages(packagesDir, descriptors);
    }
};

var filterInstallable = function(packagesDir, descriptors) {
    if (descriptors.length < 1) {
        return descriptors;
    }
    log.debug("Filtering packages installable in", packagesDir);
    return descriptors.filter(function(candidate) {
        return isInstallable(packagesDir, candidate);
    });
};

var isInstallable = function(packagesDir, descriptor) {
    log.debug("Checking if", descriptor.name, "is installable in", packagesDir, "...");
    var dir = fs.join(packagesDir, descriptor.name);
    if (!fs.exists(dir)) {
        log.debug(descriptor.name, "can be installed");
        term.writeln(descriptor.name, "is not installed in", packagesDir);
        return true;
    } else if (fs.isFile(dir)) {
        log.debug(descriptor.name, "is a file");
        term.writeln(term.RED, "Can't install", descriptor.name,
                "because a file with the same name exists in",
                packagesDir, term.RESET);
    } else if (fs.isLink(dir)) {
        log.debug(descriptor.name, "is a symlink to", fs.readLink(dir));
        term.writeln(term.RED, "Can't install", descriptor.name,
                "because it's a symlink to", fs.absolute(fs.readLink(dir)));
    } else {
        var current = packages.getDescriptor(dir);
        if (!current) {
            log.debug(dir, "exists, but doesn't contain a package");
            term.writeln(term.RED, "Can't install", descriptor.name, "because",
                    dir, "exists but doesn't contain a valid package", term.RESET);
        } else if (!semver.isEqual(descriptor.version, current.version)) {
            log.debug(dir, "exists and contains", current.version);
            term.writeln(term.RED, "A different version (" + current.version +
                    ") of", descriptor.name, "is already installed in",
                    packagesDir, term.RESET);
        } else {
            log.debug(descriptor.name, "is already installed in", dir);
            term.writeln("Version", descriptor.version, "of", descriptor.name,
                    "is already installed in", packagesDir);
        }
    }
    return false;
};

var installZipFile = function(packagesDir, path) {
    log.debug("Installing .zip file", path, "...");
    var bytes = compress.extractFile(path, packages.PACKAGE_JSON);
    var descriptor = JSON.parse(new java.lang.String(bytes));
    if (!descriptor) {
        throw new Error("Zip archive " + path +
                " doesn't contain a package.json file");
    }
    var isInstalled = !isInstallable(packagesDir, descriptor);
    // resolve dependencies of zip file
    var resolver = new Resolver(registry);
    resolver.resolveDependencies(new Resolved(descriptor));
    var dependencies = filterInstallable(packagesDir, resolver.getDescriptors());
    var toInstall = dependencies.slice();
    if (!isInstalled) {
        toInstall.unshift(descriptor);
    }
    if (toInstall.length > 0 && confirmInstall(packagesDir, toInstall)) {
        if (!isInstalled) {
            var installDir = packages.install(path, packagesDir,
                    descriptor.name, descriptor.version);
            term.writeln(term.GREEN, "Installed", descriptor.name, descriptor.version,
                    "in", installDir, term.RESET);
        }
        // install dependencies too
        installPackages(packagesDir, dependencies);
    }
};

var confirm = function(msg) {
    var proceed = shell.readln(msg + " (Y/n) ");
    if (proceed.length > 0 && proceed.toLowerCase() != "y") {
        log.debug("Cancelled");
        term.writeln("Cancelled");
        return false;
    }
    return true;
};
