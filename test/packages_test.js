var assert = require("assert");
var packages = require("../lib/rp/utils/packages");
var config = require("../lib/rp/utils/config");
var semver = require("../lib/rp/utils/semver");
var fs = require("fs");

const testDir = fs.normal(fs.join(java.lang.System.getProperty("java.io.tmpdir"), "rptest"));
const packagesDir = fs.normal(fs.join(testDir, "packages/"));
const installDir = fs.normal(fs.join(testDir, "packages.available/"));

const pkgName = "test";
const pkgVersion = "0.1";

var createTestPackage = function(dir, name, version, omitVersion) {
    version = semver.cleanVersion(version);
    var packageDir = fs.normal(fs.join(dir, name));
    if (omitVersion !== true) {
        packageDir += "-" + version;
    }
    fs.makeTree(packageDir);
    var json = JSON.stringify({
        "name": name,
        "version": version
    });
    fs.write(fs.join(packageDir, "package.json"), json);
    return packageDir;
};

var createLink = function(sourceDir, name) {
    var relSource = fs.relative(packagesDir, sourceDir);
    var dest = fs.join(packagesDir, name);
    assert.isTrue(fs.symbolicLink(relSource, dest) >= 0);
    assert.isTrue(fs.exists(dest));
    assert.isTrue(fs.isLink(dest));
    return dest;
};

exports.setUp = function() {
    fs.makeTree(packagesDir);
    // FIXME: need to create the install dir - can this happen in real life?
    fs.makeDirectory(installDir);
    config.setConfig({
        "ringoHome": testDir,
        "repositoryUrl": "http://localhost:8123"
    });
    assert.strictEqual(config.ringoHome, testDir);
};

exports.tearDown = function() {
    fs.removeTree(testDir);
};

exports.testGetInstallDir = function() {
    assert.strictEqual(packages.getInstallDir(), installDir);
    assert.strictEqual(packages.getInstallDir(pkgName, pkgVersion),
            fs.normal(fs.join(installDir, pkgName + "-" + pkgVersion)));
    return;
};

exports.testGetPackagesDir = function() {
    assert.strictEqual(packages.getPackagesDir(), packagesDir);
    return;
};

exports.testGetDescriptor = function() {
    var packageDir = createTestPackage(installDir, pkgName, pkgVersion);
    var descriptor = packages.getDescriptor(packageDir);
    assert.isNotNull(descriptor);
    assert.strictEqual(descriptor.name, pkgName);
    assert.strictEqual(descriptor.version, semver.cleanVersion(pkgVersion));
};

exports.testActivate = function() {
    // package isn't installed
    assert.throws(function() {
        packages.activate(pkgName, pkgVersion);
    }, Error);
    var packageDir = createTestPackage(installDir, pkgName, pkgVersion);
    // version 0.1 isn't installed - it's clean version 0.1.0 is
    assert.throws(function() {
        packages.activate(pkgName, "0.1");
    }, Error);
    // version 0.2 isn't installed
    assert.throws(function() {
        packages.activate(pkgName, "0.2");
    }, Error);
    var link = packages.activate(pkgName, semver.cleanVersion(pkgVersion));
    assert.isNotNull(link);
    assert.isTrue(fs.exists(link));
    assert.isTrue(fs.isLink(link));
    // link destination be the directory the package has been installed in
    assert.strictEqual(fs.normal(fs.join(packagesDir, fs.readLink(link))), packageDir);
    // check package.json descriptor
    var json = fs.normal(fs.join(packagesDir, fs.readLink(link), "package.json"));
    assert.isTrue(fs.exists(json));
    var descriptor = JSON.parse(fs.read(json));
    assert.strictEqual(descriptor.name, pkgName);
    assert.strictEqual(descriptor.version, semver.cleanVersion(pkgVersion));
};

exports.testActivateCopied = function() {
    // create package in both packageDir and installDir
    createTestPackage(installDir, pkgName, pkgVersion);
    createTestPackage(packagesDir, pkgName, pkgVersion, true);
    // activate must throw error because test package has been copied into
    // the packages directory
    assert.throws(function() {
        packages.activate(pkgName, semver.cleanVersion(pkgVersion));
    }, Error);
};

exports.testActivateUnmanaged = function() {
    createTestPackage(installDir, pkgName, pkgVersion);
    // create package in directory out of packages.available and link
    // it into packages directory to simulate a package that is active
    // but has not been installed in packages.available
    var source = createTestPackage(testDir, pkgName, pkgVersion);
    var link = createLink(source, pkgName);
    assert.throws(function() {
        packages.activate(pkgName, semver.cleanVersion(pkgVersion));
    }, Error);
    // symlink is left untouched
    assert.isTrue(fs.exists(link));
    assert.strictEqual(fs.relative(packagesDir, source), fs.readLink(link));
};

exports.testDeactivate = function() {
    createTestPackage(installDir, pkgName, pkgVersion);
    // package isn't active
    assert.throws(function() {
        packages.deactivate(pkgName);
    });
    var link = packages.activate(pkgName, semver.cleanVersion(pkgVersion));
    assert.isTrue(fs.exists(link));
    assert.isTrue(fs.isLink(link));
    packages.deactivate(pkgName);
    assert.isFalse(fs.exists(link));
};

