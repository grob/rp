var log = require("ringo/logging").getLogger(module.id);
var fs = require("fs");
var {ByteArray} = require("binary");
var {FileOutputStream, BufferedOutputStream, BufferedInputStream} = java.io;
var {ZipInputStream, ZipOutputStream, ZipEntry} = java.util.zip;
var {MemoryStream} = require("io");
var strings = require("ringo/utils/strings");
var {ZipFile} = require("ringo/zip");
var {createTempFile} = require("ringo/utils/files");

var EXCLUDE_RE = /^(?:\.git|\.svn|\.hg|CVS|\.DS_Store)$/;

var filterEntries = function(dir, base) {
    var entries = [];
    base = base || "";
    for each (let name in fs.list(dir)) {
        if (EXCLUDE_RE.test(name)) {
            continue;
        }
        var path = fs.join(dir, name);
        var relPath = fs.join(base, name);
        if (fs.isDirectory(path)) {
            Array.prototype.push.apply(entries,
                    filterEntries(path, relPath));
        } else if (!fs.isLink(path)) {
            entries.push(relPath);
        }
    }
    return entries;
};

exports.createArchive = function(dir, dest) {
    var zipOutStream = null;
    try {
        var fileOutStream = new FileOutputStream(dest);
        zipOutStream = new ZipOutputStream(new BufferedOutputStream(fileOutStream));
        zipOutStream.setMethod(ZipOutputStream.DEFLATED);
        zipOutStream.setLevel(9);
        var entries = filterEntries(dir);
        for each (var path in entries) {
            let filePath = fs.join(dir, path);
            log.debug("Adding", filePath, "to archive at", path);
            let entry = new ZipEntry(path);
            entry.setTime(fs.lastModified(filePath));
            zipOutStream.putNextEntry(entry);
            fs.openRaw(filePath).copy(zipOutStream).close();
        }
        zipOutStream.flush();
    } finally {
        if (zipOutStream != null) {
            zipOutStream.close();
        }
    }
};

exports.extractArchive = function(archivePath, destPath) {
    var stream = fs.openRaw(archivePath);
    exports.extractStream(stream, destPath);
    stream.close();
};

exports.extractStream = function(stream, directory) {
    var inStream = null;
    try {
        var zipInStream = new ZipInputStream(new BufferedInputStream(stream));
        inStream = new Stream(zipInStream);
        var entry;
        while ((entry = zipInStream.getNextEntry()) !== null) {
            let path = fs.join(directory, entry.getName());
            if (entry.isDirectory()) {
                fs.makeDirectory(path);
            } else {
                log.debug("Extracted " + path);
                let parent = fs.directory(path);
                if (!fs.isDirectory(parent)) {
                     fs.makeTree(parent);
                }
                let destStream = fs.openRaw(path, {"write": true});
                inStream.copy(destStream);
                destStream.close();
            }
            if (entry.getTime() > -1) {
                fs.touch(path, entry.getTime());
            }
        }
    } finally {
        if (inStream != null) {
            inStream.close();
        }
    }
};

/**
 * Extracts a single file from a zip archive
 * @param {String} file The path to the zip archive
 * @param {String} path The path of the file in the zip archive to extract
 * @returns {ByteArray} A byte array containing the extracted file
 */
exports.extractFile = function(file, path) {
    var zip = new ZipFile(file);
    var bytes = new ByteArray(zip.getSize(path));
    zip.open(path).readInto(bytes);
    zip.close();
    return bytes;
};

/**
 * Returns the common base path of all entries in the ZIP archive
 * @param {String} The path to the ZIP archive
 * @returns {String} The common base path
 */
exports.getCommonPath = function(archivePath) {
    var zip = new ZipFile(archivePath);
    try {
        return zip.entries.reduce(function(prev, current) {
            return strings.getCommonPrefix(prev, current);
        });
    } finally {
        zip.close();
    }
};

/**
 * Relocates all entries in a ZIP file, using the return value of the callback
 * method passed as argument.
 * @param {String} archivePath The path to the ZIP archive
 * @param {Function} callback A callback function executed for each entry in the
 * archive. The function receives the path of the source entry as argument and
 * is expected to return the path to use for this entry in the destination archive.
 * @returns {String} The path to the ZIP archive containing the relocated entries
 */
exports.relocateEntries = function(archivePath, callback) {
    var dest = createTempFile("rpkg-", ".zip");
    var zipOutStream = null;
    try {
        var fileOutStream = new FileOutputStream(dest);
        zipOutStream = new ZipOutputStream(new BufferedOutputStream(fileOutStream));
        zipOutStream.setMethod(ZipOutputStream.DEFLATED);
        zipOutStream.setLevel(9);
        var zipFile = new ZipFile(archivePath);
        for each (let name in zipFile.entries) {
            let path = callback(name);
            log.debug("Relocating", name, "in archive", archivePath, "to", path);
            let destEntry = new ZipEntry(path);
            destEntry.setTime(zipFile.getTime(name));
            zipOutStream.putNextEntry(destEntry);
            zipFile.open(name).copy(zipOutStream).close();
        }
        zipOutStream.flush();
        return dest;
    } finally {
        if (zipOutStream != null) {
            zipOutStream.close();
        }
    }
};
