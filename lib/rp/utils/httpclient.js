var log = require("ringo/logging").getLogger(module.id);
var config = require("../config");
var fs = require("fs");
var http = require("ringo/utils/http");
var io = require("io");
var files = require("ringo/utils/files");

export("get", "post", "composeUrl", "getBinary");

addToClasspath("../../../jars/httpcore-4.1.jar");
addToClasspath("../../../jars/httpclient-4.1.jar");
addToClasspath("../../../jars/httpmime-4.1.jar");
addToClasspath("../../../jars/commons-codec-1.4.jar");
addToClasspath("../../../jars/commons-compress-1.1.jar");
addToClasspath("../../../jars/commons-logging-1.1.1.jar");

var {DefaultHttpClient, BasicResponseHandler} = org.apache.http.impl.client;
var {HttpStatus} = org.apache.http;
var {MultipartEntity} = org.apache.http.entity.mime;
var {StringBody, FileBody, InputStreamBody, ByteArrayBody} = org.apache.http.entity.mime.content;
importPackage(org.apache.http.client.methods);
importPackage(org.apache.http.util);

var get = function(url, parameters) {
    var client = null;
    try {
        if (parameters != undefined) {
            url += "?" + http.urlEncode(parameters);
        }
        var httpGet = new HttpGet(url);
        client = new DefaultHttpClient();
        return client.execute(httpGet, new BasicResponseHandler());
    } catch (e) {
        // ignore
    } finally {
        if (client !== null) {
            client.getConnectionManager().shutdown();
        }
    }
    return null;
};

var getBinary = function(url) {
    var client = null;
    try {
        var httpGet = new HttpGet(url);
        client = new DefaultHttpClient();
        var response = client.execute(httpGet);
        var entity = response.getEntity();
        if (entity !== null) {
            var contentStream, fileStream;
            try {
                contentStream = new io.Stream(entity.getContent());
                var tmpFile = files.createTempFile("rpkg-");
                fileStream = fs.open(tmpFile, {
                    "write": true,
                    "binary": true
                });
                contentStream.copy(fileStream);
                EntityUtils.consume(entity);
                return tmpFile;
            } finally {
                if (contentStream != null) {
                    contentStream.close();
                }
                if (fileStream != null) {
                    fileStream.close();
                }
            }
        }
    } catch (e) {
        // ignore
        print("ERROR", e);
    } finally {
        if (client !== null) {
            client.getConnectionManager().shutdown();
        }
    }
    return null;
}

var post = function(url, data) {
    var client = null;
    try {
        client = new DefaultHttpClient();
        var httpPost = new HttpPost(url);
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
                body = new StringBody(String(value));
            }
            requestEntity.addPart(key, body);
        });
        httpPost.setEntity(requestEntity);
        client = new DefaultHttpClient();
        var response = client.execute(httpPost);
        var statusLine = response.getStatusLine();
        var statusCode = statusLine.getStatusCode();
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

var composeUrl = function() {
    return Array.prototype.map.call(arguments, function(val, idx, arr) {
        val = val.replace(composeUrl.LEADING, "");
        if (idx < arr.length -1) {
            val = val.replace(composeUrl.TRAILING, "");
        }
        return val;
    }).join("/");
};
composeUrl.LEADING = /^\//;
composeUrl.TRAILING = /\/$/;