exports.testDeactivateCopied = function() {
    // simulate a package that has been directly installed in packages directory
    var dir = createTestPackage(packagesDir, pkgName, pkgVersion, true);
    assert.throws(function() {
        packages.deactivate(pkgName);
    }, Error);
    // package directory is left untouched
    assert.isTrue(fs.exists(dir));
    assert.isTrue(fs.isDirectory(dir));
};

exports.testDeactivateUnmanaged = function() {
    // create package in directory out of packages.available and link
    // it into packages directory to simulate a package that is active
    // but has not been installed in packages.available
    var source = createTestPackage(testDir, pkgName, pkgVersion);
    var link = createLink(source, pkgName);
    assert.throws(function() {
        packages.deactivate(pkgName);
    });
    // symlink is left untouched
    assert.isTrue(fs.exists(link));
    assert.strictEqual(fs.relative(packagesDir, source), fs.readLink(link));
};

exports.testIsManaged = function() {
    var source = createTestPackage(installDir, pkgName, pkgVersion);
    var link = createLink(source, pkgName);
    assert.isTrue(packages.isManaged(link));
    // link is pointing outside packages.available directory
    fs.removeDirectory(link);
    assert.isFalse(fs.exists(link));
    source = createTestPackage(testDir, pkgName, pkgVersion);
    link = createLink(source, pkgName);
    assert.isFalse(packages.isManaged(link));
    // package is directly installed in packages directory
    fs.removeDirectory(link);
    assert.isFalse(fs.exists(link));
    source = createTestPackage(packagesDir, pkgName, pkgVersion);
    assert.isFalse(packages.isManaged(source));
};

exports.testIsActivated = function() {
    assert.isFalse(packages.isActivated(pkgName, pkgVersion));
    var dir = createTestPackage(installDir, pkgName, pkgVersion);
    createLink(dir, pkgName);
    // returns false because method expects a clean semver version
    assert.isFalse(packages.isActivated(pkgName, pkgVersion));
    assert.isTrue(packages.isActivated(pkgName, semver.cleanVersion(pkgVersion)));
    assert.isFalse(packages.isActivated(pkgName, semver.cleanVersion("0.2")));
};

exports.testIsInstalled = function() {
    assert.isFalse(packages.isInstalled(pkgName));
    assert.isFalse(packages.isInstalled(pkgName, pkgVersion));
    createTestPackage(installDir, pkgName, pkgVersion);
    assert.isTrue(packages.isInstalled(pkgName));
    // returns false because method expects a clean semver version
    assert.isFalse(packages.isInstalled(pkgName, pkgVersion));
    assert.isTrue(packages.isInstalled(pkgName, semver.cleanVersion(pkgVersion)));
};

exports.testGetInstalledVersions = function() {
    assert.strictEqual(packages.getInstalledVersions(pkgName).length, 0);
    createTestPackage(installDir, pkgName, pkgVersion);
    var versions = packages.getInstalledVersions(pkgName);
    assert.strictEqual(versions.length, 1);
    assert.strictEqual(versions[0], semver.cleanVersion(pkgVersion));
    // another version
    createTestPackage(installDir, pkgName, "0.2");
    versions = packages.getInstalledVersions(pkgName);
    assert.strictEqual(versions.length, 2);
    // resulting version array is sorted desc
    assert.strictEqual(versions[0], semver.cleanVersion("0.2"));
    assert.strictEqual(versions[1], semver.cleanVersion(pkgVersion));
};

exports.testGetLatestInstalledVersion = function() {
    createTestPackage(installDir, pkgName, pkgVersion);
    createTestPackage(installDir, pkgName, "0.2");
    assert.strictEqual(packages.getLatestInstalledVersion(pkgName),
            semver.cleanVersion("0.2"));
};

exports.testGetLatestInstalledVersions = function() {
    createTestPackage(installDir, "one", "0.1beta1");
    createTestPackage(installDir, "one", "0.2");
    createTestPackage(installDir, "two", "0.2.10");
    createTestPackage(installDir, "two", "0.3");
    var versions = packages.getLatestInstalledVersions();
    assert.strictEqual(Object.keys(versions).length, 2);
    assert.strictEqual(versions["one"], "0.2.0");
    assert.strictEqual(versions["two"], "0.3.0");
};

exports.testGetActivatedVersion = function() {
    var dir = createTestPackage(installDir, pkgName, pkgVersion);
    createLink(dir, pkgName);
    assert.strictEqual(packages.getActivatedVersion(pkgName),
            semver.cleanVersion(pkgVersion));
};

exports.testGetActivatedVersions = function() {
    var pkgs = [
        {"name": "one", "version": "0.1beta1"},
        {"name": "two", "version": "1.1.2"}
    ];
    for each (let {name, version} in pkgs) {
        createLink(createTestPackage(installDir, name, version), name);
    }
    var activatedVersions = packages.getActivatedVersions();
    for each (let {name, version} in pkgs) {
        assert.strictEqual(activatedVersions[name], semver.cleanVersion(version));
    }
};

//start the test runner if we're called directly from command line
if (require.main == module.id) {
    var system = require("system");
    var {run} = require("test");
    if (system.args.length > 1) {
        system.exit(run(exports, system.args.pop()));
    }
    system.exit(run(exports));
}
