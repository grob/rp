var system = require("system");
var assert = require("assert");
var packages = require("../lib/utils/packages");
var config = require("../lib/utils/config");
var semver = require("../lib/utils/semver");
var fs = require("fs");

const tmpDir = fs.canonical(java.lang.System.getProperty("java.io.tmpdir"));
const testDir = fs.canonical(fs.join(tmpDir, "rptest"));
const packagesDir = fs.canonical(fs.join(testDir, "packages"));

const pkgName = "test";
const pkgVersion = "0.1";

var createTestPackage = function(dir, name, version) {
    var packageDir = fs.normal(fs.join(dir, name));
    fs.makeTree(packageDir);
    createDescriptor(packageDir, name, version);
    return packageDir;
};

var createDescriptor = function(packageDir, name, version) {
    var json = JSON.stringify({
        "name": name,
        "version": (version && semver.cleanVersion(version)) || pkgVersion
    });
    var path = fs.join(packageDir, packages.PACKAGE_JSON);
    fs.write(path, json);
    return path;
};

exports.setUp = function() {
    fs.makeTree(packagesDir);
    config.setConfig({
        "ringoHome": testDir,
        "repositoryUrl": "http://localhost:8123"
    });
    assert.strictEqual(config.ringoHome, testDir);
};

exports.tearDown = function() {
    fs.removeTree(testDir);
};

exports.testGetPackagesDir = function() {
    assert.strictEqual(packages.getPackagesDir(testDir), packagesDir);
    return;
};

exports.testGetLocalDir = function() {
    /**
     *   tmpDir/
     *   tmpDir/testDir
     *   tmpDir/testDir/subdir
     *   tmpDir/testDir/packages
     *   tmpDir/testDir/packages/packagedir
     *   tmpDir/testDir/packages/packagedir/package.json
     *   tmpDIr/appDir/package.json
     */
    var subDir = fs.canonical(fs.join(testDir, "subdir"));
    var packageDir = fs.canonical(fs.join(packagesDir, "packagedir"));
    var appDir = fs.canonical(fs.join(tmpDir, "appdir"));
    fs.makeDirectory(subDir);
    fs.makeDirectory(packageDir);
    // FIXME: fs.touch doesn't create an empty file, therefor using write
    fs.write(fs.join(packageDir, "package.json"));
    assert.isTrue(fs.exists(fs.join(packageDir, "package.json")));
    if (fs.exists(appDir)) {
        fs.removeTree(appDir);
    }
    fs.makeDirectory(appDir);
    fs.write(fs.join(appDir, "package.json"));
    assert.isTrue(fs.exists(fs.join(appDir, "package.json")));

    // if in tmpDir returns the tmpDir because there's neither a
    // package.json file nor a "packages" directory in it or in one of its parents
    fs.changeWorkingDirectory(tmpDir);
    assert.strictEqual(packages.getLocalDir(), tmpDir);

    // if in testDir returns the testDir because it contains a "packages" directory
    fs.changeWorkingDirectory(testDir);
    assert.strictEqual(packages.getLocalDir(), testDir);
    // if in testDir/subdir returns the testDir because the subdir doesn't contain
    // a package.json file or a "packages" directory (but the parent directory does)
    fs.changeWorkingDirectory(subDir);
    assert.strictEqual(packages.getLocalDir(), testDir);
    // if in testDir/packages returns the testDir
    fs.changeWorkingDirectory(packagesDir);
    assert.strictEqual(packages.getLocalDir(), testDir);
    // if in testDir/packages/packagedir returns the packageDir since it contains
    // a package.json file
    fs.changeWorkingDirectory(packageDir);
    assert.strictEqual(packages.getLocalDir(), packageDir);

    // from inside the appDir returns the appDir since it contains
    // a package.json file
    fs.changeWorkingDirectory(appDir);
    assert.strictEqual(packages.getLocalDir(), appDir);
};

exports.testGetGlobalDir = function() {
    assert.strictEqual(packages.getGlobalDir(), testDir);
};

