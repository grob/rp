var log = require("ringo/logging").getLogger(module.id);
var {MessageDigest} = java.security;
var {bytesToHex} = require("./bytes");
var fs = require("fs");
var strings = require("ringo/utils/strings");
var {StringBuilder} = java.lang;

var getChecksums = exports.getChecksums = function(file) {
    var checksums = {};
    var md5Digest = MessageDigest.getInstance("MD5");
    var sha1Digest = MessageDigest.getInstance("SHA-1");
    var sha256Digest = MessageDigest.getInstance("SHA-256");
    var fileStream;
    try {
        fileStream = fs.openRaw(file);
        fileStream.forEach(function(bytes) {
            md5Digest.update(bytes);
            sha1Digest.update(bytes);
            sha256Digest.update(bytes);
        });
        checksums.md5 = bytesToHex(md5Digest.digest());
        checksums.sha1 = bytesToHex(sha1Digest.digest());
        checksums.sha256 = bytesToHex(sha256Digest.digest());
        return checksums;
    } finally {
        if (fileStream) {
            fileStream.close();
        }
    }
};

exports.verifyChecksums = function(file, expected) {
    var checksums = getChecksums(file);
    for each (var key in Object.keys(checksums)) {
        if (expected[key] !== checksums[key]) {
            throw new Error(key.toUpperCase() + " checksum mismatch");
        }
    }
};
