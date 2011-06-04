var log = require("ringo/logging").getLogger(module.id);
var io = require("io");
var fs = require("fs");
var {ByteArray} = require("binary");
var {TarArchiveEntry, TarArchiveOutputStream, TarArchiveInputStream} = org.apache.commons.compress.archivers.tar;
var {GzipCompressorOutputStream, GzipCompressorInputStream} = org.apache.commons.compress.compressors.gzip;

export("createArchive", "createArchiveStream", "extractArchive", "extractStream");

var createArchive = function(dirPath, dest) {
    var outStream = null;
    var bufOutStream = null;
    var gzipOutStream = null;
    var tarOutStream = null;
    try {
        if (typeof(dest) === "string") {
            outStream = fs.open(dest, {
                "binary": true,
                "write": true
            });
        } else if (dest instanceof java.io.ByteArrayOutputStream) {
            outStream = dest;
        } else {
            throw new Error("Destination argument must be either a string or a ByteArrayOutputStream");
        }
        bufOutStream = new java.io.BufferedOutputStream(outStream);
        gzipOutStream = new GzipCompressorOutputStream(bufOutStream);
        tarOutStream = new TarArchiveOutputStream(gzipOutStream);
        var tree = fs.listTree(dirPath);
        for each (var path in tree) {
            if (path.charAt(0) === ".") {
                continue;
            }
            addEntry(tarOutStream, path, dirPath);
        }
    } finally {
        if (tarOutStream !== null) {
            tarOutStream.finish();
            tarOutStream.close();
        }
        if (gzipOutStream !== null) {
            gzipOutStream.close();
        }
        if (bufOutStream !== null) {
            bufOutStream.close();
        }
        if (outStream !== null) {
            outStream.close();
        }
    }
    return;
};

var createArchiveStream = function(dirPath) {
    var bufOutStream = null;
    var gzipOutStream = null;
    var tarOutStream = null;
    try {
        var outStream = new java.io.ByteArrayOutputStream();
        bufOutStream = new java.io.BufferedOutputStream(outStream);
        gzipOutStream = new GzipCompressorOutputStream(bufOutStream);
        tarOutStream = new TarArchiveOutputStream(gzipOutStream);
        var tree = fs.listTree(dirPath);
        for each (var path in tree) {
            if (path.charAt(0) === ".") {
                continue;
            }
            addEntry(tarOutStream, path, dirPath);
        }
        return outStream;
    } finally {
        if (tarOutStream !== null) {
            tarOutStream.finish();
            tarOutStream.close();
        }
        if (gzipOutStream !== null) {
            gzipOutStream.close();
        }
        if (bufOutStream !== null) {
            bufOutStream.close();
        }
    }
    return null;
};

var extractArchive = function(archivePath, destPath) {
    extractStream(fs.open(archivePath), destPath);
    return;
};

var extractStream = function(stream, destPath) {
    var gzipInStream = null;
    var tarInStream = null;
    try {
        gzipInStream = new GzipCompressorInputStream(stream);
        tarInStream = new TarArchiveInputStream(gzipInStream);
        var entry;
        while ((entry = tarInStream.getNextTarEntry()) !== null) {
            extractEntry(tarInStream, entry, destPath);
        }
    } finally {
        if (gzipInStream !== null) {
            gzipInStream.close();
        }
        if (tarInStream !== null) {
            tarInStream.close();
        }
        stream.close();
    }
    return;
};

var addEntry = function(tarOutStream, path, basePath) {
    var filePath = fs.join(basePath, path);
    log.debug("Adding", filePath, "to archive at", path);
    var entry = new TarArchiveEntry(new java.io.File(filePath), path);
    tarOutStream.setLongFileMode(TarArchiveOutputStream.LONGFILE_GNU);
    tarOutStream.putArchiveEntry(entry);
    if (fs.isFile(filePath)) {
        fs.openRaw(filePath).copy(tarOutStream).close();
        tarOutStream.closeArchiveEntry();
    } else {
        tarOutStream.closeArchiveEntry();
    }
    return;
};

var extractEntry = function(tarInStream, entry, destPath) {
    var entryPath = entry.getName();
    var path = fs.join(destPath, entryPath);
    if (entry.isDirectory()) {
        if (!fs.exists(path)) {
            log.debug("Creating directory", path);
            fs.makeDirectory(path);
        }
    } else {
        log.debug("Extracting", path);
        var size = entry.getSize();
        var buffer = new ByteArray(size);
        tarInStream.read(buffer);
        var fileStream = fs.open(path, {
            "binary": true,
            "write": true
        });
        fileStream.write(buffer);
        fileStream.close();
    }
    return;
};