exports.testIsZipFile = function() {
    assert.isTrue(packages.isZipFile("test.zip"));
    assert.isFalse(packages.isZipFile("test.zip.tmp"));
};

exports.testIsUrl = function() {
    assert.isTrue(packages.isUrl("http://ringojs.org"));
    assert.isTrue(packages.isUrl("https://packages.ringojs.org"));
    assert.isFalse(packages.isUrl("ftp://ringojs.org"));
    assert.isFalse(packages.isUrl("mailto://rpr@example.com"));
};

exports.testIsInstalled = function() {
    assert.isFalse(packages.isInstalled(packagesDir, pkgName));
    assert.isFalse(packages.isInstalled(fs.join(packagesDir, pkgName)));
    createTestPackage(packagesDir, pkgName);
    assert.isTrue(packages.isInstalled(packagesDir, pkgName));
    assert.isTrue(packages.isInstalled(fs.join(packagesDir, pkgName)));
};

exports.testGetDescriptor = function() {
    var packageDir = createTestPackage(packagesDir, pkgName, pkgVersion);
    var descriptor = packages.getDescriptor(packagesDir, pkgName);
    assert.isNotNull(descriptor);
    assert.strictEqual(descriptor.name, pkgName);
    assert.strictEqual(descriptor.version, semver.cleanVersion(pkgVersion));
};

exports.testInstall = function() {
    var name = "testpackage";
    var version = "1.0.1";
    // archivePath, dir, name, version
    packages.install(module.resolve("./testpackage.zip"), packagesDir,
            name, version);
    assert.isTrue(fs.exists(fs.join(packagesDir, name)));
    assert.isTrue(packages.isInstalled(packagesDir, name));
    // all files in "bin" directory should be executable
    var binDir = fs.join(packagesDir, name, "bin");
    var sh = fs.join(binDir, "test.sh");
    var cmd = fs.join(binDir, "test.cmd")
    assert.strictEqual(fs.permissions(sh).toNumber(), 0755);
    assert.strictEqual(fs.permissions(cmd).toNumber(), 0755);
};

exports.testUninstall = function() {
    var name = "testpackage";
    var version = "1.0.1";
    assert.throws(function() {
        packages.uninstall(packagesDir, name);
    });
    packages.install(module.resolve("./testpackage.zip"), packagesDir,
            name, version);
    assert.isTrue(packages.isInstalled(packagesDir, name));
    var installDir = fs.canonical(fs.join(packagesDir, name));
    assert.strictEqual(packages.uninstall(packagesDir, name), installDir);
    assert.isFalse(packages.isInstalled(packagesDir, name));
    assert.isFalse(fs.exists(installDir));
};

exports.testIsInstallable = function() {
    var name = "testpackage";
    // package isn't installed
    assert.strictEqual(packages.isInstallable(packagesDir, name),
            packages.OK);
    // file with same name exists
    var packageDir = fs.join(packagesDir, name);
    fs.touch(packageDir);
    assert.strictEqual(packages.isInstallable(packagesDir, name),
            packages.ERR_ISFILE);
    fs.remove(packageDir);
    // link with same name exists
    fs.symbolicLink(packagesDir, packageDir);
    assert.isTrue(fs.isLink(packageDir));
    assert.strictEqual(packages.isInstallable(packagesDir, name),
            packages.ERR_ISLINK);
    fs.removeDirectory(packageDir);
    // directory exists, but does not contain a package
    fs.makeDirectory(packageDir);
    assert.strictEqual(packages.isInstallable(packagesDir, name),
            packages.ERR_NOPACKAGE);
    fs.removeDirectory(packageDir);
    // directory contains a different package
    packageDir = fs.join(packagesDir, name);
    fs.makeTree(packageDir);
    createDescriptor(packageDir, "differentpackage", "0.2");
    assert.strictEqual(packages.isInstallable(packagesDir, name, "0.3"),
            packages.ERR_RENAMED);
    fs.removeTree(packageDir);
    // directory contains a different package version
    packageDir = createTestPackage(packagesDir, name, "0.2");
    assert.strictEqual(packages.isInstallable(packagesDir, name, "0.3"),
            packages.ERR_EXISTS);
    fs.removeTree(packageDir);
    // directory contains same package version
    packageDir = createTestPackage(packagesDir, name, "0.2");
    assert.strictEqual(packages.isInstallable(packagesDir, name, "0.2"),
            packages.ERR_SAMEVERSION);
    fs.removeTree(packageDir);
};

