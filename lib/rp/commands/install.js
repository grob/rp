var term = require("ringo/term");
var shell = require("ringo/shell");
var fs = require("fs");
var semver = require("../utils/semver");
var registry = require("../utils/registry");
var packages = require("../utils/packages");
var {Resolver, Resolved} = require("../utils/resolver");
var {Parser} = require("ringo/args");
var {indent} = require("../utils/strings");
var strings = require("ringo/utils/strings");
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
                    fs.remove(file);
                }
            }
        } else if (packages.isZipFile(name)) {
            installZipFile(packagesDir, name);
        } else {
            var resolver = new Resolver(registry);
            resolver.resolve(name, version);
            var toInstall = filterPackages(packagesDir, resolver.getDescriptors());
            if (toInstall.length > 0) {
                installPackages(packagesDir, toInstall);
            }
        }
    }
};

var installPackage = function(descriptor, dir) {
    var file;
    try {
        file = registry.getPackage(descriptor);
        var installDir = packages.install(file, dir, descriptor.name,
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
    term.writeln(term.BOLD, "\nAbout to install in", packagesDir + ":", term.RESET);
    for each (let {name, version} in descriptors) {
        term.writeln(indent(name, 1), version);
    }
    if (!confirm("\nDo you want to proceed?")) {
        return false;
    }
    for each (let candidate in descriptors) {
        installPackage(candidate, packagesDir);
    }
    term.writeln(term.GREEN, "Finished", term.RESET);
};

var installDependencies = function(packagesDir, descriptor) {
    var resolver = new Resolver(registry);
    resolver.resolveDependencies(new Resolved(descriptor));
    var descriptors = filterPackages(packagesDir, resolver.getDescriptors());
    if (descriptors.length > 0) {
        installPackages(packagesDir, descriptors);
    }
};

var filterPackages = function(packagesDir, descriptors) {
    return descriptors.filter(function(candidate) {
        return needsInstallation(packagesDir, candidate);
    });
};

var needsInstallation = function(packagesDir, candidate) {
    if (!packages.isInstalled(packagesDir, candidate.name)) {
        return true;
    }
    var pkgDir = fs.normal(fs.join(packagesDir, candidate.name));
    var descriptor = packages.getDescriptor(pkgDir);
    if (!descriptor) {
        throw new Error("Directory " + packagesDir +
                " already exists, but doesn't contain the expected package");
    }
    if (!semver.isEqual(candidate.version, descriptor.version)) {
        throw new Error("A different version (" + descriptor.version +
                ") of " + candidate.name + " is already installed in " + pkgDir);
    } else {
        term.writeln("Version", descriptor.version, "of", candidate.name,
                "is already installed in", pkgDir);
    }
    return false;
};

var installZipFile = function(packagesDir, path) {
    var bytes = compress.extractFile(path, packages.PACKAGE_JSON);
    var descriptor = JSON.parse(new java.lang.String(bytes));
    if (!descriptor) {
        throw new Error("Zip archive " + path +
                " doesn't contain a package.json file");
    }
    var isInstalled = !needsInstallation(packagesDir, descriptor);
    var resolver = new Resolver(registry);
    resolver.resolveDependencies(new Resolved(descriptor));
    var dependencies = filterPackages(packagesDir, resolver.getDescriptors());
    var toInstall = dependencies.slice();
    if (!isInstalled) {
        toInstall.unshift(descriptor);
    }
    if (toInstall.length > 0) {
        term.writeln(term.BOLD, "About to install in", packagesDir + ":", term.RESET);
        for each (let {name, version} in toInstall) {
            term.writeln(indent(name, 1), version);
        }
        if (!confirm("Do you want to continue?")) {
            return false;
        }
        if (!isInstalled) {
            var installDir = packages.install(path, packagesDir,
                    descriptor.name, descriptor.version);
            term.writeln(term.GREEN, "Installed", descriptor.name, descriptor.version,
                    "in", installDir, term.RESET);
        }
        for each (let descriptor in dependencies) {
            installPackage(descriptor, packagesDir);
        }
        term.writeln(term.GREEN, "Finished", term.RESET);
    }
};

var confirm = function(msg) {
    var proceed = shell.readln(msg + " (Y/n) ");
    if (proceed.length > 0 && proceed.toLowerCase() != "y") {
        term.writeln("Cancelled");
        return false;
    }
    return true;
};
