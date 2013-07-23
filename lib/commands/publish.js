var {Parser} = require("ringo/args");
var term = require("ringo/term");
var fs = require("fs");
var log = require("ringo/logging").getLogger(module.id);
var shell = require("ringo/shell");
var semver = require("../utils/semver");
var {createTempFile} = require("ringo/utils/files");
var strings = require("ringo/utils/strings");
var compress = require("../utils/compress");
var registry = require("../utils/registry");
var crypto = require("../utils/crypto");
var descriptors = require("../utils/descriptors");
var packages = require("../utils/packages");
var httpclient = require("../utils/httpclient");
var {relativize} = require("../utils/files");

var parser = new Parser();
parser.addOption("f", "force", null, "Force re-publishing of an already published package");

exports.description = "Publishes a package";

exports.help = function help() {
    term.writeln("\n" + exports.description, "\n");
    term.writeln("Usage:");
    term.writeln("  rp publish [options] <directory>\n");
    term.writeln("  rp publish [options] <zipball file>");
    term.writeln("  rp publish [options] <zipball url>");
    return;
};

exports.publish = function(args) {
    var opts = {};
    try {
        parser.parse(args, opts);
    } catch (e) {
        term.writeln(term.RED, e.message, term.RESET);
        term.writeln("Available options:");
        term.writeln(parser.help());
        return;
    }

    var name = args.shift();
    if (packages.isUrl(name)) {
        log.debug("Retrieving remote .zip file", name);
        var zipFile = httpclient.getBinary(name);
        try {
            publishZipFile(zipFile, opts.force);
        } finally {
            if (zipFile !== null && fs.exists(zipFile)) {
                log.debug("Removing temporary zip file", zipFile);
                fs.remove(zipFile);
            }
        }
    } else if (packages.isZipFile(name)) {
        publishZipFile(name, opts.force);
    } else {
        publishDirectory(name, opts.force);
    }
};

var publishDirectory = function(path, force) {
    var dirPath = fs.absolute(path || ".");
    log.debug("Publishing directory", dirPath, "(force:", force + ")");
    var descriptorPath = fs.join(dirPath, packages.PACKAGE_JSON);
    if (!fs.exists(descriptorPath)) {
        term.writeln(term.RED, "No package.json file found in", dirPath, term.RESET);
        return;
    }
    // parse and evaluate package descriptor
    var descriptor = JSON.parse(fs.read(descriptorPath));
    if (verifyDescriptor(descriptor, force) === true) {
        var [username, password] = getCredentials();
        var zipFile = null;
        try {
            zipFile = createTempFile("rpkg", ".zip");
            compress.createArchive(dirPath, zipFile);
            var response = registry.publish(username, password, descriptor,
                    zipFile, force);
            term.writeln(term.GREEN, response.message, term.RESET);
        } finally {
            if (zipFile !== null && fs.exists(zipFile)) {
                fs.remove(zipFile);
            }
        }
    }
};

var publishZipFile = function(zipFile, force) {
    log.debug("Publishing .zip file", zipFile, "(force:", force + ")");
    var commonPath = compress.getCommonPath(zipFile);
    var json = compress.extractFile(zipFile, commonPath + packages.PACKAGE_JSON);
    if (!json || json.length < 1) {
        term.writeln(term.RED, "No package.json file found in", zipFile, term.RESET);
        return;
    }
    var descriptor = JSON.parse(json.decodeToString());
    if (verifyDescriptor(descriptor, force) === true) {
        var [username, password] = getCredentials();
        var publishZipFile = null;
        try {
            // strip the commonPath of all entries in the zip file (github et.al.
            // add a root directory in generated zip files)
            publishZipFile = compress.relocateEntries(zipFile, function(name) {
                return relativize(commonPath, name);
            });
            var response = registry.publish(username, password, descriptor,
                    publishZipFile, force);
            term.writeln(term.GREEN, response.message, term.RESET);
        } finally {
            if (publishZipFile !== null && fs.exists(publishZipFile)) {
                fs.remove(publishZipFile);
            }
        }
    }
};

var verifyDescriptor = function(descriptor, force) {
    descriptors.verify(descriptor);
    descriptors.sanitize(descriptor);
    if (!force && registry.exists(descriptor.name, descriptor.version)) {
        term.writeln("Version", descriptor.version, "of", descriptor.name,
                "has already been published. Use -f or --force to force re-publishing.");
        return false;
    }
    return true;
};

var getCredentials = function() {
    var username, salt;
    while (!username || !salt) {
        username = shell.readln("Username: ").trim();
        if (username.length > 0) {
            salt = registry.getSalt(username);
            if (salt === null) {
                term.writeln(term.RED, "Unknown user", username, term.RESET);
            }
        }
    }
    var digest = crypto.createDigest(shell.readln("Password: ", "*"),
            strings.b64decode(salt, "raw"));
    return [username, strings.b64encode(digest)];
};