exports.testIsUpdateable = function() {
    var name = "testpackage";
    // package isn't installed
    assert.strictEqual(packages.isUpdateable(packagesDir, name),
            packages.OK);
    // file with same name exists
    var packageDir = fs.join(packagesDir, name);
    fs.touch(packageDir);
    assert.strictEqual(packages.isUpdateable(packagesDir, name),
            packages.ERR_ISFILE);
    fs.remove(packageDir);
    // link with same name exists
    fs.symbolicLink(packagesDir, packageDir);
    assert.isTrue(fs.isLink(packageDir));
    assert.strictEqual(packages.isUpdateable(packagesDir, name),
            packages.ERR_ISLINK);
    fs.removeDirectory(packageDir);
    // directory exists, but does not contain a package
    fs.makeDirectory(packageDir);
    assert.strictEqual(packages.isUpdateable(packagesDir, name),
            packages.ERR_NOPACKAGE);
    fs.removeDirectory(packageDir);
    // directory contains a different package
    packageDir = fs.join(packagesDir, name);
    fs.makeTree(packageDir);
    createDescriptor(packageDir, "differentpackage", "0.2");
    assert.strictEqual(packages.isUpdateable(packagesDir, name, "0.3"),
            packages.ERR_RENAMED);
    fs.removeTree(packageDir);
    // package is up-to-date
    packageDir = createTestPackage(packagesDir, name, "0.2");
    assert.strictEqual(packages.isUpdateable(packagesDir, name, "0.2"),
            packages.ERR_SAMEVERSION);
    fs.removeTree(packageDir);
    // package can be updated
    packageDir = createTestPackage(packagesDir, name, "0.2");
    assert.strictEqual(packages.isUpdateable(packagesDir, name, "0.3"),
            packages.OK);
    fs.removeTree(packageDir);
};

exports.testIsUninstallable = function() {
    var name = "testpackage";
    // package isn't installed
    assert.strictEqual(packages.isUninstallable(packagesDir, name),
            packages.ERR_GONE);
    // file with same name exists
    var packageDir = fs.join(packagesDir, name);
    fs.touch(packageDir);
    assert.strictEqual(packages.isUninstallable(packagesDir, name),
            packages.ERR_ISFILE);
    fs.remove(packageDir);
    // link with same name exists
    fs.symbolicLink(packagesDir, packageDir);
    assert.isTrue(fs.isLink(packageDir));
    assert.strictEqual(packages.isUninstallable(packagesDir, name),
            packages.ERR_ISLINK);
    fs.removeDirectory(packageDir);
    // directory exists, but does not contain a package
    fs.makeDirectory(packageDir);
    assert.strictEqual(packages.isUninstallable(packagesDir, name),
            packages.ERR_NOPACKAGE);
    fs.removeDirectory(packageDir);
    // directory contains a different package
    packageDir = fs.join(packagesDir, name);
    fs.makeTree(packageDir);
    createDescriptor(packageDir, "differentpackage", "0.2");
    assert.strictEqual(packages.isUninstallable(packagesDir, name, "0.3"),
            packages.ERR_RENAMED);
    fs.removeTree(packageDir);
    // package can be uninstalled
    packageDir = createTestPackage(packagesDir, name, "0.2");
    assert.strictEqual(packages.isUninstallable(packagesDir, name),
            packages.OK);
    fs.removeTree(packageDir);
};

//start the test runner if we're called directly from command line
if (require.main == module.id) {
    var {run} = require("test");
    if (system.args.length > 1) {
        system.exit(run(exports, system.args.pop()));
    }
    system.exit(run(exports));
}
