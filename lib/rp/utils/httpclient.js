var log = require("ringo/logging").getLogger(module.id);
var fs = require("fs");
var http = require("ringo/utils/http");
var io = require("io");
var files = require("ringo/utils/files");

addToClasspath("../../../jars/httpcore-4.1.jar");
addToClasspath("../../../jars/httpclient-4.1.jar");
addToClasspath("../../../jars/httpmime-4.1.jar");
addToClasspath("../../../jars/commons-codec-1.4.jar");
addToClasspath("../../../jars/commons-logging-1.1.1.jar");

var {DefaultHttpClient, BasicResponseHandler} = org.apache.http.impl.client;
var {HttpStatus} = org.apache.http;
var {MultipartEntity} = org.apache.http.entity.mime;
var {StringBody, FileBody, InputStreamBody, ByteArrayBody} = org.apache.http.entity.mime.content;
var {Charset} = java.nio.charset;
var {BasicScheme} = org.apache.http.impl.auth;
var {UsernamePasswordCredentials} = org.apache.http.auth;
importPackage(org.apache.http.client.methods);
importPackage(org.apache.http.util);

const RE_SLASH_LEADING = /^\//;
const RE_SLASH_TRAILING = /\/$/;

var executeRequest = function(client, method, handler) {
    try {
        if (handler != null) {
            return client.execute(method, handler);
        }
        return client.execute(method);
    } catch (e) {
        throw new Error("Unable to connect to registry");
    }
};

exports.get = function(url, parameters, headers) {
    if (parameters != undefined) {
        url += "?" + http.urlEncode(parameters);
    }
    var httpGet = new HttpGet(url);
    if (headers != undefined) {
        for (var key in headers) {
            httpGet.setHeader(key, headers[key]);
        }
    }
    var client = null;
    try {
        client = new DefaultHttpClient();
        return executeRequest(client, httpGet, new BasicResponseHandler());
    } finally {
        if (client !== null) {
            client.getConnectionManager().shutdown();
        }
    }
    return null;
};

exports.getBinary = function(url) {
    var httpGet = new HttpGet(url);
    var client = null;
    try {
        client = new DefaultHttpClient();
        var response = executeRequest(client, httpGet);
        var entity = response.getEntity();
        var checksums = {};
        if (entity !== null) {
            var md5Digest = java.security.MessageDigest.getInstance("MD5");
            var sha1Digest = java.security.MessageDigest.getInstance("SHA-1");
            var sha256Digest = java.security.MessageDigest.getInstance("SHA-256");
            var contentStream, fileStream, md5Stream, sha1Stream, sha256Stream;
            try {
                contentStream = new io.Stream(entity.getContent());
                var tmpFile = files.createTempFile("rpkg-");
                fileStream = fs.open(tmpFile, {
                    "write": true,
                    "binary": true
                });
                md5Stream = new java.security.DigestOutputStream(fileStream, md5Digest);
                sha1Stream = new java.security.DigestOutputStream(md5Stream, sha1Digest);
                sha256Stream = new java.security.DigestOutputStream(sha1Stream, sha256Digest);
                contentStream.copy(sha256Stream);
                EntityUtils.consume(entity);
                checksums.md5 = bytesToHex(md5Digest.digest());
                checksums.sha1 = bytesToHex(sha1Digest.digest());
                checksums.sha256 = bytesToHex(sha256Digest.digest());
                return [tmpFile, checksums];
            } finally {
                for each (let stream in [contentStream, sha256Stream]) {
                    if (stream != null) {
                        stream.close();
                    }
                }
            }
        }
    } finally {
        if (client !== null) {
            client.getConnectionManager().shutdown();
        }
    }
    return null;
};

exports.post = function(url, data, username, password) {
    var client = null;
    try {
        client = new DefaultHttpClient();
        var httpPost = new HttpPost(url);
        var credentials = new UsernamePasswordCredentials(username, password);
        httpPost.addHeader((new BasicScheme()).authenticate(credentials, httpPost));
        var requestEntity = new MultipartEntity();
        Object.keys(data).forEach(function(key) {
            var value = data[key];
            var body;
            if (value instanceof fs.Path) {
                var filename = value.base();
                var mimeType = java.net.URLConnection.guessContentTypeFromName(filename) ||
                        "application/octet-stream";
                var stream = value.open({"binary": true});
                body = new InputStreamBody(stream, mimeType, filename);
            } else {
                body = new StringBody(String(value), Charset.forName("UTF-8"));
            }
            requestEntity.addPart(key, body);
        });
        httpPost.setEntity(requestEntity);
        var response = executeRequest(client, httpPost);
        var entity = response.getEntity();
        if (entity != null) {
            var charset = EntityUtils.getContentCharSet(entity);
            var content = EntityUtils.toString(entity, charset);
            EntityUtils.consume(entity);
            return content;
        }
    } catch (e) {
        log.error(e);
    } finally {
        if (client !== null) {
            client.getConnectionManager().shutdown();
        }
    }
    return null;
};

exports.del = function(url, username, password) {
    var client = null;
    try {
        client = new DefaultHttpClient();
        var httpDelete = new HttpDelete(url);
        var credentials = new UsernamePasswordCredentials(username, password);
        httpDelete.addHeader((new BasicScheme()).authenticate(credentials, httpDelete));
        var response = executeRequest(client, httpDelete);
        var entity = response.getEntity();
        if (entity != null) {
            var charset = EntityUtils.getContentCharSet(entity);
            var content = EntityUtils.toString(entity, charset);
            EntityUtils.consume(entity);
            return content;
        }
    } finally {
        if (client !== null) {
            client.getConnectionManager().shutdown();
        }
    }
    return null;
};

exports.composeUrl = function composeUrl() {
    return Array.prototype.map.call(arguments, function(val, idx, arr) {
        val = val.replace(RE_SLASH_LEADING, "");
        if (idx < arr.length -1) {
            val = val.replace(RE_SLASH_TRAILING, "");
        }
        return val;
    }).join("/");
};

var bytesToHex = function(bytes) {
    var buf = new java.lang.StringBuffer(bytes.length * 2);
    for (let idx = 0; idx < bytes.length; idx += 1) {
        buf.append(java.lang.Integer.toString((bytes[idx] & 0xff) + 0x100, 16).substring(1));
    }
    return buf.toString();
};

